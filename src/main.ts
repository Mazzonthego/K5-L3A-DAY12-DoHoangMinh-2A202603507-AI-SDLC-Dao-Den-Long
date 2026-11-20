import * as THREE from 'three';
import { ISLAND_RADIUS } from './sim/config';
import { step, TICKS_PER_SECOND } from './sim/step';
import type { InputState, World } from './sim/types';
import { createWorld } from './sim/world';

const hud = document.querySelector<HTMLDivElement>('#hud')!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.querySelector('#app')!.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#070b14');
scene.fog = new THREE.FogExp2('#070b14', 0.022);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 400);

scene.add(new THREE.HemisphereLight('#8fb6ff', '#0b1220', 0.55));
const moon = new THREE.DirectionalLight('#cfe0ff', 0.7);
moon.position.set(-30, 60, 20);
scene.add(moon);

// Island
const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 2, 2, 64),
  new THREE.MeshStandardMaterial({ color: '#23303f', roughness: 0.95 }),
);
island.position.y = -1;
scene.add(island);

const rim = new THREE.Mesh(
  new THREE.TorusGeometry(ISLAND_RADIUS, 0.35, 8, 96),
  new THREE.MeshStandardMaterial({ color: '#3d5a73', roughness: 0.8 }),
);
rim.rotation.x = Math.PI / 2;
rim.position.y = 0.02;
scene.add(rim);

const sea = new THREE.Mesh(
  new THREE.CircleGeometry(220, 64),
  new THREE.MeshStandardMaterial({ color: '#0a1626', roughness: 0.4, metalness: 0.2 }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -2.4;
scene.add(sea);

// Player
const player = new THREE.Group();
const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.35, 0.9, 6, 12),
  new THREE.MeshStandardMaterial({ color: '#e9d8a6', roughness: 0.7 }),
);
body.position.y = 0.8;
player.add(body);
const glow = new THREE.PointLight('#ffc46b', 6, 12, 2);
glow.position.y = 1.2;
player.add(glow);
scene.add(player);

// Lanterns
const lanternMeshes = new Map<string, THREE.Group>();
const lanternLights = new Map<string, THREE.PointLight>();
const lanternMaterial = new THREE.MeshStandardMaterial({
  color: '#2a2f3a',
  emissive: '#000000',
  roughness: 0.6,
});

function buildLantern(id: string): THREE.Group {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 3.2, 8), lanternMaterial);
  post.position.y = 1.6;
  group.add(post);
  const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), lanternMaterial.clone());
  cage.position.y = 3.4;
  cage.name = 'cage';
  group.add(cage);
  const light = new THREE.PointLight('#ffb35c', 0, 22, 2);
  light.position.y = 3.4;
  group.add(light);
  lanternLights.set(id, light);
  return group;
}

// Motes
const moteMaterial = new THREE.MeshStandardMaterial({
  color: '#ffe9a8',
  emissive: '#ffd166',
  emissiveIntensity: 2.2,
});
const moteGeometry = new THREE.SphereGeometry(0.16, 8, 8);
const moteMeshes = new Map<string, THREE.Mesh>();

// Shades
const shadeMaterial = new THREE.MeshStandardMaterial({
  color: '#160d24',
  emissive: '#4b1f7a',
  emissiveIntensity: 0.6,
  roughness: 1,
});
const shadeMeshes = new Map<string, THREE.Mesh>();

let world: World = createWorld({ seed: 7 });
let yaw = 0;
let dragging = false;

function syncScene(): void {
  player.position.set(world.player.pos[0], 0, world.player.pos[2]);

  for (const lantern of world.lanterns) {
    let group = lanternMeshes.get(lantern.id);
    if (!group) {
      group = buildLantern(lantern.id);
      lanternMeshes.set(lantern.id, group);
      scene.add(group);
    }
    group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);
    const cage = group.getObjectByName('cage') as THREE.Mesh;
    const material = cage.material as THREE.MeshStandardMaterial;
    material.emissive.set(lantern.lit ? '#ffb35c' : '#000000');
    material.emissiveIntensity = lantern.lit ? 2 : 0;
    lanternLights.get(lantern.id)!.intensity = lantern.lit ? 14 : 0;
  }

  for (const mote of world.motes) {
    if (!mote.active) {
      const mesh = moteMeshes.get(mote.id);
      if (mesh) mesh.visible = false;
      continue;
    }
    let mesh = moteMeshes.get(mote.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeometry, moteMaterial);
      moteMeshes.set(mote.id, mesh);
      scene.add(mesh);
    }
    mesh.visible = true;
    mesh.position.set(mote.pos[0], 1.1 + Math.sin(world.tick * 0.05 + mote.pos[0]) * 0.25, mote.pos[2]);
  }

  for (const shade of world.shades) {
    let mesh = shadeMeshes.get(shade.id);
    if (!mesh) {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16), shadeMaterial);
      shadeMeshes.set(shade.id, mesh);
      scene.add(mesh);
    }
    mesh.position.set(shade.pos[0], 1, shade.pos[2]);
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = shade.state === 'stunned' ? 1.6 : 0.6;
  }

  const lit = world.lanterns.filter((lantern) => lantern.lit).length;
  hud.textContent = [
    `Đảo Đèn Lồng — Đêm 1`,
    `Thời gian: ${world.timeLeft.toFixed(1)}s`,
    `Điểm: ${world.score}`,
    `Đom đóm mang: ${world.player.carried}`,
    `Lửa: ${world.player.flames}`,
    `Đèn đã thắp: ${lit}/${world.lanterns.length}`,
    `Trạng thái: ${world.state}`,
  ].join('\n');
}

function updateCamera(): void {
  const distance = 9;
  const height = 5;
  camera.position.set(
    world.player.pos[0] + Math.sin(yaw) * distance,
    height,
    world.player.pos[2] + Math.cos(yaw) * distance,
  );
  camera.lookAt(world.player.pos[0], 1.4, world.player.pos[2]);
}

const keys = new Set<string>();
window.addEventListener('keydown', (event) => keys.add(event.code));
window.addEventListener('keyup', (event) => keys.delete(event.code));
renderer.domElement.addEventListener('pointerdown', () => {
  dragging = true;
});
window.addEventListener('pointerup', () => {
  dragging = false;
});
window.addEventListener('pointermove', (event) => {
  if (dragging) yaw -= event.movementX * 0.004;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Camera-relative movement, converted back into the contract's input space. */
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
  return {
    move: [wx * cos - wz * sin, wx * sin + wz * cos],
    camYawDeg: (yaw * 180) / Math.PI,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyQ'),
  };
}

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const delta = Math.min((now - last) / 1000, 0.25);
  last = now;
  accumulator += delta;
  const tickDuration = 1 / TICKS_PER_SECOND;
  while (accumulator >= tickDuration) {
    step(world, readInput());
    accumulator -= tickDuration;
  }
  syncScene();
  updateCamera();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

syncScene();
updateCamera();
requestAnimationFrame(frame);
