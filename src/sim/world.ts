import { NIGHTS, TUNING } from './config';
import { mulberry32 } from './rng';
import type {
  Charm,
  Drifter,
  Mote,
  NightSpec,
  ScenarioFile,
  Shade,
  Vec3,
  World,
} from './types';

export interface CreateWorldOptions {
  seed: number;
  night?: 1 | 2 | 3;
  scenario?: ScenarioFile;
  /** Score carried over from nights already won by the player. */
  totalScore?: number;
}

/**
 * Build the initial world (snapshot tick 0) from a scenario file.
 * Contract v1.1 section D: scenario construction emits no events and scores nothing.
 */
export function createWorld({
  seed,
  night = 1,
  scenario = {},
  totalScore = 0,
}: CreateWorldOptions): World {
  const spec: NightSpec = NIGHTS[night];
  const rng = mulberry32(seed);
  const duration = scenario.time_left_s ?? spec.duration;

  const pos: Vec3 = scenario.player?.pos ? [...scenario.player.pos] : [...spec.start];
  const world: World = {
    tick: 0,
    simTick: 0,
    state: 'playing',
    paused: false,
    night,
    spec,
    duration,
    timeLeft: duration,
    score: 0,
    totalScore,
    player: {
      pos,
      vel: [0, 0],
      velY: 0,
      grounded: true,
      facingDeg: scenario.player?.facing_deg ?? 0,
      flames: scenario.player?.flames ?? TUNING.flames,
      carried: scenario.player?.carried ?? 0,
      invuln: scenario.player?.invuln_ticks ?? 0,
      dashCd: scenario.player?.dash_cd_ticks ?? 0,
      pulseCd: scenario.player?.pulse_cd_ticks ?? 0,
      charmTicks: scenario.player?.charm_ticks ?? 0,
      dashTicks: 0,
      dashDir: [0, 0],
      padLock: false,
      fallWait: 0,
      hasFallen: false,
    },
    motes: [],
    shades: [],
    drifters: [],
    charms: [],
    lanterns: [],
    wind: { active: false, dirDeg: 0, ticksLeft: 0, warning: false },
    rng,
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    nextMoteId: 1,
    nextShadeId: 1,
    nextDrifterId: 1,
    nextCharmId: 1,
    nextDroppedId: 1,
    randomMotes: scenario.random_motes !== false,
    randomShades: scenario.random_shades !== false,
    randomDrifters: scenario.random_drifters !== false,
    windEnabled: spec.windEnabled && scenario.wind_enabled !== false,
  };

  world.lanterns = spec.lanterns.map((lanternPos, i) => ({
    id: `L${i + 1}`,
    pos: [...lanternPos],
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
  world.shades = buildShades(scenario);
  world.drifters = buildDrifters(scenario);
  world.charms = buildCharms(world, scenario);

  world.nextMoteId = maxId(world.motes.map((m) => m.id)) + 1;
  world.nextShadeId = maxId(world.shades.map((s) => s.id)) + 1;
  world.nextDrifterId = maxId(world.drifters.map((d) => d.id)) + 1;
  world.nextCharmId = maxId(world.charms.map((c) => c.id)) + 1;

  return world;
}

function buildMotes(world: World, scenario: ScenarioFile): Mote[] {
  if (scenario.motes) {
    return scenario.motes.map((entry, i) => {
      const pos = Array.isArray(entry) ? entry : entry.pos;
      const kind = Array.isArray(entry) ? 'random' : (entry.kind ?? 'random');
      const ttl = Array.isArray(entry) ? -1 : (entry.ttl_ticks ?? -1);
      const id = Array.isArray(entry) ? `M${i + 1}` : `M${i + 1}`;
      return { id, pos: [...pos], kind, ttl };
    });
  }
  if (!world.randomMotes) return [];
  return world.spec.motePoints.slice(0, TUNING.initial_motes).map((pos, i) => ({
    id: `M${i + 1}`,
    pos: [...pos],
    kind: 'random' as const,
    ttl: -1,
  }));
}

function buildShades(scenario: ScenarioFile): Shade[] {
  if (!scenario.shades) return [];
  return scenario.shades.map((entry, i) => ({
    id: entry.id ?? `S${i + 1}`,
    pos: [...entry.pos],
    state: entry.state ?? 'chase',
    stateTicksLeft: entry.state_ticks_left ?? 0,
    vel: [0, 0],
    pushTicksLeft: 0,
  }));
}

function buildDrifters(scenario: ScenarioFile): Drifter[] {
  if (!scenario.drifters) return [];
  return scenario.drifters.map((entry, i) => ({
    id: entry.id ?? `D${i + 1}`,
    pos: [...entry.pos],
    state: entry.state ?? 'idle',
    stateTicksLeft: entry.state_ticks_left ?? 0,
    stolen: entry.stolen ?? 0,
  }));
}

function buildCharms(world: World, scenario: ScenarioFile): Charm[] {
  if (scenario.charms) {
    return scenario.charms.map((entry) => ({
      id: entry.id,
      pos: entry.pos ? [...entry.pos] : [0, 0, 0],
      available: entry.available ?? true,
      respawnTicks: entry.respawn_ticks ?? 0,
    }));
  }
  return world.spec.charmPoints.map((pos, i) => ({
    id: `C${i + 1}`,
    pos: [...pos],
    available: true,
    respawnTicks: 0,
  }));
}

function maxId(ids: string[]): number {
  let result = 0;
  for (const id of ids) {
    const match = /^[A-Za-z]+(\d+)$/.exec(id);
    if (match) result = Math.max(result, Number(match[1]));
  }
  return result;
}
