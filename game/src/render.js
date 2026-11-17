// SOLMAR — the three.js renderer. Builds the city once from world data (one canvas
// texture for the whole ground: roads, lines, sidewalks, parks, beach), then every frame
// syncs meshes to sim state and places a third-person camera behind the player or the car.
import * as THREE from 'three';
import { BEACH_Z, STREETS, WORLD_HALF } from './config.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}

function groundTexture(world) {
  const S = 1024 / (WORLD_HALF * 2);
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const X = (x) => (x + WORLD_HALF) * S;
  const Z = (z) => (z + WORLD_HALF) * S;
  g.fillStyle = '#8f8a7c'; g.fillRect(0, 0, 1024, 1024);
  // Parks.
  g.fillStyle = '#4f7a3a';
  for (const p of world.parks) g.fillRect(X(p.x - p.w / 2), Z(p.z - p.d / 2), p.w * S, p.d * S);
  // Beach strip on the south edge.
  g.fillStyle = '#e0c98f';
  g.fillRect(0, 0, 1024, Z(BEACH_Z + 20));
  // Roads.
  g.fillStyle = '#33363d';
  for (const s of STREETS) {
    g.fillRect(0, Z(s - 5), 1024, 10 * S);
    g.fillRect(X(s - 5), 0, 10 * S, 1024);
  }
  // Sidewalks: lighter strips hugging each road.
  g.fillStyle = '#b5b0a0';
  for (const s of STREETS) {
    g.fillRect(0, Z(s - 7), 1024, 2 * S);
    g.fillRect(0, Z(s + 5), 1024, 2 * S);
    g.fillRect(X(s - 7), 0, 2 * S, 1024);
    g.fillRect(X(s + 5), 0, 2 * S, 1024);
  }
  // Centre dashes.
  g.fillStyle = '#f2c14e';
  for (const s of STREETS) {
    for (let t = -285; t < 285; t += 12) {
      g.fillRect(X(t), Z(s) - 0.5 * S, 6 * S, 1 * S);
      g.fillRect(X(s) - 0.5 * S, Z(t), 1 * S, 6 * S);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function buildCarMesh(car) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(unitBox, mat(car.color));
  body.scale.set(2, 0.8, 4.4);
  body.position.y = 0.7;
  group.add(body);
  const cabin = new THREE.Mesh(unitBox, mat(0x1c2733));
  cabin.scale.set(1.7, 0.7, 2.2);
  cabin.position.set(0, 1.4, -0.2);
  group.add(cabin);
  const wheelMat = mat(0x111111);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(unitBox, wheelMat);
    wheel.scale.set(0.3, 0.6, 0.9);
    wheel.position.set(wx, 0.35, wz);
    group.add(wheel);
  }
  const lightMat = mat(0xfff6c0);
  for (const wx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(unitBox, lightMat);
    lamp.scale.set(0.5, 0.2, 0.15);
    lamp.position.set(wx, 0.7, 2.22);
    group.add(lamp);
  }
  if (car.kind === 'police') {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.scale.set(0.5, 0.22, 0.4); red.position.x = -0.4;
    const blue = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.scale.set(0.5, 0.22, 0.4); blue.position.x = 0.4;
    bar.add(red); bar.add(blue);
    bar.position.set(0, 1.85, -0.2);
    bar.userData.red = red; bar.userData.blue = blue;
    group.add(bar);
    group.userData.lightBar = bar;
  }
  group.userData.car = car;
  return group;
}

function buildPersonMesh(shirtColor, withGun) {
  const group = new THREE.Group();
  const torso = new THREE.Mesh(unitBox, mat(shirtColor));
  torso.scale.set(0.7, 0.8, 0.4);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(unitBox, mat(0xe8b98a));
  head.scale.set(0.42, 0.42, 0.42);
  head.position.y = 1.68;
  group.add(head);
  const legMat = mat(0x2c3e50);
  const legL = new THREE.Mesh(unitBox, legMat);
  legL.scale.set(0.24, 0.6, 0.24); legL.position.set(-0.18, 0.3, 0);
  const legR = new THREE.Mesh(unitBox, legMat);
  legR.scale.set(0.24, 0.6, 0.24); legR.position.set(0.18, 0.3, 0);
  group.add(legL); group.add(legR);
  group.userData.legL = legL; group.userData.legR = legR;
  if (withGun) {
    const gun = new THREE.Mesh(unitBox, mat(0x111111));
    gun.scale.set(0.09, 0.14, 0.55);
    gun.position.set(0.4, 1.15, 0.3);
    group.add(gun);
  }
  return group;
}

export function createRenderer(canvas, G) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 800, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3e0, 120, 650);
  const camera = new THREE.PerspectiveCamera(70, (canvas.clientWidth || 1280) / (canvas.clientHeight || 800), 0.1, 1200);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x77694f, 1.15));
  const sun = new THREE.DirectionalLight(0xffe7c2, 1.6);
  sun.position.set(180, 260, -120);
  scene.add(sun);

  // Ground: grass beyond the city, the textured city plane, ocean to the south.
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat(0x5d7a45));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.15;
  scene.add(grass);
  const city = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_HALF * 2, WORLD_HALF * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture(G.world) }),
  );
  city.rotation.x = -Math.PI / 2; city.position.y = 0;
  scene.add(city);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), mat(0x1e6f9f));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, -0.3, -WORLD_HALF - 250);
  scene.add(ocean);

  // Buildings + roofs.
  for (const b of G.world.buildings) {
    const mesh = new THREE.Mesh(unitBox, mat(b.color));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
    const roof = new THREE.Mesh(unitBox, mat(b.roof));
    roof.scale.set(b.w + 0.6, 0.5, b.d + 0.6);
    roof.position.set(b.x, b.h + 0.25, b.z);
    scene.add(roof);
  }
  // Trees as instanced meshes.
  const trees = G.world.trees;
  if (trees.length > 0) {
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 5), mat(0x6b4a2b), trees.length);
    const canopy = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5, 3.4, 6), mat(0x3e7a34), trees.length);
    const m = new THREE.Matrix4();
    trees.forEach((t, i) => {
      m.makeTranslation(t.x, 0.9 * t.s, t.z); m.scale(new THREE.Vector3(t.s, t.s, t.s));
      trunk.setMatrixAt(i, m);
      m.makeTranslation(t.x, (1.8 + 1.6) * t.s, t.z); m.scale(new THREE.Vector3(t.s, t.s, t.s));
      canopy.setMatrixAt(i, m);
    });
    scene.add(trunk); scene.add(canopy);
  }
  // Mission beacon.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 50, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb400, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beacon.position.y = 25;
  scene.add(beacon);
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 2.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  beaconRing.rotation.x = -Math.PI / 2; beaconRing.position.y = 0.1;
  scene.add(beaconRing);
  // Tracer bolt (a thin box, so it reads at a glance) + muzzle flash.
  const tracer = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
  tracer.visible = false;
  scene.add(tracer);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcc44 }));
  flash.visible = false;
  scene.add(flash);
  // Particles.
  const pGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const particles = new THREE.InstancedMesh(pGeo, pMat, 80);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(particles);

  const playerMesh = buildPersonMesh(0x2a9d8f, true);
  scene.add(playerMesh);
  const carMeshes = new Map();
  const pedMeshes = new Map();
  const enemyMeshes = new Map();
  const dummy = new THREE.Object3D();
  let legPhase = 0;

  function syncCars() {
    const seen = new Set();
    for (const car of G.cars) {
      seen.add(car.id);
      let mesh = carMeshes.get(car.id);
      if (!mesh) { mesh = buildCarMesh(car); carMeshes.set(car.id, mesh); scene.add(mesh); }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      if (mesh.userData.lightBar) {
        const on = Math.sin(car.lightPhase) > 0;
        mesh.userData.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
        mesh.userData.lightBar.userData.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
    }
    for (const [id, mesh] of carMeshes) {
      if (!seen.has(id)) { scene.remove(mesh); carMeshes.delete(id); }
    }
  }
  function syncPeople(list, map, shirt, withGun, isEnemy) {
    const seen = new Set();
    for (const person of list) {
      if (person.state === 'driver') continue;
      seen.add(person);
      let mesh = map.get(person);
      if (!mesh) {
        mesh = buildPersonMesh(isEnemy ? 0xc0392b : person.color, withGun);
        map.set(person, mesh);
        scene.add(mesh);
      }
      const down = person.state === 'down' || person.state === 'dead';
      mesh.position.set(person.x, down ? 0.35 : 0, person.z);
      mesh.rotation.set(down ? Math.PI / 2 : 0, person.heading, 0);
      if (!down && person.state === 'walk') {
        legPhase += 0.02;
        mesh.userData.legL.rotation.x = Math.sin(legPhase) * 0.4;
        mesh.userData.legR.rotation.x = -Math.sin(legPhase) * 0.4;
      }
    }
    for (const [person, mesh] of map) {
      if (!seen.has(person)) { scene.remove(mesh); map.delete(person); }
    }
  }

  return {
    render(dt) {
      syncCars();
      syncPeople(G.peds, pedMeshes, null, false, false);
      syncPeople(G.enemies, enemyMeshes, null, true, true);
      // Player mesh.
      const p = G.player;
      if (p.inCar) {
        playerMesh.visible = false;
      } else {
        playerMesh.visible = true;
        playerMesh.position.set(p.x, p.y, p.z);
        playerMesh.rotation.y = p.heading;
        if (p.moving) {
          legPhase += p.speed * dt * 1.6;
          playerMesh.userData.legL.rotation.x = Math.sin(legPhase) * 0.55;
          playerMesh.userData.legR.rotation.x = -Math.sin(legPhase) * 0.55;
        } else {
          playerMesh.userData.legL.rotation.x = 0;
          playerMesh.userData.legR.rotation.x = 0;
        }
      }
      // Beacon at the current mission target.
      const target = G.missions.target();
      if (target) {
        beacon.visible = true; beaconRing.visible = true;
        beacon.position.set(target.x, 25, target.z);
        beaconRing.position.set(target.x, 0.1, target.z);
        beacon.material.opacity = 0.1 + Math.sin(G.time * 4) * 0.04;
      } else {
        beacon.visible = false; beaconRing.visible = false;
      }
      // Tracer bolt + muzzle flash.
      const tr = G.combat.tracer;
      if (tr) {
        tracer.visible = true;
        const mx = (tr.x1 + tr.x2) / 2;
        const my = (tr.y1 + tr.y2) / 2;
        const mz = (tr.z1 + tr.z2) / 2;
        const len = Math.hypot(tr.x2 - tr.x1, tr.y2 - tr.y1, tr.z2 - tr.z1);
        tracer.position.set(mx, my, mz);
        tracer.lookAt(tr.x2, tr.y2, tr.z2);
        tracer.scale.set(0.25, 0.25, Math.max(0.1, len));
      } else tracer.visible = false;
      if (G.combat.flashTimer > 0 && !p.inCar) {
        flash.visible = true;
        const fx = p.x - Math.sin(G.camera.yaw) * 1.0 + Math.cos(G.camera.yaw) * 0.45;
        const fz = p.z - Math.cos(G.camera.yaw) * 1.0 - Math.sin(G.camera.yaw) * 0.45;
        flash.position.set(fx, 1.5 + (p.y || 0), fz);
      } else flash.visible = false;
      // Particles.
      let i = 0;
      for (const pt of G.particles.list) {
        if (i >= 80) break;
        const s = 0.4 + (pt.life / pt.maxLife) * 0.8;
        dummy.position.set(pt.x, pt.y, pt.z);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
        particles.setColorAt(i, new THREE.Color(pt.color));
        i += 1;
      }
      for (; i < 80; i += 1) {
        dummy.position.set(0, -10, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
      // Camera: third person, or the shot override.
      if (G.shotCam) {
        camera.position.set(G.shotCam.pos[0], G.shotCam.pos[1], G.shotCam.pos[2]);
        camera.lookAt(G.shotCam.look[0], G.shotCam.look[1], G.shotCam.look[2]);
      } else {
        const focus = p.inCar ? p.inCar : p;
        const dist = p.inCar ? 10 : 7;
        const pitch = G.camera.pitch;
        const yaw = G.camera.yaw;
        const cosP = Math.cos(pitch);
        const tx = focus.x + Math.sin(yaw) * cosP * dist;
        const ty = (focus.y || 0) + 2 + Math.sin(pitch) * dist;
        const tz = focus.z + Math.cos(yaw) * cosP * dist;
        const k = 1 - Math.exp(-12 * dt);
        camera.position.x += (tx - camera.position.x) * k;
        camera.position.y += (ty - camera.position.y) * k;
        camera.position.z += (tz - camera.position.z) * k;
        camera.lookAt(focus.x - Math.sin(yaw) * 3, (focus.y || 0) + 1.5, focus.z - Math.cos(yaw) * 3);
      }
      renderer.render(scene, camera);
    },
    resize() {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 800;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
  };
}
