// SOLMAR — the city itself. Pure layout data: no three.js here, so the sim and the
// renderer stay separate. A road grid every 60 units, blocks with procedural buildings,
// parks and parking lots, a beach and ocean on the south edge, and the road network the
// traffic AI drives on.
import { BEACH_Z, BUILDING_COLORS, ROOF_COLORS, STREETS, WORLD_HALF } from './config.js';
import { createRandom } from './random.js';

export function createWorld(seed) {
  const rng = createRandom(seed);
  const buildings = [];
  const parks = [];
  const lots = [];
  const trees = [];
  const colliders = [];

  for (let ix = 0; ix < STREETS.length - 1; ix += 1) {
    for (let iz = 0; iz < STREETS.length - 1; iz += 1) {
      const x0 = STREETS[ix] + 7;
      const x1 = STREETS[ix + 1] - 7;
      const z0 = STREETS[iz] + 7;
      const z1 = STREETS[iz + 1] - 7;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (cz < BEACH_Z + 20) continue; // the southern row is beach, not blocks
      const roll = rng.next();
      if (roll < 0.1) {
        parks.push({ x: cx, z: cz, w: x1 - x0, d: z1 - z0 });
        for (let t = 0; t < 7; t += 1) trees.push({ x: rng.range(x0 + 4, x1 - 4), z: rng.range(z0 + 4, z1 - 4), s: rng.range(0.8, 1.4) });
        continue;
      }
      if (roll < 0.18) { lots.push({ x: cx, z: cz }); continue; }
      const count = rng.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const x = rng.range(x0 + w / 2, x1 - w / 2);
        const z = rng.range(z0 + d / 2, z1 - d / 2);
        const distCentre = Math.hypot(cx, cz);
        const h = rng.range(8, distCentre < 90 ? 42 : 22);
        const building = { x, z, w, d, h, color: rng.pick(BUILDING_COLORS), roof: rng.pick(ROOF_COLORS) };
        buildings.push(building);
        colliders.push({ x: x - w / 2, z: z - d / 2, w, d });
      }
    }
  }
  // Street trees along the sidewalks.
  for (const s of STREETS) {
    for (let t = -240; t <= 240; t += 60) {
      if (rng.chance(0.5)) trees.push({ x: s + 7.5, z: t + rng.range(-8, 8), s: rng.range(0.8, 1.3) });
      if (rng.chance(0.5)) trees.push({ x: t + rng.range(-8, 8), z: s + 7.5, s: rng.range(0.8, 1.3) });
    }
  }
  return { seed, rng, buildings, parks, lots, trees, colliders };
}

// Circle (x, z, radius) against a building AABB. Returns the push-out vector or null.
export function collideBuildings(world, x, z, r) {
  for (const c of world.colliders) {
    const nx = Math.max(c.x, Math.min(x, c.x + c.w));
    const nz = Math.max(c.z, Math.min(z, c.z + c.d));
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        return { x: (dx / d) * (r - d), z: (dz / d) * (r - d) };
      }
      return { x: 0, z: -r };
    }
  }
  return null;
}

export function clampWorld(x, z, margin) {
  return {
    x: Math.max(-WORLD_HALF + margin, Math.min(WORLD_HALF - margin, x)),
    z: Math.max(-WORLD_HALF + margin, Math.min(WORLD_HALF - margin, z)),
  };
}

// The nearest street line to a point, for traffic and for snapping spawn points.
export function nearestStreet(v) {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(s - v) < Math.abs(best - v)) best = s;
  return best;
}
