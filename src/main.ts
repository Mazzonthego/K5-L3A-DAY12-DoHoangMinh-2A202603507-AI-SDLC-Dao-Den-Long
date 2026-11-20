import * as THREE from 'three';
import { NIGHTS, TICKS_PER_SECOND, TUNING } from './sim/config';
import { step } from './sim/step';
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
  stunned: '#3A3450',
  cloth: '#E8E2D0',
  red: '#C8102E',
  gold: '#F2C14E',
  drifter: '#8FA3B8',
  danger: '#FF5A5F',
  text: '#F5F1E6',
} as const;

interface Settings {
  volume: number;
  sensitivity: number;
}

const settings: Settings = loadSettings();
let volume = settings.volume;
let sensitivity = settings.sensitivity;

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('dao-den-long-settings');
    if (raw) return { volume: 0.5, sensitivity: 1, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { volume: 0.5, sensitivity: 1 };
}

function saveSettings(): void {
  try {
    localStorage.setItem('dao-den-long-settings', JSON.stringify({ volume, sensitivity }));
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
  lantern_lit: 990,
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
  return group;
}

// ---------------------------------------------------------------- game flow
type Phase = 'menu' | 'intro' | 'play' | 'result' | 'dawn';
let phase: Phase = 'menu';
let nightChoice: 1 | 2 | 3 = 1;
let totalScore = 0;
let world: World | null = null;
let pausePulse = false;
let yaw = 0;
let dragging = false;
const keys = new Set<string>();

const hud = document.querySelector<HTMLDivElement>('#hud')!;
const hint = document.querySelector<HTMLDivElement>('#hint')!;
const overlay = document.querySelector<HTMLDivElement>('#overlay')!;

function showOverlay(html: string): void {
  overlay.innerHTML = html;
  overlay.style.display = 'flex';
}
function hideOverlay(): void {
  overlay.style.display = 'none';
  overlay.innerHTML = '';
}

function menu(): void {
  phase = 'menu';
  world = null;
  stopMusic();
  showOverlay(`
    <div class="panel">
      <h1>Đảo Đèn Lồng</h1>
      <p>Ba đêm — ba hòn đảo. Hãy thắp sáng trước bình minh.</p>
      <div class="row">
        ${([1, 2, 3] as const)
          .map((n) => `<button data-night="${n}">Đêm ${n} · ${NIGHTS[n].name}</button>`)
          .join('')}
      </div>
      <button data-action="settings">Cài đặt</button>
      <p class="small">WASD di chuyển · Space nhảy · Shift lướt · E nạp đèn · Q tỏa sáng · Esc tạm dừng</p>
    </div>`);
  overlay.querySelectorAll<HTMLButtonElement>('[data-night]').forEach((button) => {
    button.onclick = () => {
      nightChoice = Number(button.dataset.night) as 1 | 2 | 3;
      intro();
    };
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="settings"]')!.onclick = settingsPanel;
}

function settingsPanel(): void {
  showOverlay(`
    <div class="panel">
      <h2>Cài đặt</h2>
      <label>Âm lượng <input id="vol" type="range" min="0" max="1" step="0.05" value="${volume}"></label>
      <label>Độ nhạy chuột <input id="sens" type="range" min="0.2" max="3" step="0.1" value="${sensitivity}"></label>
      <button data-action="back">Quay lại</button>
    </div>`);
  const vol = overlay.querySelector<HTMLInputElement>('#vol')!;
  const sens = overlay.querySelector<HTMLInputElement>('#sens')!;
  vol.oninput = () => {
    volume = Number(vol.value);
    saveSettings();
  };
  sens.oninput = () => {
    sensitivity = Number(sens.value);
    saveSettings();
  };
  overlay.querySelector<HTMLButtonElement>('[data-action="back"]')!.onclick = menu;
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
  phase = world.state === 'won' ? (world.night === 3 ? 'dawn' : 'result') : 'result';
  const won = world.state === 'won';
  const title = won ? `Đêm ${world.night} sáng rồi` : `Đêm ${world.night} chưa xong`;
  const text = won
    ? `Điểm đêm này: ${world.score} · Tổng: ${world.totalScore}`
    : 'Ngọn lửa tắt, hoặc trời đã sáng. Thử lại đêm này nhé.';
  const buttons =
    phase === 'dawn'
      ? `<button data-action="menu">Về menu</button>`
      : won
        ? `<button data-action="next">Đêm tiếp theo</button><button data-action="replay">Chơi lại</button>`
        : `<button data-action="replay">Chơi lại đêm này</button><button data-action="menu">Về menu</button>`;
  showOverlay(`<div class="panel"><h1>${phase === 'dawn' ? 'Bình Minh' : title}</h1><p>${text}</p>${buttons}</div>`);
  overlay.querySelector<HTMLButtonElement>('[data-action="next"]')?.addEventListener('click', () => {
    nightChoice = Math.min(3, world!.night + 1) as 1 | 2 | 3;
    intro();
  });
  overlay.querySelector<HTMLButtonElement>('[data-action="replay"]')?.addEventListener('click', () => {
    startNight(world!.night);
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
  const forward = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
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
  const pause = pausePulse || keys.has('Escape') || keys.has('KeyP');
  pausePulse = false;
  return {
    move: [wx * cos - wz * sin, wx * sin + wz * cos],
    camYawDeg: (yaw * 180) / Math.PI,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyQ'),
    dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
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

  const lit = w.lanterns.filter((l) => l.lit).length;
  ambient.intensity = 0.15 + 0.55 * (lit / w.lanterns.length);

  for (const lantern of w.lanterns) {
    let group = meshCache.lanterns.get(lantern.id);
    if (!group) {
      group = buildLantern();
      meshCache.lanterns.set(lantern.id, group);
      worldGroup.add(group);
    }
    group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);
    const cage = group.getObjectByName('cage') as THREE.Mesh;
    const material = cage.material as THREE.MeshStandardMaterial;
    material.color.set(lantern.lit ? C.lit : C.off);
    material.emissive.set(lantern.lit ? C.lit : '#000000');
    material.emissiveIntensity = lantern.lit ? 2 : 0;
    const light = group.children.find((child) => child instanceof THREE.PointLight) as THREE.PointLight;
    light.intensity = lantern.lit ? 16 : 0;
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
      meshCache.shades.set(shade.id, mesh);
      worldGroup.add(mesh);
    }
    mesh.position.set(shade.pos[0], shade.pos[1] + 1, shade.pos[2]);
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.color.set(shade.state === 'stunned' ? C.stunned : C.shade);
    material.emissive.set(shade.state === 'stunned' ? C.stunned : C.shadeEdge);
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
  const bars = Array.from({ length: TUNING.carry_capacity }, (_, i) =>
    i < p.carried ? '■' : '□',
  ).join('');
  const nearest = w.lanterns
    .filter((l) => !l.lit)
    .map((l) => ({ l, d: Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) }))
    .sort((a, b) => a.d - b.d)[0];
  const near = nearest && nearest.d <= TUNING.interact_radius;
  hud.innerHTML = `
    <div class="top">
      <div class="flames">${'🔥'.repeat(Math.max(0, p.flames))}${'✕'.repeat(Math.max(0, TUNING.flames - p.flames))}</div>
      <div class="clock ${danger ? 'blink' : ''}" style="color:${danger ? C.danger : C.text}">${time}</div>
      <div class="score">Đèn ${w.lanterns.filter((l) => l.lit).length}/${w.lanterns.length} · ${w.score}</div>
    </div>
    <div class="bottom">
      <div class="motes">${bars}</div>
      <div class="cooldowns">Lướt ${(p.dashCd / 60).toFixed(1)}s · Tỏa sáng ${(p.pulseCd / 60).toFixed(1)}s</div>
    </div>
    ${near ? `<div class="prompt">E — Nạp ánh sáng (${p.carried}/${TUNING.lantern_cost})</div>` : ''}
    ${nearest && nearest.d > TUNING.interact_radius ? `<div class="arrow">➤ Đèn gần nhất ${nearest.d.toFixed(0)}m</div>` : ''}`;
  hint.textContent = 'WASD di chuyển · Space nhảy · Shift lướt · E nạp đèn · Q tỏa sáng · Esc tạm dừng';
}

function updateCamera(w: World): void {
  const distance = 9;
  const height = 5;
  camera.position.set(
    w.player.pos[0] + Math.sin(yaw) * distance,
    w.player.pos[1] + height,
    w.player.pos[2] + Math.cos(yaw) * distance,
  );
  camera.lookAt(w.player.pos[0], w.player.pos[1] + 1.4, w.player.pos[2]);
}

// ---------------------------------------------------------------- listeners
window.addEventListener('keydown', (event) => {
  keys.add(event.code);
  if ((event.code === 'Escape' || event.code === 'KeyP') && phase === 'play') {
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

// ---------------------------------------------------------------- main loop
let last = performance.now();
let accumulator = 0;
let pauseOverlayShown = false;
let fpsFrames = 0;
let fpsElapsed = 0;
let prevJump = false;
let prevCountdown = 11;

function frame(now: number): void {
  const delta = Math.min((now - last) / 1000, 0.25);
  last = now;
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
      }
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

// Hooks for the optional FPS benchmark (scripts/fps.mjs); harmless in normal play.
(window as unknown as Record<string, unknown>).__daoStartNight = startNight;
(window as unknown as Record<string, unknown>).__daoPhase = () => phase;

menu();
requestAnimationFrame(frame);
