// Archipelago Airlift — tuning, world layout and mission definitions.
// One island-hopper, three sorties over a tropical archipelago. All units SI
// unless noted: metres, m/s, degrees. Speeds shown to the pilot in knots.

export const CFG = {
  // Canvas is sized to the window; the game is tuned for a 1280x720 view.
  viewWidth: 1280,
  viewHeight: 720,
  focal: 640, // perspective focal length in pixels

  // Flight model.
  maxSpeed: 92, // m/s at full throttle, clean (~179 kt)
  cruiseSpeed: 62,
  stallSpeed: 26, // below this the wing stops flying
  minLandingSpeed: 30,
  maxLandingSpeed: 48,
  accel: 7.5, // m/s^2 at full throttle
  drag: 0.082, // quadratic drag: equilibrium at maxSpeed, full throttle
  climbRate: 12, // m/s maximum climb at full power
  sinkRate: 3.2, // m/s gliding with throttle idle
  pitchAuthority: 0.38, // rad/s at full stick, scaled by speed
  rollAuthority: 1.5, // rad/s
  rollDamp: 1.6,
  turnRate: 0.42, // heading rad/s at 45 deg bank
  gearDrag: 0.35, // extra drag multiplier with gear down
  flapLift: 1.18, // lift multiplier with flaps down

  // Fuel and damage.
  fuelCapacity: 100,
  fuelBurnCruise: 0.55, // % per second at 60% throttle
  fuelBurnFull: 1.5, // % per second at full throttle
  damageHardLanding: 34, // vertical speed over 4.5 m/s on touchdown
  damageBounce: 12,
  damageStorm: 2.2, // per second above 70 m/s inside the storm cell

  // World.
  seaLevel: 0,
  mapRadius: 14000,
  cloudCount: 42,
  cloudFloor: 700,
  cloudCeiling: 2300,

  // Scoring.
  ringScore: 150,
  ringTimeBonus: 12, // per second under par, rally
  landingBase: 400,
  landingQualityMax: 300,
  courierBonus: 900,
};

// Islands: x east, z south, radius, hill height, name. The sea is at y = 0.
export const ISLANDS = [
  { x: 0, z: 0, r: 2600, hill: 260, name: 'Bandar' },
  { x: 6500, z: -4200, r: 1800, hill: 190, name: 'Palma' },
  { x: -5800, z: 5200, r: 1500, hill: 150, name: 'Karang' },
  { x: 9000, z: 6000, r: 2200, hill: 330, name: 'Tiga' },
  { x: -9000, z: -6500, r: 950, hill: 90, name: 'Batu Kecil' },
  { x: 2000, z: 9800, r: 1650, hill: 210, name: 'Selatan' },
  { x: -3500, z: -9500, r: 700, hill: 70, name: 'Pasir' },
  { x: 11500, z: -1500, r: 800, hill: 80, name: 'Ujung' },
];

// Runways: island index, heading in degrees, length, width, name.
export const RUNWAYS = [
  { island: 0, heading: 90, length: 950, width: 34, name: 'BDR 09' },
  { island: 1, heading: 140, length: 800, width: 30, name: 'PLM 14' },
  { island: 2, heading: 30, length: 750, width: 30, name: 'KRG 03' },
  { island: 5, heading: 270, length: 850, width: 32, name: 'SLT 27' },
];

// Rally rings: position and height, flown in order.
export const RALLY_RINGS = [
  { x: 1500, z: -1500, y: 420 },
  { x: 3200, z: -3400, y: 560 },
  { x: 6500, z: -4200, y: 380 },
  { x: 5200, z: -700, y: 700 },
  { x: 1800, z: 2600, y: 480 },
  { x: -2600, z: 4200, y: 620 },
  { x: -5800, z: 5200, y: 400 },
  { x: -2400, z: 1800, y: 520 },
];

export const MISSIONS = [
  {
    id: 'rally',
    name: 'Ring Rally',
    tag: '8 rings · beat the clock',
    brief:
      'Thread all eight sky rings over the archipelago. Full throttle burns fuel fast — ease off on the straights and save the boost for the climbs.',
    par: 240,
    fuel: 100,
  },
  {
    id: 'hop',
    name: 'Island Hop',
    tag: '3 landings · fuel is the boss',
    brief:
      'Land on Palma, then Karang, then home. Gear down, flaps out, touch down soft — every smooth landing refuels you and banks a bonus.',
    par: 420,
    fuel: 100,
  },
  {
    id: 'courier',
    name: 'Storm Courier',
    tag: 'cargo run · through the front',
    brief:
      'Carry medicine to Selatan through the storm front. Rain, gusts and a hard crosswind — keep the speed down inside the cell or the airframe takes it.',
    par: 360,
    fuel: 100,
  },
];

export const COLORS = {
  skyTop: '#1c4e8a',
  skyMid: '#5f9fd0',
  skyHorizon: '#cfe8f2',
  seaDeep: '#0d4d66',
  seaShallow: '#2e8fa8',
  seaGlitter: '#ffe9a8',
  sand: '#e8d9a8',
  grass: '#3f8f4f',
  grassDark: '#2c6b38',
  hill: '#2f6b3a',
  hillTop: '#7a9a5a',
  asphalt: '#3a3f46',
  lineWhite: '#f2f2e8',
  ringNext: '#ffb02e',
  ringDone: '#58d68d',
  hudGlass: 'rgba(8, 20, 32, 0.55)',
  hudText: '#eaf6ff',
  hudAmber: '#ffc857',
  hudRed: '#ff6b5e',
  hudGreen: '#7be495',
};
