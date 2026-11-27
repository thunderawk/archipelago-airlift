// Archipelago Airlift — boot, game loop, screens. The game runs in one
// requestAnimationFrame loop at a fixed 60 Hz simulation step. Modes:
// menu (orbit + mission select) → briefing → fly → debrief (landed /
// crashed / done). ?shot=<name> jumps straight to a frozen pose for the
// screenshots, and ?seed=<n> replays the same clouds.

import { CFG, MISSIONS } from './config.js';
import { createInput, } from './input.js';
import { createPlane, placeOnRunway, stepPlane } from './plane.js';
import { createMission, stepMission, weatherAt, formatTime, missionObjective } from './missions.js';
import { makeClouds, driftClouds } from './world.js';
import { render } from './render.js';
import { drawHud } from './hud.js';
import { createParticles, stepParticles, spawnSmoke, spawnSpray, spawnExplosion, clearParticles } from './particles.js';
import { createAudio, startAudio, updateAudio, chimeRing, thudLanding, bangCrash, clickUi } from './audio.js';
import { shotState, menuCamera, cameraFromPlane } from './shots.js';
import { clamp } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');

const input = createInput(canvas);
const audio = createAudio();

const game = {
  mode: 'menu', // menu | briefing | fly | paused | debrief
  plane: null,
  mission: null,
  clouds: makeClouds(seed),
  particles: createParticles(),
  weather: { turbulence: 0, gust: 0, inStorm: false },
  stormFlash: 0,
  time: 0,
  width: 1280,
  height: 720,
  menuIndex: 0,
  debrief: null,
  mouseDownAt: 0,
  shotMode: !!shotName,
  shotSettled: false,
  frame: 0,
};

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  game.width = window.innerWidth;
  game.height = window.innerHeight;
  canvas.width = Math.round(game.width * dpr);
  canvas.height = Math.round(game.height * dpr);
  canvas.style.width = `${game.width}px`;
  canvas.style.height = `${game.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function startMission(missionId) {
  game.mission = createMission(missionId);
  game.plane = placeOnRunway(createPlane(), 0);
  game.plane.fuel = game.mission.def.fuel;
  clearParticles(game.particles);
  game.mode = 'briefing';
  game.briefUntil = game.time + 999; // waits for a key/click
  announce(`${game.mission.def.name}. ${game.mission.def.brief}`);
}

function beginFlying() {
  game.mode = 'fly';
  announce(`Flying — ${missionObjective(game.mission)}`);
}

function endFlight(kind, detail) {
  game.mode = 'debrief';
  game.debrief = { kind, detail, score: game.mission.score, time: game.mission.elapsed };
  announce(detail);
}

// --- Menus ---------------------------------------------------------------
function drawMenu() {
  const { width, height } = game;
  const camera = menuCamera(game.time);
  render(ctx, {
    width, height, time: game.time, camera,
    plane: game.plane || placeOnRunway(createPlane(), 0),
    mission: game.mission || createMission('rally'),
    clouds: game.clouds, particles: game.particles,
    weather: { inStorm: false }, stormFlash: 0,
  });

  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(6, 18, 30, 0.55)';
  ctx.fillRect(0, height * 0.07, width, 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.fillText('ARCHIPELAGO AIRLIFT', width / 2, height * 0.07 + 62);
  ctx.fillStyle = '#ffc857';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('One island-hopper. Three sorties. Fly the whole archipelago.', width / 2, height * 0.07 + 100);

  // Mission cards.
  const cardW = 300;
  const cardH = 160;
  const gap = 28;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (width - totalW) / 2;
  const y0 = height * 0.30;
  MISSIONS.forEach((m, i) => {
    const x = x0 + i * (cardW + gap);
    const selected = i === game.menuIndex;
    ctx.fillStyle = selected ? 'rgba(255, 176, 46, 0.92)' : 'rgba(8, 20, 32, 0.72)';
    roundRect(ctx, x, y0, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffffff' : 'rgba(234,246,255,0.35)';
    ctx.lineWidth = selected ? 3 : 1;
    ctx.stroke();
    ctx.fillStyle = selected ? '#1a2a3a' : '#ffffff';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText(m.name, x + cardW / 2, y0 + 38);
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = selected ? '#3a4a5a' : '#ffc857';
    ctx.fillText(m.tag, x + cardW / 2, y0 + 64);
    ctx.font = '400 14px/1.5 system-ui, sans-serif';
    ctx.fillStyle = selected ? '#2a3a4a' : 'rgba(234, 246, 255, 0.85)';
    wrapText(ctx, m.brief, x + cardW / 2, y0 + 88, cardW - 36, 18);
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('← → pick a sortie · Enter to fly · W/S throttle · Arrows steer · hold mouse to steer · G gear · F flaps', width / 2, height - 56);
  ctx.fillStyle = 'rgba(234, 246, 255, 0.7)';
  ctx.font = '400 13px system-ui, sans-serif';
  ctx.fillText('A game built for make.fun — no network, no account, just flying.', width / 2, height - 30);
}

function drawBriefing() {
  const { width, height } = game;
  const camera = cameraFromPlane(game.plane);
  render(ctx, {
    width, height, time: game.time, camera,
    plane: game.plane, mission: game.mission,
    clouds: game.clouds, particles: game.particles,
    weather: { inStorm: false }, stormFlash: 0,
  });
  drawHud(ctx, { ...game, plane: game.plane, mission: game.mission });
  const m = game.mission.def;
  ctx.fillStyle = 'rgba(6, 18, 30, 0.72)';
  roundRect(ctx, width / 2 - 330, height / 2 - 130, 660, 260, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(m.name, width / 2, height / 2 - 82);
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 17px/1.6 system-ui, sans-serif';
  wrapText(ctx, m.brief, width / 2, height / 2 - 44, 580, 26);
  ctx.fillStyle = '#7be495';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Press Enter or click to take off', width / 2, height / 2 + 104);
}

function drawDebrief() {
  const { width, height } = game;
  const camera = cameraFromPlane(game.plane);
  render(ctx, {
    width, height, time: game.time, camera,
    plane: game.plane, mission: game.mission,
    clouds: game.clouds, particles: game.particles,
    weather: game.weather, stormFlash: 0,
  });
  const d = game.debrief;
  const title = d.kind === 'done' ? 'SORTIE COMPLETE' : d.kind === 'crashed' ? 'CRASHED' : 'SORTIE OVER';
  ctx.fillStyle = 'rgba(6, 18, 30, 0.78)';
  roundRect(ctx, width / 2 - 320, height / 2 - 140, 640, 280, 14);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = d.kind === 'done' ? '#7be495' : d.kind === 'crashed' ? '#ff6b5e' : '#ffc857';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillText(title, width / 2, height / 2 - 88);
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 17px/1.6 system-ui, sans-serif';
  wrapText(ctx, d.detail, width / 2, height / 2 - 48, 560, 26);
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillText(`SCORE ${d.score}   ·   TIME ${formatTime(d.time)}`, width / 2, height / 2 + 44);
  ctx.fillStyle = '#ffc857';
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.fillText('Enter — fly again · M — mission select', width / 2, height / 2 + 96);
}

// --- Simulation -----------------------------------------------------------
function simulate(dt) {
  const ctrl = input.poll();
  const plane = game.plane;
  const mission = game.mission;

  if (input.consume('gearPressed') && !plane.onGround) {
    plane.gear = !plane.gear;
    clickUi(audio);
  }
  if (input.consume('flapsPressed')) {
    plane.flaps = !plane.flaps;
    clickUi(audio);
  }
  if (input.consume('pausePressed')) {
    game.mode = 'paused';
    return;
  }

  // Wheel throttle: a flick sets an absolute throttle.
  if (input.state.throttleSet == null && Math.abs(ctrl.throttleDelta) > 0) {
    plane.throttle = clamp(plane.throttle + ctrl.throttleDelta * dt * 0.9, 0, 1);
    ctrl.throttleDelta = 0;
  }
  if (input.state.wheelStamp && game.time * 1000 - input.state.wheelStamp < 120) {
    plane.throttle = clamp(plane.throttle + (input.state.throttleDelta > 0 ? 0.06 : -0.06), 0, 1);
  }

  const weather = weatherAt(mission, plane);
  game.weather = weather;
  if (weather.inStorm && Math.random() < dt * 0.12) {
    game.stormFlash = 1;
  }
  game.stormFlash = Math.max(0, game.stormFlash - dt * 2.2);

  const wasLanded = plane.landed;
  const wasCrashed = plane.crashed;
  stepPlane(plane, ctrl, dt, weather);

  // Touchdown smoke and spray.
  if (plane.onGround && plane.speed > 12 && Math.random() < dt * 20) {
    spawnSmoke(game.particles, plane.x, plane.y, plane.z, 1, 4);
  }
  if (!wasLanded && plane.landed) {
    thudLanding(audio);
    spawnSmoke(game.particles, plane.x, plane.y, plane.z, 10, 8);
  }
  if (!wasCrashed && plane.crashed) {
    bangCrash(audio);
    spawnExplosion(game.particles, plane.x, plane.y + 4, plane.z);
    endFlight('crashed', plane.crashReason || 'The flight ended in the sea.');
    return;
  }

  const event = stepMission(mission, plane, dt);
  if (event === 'ring') chimeRing(audio);
  if (event === 'landed') thudLanding(audio);
  if (event === 'delivered') chimeRing(audio);
  if (event === 'done') {
    chimeRing(audio);
    endFlight('done', missionObjective(mission) + ' — well flown.');
    return;
  }
  if (event === 'failed') {
    endFlight('failed', mission.message || 'The sortie failed.');
    return;
  }

  driftClouds(game.clouds, dt);
  stepParticles(game.particles, dt);
  updateAudio(audio, plane, dt);
}

// --- Main loop ------------------------------------------------------------
let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.time += dt;
  game.frame++;

  if (game.shotMode) {
    // Frozen pose: the clouds drift a little so the frame settles, but the
    // plane is never simulated — the pose is the picture.
    if (!game.shotSettled) {
      for (let i = 0; i < 40; i++) driftClouds(game.clouds, STEP);
      game.shotSettled = true;
    }
    if (shotName === 'start') {
      drawMenu();
    } else {
      const camera = cameraFromPlane(game.plane);
      render(ctx, {
        width: game.width, height: game.height, time: 3.2,
        camera, plane: game.plane, mission: game.mission,
        clouds: game.clouds, particles: game.particles,
        weather: game.weather, stormFlash: game.stormFlash,
        showRings: shotName === 'flight',
      });
      drawHud(ctx, { ...game, plane: game.plane, mission: game.mission });
    }
    requestAnimationFrame(frame);
    return;
  }

  if (game.mode === 'menu') {
    handleMenuKeys();
    driftClouds(game.clouds, dt);
    drawMenu();
  } else if (game.mode === 'briefing') {
    handleBriefingKeys();
    drawBriefing();
  } else if (game.mode === 'fly') {
    acc += dt;
    while (acc >= STEP) {
      simulate(STEP);
      acc -= STEP;
      if (game.mode !== 'fly') break;
    }
    if (game.mode === 'fly') {
      const camera = cameraFromPlane(game.plane);
      render(ctx, {
        width: game.width, height: game.height, time: game.time,
        camera, plane: game.plane, mission: game.mission,
        clouds: game.clouds, particles: game.particles,
        weather: game.weather, stormFlash: game.stormFlash,
        showRings: true,
      });
      drawHud(ctx, { ...game, plane: game.plane, mission: game.mission });
    }
  } else if (game.mode === 'paused') {
    if (input.consume('pausePressed') || input.state.anyKey) {
      input.state.anyKey = false;
      game.mode = 'fly';
    }
    const camera = cameraFromPlane(game.plane);
    render(ctx, {
      width: game.width, height: game.height, time: game.time,
      camera, plane: game.plane, mission: game.mission,
      clouds: game.clouds, particles: game.particles,
      weather: game.weather, stormFlash: 0,
    });
    drawHud(ctx, { ...game, plane: game.plane, mission: game.mission });
    ctx.fillStyle = 'rgba(6, 18, 30, 0.6)';
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', game.width / 2, game.height / 2);
  } else if (game.mode === 'debrief') {
    handleDebriefKeys();
    driftClouds(game.clouds, dt);
    stepParticles(game.particles, dt);
    drawDebrief();
  }

  requestAnimationFrame(frame);
}

function handleMenuKeys() {
  const keys = input.keys;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) {
    game.menuIndex = (game.menuIndex + 2) % 3;
    keys.delete('ArrowLeft');
    keys.delete('KeyA');
    clickUi(audio);
  }
  if (keys.has('ArrowRight') || keys.has('KeyD')) {
    game.menuIndex = (game.menuIndex + 1) % 3;
    keys.delete('ArrowRight');
    keys.delete('KeyD');
    clickUi(audio);
  }
  if (keys.has('Enter') || input.state.anyKey && input.state.mouseActive) {
    startAudio(audio);
    keys.delete('Enter');
    input.state.anyKey = false;
    startMission(MISSIONS[game.menuIndex].id);
  }
}

function handleBriefingKeys() {
  if (input.keys.has('Enter') || input.state.anyKey) {
    startAudio(audio);
    input.keys.delete('Enter');
    input.state.anyKey = false;
    beginFlying();
  }
}

function handleDebriefKeys() {
  if (input.keys.has('Enter')) {
    input.keys.delete('Enter');
    startMission(game.mission.id);
  }
  if (input.keys.has('KeyM')) {
    input.keys.delete('KeyM');
    game.mode = 'menu';
    game.mission = null;
    game.plane = null;
  }
}

function roundRect(ctx2, x, y, w, h, r) {
  ctx2.beginPath();
  ctx2.moveTo(x + r, y);
  ctx2.arcTo(x + w, y, x + w, y + h, r);
  ctx2.arcTo(x + w, y + h, x, y + h, r);
  ctx2.arcTo(x, y + h, x, y, r);
  ctx2.arcTo(x, y, x + w, y, r);
  ctx2.closePath();
}

function wrapText(ctx2, text, cx2, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [''];
  for (const w of words) {
    const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${w}` : w;
    if (ctx2.measureText(test).width > maxWidth && lines[lines.length - 1]) {
      lines.push(w);
    } else {
      lines[lines.length - 1] = test;
    }
  }
  lines.forEach((line, i) => ctx2.fillText(line, cx2, y + i * lineHeight));
}

// --- Boot -----------------------------------------------------------------
if (shotName) {
  const pose = shotState(shotName, game);
  if (pose) {
    game.plane = pose.plane;
    game.mission = pose.mission;
    game.mode = pose.mode;
    game.weather = weatherAt(game.mission, game.plane);
    if (shotName === 'storm') game.stormFlash = 0.4;
  }
} else {
  game.plane = placeOnRunway(createPlane(), 0);
  game.mission = createMission('rally');
}

canvas.addEventListener('mousedown', () => startAudio(audio));
requestAnimationFrame(frame);
