// SOLMAR — particles.js
// Muzzle flashes, tracer lines, sparks, smoke and hit bursts. One pooled
// THREE.Points cloud for sparks and smoke, plus a small pool of line tracers
// and a flash light — nothing allocated per shot.

import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_TRACERS = 24;

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colours = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.grav = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colours, 3));
    this.points = new THREE.Points(
      this.geo,
      new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;

    // Tracer pool: bright lines that fade out over a fraction of a second.
    this.tracers = [];
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(
        g,
        new THREE.LineBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0 }),
      );
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.tracers.push({ line, life: 0, max: 0.12, hold: false });
    }
    this.tracerCursor = 0;

    // Muzzle flash: a point light plus a small glowing quad at the barrel.
    this.flashLight = new THREE.PointLight(0xffcc66, 0, 14, 1.8);
    scene.add(this.flashLight);
    this.flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.flashMesh.visible = false;
    scene.add(this.flashMesh);
    this.flashLife = 0;
  }

  spawnOne(x, y, z, vx, vy, vz, life, r, g, b, gravity) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    this.positions[i * 3] = x;
    this.positions[i * 3 + 1] = y;
    this.positions[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.colours[i * 3] = r;
    this.colours[i * 3 + 1] = g;
    this.colours[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
  }

  burst(pos, colour, count, speed, life = 0.7, gravity = 6) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawnOne(
        pos.x, pos.y, pos.z,
        Math.cos(a) * s, up * s, Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.7),
        ((colour >> 16) & 255) / 255, ((colour >> 8) & 255) / 255, (colour & 255) / 255,
        gravity,
      );
    }
  }

  sparks(pos) {
    this.burst(pos, 0xffcc44, 14, 5, 0.5, 9);
  }

  smoke(pos) {
    this.burst(pos, 0x888888, 10, 1.5, 1.4, -0.5);
  }

  blood(pos) {
    this.burst(pos, 0xaa2222, 10, 3, 0.5, 8);
  }

  tracer(from, to, hold = false) {
    const t = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % MAX_TRACERS;
    const p = t.line.geometry.attributes.position.array;
    p[0] = from.x; p[1] = from.y; p[2] = from.z;
    p[3] = to.x; p[4] = to.y; p[5] = to.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.visible = true;
    t.line.material.opacity = 0.95;
    t.life = t.max;
    t.hold = hold;
  }

  muzzle(pos, yaw) {
    this.flashLight.position.set(pos.x, pos.y, pos.z);
    this.flashLight.intensity = 26;
    this.flashMesh.position.set(pos.x, pos.y, pos.z);
    this.flashMesh.rotation.y = yaw;
    this.flashMesh.material.opacity = 0.95;
    this.flashMesh.visible = true;
    this.flashLife = 0.07;
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    for (const t of this.tracers) {
      if (!t.line.visible) continue;
      if (t.hold) continue; // staged screenshots keep their tracer frozen
      t.life -= dt;
      if (t.life <= 0) {
        t.line.visible = false;
        continue;
      }
      t.line.material.opacity = 0.95 * (t.life / t.max);
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) {
        this.flashLight.intensity = 0;
        this.flashMesh.visible = false;
      }
    }
  }
}
