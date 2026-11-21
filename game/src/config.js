// Tuning constants, 3D scale, physics parameters, light timings, and bright low-poly coastal palette.

export const VIEW = { width: 1280, height: 720 };

/** Fixed simulation step (60 Hz) regardless of monitor refresh rate. */
export const STEP = 1 / 60;

/** Simulation units to 3D meters (36 sim units = 4.32 m compact car length). */
export const WORLD_SCALE = 0.12;

/** The yellow taxi driver's boast: six city intersections in 75 seconds (01:15.00). */
export const TARGET_TIME = 75.0;

/** Seconds shaved off final time for every Green checkpoint crossed. */
export const GREEN_BONUS = 1.0;

/** Number of Red lights required before the Patrol Car joins the chase. */
export const PATROL_HEAT_THRESHOLD = 2;

/** World dimensions in logical simulation units (Sunset Harbor coastal city). */
export const WORLD = {
  width: 5200,
  height: 3800,
  waterSouthY: 3260,
  waterEastX: 4680,
  northWallY: 180,
  westWallX: 180,
};

/** Compact nimble rally hatchback physics tuning (crisp nose-aligned driving, progressive accel, brake-stop-then-reverse). */
export const CAR = {
  length: 36,
  width: 20,
  radius: 13,
  maxSpeed: 266,
  alleyMaxSpeed: 256,
  reverseSpeed: 98,
  accel: 255,
  brake: 470,
  coastDrag: 0.56,
  rollingResist: 16,
  stopBeforeReverseSec: 0.48,
  steerRate: 2.75,
  driftSteerBoost: 1.24,
  lateralGrip: 26.0,
  alleyGrip: 20.0,
  driftGrip: 4.8,
  driftMinSpeed: 100,
  driftExitBoost: 1.10,
  driftExitDuration: 0.32,
};

/** Police patrol cruiser (dispatched at HEAT >= 2): fast on avenues, heavier in tight alleys. */
export const PATROL = {
  length: 42,
  width: 22,
  radius: 15,
  baseMaxSpeed: 284,
  heatSpeedBonus: 14,
  alleySpeedCap: 194,
  accel: 320,
  turnRate: 3.1,
  alleyTurnRate: 2.1,
  ramCooldown: 1.15,
};

/** Yellow taxi rival ("FOR HIRE" -> "BEAT 01:15"). */
export const TAXI = {
  length: 40,
  width: 21,
  radius: 14,
  cruiseSpeed: 242,
};

/** Rush-hour 6 PM commuter traffic. */
export const TRAFFIC = {
  count: 24,
  length: 38,
  width: 20,
  radius: 13,
  minSpeed: 92,
  maxSpeed: 148,
};

/** Traffic light state codes and phase durations (seconds). */
export const LIGHT_GREEN = 0;
export const LIGHT_AMBER = 1;
export const LIGHT_RED = 2;

export const LIGHT_TIMING = {
  green: 6.4,
  amber: 2.5,
  red: 4.9,
  greenWarn: 1.5,
};

/** Pool capacities (allocated once at boot). */
export const SKID_POOL = 420;
export const PARTICLE_POOL = 200;

/** Bright Low-Poly 6:00 PM Sunset Coastal Palette (Turquoise buildings, Coral gates, Citrus landmark). */
export const PALETTE = {
  backdrop: '#162330',
  skyTop: '#2c82a8',
  skyMid: '#f2a46d',
  skyHorizon: '#ffd594',
  fog: '#efc08c',
  sunLight: '#ffe0a8',
  hemiSky: '#8fe6e8',
  hemiGround: '#594842',

  asphalt: '#343844',
  sidewalk: '#ded4c2',
  alleyCobble: '#a87d65',
  forecourt: '#b8aa99',
  water: '#1ea3b8',
  coralGate: '#ff6358',
  orangeStatue: '#ff8a1f',

  // Vehicles
  playerBody: '#e8483c',
  playerRoof: '#fff4e6',
  taxiYellow: '#f8c528',
  taxiRoof: '#ffe478',
  patrolDark: '#1b2336',
  patrolWhite: '#f4f7fc',
  sirenRed: '#ff2b4a',
  sirenBlue: '#2ca2ff',

  // Signals
  green: '#2ee58a',
  greenGlow: 'rgba(46, 229, 138, 0.36)',
  amber: '#ffb627',
  amberGlow: 'rgba(255, 182, 39, 0.36)',
  red: '#ff3b4e',
  redGlow: 'rgba(255, 59, 78, 0.38)',

  // UI
  panelBg: 'rgba(18, 25, 36, 0.84)',
  panelSolid: '#17202e',
  panelBorder: 'rgba(255, 198, 72, 0.48)',
  text: '#f8f5ee',
  muted: '#b9c6d4',
  gold: '#f7c12c',
  warmSunset: '#ff7f54',
};

export const FONT_UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const FONT_MONO = 'ui-monospace, "Cascadia Mono", "Consolas", monospace';

export const BEST_KEY = 'green-to-amber-rush-at-six.best-v1';
