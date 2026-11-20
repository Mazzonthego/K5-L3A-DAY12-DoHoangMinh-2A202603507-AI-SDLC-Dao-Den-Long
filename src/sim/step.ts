import { ISLAND_RADIUS, MAX_SHADES, SHADE_SPAWN_INTERVAL_TICKS } from './config';
import type { GameEvent, InputState, Shade, Vec3, World } from './types';

export const TICKS_PER_SECOND = 60;
const DT = 1 / TICKS_PER_SECOND;

/**
 * Advance the world by exactly one tick (1/60 s).
 *
 * Contract tick model: the caller reads input for tick k, calls step(), and the
 * resulting events carry tick = k + 1. `world.tick` is incremented first.
 */
export function step(world: World, input: InputState): GameEvent[] {
  if (world.state !== 'playing') return [];
  const events: GameEvent[] = [];
  world.tick += 1;
  world.timeLeft = Math.max(0, world.duration - world.tick * DT);

  movePlayer(world, input);
  if (world.player.invulnT > 0) {
    world.player.invulnT = Math.max(0, world.player.invulnT - DT);
  }
  if (world.player.pulseCooldownT > 0) {
    world.player.pulseCooldownT = Math.max(0, world.player.pulseCooldownT - DT);
  }

  const interactPressed = input.interact && !world.prevInteract;
  const pulsePressed = input.pulse && !world.prevPulse;
  world.prevInteract = input.interact;
  world.prevPulse = input.pulse;

  pickupMotes(world, events);
  if (interactPressed) deposit(world, events);
  if (pulsePressed) pulse(world, events);

  if (world.state === 'playing') {
    updateShades(world);
    checkHits(world, events);
  }
  if (world.state === 'playing') maybeSpawnShade(world, events);

  if (world.state === 'playing' && world.lanterns.every((lantern) => lantern.lit)) {
    finish(world, events, 'won', 'all_lit');
  }
  if (world.state === 'playing' && world.timeLeft <= 0) {
    finish(world, events, 'lost', 'dawn');
  }

  return events;
}

function movePlayer(world: World, input: InputState): void {
  let [x, z] = input.move;
  const length = Math.hypot(x, z);
  if (length === 0) return;
  if (length > 1) {
    x /= length;
    z /= length;
  }
  const theta = (input.camYawDeg * Math.PI) / 180;
  const wx = x * Math.cos(theta) + z * Math.sin(theta);
  const wz = -x * Math.sin(theta) + z * Math.cos(theta);
  world.player.pos[0] += wx * world.tuning.player_speed * DT;
  world.player.pos[2] += wz * world.tuning.player_speed * DT;
}

/** Motes are picked up by contact (dist <= pickup_radius), one per tick. */
function pickupMotes(world: World, events: GameEvent[]): void {
  const { player, tuning } = world;
  for (const mote of world.motes) {
    if (!mote.active) continue;
    if (player.carried >= tuning.carry_capacity) break;
    if (distXZ(player.pos, mote.pos) > tuning.pickup_radius) continue;
    mote.active = false;
    player.carried += 1;
    world.score += tuning.score.per_mote;
    events.push({ tick: world.tick, name: 'mote_picked', data: { carried: player.carried } });
    break;
  }
}

/** `interact` deposits as many motes as the nearest lantern still needs. */
function deposit(world: World, events: GameEvent[]): void {
  const { player, tuning } = world;
  let target = null;
  let best = Infinity;
  for (const lantern of world.lanterns) {
    if (lantern.lit) continue;
    const distance = distXZ(player.pos, lantern.pos);
    if (distance <= tuning.interact_radius && distance < best) {
      target = lantern;
      best = distance;
    }
  }
  if (!target) return;

  if (target.deposited >= tuning.lantern_cost) {
    lightLantern(world, target.id, events);
    return;
  }
  const amount = Math.min(player.carried, tuning.lantern_cost - target.deposited);
  if (amount <= 0) return;
  player.carried -= amount;
  target.deposited += amount;
  events.push({
    tick: world.tick,
    name: 'deposit',
    data: { lantern_id: target.id, amount, deposited: target.deposited },
  });
  if (target.deposited >= tuning.lantern_cost) lightLantern(world, target.id, events);
}

function lightLantern(world: World, id: string, events: GameEvent[]): void {
  const lantern = world.lanterns.find((l) => l.id === id);
  if (!lantern || lantern.lit) return;
  lantern.lit = true;
  world.score += world.tuning.score.per_lantern;
  events.push({ tick: world.tick, name: 'lantern_lit', data: { lantern_id: id } });
}

/** Pulse costs motes, has a cooldown, stuns and pushes nearby shades away. */
function pulse(world: World, events: GameEvent[]): void {
  const { player, tuning } = world;
  if (player.carried < tuning.pulse_cost || player.pulseCooldownT > 0) return;
  player.carried -= tuning.pulse_cost;
  player.pulseCooldownT = tuning.pulse_cooldown_s;

  const stunnedIds: string[] = [];
  for (const shade of world.shades) {
    const distance = distXZ(player.pos, shade.pos);
    if (distance > tuning.pulse_radius) continue;
    pushAway(shade, player.pos, tuning.pulse_push_m);
    keepOutOfLitLanterns(world, shade);
    shade.state = 'stunned';
    shade.stunT = tuning.pulse_stun_s;
    shade.stunnedAtTick = world.tick;
    stunnedIds.push(shade.id);
  }
  world.score += stunnedIds.length * tuning.score.per_stun;
  events.push({ tick: world.tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
}

function updateShades(world: World): void {
  for (const shade of world.shades) {
    if (shade.state === 'stunned') {
      shade.stunT = Math.max(
        0,
        world.tuning.pulse_stun_s - (world.tick - shade.stunnedAtTick) / TICKS_PER_SECOND,
      );
      if (shade.stunT === 0) shade.state = 'chase';
      continue;
    }
    const dx = world.player.pos[0] - shade.pos[0];
    const dz = world.player.pos[2] - shade.pos[2];
    const distance = Math.hypot(dx, dz);
    if (distance === 0) continue;
    const travel = Math.min(world.tuning.shade_speed * DT, distance);
    shade.pos[0] += (dx / distance) * travel;
    shade.pos[2] += (dz / distance) * travel;
    keepOutOfLitLanterns(world, shade);
  }
}

/** Lit lanterns are safe zones: shades stay at least safe_radius away (XZ). */
function keepOutOfLitLanterns(world: World, shade: Shade): void {
  for (const lantern of world.lanterns) {
    if (!lantern.lit) continue;
    const dx = shade.pos[0] - lantern.pos[0];
    const dz = shade.pos[2] - lantern.pos[2];
    const distance = Math.hypot(dx, dz);
    if (distance >= world.tuning.safe_radius) continue;
    const nx = distance === 0 ? 1 : dx / distance;
    const nz = distance === 0 ? 0 : dz / distance;
    shade.pos[0] = lantern.pos[0] + nx * world.tuning.safe_radius;
    shade.pos[2] = lantern.pos[2] + nz * world.tuning.safe_radius;
  }
}

function checkHits(world: World, events: GameEvent[]): void {
  if (world.player.invulnT > 0) return;
  for (const shade of world.shades) {
    if (shade.state === 'stunned') continue;
    if (distXZ(world.player.pos, shade.pos) > world.tuning.shade_hit_radius) continue;
    const carried = world.player.carried;
    const dropped = Math.min(carried, Math.floor(carried * world.tuning.hit_drop_ratio));
    world.player.carried = carried - dropped;
    world.player.flames -= 1;
    world.player.invulnT = world.tuning.invuln_s;
    events.push({
      tick: world.tick,
      name: 'player_hit',
      data: { by: 'shade', flames: world.player.flames, dropped },
    });
    if (world.player.flames <= 0) finish(world, events, 'lost', 'no_flames');
    break;
  }
}

/** One shade per 30 s, on the rim, using the seeded rng (deterministic id). */
function maybeSpawnShade(world: World, events: GameEvent[]): void {
  if (!world.spawnEnabled || world.tick % SHADE_SPAWN_INTERVAL_TICKS !== 0) return;
  if (world.shades.length >= MAX_SHADES) return;
  const angle = world.rng() * Math.PI * 2;
  const radius = ISLAND_RADIUS - 2;
  const id = `S${world.nextShadeId}`;
  world.nextShadeId += 1;
  world.shades.push({
    id,
    pos: [round3(Math.cos(angle) * radius), 0, round3(Math.sin(angle) * radius)],
    state: 'chase',
    stunT: 0,
    stunnedAtTick: -1,
  });
  events.push({ tick: world.tick, name: 'shade_spawned', data: { id } });
}

function finish(world: World, events: GameEvent[], result: 'won' | 'lost', reason: string): void {
  world.state = result;
  if (result === 'won') {
    world.score +=
      Math.floor(world.timeLeft) * world.tuning.score.per_second_left +
      world.player.flames * world.tuning.score.per_flame_left;
  }
  events.push({ tick: world.tick, name: 'game_over', data: { result, reason } });
}

function pushAway(shade: Shade, from: Vec3, distance: number): void {
  const dx = shade.pos[0] - from[0];
  const dz = shade.pos[2] - from[2];
  const current = Math.hypot(dx, dz);
  const nx = current === 0 ? 1 : dx / current;
  const nz = current === 0 ? 0 : dz / current;
  shade.pos[0] = from[0] + nx * (current + distance);
  shade.pos[2] = from[2] + nz * (current + distance);
  // Keep new positions on the island.
  const radius = Math.hypot(shade.pos[0], shade.pos[2]);
  if (radius > ISLAND_RADIUS) {
    shade.pos[0] = (shade.pos[0] / radius) * ISLAND_RADIUS;
    shade.pos[2] = (shade.pos[2] / radius) * ISLAND_RADIUS;
  }
}

function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
