import {
  FUEL_MAX_UNITS,
  FUEL_UNITS_PER_POINT,
  LOW_FUEL_UNITS,
  TICKS_PER_SECOND,
  TUNING,
} from './config';
import { dist3, distXZ, groundHeight, insideTower, nearestLanternIndex } from './geometry';
import type { GameEvent, InputState, Lantern, Shade, Vec3, World } from './types';

const DT = 1 / TICKS_PER_SECOND;

/**
 * Advance the world by one wall-clock tick. Contract v1.2 order (TICKET-03):
 * input/pause → timers (incl. fuel decay + drain, then lantern_out) →
 * move player/fall → pickups → lantern → safe zones → pulse →
 * shade/drifter movement → contacts → spawns → win/lose.
 * Win/lose is evaluated after every update, including the dawn tick.
 */
export function step(world: World, input: InputState): GameEvent[] {
  const events: GameEvent[] = [];
  world.tick += 1;
  if (world.state !== 'playing') return events;

  const pressed = {
    jump: input.jump && !world.prev.jump,
    interact: input.interact && !world.prev.interact,
    pulse: input.pulse && !world.prev.pulse,
    dash: input.dash && !world.prev.dash,
    pause: input.pause && !world.prev.pause,
  };
  world.prev = {
    jump: input.jump,
    interact: input.interact,
    pulse: input.pulse,
    dash: input.dash,
    pause: input.pause,
  };

  if (pressed.pause) {
    world.paused = !world.paused;
    events.push({
      tick: world.tick,
      name: world.paused ? 'paused' : 'resumed',
      data: {},
    });
    return events;
  }
  if (world.paused) return events;

  // 2. Timers
  world.simTick += 1;
  world.timeLeft = Math.max(0, world.duration - world.simTick * DT);

  // 2a. Fuel decay (1/s) and shade drain (5/s), in integer 1/60 units.
  for (const lantern of world.lanterns) {
    if (lantern.lit) {
      lantern.fuel -= (TUNING.fuel_decay_per_s * FUEL_UNITS_PER_POINT) / TICKS_PER_SECOND;
    }
  }
  for (const shade of world.shades) {
    if (shade.state !== 'drain' || !shade.targetLanternId) continue;
    const lantern = world.lanterns.find((l) => l.id === shade.targetLanternId);
    if (!lantern || !lantern.lit) continue;
    lantern.fuel -= (TUNING.drain_per_s * FUEL_UNITS_PER_POINT) / TICKS_PER_SECOND;
    if (world.simTick % TICKS_PER_SECOND === 0) {
      events.push({
        tick: world.tick,
        name: 'fuel_drain',
        data: {
          lantern_id: lantern.id,
          shade_id: shade.id,
          fuel: round1(lantern.fuel / FUEL_UNITS_PER_POINT),
        },
      });
    }
  }
  // 2b. A lantern that ran dry goes out immediately after the fuel update.
  for (const lantern of world.lanterns) {
    if (lantern.lit && lantern.fuel <= 0) {
      lantern.fuel = 0;
      lantern.lit = false;
      lantern.deposited = 0;
      events.push({ tick: world.tick, name: 'lantern_out', data: { lantern_id: lantern.id } });
      for (const shade of world.shades) {
        if (shade.state === 'drain' && shade.targetLanternId === lantern.id) {
          shade.state = 'wander';
          shade.targetLanternId = undefined;
          shade.stateTicksLeft = 120;
        }
      }
    }
  }

  const player = world.player;
  player.invuln = Math.max(0, player.invuln - 1);
  player.dashCd = Math.max(0, player.dashCd - 1);
  player.pulseCd = Math.max(0, player.pulseCd - 1);
  player.charmTicks = Math.max(0, player.charmTicks - 1);
  if (player.fallWait > 0) {
    player.fallWait -= 1;
    if (player.fallWait === 0) respawn(world);
  }
  world.motes = world.motes.filter((mote) => {
    if (mote.ttl < 0) return true;
    mote.ttl -= 1;
    return mote.ttl > 0;
  });
  for (const shade of world.shades) {
    shade.stateTicksLeft = Math.max(0, shade.stateTicksLeft - 1);
    if (shade.stateTicksLeft === 0 && shade.state === 'spawning') {
      shade.state = 'wander';
      shade.stateTicksLeft = 120;
    } else if (shade.stateTicksLeft === 0 && shade.state === 'recoil') {
      shade.state = 'chase';
    } else if (shade.stateTicksLeft === 0 && shade.state === 'stunned') {
      // TICKET-03: after a stun the shade resumes wandering, not chasing.
      shade.state = 'wander';
      shade.stateTicksLeft = 120;
    }
  }
  for (const drifter of world.drifters) {
    if (drifter.state === 'removed') continue;
    drifter.stateTicksLeft = Math.max(0, drifter.stateTicksLeft - 1);
    if (drifter.stateTicksLeft === 0 && drifter.state === 'flee') drifter.state = 'removed';
  }
  for (const charm of world.charms) {
    if (charm.available) continue;
    charm.respawnTicks = Math.max(0, charm.respawnTicks - 1);
    if (charm.respawnTicks === 0) charm.available = true;
  }
  if (world.wind.ticksLeft > 0) {
    world.wind.ticksLeft -= 1;
    if (world.wind.ticksLeft === 0) {
      if (world.wind.warning) {
        world.wind.warning = false;
        world.wind.active = true;
        world.wind.ticksLeft = TUNING.wind_duration_ticks;
      } else {
        world.wind.active = false;
      }
    }
  }

  if (world.simTick === 1) {
    events.push({ tick: world.tick, name: 'night_start', data: { night: world.night } });
  }

  // 3. Move player, then check fall
  if (player.fallWait === 0) {
    movePlayer(world, input, pressed.jump, pressed.dash, events);
    checkFall(world, events);
  }

  if (player.fallWait === 0) {
    // 4. Pickups
    pickupMotes(world, events);
    pickupCharms(world, events);
    // 5. Lantern interaction
    if (pressed.interact) deposit(world, events);
  }

  // 6. Safe zones around lit lanterns
  updateSafeZones(world);

  // 7. Pulse
  if (pressed.pulse && player.fallWait === 0) pulse(world, events);

  // 8. Move shades and drifters
  moveShades(world);
  moveDrifters(world);

  // 9. Contacts: drifters steal first, then shades hit (id ascending)
  if (player.fallWait === 0) {
    contactDrifters(world, events);
    contactShades(world, events);
  }

  // 10. Scheduled spawns (new entities act from the next tick)
  spawnMotes(world);
  spawnShades(world, events);
  spawnDrifters(world);
  spawnWind(world);

  // 11. Win / lose — evaluated after every update, dawn tick included.
  if (player.flames <= 0) {
    finish(world, events, 'lost', 'no_flames');
  } else if (world.timeLeft <= 0) {
    const needed = Math.ceil(TUNING.win_ratio * world.lanterns.length);
    const lit = world.lanterns.filter((lantern) => lantern.lit).length;
    if (lit >= needed) finish(world, events, 'won', 'dawn_survived');
    else finish(world, events, 'lost', 'dawn');
  }

  return events;
}

function respawn(world: World): void {
  const player = world.player;
  player.pos = [...world.spec.start];
  player.vel = [0, 0];
  player.velY = 0;
  player.grounded = true;
  player.padLock = false;
  player.hasFallen = false;
  player.invuln = TUNING.invuln_s * TICKS_PER_SECOND;
}

function movePlayer(
  world: World,
  input: InputState,
  jump: boolean,
  dash: boolean,
  events: GameEvent[],
): void {
  const player = world.player;
  const speed = player.charmTicks > 0 ? TUNING.charm_speed : TUNING.player_speed;
  const theta = (input.camYawDeg * Math.PI) / 180;

  // Dash starts now; cooldown is measured from this tick.
  const dashReady = player.dashCd === 0 || player.charmTicks > 0;
  if (dash && dashReady && player.dashTicks === 0) {
    let dx = player.vel[0];
    let dz = player.vel[1];
    if (Math.hypot(dx, dz) < 0.01) {
      dx = Math.sin(theta);
      dz = Math.cos(theta);
    }
    const length = Math.hypot(dx, dz);
    player.dashDir = [dx / length, dz / length];
    player.vel = [
      player.dashDir[0] * TUNING.dash_speed,
      player.dashDir[1] * TUNING.dash_speed,
    ];
    player.dashTicks = Math.round(TUNING.dash_duration_s * TICKS_PER_SECOND);
    if (!player.grounded) player.velY = 0; // air dash keeps the current height
    // Charm removes the cooldown entirely; it is still one press per dash.
    player.dashCd =
      player.charmTicks > 0 ? 0 : TUNING.dash_cooldown_s * TICKS_PER_SECOND;
    player.facingDeg = (Math.atan2(player.dashDir[0], player.dashDir[1]) * 180) / Math.PI;
    events.push({ tick: world.tick, name: 'dash', data: {} });
  }

  if (jump && player.grounded && !player.padLock && player.dashTicks === 0) {
    player.velY = TUNING.jump_speed;
    player.grounded = false;
  }

  if (player.dashTicks === 0 && !player.padLock) {
    let x = input.move[0];
    let z = input.move[1];
    let length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
      length = 1;
    }
    const wx = x * Math.cos(theta) + z * Math.sin(theta);
    const wz = -x * Math.sin(theta) + z * Math.cos(theta);
    const targetX = wx * speed;
    const targetZ = wz * speed;
    const maxChange = (speed / TUNING.accel_time_s) * DT;
    player.vel[0] = approach(player.vel[0], targetX, maxChange);
    player.vel[1] = approach(player.vel[1], targetZ, maxChange);
    if (length > 0.01) {
      player.facingDeg = (Math.atan2(wx, wz) * 180) / Math.PI;
    }
  }
  if (player.dashTicks > 0) player.dashTicks -= 1;

  // Horizontal move with wall blocking (vertical faces cannot be climbed).
  const nextX = player.pos[0] + player.vel[0] * DT;
  const nextZ = player.pos[2] + player.vel[1] * DT;
  const surface = groundHeight(world.spec, nextX, nextZ);
  const blocked =
    (surface !== null &&
      player.grounded &&
      surface > player.pos[1] + 0.1 &&
      player.dashTicks === 0) ||
    (insideTower(world.spec, nextX, nextZ) && player.pos[1] >= 5.5);
  if (blocked) {
    player.vel[0] = 0;
    player.vel[1] = 0;
  } else {
    player.pos[0] = nextX;
    player.pos[2] = nextZ;
    if (surface === null) player.grounded = false;
  }

  // Jump pads: velocity is locked until the player lands.
  for (const pad of world.spec.pads) {
    if (player.padLock) break;
    if (distXZ(player.pos, pad.pos) <= 1 && Math.abs(player.pos[1] - pad.pos[1]) <= 0.25) {
      player.vel = [...pad.velXZ];
      player.velY = pad.velY;
      player.grounded = false;
      player.padLock = true;
      break;
    }
  }

  // Gravity (suspended during a dash; an air dash keeps the height).
  if (!player.grounded && player.dashTicks === 0) {
    player.velY += TUNING.gravity * DT;
    if (world.wind.active) {
      const radians = (world.wind.dirDeg * Math.PI) / 180;
      player.pos[0] += Math.cos(radians) * TUNING.wind_push_speed * DT;
      player.pos[2] += Math.sin(radians) * TUNING.wind_push_speed * DT;
    }
    player.pos[1] += player.velY * DT;
    const ground = groundHeight(world.spec, player.pos[0], player.pos[2]);
    if (ground !== null && player.pos[1] <= ground && player.velY <= 0) {
      player.pos[1] = ground;
      player.velY = 0;
      player.grounded = true;
      player.padLock = false;
    }
  }

  // Ground-level wind also pushes a grounded player.
  if (world.wind.active && player.grounded) {
    const radians = (world.wind.dirDeg * Math.PI) / 180;
    player.pos[0] += Math.cos(radians) * TUNING.wind_push_speed * DT;
    player.pos[2] += Math.sin(radians) * TUNING.wind_push_speed * DT;
  }

  roundVec(player.pos);
}

function approach(current: number, target: number, maxChange: number): number {
  if (current < target) return Math.min(current + maxChange, target);
  return Math.max(current - maxChange, target);
}

function roundVec(v: Vec3): void {
  v[0] = round3(v[0]);
  v[1] = round3(v[1]);
  v[2] = round3(v[2]);
}

function checkFall(world: World, events: GameEvent[]): void {
  const player = world.player;
  if (player.hasFallen || player.pos[1] >= TUNING.fall_y) return;
  player.hasFallen = true;
  player.fallWait = TUNING.fall_wait_ticks;
  player.flames -= 1;
  player.carried = 0;
  events.push({
    tick: world.tick,
    name: 'player_hit',
    data: { by: 'fall', flames: player.flames, dropped: 0, lost: 1 },
  });
}

function pickupMotes(world: World, events: GameEvent[]): void {
  const player = world.player;
  for (let i = world.motes.length - 1; i >= 0; i -= 1) {
    const mote = world.motes[i];
    if (player.carried >= player.capacity) break;
    if (distXZ(player.pos, mote.pos) > TUNING.pickup_radius) continue;
    if (Math.abs(player.pos[1] - mote.pos[1]) > TUNING.pickup_height_diff) continue;
    world.motes.splice(i, 1);
    player.carried += 1;
    events.push({ tick: world.tick, name: 'mote_picked', data: { carried: player.carried } });
  }
}

function pickupCharms(world: World, events: GameEvent[]): void {
  const player = world.player;
  for (const charm of world.charms) {
    if (!charm.available) continue;
    if (distXZ(player.pos, charm.pos) > TUNING.pickup_radius) continue;
    if (Math.abs(player.pos[1] - charm.pos[1]) > TUNING.pickup_height_diff) continue;
    charm.available = false;
    charm.respawnTicks = TUNING.charm_respawn_ticks;
    player.charmTicks = TUNING.charm_duration_ticks;
    events.push({
      tick: world.tick,
      name: 'charm_picked',
      data: { charm_id: charm.id, charm_ticks: player.charmTicks },
    });
  }
}

function deposit(world: World, events: GameEvent[]): void {
  const player = world.player;
  // v1.2: only lanterns that can receive light — unlit, or lit but not full.
  const accepts = world.lanterns.map(
    (lantern) => !lantern.lit || lantern.fuel < FUEL_MAX_UNITS,
  );
  const index = nearestLanternIndex(
    world.lanterns.map((l) => l.pos),
    player.pos,
    accepts.map((accepted) => !accepted),
  );
  if (index < 0) return;
  const lantern = world.lanterns[index];
  if (distXZ(player.pos, lantern.pos) > TUNING.interact_radius) return;

  if (!lantern.lit) {
    const cost = lantern.ever_lit ? TUNING.relight_cost : TUNING.lantern_cost;
    const amount = Math.min(player.carried, cost - lantern.deposited);
    if (amount > 0) {
      player.carried -= amount;
      lantern.deposited += amount;
      world.score += amount * TUNING.score.per_mote;
      events.push({
        tick: world.tick,
        name: 'deposit',
        data: { lantern_id: lantern.id, amount, deposited: lantern.deposited },
      });
    }
    if (lantern.deposited >= cost) {
      const relight = lantern.ever_lit;
      lantern.lit = true;
      lantern.fuel = FUEL_MAX_UNITS;
      lantern.deposited = cost;
      if (relight) lantern.relit_count += 1;
      else lantern.ever_lit = true;
      player.successful_lights += 1;
      player.capacity = Math.min(
        TUNING.capacity_max,
        TUNING.carry_capacity + 2 * player.successful_lights,
      );
      world.score += relight ? TUNING.score.per_relight : TUNING.score.per_lantern;
      events.push({
        tick: world.tick,
        name: 'lantern_lit',
        data: { lantern_id: lantern.id, relight },
      });
      pushShadesOutOf(world, lantern);
    }
    return;
  }

  // Lit lantern: top up fuel with whole motes (10 fuel each).
  const perMoteUnits = TUNING.fuel_per_mote * FUEL_UNITS_PER_POINT;
  const needed = Math.ceil((FUEL_MAX_UNITS - lantern.fuel) / perMoteUnits);
  const used = Math.min(player.carried, needed);
  if (used <= 0) return;
  player.carried -= used;
  lantern.fuel = Math.min(FUEL_MAX_UNITS, lantern.fuel + used * perMoteUnits);
  world.score += used * TUNING.score.per_mote;
  events.push({
    tick: world.tick,
    name: 'refuel',
    data: {
      lantern_id: lantern.id,
      amount: used,
      fuel: round1(lantern.fuel / FUEL_UNITS_PER_POINT),
    },
  });
  // Crossing the low-fuel threshold repels nearby shades without damage.
  if (lantern.fuel >= LOW_FUEL_UNITS) pushShadesOutOf(world, lantern);
}

/** Shades inside the safe radius are pushed to its edge over at most 30 ticks. */
function pushShadesOutOf(world: World, lantern: Lantern): void {
  for (const shade of world.shades) {
    if (shade.state === 'stunned') continue;
    const distance = distXZ(shade.pos, lantern.pos);
    if (distance >= TUNING.safe_radius) continue;
    const dx = shade.pos[0] - lantern.pos[0];
    const dz = shade.pos[2] - lantern.pos[2];
    const length = Math.hypot(dx, dz) || 1;
    const nx = length < 0.001 ? 1 : dx / length;
    const nz = length < 0.001 ? 0 : dz / length;
    const perTick = (TUNING.safe_radius - distance) / TUNING.safe_push_ticks;
    shade.vel = [nx * perTick, nz * perTick];
    shade.pushTicksLeft = TUNING.safe_push_ticks;
    if (shade.state === 'drain') {
      shade.state = 'wander';
      shade.targetLanternId = undefined;
    }
  }
}

function updateSafeZones(world: World): void {
  for (const shade of world.shades) {
    for (const lantern of world.lanterns) {
      // v1.2: fuel below 30 means the lantern no longer protects the area.
      if (!lantern.lit || lantern.fuel < LOW_FUEL_UNITS) continue;
      const distance = distXZ(shade.pos, lantern.pos);
      if (distance >= TUNING.safe_radius) continue;
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      if (shade.pushTicksLeft > 0) continue; // one constant-speed push per episode
      const length = Math.hypot(dx, dz) || 1;
      const perTick = (TUNING.safe_radius - distance) / TUNING.safe_push_ticks;
      shade.vel = [(dx / length) * perTick, (dz / length) * perTick];
      shade.pushTicksLeft = TUNING.safe_push_ticks;
    }
  }
}

function pulse(world: World, events: GameEvent[]): void {
  const player = world.player;
  if (player.carried < TUNING.pulse_cost || player.pulseCd > 0) return;
  player.carried -= TUNING.pulse_cost;
  player.pulseCd = TUNING.pulse_cooldown_s * TICKS_PER_SECOND;
  const center: Vec3 = [player.pos[0], player.pos[1] + TUNING.pulse_center_offset, player.pos[2]];
  const stunnedIds: string[] = [];

  for (const shade of world.shades) {
    const shadeCenter: Vec3 = [shade.pos[0], shade.pos[1] + TUNING.pulse_center_offset, shade.pos[2]];
    if (dist3(center, shadeCenter) > TUNING.pulse_radius) continue;
    const wasDraining = shade.state === 'drain';
    world.score += wasDraining ? TUNING.score.per_draining_stun : TUNING.score.per_stun;
    stunnedIds.push(shade.id);
    shade.state = 'stunned';
    shade.targetLanternId = undefined;
    shade.stateTicksLeft = TUNING.pulse_stun_s * TICKS_PER_SECOND;
    const dx = shade.pos[0] - player.pos[0];
    const dz = shade.pos[2] - player.pos[2];
    const length = Math.hypot(dx, dz) || 1;
    const nx = length === 1 && dx === 0 && dz === 0 ? 1 : dx / length;
    const nz = length === 1 && dx === 0 && dz === 0 ? 0 : dz / length;
    const perTick = TUNING.pulse_push_m / TUNING.pulse_push_ticks;
    shade.vel = [nx * perTick, nz * perTick];
    shade.pushTicksLeft = TUNING.pulse_push_ticks;
  }

  for (const drifter of world.drifters) {
    if (drifter.state !== 'chase' && drifter.state !== 'flee') continue;
    if (dist3(center, drifter.pos) > TUNING.pulse_radius) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.stateTicksLeft = TUNING.drifter_flee_ticks;
    } else if (drifter.stolen > 0) {
      const amount = drifter.stolen;
      dropMotes(world, drifter.pos, amount);
      drifter.stolen = 0;
      drifter.stateTicksLeft = 120;
      events.push({
        tick: world.tick,
        name: 'drifter_drop',
        data: { drifter_id: drifter.id, amount },
      });
    }
  }

  events.push({ tick: world.tick, name: 'pulse', data: { stunned_ids: stunnedIds } });
}

function moveShades(world: World): void {
  const player = world.player;
  const speed = world.night === 3 ? TUNING.shade_speed_night3 : TUNING.shade_speed;
  for (const shade of world.shades) {
    if (shade.pushTicksLeft > 0) {
      shade.pos[0] += shade.vel[0];
      shade.pos[2] += shade.vel[1];
      shade.pushTicksLeft -= 1;
      clampToSafeZones(world, shade);
      updateShadeHeight(world, shade);
      continue;
    }
    if (shade.state === 'stunned' || shade.state === 'spawning') continue;
    if (shade.state === 'recoil') {
      updateShadeHeight(world, shade);
      continue;
    }
    const distance = distXZ(shade.pos, player.pos);

    if (shade.state === 'drain') {
      const target = world.lanterns.find((l) => l.id === shade.targetLanternId);
      const stillWeak =
        target && target.lit && target.fuel < LOW_FUEL_UNITS &&
        distXZ(shade.pos, target.pos) <= 2;
      if (distance <= TUNING.safe_radius) {
        shade.state = 'chase';
        shade.stateTicksLeft = 0;
        shade.targetLanternId = undefined;
      } else if (!stillWeak) {
        shade.state = 'wander';
        shade.stateTicksLeft = 120;
        shade.targetLanternId = undefined;
      } else {
        updateShadeHeight(world, shade);
        continue; // standing still while draining
      }
    }

    if (shade.state === 'chase' && distance > TUNING.shade_lose) {
      shade.state = 'wander';
      shade.stateTicksLeft = 120;
      shade.targetLanternId = undefined;
      shade.vel = [randomDirection(world.rng), randomDirection(world.rng)];
    }
    if (shade.state === 'wander' && distance <= TUNING.shade_detect) {
      shade.state = 'chase';
      shade.stateTicksLeft = 0;
      shade.targetLanternId = undefined;
    }

    if (shade.state === 'chase') {
      const dx = player.pos[0] - shade.pos[0];
      const dz = player.pos[2] - shade.pos[2];
      const length = Math.hypot(dx, dz);
      if (length > 0) {
        shade.pos[0] += (dx / length) * speed * DT;
        shade.pos[2] += (dz / length) * speed * DT;
      }
    } else if (shade.state === 'wander') {
      let target = findTargetLantern(world, shade.pos, (l) => l.lit && l.fuel < LOW_FUEL_UNITS);
      const weak = target !== undefined;
      if (!target) target = findTargetLantern(world, shade.pos, (l) => !l.lit);
      if (target) {
        const dx = target.pos[0] - shade.pos[0];
        const dz = target.pos[2] - shade.pos[2];
        const length = Math.hypot(dx, dz) || 1;
        shade.pos[0] += (dx / length) * speed * DT;
        shade.pos[2] += (dz / length) * speed * DT;
        if (weak && length <= 2) {
          shade.state = 'drain';
          shade.stateTicksLeft = 0;
          shade.targetLanternId = target.id;
        }
      } else {
        shade.pos[0] += shade.vel[0] * TUNING.drifter_idle_speed * DT;
        shade.pos[2] += shade.vel[1] * TUNING.drifter_idle_speed * DT;
      }
    }
    clampToSafeZones(world, shade);
    updateShadeHeight(world, shade);
  }
}

/** Nearest lantern matching a predicate; ties go to the smaller id. */
function findTargetLantern(
  world: World,
  pos: Vec3,
  predicate: (lantern: Lantern) => boolean,
): Lantern | undefined {
  let best: Lantern | undefined;
  let bestDistance = Infinity;
  for (const lantern of world.lanterns) {
    if (!predicate(lantern)) continue;
    const distance = distXZ(pos, lantern.pos);
    if (distance < bestDistance) {
      best = lantern;
      bestDistance = distance;
    }
  }
  return best;
}

function clampToSafeZones(world: World, shade: Shade): void {
  if (shade.pushTicksLeft > 0) return;
  for (const lantern of world.lanterns) {
    if (!lantern.lit || lantern.fuel < LOW_FUEL_UNITS) continue;
    const distance = distXZ(shade.pos, lantern.pos);
    if (distance >= TUNING.safe_radius) continue;
    const dx = shade.pos[0] - lantern.pos[0];
    const dz = shade.pos[2] - lantern.pos[2];
    const length = Math.hypot(dx, dz) || 1;
    shade.pos[0] = lantern.pos[0] + (dx / length) * TUNING.safe_radius;
    shade.pos[2] = lantern.pos[2] + (dz / length) * TUNING.safe_radius;
  }
}

function updateShadeHeight(world: World, shade: Shade): void {
  const ground = groundHeight(world.spec, shade.pos[0], shade.pos[2]);
  if (ground !== null) shade.pos[1] = ground;
  roundVec(shade.pos);
}

function moveDrifters(world: World): void {
  const player = world.player;
  for (const drifter of world.drifters) {
    if (drifter.state === 'removed') continue;
    const distance = distXZ(drifter.pos, player.pos);
    if (drifter.state === 'idle') {
      if (player.carried >= TUNING.drifter_chase_carried && distance <= TUNING.drifter_detect) {
        drifter.state = 'chase';
        drifter.stateTicksLeft = 0;
      }
    } else if (drifter.state === 'chase') {
      if (player.carried < TUNING.drifter_chase_carried || distance > TUNING.drifter_detect) {
        drifter.state = 'idle';
      }
    }
    const dx =
      drifter.state === 'flee'
        ? drifter.pos[0] - player.pos[0]
        : player.pos[0] - drifter.pos[0];
    const dz =
      drifter.state === 'flee'
        ? drifter.pos[2] - player.pos[2]
        : player.pos[2] - drifter.pos[2];
    const length = Math.hypot(dx, dz) || 1;
    const speed = drifter.state === 'idle' ? TUNING.drifter_idle_speed : TUNING.drifter_speed;
    drifter.pos[0] += (dx / length) * speed * DT;
    drifter.pos[2] += (dz / length) * speed * DT;
    const ground = groundHeight(world.spec, drifter.pos[0], drifter.pos[2]);
    if (ground !== null) drifter.pos[1] = ground + 1;
    roundVec(drifter.pos);
  }
}

function contactDrifters(world: World, events: GameEvent[]): void {
  const player = world.player;
  for (const drifter of world.drifters) {
    if (drifter.state !== 'chase') continue;
    if (distXZ(drifter.pos, player.pos) > TUNING.drifter_touch_radius) continue;
    const amount = Math.min(TUNING.drifter_steal_max, player.carried);
    player.carried -= amount;
    drifter.stolen = amount;
    drifter.state = 'flee';
    drifter.stateTicksLeft = TUNING.drifter_flee_ticks;
    events.push({
      tick: world.tick,
      name: 'drifter_steal',
      data: { drifter_id: drifter.id, amount, carried: player.carried },
    });
  }
}

function contactShades(world: World, events: GameEvent[]): void {
  const player = world.player;
  if (player.invuln > 0) return;
  const shades = [...world.shades].sort((a, b) => a.id.localeCompare(b.id));
  for (const shade of shades) {
    if (shade.state === 'stunned' || shade.state === 'recoil' || shade.pushTicksLeft > 0) continue;
    if (distXZ(shade.pos, player.pos) > TUNING.shade_hit_radius) continue;
    if (Math.abs(shade.pos[1] - player.pos[1]) > TUNING.shade_hit_height_diff) continue;
    const dropped = Math.floor(player.carried * TUNING.hit_drop_ratio);
    player.carried -= dropped;
    player.flames -= 1;
    player.invuln = TUNING.invuln_s * TICKS_PER_SECOND;
    dropMotes(world, player.pos, dropped);
    const dx = shade.pos[0] - player.pos[0];
    const dz = shade.pos[2] - player.pos[2];
    const length = Math.hypot(dx, dz) || 1;
    const perTick = TUNING.shade_recoil_m / TUNING.shade_recoil_ticks;
    shade.state = 'recoil';
    shade.stateTicksLeft = TUNING.shade_recoil_ticks;
    shade.vel = [(-dx / length) * perTick, (-dz / length) * perTick];
    shade.pushTicksLeft = TUNING.shade_recoil_ticks;
    events.push({
      tick: world.tick,
      name: 'player_hit',
      data: { by: 'shade', flames: player.flames, dropped },
    });
    break; // at most one flame loss per tick
  }
}

function dropMotes(world: World, center: Vec3, amount: number): void {
  for (let i = 0; i < amount; i += 1) {
    const angle = world.rng() * Math.PI * 2;
    const radius = TUNING.dropped_ring_min + world.rng() * (TUNING.dropped_ring_max - TUNING.dropped_ring_min);
    const x = center[0] + Math.cos(angle) * radius;
    const z = center[2] + Math.sin(angle) * radius;
    const ground = groundHeight(world.spec, x, z);
    world.motes.push({
      id: `F${world.nextDroppedId}`,
      pos: [round3(x), ground ?? center[1], round3(z)],
      kind: 'dropped',
      ttl: TUNING.dropped_mote_ttl_ticks,
    });
    world.nextDroppedId += 1;
  }
}

function spawnMotes(world: World): void {
  if (world.simTick % TUNING.mote_spawn_interval_ticks !== 0) return;
  if (!world.randomMotes || world.motes.length >= TUNING.max_motes) return;
  const empty = world.spec.motePoints.filter((point) =>
    world.motes.every((mote) => distXZ(mote.pos, point) > 0.1),
  );
  if (empty.length === 0) return;
  const point = empty[Math.floor(world.rng() * empty.length) % empty.length];
  world.motes.push({
    id: `M${world.nextMoteId}`,
    pos: [...point],
    kind: 'random',
    ttl: -1,
  });
  world.nextMoteId += 1;
}

function spawnShades(world: World, events: GameEvent[]): void {
  if (!world.randomShades) return;
  const first = TUNING.shade_first_spawn_tick;
  const interval = world.spec.shadeIntervalTicks;
  const isFirst = world.simTick === first;
  const isLater = world.simTick > first && (world.simTick - first) % interval === 0;
  if (!isFirst && !isLater) return;
  const count = Math.min(
    isFirst ? TUNING.shade_first_spawn_count : 1,
    world.spec.maxShades - world.shades.length,
  );
  for (let i = 0; i < count; i += 1) {
    const candidates = world.spec.shadePoints.filter(
      (point) => distXZ(point, world.player.pos) >= 15,
    );
    if (candidates.length === 0) return;
    const point = candidates[Math.floor(world.rng() * candidates.length) % candidates.length];
    const id = `S${world.nextShadeId}`;
    world.nextShadeId += 1;
    world.shades.push({
      id,
      pos: [...point],
      state: 'spawning',
      stateTicksLeft: 30,
      vel: [randomDirection(world.rng), randomDirection(world.rng)],
      pushTicksLeft: 0,
    });
    events.push({ tick: world.tick, name: 'shade_spawned', data: { id } });
  }
}

function spawnDrifters(world: World): void {
  if (!world.spec.driftersEnabled || !world.randomDrifters) return;
  if (world.simTick % TUNING.drifter_spawn_interval_ticks !== 0) return;
  const active = world.drifters.filter((d) => d.state !== 'removed').length;
  if (active >= TUNING.drifter_max) return;
  const points = world.spec.shadePoints;
  const point = points[Math.floor(world.rng() * points.length) % points.length];
  world.drifters.push({
    id: `D${world.nextDrifterId}`,
    pos: [point[0], point[1] + 1, point[2]],
    state: 'idle',
    stateTicksLeft: 120,
    stolen: 0,
  });
  world.nextDrifterId += 1;
}

function spawnWind(world: World): void {
  if (!world.windEnabled || world.wind.active || world.wind.warning) return;
  if (world.simTick % TUNING.wind_interval_ticks !== 0) return;
  world.wind.warning = true;
  world.wind.ticksLeft = TUNING.wind_warning_ticks;
  world.wind.dirDeg = Math.floor(world.rng() * 360);
}

function finish(world: World, events: GameEvent[], result: 'won' | 'lost', reason: string): void {
  world.state = result;
  if (result === 'won') {
    // TICKET-03: dawn bonus depends on lanterns still lit, not time left.
    for (const lantern of world.lanterns) {
      if (!lantern.lit) continue;
      world.score +=
        TUNING.score.per_lantern_at_dawn + Math.floor(lantern.fuel / FUEL_UNITS_PER_POINT);
    }
    world.score += world.player.flames * TUNING.score.per_flame_left;
    world.totalScore += world.score;
  }
  events.push({ tick: world.tick, name: 'game_over', data: { result, reason } });
}

function randomDirection(rng: () => number): number {
  const value = rng() * 2 - 1;
  return Math.abs(value) < 0.01 ? 0.01 : value;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
