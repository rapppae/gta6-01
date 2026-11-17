// SOLMAR — the screenshot scenes behind ?shot=chase|city|mission|start. Each one plays
// the real sim forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (hold W, or aim at the nearest guard and fire once), so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { LANDMARKS } from './config.js';
import { STEP } from './config.js';

function runSteps(G, stepSim, seconds, setup) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i += 1) {
    if (setup) setup(i);
    stepSim(G, STEP);
  }
}

export function stageShot(name, G, stepSim) {
  G.screen = 'play';
  if (name === 'start') {
    runSteps(G, stepSim, 5, null);
    G.shotCam = { pos: [150, 55, -260], look: [0, 8, 40] };
    G.screen = 'title';
    return { screen: 'title' };
  }
  if (name === 'chase') {
    // Mission 2, the getaway: the player tears east down 0th street in a stolen car,
    // two police cars closing in, three stars on the HUD. The car rides the right lane.
    const car = G.cars.find((c) => c.kind === 'parked');
    car.kind = 'player';
    car.x = -120; car.z = 2.5; car.heading = Math.PI / 2; car.speed = 24;
    G.player.inCar = car;
    G.player.x = car.x; G.player.z = car.z; G.player.heading = car.heading;
    G.camera.yaw = -Math.PI / 2; // camera behind, looking east
    G.camera.pitch = 0.22;
    G.missions.startMission(1);
    G.missions.stepIndex = 1; // already past the steal, driving to the getaway
    G.missions.stepTimer = 0;
    G.police.addWanted(3);
    // Two police cars ahead in formation (patrol: straight, no ramming), so the frame
    // shows the chase and the player car stays fast: one in the player's lane, one in
    // the oncoming lane being overtaken.
    const pc1 = {
      id: 900, kind: 'police', x: -100, z: -2.5,
      heading: Math.PI / 2, speed: 36, color: 0xe8e8e8, driver: null,
      axis: 'x', line: 0, dir: 1, targetSpeed: 36, steer: 0, mesh: null, lightPhase: 0, patrol: true,
    };
    const pc2 = {
      id: 901, kind: 'police', x: -85, z: 2.5,
      heading: Math.PI / 2, speed: 34, color: 0xe8e8e8, driver: null,
      axis: 'x', line: 0, dir: 1, targetSpeed: 34, steer: 0, mesh: null, lightPhase: 2, patrol: true,
    };
    // A third patrol car far ahead: it fills the wanted count (3 stars = 3 cars), so
    // the wanted system spawns no chasing car that could ram the player off the road.
    const pc3 = {
      id: 902, kind: 'police', x: -40, z: -2.5,
      heading: Math.PI / 2, speed: 38, color: 0xe8e8e8, driver: null,
      axis: 'x', line: 0, dir: 1, targetSpeed: 38, steer: 0, mesh: null, lightPhase: 4, patrol: true,
    };
    G.cars.push(pc1, pc2, pc3);
    G.input.forward = true;
    runSteps(G, stepSim, 6, null);
    G.input.forward = false;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission 3, the drop: the player on foot at the north-east corner, guards ahead,
    // one shot fired so the tracer and muzzle flash are in the frame. The player stands
    // beyond the corner looking back south-west, so the city is behind the guards.
    G.missions.startMission(2);
    G.player.x = LANDMARKS.buyer.x + 14;
    G.player.z = LANDMARKS.buyer.z + 14;
    G.player.health = 100;
    runSteps(G, stepSim, 0.5, null);
    // Aim at the nearest guard and fire LAST, so the tracer, muzzle flash and hit
    // sparks are still in the frame when it is painted (no sim steps run after this).
    let nearest = null;
    let nearestD = Infinity;
    for (const e of G.enemies) {
      const d = Math.hypot(e.x - G.player.x, e.z - G.player.z);
      if (d < nearestD) { nearestD = d; nearest = e; }
    }
    if (nearest) {
      const dx = nearest.x - G.player.x;
      const dz = nearest.z - G.player.z;
      G.camera.yaw = Math.atan2(-dx, -dz);
      G.camera.pitch = 0.02;
      G.player.heading = Math.atan2(dx, dz);
    }
    G.combat.cooldown = 0;
    G.combat.ammo = 12;
    G.combat.shoot();
    return { screen: 'play' };
  }
  // 'city' (default): mission 1, the player on foot on 0th street, walking south down
  // the right lane while traffic and pedestrians pass.
  G.missions.startMission(0);
  G.player.x = 2.5; G.player.z = 100;
  G.player.heading = 0;
  G.camera.yaw = Math.PI;
  G.camera.pitch = 0.18;
  G.input.forward = true;
  runSteps(G, stepSim, 5, null);
  G.input.forward = false;
  return { screen: 'play' };
}
