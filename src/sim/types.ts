/**
 * Shared game types — Test Contract v1.2 (TICKET-03, "Đèn cạn dầu").
 *
 * Everything in `src/sim` is pure logic: no DOM, no Three.js, no fs,
 * no WebAudio, no Math.random(). The GUI and the headless runner drive
 * this same module.
 *
 * Lantern fuel is stored as an integer count of 1/60 fuel units so the
 * decay (1/s) and shade drain (5/s) never accumulate floating-point error.
 * Only the output layer converts it back to a real number with 1 decimal.
 */

export type Vec3 = [number, number, number];
export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';
export type MoteKind = 'random' | 'dropped';

export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  lantern_count_night2: number;
  lantern_count_night3: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
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
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  // Standard constants from TICKET-02 Part 1.
  accel_time_s: number;
  jump_speed: number;
  gravity: number;
  pickup_height_diff: number;
  initial_motes: number;
  max_motes: number;
  mote_spawn_interval_ticks: number;
  safe_push_ticks: number;
  pulse_center_offset: number;
  pulse_push_ticks: number;
  shade_speed_night3: number;
  shade_detect: number;
  shade_lose: number;
  shade_hit_height_diff: number;
  shade_recoil_ticks: number;
  shade_recoil_m: number;
  shade_first_spawn_tick: number;
  shade_first_spawn_count: number;
  dropped_mote_ttl_ticks: number;
  dropped_ring_min: number;
  dropped_ring_max: number;
  fall_y: number;
  fall_wait_ticks: number;
  drifter_speed: number;
  drifter_idle_speed: number;
  drifter_max: number;
  drifter_spawn_interval_ticks: number;
  drifter_steal_max: number;
  drifter_chase_carried: number;
  drifter_detect: number;
  drifter_touch_radius: number;
  drifter_flee_ticks: number;
  charm_duration_ticks: number;
  charm_respawn_ticks: number;
  charm_speed: number;
  wind_interval_ticks: number;
  wind_duration_ticks: number;
  wind_warning_ticks: number;
  wind_push_speed: number;
  // New in TICKET-03 (contract v1.2).
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  relight_cost: number;
  win_ratio: number;
  drain_per_s: number;
  low_fuel_threshold: number;
  capacity_max: number;
  score: {
    per_mote: number;
    per_lantern: number;
    per_relight: number;
    per_stun: number;
    per_draining_stun: number;
    per_lantern_at_dawn: number;
    per_flame_left: number;
  };
}

export interface Mote {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  /** Remaining lifetime in ticks; -1 means permanent. */
  ttl: number;
}

export interface Shade {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stateTicksLeft: number;
  /** Horizontal speed while wandering / recoiling / pushed by a pulse. */
  vel: [number, number];
  pushTicksLeft: number;
  /** Lantern this shade is draining (v1.2). */
  targetLanternId?: string;
}

export interface Drifter {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stateTicksLeft: number;
  stolen: number;
}

export interface Charm {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface Lantern {
  id: string;
  pos: Vec3;
  lit: boolean;
  /** Fuel in integer 1/60 units; 6000 = 100 fuel. */
  fuel: number;
  ever_lit: boolean;
  relit_count: number;
  deposited: number;
}

export interface Player {
  pos: Vec3;
  vel: [number, number];
  velY: number;
  grounded: boolean;
  facingDeg: number;
  flames: number;
  carried: number;
  capacity: number;
  successful_lights: number;
  invuln: number;
  dashCd: number;
  pulseCd: number;
  charmTicks: number;
  dashTicks: number;
  dashDir: [number, number];
  padLock: boolean;
  fallWait: number;
  hasFallen: boolean;
}

export interface GameEvent {
  tick: number;
  name: string;
  data: Record<string, unknown>;
}

export interface Wind {
  active: boolean;
  dirDeg: number;
  ticksLeft: number;
  warning: boolean;
}

export interface NightSpec {
  night: 1 | 2 | 3;
  name: string;
  duration: number;
  start: Vec3;
  lanterns: Vec3[];
  motePoints: Vec3[];
  shadePoints: Vec3[];
  shadeIntervalTicks: number;
  maxShades: number;
  charmPoints: Vec3[];
  pads: Array<{ pos: Vec3; velY: number; velXZ: [number, number] }>;
  windEnabled: boolean;
  driftersEnabled: boolean;
  islands: Array<{ x: number; z: number; radius: number }>;
  bridge?: { xMin: number; xMax: number; zMin: number; zMax: number };
  ramps?: Array<{ angleDeg: number; inner: number; outer: number; top: number }>;
}

export interface World {
  /** Wall-clock tick: increases even while paused. */
  tick: number;
  /** Gameplay tick: frozen while paused. */
  simTick: number;
  state: GameState;
  paused: boolean;
  night: 1 | 2 | 3;
  spec: NightSpec;
  /** Effective night duration, possibly overridden by scenario.time_left_s. */
  duration: number;
  timeLeft: number;
  score: number;
  totalScore: number;
  player: Player;
  motes: Mote[];
  shades: Shade[];
  drifters: Drifter[];
  charms: Charm[];
  lanterns: Lantern[];
  wind: Wind;
  rng: () => number;
  prev: { jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean };
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  nextCharmId: number;
  nextDroppedId: number;
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
  pause?: boolean;
}

export interface InputState {
  move: [number, number];
  camYawDeg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface ScenarioFile {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    successful_lights?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    facing_deg?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Array<Vec3 | { pos: Vec3; kind?: MoteKind; ttl_ticks?: number }>;
  shades?: Array<{
    id?: string;
    pos: Vec3;
    state?: ShadeState;
    state_ticks_left?: number;
    target_lantern_id?: string;
  }>;
  drifters?: Array<{
    id?: string;
    pos: Vec3;
    state?: DrifterState;
    stolen?: number;
    state_ticks_left?: number;
  }>;
  charms?: Array<{ id: string; pos?: Vec3; available?: boolean; respawn_ticks?: number }>;
  lanterns?: Array<{
    id: string;
    pos?: Vec3;
    deposited?: number;
    lit?: boolean;
    /** Real fuel value 0..100; omitted with lit:true means 100. */
    fuel?: number;
    ever_lit?: boolean;
    relit_count?: number;
  }>;
  time_left_s?: number;
}
