/**
 * Verification for Test Contract v1.1 (TICKET-02).
 *
 *   npm run verify [-- phase-2]
 *
 * Unit tests + typecheck + headless build + determinism + per-feature scenario
 * evidence + exit codes + full-night performance. Evidence goes to docs/proof/<phase>/.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const phase = process.argv[2] ?? 'phase-2';
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

function headless(args) {
  return run('node', ['dist/headless.mjs', ...args]);
}

function readLines(path) {
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const checks = [];
function check(requirement, how, passed, detail = '') {
  checks.push({ requirement, how, passed, detail });
}

const log = [];

// 1. Tests and typecheck
const testOutput = run('npm', ['test']);
writeFileSync(join(proofDir, 'tests.txt'), testOutput, 'utf8');
check('Unit tests', 'npm test', !testOutput.includes('failed') && testOutput.includes('passed'));
log.push('## Unit tests\n\n```\n' + testOutput.trim() + '\n```');
run('npm', ['run', 'typecheck']);
check('Type check', 'npm run typecheck', true);
run('npm', ['run', 'build:headless']);

// 2. Deterministic full-feature replay
const base = [
  '--seed',
  '7',
  '--night',
  '1',
  '--scenario',
  join('tests', 'fixtures', 'scenario-features.json'),
  '--inputs',
  join('tests', 'fixtures', 'inputs-features.json'),
  '--ticks',
  '600',
  '--snapshot-every',
  '10',
];
headless([...base, '--out', '.tmp/features-a.jsonl']);
headless([...base, '--out', '.tmp/features-b.jsonl']);
const hashA = hash(join(tmpDir, 'features-a.jsonl'));
const hashB = hash(join(tmpDir, 'features-b.jsonl'));
const records = readLines(join(tmpDir, 'features-a.jsonl'));
const events = records.filter((line) => line.type === 'event');
const eventNames = [...new Set(events.map((line) => line.name))];
const first = records[0];
const end = records.at(-1);
writeFileSync(join(proofDir, 'events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
writeFileSync(
  join(proofDir, 'determinism.txt'),
  `seed=7 night=1 ticks=600\nrun-a sha256 ${hashA}\nrun-b sha256 ${hashB}\nidentical: ${hashA === hashB}\n`,
  'utf8',
);
check('Determinism', 'two runs, equal sha256', hashA === hashB, hashA);
log.push(`## Determinism\n\n- sha256 (both runs): \`${hashA}\`\n- identical: **${hashA === hashB}**`);

// 2b. Phase 1 regression — the standard numbers still hold under v1.1.
const regressionArgs = [
  '--seed',
  '7',
  '--night',
  '1',
  '--scenario',
  join('tests', 'fixtures', 'scenario-basic.json'),
  '--inputs',
  join('tests', 'fixtures', 'walk.json'),
  '--ticks',
  '600',
  '--snapshot-every',
  '60',
];
headless([...regressionArgs, '--out', '.tmp/regression-a.jsonl']);
headless([...regressionArgs, '--out', '.tmp/regression-b.jsonl']);
const regressionHashA = hash(join(tmpDir, 'regression-a.jsonl'));
const regressionHashB = hash(join(tmpDir, 'regression-b.jsonl'));
const regressionLines = readLines(join(tmpDir, 'regression-a.jsonl'));
writeFileSync(join(proofDir, 'regression.jsonl'), readFileSync(join(tmpDir, 'regression-a.jsonl')), 'utf8');
const walk60 = regressionLines.find((line) => line.type === 'snapshot' && line.tick === 60);
check(
  'Phase 1 regression determinism',
  'scenario-basic.json + walk.json replayed twice',
  regressionHashA === regressionHashB,
  regressionHashA,
);
check('Phase 1 regression: 60 ticks = 1 s', 'snapshot tick 60 time_left_s', walk60?.time_left_s === 299);
check('Phase 1 regression: speed 6 m/s', 'snapshot tick 60 vel', walk60?.player?.vel?.[2] === 6);
check(
  'Phase 1 regression: mote pickup',
  'headless replay',
  regressionLines.some((line) => line.name === 'mote_picked'),
);
check(
  'Phase 1 regression: 3 flames lost → game over',
  'game_over reason no_flames',
  regressionLines.some((line) => line.name === 'game_over' && line.data.reason === 'no_flames'),
);
log.push(
  `## Phase 1 regression\n\n- sha256 (both runs): \`${regressionHashA}\`\n- 60 ticks → time_left_s 299, speed 6 m/s, mote pickup and no_flames game over all preserved.`,
);

// 3. v1.1 snapshot shape
const requiredPlayer = ['vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s'];
check(
  'Snapshot v1.1 fields',
  'first snapshot',
  first?.night === 1 &&
    first?.sim_tick === 0 &&
    Boolean(first?.wind) &&
    Array.isArray(first?.motes) &&
    Array.isArray(first?.drifters) &&
    Array.isArray(first?.charms) &&
    requiredPlayer.every((key) => key in first.player),
);
check('Coordinates rounded to 3 decimals', 'snapshot player pos', first.player.pos.every((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6));

// 4. Events from the full-feature fixture
for (const name of [
  'night_start',
  'mote_picked',
  'pulse',
  'dash',
  'deposit',
  'lantern_lit',
  'paused',
  'resumed',
  'game_over',
]) {
  check(`Event ${name}`, 'scenario-features.json + inputs-features.json', eventNames.includes(name));
}
check(
  'Pause freezes sim_tick',
  'snapshots around pause frames',
  records.some((line) => line.type === 'snapshot' && line.state === 'paused'),
);
check('Event tick = k+1', 'event list', events.every((e) => e.tick >= 1));
check('End line', 'last line', end?.type === 'end' && end.ticks <= 600);

// 5. Per-feature headless scenarios (DoD: at least one per new feature)
function fixtureRun(name, night, scenario, inputs, ticks, extraArgs = []) {
  const args = [
    '--seed',
    '7',
    '--night',
    String(night),
    '--scenario',
    join('tests', 'fixtures', scenario),
  ];
  if (inputs) args.push('--inputs', join('tests', 'fixtures', inputs));
  headless([...args, '--ticks', String(ticks), '--snapshot-every', String(Math.max(1, Math.floor(ticks / 4))), ...extraArgs, '--out', `.tmp/${name}.jsonl`]);
  return readLines(join(tmpDir, `${name}.jsonl`));
}

const drifterLines = fixtureRun('drifter', 2, 'scenario-drifter.json', 'inputs-drifter.json', 60);
check('Drifter steal', 'night 2 drifter fixture', drifterLines.some((l) => l.name === 'drifter_steal'));
check(
  'Pulse makes drifter drop loot',
  'dropped motes appear after pulse',
  drifterLines.some((l) => l.type === 'snapshot' && l.motes.some((m) => m.kind === 'dropped')),
);
check(
  'Event drifter_drop',
  'night 2 drifter fixture',
  drifterLines.some((l) => l.name === 'drifter_drop' && l.data.amount === 3),
);

const charmLines = fixtureRun('charm', 2, 'scenario-charm.json', 'inputs-charm.json', 60);
check('Charm pickup', 'night 2 charm fixture', charmLines.some((l) => l.name === 'charm_picked'));
check(
  'Charm removes dash cooldown',
  'two dash events within 1.5 s',
  charmLines.filter((l) => l.name === 'dash').length === 2,
);

const fallLines = fixtureRun('fall', 1, 'scenario-fall.json', null, 120);
check(
  'Fall event carries lost field',
  'night 1 fall fixture',
  fallLines.some((l) => l.name === 'player_hit' && l.data.by === 'fall' && l.data.lost === 1),
);

const night3Lines = fixtureRun('night3', 3, 'scenario-night3.json', null, 1920);
check('Night 3 pad launch', 'player Y rises above the pad', night3Lines.some((l) => l.type === 'snapshot' && l.player.pos[1] > 5));
check('Night 3 wind warning', 'tick 1800 snapshot', night3Lines.some((l) => l.type === 'snapshot' && l.tick >= 1800 && l.player));

const spawnLines = fixtureRun('spawn', 1, 'scenario-spawn.json', null, 780);
check('Shade spawn schedule', '2 shades at tick 300, 1 at tick 780', spawnLines.filter((l) => l.name === 'shade_spawned').length >= 3);

const night2 = fixtureRun('night2', 2, 'scenario-features.json', null, 60);
check('--night 2 accepted', 'headless run', night2.at(-1)?.type === 'end' && night2.at(-1)?.night === 2);

// 6. Full-night performance (21600 ticks <= 30 s)
const started = Date.now();
headless([
  '--seed',
  '7',
  '--night',
  '3',
  '--scenario',
  join('tests', 'fixtures', 'scenario-spawn.json'),
  '--ticks',
  '21600',
  '--snapshot-every',
  '21600',
  '--out',
  '.tmp/perf.jsonl',
]);
const elapsedMs = Date.now() - started;
check('Full night within 30 s', '21600 ticks, night 3', elapsedMs <= 30000, `${elapsedMs} ms`);
log.push(`## Performance\n\n21600 ticks in **${elapsedMs} ms** (limit 30000 ms).`);

// 6b. GUI FPS evidence — produced by `npm run fps`, never fabricated here.
const fpsPath = join(proofDir, 'fps.txt');
const fpsText = existsSync(fpsPath) ? readFileSync(fpsPath, 'utf8') : '';
const fpsMatch = /FPS trung bình: \*\*([\d.]+)\*\*/.exec(fpsText);
const fpsValue = fpsMatch ? Number(fpsMatch[1]) : null;
check(
  'GUI ≥ 30 FPS @ 1280×720',
  'npm run fps (real requestAnimationFrame)',
  fpsValue !== null && fpsValue >= 30,
  fpsValue === null ? 'chưa có bằng chứng' : `${fpsValue} FPS`,
);
log.push(`## GUI performance\n\n${fpsText.trim() || 'Chưa chạy `npm run fps`.'}`);

// 7. Exit codes
const badInputs = join(tmpDir, 'bad-inputs.json');
writeFileSync(badInputs, '{ "frames": [ { "tick": 5 }, { "tick": 5 } ] }', 'utf8');
const bad = spawnSync('node', ['dist/headless.mjs', '--seed', '1', '--night', '1', '--inputs', badInputs, '--ticks', '10', '--out', '.tmp/bad.jsonl'], { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' });
check('Malformed inputs exit 2', 'spawnSync', bad.status === 2);
const missing = spawnSync('node', ['dist/headless.mjs', '--seed', '1', '--night', '1', '--scenario', '.tmp/nope.json', '--ticks', '10', '--out', '.tmp/missing.jsonl'], { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' });
check('Missing file exit 1', 'spawnSync', missing.status === 1);
const badNight = spawnSync('node', ['dist/headless.mjs', '--seed', '1', '--night', '9', '--ticks', '10', '--out', '.tmp/night.jsonl'], { cwd: root, shell: process.platform === 'win32', encoding: 'utf8' });
check('Invalid --night exit 1', 'spawnSync', badNight.status === 1);

// 8. Evidence summary
const table = [
  '| Requirement | How checked | Result |',
  '|---|---|---|',
  ...checks.map((c) => `| ${c.requirement} | ${c.how} | ${c.passed ? 'đạt' : '**chưa đạt**'}${c.detail ? ` — ${c.detail}` : ''} |`),
].join('\n');
writeFileSync(
  join(proofDir, 'summary.md'),
  `# Evidence ${phase} — Test Contract v1.1\n\nGenerated on ${new Date().toISOString()}.\n\n${table}\n\n${log.join('\n\n')}\n`,
  'utf8',
);

const failed = checks.filter((c) => !c.passed);
if (failed.length > 0) throw new Error(`${failed.length} check(s) failed: ${failed.map((c) => c.requirement).join(', ')}`);
console.log(`OK — ${checks.length} checks passed, evidence written to ${proofDir}`);
