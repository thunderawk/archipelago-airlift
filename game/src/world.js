// The world: an archipelago of islands over a flat sea, a handful of
// runways, sky rings, and drifting clouds. Also the camera math: a chase
// camera that sits at the plane and looks along its nose, with the horizon
// pitching and the whole view banking with the roll.

import { CFG, ISLANDS, RUNWAYS, RALLY_RINGS, COLORS } from './config.js';
import { makeRng, range, falloff, clamp, degToRad } from './random.js';

// Terrain height at a map point: the tallest island hill under it, or the
// sea at 0. Smooth falloff so the beach meets the water. Under every
// runway the ground is flattened to a coastal apron (pad height 8 m), so
// a strip is landable instead of a hilltop.
export function terrainHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d = Math.hypot(dx, dz);
    if (d < isl.r) h = Math.max(h, isl.hill * falloff(d, isl.r));
  }
  for (const rw of RUNWAY_GEOMS) {
    const dx = x - rw.centre.x;
    const dz = z - rw.centre.z;
    const along = dx * rw.forward.x + dz * rw.forward.z;
    const across = dx * -rw.forward.z + dz * rw.forward.x;
    const ca = clamp(along, -rw.length / 2, rw.length / 2);
    const d = Math.hypot(along - ca, across);
    if (d < 450) {
      const s = clamp((450 - d) / 450, 0, 1);
      const smooth = s * s * (3 - 2 * s);
      h = h * (1 - smooth) + RUNWAY_PAD_Y * smooth;
    }
  }
  return h;
}

export const RUNWAY_PAD_Y = 8;

// Runway geometry in world space: centre, heading, corners, and the two
// threshold ends. The runway sits on its island at a small pad height.
export function runwayGeometry(runway) {
  const isl = ISLANDS[runway.island];
  const h = degToRad(runway.heading);
  const fx = Math.sin(h);
  const fz = -Math.cos(h);
  const rx = Math.cos(h);
  const rz = Math.sin(h);
  const half = runway.length / 2;
  const hw = runway.width / 2;
  // The strip sits on its flattened apron, not on the island's hill.
  const y = RUNWAY_PAD_Y;
  const corner = (along, across) => ({
    x: isl.x + fx * along + rx * across,
    y,
    z: isl.z + fz * along + rz * across,
  });
  return {
    centre: { x: isl.x, y, z: isl.z },
    heading: runway.heading,
    name: runway.name,
    length: runway.length,
    width: runway.width,
    corners: [corner(-half, -hw), corner(half, -hw), corner(half, hw), corner(-half, hw)],
    // threshold ends, for landing detection
    start: { x: isl.x - fx * half, z: isl.z - fz * half },
    end: { x: isl.x + fx * half, z: isl.z + fz * half },
    forward: { x: fx, z: fz },
  };
}

export const RUNWAY_GEOMS = RUNWAYS.map(runwayGeometry);

// Rings for the rally, with a fixed radius and a facing leg direction.
export function rallyRings() {
  return RALLY_RINGS.map((r, i) => {
    const next = RALLY_RINGS[(i + 1) % RALLY_RINGS.length];
    const dx = next.x - r.x;
    const dz = next.z - r.z;
    const len = Math.hypot(dx, dz) || 1;
    return { ...r, radius: 55, nx: dx / len, nz: dz / len, index: i };
  });
}

// Clouds: seeded once, drift slowly with the wind.
export function makeClouds(seed) {
  const rng = makeRng(seed);
  const clouds = [];
  for (let i = 0; i < CFG.cloudCount; i++) {
    clouds.push({
      x: range(rng, -CFG.mapRadius, CFG.mapRadius),
      z: range(rng, -CFG.mapRadius, CFG.mapRadius),
      y: range(rng, CFG.cloudFloor, CFG.cloudCeiling),
      s: range(rng, 260, 700),
      puffs: Math.floor(range(rng, 3, 6)),
      drift: range(rng, 4, 9),
      seed: rng(),
    });
  }
  return clouds;
}

export function driftClouds(clouds, dt) {
  for (const c of clouds) {
    c.x += c.drift * dt;
    if (c.x > CFG.mapRadius) c.x = -CFG.mapRadius;
  }
}

// Camera frame from the plane's attitude. forward pitches with the nose;
// right stays level; up is rebuilt so the three stay orthonormal.
export function cameraFrame(heading, pitch) {
  const fx = Math.sin(heading) * Math.cos(pitch);
  const fy = Math.sin(pitch);
  const fz = -Math.cos(heading) * Math.cos(pitch);
  const rx = Math.cos(heading);
  const rz = Math.sin(heading);
  // up = right x forward, worked out by hand:
  //   (-sin h * sin p, cos p, cos h * sin p)
  const ux = -Math.sin(heading) * Math.sin(pitch);
  const uy = Math.cos(pitch);
  const uz = Math.cos(heading) * Math.sin(pitch);
  return {
    forward: { x: fx, y: fy, z: fz },
    right: { x: rx, y: 0, z: rz },
    up: { x: ux, y: uy, z: uz },
  };
}

// Project a world point into screen space. Returns null behind the camera.
export function project(cam, frame, focal, point, cx, cy) {
  const dx = point.x - cam.x;
  const dy = point.y - cam.y;
  const dz = point.z - cam.z;
  const fwd = dx * frame.forward.x + dy * frame.forward.y + dz * frame.forward.z;
  if (fwd < 40) return null;
  const rgt = dx * frame.right.x + dy * frame.right.y + dz * frame.right.z;
  const upv = dx * frame.up.x + dy * frame.up.y + dz * frame.up.z;
  const s = focal / fwd;
  return { x: cx + rgt * s, y: cy - upv * s, s, fwd };
}

// Where the horizon sits on screen for a given pitch (flat sea, far away).
export function horizonY(pitch, focal, cy) {
  return cy - Math.tan(pitch) * focal;
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}

export { COLORS };
