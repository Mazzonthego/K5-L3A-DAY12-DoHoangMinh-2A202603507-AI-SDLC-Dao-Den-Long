import type { Tuning } from './types';

/**
 * Single source of truth for gameplay numbers.
 *
 * These values MUST match `tuning` in game.contract.json — `tests/contract.test.ts`
 * fails the build if they drift. Change both together, then re-run `npm run verify`.
 */
export const TUNING: Tuning = {
  player_speed: 5,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 3,
  pulse_cooldown_s: 3,
  safe_radius: 4,
  shade_speed: 3,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

/** Radius of the island floor, in metres (not part of the tuning contract). */
export const ISLAND_RADIUS = 30;

/**
 * One extra shade joins every 30 seconds (1800 ticks) in the default game,
 * spawned on the island rim with world.rng. Disabled only when a scenario sets
 * `random_shades: false` (contract section D); an explicit `shades` list only
 * replaces the initial shades.
 */
export const SHADE_SPAWN_INTERVAL_TICKS = 1800;
export const MAX_SHADES = 8;

/** Where the five lanterns stand on night 1 (contract ids L1..L5). */
export const LANTERN_POSITIONS: Array<[number, number, number]> = [
  [0, 0, 18],
  [17.1, 0, 5.6],
  [10.6, 0, -14.6],
  [-10.6, 0, -14.6],
  [-17.1, 0, 5.6],
];
