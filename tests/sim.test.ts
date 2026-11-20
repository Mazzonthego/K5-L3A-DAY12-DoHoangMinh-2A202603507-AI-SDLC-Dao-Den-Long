import { describe, expect, it } from 'vitest';
import contract from '../game.contract.json';
import { TUNING } from '../src/sim/config';
import { InputFormatError, InputTrack } from '../src/sim/inputs';
import { eventLine, snapshotLine } from '../src/sim/output';
import { step } from '../src/sim/step';
import type { GameEvent, InputState, World } from '../src/sim/types';
import { createWorld } from '../src/sim/world';

function idle(): InputState {
  return { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false };
}

function run(world: World, input: InputState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i += 1) events.push(...step(world, input));
  return events;
}

function distXZ(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

const emptyWorld = (extra: Parameters<typeof createWorld>[0]['scenario'] = {}) =>
  createWorld({
    seed: 7,
    scenario: { random_motes: false, random_shades: false, ...extra },
  });

describe('contract tuning', () => {
  it('matches the numbers used by the simulation', () => {
    expect(contract.tuning).toEqual(JSON.parse(JSON.stringify(TUNING)));
  });

  it('has no zero/placeholder values left', () => {
    for (const [key, value] of Object.entries(contract.tuning)) {
      if (key === 'score' || key === 'fall_enabled') continue;
      expect(value, key).not.toBe(0);
    }
  });
});

describe('player movement', () => {
  it('walks at player_speed metres per second along +Z when yaw is 0', () => {
    const world = createWorld({ seed: 1 });
    run(world, { ...idle(), move: [0, 1] }, 60);
    expect(world.player.pos[0]).toBeCloseTo(0, 3);
    expect(world.player.pos[2]).toBeCloseTo(TUNING.player_speed, 2);
  });

  it('normalises diagonal input to unit length', () => {
    const world = createWorld({ seed: 1 });
    run(world, { ...idle(), move: [1, 1] }, 60);
    const distance = Math.hypot(world.player.pos[0], world.player.pos[2]);
    expect(distance).toBeCloseTo(TUNING.player_speed, 2);
  });

  it('rotates movement by cam_yaw_deg', () => {
    const world = createWorld({ seed: 1 });
    run(world, { ...idle(), move: [0, 1], camYawDeg: 90 }, 60);
    expect(world.player.pos[0]).toBeCloseTo(TUNING.player_speed, 2);
    expect(world.player.pos[2]).toBeCloseTo(0, 2);
  });
});

describe('tick model', () => {
  it('decrements time_left_s by exactly 1/60 per tick', () => {
    const world = createWorld({ seed: 1, scenario: { time_left_s: 10 } });
    run(world, idle(), 60);
    expect(world.timeLeft).toBeCloseTo(9, 5);
    expect(world.tick).toBe(60);
  });

  it('ends the night at dawn', () => {
    const world = createWorld({ seed: 1, scenario: { time_left_s: 0.05 } });
    const events = run(world, idle(), 10);
    expect(world.state).toBe('lost');
    expect(world.tick).toBe(3);
    expect(events.at(-1)).toMatchObject({
      tick: 3,
      name: 'game_over',
      data: { result: 'lost', reason: 'dawn' },
    });
  });

  it('stops stepping once the game is over', () => {
    const world = createWorld({ seed: 1, scenario: { time_left_s: 0.01 } });
    run(world, idle(), 2);
    const before = world.tick;
    run(world, idle(), 10);
    expect(world.tick).toBe(before);
  });
});

describe('scenario construction', () => {
  it('replaces motes and shades when listed', () => {
    const world = createWorld({
      seed: 1,
      scenario: {
        random_motes: false,
        motes: [[0, 0, 5]],
        shades: [{ id: 'boss', pos: [10, 0, 0] }],
      },
    });
    expect(world.motes).toHaveLength(1);
    expect(world.shades).toHaveLength(1);
    expect(world.shades[0].id).toBe('boss');
    expect(world.motes[0].pos).toEqual([0, 0, 5]);
    // Explicit `shades` only replaces the initial list; spawning stays on (contract D).
    expect(world.spawnEnabled).toBe(true);
  });

  it('disables spawning when random_shades is false', () => {
    expect(createWorld({ seed: 1, scenario: { random_shades: false } }).spawnEnabled).toBe(false);
  });

  it('updates lanterns by id and never scores while building', () => {
    const world = createWorld({
      seed: 1,
      scenario: { lanterns: [{ id: 'L2', pos: [1, 0, 2], lit: true }] },
    });
    const lantern = world.lanterns.find((l) => l.id === 'L2')!;
    expect(lantern.pos).toEqual([1, 0, 2]);
    expect(lantern.lit).toBe(true);
    expect(world.score).toBe(0);
    expect(world.lanterns.find((l) => l.id === 'L1')!.lit).toBe(false);
  });
});

describe('motes', () => {
  it('picks up a mote by contact and awards per_mote', () => {
    const world = emptyWorld({ motes: [[0, 0, 1]] });
    const events = run(world, idle(), 1);
    expect(events).toEqual([
      { tick: 1, name: 'mote_picked', data: { carried: 1 } },
    ]);
    expect(world.player.carried).toBe(1);
    expect(world.motes[0].active).toBe(false);
    expect(world.score).toBe(TUNING.score.per_mote);
  });

  it('does not pick up beyond carry_capacity', () => {
    const world = emptyWorld({ player: { carried: TUNING.carry_capacity }, motes: [[0, 0, 0]] });
    expect(run(world, idle(), 5)).toEqual([]);
    expect(world.player.carried).toBe(TUNING.carry_capacity);
    expect(world.motes[0].active).toBe(true);
  });

  it('picks up at most one mote per tick', () => {
    const world = emptyWorld({ motes: [[0, 0, 0], [0.2, 0, 0]] });
    expect(run(world, idle(), 1)).toHaveLength(1);
    expect(world.player.carried).toBe(1);
  });
});

describe('lanterns', () => {
  it('deposits on the rising edge of interact and lights the lantern', () => {
    const world = emptyWorld({
      player: { carried: TUNING.lantern_cost },
      lanterns: [{ id: 'L1', pos: [0, 0, 2] }],
    });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    expect(events[0].data).toEqual({ lantern_id: 'L1', amount: 5, deposited: 5 });
    expect(world.player.carried).toBe(0);
    expect(world.lanterns[0].lit).toBe(true);
    expect(world.score).toBe(TUNING.score.per_lantern);
    expect(run(world, { ...idle(), interact: true }, 5)).toEqual([]);
  });

  it('accumulates partial deposits until the lantern is full', () => {
    const world = emptyWorld({
      player: { carried: 3 },
      lanterns: [{ id: 'L1', pos: [0, 0, 2] }],
    });
    expect(run(world, { ...idle(), interact: true }, 1)[0].data).toEqual({
      lantern_id: 'L1',
      amount: 3,
      deposited: 3,
    });
    world.player.carried = 2;
    run(world, idle(), 1);
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.map((e) => e.name)).toEqual(['deposit', 'lantern_lit']);
    expect(events[0].data).toEqual({ lantern_id: 'L1', amount: 2, deposited: 5 });
  });

  it('finishes with all_lit and awards time/flame bonuses', () => {
    const world = emptyWorld({
      player: { pos: [-17.1, 0, 5.6], carried: 1 },
      time_left_s: 100,
      lanterns: [
        { id: 'L1', lit: true },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', deposited: TUNING.lantern_cost - 1 },
      ],
    });
    expect(world.score).toBe(0);
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.at(-1)).toMatchObject({
      name: 'game_over',
      data: { result: 'won', reason: 'all_lit' },
    });
    expect(world.state).toBe('won');
    expect(world.score).toBe(100 + 99 * 2 + 3 * 50);
  });
});

describe('pulse', () => {
  it('costs motes, stuns/pushes shades and awards per_stun', () => {
    const world = emptyWorld({
      player: { carried: 5 },
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    const events = run(world, { ...idle(), pulse: true }, 1);
    expect(events.map((e) => e.name)).toEqual(['pulse']);
    expect(events[0].data).toEqual({ stunned_ids: ['S1'] });
    expect(world.player.carried).toBe(3);
    expect(world.score).toBe(TUNING.score.per_stun);
    expect(world.shades[0].state).toBe('stunned');
    expect(world.shades[0].stunT).toBe(TUNING.pulse_stun_s);
    expect(distXZ(world.player.pos, world.shades[0].pos)).toBeCloseTo(6, 3);
  });

  it('respects cooldown and motes cost', () => {
    const world = emptyWorld({
      player: { carried: 1 },
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    expect(run(world, { ...idle(), pulse: true }, 1)).toEqual([]);
    expect(world.player.carried).toBe(1);
  });

  it('recovers from stun after pulse_stun_s', () => {
    const world = emptyWorld({
      player: { carried: 5 },
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    run(world, { ...idle(), pulse: true }, 1);
    run(world, idle(), TUNING.pulse_stun_s * 60 + 2);
    expect(world.shades[0].state).toBe('chase');
  });
});

describe('shades', () => {
  it('chases the player at shade_speed', () => {
    const world = emptyWorld({
      player: { pos: [0, 0, 20] },
      shades: [{ id: 'S1', pos: [0, 0, 10] }],
    });
    run(world, idle(), 60);
    expect(world.shades[0].pos[2]).toBeCloseTo(13, 2);
  });

  it('never enters safe_radius around a lit lantern', () => {
    const world = emptyWorld({
      player: { pos: [0, 0, 20] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [0, 0, 2] }],
    });
    run(world, idle(), 1);
    expect(distXZ(world.shades[0].pos, [0, 0, 0])).toBeGreaterThanOrEqual(TUNING.safe_radius);
  });

  it('hits the player, drops half the motes and grants invulnerability', () => {
    const world = emptyWorld({
      player: { carried: 10 },
      shades: [{ id: 'S1', pos: [0, 0, 1] }],
    });
    const events = run(world, idle(), 1);
    expect(events.map((e) => e.name)).toEqual(['player_hit']);
    expect(events[0].data).toEqual({ by: 'shade', flames: 2, dropped: 5 });
    expect(world.player.flames).toBe(2);
    expect(world.player.carried).toBe(5);
    expect(world.player.invulnT).toBeGreaterThan(0);
    expect(run(world, idle(), 1)).toEqual([]);
  });

  it('ends the game when the last flame is lost', () => {
    const world = emptyWorld({
      player: { flames: 1, carried: 2 },
      shades: [{ id: 'S1', pos: [0, 0, 0.5] }],
    });
    const events = run(world, idle(), 1);
    expect(events.at(-1)).toMatchObject({
      name: 'game_over',
      data: { result: 'lost', reason: 'no_flames' },
    });
    expect(world.state).toBe('lost');
  });

  it('spawns a new shade every 30 seconds in the default game', () => {
    const world = createWorld({ seed: 7, scenario: { player: { flames: 999 }, random_motes: false } });
    const events = run(world, idle(), 1800);
    expect(events.some((e) => e.name === 'shade_spawned' && e.tick === 1800)).toBe(true);
    expect(events.find((e) => e.name === 'shade_spawned')?.data).toEqual({ id: 'S4' });
  });
});

describe('output', () => {
  it('serialises active motes and rounds coordinates to 3 decimals', () => {
    const world = emptyWorld({ motes: [[0.12345, 0, 1]] });
    const parsed = JSON.parse(snapshotLine(world));
    expect(parsed.motes_active).toBe(1);
    expect(parsed.motes[0].pos).toEqual([0.123, 0, 1]);
    run(world, idle(), 1);
    const event = JSON.parse(eventLine({ tick: 1, name: 'mote_picked', data: { carried: 1 } }));
    expect(event).toEqual({ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  });
});

describe('determinism', () => {
  it('produces identical snapshots and events for the same seed and inputs', () => {
    const build = (): string[] => {
      const world = createWorld({ seed: 42 });
      const lines = [snapshotLine(world)];
      for (let i = 0; i < 300; i += 1) {
        const events = step(world, {
          ...idle(),
          move: [i % 2 === 0 ? 0.4 : -0.4, 1],
          pulse: i === 100,
          interact: i === 150,
        });
        lines.push(...events.map(eventLine));
        if (world.tick % 10 === 0) lines.push(snapshotLine(world));
      }
      return lines;
    };
    expect(build()).toEqual(build());
  });

  it('differs for a different seed', () => {
    const a = snapshotLine(createWorld({ seed: 1 }));
    const b = snapshotLine(createWorld({ seed: 2 }));
    expect(a).not.toEqual(b);
  });
});

describe('input track', () => {
  it('keeps previous values for absent fields', () => {
    const track = new InputTrack([
      { tick: 0, move: [0, 1] },
      { tick: 10, interact: true },
      { tick: 20, move: [1, 0] },
    ]);
    expect(track.at(0).move).toEqual([0, 1]);
    expect(track.at(10).interact).toBe(true);
    expect(track.at(10).move).toEqual([0, 1]);
    expect(track.at(20).move).toEqual([1, 0]);
  });

  it('rejects non-increasing ticks', () => {
    expect(() => new InputTrack([{ tick: 5 }, { tick: 5 }])).toThrow(InputFormatError);
  });

  it('rejects move values outside [-1, 1]', () => {
    expect(() => new InputTrack([{ tick: 0, move: [2, 0] }])).toThrow(InputFormatError);
  });

  it('rejects non-boolean action fields', () => {
    expect(
      () => new InputTrack([{ tick: 0, interact: 'yes' as unknown as boolean }]),
    ).toThrow(InputFormatError);
  });
});
