import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { insertEntry, normaliseEntry, readBoard } from './src/leaderboard.ts';

/**
 * The local leaderboard is a JSON file so `run_cmd --export-leaderboard`
 * sees exactly what the GUI saved. The browser reaches it through this small
 * dev-server API; `src/main.ts` falls back to localStorage for static builds.
 */
function leaderboardApi(): Plugin {
  const file = join(process.cwd(), 'data', 'leaderboard.json');
  const read = () => {
    if (!existsSync(file)) return { entries: [] };
    try {
      return readBoard(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      return { entries: [] };
    }
  };
  const write = (board: { entries: ReturnType<typeof normaliseEntry>[] }) => {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(readBoard(board), null, 2)}\n`, 'utf8');
  };
  return {
    name: 'dao-den-long-leaderboard-api',
    configureServer(server) {
      server.middlewares.use('/api/leaderboard', (req, res) => {
        const send = (status: number, value: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(value));
        };
        if (req.method === 'GET') {
          send(200, read());
          return;
        }
        if (req.method !== 'POST') {
          send(405, { error: 'method not allowed' });
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += String(chunk);
          if (body.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as { entry?: unknown };
            const entry = normaliseEntry(payload.entry ?? payload);
            if (!entry) {
              send(400, { error: 'invalid leaderboard entry' });
              return;
            }
            const board = { entries: insertEntry(read().entries, entry) };
            write(board);
            send(200, board);
          } catch {
            send(400, { error: 'invalid JSON' });
          }
        });
      });
    },
  };
}

// base './' so the built folder can be served from any path (Release asset).
export default defineConfig({
  base: './',
  plugins: [leaderboardApi()],
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    // Benchmark browser profiles and build output must not trigger reloads.
    watch: { ignored: ['**/.tmp/**', '**/dist/**', '**/docs/proof/**'] },
  },
});
