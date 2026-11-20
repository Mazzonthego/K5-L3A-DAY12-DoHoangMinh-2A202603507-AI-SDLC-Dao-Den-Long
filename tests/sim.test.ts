import { describe, expect, it } from 'vitest';
import contract from '../game.contract.json';
import { NIGHTS, TUNING } from '../src/sim/config';
import { distXZ } from '../src/sim/geometry';
import { InputFormatError, InputTrack } from '../src/sim/inputs';
import { eventLine, snapshotLine } from '../src/sim/output';
import { step } from '../src/sim/step';
import type { GameEvent, InputState, ScenarioFile, World } from '../src/sim/types';
import { createWorld } from '../src/sim/world';

function idle(): InputState {
  return {
    move: [0, 0],
    camYawDeg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
}

function run(world: World, input: InputState, ticks: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i += 1) events.push(...step(world, input));
  return events;
}

function empty(nightOrExtra: 1 | 2 | 3 | ScenarioFile = 1, extra: ScenarioFile = {}): World {
  const night = typeof nightOrExtra === 'number' ? nightOrExtra : 1;
  const scenario = typeof nightOrExtra === 'number' ? extra : nightOrExtra;
  return createWorld({
    seed: 7,
    night,
    scenario: {
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      ...scenario,
    },
  });
}

function lights(world: World, count: number): void {
  for (const lantern of world.lanterns.slice(0, count)) {
    lantern.lit = true;
    lantern.deposited = TUNING.lantern_cost;
  }
}

describe('contract v1.1', () => {
  it('tuning matches the standard numbers', () => {
    expect(contract.contract_version).toBe('1.1');
    expect(contract.tuning).toEqual(JSON.parse(JSON.stringify(TUNING)));
  });

  it('has the three night durations and dash keys', () => {
    expect(contract.tuning.night1_duration_s).toBe(300);
    expect(contract.tuning.night2_duration_s).toBe(330);
    expect(contract.tuning.night3_duration_s).toBe(360);
    expect(contract.tuning.dash_speed).toBe(14);
    expect(contract.tuning.dash_duration_s).toBe(0.2);
    expect(contract.tuning.dash_cooldown_s).toBe(1.5);
  });

  it('has the standard maps', () => {
    expect(NIGHTS[1].lanterns).toHaveLength(5);
    expect(NIGHTS[2].lanterns).toHaveLength(6);
    expect(NIGHTS[3].lanterns).toHaveLength(7);
    expect(NIGHTS[1].motePoints).toHaveLength(24);
    expect(NIGHTS[2].motePoints).toHaveLength(24);
    expect(NIGHTS[3].motePoints).toHaveLength(30);
    expect(NIGHTS[1].shadePoints).toHaveLength(12);
    expect(NIGHTS[2].shadePoints).toHaveLength(16);
    expect(NIGHTS[3].shadePoints).toHaveLength(16);
  });
});

describe('movement', () => {
  it('reaches full speed after at most 0.1 s and walks 6 m/s', () => {
    const world = empty();
    run(world, { ...idle(), move: [0, 1] }, 60);
    expect(world.player.pos[2]).toBeGreaterThan(5.7);
    expect(world.player.pos[2]).toBeLessThanOrEqual(6);
    expect(world.player.vel[1]).toBeCloseTo(6, 5);
  });

  it('normalises diagonals and rotates by cam_yaw_deg', () => {
    const world = empty();
    run(world, { ...idle(), move: [1, 1] }, 60);
    expect(Math.hypot(world.player.pos[0], world.player.pos[2])).toBeGreaterThan(5.7);
    const rotated = empty();
    run(rotated, { ...idle(), move: [0, 1], camYawDeg: 90 }, 60);
    expect(rotated.player.pos[0]).toBeGreaterThan(5.7);
    expect(Math.abs(rotated.player.pos[2])).toBeLessThan(0.01);
  });

  it('dashes 14 m/s for 12 ticks with a 1.5 s cooldown', () => {
    const world = empty();
    const events = run(world, { ...idle(), dash: true }, 1);
    expect(events.map((e) => e.name)).toContain('dash');
    expect(world.player.vel[1]).toBeCloseTo(14, 5);
    const before = world.player.pos[2];
    run(world, idle(), 11);
    expect(world.player.pos[2] - before).toBeCloseTo(14 * 11 / 60, 2);
    expect(world.player.dashCd).toBeGreaterThan(0);
    const cd = world.player.dashCd;
    run(world, idle(), 1);
    expect(world.player.dashCd).toBe(cd - 1);
  });

  it('jumps at 7 m/s under -20 m/s² gravity and lands', () => {
    const world = empty();
    run(world, { ...idle(), jump: true }, 6);
    expect(world.player.pos[1]).toBeGreaterThan(0);
    expect(world.player.grounded).toBe(false);
    run(world, idle(), 60);
    expect(world.player.pos[1]).toBeCloseTo(0, 3);
    expect(world.player.grounded).toBe(true);
  });
});

describe('motes and lanterns', () => {
  it('starts with 20 motes at 20 different points', () => {
    const world = createWorld({ seed: 1, night: 1 });
    expect(world.motes).toHaveLength(20);
    expect(new Set(world.motes.map((m) => m.pos.join(','))).size).toBe(20);
  });

  it('picks up within 1 m XZ but not beyond 1.5 m height difference', () => {
    const world = empty({ motes: [[0, 0, 1]] });
    expect(run(world, idle(), 1).map((e) => e.name)).toContain('mote_picked');
    const high = empty({ player: { pos: [0, 2, 0] }, motes: [[0, 0, 1]] });
    expect(run(high, idle(), 1).map((e) => e.name)).not.toContain('mote_picked');
  });

  it('scores 10 per deposited mote and 100 per lit lantern', () => {
    const world = empty({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.map((e) => e.name)).toEqual(['night_start', 'deposit', 'lantern_lit']);
    expect(events.find((e) => e.name === 'deposit')?.data).toEqual({
      lantern_id: 'L1',
      amount: 10,
      deposited: 10,
    });
    expect(world.score).toBe(200);
    expect(world.player.carried).toBe(0);
  });

  it('deposits into the nearest unlit lantern, ties by smaller id', () => {
    const world = empty({
      player: { carried: 5, pos: [0, 0, 0] },
      lanterns: [
        { id: 'L2', pos: [1, 0, 0] },
        { id: 'L1', pos: [-1, 0, 0] },
      ],
    });
    const event = run(world, { ...idle(), interact: true }, 1).find((e) => e.name === 'deposit');
    expect(event?.data.lantern_id).toBe('L1');
  });

  it('wins immediately when every lantern is lit and adds bonuses', () => {
    const world = empty({ time_left_s: 60 });
    lights(world, 5);
    const events = run(world, idle(), 1);
    expect(events.at(-1)?.data).toEqual({ result: 'won', reason: 'all_lit' });
    expect(world.score).toBe(59 * 2 + 3 * 50);
  });
});

describe('pulse, shades and damage', () => {
  it('pulse costs 3, stuns 120 ticks, pushes 4 m and scores 5 per shade', () => {
    const world = empty({
      player: { carried: 5 },
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    const events = run(world, { ...idle(), pulse: true }, 1);
    expect(events.find((e) => e.name === 'pulse')?.data).toEqual({ stunned_ids: ['S1'] });
    expect(world.player.carried).toBe(2);
    expect(world.score).toBe(5);
    expect(world.shades[0].state).toBe('stunned');
    expect(world.shades[0].stateTicksLeft).toBe(120);
    run(world, idle(), 15);
    expect(distXZ(world.player.pos, world.shades[0].pos)).toBeCloseTo(7, 1);
  });

  it('does not pulse without 3 motes', () => {
    const world = empty({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [0, 0, 3] }] });
    expect(run(world, { ...idle(), pulse: true }, 1).map((e) => e.name)).not.toContain('pulse');
  });

  it('shade chases at 4 m/s and switches wander/chase by 12/18 m', () => {
    const world = empty({
      player: { pos: [0, 0, 30] },
      shades: [{ id: 'S1', pos: [0, 0, 20] }],
    });
    run(world, idle(), 60);
    expect(world.shades[0].state).toBe('chase');
    expect(world.shades[0].pos[2]).toBeGreaterThan(23.5);
  });

  it('hit drops half the motes, grants 90 invuln ticks and recoils the shade', () => {
    const world = empty({
      player: { carried: 10 },
      shades: [{ id: 'S1', pos: [0, 0, 1] }],
    });
    const events = run(world, idle(), 1);
    const hit = events.find((e) => e.name === 'player_hit');
    expect(hit?.data).toMatchObject({ by: 'shade', flames: 2, dropped: 5 });
    expect(world.player.carried).toBe(5);
    expect(world.player.invuln).toBe(90);
    expect(world.shades[0].state).toBe('recoil');
    expect(world.motes.filter((m) => m.kind === 'dropped')).toHaveLength(5);
    expect(world.motes.filter((m) => m.kind === 'dropped')[0].ttl).toBe(480);
  });

  it('keeps shades outside safe_radius of a lit lantern', () => {
    const world = empty({
      player: { pos: [0, 0, 20] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    const events = run(world, idle(), 40);
    expect(distXZ(world.shades[0].pos, [0, 0, 0])).toBeGreaterThanOrEqual(6);
    expect(events.map((e) => e.name)).not.toContain('player_hit');
  });
});

describe('fall and respawn', () => {
  it('costs one flame, drops all motes, waits 60 ticks and respawns invulnerable', () => {
    const world = empty({
      player: { pos: [0, -11, 0], carried: 7 },
    });
    const events = run(world, idle(), 1);
    expect(events.find((e) => e.name === 'player_hit')?.data).toMatchObject({
      by: 'fall',
      dropped: 0,
      lost: 1,
    });
    expect(world.player.carried).toBe(0);
    expect(world.player.flames).toBe(2);
    run(world, idle(), 60);
    expect(world.player.pos).toEqual([0, 0, 0]);
    expect(world.player.invuln).toBe(90);
  });

  it('loses immediately when the fall removes the last flame', () => {
    const world = empty({ player: { pos: [0, -11, 0], flames: 1 } });
    const events = run(world, idle(), 1);
    expect(events.at(-1)?.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('schedules', () => {
  it('spawns 2 shades at tick 300, then one per interval, ids S1..', () => {
    const world = createWorld({ seed: 3, night: 1, scenario: { player: { flames: 999 }, random_motes: false } });
    const events = run(world, idle(), 780);
    const spawns = events.filter((e) => e.name === 'shade_spawned');
    expect(spawns.slice(0, 3).map((e) => e.tick)).toEqual([300, 300, 780]);
    expect(spawns[0].data.id).toBe('S1');
    expect(['wander', 'chase']).toContain(world.shades[0].state);
  });

  it('spawns one extra mote at tick 240 when a point is empty', () => {
    const world = createWorld({ seed: 3, night: 1 });
    const before = world.motes.length;
    run(world, idle(), 240);
    expect(world.motes.length).toBe(before + 1);
  });

  it('spawns drifters at tick 1200 on nights 2 and 3', () => {
    const world = createWorld({ seed: 3, night: 2, scenario: { player: { flames: 999 }, random_motes: false } });
    run(world, idle(), 1201);
    expect(world.drifters).toHaveLength(1);
    expect(world.drifters[0].id).toBe('D1');
    expect(world.drifters[0].state).toBe('idle');
  });
});

describe('drifters and charms', () => {
  it('steals up to 3 motes then flees; pulse makes it drop them', () => {
    const world = empty(2, {
      player: { carried: 6 },
      drifters: [{ id: 'D1', pos: [0, 1, 0.5], state: 'chase' }],
    });
    const events = run(world, idle(), 1);
    expect(events.find((e) => e.name === 'drifter_steal')?.data).toEqual({
      drifter_id: 'D1',
      amount: 3,
      carried: 3,
    });
    expect(world.drifters[0].state).toBe('flee');
    expect(world.drifters[0].stolen).toBe(3);
    const dropped = run(world, { ...idle(), pulse: true }, 1);
    expect(dropped.find((e) => e.name === 'drifter_drop')?.data).toEqual({
      drifter_id: 'D1',
      amount: 3,
    });
    expect(world.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
    expect(world.drifters[0].stolen).toBe(0);
  });

  it('charm pickup boosts speed to 7.2 and lasts 600 ticks', () => {
    const world = empty(2, { charms: [{ id: 'C1', pos: [0, 0, 1] }] });
    const events = run(world, idle(), 1);
    expect(events.find((e) => e.name === 'charm_picked')?.data).toEqual({
      charm_id: 'C1',
      charm_ticks: 600,
    });
    expect(world.player.charmTicks).toBe(600);
    run(world, { ...idle(), move: [0, 1] }, 30);
    expect(world.player.vel[1]).toBeCloseTo(7.2, 5);
  });
});

describe('night 3 wind and pause', () => {
  it('warns 2 s before 5 s of wind and exposes direction in snapshot', () => {
    const world = createWorld({ seed: 5, night: 3, scenario: { player: { flames: 999 }, random_motes: false } });
    run(world, idle(), 1800);
    expect(world.wind.warning).toBe(true);
    expect(JSON.parse(snapshotLine(world)).wind).toEqual({
      active: false,
      dir_deg: world.wind.dirDeg,
    });
    run(world, idle(), 120);
    expect(world.wind.active).toBe(true);
    run(world, idle(), 300);
    expect(world.wind.active).toBe(false);
  });

  it('pause increments tick but freezes sim_tick and all timers', () => {
    const world = empty({ time_left_s: 100 });
    run(world, idle(), 10);
    const simBefore = world.simTick;
    const timeBefore = world.timeLeft;
    const events = run(world, { ...idle(), pause: true }, 1);
    expect(events.at(-1)?.name).toBe('paused');
    expect(world.paused).toBe(true);
    run(world, { ...idle(), pause: true }, 100);
    expect(world.simTick).toBe(simBefore);
    expect(world.timeLeft).toBe(timeBefore);
    expect(JSON.parse(snapshotLine(world)).state).toBe('paused');
    run(world, idle(), 1);
    const resumed = run(world, { ...idle(), pause: true }, 1);
    expect(resumed.at(-1)?.name).toBe('resumed');
    expect(world.simTick).toBe(simBefore);
    run(world, idle(), 1);
    expect(world.simTick).toBe(simBefore + 1);
  });
});

describe('output and determinism', () => {
  it('writes v1.1 snapshot fields and rounded coordinates', () => {
    const world = empty({ motes: [[0.12345, 0, 1]] });
    const parsed = JSON.parse(snapshotLine(world));
    expect(parsed.night).toBe(1);
    expect(parsed.wind).toEqual({ active: false, dir_deg: 0 });
    expect(parsed.motes[0].pos).toEqual([0.123, 0, 1]);
    expect(parsed.player).toMatchObject({
      grounded: true,
      invuln: 0,
      dash_cd_s: 0,
      pulse_cd_s: 0,
      charm_s: 0,
    });
    expect(parsed.drifters).toEqual([]);
    expect(parsed.charms).toEqual([]);
    const event = JSON.parse(eventLine({ tick: 1, name: 'dash', data: {} }));
    expect(event).toEqual({ type: 'event', tick: 1, name: 'dash', data: {} });
  });

  it('produces identical output for the same seed, night, scenario and inputs', () => {
    const build = (): string[] => {
      const world = createWorld({ seed: 42, night: 2 });
      const lines = [snapshotLine(world)];
      for (let i = 0; i < 300; i += 1) {
        const events = step(world, {
          ...idle(),
          move: [i % 2 === 0 ? 0.4 : -0.4, 1],
          dash: i === 100,
          pulse: i === 150,
          interact: i === 200,
        });
        lines.push(...events.map(eventLine));
        if (world.tick % 10 === 0) lines.push(snapshotLine(world));
      }
      return lines;
    };
    expect(build()).toEqual(build());
  });
});

describe('input track', () => {
  it('keeps previous values for absent fields, including dash and pause', () => {
    const track = new InputTrack([
      { tick: 0, move: [0, 1] },
      { tick: 10, dash: true },
      { tick: 20, pause: true },
    ]);
    expect(track.at(20).move).toEqual([0, 1]);
    expect(track.at(20).dash).toBe(true);
    expect(track.at(20).pause).toBe(true);
  });

  it('rejects malformed frames', () => {
    expect(() => new InputTrack([{ tick: 5 }, { tick: 5 }])).toThrow(InputFormatError);
    expect(() => new InputTrack([{ tick: 0, move: [2, 0] }])).toThrow(InputFormatError);
    expect(() => new InputTrack([{ tick: 0, pause: 'yes' as unknown as boolean }])).toThrow(
      InputFormatError,
    );
  });
});
