/**
 * Shared game types.
 *
 * Everything in `src/sim` is pure logic: no DOM, no Three.js, no I/O.
 * The GUI (`src/main.ts`) and the headless runner (`src/headless/main.ts`)
 * both drive this same module, so behaviour cannot drift between them.
 */

export type Vec3 = [number, number, number];

export type GameState = 'playing' | 'won' | 'lost';

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: {
    per_mote: number;
    per_lantern: number;
    per_stun: number;
    per_second_left: number;
    per_flame_left: number;
  };
}

export interface Mote {
  id: string;
  pos: Vec3;
  active: boolean;
}

export type ShadeState = 'chase' | 'stunned';

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stunT: number;
  /** Tick when the current stun started; keeps a fresh stun at full length. */
  stunnedAtTick: number;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface Player {
  pos: Vec3;
  flames: number;
  carried: number;
  invulnT: number;
  /** Remaining pulse cooldown in seconds. */
  pulseCooldownT: number;
}

export interface GameEvent {
  tick: number;
  name: string;
  data: Record<string, unknown>;
}

export interface World {
  tick: number;
  state: GameState;
  /** Duration of the night in seconds, as configured for this world. */
  duration: number;
  timeLeft: number;
  score: number;
  player: Player;
  motes: Mote[];
  shades: Shade[];
  lanterns: Lantern[];
  tuning: Tuning;
  rng: () => number;
  /** Rising-edge detection for interact/pulse (contract section C). */
  prevInteract: boolean;
  prevPulse: boolean;
  /** Next id for dynamically spawned shades, e.g. S4. */
  nextShadeId: number;
  /** Dynamic spawning is disabled only by `random_shades: false` (contract D). */
  spawnEnabled: boolean;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
}

export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
}

/** Raw JSON shape of a scenario file (all fields optional). */
export interface ScenarioFile {
  player?: { pos?: Vec3; carried?: number; flames?: number };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: Vec3[];
  shades?: Array<{ id?: string; pos: Vec3 }>;
  lanterns?: Array<{ id: string; pos?: Vec3; deposited?: number; lit?: boolean }>;
  time_left_s?: number;
}
