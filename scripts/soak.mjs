/**
 * Soak test — 10 consecutive nights in one process, random seeded inputs.
 *
 *   node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createWorld, step, TUNING, TICKS_PER_SECOND } from '../dist/sim.mjs';

function parseArgs(argv) {
  const flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) throw new Error(`missing value for ${arg}`);
    flags.set(arg.slice(2), next);
    i += 1;
  }
  const int = (name, fallback) => {
    if (!flags.has(name)) {
      if (fallback !== undefined) return fallback;
      throw new Error(`missing --${name}`);
    }
    const value = Number(flags.get(name));
    if (!Number.isInteger(value)) throw new Error(`--${name} must be an integer`);
    return value;
  };
  const out = flags.get('out');
  if (!out) throw new Error('missing --out');
  return { seed: int('seed', 7), nights: int('nights', 10), out };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRECTIONS = [
  [0, 0], [0, 1], [1, 0], [0, -1], [-1, 0],
  [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707],
];

function runNight(seed, night, totalScore, rng) {
  const world = createWorld({ seed, night, totalScore });
  const maxTicks = TUNING[`night${night}_duration_s`] * TICKS_PER_SECOND;
  let direction = DIRECTIONS[0];
  let jump = false;
  let dash = false;
  let pulse = false;
  let interact = false;

  while (world.state === 'playing' && world.simTick < maxTicks) {
    if (world.simTick % 30 === 0) {
      direction = DIRECTIONS[Math.floor(rng() * DIRECTIONS.length) % DIRECTIONS.length];
    }
    jump = rng() < 0.05;
    dash = rng() < 0.03;
    pulse = rng() < 0.02;
    interact = rng() < 0.1;
    step(world, {
      move: direction,
      camYawDeg: 0,
      jump,
      dash,
      pulse,
      interact,
      pause: false,
    });
  }
  return world;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.nights < 1) throw new Error('--nights must be >= 1');
  const started = Date.now();
  const results = [];
  let crashes = 0;
  let totalScore = 0;
  let memStart = null;
  let world = null;

  for (let i = 1; i <= args.nights; i += 1) {
    const night = ((i - 1) % 3) + 1;
    try {
      world = runNight(args.seed + i, night, totalScore, mulberry32(args.seed + i));
      if (world.state === 'won') totalScore = world.totalScore;
      results.push(world.state);
      if (i === 1) memStart = process.memoryUsage().rss / 1048576;
    } catch (error) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`soak night ${i}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
    // Drop references so each night is a real reset, not an accumulation.
    world = null;
    if (global.gc) global.gc();
  }

  const memEnd = process.memoryUsage().rss / 1048576;
  const report = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStart === null ? null : Math.round(memStart * 10) / 10,
    mem_end_mb: Math.round(memEnd * 10) / 10,
    duration_s: Math.round((Date.now() - started) / 100) / 10,
  };
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`OK — soak ${args.nights} nights, ${crashes} crashes → ${args.out}\n`);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`soak: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
