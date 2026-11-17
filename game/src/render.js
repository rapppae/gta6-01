// SOLMAR — render.js
// The three.js scene: renderer, sun, sky and the third-person chase camera.
// Nothing gameplay-specific lives here — it only shows the world and follows
// the player, on foot or in a car.

import * as THREE from 'three';
import { CFG } from './config.js';

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b8d9);
    this.scene.fog = new THREE.Fog(0x9ec4de, 160, 420);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 20, 40);

    // Sun-soaked daytime: a warm directional sun plus a soft sky fill.
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
    sun.position.set(80, 120, 40);
    this.scene.add(sun);
    const hemi = new THREE.HemisphereLight(0xbfe0f5, 0x8a7a5a, 1.1);
    this.scene.add(hemi);
    this.sun = sun;

    this.camYaw = 0;
    this.camPitch = 0.32;
    this.shake = 0;
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Follow the target from behind, smoothed. On foot the camera sits closer
  // and lower; in a car it pulls back and rises. Pitch comes from mouse look.
  follow(dt, target, yaw, pitch, inCar, speedNorm) {
    const dist = inCar ? CFG.camCarDistance + speedNorm * 3 : CFG.camDistance;
    const height = inCar ? CFG.camCarHeight : CFG.camHeight;
    const backX = Math.sin(yaw) * dist;
    const backZ = Math.cos(yaw) * dist;
    const desired = new THREE.Vector3(
      target.x + backX,
      target.y + height + pitch * 4,
      target.z + backZ,
    );
    const k = 1 - Math.exp(-CFG.camSmooth * dt);
    this.camera.position.lerp(desired, k);
    const lookAt = new THREE.Vector3(
      target.x - Math.sin(yaw) * 4,
      target.y + 1.6,
      target.z - Math.cos(yaw) * 4,
    );
    if (this.shake > 0.01) {
      lookAt.x += (Math.random() - 0.5) * this.shake;
      lookAt.y += (Math.random() - 0.5) * this.shake;
      this.shake *= Math.exp(-6 * dt);
    }
    this.camera.lookAt(lookAt);
  }

  // A fixed high view of the city, for the title screen backdrop.
  orbitView(time, centre) {
    const a = time * 0.05;
    this.camera.position.set(
      centre.x + Math.sin(a) * 90,
      55,
      centre.z + Math.cos(a) * 90,
    );
    this.camera.lookAt(centre.x, 0, centre.z);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
