// SOLMAR — combat.js
// The pistol, the gang enemies who shoot back, and the hit detection between
// them. Shots are resolved with a ray against enemy positions and building
// footprints — no physics engine, just geometry the game already owns.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makePersonMesh } from './player.js';

export class Combat {
  constructor(scene, world, particles, audio) {
    this.scene = scene;
    this.world = world;
    this.particles = particles;
    this.audio = audio;
    this.enemies = [];
    this.mag = CFG.magSize;
    this.reserve = CFG.reserveAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.onEnemyKilled = null; // (enemy) => void, wired by main.js
    this.onPlayerShot = null; // () => void, wired by main.js (wanted + flee)
  }

  resetAmmo() {
    this.mag = CFG.magSize;
    this.reserve = CFG.reserveAmmo;
    this.reloading = false;
  }

  startReload() {
    if (this.reloading || this.mag >= CFG.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = CFG.reloadTime;
    this.audio.reload();
  }

  updateReload(dt) {
    if (!this.reloading) return;
    this.reloadTimer -= dt;
    if (this.reloadTimer <= 0) {
      const need = CFG.magSize - this.mag;
      const take = Math.min(need, this.reserve);
      this.mag += take;
      this.reserve -= take;
      this.reloading = false;
    }
  }

  // Distance along the ray before a building blocks it (Infinity if clear).
  blockedDistance(origin, dir, maxDist) {
    for (let t = 2; t < maxDist; t += 2) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const y = origin.y + dir.y * t;
      if (y < 0) return t;
      for (const b of this.world.buildings) {
        if (Math.abs(x - b.x) < b.hw && Math.abs(z - b.z) < b.hd && y < b.h) return t;
      }
    }
    return Infinity;
  }

  // Fire the pistol along dir from origin. Returns the enemy hit, or null.
  shoot(origin, dir, shooter = 'player') {
    if (this.cooldown > 0 || this.reloading) return null;
    if (shooter === 'player') {
      if (this.mag <= 0) {
        this.startReload();
        return null;
      }
      this.mag -= 1;
    }
    this.cooldown = CFG.shotCooldown;
    const muzzle = {
      x: origin.x + dir.x * 0.8,
      y: origin.y + dir.y * 0.8 - 0.15,
      z: origin.z + dir.z * 0.8,
    };
    const blocked = this.blockedDistance(origin, dir, CFG.shotRange);
    // Nearest enemy whose body the ray passes close by.
    let hitEnemy = null;
    let hitT = Math.min(blocked, CFG.shotRange);
    for (const e of this.enemies) {
      if (e.health <= 0) continue;
      const ex = e.x - origin.x;
      const ey = 1.2 - origin.y;
      const ez = e.z - origin.z;
      const t = ex * dir.x + ey * dir.y + ez * dir.z;
      if (t < 0 || t > hitT) continue;
      const px = origin.x + dir.x * t - e.x;
      const py = origin.y + dir.y * t - 1.2;
      const pz = origin.z + dir.z * t - e.z;
      if (Math.hypot(px, py, pz) < 1.1) {
        hitEnemy = e;
        hitT = t;
      }
    }
    const end = {
      x: origin.x + dir.x * hitT,
      y: origin.y + dir.y * hitT,
      z: origin.z + dir.z * hitT,
    };
    this.particles.tracer(muzzle, end);
    this.particles.muzzle(muzzle, Math.atan2(dir.x, dir.z));
    if (shooter === 'player') {
      this.audio.shot();
      if (this.onPlayerShot) this.onPlayerShot(origin);
    } else {
      this.audio.enemyShot();
    }
    if (hitEnemy) {
      hitEnemy.health -= CFG.shotDamage;
      this.particles.blood({ x: hitEnemy.x, y: 1.3, z: hitEnemy.z });
      // Hit marker tick, so the player hears the shot land.
      this.audio.tone(1250, 0.05, 0.14, 'square');
      if (hitEnemy.health <= 0) this.killEnemy(hitEnemy);
    } else if (hitT < CFG.shotRange) {
      this.particles.sparks(end);
    }
    return hitEnemy;
  }

  killEnemy(enemy) {
    enemy.health = 0;
    this.scene.remove(enemy.mesh);
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);
    this.particles.burst({ x: enemy.x, y: 1, z: enemy.z }, 0xaa2222, 18, 4, 0.8, 7);
    if (this.onEnemyKilled) this.onEnemyKilled(enemy);
  }

  // Gang members for an ambush: they appear around a point and shoot back.
  spawnAmbush(x, z, count) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const r = 9 + Math.random() * 6;
      let ex = x + Math.sin(a) * r;
      let ez = z + Math.cos(a) * r;
      const pos = { x: ex, z: ez };
      this.world.collideCircle(pos, 0.6);
      this.world.clampToBounds(pos, 1);
      ex = pos.x;
      ez = pos.z;
      const mesh = makePersonMesh(0x8a1f2d, 0xc98d5a, 0x1c1c22);
      mesh.position.set(ex, 0, ez);
      this.scene.add(mesh);
      this.enemies.push({
        x: ex,
        z: ez,
        angle: a,
        health: CFG.enemyHealth,
        mesh,
        shootTimer: 1 + Math.random() * 1.5,
        phase: Math.random() * 6,
      });
    }
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mesh);
    this.enemies = [];
  }

  // Enemies strafe toward the player and fire with imperfect aim.
  update(dt, player, now, render) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.updateReload(dt);
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    for (const e of this.enemies) {
      const dx = px - e.x;
      const dz = pz - e.z;
      const dist = Math.hypot(dx, dz);
      e.angle = Math.atan2(dx, dz);
      // Keep a fighting distance: close in if far, back off if too close.
      let move = 0;
      if (dist > 26) move = 3.2;
      else if (dist < 10) move = -2;
      if (move !== 0) {
        const nx = e.x + Math.sin(e.angle) * move * dt;
        const nz = e.z + Math.cos(e.angle) * move * dt;
        const pos = { x: nx, z: nz };
        if (!this.world.isInsideBuilding(nx, nz, 0.6)) {
          this.world.clampToBounds(pos, 1);
          e.x = pos.x;
          e.z = pos.z;
        }
      }
      e.phase += dt * 5;
      const swing = Math.sin(e.phase) * 0.4;
      e.mesh.userData.legL.rotation.x = swing;
      e.mesh.userData.legR.rotation.x = -swing;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.angle;
      // Fire at the player.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = CFG.enemyShotInterval * (0.8 + Math.random() * 0.6);
        if (dist < CFG.enemyRange && !player.dead) {
          const origin = { x: e.x, y: 1.45, z: e.z };
          const spread = 0.09;
          const dir = {
            x: (dx / dist) + (Math.random() - 0.5) * spread * 2,
            y: (1.2 - 1.45) / dist,
            z: (dz / dist) + (Math.random() - 0.5) * spread * 2,
          };
          const len = Math.hypot(dir.x, dir.y, dir.z);
          dir.x /= len; dir.y /= len; dir.z /= len;
          const from = { x: e.x, y: 1.45, z: e.z };
          const blocked = this.blockedDistance(from, dir, dist);
          this.particles.tracer(from, {
            x: from.x + dir.x * Math.min(dist, blocked),
            y: 1.2,
            z: from.z + dir.z * Math.min(dist, blocked),
          });
          this.particles.muzzle(from, e.angle);
          this.audio.enemyShot();
          if (blocked >= dist && Math.random() < CFG.enemyShotChance) {
            player.takeDamage(CFG.enemyDamage, now);
            this.audio.hurt();
            if (render) render.addShake(0.5);
          }
        }
      }
    }
  }
}
