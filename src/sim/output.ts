import type { GameEvent, World } from './types';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Serialise one snapshot line (Test Contract v1.1). */
export function snapshotLine(world: World): string {
  const player = world.player;
  return JSON.stringify({
    type: 'snapshot',
    tick: world.tick,
    sim_tick: world.simTick,
    state: world.paused ? 'paused' : world.state,
    night: world.night,
    time_left_s: round3(world.timeLeft),
    score: world.score,
    player: {
      pos: player.pos.map(round3),
      vel: [round3(player.vel[0]), round3(player.velY), round3(player.vel[1])],
      vel_y: round3(player.velY),
      grounded: player.grounded,
      facing_deg: round3(player.facingDeg),
      flames: player.flames,
      carried: player.carried,
      invuln: player.invuln,
      invuln_s: round3(player.invuln / 60),
      dash_cd_s: round3(player.dashCd / 60),
      pulse_cd_s: round3(player.pulseCd / 60),
      charm_s: round3(player.charmTicks / 60),
      dash_ticks: player.dashTicks,
    },
    wind: { active: world.wind.active, dir_deg: world.wind.dirDeg },
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
      state_ticks_left: shade.stateTicksLeft,
    })),
    motes: world.motes.map((mote) => ({
      id: mote.id,
      pos: mote.pos.map(round3),
      kind: mote.kind,
      ttl_s: mote.ttl < 0 ? null : round3(mote.ttl / 60),
    })),
    motes_active: world.motes.length,
    drifters: world.drifters.map((drifter) => ({
      id: drifter.id,
      pos: drifter.pos.map(round3),
      state: drifter.state,
      stolen: drifter.stolen,
    })),
    charms: world.charms.map((charm) => ({
      id: charm.id,
      pos: charm.pos.map(round3),
      available: charm.available,
      respawn_s: round3(charm.respawnTicks / 60),
    })),
  });
}

export function eventLine(event: GameEvent): string {
  return JSON.stringify({ type: 'event', tick: event.tick, name: event.name, data: event.data });
}

export function endLine(world: World): string {
  return JSON.stringify({
    type: 'end',
    ticks: world.tick,
    sim_ticks: world.simTick,
    night: world.night,
    state: world.state,
    score: world.score,
    total_score: world.totalScore,
  });
}
