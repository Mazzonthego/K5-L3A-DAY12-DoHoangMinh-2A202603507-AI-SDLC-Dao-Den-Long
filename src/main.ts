import * as THREE from 'three';
import { FUEL_MAX_UNITS, NIGHTS, TICKS_PER_SECOND, TUNING } from './sim/config';
import { step } from './sim/step';
import {
  insertEntry,
  isValidName,
  LEADERBOARD_KEY,
  readBoard,
  type Leaderboard,
  type LeaderboardEntry,
} from './leaderboard';
import type { InputState, World } from './sim/types';
import { createWorld } from './sim/world';

const C = {
  sky: '#0E1430',
  fog: '#1B2350',
  grass: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  sea: '#12384A',
  lit: '#FFB347',
  core: '#FFE9B0',
  off: '#5B5F6E',
  mote: '#FFF6C2',
  moteGlow: '#FFE58A',
  shade: '#120A1A',
  shadeEdge: '#7A3CFF',
  shadeEdgeColorblind: '#00B3FF',
  stunned: '#3A3450',
  cloth: '#E8E2D0',
  red: '#C8102E',
  gold: '#F2C14E',
  drifter: '#8FA3B8',
  danger: '#FF5A5F',
  dangerColorblind: '#FFFFFF',
  text: '#F5F1E6',
} as const;

type Action =
  | 'forward' | 'back' | 'left' | 'right'
  | 'jump' | 'dash' | 'interact' | 'pulse' | 'pause';

const DEFAULT_BINDINGS: Record<Action, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyQ',
  pause: 'Escape',
};

const KEY_OPTIONS: Array<[string, string]> = [
  ['KeyW', 'W'], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'],
  ['KeyE', 'E'], ['KeyQ', 'Q'], ['KeyR', 'R'], ['KeyF', 'F'],
  ['Space', 'Space'], ['ShiftLeft', 'Shift trái'], ['ShiftRight', 'Shift phải'],
  ['ControlLeft', 'Ctrl trái'], ['ControlRight', 'Ctrl phải'],
  ['ArrowUp', '↑'], ['ArrowDown', '↓'], ['ArrowLeft', '←'], ['ArrowRight', '→'],
  ['Escape', 'Esc'], ['KeyP', 'P'], ['Enter', 'Enter'],
];

const ACTION_LABELS: Record<Action, string> = {
  forward: 'Tiến', back: 'Lùi', left: 'Trái', right: 'Phải',
  jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa sáng', pause: 'Tạm dừng',
};

interface Settings {
  volume: number;
  sensitivity: number;
  /** TICKET-03: high-contrast palette for colour-blind players. */
  colorblind: boolean;
  /** TICKET-04 accessibility. */
  bindings: Record<Action, string>;
  reducedMotion: boolean;
  largeText: boolean;
}

const settings: Settings = loadSettings();
let volume = settings.volume;
let sensitivity = settings.sensitivity;
let colorblind = settings.colorblind;
let bindings = settings.bindings;
let reducedMotion = settings.reducedMotion;
let largeText = settings.largeText;

/** TICKET-03: warning UI turns white in the colour-blind palette. */
function warningColor(): string {
  return colorblind ? C.dangerColorblind : C.danger;
}

function keyLabel(action: Action): string {
  return KEY_OPTIONS.find(([code]) => code === bindings[action])?.[1] ?? bindings[action];
}

function applyAccessibility(): void {
  document.documentElement.style.setProperty('--ui-scale', largeText ? '1.25' : '1');
  document.body.classList.toggle('no-motion', reducedMotion);
}

function loadSettings(): Settings {
  const defaults: Settings = {
    volume: 0.5,
    sensitivity: 1,
    colorblind: false,
    bindings: { ...DEFAULT_BINDINGS },
    reducedMotion: false,
    largeText: false,
  };
  try {
    const raw = localStorage.getItem('dao-den-long-settings');
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return {
        ...defaults,
        ...parsed,
        bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings ?? {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

function saveSettings(): void {
  try {
    localStorage.setItem(
      'dao-den-long-settings',
      JSON.stringify({ volume, sensitivity, colorblind, bindings, reducedMotion, largeText }),
    );
  } catch {
    /* ignore */
  }
  if (musicGain && audioContext) {
    musicGain.gain.value = volume * 0.03;
  }
}

let audioContext: AudioContext | null = null;
let musicGain: GainNode | null = null;
let musicNodes: OscillatorNode[] = [];

function startMusic(): void {
  if (volume <= 0 || musicNodes.length > 0) return;
  try {
    audioContext ??= new AudioContext();
    musicGain = audioContext.createGain();
    musicGain.gain.value = volume * 0.03;
    musicGain.connect(audioContext.destination);
    for (const frequency of [110, 164.81]) {
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(musicGain);
      oscillator.start();
      musicNodes.push(oscillator);
    }
  } catch {
    /* audio is optional */
  }
}

function stopMusic(): void {
  for (const oscillator of musicNodes) {
    try {
      oscillator.stop();
    } catch {
      /* already stopped */
    }
  }
  musicNodes = [];
  musicGain?.disconnect();
  musicGain = null;
}
function beep(frequency: number, duration = 0.12, type: OscillatorType = 'sine'): void {
  if (volume <= 0) return;
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume * 0.15;
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    /* audio is optional */
  }
}

const soundFor: Record<string, number> = {
  mote_picked: 880,
  deposit: 660,
  refuel: 720,
  lantern_lit: 990,
  lantern_out: 140,
  pulse: 520,
  player_hit: 180,
  dash: 420,
  charm_picked: 1100,
  drifter_steal: 300,
  shade_spawned: 220,
  game_over: 740,
};

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app')!.appendChild(renderer.domElement);

let rendererName = `Three.js r${THREE.REVISION}`;
try {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  rendererName = `Three.js r${THREE.REVISION} / ${gpu}`;
} catch {
  /* renderer description is best-effort */
}
(window as unknown as Record<string, unknown>).__daoRenderer = rendererName;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.014);
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);

let ambient = new THREE.HemisphereLight('#8fb6ff', '#0b1220', 0.15);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#cfe0ff', 0.55);
moon.position.set(-30, 60, 20);
scene.add(moon);

const worldGroup = new THREE.Group();
scene.add(worldGroup);

const playerMesh = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 6, 12),
  new THREE.MeshStandardMaterial({ color: C.cloth, roughness: 0.7 }),
);
body.position.y = 0.85;
playerMesh.add(body);
const scarf = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 0.18, 0.15),
  new THREE.MeshStandardMaterial({ color: C.red }),
);
scarf.position.set(0, 1.5, -0.28);
playerMesh.add(scarf);
const playerLight = new THREE.PointLight(C.lit, 5, 12, 2);
playerLight.position.y = 1.3;
playerMesh.add(playerLight);
scene.add(playerMesh);

const moteGeometry = new THREE.SphereGeometry(0.18, 8, 8);
const moteMaterial = new THREE.MeshStandardMaterial({
  color: C.mote,
  emissive: C.moteGlow,
  emissiveIntensity: 2.2,
});
const droppedMaterial = new THREE.MeshStandardMaterial({
  color: C.mote,
  emissive: C.moteGlow,
  emissiveIntensity: 1.1,
});
const shadeGeometry = new THREE.SphereGeometry(0.8, 16, 16);
const shadeMaterial = new THREE.MeshStandardMaterial({
  color: C.shade,
  emissive: C.shadeEdge,
  emissiveIntensity: 0.7,
});
const drifterGeometry = new THREE.PlaneGeometry(1.8, 0.7);
const drifterMaterial = new THREE.MeshStandardMaterial({
  color: C.drifter,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.85,
});
const charmGeometry = new THREE.OctahedronGeometry(0.5);
const charmMaterial = new THREE.MeshStandardMaterial({ color: C.red, emissive: C.gold });

const meshCache = {
  lanterns: new Map<string, THREE.Group>(),
  motes: new Map<string, THREE.Mesh>(),
  shades: new Map<string, THREE.Mesh>(),
  drifters: new Map<string, THREE.Mesh>(),
  charms: new Map<string, THREE.Mesh>(),
};

function clearGroup(group: THREE.Group): void {
  while (group.children.length > 0) group.remove(group.children[0]);
  meshCache.lanterns.clear();
  meshCache.motes.clear();
  meshCache.shades.clear();
  meshCache.drifters.clear();
  meshCache.charms.clear();
}

function buildMap(spec: (typeof NIGHTS)[1]): void {
  clearGroup(worldGroup);
  const addDisc = (x: number, z: number, radius: number, color: string, y: number) => {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius + 1, 1, 64),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
    mesh.position.set(x, y - 0.5, z);
    worldGroup.add(mesh);
  };
  if (spec.night === 2) {
    addDisc(0, 0, 28, C.grass, 0);
    addDisc(70, 0, 28, C.sand, 0);
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.5, 4),
      new THREE.MeshStandardMaterial({ color: C.wood }),
    );
    bridge.position.set(35, -0.25, 0);
    worldGroup.add(bridge);
    for (const pad of spec.pads) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: C.gold, emissive: C.lit }),
      );
      disc.position.set(pad.pos[0], pad.pos[1] + 0.15, pad.pos[2]);
      worldGroup.add(disc);
    }
  } else if (spec.night === 3) {
    addDisc(0, 0, 45, C.grass, 0);
    const tier1 = new THREE.Mesh(
      new THREE.RingGeometry(12, 24, 48, 1, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: C.sand, side: THREE.DoubleSide }),
    );
    tier1.rotation.x = -Math.PI / 2;
    tier1.position.y = 3;
    worldGroup.add(tier1);
    addDisc(0, 0, 8, C.wood, 6);
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2, 8, 16),
      new THREE.MeshStandardMaterial({ color: C.wood }),
    );
    tower.position.set(0, 10, 0);
    worldGroup.add(tower);
    const pad = spec.pads[0];
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 0.3, 16),
      new THREE.MeshStandardMaterial({ color: C.gold, emissive: C.lit }),
    );
    disc.position.set(pad.pos[0], pad.pos[1] + 0.15, pad.pos[2]);
    worldGroup.add(disc);
  } else {
    addDisc(0, 0, 40, C.grass, 0);
  }

  const sea = new THREE.Mesh(
    new THREE.CircleGeometry(250, 64),
    new THREE.MeshStandardMaterial({ color: C.sea, roughness: 0.5, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -2.5;
  worldGroup.add(sea);
}

function buildLantern(): THREE.Group {
  const group = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: C.wood, roughness: 0.8 }),
  );
  post.position.y = 1.6;
  group.add(post);
  const cage = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.62, 1),
    new THREE.MeshStandardMaterial({ color: C.off, emissive: '#000000', roughness: 0.6 }),
  );
  cage.position.y = 3.4;
  cage.name = 'cage';
  group.add(cage);
  const light = new THREE.PointLight(C.lit, 0, 24, 2);
  light.position.y = 3.4;
  group.add(light);

  // TICKET-03: a fuel gauge above every lantern, plus a torn-paper marker
  // that distinguishes an extinguished lantern without relying on colour.
  const barBack = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.16, 0.1),
    new THREE.MeshBasicMaterial({ color: '#1B2350' }),
  );
  barBack.position.set(0, 4.25, 0);
  barBack.name = 'fuelBarBack';
  barBack.visible = false;
  group.add(barBack);
  const barFill = new THREE.Mesh(
    new THREE.BoxGeometry(1.24, 0.1, 0.12),
    new THREE.MeshBasicMaterial({ color: C.lit }),
  );
  barFill.position.set(0, 4.25, 0.02);
  barFill.name = 'fuelBarFill';
  barFill.visible = false;
  group.add(barFill);

  const tearShape = new THREE.Shape();
  tearShape.moveTo(-0.55, 0.55);
  tearShape.lineTo(0.55, 0.55);
  tearShape.lineTo(0.55, -0.1);
  tearShape.lineTo(0.2, 0.08);
  tearShape.lineTo(-0.05, -0.42);
  tearShape.lineTo(-0.32, -0.06);
  tearShape.lineTo(-0.55, -0.3);
  tearShape.closePath();
  const tear = new THREE.Mesh(
    new THREE.ShapeGeometry(tearShape),
    new THREE.MeshStandardMaterial({ color: C.off, side: THREE.DoubleSide }),
  );
  tear.position.set(0, 3.4, 0.65);
  tear.name = 'tear';
  tear.visible = false;
  group.add(tear);
  return group;
}

// ---------------------------------------------------------------- game flow
type Phase = 'menu' | 'intro' | 'play' | 'result' | 'dawn' | 'bench';
let phase: Phase = 'menu';
let nightChoice: 1 | 2 | 3 = 1;
let totalScore = 0;
const wonNights = new Set<number>();
let world: World | null = null;
let pausePulse = false;
let bench: {
  start: number;
  warmupMs: number;
  durationMs: number;
  frames: number[];
  firstFrame: boolean;
  result: unknown;
} | null = null;
let shakeTicks = 0;
let shadeAlert: { id: string; tick: number } | null = null;
let yaw = 0;
let dragging = false;
const keys = new Set<string>();

const hud = document.querySelector<HTMLDivElement>('#hud')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;
const flash = document.querySelector<HTMLDivElement>('#flash')!;

function showOverlay(html: string): void {
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}
function hideOverlay(): void {
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}

// ---------------------------------------------------------------- leaderboard
function storedBoard(): Leaderboard {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    return raw ? readBoard(JSON.parse(raw)) : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

async function loadBoard(): Promise<Leaderboard> {
  try {
    const response = await fetch('/api/leaderboard');
    if (response.ok) return readBoard(await response.json());
  } catch {
    /* static build — fall back to localStorage */
  }
  return storedBoard();
}

async function saveBoardEntry(entry: LeaderboardEntry): Promise<Leaderboard> {
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
    });
    if (response.ok) return readBoard(await response.json());
  } catch {
    /* static build — fall back to localStorage */
  }
  const board = { entries: insertEntry(storedBoard().entries, entry) };
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board));
  } catch {
    /* storage unavailable */
  }
  return board;
}

function boardRows(board: Leaderboard): string {
  if (board.entries.length === 0) return '<p class="small">Chưa có điểm nào.</p>';
  return `<ol class="board">${board.entries
    .map(
      (e) =>
        `<li><b>${e.name}</b> — ${e.score} điểm · ${e.nights_won}/3 đêm · ${new Date(e.achieved_at).toLocaleDateString('vi-VN')}</li>`,
    )
    .join('')}</ol>`;
}

async function leaderboardPanel(): Promise<void> {
  const board = await loadBoard();
  showOverlay(`<div class="panel"><h2>Bảng xếp hạng</h2>${boardRows(board)}<button data-action="back">Quay lại</button></div>`);
  overlay.querySelector<HTMLButtonElement>('[data-action="back"]')!.onclick = menu;
}

function menu(): void {
  phase = 'menu';
  world = null;
  stopMusic();
  showOverlay(`
    <div class="panel">
      <h1>Đảo Đèn Lồng</h1>
      <p>Ba đêm — ba hòn đảo. Châm dầu, giữ ít nhất 60% đèn sáng tới bình minh.</p>
      <div class="row">
        ${([1, 2, 3] as const)
          .map((n) => `<button data-night="${n}">Đêm ${n} · ${NIGHTS[n].name}</button>`)
          .join('')}
      </div>
      <button data-action="settings">Cài đặt</button>
      <button data-action="leaderboard">Bảng xếp hạng</button>
      <p class="small">${controlHint()}</p>
    </div>`);
  overlay.querySelectorAll<HTMLButtonElement>('[data-night]').forEach((button) => {
    button.onclick = () => {
      nightChoice = Number(button.dataset.night) as 1 | 2 | 3;
      intro();
    };
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="settings"]')!.onclick = settingsPanel;
  overlay.querySelector<HTMLButtonElement>('[data-action="leaderboard"]')!.onclick = () => {
    void leaderboardPanel();
  };
}

function settingsPanel(): void {
  const actions = Object.keys(ACTION_LABELS) as Action[];
  const keyRows = actions
    .map(
      (action) => `<label class="keyline">${ACTION_LABELS[action]}
        <select data-key="${action}">
          ${KEY_OPTIONS.map(
            ([code, label]) =>
              `<option value="${code}" ${bindings[action] === code ? 'selected' : ''}>${label}</option>`,
          ).join('')}
        </select></label>`,
    )
    .join('');
  showOverlay(`
    <div class="panel wide">
      <h2>Cài đặt</h2>
      <label>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${volume}"></label>
      <label>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${sensitivity}"></label>
      <label><input id="cb" type="checkbox" ${colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt</label>
      <label><input id="motion" type="checkbox" ${reducedMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung/chớp)</label>
      <label><input id="big" type="checkbox" ${largeText ? 'checked' : ''}> Chữ lớn (×1.25)</label>
      <h3>Đổi phím</h3>
      <div class="keygrid">${keyRows}</div>
      <p id="key-error" class="error" aria-live="polite"></p>
      <button data-action="reset-keys">Khôi phục mặc định</button>
      <button data-action="back">Quay lại</button>
    </div>`);
  const vol = overlay.querySelector<HTMLInputElement>('#vol')!;
  const sens = overlay.querySelector<HTMLInputElement>('#sens')!;
  const cb = overlay.querySelector<HTMLInputElement>('#cb')!;
  const motion = overlay.querySelector<HTMLInputElement>('#motion')!;
  const big = overlay.querySelector<HTMLInputElement>('#big')!;
  const error = overlay.querySelector<HTMLParagraphElement>('#key-error')!;
  vol.oninput = () => {
    volume = Number(vol.value);
    saveSettings();
  };
  sens.oninput = () => {
    sensitivity = Number(sens.value);
    saveSettings();
  };
  cb.onchange = () => {
    colorblind = cb.checked;
    saveSettings();
  };
  motion.onchange = () => {
    reducedMotion = motion.checked;
    applyAccessibility();
    saveSettings();
  };
  big.onchange = () => {
    largeText = big.checked;
    applyAccessibility();
    saveSettings();
  };
  overlay.querySelectorAll<HTMLSelectElement>('select[data-key]').forEach((select) => {
    select.onchange = () => {
      const action = select.dataset.key as Action;
      const code = select.value;
      const clash = actions.find((other) => other !== action && bindings[other] === code);
      if (clash) {
        select.value = bindings[action];
        error.textContent = `Phím ${code} đang dùng cho "${ACTION_LABELS[clash]}". Chọn phím khác.`;
        return;
      }
      error.textContent = '';
      bindings[action] = code;
      saveSettings();
      hint.textContent = controlHint();
    };
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="reset-keys"]')!.onclick = () => {
    bindings = { ...DEFAULT_BINDINGS };
    saveSettings();
    settingsPanel();
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="back"]')!.onclick = menu;
}

function controlHint(): string {
  return `${keyLabel('forward')}${keyLabel('left')}${keyLabel('back')}${keyLabel('right')} di chuyển · ${keyLabel('jump')} nhảy · ${keyLabel('dash')} lướt · ${keyLabel('interact')} nạp đèn · ${keyLabel('pulse')} tỏa sáng · ${keyLabel('pause')} tạm dừng`;
}

function intro(): void {
  phase = 'intro';
  const spec = NIGHTS[nightChoice];
  showOverlay(`
    <div class="panel">
      <h2>Đêm ${nightChoice} — ${spec.name}</h2>
      <p style="color:${C.gold}">Ông Đăng: "Cầm lấy ngọn lửa này. ${spec.lanterns.length} ngọn đèn đang chờ, và sương đêm không chờ ai."</p>
      <button data-action="start">Bắt đầu</button>
      <button data-action="menu">Về menu</button>
    </div>`);
  overlay.querySelector<HTMLButtonElement>('[data-action="start"]')!.onclick = () => startNight(nightChoice);
  overlay.querySelector<HTMLButtonElement>('[data-action="menu"]')!.onclick = menu;
}

function startNight(night: 1 | 2 | 3): void {
  world = createWorld({ seed: 7, night, totalScore });
  totalScore = world.totalScore;
  yaw = 0;
  pausePulse = false;
  prevJump = false;
  prevCountdown = 11;
  phase = 'play';
  buildMap(world.spec);
  hideOverlay();
  startMusic();
  beep(660, 0.2);
}

function result(): void {
  if (!world) return;
  stopMusic();
  const finished = world;
  const won = finished.state === 'won';
  if (won) wonNights.add(finished.night);
  phase = won ? (finished.night === 3 ? 'dawn' : 'result') : 'result';
  const title = won ? `Đêm ${finished.night} sáng rồi` : `Đêm ${finished.night} chưa xong`;
  const text = won
    ? `Điểm đêm này: ${finished.score} · Tổng: ${finished.totalScore}`
    : 'Ngọn lửa tắt, hoặc trời đã sáng. Thử lại đêm này nhé.';
  const buttons =
    phase === 'dawn'
      ? `<button data-action="menu">Về menu</button>`
      : won
        ? `<button data-action="next">Đêm tiếp theo</button><button data-action="replay">Chơi lại</button>`
        : `<button data-action="replay">Chơi lại đêm này</button><button data-action="menu">Về menu</button>`;
  showOverlay(`
    <div class="panel">
      <h1>${phase === 'dawn' ? 'Bình Minh' : title}</h1>
      <p>${text}</p>
      <div class="score-form">
        <label for="player-name">Tên (3–12 ký tự)</label>
        <input id="player-name" maxlength="12" placeholder="TenCuaBan" autocomplete="off">
        <button data-action="save-score">Lưu điểm</button>
        <button data-action="board">Bảng xếp hạng</button>
        <p id="score-error" class="error" aria-live="polite"></p>
      </div>
      ${buttons}
    </div>`);
  const nameInput = overlay.querySelector<HTMLInputElement>('#player-name')!;
  const scoreError = overlay.querySelector<HTMLParagraphElement>('#score-error')!;
  overlay.querySelector<HTMLButtonElement>('[data-action="save-score"]')!.onclick = () => {
    const name = nameInput.value.trim();
    if (!isValidName(name)) {
      scoreError.textContent = 'Tên phải có 3–12 ký tự chữ/số/gạch dưới.';
      return;
    }
    const entry: LeaderboardEntry = {
      name,
      score: finished.totalScore,
      nights_won: wonNights.size,
      achieved_at: new Date().toISOString(),
      seed: 7,
    };
    void saveBoardEntry(entry).then(() => {
      scoreError.textContent = '';
      void leaderboardPanel();
    });
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="board"]')!.onclick = () => {
    void leaderboardPanel();
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener('click', () => {
    nightChoice = Math.min(3, finished.night + 1) as 1 | 2 | 3;
    intro();
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="replay"]')?.addEventListener('click', () => {
    startNight(finished.night);
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="menu"]')?.addEventListener('click', menu);
}

function pausePanel(): void {
  showOverlay(`
    <div class="panel">
      <h2>Tạm dừng</h2>
      <button data-action="resume">Tiếp tục</button>
      <button data-action="replay">Chơi lại đêm</button>
      <button data-action="settings">Cài đặt</button>
      <button data-action="menu">Về menu</button>
    </div>`);
  overlay.querySelector<HTMLButtonElement>('[data-action="resume"]')!.onclick = () => {
    pausePulse = true;
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="replay"]')!.onclick = () => {
    startNight(world!.night);
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="settings"]')!.onclick = settingsPanel;
  overlay.querySelector<HTMLButtonElement>('[data-action="menu"]')!.onclick = menu;
}

function readInput(): InputState {
  const forward = (keys.has(bindings.forward) ? 1 : 0) - (keys.has(bindings.back) ? 1 : 0);
  const strafe = (keys.has(bindings.right) ? 1 : 0) - (keys.has(bindings.left) ? 1 : 0);
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  let wx = fx * forward + rx * strafe;
  let wz = fz * forward + rz * strafe;
  const length = Math.hypot(wx, wz);
  if (length > 1) {
    wx /= length;
    wz /= length;
  }
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const pause = pausePulse || keys.has(bindings.pause);
  pausePulse = false;
  return {
    move: [wx * cos - wz * sin, wx * sin + wz * cos],
    camYawDeg: (yaw * 180) / Math.PI,
    jump: keys.has(bindings.jump),
    interact: keys.has(bindings.interact),
    pulse: keys.has(bindings.pulse),
    dash: keys.has(bindings.dash),
    pause,
  };
}

// ---------------------------------------------------------------- scene sync
function syncScene(w: World): void {
  const p = w.player;
  playerMesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
  playerMesh.rotation.y = (p.facingDeg * Math.PI) / 180;
  (body.material as THREE.MeshStandardMaterial).emissive.set(
    p.invuln > 0 ? C.danger : '#000000',
  );

  // TICKET-03: ambient light follows remaining fuel, so lamps going out
  // visibly darkens the island.
  const totalFuel = w.lanterns.reduce((sum, l) => sum + (l.lit ? l.fuel / FUEL_MAX_UNITS : 0), 0);
  ambient.intensity = 0.15 + 0.55 * (totalFuel / w.lanterns.length);
  // TICKET-04: reduced motion also turns off the low-fuel blink; the white
  // (or colour-blind) bar and the ⚠ subtitle still carry the warning.
  const lowPulse = reducedMotion ? true : Math.floor(w.tick / 30) % 2 === 0; // 1 Hz blink

  for (const lantern of w.lanterns) {
    let group = meshCache.lanterns.get(lantern.id);
    if (!group) {
      group = buildLantern();
      meshCache.lanterns.set(lantern.id, group);
      worldGroup.add(group);
    }
    group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);
    const fuelRatio = Math.max(0, Math.min(1, lantern.fuel / FUEL_MAX_UNITS));
    const weak = lantern.lit && fuelRatio * 100 < TUNING.low_fuel_threshold;
    const visible = !weak || lowPulse;
    const cage = group.getObjectByName('cage') as THREE.Mesh;
    const material = cage.material as THREE.MeshStandardMaterial;
    material.color.set(lantern.lit ? C.lit : C.off);
    material.emissive.set(lantern.lit ? C.lit : '#000000');
    material.emissiveIntensity = visible && lantern.lit ? 2 : 0;
    const light = group.children.find((child) => child instanceof THREE.PointLight) as THREE.PointLight;
    light.intensity = visible && lantern.lit ? 16 * (0.5 + 0.5 * fuelRatio) : 0;

    group.scale.y = lantern.lit ? 1 : 0.8; // extinguished lantern collapses 20%
    const tear = group.getObjectByName('tear') as THREE.Mesh;
    tear.visible = !lantern.lit;
    const barBack = group.getObjectByName('fuelBarBack') as THREE.Mesh;
    const barFill = group.getObjectByName('fuelBarFill') as THREE.Mesh;
    barBack.visible = lantern.lit;
    barFill.visible = lantern.lit && visible;
    barFill.scale.x = fuelRatio;
    barFill.position.x = -(1 - fuelRatio) * 0.62;
    (barFill.material as THREE.MeshBasicMaterial).color.set(weak ? warningColor() : C.lit);
  }

  for (const mote of w.motes) {
    let mesh = meshCache.motes.get(mote.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeometry, mote.kind === 'dropped' ? droppedMaterial : moteMaterial);
      meshCache.motes.set(mote.id, mesh);
      worldGroup.add(mesh);
    }
    mesh.position.set(mote.pos[0], mote.pos[1] + 1 + Math.sin(w.tick * 0.05 + mote.pos[0]) * 0.2, mote.pos[2]);
  }
  for (const [id, mesh] of meshCache.motes) {
    if (!w.motes.some((mote) => mote.id === id)) {
      worldGroup.remove(mesh);
      meshCache.motes.delete(id);
    }
  }

  for (const shade of w.shades) {
    let mesh = meshCache.shades.get(shade.id);
    if (!mesh) {
      mesh = new THREE.Mesh(shadeGeometry, shadeMaterial.clone());
      // Eyes use the same accent as the rim so both change with the palette.
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 8, 8),
          new THREE.MeshBasicMaterial({ color: C.shadeEdge }),
        );
        eye.position.set(side * 0.25, 0.15, 0.72);
        mesh.add(eye);
      }
      meshCache.shades.set(shade.id, mesh);
      worldGroup.add(mesh);
    }
    mesh.position.set(shade.pos[0], shade.pos[1] + 1, shade.pos[2]);
    const accent = colorblind ? C.shadeEdgeColorblind : C.shadeEdge;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.set(shade.state === 'stunned' ? C.stunned : C.shade);
    material.emissive.set(shade.state === 'stunned' ? C.stunned : accent);
    for (const child of mesh.children) {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
        child.material.color.set(accent);
      }
    }
  }

  for (const drifter of w.drifters) {
    let mesh = meshCache.drifters.get(drifter.id);
    if (!mesh) {
      mesh = new THREE.Mesh(drifterGeometry, drifterMaterial);
      meshCache.drifters.set(drifter.id, mesh);
      worldGroup.add(mesh);
    }
    mesh.visible = drifter.state !== 'removed';
    mesh.position.set(drifter.pos[0], drifter.pos[1], drifter.pos[2]);
    mesh.rotation.y = (w.tick * 0.03) % (Math.PI * 2);
  }

  for (const charm of w.charms) {
    let mesh = meshCache.charms.get(charm.id);
    if (!mesh) {
      mesh = new THREE.Mesh(charmGeometry, charmMaterial);
      meshCache.charms.set(charm.id, mesh);
      worldGroup.add(mesh);
    }
    mesh.visible = charm.available;
    mesh.position.set(charm.pos[0], charm.pos[1] + 1, charm.pos[2]);
    mesh.rotation.y = w.tick * 0.02;
  }
}

function fmtTime(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function updateHud(w: World): void {
  const time = fmtTime(w.timeLeft);
  const danger = w.timeLeft <= 30;
  const p = w.player;
  // TICKET-03: capacity grows with successful lights, up to 20.
  const bars = Array.from({ length: p.capacity }, (_, i) =>
    i < p.carried ? '■' : '□',
  ).join('');
  const accepting = w.lanterns.filter(
    (l) => !l.lit || l.fuel < FUEL_MAX_UNITS,
  );
  const nearest = accepting
    .map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) }))
    .sort((a, b) => a.d - b.d)[0];
  const near = nearest && nearest.d <= TUNING.interact_radius;
  const lit = w.lanterns.filter((l) => l.lit).length;
  const needed = Math.ceil(TUNING.win_ratio * w.lanterns.length);
  const warn = colorblind ? '⚠ ' : '';
  const nearestText = near
    ? nearest.l.lit
      ? `${keyLabel('interact')} — Châm dầu (${p.carried} mang, đèn ${(nearest.l.fuel / FUEL_MAX_UNITS * 100).toFixed(0)}%)`
      : `${keyLabel('interact')} — ${nearest.l.ever_lit ? 'Thắp lại' : 'Thắp đèn'} (${p.carried}/${nearest.l.ever_lit ? TUNING.relight_cost : TUNING.lantern_cost})`
    : '';
  let subtitle = '';
  if (shadeAlert && w.tick - shadeAlert.tick <= 180) {
    subtitle = `${warn}Bóng Mực xuất hiện!`;
  } else if (w.wind.warning) {
    subtitle = `${warn}Gió sắp thổi!`;
  } else if (w.lanterns.some((l) => l.lit && l.fuel < TUNING.low_fuel_threshold * 60)) {
    subtitle = `${warn}Đèn sắp hết dầu!`;
  } else if (w.timeLeft <= 10) {
    subtitle = `${warn}10 giây cuối!`;
  }
  const edgeArrow = shadeAlert && w.tick - shadeAlert.tick <= 180
    ? shadeArrow(w, shadeAlert.id)
    : '';
  hud.innerHTML = `
    <div class="top">
      <div class="flames">${'🔥'.repeat(Math.max(0, p.flames))}${'✕'.repeat(Math.max(0, TUNING.flames - p.flames))}</div>
      <div class="clock ${danger ? 'blink' : ''}" style="color:${danger ? warningColor() : C.text}">${warn}${time}</div>
      <div class="score">Đèn ${lit}/${w.lanterns.length} · cần ${needed} · ${w.score}</div>
    </div>
    <div class="bottom">
      <div class="motes">${bars} ${p.carried}/${p.capacity}</div>
      <div class="cooldowns">Lướt ${(p.dashCd / 60).toFixed(1)}s · Tỏa sáng ${(p.pulseCd / 60).toFixed(1)}s</div>
    </div>
    ${near ? `<div class="prompt">${nearestText}</div>` : ''}
    ${nearest && nearest.d > TUNING.interact_radius ? `<div class="arrow">➤ Đèn nhận dầu gần nhất ${nearest.d.toFixed(0)}m</div>` : ''}
    ${subtitle ? `<div class="subtitle" style="color:${warningColor()}">${subtitle}</div>` : ''}
    ${edgeArrow}`;
  hint.textContent = controlHint();
}

/** TICKET-04: point at the shade that just spawned, clamped to the screen edge. */
function shadeArrow(w: World, id: string): string {
  const shade = w.shades.find((s) => s.id === id);
  if (!shade) return '';
  const ndc = new THREE.Vector3(shade.pos[0], shade.pos[1] + 1, shade.pos[2]).project(camera);
  const width = window.innerWidth;
  const height = window.innerHeight;
  let dx = (ndc.x * 0.5 + 0.5) * width - width / 2;
  let dy = (-ndc.y * 0.5 + 0.5) * height - height / 2;
  if (ndc.z > 1) {
    dx = -dx;
    dy = -dy;
  }
  const scale = Math.min(
    (width / 2 - 50) / Math.max(1, Math.abs(dx)),
    (height / 2 - 50) / Math.max(1, Math.abs(dy)),
    1,
  );
  const x = width / 2 + dx * scale;
  const y = height / 2 + dy * scale;
  const rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
  return `<div class="edge-arrow" style="left:${x}px;top:${y}px;transform:translate(-50%,-50%) rotate(${rotation}deg);color:${warningColor()}">➤</div>`;
}

function updateCamera(w: World): void {
  if (bench) {
    // TICKET-04: fixed bench orbit — radius 30 m, height 15 m, 15 s per turn,
    // starting at (30, 15, 0) and turning counter-clockwise from above.
    const theta = ((performance.now() - bench.start) / 15000) * Math.PI * 2;
    camera.position.set(30 * Math.cos(theta), 15, -30 * Math.sin(theta));
    camera.lookAt(0, 0, 0);
    return;
  }
  const distance = 9;
  const height = 5;
  camera.position.set(
    w.player.pos[0] + Math.sin(yaw) * distance,
    w.player.pos[1] + height,
    w.player.pos[2] + Math.cos(yaw) * distance,
  );
  if (shakeTicks > 0 && !reducedMotion) {
    const amount = 0.14 * (shakeTicks / 12);
    camera.position.x += Math.sin(w.tick * 2.1) * amount;
    camera.position.y += Math.cos(w.tick * 2.7) * amount;
  }
  camera.lookAt(w.player.pos[0], w.player.pos[1] + 1.4, w.player.pos[2]);
}

// ---------------------------------------------------------------- listeners
window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if (event.code === bindings.pause && phase === 'play') {
    event.preventDefault();
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
renderer.domElement.addEventListener('pointerdown', () => {
  dragging = true;
});
window.addEventListener('pointerup', () => {
  dragging = false;
});
window.addEventListener('pointermove', (event) => {
  if (dragging) yaw -= event.movementX * 0.004 * sensitivity;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- bench scene
function startBench(options: { seed: number; duration: number }): void {
  const shades = Array.from({ length: 200 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 200;
    const radius = 15 + (i % 7) * 3;
    return {
      id: `B${i + 1}`,
      pos: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number],
      state: 'wander' as const,
    };
  });
  const motes = Array.from({ length: 100 }, (_, i) => {
    const angle = (i * Math.PI * 2) / 100;
    const radius = 20 + (i % 5) * 4;
    return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number];
  });
  world = createWorld({
    seed: options.seed,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], flames: 999, invuln_ticks: 999999 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      wind_enabled: false,
      motes,
      shades,
      lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }],
      time_left_s: 600,
    },
  });
  phase = 'bench';
  bench = {
    start: performance.now(),
    warmupMs: 3000,
    durationMs: options.duration * 1000,
    frames: [],
    firstFrame: false,
    result: null,
  };
  (window as unknown as Record<string, unknown>).__daoBenchFirstFrame = false;
  (window as unknown as Record<string, unknown>).__daoBenchResult = null;
  hideOverlay();
  stopMusic();
}

const idleInput: InputState = {
  move: [0, 0],
  camYawDeg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
};

function finishBench(now: number): void {
  if (!bench) return;
  const frames = bench.frames;
  const n = frames.length;
  const sum = frames.reduce((a, b) => a + b, 0) || 1;
  const k = Math.max(1, Math.ceil(0.01 * n));
  const slowest = [...frames].sort((a, b) => b - a).slice(0, k);
  const sorted = [...frames].sort((a, b) => a - b);
  const round = (value: number) => Math.round(value * 10) / 10;
  bench.result = {
    avg_fps: round((1000 * n) / sum),
    p1_low_fps: round(1000 / (slowest.reduce((a, b) => a + b, 0) / k)),
    frame_ms_p95: round(sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)] ?? 0),
    frames: n,
    load_ms: now - bench.start,
    peak_mem_mb: null,
    vsync_off: true,
    renderer: rendererName,
    os: 'browser',
  };
  (window as unknown as Record<string, unknown>).__daoBenchResult = bench.result;
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let accumulator = 0;
let pauseOverlayShown = false;
let fpsFrames = 0;
let fpsElapsed = 0;
let prevJump = false;
let prevCountdown = 11;
let lastBenchFrame = 0;

function frame(now: number): void {
  const rawFrameMs = now - last;
  const delta = Math.min(rawFrameMs / 1000, 0.25);
  last = now;

  if (phase === 'bench' && world && bench) {
    if (!bench.firstFrame) {
      bench.firstFrame = true;
      (window as unknown as Record<string, unknown>).__daoBenchFirstFrame = true;
    }
    const elapsed = now - bench.start;
    if (elapsed > bench.warmupMs && lastBenchFrame > 0 && bench.result === null) {
      bench.frames.push(rawFrameMs);
    }
    lastBenchFrame = now;
    step(world, idleInput);
    // TICKET-04: benchmark freezes gameplay — no spawns, damage, pickups,
    // fuel decay or end conditions, but shades keep their normal wander.
    world.player.flames = 999;
    world.player.invuln = 999999;
    world.player.carried = 0;
    world.player.pos = [0, 0, 0];
    world.timeLeft = 600;
    world.state = 'playing';
    world.paused = false;
    for (const lantern of world.lanterns) {
      if (lantern.lit) lantern.fuel = FUEL_MAX_UNITS;
    }
    for (const shade of world.shades) {
      if (shade.state !== 'wander') {
        shade.state = 'wander';
        shade.stateTicksLeft = 0;
        shade.targetLanternId = undefined;
      }
    }
    syncScene(world);
    updateCamera(world);
    renderer.render(scene, camera);
    if (elapsed >= bench.warmupMs + bench.durationMs && bench.result === null) {
      finishBench(now);
    }
    requestAnimationFrame(frame);
    return;
  }

  if (phase === 'play' && world && !world.paused) {
    fpsFrames += 1;
    fpsElapsed += delta;
    if (fpsFrames >= 60) {
      (window as unknown as Record<string, unknown>).__daoFps =
        Math.round((fpsFrames / fpsElapsed) * 10) / 10;
      fpsFrames = 0;
      fpsElapsed = 0;
    }
  }
  if (world && phase === 'play') {
    if (!world.paused) {
      const jumpNow = keys.has('Space');
      if (jumpNow && !prevJump && world.player.grounded) beep(740, 0.07, 'triangle');
      prevJump = jumpNow;
      const second = Math.ceil(world.timeLeft);
      if (second >= 1 && second <= 10 && second !== prevCountdown) {
        beep(880 + (10 - second) * 30, 0.09, 'square');
      }
      prevCountdown = second;
    }
    accumulator += delta;
    const tickDuration = 1 / TICKS_PER_SECOND;
    let steps = 0;
    while (accumulator >= tickDuration && steps < 5) {
      const events = step(world, readInput());
      for (const event of events) {
        const frequency = soundFor[event.name];
        if (frequency) beep(frequency, event.name === 'game_over' ? 0.4 : 0.1);
        if (event.name === 'shade_spawned') {
          shadeAlert = { id: String(event.data.id), tick: event.tick };
        }
        if (event.name === 'player_hit' && !reducedMotion) {
          shakeTicks = 12;
          flash.classList.add('on');
          window.setTimeout(() => flash.classList.remove('on'), 90);
        }
      }
      if (shakeTicks > 0) shakeTicks -= 1;
      accumulator -= tickDuration;
      steps += 1;
    }
    if (world.paused && !pauseOverlayShown) {
      pauseOverlayShown = true;
      pausePanel();
    }
    if (!world.paused) {
      pauseOverlayShown = false;
      if (overlay.style.display !== 'none' && !['menu', 'intro', 'result', 'dawn'].includes(phase)) {
        hideOverlay();
      }
    }
    if (world.state !== 'playing') result();
    syncScene(world);
    updateHud(world);
    updateCamera(world);
  } else if (world) {
    syncScene(world);
    updateCamera(world);
    hud.innerHTML = '';
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// Hooks for the FPS and Phase 4 benchmark scripts; harmless in normal play.
const globals = window as unknown as Record<string, unknown>;
globals.__daoStartNight = startNight;
globals.__daoPhase = () => phase;
globals.__daoStartBench = startBench;

applyAccessibility();
menu();
requestAnimationFrame(frame);
