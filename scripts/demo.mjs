/**
 * Records docs/demo/demo.mp4 from the real game via CDP screencast + ffmpeg.
 * ffmpeg is not a project dependency; set FFMPEG_PATH to a local binary.
 *
 *   node scripts/demo.mjs
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const PORT = 5176;
const DEBUG_PORT = 9335;
const TARGET = `http://127.0.0.1:${PORT}/`;
const TMP = join(process.cwd(), '.tmp', 'demo-frames');
const OUT = join(process.cwd(), 'docs', 'demo', 'demo.mp4');
const FFMPEG = process.env.FFMPEG_PATH ||
  join(process.cwd(), '.tmp', 'ffmpeg', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
mkdirSync(TMP, { recursive: true });

function browserPath() {
  return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((path) => path && existsSync(path));
}

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

function cdp(ws, onFrame) {
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Page.screencastFrame') onFrame(message.params);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, evaluate: (expression) => send('Runtime.evaluate', { expression, awaitPromise: true }) };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  if (!existsSync(FFMPEG)) throw new Error(`ffmpeg not found: ${FFMPEG}`);
  const chrome = browserPath();
  if (!chrome) throw new Error('no Chrome/Edge found');
  const server = await createServer({ server: { host: '127.0.0.1', port: PORT, strictPort: true } });
  let browser;
  let ws;
  try {
    await server.listen();
    if (!(await waitFor(TARGET))) throw new Error('Vite did not start');
    browser = spawn(chrome, [
      '--headless=new', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=' + DEBUG_PORT, '--remote-allow-origins=*',
      '--enable-unsafe-swiftshader', '--user-data-dir=' + join(process.cwd(), '.tmp', 'demo-profile'),
      '--window-size=1280,720', TARGET,
    ], { cwd: process.cwd(), stdio: 'ignore' });

    const tabsUrl = `http://127.0.0.1:${DEBUG_PORT}/json/list`;
    if (!(await waitFor(tabsUrl))) throw new Error('CDP did not start');
    const tabs = await (await fetch(tabsUrl)).json();
    const page = tabs.find((tab) => tab.type === 'page' && tab.url.includes(String(PORT)));
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    let index = 0;
    const client = cdp(ws, async (frame) => {
      writeFileSync(join(TMP, `frame_${String(index++).padStart(5, '0')}.jpg`), Buffer.from(frame.data, 'base64'));
      try { await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }); } catch { /* closing */ }
    });
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
    });
    for (let i = 0; i < 40; i += 1) {
      const ready = await client.evaluate('typeof window.__daoStartNight === "function"');
      if (ready.result?.value) break;
      await sleep(200);
    }

    await client.send('Page.startScreencast', {
      format: 'jpeg', quality: 75, everyNthFrame: 2, maxWidth: 1280, maxHeight: 720,
    });
    await sleep(1500);
    await client.evaluate('window.__daoStartNight(1)');
    await sleep(1500);

    // A short, scripted play session: walk, grab, pulse, dash, jump.
    const key = async (code, keyName, holdMs) => {
      const extra = code === 'ShiftLeft' ? { windowsVirtualKeyCode: 16 } : {};
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: keyName, ...extra });
      await sleep(holdMs);
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: keyName, ...extra });
    };
    for (let i = 0; i < 6; i += 1) {
      await key('KeyW', 'w', 1400);
      await key('KeyE', 'e', 120);
      await key('KeyQ', 'q', 120);
      await key('ShiftLeft', 'Shift', 120);
      await key('Space', ' ', 120);
      await key('KeyA', 'a', 700);
    }
    // Show the standard benchmark scene as the final evidence clip.
    await client.evaluate('window.__daoStartBench({ seed: 42, duration: 6 })');
    await sleep(7000);
    await client.send('Page.stopScreencast');
  } finally {
    ws?.close();
    browser?.kill();
    await server.close();
  }

  const frames = readdirSync(TMP).filter((f) => f.endsWith('.jpg')).length;
  if (frames === 0) throw new Error('no frames were recorded');
  mkdirSync(join(process.cwd(), 'docs', 'demo'), { recursive: true });
  const result = spawnSync(FFMPEG, [
    '-y', '-framerate', '15', '-i', join(TMP, 'frame_%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT,
  ], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed with ${result.status}`);
  process.stdout.write(`OK — ${frames} frames → ${OUT}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`demo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
