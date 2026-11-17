// SOLMAR — combat. The player carries a pistol (click to shoot, R to reload); rival
// gang members spawn for missions and shoot back. Shooting is a ray from the camera:
// the nearest enemy, pedestrian or police car inside a narrow cone and in range is hit.
import {
  ENEMY_DAMAGE, ENEMY_HEALTH, ENEMY_HIT_CHANCE, ENEMY_RANGE, ENEMY_SHOT_EVERY,
  KILL_PAY, PISTOL_COOLDOWN, PISTOL_DAMAGE, PISTOL_MAG, PISTOL_RANGE, RELOAD_TIME,
} from './config.js';

export function createCombat(G) {
  return {
    ammo: PISTOL_MAG, reserve: Infinity, reloading: 0, cooldown: 0,
    shotTimer: 0, flashTimer: 0, tracer: null, // {x1,y1,z1,x2,y2,z2,life}
    step(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
      if (this.reloading > 0) {
        this.reloading -= dt;
        if (this.reloading <= 0) { this.ammo = PISTOL_MAG; G.hud.setAmmo(this.ammo); }
      }
      if (this.shotTimer > 0) this.shotTimer -= dt;
      if (this.flashTimer > 0) this.flashTimer -= dt;
      if (this.tracer) {
        this.tracer.life -= dt;
        if (this.tracer.life <= 0) this.tracer = null;
      }
      // Reload on R, fire on click — only on foot.
      if (G.screen === 'play' && !G.player.inCar) {
        if (G.input.reloadPressed && this.ammo < PISTOL_MAG && this.reloading <= 0) {
          this.reloading = RELOAD_TIME;
          G.audio.reload();
        }
        if (G.input.shootPressed && this.cooldown <= 0 && this.reloading <= 0) this.shoot();
      }
      this.stepEnemies(dt);
    },
    shoot() {
      if (this.ammo <= 0) { G.audio.click(); this.reloading = RELOAD_TIME; return; }
      this.ammo -= 1;
      this.cooldown = PISTOL_COOLDOWN;
      this.shotTimer = 0.5;
      this.flashTimer = 0.07;
      G.hud.setAmmo(this.ammo);
      G.audio.shoot();
      const p = G.player;
      const ox = p.x;
      const oy = 1.6 + (p.y || 0);
      const oz = p.z;
      const yaw = G.camera.yaw;
      const pitch = G.camera.pitch;
      const dx = -Math.sin(yaw) * Math.cos(pitch);
      const dy = Math.sin(pitch);
      const dz = -Math.cos(yaw) * Math.cos(pitch);
      let best = null;
      let bestT = PISTOL_RANGE;
      const consider = (x, y, z, radius, ref) => {
        const vx = x - ox;
        const vy = y - oy;
        const vz = z - oz;
        const t = vx * dx + vy * dy + vz * dz;
        if (t < 0 || t > bestT) return;
        const px = ox + dx * t;
        const py = oy + dy * t;
        const pz = oz + dz * t;
        const d = Math.hypot(x - px, y - py, z - pz);
        if (d < radius + 0.6) { bestT = t; best = ref; }
      };
      for (const e of G.enemies) if (e.health > 0) consider(e.x, 1.2, e.z, 1.0, { kind: 'enemy', ref: e });
      for (const ped of G.peds) {
        if (ped.state === 'walk' || ped.state === 'flee') consider(ped.x, 1.2, ped.z, 0.9, { kind: 'ped', ref: ped });
      }
      const ex = ox + dx * bestT;
      const ey = oy + dy * bestT;
      const ez = oz + dz * bestT;
      this.tracer = { x1: ox + dx * 1.2, y1: oy - 0.15, z1: oz + dz * 1.2, x2: ex, y2: ey, z2: ez, life: 0.08 };
      if (best) {
        G.particles.burst(ex, ey, ez, 8, 0xff5533);
        if (best.kind === 'enemy') {
          best.ref.health -= PISTOL_DAMAGE;
          G.audio.hit();
          if (best.ref.health <= 0) {
            best.ref.state = 'dead';
            best.ref.deadTimer = 5;
            G.player.money += KILL_PAY;
            G.hud.setMoney(G.player.money);
            G.hud.toast(`Gang member down (+$${KILL_PAY})`);
            G.missions.onKill();
          }
        } else {
          best.ref.state = 'down';
          best.ref.downTimer = 10;
          G.police.addWanted(1);
          G.hud.toast('You shot a civilian — wanted level up');
        }
      } else {
        G.particles.burst(ex, ey, ez, 3, 0xcccccc);
      }
    },
    stepEnemies(dt) {
      const p = G.player;
      for (const e of G.enemies) {
        if (e.state === 'dead') {
          e.deadTimer -= dt;
          continue;
        }
        const dx = p.x - e.x;
        const dz = p.z - e.z;
        const dist = Math.hypot(dx, dz);
        if (dist < ENEMY_RANGE && !p.inCar && G.screen === 'play') {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = ENEMY_SHOT_EVERY;
            G.audio.enemyShoot();
            if (G.world.rng.chance(ENEMY_HIT_CHANCE)) {
              p.health -= ENEMY_DAMAGE;
              G.hud.setHealth(p.health);
              G.audio.hurt();
              G.hud.damageFlash();
              if (p.health <= 0) G.events.wasted = true;
            }
          }
          // Strafe: keep some distance, circle the player.
          if (dist > 14) {
            e.x += (dx / dist) * 3 * dt;
            e.z += (dz / dist) * 3 * dt;
          }
          e.heading = Math.atan2(dx, dz);
        } else {
          e.shootTimer = Math.min(e.shootTimer, 0.4);
        }
      }
      G.enemies = G.enemies.filter((e) => e.state !== 'dead' || e.deadTimer > 0);
    },
  };
}

export function spawnEnemies(G, x, z, count) {
  for (let i = 0; i < count; i += 1) {
    G.enemies.push({
      x: x + G.world.rng.range(-8, 8), z: z + G.world.rng.range(-8, 8),
      heading: 0, health: ENEMY_HEALTH, state: 'alive', shootTimer: G.world.rng.range(0.5, 1.5),
      deadTimer: 0, mesh: null,
    });
  }
}
