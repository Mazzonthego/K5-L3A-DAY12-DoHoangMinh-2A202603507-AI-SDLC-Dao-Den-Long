import type { GameEvent, InputState, World } from './types';

export const TICKS_PER_SECOND = 60;

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

  movePlayer(world, input);
  if (world.player.invulnT > 0) {
    world.player.invulnT = Math.max(0, world.player.invulnT - 1 / TICKS_PER_SECOND);
  }

  world.timeLeft = Math.max(0, world.duration - world.tick / TICKS_PER_SECOND);

  if (world.timeLeft <= 0) {
    const allLit = world.lanterns.every((lantern) => lantern.lit);
    world.state = allLit ? 'won' : 'lost';
    if (allLit) {
      world.score += Math.floor(world.timeLeft) * world.tuning.score.per_second_left;
    }
    events.push({
      tick: world.tick,
      name: 'game_over',
      data: { result: world.state, reason: 'dawn' },
    });
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
  const dt = 1 / TICKS_PER_SECOND;
  world.player.pos[0] += wx * world.tuning.player_speed * dt;
  world.player.pos[2] += wz * world.tuning.player_speed * dt;
}

export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
