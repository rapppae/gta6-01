// SOLMAR — config.js
// Every tunable number for the game lives here, in one place, so balancing the
// city, the cars, the police, the combat and the missions never means hunting
// through the other modules. All distances are in world units, all speeds in
// units per second, all times in seconds.

export const CFG = {
  // ---- world ----
  worldHalf: 178, // playable bounds on both axes; the beach sits at the east edge
  roadSpacing: 40, // distance between parallel road centre lines
  roadHalf: 6, // half the width of a road
  roadCoords: [-160, -120, -80, -40, 0, 40, 80, 120, 160],
  blockHalf: 14, // half the size of a city block (buildings live inside it)
  beachX: 166, // sand starts here
  waterX: 184, // sea starts here
  seedDefault: 1,

  // ---- player on foot ----
  walkSpeed: 6.5,
  sprintSpeed: 11,
  accelGround: 42,
  jumpSpeed: 8.5,
  gravity: 22,
  playerRadius: 0.55,
  playerHealth: 100,
  healthRegenDelay: 6,
  healthRegenRate: 5,

  // ---- driving ----
  carAccel: 16,
  carBrake: 30,
  carReverseMax: 9,
  carTopSpeed: 30,
  carSteerMax: 0.55,
  carGrip: 6,
  handbrakeGrip: 1.6,
  trafficSpeed: 8,
  trafficCount: 14,
  parkedCount: 10,
  enterDistance: 4.5,

  // ---- pedestrians ----
  pedCount: 24,
  pedWalkSpeed: 1.6,
  pedFleeSpeed: 5.5,
  pedFleeRadius: 16,

  // ---- wanted / police ----
  maxWanted: 5,
  wantedDecayDelay: 18, // seconds without a crime before the level starts to fall
  wantedDecayStep: 14, // seconds per star lost while unseen
  policeSightRange: 34, // police within this range keep the heat on
  policeChaseSpeed: 26,
  policePatrolSpeed: 7,
  policeRamDamage: 8,
  policeRamCooldown: 1.2,
  stealWanted: 1,
  hitPedWanted: 1,
  shootWanted: 1,

  // ---- combat ----
  magSize: 12,
  reserveAmmo: 96,
  reloadTime: 1.2,
  shotDamage: 25,
  shotRange: 70,
  shotCooldown: 0.16,
  enemyHealth: 50,
  enemyShotInterval: 1.6,
  enemyShotChance: 0.3,
  enemyDamage: 8,
  enemyRange: 42,
  enemyDropMoney: 25,

  // ---- missions ----
  missionRewards: [250, 500, 750, 1000, 5000],
  getawayTimeLimit: 75,
  grabTime: 3,
  markerRadius: 5,
  hideoutRadius: 9,

  // ---- camera / feel ----
  camDistance: 8.5,
  camHeight: 3.4,
  camCarDistance: 11,
  camCarHeight: 4.2,
  camSmooth: 7,
  mouseSensitivity: 0.0026,

  // ---- money / save ----
  startMoney: 120,
  saveKey: 'solmar-save-v1',
};

// Named places in Solmar, the coastal city. Everything here is invented for
// this game: no real place, no borrowed map. Every point sits on a road
// intersection, so the player and the cars can always reach it.
export const PLACES = {
  pickup: { x: -120, z: 80, name: 'Marina Corner' },
  getawayDest: { x: 120, z: -120, name: 'Northgate Garage' },
  dropPoint: { x: 80, z: 120, name: 'Palm Court Drop' },
  hideout: { x: -120, z: 160, name: 'Solmar Hideout' },
  bank: { x: 120, z: 40, name: 'Solmar Trust Bank' },
  start: { x: -20, z: 20, name: 'Downtown' },
};
