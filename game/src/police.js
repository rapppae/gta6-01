// SOLMAR — the wanted level and the police. Crimes raise it, quiet time lowers it,
// and one police car per star (up to three) spawns on the road grid and chases the player.
import { POLICE_MAX_CARS, STREETS, WANTED_DECAY_EVERY, WANTED_DECAY_QUIET, WANTED_MAX } from './config.js';
import { makeCar } from './vehicles.js';

export function createPolice(G) {
  return {
    level: 0,
    quietTimer: 0,
    decayTimer: 0,
    addWanted(n) {
      const before = this.level;
      this.level = Math.min(WANTED_MAX, this.level + n);
      this.quietTimer = 0;
      if (this.level > before) G.hud.setStars(this.level);
    },
    step(dt) {
      if (this.level === 0) { this.quietTimer = 0; return; }
      this.quietTimer += dt;
      if (this.quietTimer > WANTED_DECAY_QUIET) {
        this.decayTimer += dt;
        if (this.decayTimer > WANTED_DECAY_EVERY) {
          this.decayTimer = 0;
          this.level -= 1;
          G.hud.setStars(this.level);
          if (this.level === 0) G.hud.toast('You lost the cops');
        }
      }
      // Keep the right number of police cars on the road.
      const want = Math.min(this.level, POLICE_MAX_CARS);
      const have = G.cars.filter((c) => c.kind === 'police').length;
      if (have < want) {
        const p = G.player;
        const street = G.world.rng.pick(STREETS);
        const along = G.world.rng.range(-240, 240);
        const horizontal = G.world.rng.chance(0.5);
        let x = horizontal ? along : street;
        let z = horizontal ? street : along;
        // Spawn at least 50 units away so they do not appear on top of the player.
        if (Math.hypot(x - p.x, z - p.z) < 50) { x = p.x + 70; z = p.z + 20; }
        const car = makeCar(G, 'police', x, z, 0, 0xe8e8e8);
        car.speed = 10;
        G.cars.push(car);
      } else if (have > want) {
        const idx = G.cars.findIndex((c) => c.kind === 'police');
        if (idx >= 0) G.cars.splice(idx, 1);
      }
    },
  };
}
