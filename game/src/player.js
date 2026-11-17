// SOLMAR — the player on foot. WASD moves relative to the camera, Shift sprints,
// Space jumps, E gets in and out of cars. The player never touches three.js; render.js
// reads this state and draws it.
import { CAR_RADIUS, GRAVITY, JUMP_SPEED, PLAYER_RADIUS, SPRINT_SPEED, START_MONEY, WALK_SPEED } from './config.js';
import { clampWorld, collideBuildings } from './world.js';

export function createPlayer() {
  return {
    x: 60, z: 90, y: 0, vy: 0, heading: Math.PI, onGround: true,
    health: 100, money: START_MONEY, inCar: null, speed: 0,
    moving: false, armed: true,
  };
}

export function stepPlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.inCar) return; // driving is handled by vehicles.js
  const yaw = G.camera.yaw;
  let fx = 0;
  let fz = 0;
  if (input.forward) { fx += -Math.sin(yaw); fz += -Math.cos(yaw); }
  if (input.back) { fx += Math.sin(yaw); fz += Math.cos(yaw); }
  if (input.left) { fx += -Math.cos(yaw); fz += Math.sin(yaw); }
  if (input.right) { fx += Math.cos(yaw); fz += -Math.sin(yaw); }
  const len = Math.hypot(fx, fz);
  p.moving = len > 0.01;
  const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  if (p.moving) {
    fx /= len; fz /= len;
    p.x += fx * speed * dt;
    p.z += fz * speed * dt;
    p.speed = speed;
    const targetHeading = Math.atan2(fx, fz);
    let diff = targetHeading - p.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.heading += diff * Math.min(1, dt * 12);
  } else {
    p.speed = 0;
  }
  if (input.jump && p.onGround) { p.vy = JUMP_SPEED; p.onGround = false; }
  if (!p.onGround) {
    p.vy -= GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  const push = collideBuildings(G.world, p.x, p.z, PLAYER_RADIUS);
  if (push) { p.x += push.x; p.z += push.z; }
  const c = clampWorld(p.x, p.z, 2);
  p.x = c.x; p.z = c.z;

  // E near a car: get in. Stealing a traffic car (with a driver) or a police car is a crime.
  if (input.interactPressed) {
    const car = nearestCar(G, p.x, p.z, 4);
    if (car) enterCar(G, car);
  }
}

export function nearestCar(G, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.kind === 'traffic' && car.driver) {
    const driver = car.driver;
    car.driver = null;
    driver.state = 'flee';
    driver.x = car.x + 2.5; driver.z = car.z + 2.5;
    G.police.addWanted(1, 'stole a car');
    G.hud.toast('Car stolen — the cops noticed');
  } else if (car.kind === 'police') {
    G.police.addWanted(2, 'stole a police car');
    G.hud.toast('You stole a police car?!');
  }
  car.kind = 'player';
  p.inCar = car;
  p.x = car.x; p.z = car.z;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.sin(car.heading + Math.PI / 2) * 2.5;
  p.z = car.z + Math.cos(car.heading + Math.PI / 2) * 2.5;
  p.heading = car.heading;
}
