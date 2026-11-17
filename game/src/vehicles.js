// SOLMAR — cars. Three kinds share one body: the player's car (arcade physics),
// traffic (drives the road grid, turns at intersections, stops for the car ahead) and
// police (chases the player). Parked cars sit at curbs waiting to be stolen.
import {
  CAR_ACCEL, CAR_BRAKE, CAR_FRICTION, CAR_MAX_SPEED, CAR_RADIUS, CAR_REVERSE_MAX,
  CAR_STEER, CAR_COLORS, POLICE_MAX_SPEED, STREETS, TRAFFIC_SPEED,
} from './config.js';
import { clampWorld, collideBuildings, nearestStreet } from './world.js';
import { exitCar } from './player.js';

let nextId = 1;

export function makeCar(G, kind, x, z, heading, color) {
  const car = {
    id: nextId += 1, kind, x, z, heading, speed: 0,
    color: color ?? G.world.rng.pick(CAR_COLORS),
    driver: null, axis: 'x', line: nearestStreet(z), dir: 1, targetSpeed: TRAFFIC_SPEED,
    steer: 0, mesh: null, lightPhase: 0,
  };
  return car;
}

export function createVehicles(G) {
  const cars = [];
  // Traffic: 10 cars cruising the grid.
  for (let i = 0; i < 10; i += 1) {
    const horizontal = G.world.rng.chance(0.5);
    const line = G.world.rng.pick(STREETS);
    const along = G.world.rng.range(-240, 240);
    const car = makeCar(G, 'traffic', horizontal ? along : line, horizontal ? line : along, horizontal ? 0 : Math.PI / 2, undefined);
    car.axis = horizontal ? 'x' : 'z';
    car.line = line;
    car.dir = G.world.rng.chance(0.5) ? 1 : -1;
    car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.targetSpeed = TRAFFIC_SPEED * G.world.rng.range(0.8, 1.15);
    car.speed = car.targetSpeed;
    const driver = { x: car.x, z: car.z, heading: car.heading, state: 'driver', color: 0x222222, speed: 0, target: null, downTimer: 0, mesh: null };
    car.driver = driver;
    G.peds.push(driver);
    cars.push(car);
  }
  // Parked cars at curbs, free to take (no driver, no wanted level).
  for (let i = 0; i < 9; i += 1) {
    const horizontal = G.world.rng.chance(0.5);
    const line = G.world.rng.pick(STREETS);
    const along = G.world.rng.range(-230, 230);
    const car = makeCar(G, 'parked', horizontal ? along : line + 7.5, horizontal ? line + 7.5 : along, horizontal ? 0 : Math.PI / 2, undefined);
    car.heading = horizontal ? (G.world.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (G.world.rng.chance(0.5) ? 0 : Math.PI);
    cars.push(car);
  }
  return cars;
}

export function stepVehicles(G, dt) {
  for (const car of G.cars) {
    if (car.kind === 'player') stepPlayerCar(G, car, dt);
    else if (car.kind === 'traffic') stepTraffic(G, car, dt);
    else if (car.kind === 'police') stepPoliceCar(G, car, dt);
    // parked cars do not move
    const push = collideBuildings(G.world, car.x, car.z, CAR_RADIUS);
    if (push) {
      car.x += push.x; car.z += push.z;
      if (car.kind === 'player') car.speed *= 0.4;
      if (car.kind === 'police') car.speed *= 0.6;
    }
    const c = clampWorld(car.x, car.z, 3);
    car.x = c.x; car.z = c.z;
  }
  // Car-on-car: simple circle push so cars never overlap.
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) {
      const a = G.cars[i];
      const b = G.cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = CAR_RADIUS * 2;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        if (a.kind !== 'parked') { a.x -= nx * push; a.z -= nz * push; }
        if (b.kind !== 'parked') { b.x += nx * push; b.z += nz * push; }
        if (a.kind === 'player' || b.kind === 'player') {
          if (a.kind === 'player') a.speed *= 0.7;
          if (b.kind === 'player') b.speed *= 0.7;
        }
      }
    }
  }
}

function stepPlayerCar(G, car, dt) {
  const input = G.input;
  const p = G.player;
  if (input.forward) car.speed += CAR_ACCEL * dt;
  else if (input.back) car.speed -= (car.speed > 0.5 ? CAR_BRAKE : CAR_ACCEL * 0.6) * dt;
  else {
    const f = CAR_FRICTION * dt;
    car.speed = Math.abs(car.speed) <= f ? 0 : car.speed - Math.sign(car.speed) * f;
  }
  if (input.handbrake) car.speed *= Math.max(0, 1 - dt * 4);
  car.speed = Math.max(-CAR_REVERSE_MAX, Math.min(CAR_MAX_SPEED, car.speed));
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steer = steerInput * CAR_STEER * Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steer * Math.sign(car.speed || 1) * dt;
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = Math.abs(car.speed);
  // Running a pedestrian over is a crime.
  for (const ped of G.peds) {
    if (ped.state === 'walk' || ped.state === 'flee') {
      const d = Math.hypot(ped.x - car.x, ped.z - car.z);
      if (d < CAR_RADIUS + 0.7 && Math.abs(car.speed) > 3) {
        ped.state = 'down'; ped.downTimer = 10;
        G.police.addWanted(1, 'ran over a pedestrian');
        G.hud.toast('Pedestrian down — wanted level up');
        G.audio.thud();
      }
    }
  }
  if (input.interactPressed) exitCar(G);
}

function stepTraffic(G, car, dt) {
  // Slow for the car ahead on the same lane.
  let ahead = Infinity;
  for (const other of G.cars) {
    if (other === car || other.kind === 'parked') continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const along = car.axis === 'x' ? dx * car.dir : dz * car.dir;
    const across = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
    if (along > 0 && along < ahead && across < 4) ahead = along;
  }
  const want = ahead < 10 ? 0 : car.targetSpeed;
  car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), 8 * dt);
  // Turn at an intersection sometimes.
  const alongPos = car.axis === 'x' ? car.x : car.z;
  const nearStreet = nearestStreet(alongPos);
  if (Math.abs(alongPos - nearStreet) < 1.5 && G.world.rng.chance(0.004) && car.speed > 1) {
    const newAxis = car.axis === 'x' ? 'z' : 'x';
    car.axis = newAxis;
    car.line = nearStreet;
    if (newAxis === 'x') { car.z = nearStreet; car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { car.x = nearStreet; car.heading = car.dir > 0 ? 0 : Math.PI; }
  }
  const lane = 2.5; // right-hand lane offset
  if (car.axis === 'x') {
    car.x += car.dir * car.speed * dt;
    car.z = car.line + (car.dir > 0 ? lane : -lane);
    car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.z += car.dir * car.speed * dt;
    car.x = car.line + (car.dir > 0 ? -lane : lane);
    car.heading = car.dir > 0 ? 0 : Math.PI;
  }
  // Wrap around the city edge so traffic never runs out.
  if (car.x > 250) car.x = -250;
  if (car.x < -250) car.x = 250;
  if (car.z > 250) car.z = -250;
  if (car.z < -250) car.z = 250;
}

function stepPoliceCar(G, car, dt) {
  const p = G.player;
  if (car.patrol) {
    // Formation driving (used by the chase screenshot): straight ahead at a fixed
    // speed, lights flashing, no chasing and no ramming.
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.lightPhase += dt * 10;
    return;
  }
  const dx = p.x - car.x;
  const dz = p.z - car.z;
  const dist = Math.hypot(dx, dz);
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
  // A building straight ahead: slide along it instead of pushing into it forever.
  const aheadX = car.x + Math.sin(car.heading) * 6;
  const aheadZ = car.z + Math.cos(car.heading) * 6;
  if (collideBuildings(G.world, aheadX, aheadZ, 1.5)) {
    car.heading += 2.5 * dt;
    car.speed = Math.min(car.speed, 22);
  }
  car.speed = Math.min(POLICE_MAX_SPEED, car.speed + 18 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.lightPhase += dt * 10;
  // Ram the player's car, or bust the player on foot.
  if (dist < CAR_RADIUS + 1.2) {
    if (p.inCar) {
      p.inCar.speed *= 0.92;
      car.speed *= 0.7;
      G.audio.thud();
    } else if (G.screen === 'play') {
      G.events.busted = true;
    }
  }
}
