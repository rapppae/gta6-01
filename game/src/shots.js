// SOLMAR — shots.js
// Staged screenshot modes, driven by the page URL: ?shot=chase|city|mission|start
// Each mode arranges a real gameplay scene — a police chase, the player on
// foot in the city, combat at the drop point, the title screen — then sets
// window.__shotReady so the screenshot driver knows the frame is ready.
// Nothing here fakes a picture: the game itself is running in every shot.

import * as THREE from 'three';
import { CFG, PLACES } from './config.js';

export class ShotDirector {
  constructor(game) {
    this.game = game; // the whole game state G
    this.mode = null;
    this.frames = 0;
    this.ready = false;
  }

  // Read the mode from the URL. Returns null for normal play.
  static modeFromUrl() {
    const q = new URLSearchParams(window.location.search);
    return q.get('shot');
  }

  begin(mode) {
    this.mode = mode;
    this.frames = 0;
    this.ready = false;
    const G = this.game;
    G.input.shotMode = true;
    G.input.enabled = false; // staged shots ignore the keyboard
    if (mode === 'start') {
      G.screen = 'title';
      G.player.reset({ x: -20, z: 20 });
      this.finishAfter(50);
      return;
    }
    // Every gameplay shot starts a fresh run on mission 1.
    G.screen = 'playing';
    G.missions.reset();
    G.combat.clearEnemies();
    G.combat.resetAmmo();
    G.police.clearWanted(G.time);
    if (mode === 'city') {
      // On foot on the road at z=0, facing east down the street toward the beach.
      G.player.reset({ x: -40, z: 0 });
      G.player.yaw = -Math.PI / 2;
      G.player.facing = Math.PI / 2;
      G.player.syncMesh();
      this.finishAfter(45);
    } else if (mode === 'chase') {
      // The player in a fast car, three stars, three cruisers on their tail.
      const car = G.fleet.cars.find((c) => !c.driver && c.kind === 'sport')
        || G.fleet.cars.find((c) => !c.driver);
      G.player.reset({ x: -60, z: 0 });
      car.x = -60;
      car.z = 0;
      car.angle = Math.PI / 2; // heading east down the road
      car.speed = 22;
      car.taken = true;
      G.player.inCar = car;
      G.player.mesh.visible = false;
      G.player.yaw = car.angle + Math.PI;
      G.police.addWanted(3, G.time);
      G.police.maintainChasers(G.player);
      // Put the chasers right behind the player, already in pursuit.
      for (let i = 0; i < 3; i++) {
        const chaser = G.police.chasers[i];
        if (!chaser) break;
        chaser.x = -60 - (i + 1) * 9;
        chaser.z = (i - 1) * 4;
        chaser.angle = Math.PI / 2;
        chaser.speed = 20;
      }
      this.finishAfter(50);
    } else if (mode === 'mission') {
      // Combat at the Palm Court drop: mission 3, ambush live, the player
      // firing — with a tracer and muzzle flash frozen in the frame.
      // Camera yaw 1.97 looks from the player toward the drop point, with
      // the beacon in the open intersection behind the ambush.
      G.player.reset({ x: PLACES.dropPoint.x + 14, z: PLACES.dropPoint.z - 6 });
      G.player.yaw = 1.97;
      G.player.facing = -1.17;
      G.player.syncMesh();
      G.missions.index = 2;
      G.missions.stepIndex = 1; // the ambush step
      G.missions.startedFlags = { m2: true };
      // Clear the foreground: any car near the player or the camera would
      // block the shot, so move it down the road.
      for (const car of G.fleet.cars) {
        if (Math.hypot(car.x - G.player.x, car.z - G.player.z) < 18) {
          car.x = THREE.MathUtils.clamp(car.x + 70, -170, 170);
          car.mesh.position.set(car.x, 0, car.z);
        }
      }
      G.combat.spawnAmbush(PLACES.dropPoint.x, PLACES.dropPoint.z, 4);
      // A live shot, frozen: tracer held, muzzle flash visible.
      const from = { x: G.player.x, y: 1.5, z: G.player.z };
      const target = G.combat.enemies[0];
      const dir = { x: 0, y: 0, z: 0 };
      if (target) {
        const dx = target.x - from.x;
        const dz = target.z - from.z;
        const len = Math.hypot(dx, dz);
        dir.x = dx / len;
        dir.z = dz / len;
        dir.y = -0.03;
        G.combat.shoot(from, dir, 'player');
        // Hold the tracer so the frame keeps it.
        for (const t of G.particles.tracers) t.hold = true;
        G.particles.flashMesh.visible = true;
        G.particles.flashMesh.material.opacity = 0.95;
        G.particles.flashMesh.position.set(from.x + dir.x, 1.5, from.z + dir.z);
        G.particles.flashLight.intensity = 26;
        G.particles.flashLight.position.set(from.x + dir.x, 1.5, from.z + dir.z);
      }
      this.finishAfter(40);
    } else {
      this.finishAfter(30);
    }
  }

  finishAfter(frames) {
    this.finishAt = frames;
  }

  // Called once per rendered frame by the main loop.
  tick() {
    if (!this.mode || this.ready) return;
    this.frames += 1;
    // In the mission shot the muzzle flash must stay visible until the frame
    // is taken, so re-light it every frame (particles would fade it).
    if (this.mode === 'mission') {
      const G = this.game;
      const fx = Math.sin(G.player.facing);
      const fz = Math.cos(G.player.facing);
      const mx = G.player.x + fx * 0.9;
      const mz = G.player.z + fz * 0.9;
      G.particles.flashMesh.visible = true;
      G.particles.flashMesh.material.opacity = 0.95;
      G.particles.flashMesh.position.set(mx, 1.5, mz);
      // Face the camera and enlarge it, so the flash reads in the frame.
      G.particles.flashMesh.rotation.y = G.player.yaw;
      G.particles.flashMesh.scale.set(1.2, 1.2, 1.2);
      G.particles.flashLight.intensity = 26;
      G.particles.flashLight.position.set(mx, 1.5, mz);
      // Keep the flash alive: particles.update hides it once flashLife runs
      // out, and the tick runs after the render, so pin the timer up here.
      G.particles.flashLife = 1;
    }
    // In the chase shot the car must stay at speed with the cruisers in
    // formation behind it, so re-assert both every frame (drag and ramming
    // would otherwise pile the chase up before the frame is taken).
    if (this.mode === 'chase') {
      const G = this.game;
      const car = G.player.inCar;
      if (car) {
        car.speed = 22;
        const fx = Math.sin(car.angle);
        const fz = Math.cos(car.angle);
        G.police.chasers.forEach((chaser, i) => {
          // Two cruisers flank the player car, one trails behind near the
          // camera: the chase reads at a glance.
          const slots = [
            { back: 6, side: -5.5 },
            { back: 8, side: 5.5 },
            { back: 24, side: -2 },
          ];
          const slot = slots[i] || { back: 30, side: 0 };
          chaser.x = car.x - fx * slot.back - fz * slot.side;
          chaser.z = car.z - fz * slot.back + fx * slot.side;
          chaser.angle = car.angle;
          chaser.speed = 21;
          chaser.mesh.position.set(chaser.x, 0, chaser.z);
          chaser.mesh.rotation.y = chaser.angle;
        });
      }
    }
    if (this.frames >= (this.finishAt || 40)) {
      this.ready = true;
      window.__shotReady = true;
    }
  }
}
