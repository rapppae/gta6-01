// SOLMAR — player.js
// The player on foot: third-person WASD movement with mouse look, sprint,
// jump, health and the car enter/exit interaction. The player is a simple
// stylised figure built from boxes — jacket, head, arms and legs that swing
// as they walk.

import * as THREE from 'three';
import { CFG } from './config.js';

export function makePersonMesh(shirtColour, skinColour = 0xd9a066, pantsColour = 0x2c3a4a) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColour });
  const skin = new THREE.MeshLambertMaterial({ color: skinColour });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColour });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirt);
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.85;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), new THREE.MeshLambertMaterial({ color: 0x1a1210 }));
  hair.position.y = 2.08;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
  legL.position.set(-0.19, 0.38, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.19;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
  armL.position.set(-0.48, 1.15, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  group.add(armR);
  // A small pistol in the right hand, visible when armed.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  gun.position.set(0.48, 0.85, 0.2);
  gun.name = 'pistol';
  group.add(gun);
  group.userData = { legL, legR, armL, armR, gun, body };
  return group;
}

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.x = 0;
    this.z = 0;
    this.y = 0; // height above ground (jump)
    this.vy = 0;
    this.yaw = Math.PI; // camera yaw: the direction the camera looks
    this.pitch = 0.3;
    this.facing = 0; // mesh facing angle
    this.vx = 0;
    this.vz = 0;
    this.speed = 0; // current horizontal speed, for HUD and probes
    this.health = CFG.playerHealth;
    this.money = CFG.startMoney;
    this.inCar = null; // the car object when driving, else null
    this.onGround = true;
    this.walkPhase = 0;
    this.lastHurtAt = -99;
    this.justLanded = false; // set on a hard landing; main.js plays the thud
    this.dead = false;
    this.mesh = makePersonMesh(0x2e6fb0);
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);
  }

  reset(spawn) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.y = 0;
    this.vy = 0;
    this.vx = 0;
    this.vz = 0;
    this.yaw = Math.PI * 0.75;
    this.health = CFG.playerHealth;
    this.dead = false;
    this.inCar = null;
    this.mesh.visible = true;
    this.syncMesh();
  }

  get pos() {
    return { x: this.x, y: this.y, z: this.z };
  }

  takeDamage(amount, now) {
    if (this.dead || this.inCar) return;
    this.health -= amount;
    this.lastHurtAt = now;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  healTick(dt, now) {
    if (this.dead) return;
    if (now - this.lastHurtAt > CFG.healthRegenDelay && this.health < CFG.playerHealth) {
      this.health = Math.min(CFG.playerHealth, this.health + CFG.healthRegenRate * dt);
    }
  }

  // Mouse look: yaw turns the camera (and the player), pitch tilts the view.
  applyLook(dx, dy, sensitivity) {
    this.yaw -= dx * sensitivity;
    this.pitch += dy * sensitivity;
    this.pitch = Math.max(-0.15, Math.min(0.9, this.pitch));
  }

  update(dt, input, now) {
    if (this.dead || this.inCar) {
      this.speed = this.inCar ? this.inCar.speed : 0;
      return;
    }
    const look = input.consumeLook();
    this.applyLook(look.dx, look.dy, CFG.mouseSensitivity);
    const axes = input.moveAxes();
    const sprint = input.sprinting();
    const topSpeed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    // Movement is relative to the camera yaw.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = -sin * axes.f + cos * axes.s;
    let mz = -cos * axes.f - sin * axes.s;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      mx /= len;
      mz /= len;
    }
    const k = 1 - Math.exp(-CFG.accelGround * dt);
    this.vx += (mx * topSpeed - this.vx) * k;
    this.vz += (mz * topSpeed - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.speed = Math.hypot(this.vx, this.vz);
    // Jump and gravity.
    if (input.isDown('Space') && this.onGround) {
      this.vy = CFG.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= CFG.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        // A hard landing (a long fall) thuds; main.js hears justLanded.
        if (this.vy < -9) this.justLanded = true;
        this.y = 0;
        this.vy = 0;
        this.onGround = true;
      }
    }
    // Collisions: buildings push the player out, the map edge stops them.
    const pos = { x: this.x, z: this.z };
    this.world.collideCircle(pos, CFG.playerRadius);
    this.world.clampToBounds(pos, CFG.playerRadius);
    this.x = pos.x;
    this.z = pos.z;
    // Face the direction of travel; idle keeps the last facing.
    if (this.speed > 0.5) this.facing = Math.atan2(this.vx, this.vz);
    this.walkPhase += this.speed * dt * 1.6;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.facing;
    const swing = this.speed > 0.5 ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    this.mesh.visible = !this.inCar;
  }

  // Try to enter the nearest car. Returns the car, or null.
  tryEnterCar(cars) {
    let best = null;
    let bestD = CFG.enterDistance;
    for (const car of cars) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (!best) return null;
    this.inCar = best;
    best.taken = true;
    best.speed = 0;
    this.mesh.visible = false;
    return best;
  }

  exitCar() {
    const car = this.inCar;
    if (!car) return;
    this.inCar = null;
    car.taken = false;
    car.speed = 0;
    // Step out on the driver's side, clear of the car and any building.
    const side = car.angle + Math.PI / 2;
    this.x = car.x + Math.sin(side) * 2.2;
    this.z = car.z + Math.cos(side) * 2.2;
    const pos = { x: this.x, z: this.z };
    this.world.collideCircle(pos, CFG.playerRadius);
    this.world.clampToBounds(pos, CFG.playerRadius);
    this.x = pos.x;
    this.z = pos.z;
    this.y = 0;
    this.facing = car.angle;
    this.syncMesh();
  }
}
