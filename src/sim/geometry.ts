import type { NightSpec, Vec3 } from './types';

export function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export function dist3(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Height of the walkable surface at (x,z), or null above open sea of clouds. */
export function groundHeight(spec: NightSpec, x: number, z: number): number | null {
  if (spec.night === 3) {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 2) return 0; // bell tower base: ground level, cannot climb
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    for (const ramp of spec.ramps ?? []) {
      if (r < ramp.inner || r > ramp.outer) continue;
      const angle = (Math.atan2(z, x) * 180) / Math.PI;
      const delta = Math.abs(((angle - ramp.angleDeg + 540) % 360) - 180);
      if (r * Math.sin((delta * Math.PI) / 180) <= 1.5) {
        return (ramp.top * (ramp.outer - r)) / (ramp.outer - ramp.inner);
      }
    }
    return 0;
  }

  for (const island of spec.islands) {
    if (Math.hypot(x - island.x, z - island.z) <= island.radius) return 0;
  }
  const bridge = spec.bridge;
  if (
    bridge &&
    x >= bridge.xMin &&
    x <= bridge.xMax &&
    z >= bridge.zMin &&
    z <= bridge.zMax
  ) {
    return 0;
  }
  return null;
}

/** Bell tower on night 3: an obstacle on the top tier. */
export function insideTower(spec: NightSpec, x: number, z: number): boolean {
  return spec.night === 3 && Math.hypot(x, z) < 2;
}

export function nearestLanternIndex(positions: Vec3[], pos: Vec3, lit: boolean[]): number {
  let best = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < positions.length; i += 1) {
    if (lit[i]) continue;
    const distance = distXZ(pos, positions[i]);
    if (distance < bestDistance || (distance === bestDistance && i < best)) {
      best = i;
      bestDistance = distance;
    }
  }
  return best;
}
