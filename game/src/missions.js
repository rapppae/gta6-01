// SOLMAR — the story. Five missions from small-time courier to the big score, told by
// Marco, a fixer at the bar. Each mission is a list of steps; a step is done when the
// player reaches its marker, steals a car, clears the guards, holds the vault, or loses
// the cops. The HUD, the minimap and the beacon all read the current step.
import { LANDMARKS } from './config.js';
import { spawnEnemies } from './combat.js';

const MISSIONS = [
  {
    name: 'The Pickup',
    brief: "Marco needs a package from the docks. Walk it back to the bar. Don't make a scene.",
    reward: 200,
    steps: [
      { type: 'goto', target: 'docks', label: 'Pick up the package at Solmar Docks', radius: 6 },
      { type: 'goto', target: 'bar', label: 'Bring the package to Marco at the bar', radius: 6 },
    ],
  },
  {
    name: 'Getaway Driver',
    brief: 'A job needs wheels and a driver who does not ask questions. Steal a car, any car, and get it to the east end before the clock runs out.',
    reward: 300,
    steps: [
      { type: 'steal', label: 'Steal a car (E near any car)', radius: 0 },
      { type: 'driveTo', target: 'getaway', label: 'Drive to the Getaway Point', radius: 8, time: 90 },
    ],
  },
  {
    name: 'The Drop',
    brief: 'The buyer waits at the north-east corner, but his rivals want the package too. Clear them out, then make the drop.',
    reward: 500,
    steps: [
      { type: 'kill', target: 'buyer', label: 'Clear the guards at the drop (0/3)', radius: 12, count: 3 },
      { type: 'goto', target: 'buyer', label: 'Make the drop', radius: 6 },
    ],
  },
  {
    name: 'Heat',
    brief: 'It was a setup. The drop was watched, and now every cop in Solmar wants you. Lose them.',
    reward: 400,
    steps: [
      { type: 'evade', label: 'Lose the cops — wanted level must hit zero', radius: 0 },
    ],
  },
  {
    name: 'The Big Score',
    brief: "One last job: the vault at Solmar National. Grab the cash, then run for the safehouse. After this, you're out — or you're a legend.",
    reward: 1000,
    steps: [
      { type: 'hold', target: 'bank', label: 'Hold E at the bank vault to grab the cash', radius: 6, holdTime: 3 },
      { type: 'driveTo', target: 'safehouse', label: 'Escape to the Safehouse', radius: 8 },
    ],
  },
];

export function createMissions(G) {
  return {
    index: 0,
    stepIndex: 0,
    stepTimer: 0,
    holdTimer: 0,
    kills: 0,
    done: false,
    current() { return MISSIONS[this.index] || null; },
    currentStep() {
      const m = this.current();
      return m ? m.steps[this.stepIndex] : null;
    },
    target() {
      const s = this.currentStep();
      if (!s || !s.target) return null;
      const lm = LANDMARKS[s.target];
      return { x: lm.x, z: lm.z, label: s.label, name: lm.name };
    },
    label() {
      const s = this.currentStep();
      if (!s) return this.done ? 'Story complete — Solmar is yours.' : '';
      if (s.type === 'kill') return `Clear the guards at the drop (${this.kills}/${s.count})`;
      return s.label;
    },
    startMission(i) {
      this.index = i;
      this.stepIndex = 0;
      this.kills = 0;
      this.holdTimer = 0;
      this.stepTimer = 0;
      const m = this.current();
      G.hud.toast(`Mission: ${m.name} — ${m.brief}`);
      G.hud.setObjective(this.label());
      if (i === 2) spawnEnemies(G, LANDMARKS.buyer.x, LANDMARKS.buyer.z, 3);
      if (i === 3) G.police.addWanted(3);
      if (i === 4) G.hud.toast('The vault is open. Hold E.');
    },
    onKill() {
      const s = this.currentStep();
      if (s && s.type === 'kill') {
        this.kills += 1;
        G.hud.setObjective(this.label());
      }
    },
    step(dt) {
      if (this.done) return;
      const m = this.current();
      const s = this.currentStep();
      if (!m || !s) return;
      const p = G.player;
      this.stepTimer += dt;
      if (s.type === 'goto' || s.type === 'driveTo') {
        const lm = LANDMARKS[s.target];
        const d = Math.hypot(p.x - lm.x, p.z - lm.z);
        if (d < s.radius) this.advance();
        else if (s.time && this.stepTimer > s.time) {
          G.hud.toast('Too slow — the job moved on. Try again.');
          this.stepTimer = 0;
          if (s.type === 'driveTo') this.startMission(this.index);
        }
      } else if (s.type === 'steal') {
        if (p.inCar) this.advance();
      } else if (s.type === 'kill') {
        if (this.kills >= s.count) this.advance();
      } else if (s.type === 'evade') {
        if (G.police.level === 0) this.advance();
      } else if (s.type === 'hold') {
        const lm = LANDMARKS[s.target];
        const d = Math.hypot(p.x - lm.x, p.z - lm.z);
        if (d < s.radius && G.input.interactHeld && !p.inCar) {
          this.holdTimer += dt;
          G.hud.setObjective(`Cracking the vault… ${Math.ceil(s.holdTime - this.holdTimer)}s`);
          if (this.holdTimer >= s.holdTime) {
            G.police.addWanted(4);
            this.advance();
          }
        } else {
          this.holdTimer = 0;
          G.hud.setObjective(s.label);
        }
      }
    },
    advance() {
      this.stepIndex += 1;
      this.stepTimer = 0;
      this.holdTimer = 0;
      const m = this.current();
      if (this.stepIndex >= m.steps.length) {
        G.player.money += m.reward;
        G.hud.setMoney(G.player.money);
        G.audio.mission();
        G.hud.toast(`Mission complete: ${m.name} (+$${m.reward})`);
        G.save();
        if (this.index + 1 >= MISSIONS.length) {
          this.done = true;
          G.events.storyComplete = true;
          G.hud.setObjective('Story complete — Solmar is yours.');
        } else {
          this.startMission(this.index + 1);
        }
      } else {
        G.hud.setObjective(this.label());
      }
    },
  };
}
