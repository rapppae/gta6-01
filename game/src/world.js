// SOLMAR — world.js
// Builds the city of Solmar and answers the questions the rest of the game
// asks about it: is this point on a road, inside a building, or off the map?
// The city is a street grid with sidewalks, varied buildings, a beach and sea
// along the east edge, palm trees, streetlights and traffic lights. Daytime,
// sun-soaked, all procedural — no loaded textures or models.

import * as THREE from 'three';
import { CFG } from './config.js';
import { PALETTE } from './random.js';

// A small canvas texture that looks like lit windows on a facade. Generated
// at runtime, so the game loads no image file.
export function makeFacadeTexture(rng, baseColour) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = `#${baseColour.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      const lit = rng.chance(0.35);
      g.fillStyle = lit ? '#ffe9a8' : '#2c3a4a';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class CityWorld {
  constructor(scene, rng) {
    this.scene = scene;
    this.rng = rng;
    this.buildings = []; // {x, z, hw, hd, h} axis-aligned boxes
    this.palms = [];
    this.trafficLights = []; // {x, z, axis, state}
    this.group = new THREE.Group();
    this.group.name = 'solmar-city';
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildStreetProps();
    this.buildTrafficLights();
  }

  // ---- construction ----

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.worldHalf * 2 + 90, CFG.worldHalf * 2 + 90),
      new THREE.MeshLambertMaterial({ color: 0x9db38a }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, -0.05, 0);
    ground.receiveShadow = false;
    this.group.add(ground);
    // City slab: warm pavement under the whole grid.
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.worldHalf * 2, CFG.worldHalf * 2),
      new THREE.MeshLambertMaterial({ color: 0xb8b0a0 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.y = 0;
    this.group.add(slab);
  }

  buildRoads() {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
    const dashMat = new THREE.MeshLambertMaterial({ color: 0xf5e9c8 });
    const size = CFG.worldHalf * 2;
    for (const c of CFG.roadCoords) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadHalf * 2, size), roadMat);
      v.rotation.x = -Math.PI / 2;
      v.position.set(c, 0.02, 0);
      this.group.add(v);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(size, CFG.roadHalf * 2), roadMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(0, 0.02, c);
      this.group.add(h);
      // Centre dashes along each road.
      for (let t = -CFG.worldHalf + 10; t < CFG.worldHalf; t += 12) {
        const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
        d1.rotation.x = -Math.PI / 2;
        d1.position.set(c, 0.04, t);
        this.group.add(d1);
        const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        d2.rotation.x = -Math.PI / 2;
        d2.position.set(t, 0.04, c);
        this.group.add(d2);
      }
    }
  }

  buildBlocks() {
    const blockCentres = [];
    for (let i = 0; i < CFG.roadCoords.length - 1; i++) {
      blockCentres.push((CFG.roadCoords[i] + CFG.roadCoords[i + 1]) / 2);
    }
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const bx of blockCentres) {
      for (const bz of blockCentres) {
        if (bx > 150) continue; // the east strip is beach, not blocks
        const count = this.rng.int(1, 3);
        for (let k = 0; k < count; k++) {
          const w = this.rng.range(10, 20);
          const d = this.rng.range(10, 20);
          const h = this.rng.range(6, 42) * (this.rng.chance(0.12) ? 1.8 : 1);
          const ox = this.rng.range(-6, 6);
          const oz = this.rng.range(-6, 6);
          const x = bx + ox;
          const z = bz + oz;
          const colour = this.rng.colour(PALETTE.buildings);
          const mat = new THREE.MeshLambertMaterial({ map: makeFacadeTexture(this.rng, colour) });
          const mesh = new THREE.Mesh(boxGeo, mat);
          mesh.scale.set(w, h, d);
          mesh.position.set(x, h / 2, z);
          this.group.add(mesh);
          // Flat roof cap, slightly darker.
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4),
            new THREE.MeshLambertMaterial({ color: 0x5a5148 }),
          );
          roof.position.set(x, h + 0.25, z);
          this.group.add(roof);
          this.buildings.push({ x, z, hw: w / 2, hd: d / 2, h });
        }
      }
    }
  }

  buildBeach() {
    // Sand strip along the east edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(22, CFG.worldHalf * 2 + 40),
      new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(CFG.beachX + 6, 0.03, 0);
    this.group.add(sand);
    // The sea, a big flat blue plane with a lighter shore band.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(90, CFG.worldHalf * 2 + 90),
      new THREE.MeshLambertMaterial({ color: 0x2e8fc0 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(CFG.waterX + 42, 0.01, 0);
    this.group.add(sea);
    const shore = new THREE.Mesh(
      new THREE.PlaneGeometry(4, CFG.worldHalf * 2 + 40),
      new THREE.MeshLambertMaterial({ color: 0x7fd0e8 }),
    );
    shore.rotation.x = -Math.PI / 2;
    shore.position.set(CFG.waterX, 0.02, 0);
    this.group.add(shore);
    // A wooden pier jutting into the sea.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
    for (let i = 0; i < 10; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 6), pierMat);
      plank.position.set(CFG.waterX + 4 + i * 3.4, 0.6, -60);
      this.group.add(plank);
    }
  }

  buildStreetProps() {
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const leafGeo = new THREE.ConeGeometry(2.2, 3.2, 6);
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333a40 });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
    for (const bx of [-140, -100, -60, -20, 20, 60, 100, 140]) {
      for (const bz of [-140, -100, -60, -20, 20, 60, 100, 140]) {
        if (this.rng.chance(0.5)) {
          const palm = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 3;
          trunk.rotation.z = this.rng.range(-0.12, 0.12);
          palm.add(trunk);
          for (let l = 0; l < 5; l++) {
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            const a = (l / 5) * Math.PI * 2;
            leaf.position.set(Math.cos(a) * 1.2, 6.4, Math.sin(a) * 1.2);
            leaf.rotation.z = Math.cos(a) * 1.1;
            leaf.rotation.x = -Math.sin(a) * 1.1;
            palm.add(leaf);
          }
          palm.position.set(bx + this.rng.range(-8, 8), 0, bz + this.rng.range(-8, 8));
          this.group.add(palm);
          this.palms.push(palm);
        }
        if (this.rng.chance(0.6)) {
          const pole = new THREE.Mesh(poleGeo, poleMat);
          pole.position.set(bx + 8.5, 3.5, bz + 8.5);
          this.group.add(pole);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
          lamp.position.set(bx + 8.5, 7.1, bz + 8.5);
          this.group.add(lamp);
        }
      }
    }
    // Beach palms along the sand.
    for (let z = -160; z <= 160; z += 26) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3;
      palm.add(trunk);
      const top = new THREE.Mesh(leafGeo, leafMat);
      top.position.y = 6.6;
      palm.add(top);
      palm.position.set(CFG.beachX + 3, 0, z + this.rng.range(-4, 4));
      this.group.add(palm);
    }
  }

  buildTrafficLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x222831 });
    for (const x of CFG.roadCoords) {
      for (const z of CFG.roadCoords) {
        if (Math.abs(x) > 120 || Math.abs(z) > 120) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), poleMat);
        pole.position.set(x + 7, 2.5, z + 7);
        this.group.add(pole);
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1.8, 0.7),
          new THREE.MeshLambertMaterial({ color: 0x111418 }),
        );
        box.position.set(x + 7, 5.4, z + 7);
        this.group.add(box);
        const lampGeo = new THREE.SphereGeometry(0.22, 8, 6);
        const red = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        red.position.set(x + 7, 5.9, z + 7.35);
        const green = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x22cc44 }));
        green.position.set(x + 7, 5.0, z + 7.35);
        this.group.add(red);
        this.group.add(green);
        this.trafficLights.push({ x: x + 7, z: z + 7, axis: 'x', red, green, phase: 0 });
      }
    }
  }

  // ---- queries used by the rest of the game ----

  isOnRoad(x, z) {
    for (const c of CFG.roadCoords) {
      if (Math.abs(x - c) < CFG.roadHalf || Math.abs(z - c) < CFG.roadHalf) return true;
    }
    return false;
  }

  nearestRoadCoord(v) {
    let best = CFG.roadCoords[0];
    for (const c of CFG.roadCoords) if (Math.abs(c - v) < Math.abs(best - v)) best = c;
    return best;
  }

  isInsideBuilding(x, z, pad = 0) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.hw + pad && Math.abs(z - b.z) < b.hd + pad) return true;
    }
    return false;
  }

  // Push a circle out of every building it overlaps. Returns true if it hit.
  collideCircle(pos, radius) {
    let hit = false;
    for (const b of this.buildings) {
      const dx = pos.x - b.x;
      const dz = pos.z - b.z;
      const ox = b.hw + radius - Math.abs(dx);
      const oz = b.hd + radius - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        hit = true;
        if (ox < oz) pos.x = b.x + Math.sign(dx || 1) * (b.hw + radius);
        else pos.z = b.z + Math.sign(dz || 1) * (b.hd + radius);
      }
    }
    return hit;
  }

  clampToBounds(pos, radius = 0) {
    const lim = CFG.worldHalf - radius;
    pos.x = Math.max(-lim, Math.min(lim, pos.x));
    pos.z = Math.max(-lim, Math.min(lim, pos.z));
  }

  // Cycle the traffic lights: one axis green at a time, flipping every 6 s.
  updateLights(time) {
    const greenX = Math.floor(time / 6) % 2 === 0;
    for (const light of this.trafficLights) {
      const green = light.axis === 'x' ? greenX : !greenX;
      light.red.material.color.setHex(green ? 0x551111 : 0xff2222);
      light.green.material.color.setHex(green ? 0x22cc44 : 0x113311);
    }
    return greenX;
  }

  // Is the light green for cars travelling along the given axis right now?
  lightGreenFor(axis, time) {
    const greenX = Math.floor(time / 6) % 2 === 0;
    return axis === 'x' ? greenX : !greenX;
  }
}
