// SOLMAR — pedestrians. They stroll the sidewalks between random waypoints, flee
// when a gun goes off or a crime happens nearby, and go down when a car hits them.
// A traffic car's driver rides inside it until the car is stolen.
import { PED_SHIRTS, STREETS } from './config.js';

export function createPeds(G) {
  const peds = [];
  for (let i = 0; i < 14; i += 1) {
    const street = G.world.rng.pick(STREETS);
    const along = G.world.rng.range(-240, 240);
    const horizontal = G.world.rng.chance(0.5);
    peds.push({
      x: horizontal ? along : street + 7.5, z: horizontal ? street + 7.5 : along,
      heading: G.world.rng.range(0, Math.PI * 2), state: 'walk',
      color: G.world.rng.pick(PED_SHIRTS), speed: G.world.rng.range(1.4, 2.6),
      target: null, downTimer: 0, mesh: null,
    });
  }
  return peds;
}

function randomSidewalkPoint(G) {
  const street = G.world.rng.pick(STREETS);
  const along = G.world.rng.range(-240, 240);
  if (G.world.rng.chance(0.5)) return { x: along, z: street + 7.5 };
  return { x: street + 7.5, z: along };
}

export function stepPeds(G, dt) {
  const p = G.player;
  // Drivers ride inside their cars.
  for (const car of G.cars) {
    if (car.driver && car.driver.state === 'driver') {
      car.driver.x = car.x;
      car.driver.z = car.z;
      car.driver.heading = car.heading;
    }
  }
  for (const ped of G.peds) {
    if (ped.state === 'driver') continue;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.state = 'flee'; ped.target = null; }
      continue;
    }
    if (ped.state === 'flee') {
      const dx = ped.x - p.x;
      const dz = ped.z - p.z;
      const d = Math.hypot(dx, dz) || 1;
      ped.heading = Math.atan2(dx / d, dz / d);
      ped.x += Math.sin(ped.heading) * 5 * dt;
      ped.z += Math.cos(ped.heading) * 5 * dt;
      if (d > 45) { ped.state = 'walk'; ped.target = null; }
      continue;
    }
    // Walk: pick a waypoint, stroll to it, pick another.
    if (!ped.target) ped.target = randomSidewalkPoint(G);
    const dx = ped.target.x - ped.x;
    const dz = ped.target.z - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.5) { ped.target = null; continue; }
    ped.heading = Math.atan2(dx / d, dz / d);
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    // A gunshot or a wanted level nearby makes people run.
    const pd = Math.hypot(p.x - ped.x, p.z - ped.z);
    if ((G.combat.shotTimer > 0 && pd < 30) || (G.police.level > 0 && pd < 12)) {
      ped.state = 'flee';
      ped.target = null;
    }
  }
}
