// Particles: touchdown smoke, spray off the sea, fire and debris on a
// crash. Screen-space billboards with a world anchor, so they sit in the
// scene instead of floating over the HUD.

import { makeRng, range } from './random.js';

export function createParticles() {
  return { list: [] };
}

export function spawnSmoke(particles, x, y, z, n, spread = 6) {
  for (let i = 0; i < n; i++) {
    particles.list.push({
      kind: 'smoke',
      x: x + (Math.random() - 0.5) * spread,
      y: y + Math.random() * 3,
      z: z + (Math.random() - 0.5) * spread,
      vx: (Math.random() - 0.5) * 4,
      vy: range(Math.random, 2, 6),
      vz: (Math.random() - 0.5) * 4,
      life: 0,
      max: range(Math.random, 1.2, 2.4),
      size: range(Math.random, 6, 14),
    });
  }
}

export function spawnSpray(particles, x, y, z, n) {
  for (let i = 0; i < n; i++) {
    particles.list.push({
      kind: 'spray',
      x: x + (Math.random() - 0.5) * 10,
      y,
      z: z + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 12,
      vy: range(Math.random, 4, 14),
      vz: (Math.random() - 0.5) * 12,
      life: 0,
      max: range(Math.random, 0.5, 1.1),
      size: range(Math.random, 2, 5),
    });
  }
}

export function spawnExplosion(particles, x, y, z) {
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = range(Math.random, 8, 42);
    particles.list.push({
      kind: Math.random() < 0.55 ? 'fire' : 'debris',
      x, y, z,
      vx: Math.cos(a) * sp,
      vy: range(Math.random, 2, 26),
      vz: Math.sin(a) * sp,
      life: 0,
      max: range(Math.random, 0.6, 1.8),
      size: range(Math.random, 4, 16),
    });
  }
  spawnSmoke(particles, x, y, z, 18, 10);
}

export function stepParticles(particles, dt) {
  const list = particles.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life += dt;
    if (p.life >= p.max) {
      list.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.kind === 'smoke') {
      p.vy += 1.5 * dt;
      p.size += 6 * dt;
    } else if (p.kind === 'fire') {
      p.vy -= 12 * dt;
      p.size *= 1 - 0.4 * dt;
    } else if (p.kind === 'debris') {
      p.vy -= 22 * dt;
    } else {
      p.vy -= 18 * dt;
    }
  }
  if (list.length > 400) list.splice(0, list.length - 400);
}

export function clearParticles(particles) {
  particles.list.length = 0;
}
