// SOLMAR — tuning and constants. One place for every number the sim uses, so the
// recorded rewrite can retune the feel without touching the systems.
export const STEP = 1 / 60;
export const WORLD_HALF = 300;
export const STREET_GAP = 60;
export const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const ROAD_HALF = 5; // half the width of a road
export const BEACH_Z = -270; // south of this line is sand, then ocean

// On foot.
export const WALK_SPEED = 6;
export const SPRINT_SPEED = 9.5;
export const JUMP_SPEED = 7;
export const GRAVITY = 22;
export const PLAYER_RADIUS = 0.9;

// Driving (arcade, not a simulator).
export const CAR_ACCEL = 16;
export const CAR_BRAKE = 26;
export const CAR_MAX_SPEED = 38;
export const CAR_REVERSE_MAX = 12;
export const CAR_FRICTION = 6;
export const CAR_STEER = 1.9; // radians per second at full lock, scaled by speed
export const CAR_RADIUS = 1.7;
export const POLICE_MAX_SPEED = 43;
export const TRAFFIC_SPEED = 9;

// Wanted level.
export const WANTED_MAX = 5;
export const WANTED_DECAY_QUIET = 18; // seconds without a crime before decay starts
export const WANTED_DECAY_EVERY = 12; // seconds per star once decaying
export const POLICE_MAX_CARS = 3;

// Combat.
export const PISTOL_MAG = 12;
export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 70;
export const PISTOL_COOLDOWN = 0.18;
export const RELOAD_TIME = 1.2;
export const ENEMY_HEALTH = 100;
export const ENEMY_DAMAGE = 8;
export const ENEMY_SHOT_EVERY = 1.4;
export const ENEMY_RANGE = 45;
export const ENEMY_HIT_CHANCE = 0.55;

// Money.
export const START_MONEY = 50;
export const BUSTED_FINE = 150;
export const WASTED_FINE = 200;
export const KILL_PAY = 25;

// Landmarks: every mission target sits on an intersection, reachable by car and on foot.
export const LANDMARKS = {
  bar: { name: "Marco's Bar", x: 60, z: 60 },
  docks: { name: 'Solmar Docks', x: -240, z: -240 },
  bank: { name: 'Solmar National Bank', x: 0, z: 0 },
  buyer: { name: 'The Buyer', x: 240, z: 240 },
  safehouse: { name: 'Safehouse', x: -240, z: 240 },
  getaway: { name: 'Getaway Point', x: 240, z: -240 },
  hospital: { name: 'St. Marina Hospital', x: 60, z: -60 },
  policeStation: { name: 'Solmar PD', x: -60, z: 60 },
};

// Palette — sun-soaked coastal city: pastel walls, terracotta roofs, teal sea.
export const BUILDING_COLORS = [0xf2e3c6, 0xe8b4a0, 0xd9a441, 0x9fc3d4, 0xc9d6a3, 0xe6d8f0, 0xf0c8a0, 0xb8c4cc];
export const ROOF_COLORS = [0xb5533c, 0x7a4a2b, 0x5d6b73, 0x3f6b4f, 0x8c5a3c];
export const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x16a085];
export const PED_SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xfd79a8, 0xffeaa7];
export const SAVE_KEY = 'solmar-save-v1';
