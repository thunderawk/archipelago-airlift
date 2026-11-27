// Seeded random numbers, so a screenshot pose and a practice flight can be
// replayed exactly. Mulberry32: small, fast, good enough for clouds, gusts
// and ring placement jitter.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a rng.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Smoothstep falloff: 1 at the centre, 0 at the edge.
export function falloff(distance, radius) {
  const t = Math.min(1, Math.max(0, distance / radius));
  return (1 - t * t) * (1 - t * t);
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Shortest signed difference between two headings, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function radToDeg(r) {
  return (r * 180) / Math.PI;
}
