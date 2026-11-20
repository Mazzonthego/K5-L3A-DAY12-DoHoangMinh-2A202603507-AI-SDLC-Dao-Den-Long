/**
 * `run_cmd` from game.contract.json.
 *
 *   node scripts/run.mjs                              → start the dev server
 *   node scripts/run.mjs --export-leaderboard out.json → write {"entries":[...]}
 */
import { createServer } from 'vite';
import { exportLeaderboard } from './leaderboard.mjs';

const args = process.argv.slice(2);
const flagIndex = args.indexOf('--export-leaderboard');

if (flagIndex >= 0) {
  const out = args[flagIndex + 1];
  if (!out || out.startsWith('--')) {
    process.stderr.write('usage: node scripts/run.mjs --export-leaderboard out.json\n');
    process.exit(1);
  }
  try {
    const board = exportLeaderboard(out);
    process.stdout.write(`OK — exported ${board.entries.length} leaderboard entries to ${out}\n`);
  } catch (error) {
    process.stderr.write(`export-leaderboard: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
} else {
  const server = await createServer({
    server: { host: '127.0.0.1', port: 5173 },
  });
  await server.listen();
  server.printUrls();
}
