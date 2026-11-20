/**
 * Headless runner — implements Test Contract v1.1 (section B/C/E).
 *
 * Usage:
 *   node dist/headless.mjs --seed 7 --night 1 --ticks 4800 --out run.jsonl
 *                          [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
 *
 * Exit codes: 0 ok, 1 runtime/usage error, 2 malformed scenario/inputs file.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { InputFormatError, InputTrack, parseInputs } from '../sim/inputs';
import { endLine, eventLine, snapshotLine } from '../sim/output';
import { step } from '../sim/step';
import type { ScenarioFile } from '../sim/types';
import { createWorld } from '../sim/world';

interface Args {
  seed: number;
  night: number;
  ticks: number;
  out: string;
  snapshotEvery: number;
  scenario?: string;
  inputs?: string;
}

class UsageError extends Error {}

function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument: ${arg}`);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) throw new UsageError(`missing value for ${arg}`);
    flags.set(arg.slice(2), next);
    i += 1;
  }
  const required = (name: string): string => {
    const value = flags.get(name);
    if (value === undefined) throw new UsageError(`missing --${name}`);
    return value;
  };
  const int = (name: string, fallback?: number): number => {
    const raw = flags.get(name);
    if (raw === undefined) {
      if (fallback !== undefined) return fallback;
      throw new UsageError(`missing --${name}`);
    }
    const value = Number(raw);
    if (!Number.isInteger(value)) throw new UsageError(`--${name} must be an integer`);
    return value;
  };
  return {
    seed: int('seed'),
    night: int('night', 1),
    ticks: int('ticks'),
    out: required('out'),
    snapshotEvery: int('snapshot-every', 10),
    scenario: flags.get('scenario'),
    inputs: flags.get('inputs'),
  };
}

function readJson<T>(path: string): T {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    // A missing/unreadable file is a usage error (exit 1), not a malformed file (exit 2).
    throw new UsageError(`cannot read ${path}: ${(error as Error).message}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new InputFormatError(`invalid JSON in ${path}: ${(error as Error).message}`);
  }
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.night < 1 || args.night > 3) throw new UsageError('--night must be 1, 2 or 3');
  if (args.ticks < 0) throw new UsageError('--ticks must be >= 0');
  if (args.snapshotEvery < 1) throw new UsageError('--snapshot-every must be >= 1');

  const scenario = args.scenario ? readJson<ScenarioFile>(args.scenario) : undefined;
  const frames = args.inputs ? parseInputs(readJson<unknown>(args.inputs)) : [];
  const track = new InputTrack(frames);

  let world;
  try {
    world = createWorld({ seed: args.seed, night: args.night as 1 | 2 | 3, scenario });
  } catch (error) {
    throw new InputFormatError(`invalid scenario: ${(error as Error).message}`);
  }
  const lines: string[] = [snapshotLine(world)];

  for (let k = 0; k < args.ticks && world.state === 'playing'; k += 1) {
    const events = step(world, track.at(k));
    for (const event of events) lines.push(eventLine(event));
    if (world.tick % args.snapshotEvery === 0) lines.push(snapshotLine(world));
  }
  lines.push(endLine(world));

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${lines.join('\n')}\n`, 'utf8');
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`headless: ${message}\n`);
  process.exit(error instanceof InputFormatError ? 2 : 1);
}
