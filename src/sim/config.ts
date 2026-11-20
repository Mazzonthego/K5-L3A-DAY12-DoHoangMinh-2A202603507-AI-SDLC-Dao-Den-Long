import type { NightSpec, Tuning, Vec3 } from './types';

/**
 * Standard numbers from TICKET-02 Part 1. `game.contract.json` must mirror this
 * object; `tests/sim.test.ts` fails when the two drift apart.
 */
export const TUNING: Tuning = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  lantern_count_night2: 6,
  lantern_count_night3: 7,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: true,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  accel_time_s: 0.1,
  jump_speed: 7,
  gravity: -20,
  pickup_height_diff: 1.5,
  initial_motes: 20,
  max_motes: 30,
  mote_spawn_interval_ticks: 240,
  safe_push_ticks: 30,
  pulse_center_offset: 0.8,
  pulse_push_ticks: 15,
  shade_speed_night3: 4.5,
  shade_detect: 12,
  shade_lose: 18,
  shade_hit_height_diff: 1.5,
  shade_recoil_ticks: 60,
  shade_recoil_m: 2,
  shade_first_spawn_tick: 300,
  shade_first_spawn_count: 2,
  dropped_mote_ttl_ticks: 480,
  dropped_ring_min: 1.5,
  dropped_ring_max: 2.5,
  fall_y: -10,
  fall_wait_ticks: 60,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_max: 2,
  drifter_spawn_interval_ticks: 1200,
  drifter_steal_max: 3,
  drifter_chase_carried: 5,
  drifter_detect: 15,
  drifter_touch_radius: 1.2,
  drifter_flee_ticks: 240,
  charm_duration_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  wind_interval_ticks: 1800,
  wind_duration_ticks: 300,
  wind_warning_ticks: 120,
  wind_push_speed: 2,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

export const TICKS_PER_SECOND = 60;

function point(x: number, y: number, z: number): Vec3 {
  return [round3(x), y, round3(z)];
}

function ring(radius: number, count: number, y: number, startDeg = 0, stepDeg?: number): Vec3[] {
  const step = stepDeg ?? 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const angle = ((startDeg + i * step) * Math.PI) / 180;
    return point(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
  });
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const night1Motes = [...ring(12, 8, 0), ...ring(33, 16, 0)];
const night1Shades = ring(37, 12, 0, 15, 30);

const night2Motes = [
  ...ring(10, 4, 0).map(([x, y, z]) => point(x, y, z)),
  ...ring(22, 8, 0).map(([x, y, z]) => point(x, y, z)),
  ...ring(10, 4, 0).map(([x, y, z]) => point(x + 70, y, z)),
  ...ring(22, 8, 0).map(([x, y, z]) => point(x + 70, y, z)),
];
const night2Shades = [
  ...ring(26, 8, 0, 22.5),
  ...ring(26, 8, 0, 22.5).map(([x, y, z]) => point(x + 70, y, z)),
];

const night3Motes = [
  ...ring(34, 18, 0),
  ...ring(18, 8, 3, 20, 20),
  ...ring(5, 4, 6, 45, 90),
];
const night3Shades = ring(43, 16, 0, 0, 22.5);

/** Standard maps from TICKET-02 Part 2. */
export const NIGHTS: Record<1 | 2 | 3, NightSpec> = {
  1: {
    night: 1,
    name: 'Đảo Bến',
    duration: TUNING.night1_duration_s,
    start: point(0, 0, 0),
    lanterns: [
      point(0, 0, 25),
      point(23.8, 0, 7.7),
      point(14.7, 0, -20.2),
      point(-14.7, 0, -20.2),
      point(-23.8, 0, 7.7),
    ],
    motePoints: night1Motes,
    shadePoints: night1Shades,
    shadeIntervalTicks: 480,
    maxShades: 6,
    charmPoints: [],
    pads: [],
    windEnabled: false,
    driftersEnabled: false,
    islands: [{ x: 0, z: 0, radius: 40 }],
  },
  2: {
    night: 2,
    name: 'Đảo Cau',
    duration: TUNING.night2_duration_s,
    start: point(0, 0, 0),
    lanterns: [
      point(0, 0, 20),
      point(17, 0, -10),
      point(-17, 0, -10),
      point(70, 0, 20),
      point(87, 0, -10),
      point(53, 0, -10),
    ],
    motePoints: night2Motes,
    shadePoints: night2Shades,
    shadeIntervalTicks: 420,
    maxShades: 8,
    charmPoints: [point(35, 0, 0)],
    pads: [
      { pos: point(20, 0, 18), velY: 14, velXZ: [24, 0] },
      { pos: point(50, 0, -18), velY: 14, velXZ: [-24, 0] },
    ],
    windEnabled: false,
    driftersEnabled: true,
    islands: [
      { x: 0, z: 0, radius: 28 },
      { x: 70, z: 0, radius: 28 },
    ],
    bridge: { xMin: 26, xMax: 44, zMin: -2, zMax: 2 },
  },
  3: {
    night: 3,
    name: 'Đảo Chuông',
    duration: TUNING.night3_duration_s,
    start: point(0, 0, 0),
    lanterns: [
      point(0, 6, 6),
      point(18, 3, 10),
      point(-18, 3, 10),
      point(35, 0, -10),
      point(-35, 0, -10),
      point(20, 0, -35),
      point(-20, 0, -35),
    ],
    motePoints: night3Motes,
    shadePoints: night3Shades,
    shadeIntervalTicks: 360,
    maxShades: 10,
    charmPoints: [point(30, 0, 25), point(-30, 0, 25)],
    pads: [{ pos: point(0, 3, 13), velY: 12, velXZ: [0, -8] }],
    windEnabled: true,
    driftersEnabled: true,
    islands: [{ x: 0, z: 0, radius: 45 }],
    ramps: [
      { angleDeg: 30, inner: 24, outer: 30, top: 3 },
      { angleDeg: 150, inner: 24, outer: 30, top: 3 },
    ],
  },
};

export function durationForNight(night: 1 | 2 | 3): number {
  return NIGHTS[night].duration;
}
