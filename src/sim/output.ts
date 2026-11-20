import { round3 } from './step';
import type { GameEvent, World } from './types';

/** Serialise one snapshot line (contract section E). */
export function snapshotLine(world: World): string {
  return JSON.stringify({
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.tick,
    state: world.state,
    time_left_s: round3(world.timeLeft),
    score: world.score,
    player: {
      pos: world.player.pos.map(round3),
      flames: world.player.flames,
      carried: world.player.carried,
    },
    lanterns: world.lanterns.map((lantern) => ({
      id: lantern.id,
      pos: lantern.pos.map(round3),
      lit: lantern.lit,
      deposited: lantern.deposited,
    })),
    shades: world.shades.map((shade) => ({
      id: shade.id,
      pos: shade.pos.map(round3),
      state: shade.state,
    })),
    motes: world.motes
      .filter((mote) => mote.active)
      .map((mote) => ({ id: mote.id, pos: mote.pos.map(round3) })),
    motes_active: world.motes.filter((mote) => mote.active).length,
  });
}

export function eventLine(event: GameEvent): string {
  return JSON.stringify({ type: 'event', tick: event.tick, name: event.name, data: event.data });
}

export function endLine(world: World): string {
  return JSON.stringify({
    type: 'end',
    ticks: world.tick,
    state: world.state,
    score: world.score,
  });
}
