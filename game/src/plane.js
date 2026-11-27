// The aircraft: a twin-prop island hopper. Arcade flight with real
// discipline — speed is life, bank turns the nose, pitch trades speed for
// height, and the wing quits below stall speed. Fuel and damage turn a
// sortie into decisions, not a sightseeing loop.

import { CFG } from './config.js';
import { clamp, degToRad, radToDeg, angleDiff } from './random.js';
import { terrainHeight, RUNWAY_GEOMS } from './world.js';

export function createPlane() {
  return {
    // Position and attitude.
    x: 0, y: 8, z: 0,
    heading: degToRad(90),
    pitch: 0,
    roll: 0,
    speed: 0, // m/s along the nose
    vspeed: 0, // m/s vertical
    throttle: 0,
    // Configuration.
    gear: true, // down on the runway
    flaps: false,
    // Resources.
    fuel: CFG.fuelCapacity,
    damage: 0,
    // State flags set by step().
    onGround: true,
    stalled: false,
    crashed: false,
    landed: false,
    crashReason: '',
    touchdownQuality: 0,
    // Smoothed values for the HUD and the camera.
    displayRoll: 0,
    displayPitch: 0,
  };
}

// Place the plane on a runway, ready to roll.
export function placeOnRunway(plane, runwayIndex, fuel = CFG.fuelCapacity) {
  const rw = RUNWAY_GEOMS[runwayIndex];
  const p = createPlane();
  p.x = rw.start.x;
  p.z = rw.start.z;
  p.y = rw.centre.y + 2;
  p.heading = degToRad(rw.heading);
  p.fuel = fuel;
  p.gear = true;
  p.onGround = true;
  return p;
}

// Place the plane in the air, trimmed for level flight.
export function placeInAir(plane, x, z, y, headingDeg, speed) {
  const p = createPlane();
  p.x = x;
  p.z = z;
  p.y = y;
  p.heading = degToRad(headingDeg);
  p.speed = speed;
  p.throttle = 0.62;
  p.gear = false;
  p.onGround = false;
  p.fuel = CFG.fuelCapacity;
  return p;
}

// One simulation step. ctrl: { pitch, roll, rudder, throttleDelta, throttleSet }.
export function stepPlane(plane, ctrl, dt, weather = { turbulence: 0, gust: 0 }) {
  if (plane.crashed) return plane;

  // --- Throttle -----------------------------------------------------------
  if (ctrl.throttleSet != null) plane.throttle = ctrl.throttleSet;
  plane.throttle = clamp(plane.throttle + ctrl.throttleDelta * dt * 0.9, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;

  // --- Fuel ---------------------------------------------------------------
  const burn = plane.throttle <= 0.6
    ? CFG.fuelBurnCruise * (plane.throttle / 0.6)
    : CFG.fuelBurnCruise + (CFG.fuelBurnFull - CFG.fuelBurnCruise) * ((plane.throttle - 0.6) / 0.4);
  plane.fuel = Math.max(0, plane.fuel - burn * dt);

  // --- Controls, scaled by how much air the wing is seeing ---------------
  const airspeed = clamp(plane.speed / CFG.maxSpeed, 0, 1);
  const authority = 0.25 + 0.75 * airspeed;
  const targetRoll = ctrl.roll * 1.05;
  plane.roll += (targetRoll - plane.roll) * Math.min(1, CFG.rollDamp * dt * 2.2);
  plane.roll = clamp(plane.roll, -1.1, 1.1);
  const pitchRate = -ctrl.pitch * CFG.pitchAuthority * authority;
  plane.pitch = clamp(plane.pitch + pitchRate * dt, -0.3, 0.38);
  plane.heading += plane.roll * CFG.turnRate * airspeed * dt;
  plane.heading += ctrl.rudder * 0.12 * airspeed * dt;

  // --- Turbulence ---------------------------------------------------------
  if (weather.turbulence > 0) {
    plane.roll += (Math.random() - 0.5) * weather.turbulence * dt * 1.4;
    plane.pitch += (Math.random() - 0.5) * weather.turbulence * dt * 0.5;
    plane.heading += (Math.random() - 0.5) * weather.turbulence * dt * 0.15;
    if (plane.speed > 70) {
      plane.damage = Math.min(100, plane.damage + CFG.damageStorm * dt);
    }
  }

  // --- Speed --------------------------------------------------------------
  const drag = CFG.drag * plane.speed * plane.speed * (plane.gear ? 1 + CFG.gearDrag : 1);
  const thrust = plane.throttle * CFG.accel * CFG.maxSpeed;
  const gravityAlong = -9.81 * Math.sin(plane.pitch);
  plane.speed += (thrust - drag + gravityAlong * 3.2) * dt * 0.28;
  plane.speed = clamp(plane.speed, 0, CFG.maxSpeed * 1.15);

  // --- Vertical -----------------------------------------------------------
  const lift = plane.speed > CFG.stallSpeed ? 1 : plane.speed / CFG.stallSpeed;
  const flapLift = plane.flaps ? CFG.flapLift : 1;
  let climb = Math.sin(plane.pitch) * plane.speed * lift * flapLift;
  if (plane.speed < CFG.stallSpeed) {
    // Stalled: the nose drops and the plane sinks.
    plane.stalled = true;
    plane.pitch -= 0.25 * dt;
    climb = -CFG.sinkRate * (1.6 - plane.speed / CFG.stallSpeed);
  } else {
    plane.stalled = false;
  }
  if (plane.throttle < 0.05 && plane.speed > CFG.stallSpeed) {
    climb -= CFG.sinkRate * 0.4;
  }
  // The engine can only buy so much climb: a light hopper climbs at
  // ~2,000 ft/min, never like a rocket.
  climb = clamp(climb, -14, CFG.climbRate);
  plane.vspeed = climb;
  plane.y += climb * dt;

  // --- Horizontal ---------------------------------------------------------
  const fx = Math.sin(plane.heading) * Math.cos(plane.pitch);
  const fz = -Math.cos(plane.heading) * Math.cos(plane.pitch);
  plane.x += fx * plane.speed * dt;
  plane.z += fz * plane.speed * dt;

  // --- Ground -------------------------------------------------------------
  const ground = terrainHeight(plane.x, plane.z);
  const runway = runwayUnder(plane.x, plane.z);
  const groundY = runway ? runway.centre.y : ground;
  if (plane.y <= groundY + 2) {
    if (plane.onGround) {
      plane.y = groundY + 2;
      plane.vspeed = 0;
      if (plane.speed < 2 && plane.throttle < 0.05) {
        plane.landed = true;
      }
    } else if (runway && plane.gear && Math.abs(plane.vspeed) < 4.5 && plane.speed >= CFG.minLandingSpeed && plane.speed <= CFG.maxLandingSpeed + 12) {
      // A landing that reads: flare, touchdown, rollout.
      plane.touchdownQuality = touchdownScore(plane);
      plane.onGround = true;
      plane.y = groundY + 2;
      plane.pitch = 0;
      plane.roll = 0;
      plane.vspeed = 0;
      plane.landed = true;
    } else if (runway && plane.gear && Math.abs(plane.vspeed) < 7) {
      // Hard but survivable.
      plane.damage = Math.min(100, plane.damage + CFG.damageHardLanding);
      plane.onGround = true;
      plane.y = groundY + 2;
      plane.pitch = 0;
      plane.roll = 0;
      plane.vspeed = 0;
      plane.touchdownQuality = 0.35;
      plane.landed = true;
    } else {
      crash(plane, runway ? 'Runway excursion — gear up, or far too fast' : ground > 2 ? 'Terrain strike' : 'Ditched in the sea');
    }
  } else {
    plane.onGround = false;
    plane.landed = false;
  }

  // Rolling on the ground: drag and steering.
  if (plane.onGround) {
    plane.speed = Math.max(0, plane.speed - (plane.throttle > 0.05 ? -plane.throttle * 2.2 : 9) * dt);
    if (plane.speed > 0.5) {
      plane.heading += plane.roll * 0.25 * dt;
    }
  }

  // Damage kills the airframe at 100.
  if (plane.damage >= 100 && !plane.crashed) {
    crash(plane, 'Airframe failure — damage reached 100%');
  }

  // Smooth the displayed attitude for the camera and the HUD.
  plane.displayRoll += (plane.roll - plane.displayRoll) * Math.min(1, dt * 6);
  plane.displayPitch += (plane.pitch - plane.displayPitch) * Math.min(1, dt * 6);
  return plane;
}

function crash(plane, reason) {
  plane.crashed = true;
  plane.crashReason = reason;
  plane.speed = 0;
  plane.vspeed = 0;
}

// Is the point over a runway strip (within its length and width)?
export function runwayUnder(x, z) {
  for (const rw of RUNWAY_GEOMS) {
    const dx = x - rw.centre.x;
    const dz = z - rw.centre.z;
    const along = dx * rw.forward.x + dz * rw.forward.z;
    const across = dx * -rw.forward.z + dz * rw.forward.x;
    if (Math.abs(along) <= rw.length / 2 && Math.abs(across) <= rw.width / 2 + 6) {
      return rw;
    }
  }
  return null;
}

// Landing quality 0..1: gentle descent, on-speed, on centreline.
function touchdownScore(plane) {
  const vs = clamp(1 - Math.abs(plane.vspeed) / 4.5, 0, 1);
  const sp = clamp(1 - Math.abs(plane.speed - 38) / 14, 0, 1);
  const roll = clamp(1 - Math.abs(plane.roll) / 0.5, 0, 1);
  return clamp(vs * 0.5 + sp * 0.3 + roll * 0.2, 0, 1);
}

export function knots(ms) {
  return Math.round(ms * 1.94384);
}

export function feet(m) {
  return Math.round(m * 3.28084);
}

export function headingDeg(plane) {
  let d = radToDeg(plane.heading) % 360;
  if (d < 0) d += 360;
  return Math.round(d);
}

export function compassPoint(deg) {
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return pts[Math.round(deg / 22.5) % 16];
}

export { angleDiff };
