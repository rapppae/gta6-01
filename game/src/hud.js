// SOLMAR — hud.js
// Every HUD update: health bar, money, wanted stars, objective text, ammo,
// speed, and the live minimap — a small top-down canvas showing the streets,
// the player arrow, police cruisers, gang enemies and the mission marker.

import { CFG } from './config.js';

export class Hud {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.moneyEl = document.getElementById('money');
    this.starsEl = document.getElementById('stars');
    this.objectiveEl = document.getElementById('objective');
    this.ammoEl = document.getElementById('ammo');
    this.speedEl = document.getElementById('speed');
    this.speedBox = document.getElementById('speed-box');
    this.toastEl = document.getElementById('toast');
    this.minimap = document.getElementById('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.lastStars = -1;
  }

  toast(text, ms = 3200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  update(G) {
    const p = G.player;
    const hp = Math.max(0, Math.round(p.health));
    this.healthFill.style.width = `${hp}%`;
    this.healthFill.style.background = hp > 50 ? '#37c24a' : hp > 25 ? '#e8a020' : '#d23b2e';
    this.healthText.textContent = `${hp}`;
    this.moneyEl.textContent = `$${Math.floor(p.money).toLocaleString('en-US')}`;
    const stars = G.police.level;
    if (stars !== this.lastStars) {
      this.lastStars = stars;
      let s = '';
      for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
      this.starsEl.textContent = s;
      this.starsEl.classList.toggle('hot', stars > 0);
    }
    this.objectiveEl.textContent = G.missions.label();
    const c = G.combat;
    this.ammoEl.textContent = c.reloading ? 'RELOADING…' : `${c.mag} / ${c.reserve}`;
    if (p.inCar) {
      this.speedBox.classList.remove('hidden');
      const kmh = Math.round(Math.abs(p.inCar.speed) * 3.6);
      this.speedEl.textContent = `${kmh} km/h`;
    } else {
      this.speedBox.classList.add('hidden');
    }
    this.drawMinimap(G);
  }

  // World (-178..178) maps onto the 180px canvas with a small margin.
  mapPoint(x, z) {
    const s = 180 / (CFG.worldHalf * 2 + 20);
    return { x: 90 + x * s, y: 90 + z * s };
  }

  drawMinimap(G) {
    const ctx = this.mapCtx;
    const W = 180;
    ctx.clearRect(0, 0, W, W);
    // Sea and sand on the east edge.
    ctx.fillStyle = '#2e8fc0';
    ctx.fillRect(168, 0, 12, W);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(160, 0, 8, W);
    // Ground and blocks.
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, 160, W);
    ctx.fillStyle = '#8a8f7a';
    for (let bx = -160; bx < 160; bx += 40) {
      for (let bz = -160; bz < 160; bz += 40) {
        const a = this.mapPoint(bx + 8, bz + 8);
        const b = this.mapPoint(bx + 32, bz + 32);
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
    // Roads.
    ctx.fillStyle = '#565b63';
    for (const c of CFG.roadCoords) {
      const p = this.mapPoint(c, 0);
      ctx.fillRect(p.x - 3, 0, 6, W);
      const q = this.mapPoint(0, c);
      ctx.fillRect(0, q.y - 3, W, 6);
    }
    // Mission marker: a pulsing yellow diamond.
    const target = G.missions.targetPos();
    if (target && !G.missions.done) {
      const t = this.mapPoint(target.x, target.z);
      const pulse = 5 + Math.sin(G.time * 5) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - pulse);
      ctx.lineTo(t.x + pulse, t.y);
      ctx.lineTo(t.x, t.y + pulse);
      ctx.lineTo(t.x - pulse, t.y);
      ctx.closePath();
      ctx.fill();
    }
    // Gang enemies in red.
    ctx.fillStyle = '#ff3344';
    for (const e of G.combat.enemies) {
      const p = this.mapPoint(e.x, e.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police cruisers in blue.
    ctx.fillStyle = '#3388ff';
    for (const car of G.cars) {
      if (car.kind !== 'police') continue;
      const p = this.mapPoint(car.x, car.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player: a white arrow pointing where they face.
    const p = G.player.inCar
      ? this.mapPoint(G.player.inCar.x, G.player.inCar.z)
      : this.mapPoint(G.player.x, G.player.z);
    const facing = G.player.inCar ? G.player.inCar.angle : G.player.facing;
    ctx.save();
    ctx.translate(p.x, p.y);
    // The arrow is drawn pointing down (+y, i.e. +z in the world); rotate it
    // by -facing so it points where the player faces.
    ctx.rotate(-facing);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(-5, -5);
    ctx.lineTo(0, -2);
    ctx.lineTo(5, -5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('N', 86, 11);
  }
}
