import { describe, expect, it } from 'vitest';
import contract from '../game.contract.json';
import { FUEL_MAX_UNITS, NIGHTS, TUNING } from '../src/sim/config';
import { insertEntry, isValidName, readBoard, sortEntries } from '../src/leaderboard';
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

describe('contract v1.3', () => {
  it('tuning matches the standard numbers', () => {
    expect(contract.contract_version).toBe('1.3');
    expect(contract.tuning).toEqual(JSON.parse(JSON.stringify(TUNING)));
  });

  it('declares runnable bench and soak commands', () => {
    expect(contract.bench_cmd).toBe('node scripts/bench.mjs');
    expect(contract.soak_cmd).toBe('node scripts/soak.mjs');
    expect(contract.run_cmd).toBe('node scripts/run.mjs');
  });

  it('has the new fuel / win / capacity keys and night durations', () => {
    expect(contract.tuning.fuel_max).toBe(100);
    expect(contract.tuning.fuel_decay_per_s).toBe(1);
    expect(contract.tuning.fuel_per_mote).toBe(10);
    expect(contract.tuning.relight_cost).toBe(5);
    expect(contract.tuning.win_ratio).toBe(0.6);
    expect(contract.tuning.drain_per_s).toBe(5);
    expect(contract.tuning.low_fuel_threshold).toBe(30);
    expect(contract.tuning.capacity_max).toBe(20);
    expect(contract.tuning.night1_duration_s).toBe(240);
    expect(contract.tuning.night2_duration_s).toBe(270);
    expect(contract.tuning.night3_duration_s).toBe(300);
  });

  it('has the standard maps', () => {
    expect(NIGHTS[1].lanterns).toHaveLength(5);
    expect(NIGHTS[2].lanterns).toHaveLength(6);
    expect(NIGHTS[3].lanterns).toHaveLength(7);
    expect(NIGHTS[1].motePoints).toHaveLength(24);
    expect(NIGHTS[2].motePoints).toHaveLength(24);
    expect(NIGHTS[3].motePoints).toHaveLength(30);
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

describe('motes and capacity', () => {
  it('starts with 20 motes at 20 different points', () => {
    const world = createWorld({ seed: 1, night: 1 });
    expect(world.motes).toHaveLength(20);
    expect(new Set(world.motes.map((m) => m.pos.join(','))).size).toBe(20);
  });

  it('picks up within 1 m XZ but respects the height difference', () => {
    const world = empty({ motes: [[0, 0, 1]] });
    expect(run(world, idle(), 1).map((e) => e.name)).toContain('mote_picked');
    const high = empty({ player: { pos: [0, 2, 0] }, motes: [[0, 0, 1]] });
    expect(run(high, idle(), 1).map((e) => e.name)).not.toContain('mote_picked');
  });

  it('capacity grows by 2 per successful light up to 20', () => {
    expect(empty({ player: { successful_lights: 3 } }).player.capacity).toBe(16);
    expect(empty({ player: { successful_lights: 9 } }).player.capacity).toBe(20);
    expect(empty().player.capacity).toBe(10);
  });

  it('does not pick up beyond capacity', () => {
    const world = empty({ player: { carried: 10 }, motes: [[0, 0, 1], [0, 0, 1.5]] });
    run(world, idle(), 1);
    expect(world.player.carried).toBe(10);
    expect(world.motes).toHaveLength(2);
  });
});

describe('lantern fuel (v1.2)', () => {
  it('lights a lantern for 5 motes + 100 points and fills fuel to 100', () => {
    const world = empty({
      player: { carried: 10 },
      lanterns: [{ id: 'L1', pos: [0, 0, 2] }],
    });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.map((e) => e.name)).toEqual(['night_start', 'deposit', 'lantern_lit']);
    expect(events.find((e) => e.name === 'lantern_lit')?.data).toEqual({
      lantern_id: 'L1',
      relight: false,
    });
    expect(world.score).toBe(150);
    expect(world.player.carried).toBe(0);
    expect(world.player.capacity).toBe(12);
    expect(world.lanterns[0].fuel).toBe(FUEL_MAX_UNITS);
    expect(world.lanterns[0].ever_lit).toBe(true);
  });

  it('deposits into the nearest receiving lantern, ties by smaller id', () => {
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

  it('refuels by exactly ceil((100 - fuel) / 10), so a barely decayed lamp takes 1 mote', () => {
    const world = empty({
      player: { carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true }],
    });
    // v1.2: one decay tick runs before interaction, so fuel = 99.983 and
    // ceil(0.017 / 10) = 1. A lantern with used = 0 is never selected; to
    // observe that, use a player with no motes.
    const event = run(world, { ...idle(), interact: true }, 1).find((e) => e.name === 'refuel');
    expect(event?.data).toEqual({ lantern_id: 'L1', amount: 1, fuel: 100 });
    expect(world.player.carried).toBe(4);
    expect(world.score).toBe(5);

    const broke = empty({
      player: { carried: 0 },
      lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true }],
    });
    expect(run(broke, { ...idle(), interact: true }, 1).map((e) => e.name)).toEqual([
      'night_start',
    ]);
    expect(broke.score).toBe(0);
  });

  it('decays 1 fuel per second and turns the lantern off at 0', () => {
    const world = empty({
      player: { pos: [0, 0, 30] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 1 }],
      time_left_s: 60,
    });
    const events = run(world, idle(), 60);
    expect(events.find((e) => e.name === 'lantern_out')?.data).toEqual({ lantern_id: 'L1' });
    expect(world.lanterns[0].lit).toBe(false);
    expect(world.lanterns[0].fuel).toBe(0);
    expect(world.lanterns[0].deposited).toBe(0);
    expect(world.lanterns[0].ever_lit).toBe(true);
  });

  it('decays exactly 1.0 per second without float drift', () => {
    const world = empty({
      player: { pos: [0, 0, 30] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      time_left_s: 60,
    });
    run(world, idle(), 60);
    expect(JSON.parse(snapshotLine(world)).lanterns[0].fuel).toBe(99);
  });

  it('refuels a lit lantern by whole motes and emits refuel', () => {
    const world = empty({
      player: { carried: 4 },
      lanterns: [{ id: 'L1', pos: [0, 0, 2], lit: true, fuel: 50 }],
    });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.find((e) => e.name === 'refuel')?.data).toEqual({
      lantern_id: 'L1',
      amount: 4,
      fuel: 90,
    });
    expect(world.score).toBe(20);
    expect(world.player.carried).toBe(0);
    // One decay tick already ran before the refuel (50 -> 49.983 -> 89.983).
    expect(world.lanterns[0].fuel).toBe(90 * 60 - 1);
    expect(JSON.parse(snapshotLine(world)).lanterns[0].fuel).toBe(90);
  });

  it('relights an ever_lit lantern for 5 motes with +40 and +2 capacity', () => {
    const world = empty({
      player: { carried: 5 },
      lanterns: [{ id: 'L1', pos: [0, 0, 2], ever_lit: true }],
    });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.find((e) => e.name === 'lantern_lit')?.data).toEqual({
      lantern_id: 'L1',
      relight: true,
    });
    expect(world.score).toBe(65);
    expect(world.player.capacity).toBe(12);
    expect(world.lanterns[0].relit_count).toBe(1);
    expect(world.lanterns[0].fuel).toBe(FUEL_MAX_UNITS);
  });

  it('scenario lanterns default to full fuel when lit', () => {
    const world = empty({ lanterns: [{ id: 'L1', lit: true }] });
    expect(world.lanterns[0].fuel).toBe(FUEL_MAX_UNITS);
    expect(world.lanterns[0].ever_lit).toBe(true);
  });
});

describe('win / lose (v1.2)', () => {
  it('does not end the night when every lantern is lit', () => {
    const world = empty({
      time_left_s: 10,
      lanterns: Array.from({ length: 5 }, (_, i) => ({
        id: `L${i + 1}`,
        lit: true,
      })),
    });
    const events = run(world, idle(), 1);
    expect(events.map((e) => e.name)).not.toContain('game_over');
    expect(world.state).toBe('playing');
  });

  it('wins at dawn when enough lanterns are still lit', () => {
    const world = empty({
      time_left_s: 2,
      player: { pos: [0, 0, 30] },
      lanterns: Array.from({ length: 5 }, (_, i) => ({
        id: `L${i + 1}`,
        lit: true,
      })),
    });
    const events = run(world, idle(), 120);
    expect(events.at(-1)?.data).toEqual({ result: 'won', reason: 'dawn_survived' });
    expect(world.lanterns.filter((l) => l.lit).length).toBe(5);
    expect(world.score).toBeGreaterThan(5 * TUNING.score.per_lantern_at_dawn);
  });

  it('loses at dawn when too few lanterns are lit', () => {
    const world = empty({
      time_left_s: 2,
      player: { pos: [0, 0, 30] },
      lanterns: [
        { id: 'L1', lit: true },
        { id: 'L2', lit: true },
      ],
    });
    const events = run(world, idle(), 120);
    expect(events.at(-1)?.data).toEqual({ result: 'lost', reason: 'dawn' });
  });

  it('no_flames wins over dawn even on the final tick', () => {
    const world = empty({ time_left_s: 1, player: { flames: 0, pos: [0, 0, 30] } });
    const events = run(world, idle(), 60);
    expect(events.at(-1)?.data).toEqual({ result: 'lost', reason: 'no_flames' });
  });
});

describe('shades, drain and pulse (v1.2)', () => {
  it('pulse costs 3, stuns 120 ticks, pushes 4 m and scores 5', () => {
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

  it('a weak lantern has no safe zone and attracts wandering shades into drain', () => {
    const world = empty({
      player: { pos: [0, 0, 20] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 0, 3], state: 'wander' }],
    });
    run(world, idle(), 20);
    expect(world.shades[0].state).toBe('drain');
    expect(world.shades[0].targetLanternId).toBe('L1');
  });

  it('a full lantern keeps the safe zone', () => {
    const world = empty({
      player: { pos: [0, 0, 20] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
      shades: [{ id: 'S1', pos: [0, 0, 3] }],
    });
    run(world, idle(), 40);
    expect(distXZ(world.shades[0].pos, [0, 0, 0])).toBeGreaterThanOrEqual(6);
  });

  it('draining drains 5 fuel/s on top of decay and emits fuel_drain once per second', () => {
    const world = empty({
      player: { pos: [0, 0, 30] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }],
      shades: [{ id: 'S1', pos: [0, 0, 1], state: 'drain', target_lantern_id: 'L1' }],
      time_left_s: 60,
    });
    const events = run(world, idle(), 60);
    const drains = events.filter((e) => e.name === 'fuel_drain');
    expect(drains).toHaveLength(1);
    // 29 - 1/s decay - 5/s drain = 23 after one second.
    expect(drains[0].data).toEqual({ lantern_id: 'L1', shade_id: 'S1', fuel: 23 });
    expect(world.lanterns[0].fuel).toBe(23 * 60);
  });

  it('refuel to at least 30 ends drain and pushes shades out of the safe zone', () => {
    const world = empty({
      player: { carried: 10, pos: [0, 0, -2] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 0, 1], state: 'drain', target_lantern_id: 'L1' }],
    });
    const events = run(world, { ...idle(), interact: true }, 1);
    expect(events.map((e) => e.name)).toContain('refuel');
    expect(world.lanterns[0].fuel).toBeGreaterThanOrEqual(30 * 60);
    expect(world.shades[0].state).toBe('wander');
    expect(world.shades[0].targetLanternId).toBeUndefined();
    // One tick of the push already elapsed in the same step (30 -> 29).
    expect(world.shades[0].pushTicksLeft).toBe(TUNING.safe_push_ticks - 1);
  });

  it('pulsing a draining shade scores 15 instead of 5', () => {
    const world = empty({
      player: { carried: 5, pos: [0, 0, 4] },
      lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 20 }],
      shades: [{ id: 'S1', pos: [0, 0, 1], state: 'drain', target_lantern_id: 'L1' }],
    });
    const events = run(world, { ...idle(), pulse: true }, 1);
    expect(events.map((e) => e.name)).toContain('pulse');
    expect(world.score).toBe(15);
    expect(world.shades[0].state).toBe('stunned');
  });

  it('a hit drops half the motes, grants 90 invuln ticks and recoils the shade', () => {
    const world = empty({
      player: { carried: 10 },
      shades: [{ id: 'S1', pos: [0, 0, 1] }],
    });
    const events = run(world, idle(), 1);
    expect(events.find((e) => e.name === 'player_hit')?.data).toMatchObject({
      by: 'shade',
      flames: 2,
      dropped: 5,
    });
    expect(world.player.carried).toBe(5);
    expect(world.player.invuln).toBe(90);
    expect(world.shades[0].state).toBe('recoil');
    expect(world.motes.filter((m) => m.kind === 'dropped')).toHaveLength(5);
  });

  it('shades spawn 2 at tick 300 then one per interval', () => {
    const world = createWorld({ seed: 3, night: 1, scenario: { player: { flames: 999 }, random_motes: false } });
    const events = run(world, idle(), 780);
    const spawns = events.filter((e) => e.name === 'shade_spawned');
    expect(spawns.slice(0, 3).map((e) => e.tick)).toEqual([300, 300, 780]);
    expect(spawns[0].data.id).toBe('S1');
  });
});

describe('fall, drifters, charms and pause', () => {
  it('fall costs one flame, waits 60 ticks and respawns invulnerable', () => {
    const world = empty({ player: { pos: [0, -11, 0], carried: 7 } });
    const events = run(world, idle(), 1);
    expect(events.find((e) => e.name === 'player_hit')?.data).toMatchObject({
      by: 'fall',
      lost: 1,
    });
    expect(world.player.flames).toBe(2);
    run(world, idle(), 60);
    expect(world.player.pos).toEqual([0, 0, 0]);
    expect(world.player.invuln).toBe(90);
  });

  it('drifter steals 3 motes and pulse makes it drop them with an event', () => {
    const world = empty(2, {
      player: { carried: 6 },
      drifters: [{ id: 'D1', pos: [0, 1, 0.5], state: 'chase' }],
    });
    expect(run(world, idle(), 1).find((e) => e.name === 'drifter_steal')?.data).toEqual({
      drifter_id: 'D1',
      amount: 3,
      carried: 3,
    });
    const dropped = run(world, { ...idle(), pulse: true }, 1);
    expect(dropped.find((e) => e.name === 'drifter_drop')?.data).toEqual({
      drifter_id: 'D1',
      amount: 3,
    });
    expect(world.motes.filter((m) => m.kind === 'dropped')).toHaveLength(3);
  });

  it('charm boosts speed to 7.2 and removes dash cooldown', () => {
    const world = empty(2, { charms: [{ id: 'C1', pos: [0, 0, 1] }] });
    expect(run(world, idle(), 1).find((e) => e.name === 'charm_picked')?.data.charm_ticks).toBe(600);
    run(world, { ...idle(), move: [0, 1] }, 30);
    expect(world.player.vel[1]).toBeCloseTo(7.2, 5);
    const dashes = run(world, { ...idle(), dash: true }, 1);
    expect(dashes.map((e) => e.name)).toContain('dash');
    expect(world.player.dashCd).toBe(0);
  });

  it('pause increments tick but freezes sim_tick, timers and snapshots as paused', () => {
    const world = empty({ time_left_s: 100 });
    run(world, idle(), 10);
    const simBefore = world.simTick;
    const timeBefore = world.timeLeft;
    expect(run(world, { ...idle(), pause: true }, 1).at(-1)?.name).toBe('paused');
    run(world, { ...idle(), pause: true }, 100);
    expect(world.simTick).toBe(simBefore);
    expect(world.timeLeft).toBe(timeBefore);
    expect(JSON.parse(snapshotLine(world)).state).toBe('paused');
    run(world, idle(), 1);
    expect(run(world, { ...idle(), pause: true }, 1).at(-1)?.name).toBe('resumed');
  });

  it('night 3 wind warns 2 s before 5 s of wind', () => {
    const world = createWorld({ seed: 5, night: 3, scenario: { player: { flames: 999 }, random_motes: false } });
    run(world, idle(), 1800);
    expect(world.wind.warning).toBe(true);
    run(world, idle(), 120);
    expect(world.wind.active).toBe(true);
    run(world, idle(), 300);
    expect(world.wind.active).toBe(false);
  });
});

describe('output and determinism', () => {
  it('writes v1.2 snapshot fields', () => {
    const world = empty({
      motes: [[0.12345, 0, 1]],
      lanterns: [{ id: 'L1', lit: true }],
    });
    const parsed = JSON.parse(snapshotLine(world));
    expect(parsed.night).toBe(1);
    expect(parsed.player).toMatchObject({ capacity: 10, successful_lights: 0 });
    expect(parsed.lanterns[0]).toMatchObject({ fuel: 100, ever_lit: true, relit_count: 0 });
    expect(parsed.motes[0].pos).toEqual([0.123, 0, 1]);
    expect(parsed.shades).toEqual([]);
    expect(JSON.parse(eventLine({ tick: 1, name: 'dash', data: {} }))).toEqual({
      type: 'event',
      tick: 1,
      name: 'dash',
      data: {},
    });
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

describe('leaderboard (v1.3)', () => {
  const entry = (name: string, score: number, achieved_at: string) => ({
    name, score, nights_won: 1, achieved_at, seed: 7,
  });

  it('validates names (3–12 chars, Vietnamese accents allowed)', () => {
    expect(isValidName('Mây')).toBe(true);
    expect(isValidName('Ten_123')).toBe(true);
    expect(isValidName('ab')).toBe(false);
    expect(isValidName('bad name')).toBe(false);
  });

  it('sorts by score then earliest achievement and keeps top 10', () => {
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry(`Player${i + 1}`, i < 2 ? 100 : i, `2026-11-2${i % 9}T00:00:00Z`),
    );
    const board = { entries: insertEntry(entries.slice(0, 11), entries[11]) };
    const sorted = sortEntries(board.entries);
    expect(sorted).toHaveLength(10);
    expect(sorted[0].score).toBe(100);
    expect(sorted[0].achieved_at < sorted[1].achieved_at).toBe(true);
    expect(readBoard(board).entries).toHaveLength(10);
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
