// The picture: sky, sun and sea, islands with beaches and hills, runways,
// sky rings, drifting clouds, the island-hopper in chase view, and the
// weather. Everything is projected from the chase camera; the world banks
// with the roll and the horizon pitches with the nose.

import { COLORS, CFG, ISLANDS } from './config.js';
import { cameraFrame, project, horizonY, RUNWAY_GEOMS } from './world.js';
import { clamp, lerp, degToRad } from './random.js';

// Sun: fixed in the sky at heading 245 deg, elevation 24 deg.
const SUN_HEADING = degToRad(245);
const SUN_ELEV = degToRad(24);

export function render(ctx, view) {
  const { width, height } = view;
  const cx = width / 2;
  const cy = height * 0.46;
  const cam = view.camera;
  const frame = cameraFrame(cam.heading, cam.pitch);
  const horizon = horizonY(cam.pitch, CFG.focal, cy);
  const roll = cam.roll;

  // --- Sky ---------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizon, 1));
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(0.62, COLORS.skyMid);
  sky.addColorStop(1, COLORS.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, Math.max(0, horizon + 2));

  // --- Sea ---------------------------------------------------------------
  const seaTop = Math.max(0, horizon);
  const sea = ctx.createLinearGradient(0, seaTop, 0, height);
  sea.addColorStop(0, COLORS.seaShallow);
  sea.addColorStop(0.35, '#1a6f8a');
  sea.addColorStop(1, COLORS.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, seaTop, width, height - seaTop);

  // Sun, projected far away in its fixed direction.
  const sunDir = {
    x: Math.sin(SUN_HEADING) * Math.cos(SUN_ELEV),
    y: Math.sin(SUN_ELEV),
    z: -Math.cos(SUN_HEADING) * Math.cos(SUN_ELEV),
  };
  const sunFar = { x: cam.x + sunDir.x * 90000, y: cam.y + sunDir.y * 90000, z: cam.z + sunDir.z * 90000 };
  const sun = project(cam, frame, CFG.focal, sunFar, cx, cy);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 220, 130, 0.55)');
    glow.addColorStop(1, 'rgba(255, 220, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
    ctx.fill();
    // Glitter path on the sea under the sun.
    if (sun.y > horizon) {
      ctx.fillStyle = 'rgba(255, 233, 168, 0.5)';
      for (let i = 0; i < 26; i++) {
        const t = i / 26;
        const yy = sun.y + t * (height - sun.y);
        const wob = Math.sin(view.time * 1.7 + i * 2.3) * 26 * (0.3 + t);
        const w = 60 * t + 8;
        ctx.fillRect(sun.x - w / 2 + wob, yy, w * (0.3 + Math.random() * 0.7), 2);
      }
    }
  }

  // --- The world banks with the roll --------------------------------------
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-roll);
  ctx.translate(-cx, -cy);

  drawIslands(ctx, view, cam, frame, cx, cy);
  drawRunways(ctx, view, cam, frame, cx, cy);
  drawRings(ctx, view, cam, frame, cx, cy);
  drawClouds(ctx, view, cam, frame, cx, cy);
  drawParticles(ctx, view, cam, frame, cx, cy);

  ctx.restore();

  // --- The aircraft, in frame --------------------------------------------
  drawPlane(ctx, view, cx, cy);

  // --- Storm --------------------------------------------------------------
  if (view.weather && view.weather.inStorm) {
    drawRain(ctx, view);
    const flash = view.stormFlash || 0;
    if (flash > 0) {
      ctx.fillStyle = `rgba(220, 235, 255, ${flash * 0.28})`;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Vignette: keeps the HUD readable and the frame filmic.
  const vig = ctx.createRadialGradient(cx, cy, height * 0.45, cx, cy, height * 0.95);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4, 12, 22, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

function drawIslands(ctx, view, cam, frame, cx, cy) {
  const projected = [];
  for (const isl of ISLANDS) {
    const p = project(cam, frame, CFG.focal, { x: isl.x, y: 0, z: isl.z }, cx, cy);
    if (!p || p.fwd > 26000) continue;
    projected.push({ isl, p });
  }
  projected.sort((a, b) => b.p.fwd - a.p.fwd);
  for (const { isl, p } of projected) {
    const rx = Math.max(2, isl.r * p.s);
    const ry = Math.max(1.5, rx * 0.34);
    if (p.x < -rx - 60 || p.x > view.width + rx + 60) continue;
    // Foam ring where the sea meets the sand.
    ctx.fillStyle = 'rgba(240, 248, 250, 0.55)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * 1.06, ry * 1.06, 0, 0, Math.PI * 2);
    ctx.fill();
    // Beach.
    ctx.fillStyle = COLORS.sand;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    // Green interior.
    ctx.fillStyle = COLORS.grass;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - ry * 0.06, rx * 0.82, ry * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hill: a darker mound rising toward the island's high side.
    const hillTop = project(cam, frame, CFG.focal, { x: isl.x, y: isl.hill, z: isl.z }, cx, cy);
    if (hillTop) {
      const hx = hillTop.x;
      const hy = hillTop.y;
      ctx.fillStyle = COLORS.hill;
      ctx.beginPath();
      ctx.ellipse(hx, hy + ry * 0.28, rx * 0.55, ry * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.hillTop;
      ctx.beginPath();
      ctx.ellipse(hx, hy + ry * 0.14, rx * 0.3, ry * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Palm dots on the green, only when close enough to see them.
    if (rx > 60) {
      ctx.fillStyle = COLORS.grassDark;
      const n = Math.floor(rx / 34);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + isl.x;
        const px = p.x + Math.cos(a) * rx * 0.55;
        const py = p.y - ry * 0.06 + Math.sin(a) * ry * 0.5;
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Name label, close only.
    if (rx > 130) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isl.name.toUpperCase(), p.x, p.y - ry - 8);
    }
  }
}

function drawRunways(ctx, view, cam, frame, cx, cy) {
  for (const rw of RUNWAY_GEOMS) {
    const pts = rw.corners.map((c) => project(cam, frame, CFG.focal, c, cx, cy));
    if (pts.some((p) => !p)) continue;
    const mid = project(cam, frame, CFG.focal, rw.centre, cx, cy);
    if (!mid || mid.fwd > 20000) continue;
    ctx.fillStyle = COLORS.asphalt;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.strokeStyle = COLORS.lineWhite;
    ctx.lineWidth = Math.max(1, 2.4 * mid.s);
    ctx.setLineDash([14 * mid.s, 12 * mid.s]);
    ctx.beginPath();
    const a = project(cam, frame, CFG.focal, { x: rw.start.x, y: rw.centre.y + 0.4, z: rw.start.z }, cx, cy);
    const b = project(cam, frame, CFG.focal, { x: rw.end.x, y: rw.centre.y + 0.4, z: rw.end.z }, cx, cy);
    if (a && b) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Runway name when close.
    if (mid.s > 0.25) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rw.name, mid.x, mid.y - 10);
    }
  }
}

function drawRings(ctx, view, cam, frame, cx, cy) {
  const mission = view.mission;
  if (!mission || mission.id !== 'rally' || !view.showRings) return;
  mission.rings.forEach((ring, i) => {
    const passed = i < mission.ringIndex;
    const isNext = i === mission.ringIndex;
    const p = project(cam, frame, CFG.focal, ring, cx, cy);
    if (!p || p.fwd > 16000) return;
    const rx = Math.max(3, ring.radius * p.s);
    const ry = Math.max(2, rx * 0.62);
    ctx.save();
    ctx.translate(p.x, p.y);
    const pulse = isNext ? 1 + 0.12 * Math.sin(view.time * 5) : 1;
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = passed ? COLORS.ringDone : isNext ? COLORS.ringNext : 'rgba(230, 240, 250, 0.75)';
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = isNext ? 22 : 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (passed) {
      ctx.strokeStyle = COLORS.ringDone;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.4, 0);
      ctx.lineTo(-rx * 0.1, ry * 0.35);
      ctx.lineTo(rx * 0.45, -ry * 0.35);
      ctx.stroke();
    }
    if (isNext) {
      ctx.fillStyle = COLORS.ringNext;
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${i + 1}`, 0, -ry - 12);
    }
    ctx.restore();
  });
}

function drawClouds(ctx, view, cam, frame, cx, cy) {
  for (const c of view.clouds) {
    const p = project(cam, frame, CFG.focal, c, cx, cy);
    if (!p || p.fwd > 24000) continue;
    const r = Math.max(4, c.s * p.s);
    const dark = view.weather && view.weather.inStorm;
    ctx.fillStyle = dark ? 'rgba(70, 80, 95, 0.75)' : 'rgba(255, 255, 255, 0.88)';
    for (let i = 0; i < c.puffs; i++) {
      const a = (i / c.puffs) * Math.PI * 2 + c.seed;
      const px = p.x + Math.cos(a) * r * 0.55;
      const py = p.y + Math.sin(a) * r * 0.16;
      const pr = r * (0.42 + 0.1 * Math.sin(c.seed * 7 + i));
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawParticles(ctx, view, cam, frame, cx, cy) {
  for (const p of view.particles.list) {
    const s = project(cam, frame, CFG.focal, p, cx, cy);
    if (!s) continue;
    const a = Math.max(0, 1 - p.life / p.max);
    const r = Math.max(1, p.size * s.s);
    if (p.kind === 'fire') {
      ctx.fillStyle = `rgba(255, ${Math.floor(140 + 90 * a)}, 40, ${a})`;
    } else if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(60, 60, 66, ${a * 0.55})`;
    } else if (p.kind === 'spray') {
      ctx.fillStyle = `rgba(235, 245, 250, ${a * 0.8})`;
    } else {
      ctx.fillStyle = `rgba(40, 40, 44, ${a})`;
    }
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// The island-hopper herself, seen from just behind and above. Drawn in
// local space, banked with the roll, pitched a touch with the nose.
function drawPlane(ctx, view, cx, cy) {
  const plane = view.plane;
  const px = cx;
  const py = cy + view.height * 0.24;
  const bank = plane ? plane.displayRoll : 0;
  const pitchShift = plane ? plane.displayPitch * 60 : 0;
  const scale = view.width / 1280;

  ctx.save();
  ctx.translate(px, py + pitchShift);
  ctx.rotate(bank * 0.9);
  ctx.scale(scale, scale);

  // Propeller discs (translucent, spinning blades).
  const spin = view.time * 34;
  for (const ex of [-62, 62]) {
    ctx.save();
    ctx.translate(ex, 8);
    ctx.fillStyle = 'rgba(220, 230, 240, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(spin);
    ctx.fillStyle = 'rgba(30, 40, 52, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Wings: long, slightly swept, with nav lights at the tips.
  ctx.fillStyle = '#e8eef2';
  ctx.beginPath();
  ctx.moveTo(-170, 26);
  ctx.quadraticCurveTo(-120, 2, -30, 6);
  ctx.lineTo(30, 6);
  ctx.quadraticCurveTo(120, 2, 170, 26);
  ctx.quadraticCurveTo(120, 34, 30, 30);
  ctx.lineTo(-30, 30);
  ctx.quadraticCurveTo(-120, 34, -170, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.arc(-168, 24, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#58d68d';
  ctx.beginPath();
  ctx.arc(168, 24, 4, 0, Math.PI * 2);
  ctx.fill();

  // Engines under the wings.
  for (const ex of [-62, 62]) {
    ctx.fillStyle = '#c8d4dc';
    ctx.beginPath();
    ctx.ellipse(ex, 16, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fuselage: rounded, widening toward the camera.
  const fus = ctx.createLinearGradient(0, -70, 0, 60);
  fus.addColorStop(0, '#f4f8fa');
  fus.addColorStop(0.55, '#dce8ee');
  fus.addColorStop(1, '#9fb4c0');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(-26, -58);
  ctx.quadraticCurveTo(-34, 10, -30, 52);
  ctx.quadraticCurveTo(0, 64, 30, 52);
  ctx.quadraticCurveTo(34, 10, 26, -58);
  ctx.quadraticCurveTo(0, -72, -26, -58);
  ctx.closePath();
  ctx.fill();

  // Livery stripe down the fuselage.
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath();
  ctx.moveTo(-27, -20);
  ctx.lineTo(27, -20);
  ctx.lineTo(29, 6);
  ctx.lineTo(-29, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff8c42';
  ctx.fillRect(-28, 6, 56, 5);

  // Tail fin with the call sign.
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(-20, -108);
  ctx.quadraticCurveTo(0, -118, 20, -108);
  ctx.lineTo(14, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ARK', 0, -82);

  // Horizontal stabilisers.
  ctx.fillStyle = '#d5e0e6';
  ctx.beginPath();
  ctx.moveTo(-52, -52);
  ctx.lineTo(52, -52);
  ctx.lineTo(40, -38);
  ctx.lineTo(-40, -38);
  ctx.closePath();
  ctx.fill();

  // Landing gear, when down.
  if (plane && plane.gear) {
    ctx.strokeStyle = '#2c3844';
    ctx.lineWidth = 4;
    for (const gx of [-18, 18]) {
      ctx.beginPath();
      ctx.moveTo(gx, 52);
      ctx.lineTo(gx, 74);
      ctx.stroke();
    }
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(-18, 78, 7, 0, Math.PI * 2);
    ctx.arc(18, 78, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawRain(ctx, view) {
  const { width, height } = view;
  ctx.strokeStyle = 'rgba(200, 215, 235, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 130; i++) {
    const x = ((i * 97.3 + view.time * 620) % (width + 60)) - 30;
    const y = (i * 53.7 + view.time * 900) % height;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 9, y + 22);
  }
  ctx.stroke();
  // Dark storm wash over the sky.
  const wash = ctx.createLinearGradient(0, 0, 0, height * 0.6);
  wash.addColorStop(0, 'rgba(30, 42, 60, 0.42)');
  wash.addColorStop(1, 'rgba(30, 42, 60, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, width, height * 0.6);
}
