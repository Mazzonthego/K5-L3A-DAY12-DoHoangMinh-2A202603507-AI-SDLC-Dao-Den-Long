/**
 * One-command verification: unit tests + typecheck + headless build +
 * deterministic gameplay replay + contract exit codes.
 *
 *   npm run verify [-- phase-1]
 *
 * Evidence is written to docs/proof/<phase>/ so it can be committed with the tag.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const phase = process.argv[2] ?? 'phase-1';
const proofDir = join(root, 'docs', 'proof', phase);
const tmpDir = join(root, '.tmp');
mkdirSync(proofDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    shell: process.platform === 'win32',
    encoding: 'utf8',
    ...options,
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    throw new Error(`${command} ${args.join(' ')} failed with code ${result.status}`);
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const lines = (path) =>
  readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const checks = [];
function check(requirement, how, passed, detail = '') {
  checks.push({ requirement, how, passed, detail });
}

const log = [];

// 1. Unit tests
const testOutput = run('npm', ['test']);
writeFileSync(join(proofDir, 'tests.txt'), testOutput, 'utf8');
log.push('## Unit tests\n\n```\n' + testOutput.trim() + '\n```');
check('Unit tests', 'npm test', testOutput.includes('Tests') && !testOutput.includes('failed'));

// 2. Type check
run('npm', ['run', 'typecheck']);
log.push('## Type check\n\n`npm run typecheck` passed (tsc --noEmit, 0 errors).');
check('Type check', 'npm run typecheck', true);

// 3. Build the headless bundle exactly as the contract's build_cmd does
run('npm', ['run', 'build:headless']);

// 4. Deterministic gameplay replay (same seed/scenario/inputs twice)
const scenario = join('tests', 'fixtures', 'scenario-play.json');
const inputs = join('tests', 'fixtures', 'inputs-play.json');
const common = [
  'dist/headless.mjs',
  '--seed',
  '7',
  '--night',
  '1',
  '--scenario',
  scenario,
  '--inputs',
  inputs,
  '--ticks',
  '600',
  '--snapshot-every',
  '60',
];
run('node', [...common, '--out', '.tmp/play-a.jsonl']);
run('node', [...common, '--out', '.tmp/play-b.jsonl']);

const hashA = hash(join(tmpDir, 'play-a.jsonl'));
const hashB = hash(join(tmpDir, 'play-b.jsonl'));
const deterministic = hashA === hashB;
const records = lines(join(tmpDir, 'play-a.jsonl'));
const events = records.filter((line) => line.type === 'event');
const eventNames = [...new Set(events.map((line) => line.name))];
const end = records.at(-1);
const firstSnapshot = records[0];

writeFileSync(
  join(proofDir, 'determinism.txt'),
  [
    `seed=7 scenario=${scenario} inputs=${inputs} ticks=600`,
    `run-a sha256 ${hashA}`,
    `run-b sha256 ${hashB}`,
    `identical: ${deterministic}`,
    `events: ${eventNames.join(', ')}`,
    `last line: ${JSON.stringify(end)}`,
    '',
  ].join('\n'),
  'utf8',
);
writeFileSync(join(proofDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');

log.push(
  '## Determinism (same seed, scenario, inputs)\n\n' +
    `- run-a: \`${hashA}\`\n- run-b: \`${hashB}\`\n- identical: **${deterministic}**\n` +
    `- event names: ${eventNames.map((n) => `\`${n}\``).join(', ')}\n` +
    `- final line: \`${JSON.stringify(end)}\``,
);
check('Determinism', 'two headless runs, equal sha256', deterministic, `${hashA}`);
check('Snapshot tick 0', 'first JSONL line', firstSnapshot?.tick === 0 && firstSnapshot?.sim_tick === 0);

for (const name of ['mote_picked', 'deposit', 'lantern_lit', 'pulse', 'player_hit']) {
  check(`Event ${name}`, 'headless gameplay replay', eventNames.includes(name));
}

// 5. Dynamic shade spawn (needs 1800 ticks = 30 s)
run('node', [
  'dist/headless.mjs',
  '--seed',
  '7',
  '--night',
  '1',
  '--scenario',
  join('tests', 'fixtures', 'scenario-spawn.json'),
  '--ticks',
  '1800',
  '--snapshot-every',
  '1800',
  '--out',
  '.tmp/spawn.jsonl',
]);
const spawnEvents = lines(join(tmpDir, 'spawn.jsonl')).filter((line) => line.type === 'event');
const spawned = spawnEvents.find((line) => line.name === 'shade_spawned');
check('Event shade_spawned', '1800-tick headless run', Boolean(spawned), JSON.stringify(spawned));
check('Event tick convention', 'gameplay replay', events.every((e) => e.tick >= 1));
check(
  'End line',
  'last JSONL line (stops early on game over)',
  end?.type === 'end' && end.ticks <= 600 && ['playing', 'won', 'lost'].includes(end.state),
);
check('Event game_over', 'gameplay replay', eventNames.includes('game_over'));
check(
  'Coordinates rounded to 3 decimals',
  'snapshot positions',
  firstSnapshot?.player?.pos?.every((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6),
);

// 6. Error handling: malformed inputs must exit with code 2
const badInputs = join(tmpDir, 'bad-inputs.json');
writeFileSync(badInputs, '{ "frames": [ { "tick": 5 }, { "tick": 5 } ] }', 'utf8');
const bad = spawnSync(
  'node',
  [
    'dist/headless.mjs',
    '--seed',
    '1',
    '--night',
    '1',
    '--inputs',
    badInputs,
    '--ticks',
    '10',
    '--out',
    '.tmp/bad.jsonl',
  ],
  { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' },
);
log.push(`## Error handling\n\nMalformed inputs exit code: **${bad.status}** (expected 2)`);
check('Malformed inputs exit 2', 'spawnSync headless with bad inputs', bad.status === 2);

const missing = spawnSync(
  'node',
  [
    'dist/headless.mjs',
    '--seed',
    '1',
    '--night',
    '1',
    '--scenario',
    '.tmp/does-not-exist.json',
    '--ticks',
    '10',
    '--out',
    '.tmp/missing.jsonl',
  ],
  { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' },
);
check('Missing scenario file exits 1', 'spawnSync headless with missing file', missing.status === 1);

// 7. Evidence table
const table = [
  '| Requirement | How checked | Result |',
  '|---|---|---|',
  ...checks.map(
    (c) =>
      `| ${c.requirement} | ${c.how} | ${c.passed ? 'đạt' : '**chưa đạt**'}${c.detail ? ` — ${c.detail}` : ''} |`,
  ),
].join('\n');

writeFileSync(
  join(proofDir, 'summary.md'),
  `# Evidence ${phase}\n\nGenerated by \`npm run verify -- ${phase}\` on ${new Date().toISOString()}.\n\n` +
    `## Requirement evidence\n\n${table}\n\n${log.join('\n\n')}\n`,
  'utf8',
);

const failed = checks.filter((c) => !c.passed);
if (failed.length > 0) {
  throw new Error(`${failed.length} check(s) failed: ${failed.map((c) => c.requirement).join(', ')}`);
}
console.log(`OK — ${checks.length} checks passed, evidence written to ${proofDir}`);
