// Missions: three sorties with different goals, tracked against the same
// plane. A mission owns its objective text, its progress, its score, and
// the weather the pilot flies through.

import { CFG, MISSIONS, RALLY_RINGS } from './config.js';
import { rallyRings, RUNWAY_GEOMS } from './world.js';
import { angleDiff } from './random.js';

export function createMission(missionId) {
  const def = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
  const mission = {
    def,
    id: def.id,
    elapsed: 0,
    score: 0,
    status: 'flying', // flying | done | failed
    message: '',
    messageUntil: 0,
    // Rally state.
    rings: missionId === 'rally' ? rallyRings() : [],
    ringIndex: 0,
    ringsPassed: 0,
    // Hop state.
    hopLegs: missionId === 'hop' ? [1, 2, 0] : [],
    hopIndex: 0,
    hopLandings: 0,
    // Courier state.
    cargo: missionId === 'courier',
    delivered: false,
    // Storm cell for the courier: a cylinder of bad air on the leg from
    // home to Selatan, so the front is met mid-route.
    storm: missionId === 'courier'
      ? { x: 2000, z: 7500, r: 3200, yTop: 1400 }
      : null,
    started: false,
  };
  return mission;
}

export function missionObjective(mission) {
  if (mission.id === 'rally') {
    return `Ring ${Math.min(mission.ringIndex + 1, 8)} of 8`;
  }
  if (mission.id === 'hop') {
    const names = ['Palma', 'Karang', 'Bandar'];
    const idx = Math.min(mission.hopIndex, 2);
    return `Land at ${names[idx]}  (${mission.hopLandings}/3)`;
  }
  if (mission.id === 'courier') {
    return mission.delivered ? 'Cargo delivered — return home' : 'Deliver cargo to Selatan';
  }
  return '';
}

// Where should the pilot be heading? Used for the HUD direction arrow.
export function missionTarget(mission) {
  if (mission.id === 'rally' && mission.ringIndex < mission.rings.length) {
    const r = mission.rings[mission.ringIndex];
    return { x: r.x, y: r.y, z: r.z };
  }
  if (mission.id === 'hop') {
    const leg = mission.hopLegs[Math.min(mission.hopIndex, mission.hopLegs.length - 1)];
    const rw = RUNWAY_GEOMS[leg];
    return { x: rw.centre.x, y: rw.centre.y + 60, z: rw.centre.z };
  }
  if (mission.id === 'courier') {
    const rw = RUNWAY_GEOMS[3];
    return { x: rw.centre.x, y: rw.centre.y + 60, z: rw.centre.z };
  }
  return null;
}

// Weather at the plane: turbulence 0..1 inside the storm cell.
export function weatherAt(mission, plane) {
  if (!mission.storm) return { turbulence: 0, gust: 0, inStorm: false };
  const dx = plane.x - mission.storm.x;
  const dz = plane.z - mission.storm.z;
  const d = Math.hypot(dx, dz);
  const inside = d < mission.storm.r && plane.y < mission.storm.yTop;
  const edge = Math.max(0, 1 - d / mission.storm.r);
  return {
    turbulence: inside ? 0.35 + 0.65 * edge : 0,
    gust: inside ? 0.5 : 0,
    inStorm: inside,
  };
}

function say(mission, text, seconds = 3) {
  mission.message = text;
  mission.messageUntil = mission.elapsed + seconds;
}

// Advance the mission one step. Returns an event string for sounds/effects:
// 'ring' | 'landed' | 'delivered' | 'done' | 'failed' | null.
export function stepMission(mission, plane, dt, hooks) {
  if (mission.status !== 'flying') return null;
  mission.elapsed += dt;
  if (!mission.started && plane.speed > 5) mission.started = true;

  // Out of fuel with no runway in reach: the sortie is over.
  if (plane.fuel <= 0 && plane.speed < 8 && !plane.onGround) {
    mission.status = 'failed';
    say(mission, 'Out of fuel — the sea takes the plane', 5);
    return 'failed';
  }
  if (plane.crashed) {
    mission.status = 'failed';
    return 'failed';
  }

  if (mission.id === 'rally') {
    const ring = mission.rings[mission.ringIndex];
    if (ring) {
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      const dz = plane.z - ring.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < ring.radius) {
        mission.ringsPassed++;
        mission.ringIndex++;
        const timeBonus = Math.max(0, Math.round((mission.def.par - mission.elapsed) * 0.5));
        mission.score += CFG.ringScore + timeBonus;
        if (mission.ringIndex >= mission.rings.length) {
          mission.status = 'done';
          const under = Math.max(0, mission.def.par - mission.elapsed);
          mission.score += Math.round(under * CFG.ringTimeBonus);
          say(mission, `Rally complete in ${formatTime(mission.elapsed)}!`, 6);
          return 'done';
        }
        say(mission, `Ring ${mission.ringsPassed}/8 — nice flying`, 2.5);
        return 'ring';
      }
    }
  }

  if (mission.id === 'hop') {
    if (plane.landed && plane.onGround && plane.speed < 3) {
      const rw = RUNWAY_GEOMS[mission.hopLegs[mission.hopIndex]];
      const dx = plane.x - rw.centre.x;
      const dz = plane.z - rw.centre.z;
      const onTarget = Math.hypot(dx, dz) < rw.length * 0.7;
      if (onTarget && !mission._countedLanding) {
        mission._countedLanding = true;
        mission.hopLandings++;
        const quality = plane.touchdownQuality || 0.5;
        const gained = CFG.landingBase + Math.round(quality * CFG.landingQualityMax);
        mission.score += gained;
        plane.fuel = CFG.fuelCapacity;
        plane.damage = Math.max(0, plane.damage - 20);
        const names = ['Palma', 'Karang', 'Bandar'];
        if (mission.hopIndex >= mission.hopLegs.length - 1) {
          mission.status = 'done';
          const under = Math.max(0, mission.def.par - mission.elapsed);
          mission.score += Math.round(under * 8);
          say(mission, `Island Hop complete — ${names[mission.hopIndex]} in ${formatTime(mission.elapsed)}`, 6);
          return 'done';
        }
        say(mission, `Down safe at ${names[mission.hopIndex]} — refuelled, +${gained}`, 4);
        mission.hopIndex++;
        return 'landed';
      }
    } else if (!plane.onGround) {
      mission._countedLanding = false;
    }
  }

  if (mission.id === 'courier') {
    const rw = RUNWAY_GEOMS[3];
    const dx = plane.x - rw.centre.x;
    const dz = plane.z - rw.centre.z;
    if (mission.cargo && plane.landed && plane.onGround && Math.hypot(dx, dz) < rw.length * 0.7) {
      mission.cargo = false;
      mission.delivered = true;
      mission.score += CFG.courierBonus;
      say(mission, 'Cargo delivered — Selatan says thank you', 5);
      return 'delivered';
    }
    if (mission.delivered && plane.landed && plane.onGround) {
      const home = RUNWAY_GEOMS[0];
      const hx = plane.x - home.centre.x;
      const hz = plane.z - home.centre.z;
      if (Math.hypot(hx, hz) < home.length * 0.7) {
        mission.status = 'done';
        const under = Math.max(0, mission.def.par - mission.elapsed);
        mission.score += Math.round(under * 10);
        say(mission, `Courier complete in ${formatTime(mission.elapsed)}`, 6);
        return 'done';
      }
    }
  }

  return null;
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export { RALLY_RINGS };
