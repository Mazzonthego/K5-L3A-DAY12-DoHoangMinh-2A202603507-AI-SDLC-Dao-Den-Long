/**
 * TICKET-04 benchmark — real browser, standard 1280×720 scene, 200 shades,
 * 100 motes, 3 full lanterns, fixed orbit camera.
 *
 *   node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';
import { createServer } from 'vite';

const STARTED = Date.now();
const PORT = 5175;
const DEBUG_PORT = 9334;
const TARGET = `http://127.0.0.1:${PORT}/`;
const TMP = join(process.cwd(), '.tmp');
mkdirSync(TMP, { recursive: true });

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
  return { seed: int('seed', 42), duration: int('duration', 30), out };
}

function browserPath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];
  return candidates.find((path) => path && existsSync(path));
}

async function waitFor(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

function cdpClient(ws) {
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 60000);
    });
  return {
    send,
    evaluate: async (expression) =>
      (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))
        .result.value,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const chrome = browserPath();
  if (!chrome) throw new Error('no Chrome/Edge found — set CHROME_PATH or EDGE_PATH');

  const server = await createServer({
    configFile: join(process.cwd(), 'vite.config.ts'),
    server: { host: '127.0.0.1', port: PORT, strictPort: true },
  });
  let browser;
  let ws;
  try {
    await server.listen();
    if (!(await waitFor(TARGET))) throw new Error('Vite dev server did not start');
    browser = spawn(
      chrome,
      [
        '--headless=new',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-frame-rate-limit',
        '--disable-gpu-vsync',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--remote-debugging-port=' + DEBUG_PORT,
        '--remote-allow-origins=*',
        '--enable-unsafe-swiftshader',
        '--user-data-dir=' + join(TMP, 'bench-profile'),
        '--window-size=1280,720',
        TARGET,
      ],
      { cwd: process.cwd(), stdio: 'ignore' },
    );

    const tabsUrl = `http://127.0.0.1:${DEBUG_PORT}/json/list`;
    if (!(await waitFor(tabsUrl))) throw new Error('Chrome remote debugging did not start');
    const tabs = await (await fetch(tabsUrl)).json();
    const page = tabs.find((tab) => tab.type === 'page' && tab.url.includes(String(PORT)));
    if (!page) throw new Error('benchmark page target not found');

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const cdp = cdpClient(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });

    for (let i = 0; i < 60; i += 1) {
      if (await cdp.evaluate('typeof window.__daoStartBench === "function"')) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    await cdp.evaluate(
      `window.__daoStartBench({ seed: ${args.seed}, duration: ${args.duration} })`,
    );

    // load_ms is measured from this Node process' start to the first bench frame.
    for (let i = 0; i < 150; i += 1) {
      if (await cdp.evaluate('window.__daoBenchFirstFrame === true')) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const loadMs = Date.now() - STARTED;

    const sample = await cdp.evaluate(`new Promise((resolve) => {
      const id = setInterval(() => {
        if (window.__daoBenchResult) {
          clearInterval(id);
          resolve(window.__daoBenchResult);
        }
      }, 100);
    })`);
    if (!sample || !Number.isFinite(sample.avg_fps)) {
      throw new Error('benchmark did not produce a valid sample');
    }

    const report = {
      contract_version: '1.3',
      avg_fps: sample.avg_fps,
      p1_low_fps: sample.p1_low_fps,
      frame_ms_p95: sample.frame_ms_p95,
      frames: sample.frames,
      load_ms: loadMs,
      peak_mem_mb: null,
      vsync_off: true,
      renderer: sample.renderer,
      os: `${process.platform} ${os.release()}`,
    };
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const pass = report.avg_fps >= 60 && report.p1_low_fps >= 30 && report.load_ms <= 10000;
    process.stdout.write(
      `OK — bench ${report.frames} frames, avg ${report.avg_fps} FPS, p1 ${report.p1_low_fps} FPS, load ${report.load_ms} ms (${pass ? 'pass' : 'below reference threshold'}) → ${args.out}\n`,
    );
    if (!pass) process.exitCode = 1;
  } finally {
    ws?.close();
    browser?.kill();
    await server.close();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`bench: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
