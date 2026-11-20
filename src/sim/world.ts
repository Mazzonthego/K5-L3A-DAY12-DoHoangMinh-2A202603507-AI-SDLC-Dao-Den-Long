import { LANTERN_POSITIONS, TUNING } from './config';
import { mulberry32 } from './rng';
import type { Mote, ScenarioFile, Shade, World } from './types';

export interface CreateWorldOptions {
  seed: number;
  scenario?: ScenarioFile;
}

/**
 * Build the initial world (snapshot tick 0) from a scenario file.
 *
 * Contract rules honoured here:
 * - missing fields fall back to the game defaults;
 * - `motes` / `shades` replace the whole list, `[]` means none;
 * - `lanterns` updates by id, untouched lanterns keep their state;
 * - building a scenario never emits events and never awards score.
 */
export function createWorld({ seed, scenario = {} }: CreateWorldOptions): World {
  const rng = mulberry32(seed);
  const tuning = TUNING;
  const duration = scenario.time_left_s ?? tuning.night1_duration_s;

  const world: World = {
    tick: 0,
    state: 'playing',
    duration,
    timeLeft: duration,
    score: 0,
    player: {
      pos: scenario.player?.pos ? [...scenario.player.pos] : [0, 0, 0],
      flames: scenario.player?.flames ?? tuning.flames,
      carried: scenario.player?.carried ?? 0,
      invulnT: 0,
    },
    motes: [],
    shades: [],
    lanterns: [],
    tuning,
    rng,
  };

  world.lanterns = LANTERN_POSITIONS.map((pos, i) => ({
    id: `L${i + 1}`,
    pos: [pos[0], pos[1], pos[2]] as [number, number, number],
    lit: false,
    deposited: 0,
  }));
  for (const update of scenario.lanterns ?? []) {
    const lantern = world.lanterns.find((l) => l.id === update.id);
    if (!lantern) throw new Error(`unknown lantern id: ${update.id}`);
    if (update.pos) lantern.pos = [...update.pos];
    if (update.deposited !== undefined) lantern.deposited = update.deposited;
    if (update.lit !== undefined) lantern.lit = update.lit;
  }

  world.motes = buildMotes(world, scenario);
  world.shades = buildShades(world, scenario);

  return world;
}

function buildMotes(world: World, scenario: ScenarioFile): Mote[] {
  if (scenario.motes) {
    return scenario.motes.map((pos, i) => ({ id: `M${i + 1}`, pos: [...pos], active: true }));
  }
  if (scenario.random_motes === false) return [];
  return Array.from({ length: 40 }, (_, i) => {
    const angle = world.rng() * Math.PI * 2;
    const radius = Math.sqrt(world.rng()) * 24;
    return {
      id: `M${i + 1}`,
      pos: [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)] as [
        number,
        number,
        number,
      ],
      active: true,
    };
  });
}

function buildShades(world: World, scenario: ScenarioFile): Shade[] {
  if (scenario.shades) {
    return scenario.shades.map((s, i) => ({
      id: s.id ?? `S${i + 1}`,
      pos: [...s.pos],
      state: 'chase',
      stunT: 0,
    }));
  }
  if (scenario.random_shades === false) return [];
  return Array.from({ length: 3 }, (_, i) => {
    const angle = world.rng() * Math.PI * 2;
    return {
      id: `S${i + 1}`,
      pos: [round3(Math.cos(angle) * 28), 0, round3(Math.sin(angle) * 28)] as [
        number,
        number,
        number,
      ],
      state: 'chase',
      stunT: 0,
    };
  });
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
