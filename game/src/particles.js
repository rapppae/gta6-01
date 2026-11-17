// SOLMAR — tiny particle pool for gun hits, muzzle sparks and impacts. The sim only
// moves numbers; render.js draws them.
export function createParticles() {
  return {
    list: [],
    burst(x, y, z, n, color) {
      for (let i = 0; i < n; i += 1) {
        if (this.list.length > 80) this.list.shift();
        this.list.push({
          x, y, z,
          vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 8,
          life: 0.5 + Math.random() * 0.3, maxLife: 0.8, color,
        });
      }
    },
    step(dt) {
      for (const p of this.list) {
        p.life -= dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vy -= 12 * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
      }
      this.list = this.list.filter((p) => p.life > 0);
    },
  };
}
