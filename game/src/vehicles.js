// SOLMAR — vehicles.js
// Cars: the traffic that drives the road grid, the parked cars free for the
// taking, the police cars, and the driving itself — acceleration, steering,
// handbrake, building and car collisions. Every car lives in one fleet list
// (G.cars) so the HUD minimap, the probes and the police all see the same cars.

import * as THREE from 'three';
import { CFG } from './config.js';
import { PALETTE } from './random.js';

let nextCarId = 1;

export function makeCarMesh(kind, colour) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colour });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2c3c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x16181c });
  const long = kind === 'van' ? 5.2 : kind === 'sport' ? 4.0 : 4.4;
  const wide = 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wide, 0.62, long), paint);
  body.position.y = 0.55;
  group.add(body);
  const cabinH = kind === 'van' ? 0.95 : 0.62;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wide - 0.25, cabinH, long * 0.5), glass);
  cabin.position.set(0, 0.55 + 0.31 + cabinH / 2 - 0.05, kind === 'van' ? 0 : -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelSpots = [
    [-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelSpots) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx, 0.36, wz * (long / 4.4));
    group.add(w);
    wheels.push(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf5c542 }),
    );
    sign.position.set(0, 1.62, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    red.position.set(-0.3, 1.56, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.2, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    blue.position.set(0.3, 1.56, -0.2);
    group.add(blue);
    group.userData.policeLights = [red, blue];
  }
  group.userData.wheels = wheels;
  return group;
}

export class VehicleFleet {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.cars = [];
  }

  addCar(kind, x, z, angle, opts = {}) {
    const colour = kind === 'police' ? 0xf0f0f0 : this.rng.colour(PALETTE.cars);
    const mesh = makeCarMesh(kind, colour);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    this.scene.add(mesh);
    const car = {
      id: nextCarId++,
      kind,
      x,
      z,
      angle,
      speed: 0,
      steer: 0,
      mesh,
      driver: !!opts.driver, // a traffic car has a driver; stealing it is a crime
      taken: false, // the player is driving it
      patrol: !!opts.patrol, // a police car on patrol, not chasing
      traffic: !!opts.traffic,
      axis: opts.axis || 'x',
      dir: opts.dir || 1,
      lane: opts.lane || 0,
      stopTimer: 0,
      targetSpeed: 0,
      colour,
      dead: false,
    };
    this.cars.push(car);
    return car;
  }

  spawnInitial() {
    // Parked cars along the roads, free to take. Shuffled so the mix of
    // sedans, taxis, vans and sports differs by seed, not by list order.
    const parkedKinds = this.rng.shuffle(['sedan', 'sedan', 'taxi', 'van', 'sport', 'sedan', 'taxi', 'van', 'sport', 'sedan']);
    for (let i = 0; i < CFG.parkedCount; i++) {
      const road = this.rng.pick(CFG.roadCoords);
      const along = this.rng.range(-150, 150);
      const side = this.rng.chance(0.5) ? 1 : -1;
      if (this.rng.chance(0.5)) {
        this.addCar(this.rng.pick(parkedKinds), road + side * (CFG.roadHalf + 1.6), along, side > 0 ? 0 : Math.PI, { driver: false });
      } else {
        this.addCar(this.rng.pick(parkedKinds), along, road + side * (CFG.roadHalf + 1.6), side > 0 ? Math.PI / 2 : -Math.PI / 2, { driver: false });
      }
    }
    // Traffic: cars driving the grid, each with a driver.
    for (let i = 0; i < CFG.trafficCount; i++) this.spawnTrafficCar();
    // Two police cars patrolling at zero stars.
    this.addCar('police', -40, 40, 0, { driver: true, patrol: true, traffic: true, axis: 'x', dir: 1 });
    this.addCar('police', 80, -80, Math.PI, { driver: true, patrol: true, traffic: true, axis: 'z', dir: -1 });
  }

  spawnTrafficCar() {
    const axis = this.rng.chance(0.5) ? 'x' : 'z';
    const road = this.rng.pick(CFG.roadCoords);
    const along = this.rng.range(-160, 160);
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const lane = dir * 2.6;
    const angle = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const kinds = ['sedan', 'sedan', 'taxi', 'van', 'sport'];
    const car = this.addCar(this.rng.pick(kinds), axis === 'x' ? along : road + lane, axis === 'x' ? road + lane : along, angle, {
      driver: true, traffic: true, axis, dir, lane,
    });
    car.speed = CFG.trafficSpeed * this.rng.range(0.8, 1.15);
    return car;
  }

  spawnPoliceChaser(x, z) {
    const car = this.addCar('police', x, z, 0, { driver: true, patrol: false });
    car.speed = 6;
    return car;
  }

  removeCar(car) {
    this.scene.remove(car.mesh);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  nearestCar(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // One traffic car following its road, stopping at red lights.
  driveTraffic(car, dt, time) {
    if (car.taken || car.kind === 'police' && !car.patrol) return;
    const road = this.world.nearestRoadCoord(car.axis === 'x' ? car.z : car.x);
    // Approaching an intersection on a red light: slow to a stop.
    const along = car.axis === 'x' ? car.x : car.z;
    const nextCross = this.world.nearestRoadCoord(along + car.dir * 10);
    const distCross = Math.abs(nextCross - along);
    const green = this.world.lightGreenFor(car.axis, time);
    let target = CFG.trafficSpeed;
    if (!green && distCross < 14) target = 0;
    if (car.stopTimer > 0) {
      car.stopTimer -= dt;
      target = 0;
    } else if (this.rng.chance(dt * 0.004)) {
      car.stopTimer = this.rng.range(2, 5);
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    if (car.speed < 0.05) car.speed = 0;
    if (car.speed > 0) {
      const nx = car.x + (car.axis === 'x' ? car.dir * car.speed * dt : 0);
      const nz = car.z + (car.axis === 'z' ? car.dir * car.speed * dt : 0);
      car.x = nx;
      car.z = nz;
      // Turn at an intersection sometimes, to keep traffic spread out.
      // Seeded, so the same seed replays the same traffic.
      if (distCross < 2 && this.rng.chance(0.25)) {
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        const newRoad = this.world.nearestRoadCoord(car.axis === 'x' ? car.z : car.x);
        car.axis = newAxis;
        car.dir = this.rng.chance(0.5) ? 1 : -1;
        car.lane = car.dir * 2.6;
        if (newAxis === 'x') {
          car.z = newRoad + car.lane;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.x = newRoad + car.lane;
          car.angle = car.dir > 0 ? 0 : Math.PI;
        }
      }
    }
    // Wrap around the map edge instead of leaving it.
    if (car.x > 175 || car.x < -175 || car.z > 175 || car.z < -175) {
      car.x = THREE.MathUtils.clamp(car.x, -170, 170);
      car.z = THREE.MathUtils.clamp(car.z, -170, 170);
      car.dir *= -1;
      car.angle += Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
  }

  // The player's car: arcade driving with steering, handbrake and collisions.
  drivePlayerCar(car, dt, input, world, onHitPed) {
    const axes = input.moveAxes();
    const handbrake = input.isDown('Space');
    // Forward is the car's nose: -Z rotated by angle. We store angle so that
    // forward = (sin(angle), cos(angle)) in (x, z).
    const fx = Math.sin(car.angle);
    const fz = Math.cos(car.angle);
    if (axes.f > 0) car.speed += CFG.carAccel * dt;
    if (axes.f < 0) {
      car.speed -= (car.speed > 0.5 ? CFG.carBrake : CFG.carAccel * 0.7) * dt;
    }
    // Natural drag.
    car.speed -= car.speed * (handbrake ? 1.4 : 0.35) * dt;
    car.speed = THREE.MathUtils.clamp(car.speed, -CFG.carReverseMax, CFG.carTopSpeed);
    if (Math.abs(car.speed) < 0.05 && axes.f === 0) car.speed = 0;
    // Steering: stronger at low speed, reversed when reversing.
    const steerTarget = -axes.s * CFG.carSteerMax * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    const grip = handbrake ? CFG.handbrakeGrip : CFG.carGrip;
    car.angle += car.steer * (car.speed / 6) * dt * (grip / CFG.carGrip) * (car.speed < 0 ? -1 : 1) * 1.4;
    const nx = car.x + Math.sin(car.angle) * car.speed * dt;
    const nz = car.z + Math.cos(car.angle) * car.speed * dt;
    // Buildings stop the car; a hard hit costs speed.
    const pos = { x: nx, z: nz };
    const hitWall = world.collideCircle(pos, 1.5);
    if (hitWall && Math.abs(car.speed) > 6) car.speed *= 0.35;
    world.clampToBounds(pos, 2);
    car.x = pos.x;
    car.z = pos.z;
    // Car-to-car bumps: slow both cars down.
    for (const other of this.cars) {
      if (other === car || other.taken) continue;
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uz = (car.z - other.z) / d;
        car.x += ux * push;
        car.z += uz * push;
        other.x -= ux * push;
        other.z -= uz * push;
        if (Math.abs(car.speed) > 4) car.speed *= 0.6;
        if (other.traffic) other.speed *= 0.5;
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    // Wheel spin for looks.
    const spin = car.speed * dt * 2;
    for (const w of car.mesh.userData.wheels || []) w.rotation.x += spin;
    if (onHitPed) onHitPed(car);
    return { fx, fz };
  }

  update(dt, time, player, onHitPed) {
    for (const car of this.cars) {
      if (car === player.inCar) continue;
      if (car.traffic) this.driveTraffic(car, dt, time);
      else if (!car.taken) {
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.angle;
      }
      // Police light bar flashes.
      if (car.kind === 'police' && car.mesh.userData.policeLights) {
        const [red, blue] = car.mesh.userData.policeLights;
        const on = Math.floor(time * 6) % 2 === 0;
        red.material.color.setHex(on ? 0xff2222 : 0x551111);
        blue.material.color.setHex(on ? 0x112266 : 0x2244ff);
      }
    }
  }
}
