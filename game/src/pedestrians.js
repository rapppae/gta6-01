// SOLMAR — pedestrians.js
// The people of Solmar: they stroll the sidewalks, cross at intersections,
// and run away when a car bears down on them or a shot rings out nearby.
// A pedestrian the player's car hits goes down — and the law notices.

import * as THREE from 'three';
import { CFG } from './config.js';
import { PALETTE } from './random.js';
import { makePersonMesh } from './player.js';

export class PedCrowd {
  constructor(scene, world, rng) {
    this.scene = scene;
    this.world = world;
    this.rng = rng;
    this.peds = [];
    this.walkPhase = 0;
  }

  spawnInitial() {
    for (let i = 0; i < CFG.pedCount; i++) this.spawnPed();
  }

  spawnPed() {
    // Start on a sidewalk: just off a road, on a block edge.
    const road = this.rng.pick(CFG.roadCoords);
    const along = this.rng.range(-160, 160);
    const side = this.rng.chance(0.5) ? 1 : -1;
    const onXRoad = this.rng.chance(0.5);
    const x = onXRoad ? along : road + side * (CFG.roadHalf + 2.5);
    const z = onXRoad ? road + side * (CFG.roadHalf + 2.5) : along;
    const mesh = makePersonMesh(this.rng.colour(PALETTE.clothes));
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      x, z,
      angle: this.rng.range(0, Math.PI * 2),
      speed: CFG.pedWalkSpeed * this.rng.range(0.7, 1.3),
      mesh,
      state: 'walk', // walk | flee | down
      fleeX: 0,
      fleeZ: 0,
      fleeTimer: 0,
      downTimer: 0,
      phase: this.rng.range(0, 6),
      counted: false, // already raised wanted for being hit
    };
    this.peds.push(ped);
    return ped;
  }

  // Scare every pedestrian near a point (a gunshot, a speeding car).
  fleeFrom(x, z, radius = CFG.pedFleeRadius) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.state = 'flee';
        ped.fleeTimer = 3 + Math.random() * 2;
        const away = Math.atan2(ped.x - x, ped.z - z);
        ped.fleeX = Math.sin(away);
        ped.fleeZ = Math.cos(away);
      }
    }
  }

  update(dt, player, cars) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        ped.mesh.rotation.x = -Math.PI / 2 + 0.15; // lying on the ground
        if (ped.downTimer <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.speed = CFG.pedWalkSpeed;
        }
        continue;
      }
      let speed = ped.speed;
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        speed = CFG.pedFleeSpeed;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      } else {
        // Strolling: wander along the sidewalk, turning at intersections.
        if (Math.random() < dt * 0.12) {
          ped.angle += (Math.random() - 0.5) * 1.6;
        }
        // A fast car coming at them sends them running.
        const car = player.inCar;
        if (car && Math.abs(car.speed) > 7) {
          const d = Math.hypot(ped.x - car.x, ped.z - car.z);
          const ahead = (ped.x - car.x) * Math.sin(car.angle) + (ped.z - car.z) * Math.cos(car.angle);
          if (d < 12 && ahead > 0) {
            ped.state = 'flee';
            ped.fleeTimer = 2.5;
            const away = Math.atan2(ped.x - car.x, ped.z - car.z);
            ped.fleeX = Math.sin(away);
            ped.fleeZ = Math.cos(away);
          }
        }
        // Keep to the sidewalks: if they drift onto a road, steer back.
        if (this.world.isOnRoad(ped.x, ped.z) && Math.random() < dt * 0.5) {
          ped.angle += Math.PI / 2;
        }
      }
      let mx;
      let mz;
      if (ped.state === 'flee') {
        mx = ped.fleeX;
        mz = ped.fleeZ;
      } else {
        mx = Math.sin(ped.angle);
        mz = Math.cos(ped.angle);
      }
      let nx = ped.x + mx * speed * dt;
      let nz = ped.z + mz * speed * dt;
      // Don't walk through a car: sidestep around it instead.
      for (const car of cars) {
        if (Math.hypot(nx - car.x, nz - car.z) < 2.4) {
          ped.angle += Math.PI / 2;
          nx = ped.x;
          nz = ped.z;
          break;
        }
      }
      const pos = { x: nx, z: nz };
      if (this.world.isInsideBuilding(nx, nz, 0.6)) {
        ped.angle += Math.PI / 2;
        pos.x = ped.x;
        pos.z = ped.z;
      }
      this.world.clampToBounds(pos, 1);
      ped.x = pos.x;
      ped.z = pos.z;
      if (ped.state !== 'flee') ped.angle = Math.atan2(mx, mz);
      else ped.angle = Math.atan2(ped.fleeX, ped.fleeZ);
      ped.phase += speed * dt * 2.2;
      const swing = Math.sin(ped.phase) * 0.5;
      const u = ped.mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.7;
      u.armR.rotation.x = swing * 0.7;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.angle;
    }
  }

  // The player's car hitting a pedestrian: they go down. Returns the ones hit.
  checkCarHits(car) {
    const hit = [];
    if (!car || Math.abs(car.speed) < 4) return hit;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - car.x, ped.z - car.z);
      if (d < 2.4) {
        ped.state = 'down';
        ped.downTimer = 6;
        ped.mesh.rotation.x = -Math.PI / 2 + 0.15;
        hit.push(ped);
      }
    }
    return hit;
  }
}
