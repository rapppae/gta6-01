// SOLMAR — police.js
// The wanted level and the Solmar police. Crimes raise the stars; the level
// decays when the player lies low and no cruiser can see them. More stars
// means more chasers, faster and more aggressive. At zero stars the cruisers
// just patrol the grid.

import * as THREE from 'three';
import { CFG } from './config.js';

export class PoliceForce {
  constructor(fleet, world, rng) {
    this.fleet = fleet;
    this.world = world;
    this.rng = rng;
    this.level = 0;
    this.lastCrimeAt = -999;
    this.decayTimer = 0;
    this.chasers = []; // police cars currently hunting the player
    this.spawnTimer = 0;
    this.onLevelChange = null; // (level) => void, wired by main.js (siren + HUD)
  }

  get maxChasers() {
    return this.level; // one chaser per star, up to five
  }

  addWanted(amount, now) {
    if (amount <= 0) return;
    const before = this.level;
    this.level = Math.min(CFG.maxWanted, this.level + amount);
    this.lastCrimeAt = now;
    this.decayTimer = 0;
    if (this.level !== before && this.onLevelChange) this.onLevelChange(this.level);
  }

  clearWanted(now) {
    if (this.level === 0) return;
    this.level = 0;
    this.lastCrimeAt = now;
    if (this.onLevelChange) this.onLevelChange(0);
    this.releaseChasers();
  }

  releaseChasers() {
    for (const car of this.chasers) {
      car.patrol = true;
      car.traffic = true;
      car.axis = Math.random() < 0.5 ? 'x' : 'z';
      car.dir = Math.random() < 0.5 ? 1 : -1;
    }
    this.chasers = [];
  }

  // Keep the chaser count matched to the wanted level, spawning new cruisers
  // at the map edges near the player.
  maintainChasers(player) {
    // Drop chasers that were destroyed or released.
    this.chasers = this.chasers.filter((c) => this.fleet.cars.includes(c));
    while (this.chasers.length < this.maxChasers) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 55 + Math.random() * 25;
      let x = player.x + Math.sin(angle) * dist;
      let z = player.z + Math.cos(angle) * dist;
      x = THREE.MathUtils.clamp(x, -170, 170);
      z = THREE.MathUtils.clamp(z, -170, 170);
      // Never spawn inside a building, and never right on top of the player:
      // clamping at the map edge can pull a spawn in close, so push it back out.
      if (this.world.isInsideBuilding(x, z, 2)) {
        x = this.world.nearestRoadCoord(x);
        z = this.world.nearestRoadCoord(z);
      }
      if (Math.hypot(x - player.x, z - player.z) < 40) {
        x = THREE.MathUtils.clamp(player.x + Math.sin(angle) * 55, -170, 170);
        z = THREE.MathUtils.clamp(player.z + Math.cos(angle) * 55, -170, 170);
      }
      const car = this.fleet.spawnPoliceChaser(x, z);
      this.chasers.push(car);
    }
    while (this.chasers.length > this.maxChasers) {
      const car = this.chasers.pop();
      car.patrol = true;
      car.traffic = true;
    }
  }

  // One chaser steering at the player. Aggression (speed and ram damage)
  // grows with the wanted level.
  chaseCar(car, dt, player, now, onRam) {
    const tx = player.inCar ? player.inCar.x : player.x;
    const tz = player.inCar ? player.inCar.z : player.z;
    const dx = tx - car.x;
    const dz = tz - car.z;
    const dist = Math.hypot(dx, dz);
    const wantAngle = Math.atan2(dx, dz);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const aggression = 0.55 + this.level * 0.14;
    car.angle += THREE.MathUtils.clamp(diff, -1, 1) * aggression * 2.2 * dt;
    const topSpeed = Math.min(CFG.policeChaseSpeed, 18 + this.level * 2.2);
    const target = dist > 6 ? topSpeed : topSpeed * 0.6;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    const pos = { x: car.x, z: car.z };
    if (this.world.collideCircle(pos, 1.5)) car.speed *= 0.5;
    this.world.clampToBounds(pos, 2);
    car.x = pos.x;
    car.z = pos.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    // Ramming the player: a bump on foot hurts, a bump in a car slows them.
    if (dist < 3.6 && onRam) onRam(car, dist, now);
  }

  // Is any police car close enough to see the player?
  anyPoliceNear(player, range = CFG.policeSightRange) {
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    for (const car of this.fleet.cars) {
      if (car.kind !== 'police') continue;
      if (Math.hypot(car.x - px, car.z - pz) < range) return true;
    }
    return false;
  }

  update(dt, now, player, onRam) {
    if (this.level > 0) this.maintainChasers(player);
    else if (this.chasers.length > 0) this.releaseChasers();
    for (const car of this.chasers) this.chaseCar(car, dt, player, now, onRam);
    // Decay: no crime for a while and no cruiser in sight, and the heat cools.
    if (this.level > 0 && now - this.lastCrimeAt > CFG.wantedDecayDelay) {
      if (!this.anyPoliceNear(player)) {
        this.decayTimer += dt;
        if (this.decayTimer >= CFG.wantedDecayStep) {
          this.decayTimer = 0;
          this.level -= 1;
          if (this.onLevelChange) this.onLevelChange(this.level);
          if (this.level === 0) this.releaseChasers();
        }
      } else {
        this.decayTimer = 0;
      }
    }
  }
}
