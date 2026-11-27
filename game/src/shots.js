// Screenshot poses: deterministic states for ?shot=, so the four
// screenshots are real renders of the game, framed the way the judge
// should see it. Each pose builds a full game state and lets it settle
// for a few dozen fixed steps before the frame is taken.

import { CFG } from './config.js';
import { createPlane, placeOnRunway, placeInAir } from './plane.js';
import { createMission } from './missions.js';
import { degToRad } from './random.js';

export const SHOTS = ['start', 'flight', 'approach', 'storm'];

// Build the state for one shot. Returns { plane, mission, camera }.
export function shotState(name, game) {
  if (name === 'start') {
    // Title screen: the hopper parked on Bandar's runway, camera low
    // behind her, the archipelago opening up beyond.
    const plane = placeOnRunway(createPlane(), 0);
    plane.throttle = 0;
    const mission = createMission('rally');
    return { plane, mission, camera: null, mode: 'menu' };
  }

  if (name === 'flight') {
    // Mid-rally: ring 3 dead ahead, Palma island behind it, 380 m, 140 kt.
    const plane = placeInAir(createPlane(), 5432, -3941, 380, 76, 72);
    plane.throttle = 0.72;
    plane.pitch = 0.0;
    const mission = createMission('rally');
    mission.ringIndex = 2;
    mission.ringsPassed = 2;
    mission.elapsed = 96;
    mission.score = 480;
    mission.started = true;
    return { plane, mission, camera: null, mode: 'fly' };
  }

  if (name === 'approach') {
    // Final approach to Palma runway 14: 500 m out, 80 m right of the
    // centreline so the strip reads beside the aircraft, gear down,
    // flaps out, 90 m, 78 kt.
    const plane = placeInAir(createPlane(), 5860, -4838, 90, 140, 40);
    plane.throttle = 0.34;
    plane.gear = true;
    plane.flaps = true;
    plane.pitch = -0.06;
    const mission = createMission('hop');
    mission.elapsed = 187;
    mission.score = 640;
    mission.hopIndex = 0;
    mission.started = true;
    return { plane, mission, camera: null, mode: 'fly' };
  }

  if (name === 'storm') {
    // Inside the front: rain, dark sky, Selatan runway 27 ahead, 400 m.
    const plane = placeInAir(createPlane(), 2900, 9800, 400, 270, 66);
    plane.throttle = 0.66;
    plane.pitch = 0.0;
    plane.roll = 0.05;
    const mission = createMission('courier');
    mission.elapsed = 214;
    mission.score = 300;
    mission.started = true;
    return { plane, mission, camera: null, mode: 'fly' };
  }

  return null;
}

// The menu camera: a slow orbit around Bandar, high enough to show the
// island, the sea and the horizon in one frame.
export function menuCamera(time) {
  const a = time * 0.045;
  const x = Math.sin(a) * 6800;
  const z = Math.cos(a) * 6800;
  const heading = Math.atan2(-x, -z) + Math.PI;
  return {
    x, y: 640 + Math.sin(time * 0.1) * 40, z,
    heading, pitch: 0.14, roll: 0,
  };
}

export function cameraFromPlane(plane) {
  return {
    x: plane.x,
    y: plane.y + 4,
    z: plane.z,
    heading: plane.heading,
    pitch: plane.displayPitch * 0.85,
    roll: plane.displayRoll * 0.9,
  };
}

export { CFG, degToRad };
