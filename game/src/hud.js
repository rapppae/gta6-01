// SOLMAR — the HUD: health, money, wanted stars, objective, speed, ammo, the minimap
// and the toast line. All DOM, updated from sim state; the minimap is a 2D canvas drawn
// top-down from the same world data the 3D renderer uses.
import { STREETS, WORLD_HALF } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHUD() {
  const hud = {
    toastTimer: null,
    setHealth(v) {
      const el = $('health-fill');
      if (el) el.style.width = `${Math.max(0, Math.min(100, v))}%`;
      const t = $('health-text');
      if (t) t.textContent = `${Math.max(0, Math.ceil(v))}`;
    },
    setMoney(v) { const el = $('money'); if (el) el.textContent = `$${Math.floor(v).toLocaleString('en-US')}`; },
    setStars(n) {
      const el = $('stars');
      if (!el) return;
      el.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
      el.classList.toggle('hot', n > 0);
    },
    setObjective(text) { const el = $('objective'); if (el) el.textContent = text; },
    setMission(name) { const el = $('mission-name'); if (el) el.textContent = name; },
    setAmmo(n) { const el = $('ammo'); if (el) el.textContent = n === Infinity ? '∞' : String(n); },
    setSpeed(kmh) {
      const el = $('speed');
      if (!el) return;
      el.textContent = kmh > 0 ? `${Math.round(kmh)} km/h` : '';
    },
    setCrosshair(v) { const el = $('crosshair'); if (el) el.style.display = v ? 'block' : 'none'; },
    toast(text) {
      const el = $('toast');
      if (!el) return;
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
    },
    damageFlash() {
      const el = $('damage-vignette');
      if (!el) return;
      el.classList.add('show');
      setTimeout(() => el.classList.remove('show'), 180);
    },
    showScreen(name) {
      for (const id of ['title-screen', 'pause-screen', 'end-screen']) {
        const el = $(id);
        if (el) el.classList.toggle('hidden', id !== `${name}-screen`);
      }
      const hudEl = $('hud');
      if (hudEl) hudEl.classList.toggle('hidden', name === 'title');
    },
    setEnd(title, body) {
      const t = $('end-title');
      if (t) t.textContent = title;
      const b = $('end-body');
      if (b) b.textContent = body;
    },
    drawMinimap(G) {
      const canvas = $('minimap');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const S = canvas.width / (WORLD_HALF * 2);
      const toX = (x) => (x + WORLD_HALF) * S;
      const toY = (z) => (z + WORLD_HALF) * S;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(20, 28, 22, 0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Beach strip at the south edge.
      ctx.fillStyle = '#c9b078';
      ctx.fillRect(0, 0, canvas.width, (30 / 600) * canvas.height);
      // Roads.
      ctx.strokeStyle = '#6a6f78';
      ctx.lineWidth = Math.max(2, 10 * S);
      for (const s of STREETS) {
        ctx.beginPath(); ctx.moveTo(toX(-WORLD_HALF), toY(s)); ctx.lineTo(toX(WORLD_HALF), toY(s)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(toX(s), toY(-WORLD_HALF)); ctx.lineTo(toX(s), toY(WORLD_HALF)); ctx.stroke();
      }
      // Buildings.
      ctx.fillStyle = '#3a3f47';
      for (const b of G.world.buildings) ctx.fillRect(toX(b.x - b.w / 2), toY(b.z - b.d / 2), b.w * S, b.d * S);
      // Mission target: a pulsing diamond.
      const target = G.missions.target();
      if (target) {
        const pulse = 3 + Math.sin(G.time * 5) * 1.5;
        ctx.fillStyle = '#ffd23f';
        ctx.save();
        ctx.translate(toX(target.x), toY(target.z));
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
        ctx.restore();
      }
      // Enemies, peds, cars, police.
      ctx.fillStyle = '#ff4444';
      for (const e of G.enemies) if (e.state !== 'dead') ctx.fillRect(toX(e.x) - 2, toY(e.z) - 2, 4, 4);
      ctx.fillStyle = '#9aa0a8';
      for (const ped of G.peds) if (ped.state !== 'driver') ctx.fillRect(toX(ped.x) - 1, toY(ped.z) - 1, 2, 2);
      ctx.fillStyle = '#ffd23f';
      for (const car of G.cars) {
        if (car.kind === 'player') continue;
        ctx.fillRect(toX(car.x) - 2, toY(car.z) - 2, 4, 4);
      }
      if (G.police.level > 0) {
        ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#3b82f6' : '#ef4444';
        for (const car of G.cars) {
          if (car.kind !== 'police') continue;
          ctx.beginPath(); ctx.arc(toX(car.x), toY(car.z), 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }
      // The player: a white arrow pointing where they face.
      const p = G.player;
      ctx.save();
      ctx.translate(toX(p.x), toY(p.z));
      ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    },
  };
  return hud;
}
