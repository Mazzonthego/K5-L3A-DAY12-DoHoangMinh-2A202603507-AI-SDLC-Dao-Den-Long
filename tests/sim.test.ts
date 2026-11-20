import { describe, expect, it } from 'vitest';
import contract from '../game.contract.json';
import { TUNING } from '../src/sim/config';
import { InputFormatError, InputTrack } from '../src/sim/inputs';
import { snapshotLine } from '../src/sim/output';
import { step } from '../src/sim/step';
import type { InputState, World } from '../src/sim/types';
import { createWorld } from '../src/sim/world';

function idle(): InputState {
  return { move: [0, 0], camYawDeg: 0, jump: false, interact: false, pulse: false };
}

function run(world: World, input: InputState, ticks: number): void {
  for (let i = 0; i < ticks; i += 1) step(world, input);
}

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
    run(world, idle(), 10);
    expect(world.state).toBe('lost');
    expect(world.tick).toBe(3);
  });
});

describe('scenario construction', () => {
  it('replaces motes and shades when listed', () => {
    const world = createWorld({
      seed: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [[0, 0, 5]],
        shades: [{ pos: [10, 0, 0] }],
      },
    });
    expect(world.motes).toHaveLength(1);
    expect(world.shades).toHaveLength(1);
    expect(world.motes[0].pos).toEqual([0, 0, 5]);
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

describe('determinism', () => {
  it('produces identical output for the same seed and inputs', () => {
    const build = (): string[] => {
      const world = createWorld({ seed: 42 });
      const lines = [snapshotLine(world)];
      for (let i = 0; i < 300; i += 1) {
        step(world, { ...idle(), move: [i % 2 === 0 ? 0.4 : -0.4, 1] });
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
});
