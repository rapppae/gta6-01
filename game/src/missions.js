// SOLMAR — missions.js
// The five-mission story of Solmar, chained: each mission pays and unlocks
// the next. The chain tracks the current mission with `index` and the current
// step inside it with `stepIndex`; `advance(dt)` moves it forward one frame
// at a time. (The field is `index`, the method is `advance` — never the same
// name.) A beam of light marks the objective in the world, and the HUD and
// the minimap point at it too.

import * as THREE from 'three';
import { CFG, PLACES } from './config.js';

const MISSION_DEFS = [
  {
    name: 'The Pickup',
    intro: 'Rico needs a package picked up at Marina Corner. Walk over and grab it.',
    reward: 250,
    steps: [
      { type: 'goto', pos: PLACES.pickup, text: 'Walk to the package at Marina Corner' },
    ],
  },
  {
    name: 'Getaway Driver',
    intro: 'The package is hot. Take a car and drive it to the Northgate Garage before the clock runs out.',
    reward: 500,
    steps: [
      { type: 'getin', text: 'Get in a car — press E near one (parked cars are free)' },
      { type: 'drive', pos: PLACES.getawayDest, text: 'Drive to the Northgate Garage', limit: CFG.getawayTimeLimit },
    ],
  },
  {
    name: 'The Drop',
    intro: 'Deliver the package to Palm Court. The Red Vipers heard about it — they will be waiting.',
    reward: 750,
    steps: [
      { type: 'goto', pos: PLACES.dropPoint, text: 'Deliver the package at Palm Court' },
      { type: 'defend', count: 4, text: 'Ambush! Fight off the Red Vipers' },
    ],
  },
  {
    name: 'Heat',
    intro: 'The drop went loud and the Solmar police are all over you. Lose them and get to the hideout.',
    reward: 1000,
    steps: [
      { type: 'escape', pos: PLACES.hideout, text: 'Escape the police — reach the Solmar Hideout' },
    ],
  },
  {
    name: 'The Big Score',
    intro: 'One last job: the Solmar Trust Bank. Grab the money and get out. Then disappear.',
    reward: 5000,
    steps: [
      { type: 'goto', pos: PLACES.bank, text: 'Reach the Solmar Trust Bank' },
      { type: 'grab', pos: PLACES.bank, text: 'Grab the money — hold position' },
      { type: 'escape', pos: PLACES.hideout, text: 'Escape to the Solmar Hideout with the money' },
    ],
  },
];

export class MissionChain {
  constructor(scene) {
    this.scene = scene;
    this.index = 0; // current mission, 0..4; 5 means the story is done
    this.stepIndex = 0; // current step inside the mission
    this.timeLeft = 0;
    this.grabProgress = 0;
    this.game = null; // bound by main.js: the whole game state
    this.onMissionComplete = null;
    this.onStepComplete = null;
    this.startedFlags = {}; // per-mission one-off setup already done
    // Objective beacon: a beam of light plus a ring on the ground.
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd23f, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beamMat);
    this.beacon.position.y = 30;
    this.scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.4, 24), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.06;
    this.scene.add(this.ring);
    this.beaconVisible = true;
  }

  bind(game) {
    this.game = game;
  }

  get done() {
    return this.index >= MISSION_DEFS.length;
  }

  current() {
    return MISSION_DEFS[this.index] || null;
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] || null : null;
  }

  // Short objective text for the HUD.
  label() {
    if (this.done) return 'Story complete — Solmar is yours. Free roam!';
    const m = this.current();
    const step = this.currentStep();
    let text = `${this.index + 1}/5 ${m.name} — ${step ? step.text : ''}`;
    if (step && step.type === 'drive' && this.timeLeft > 0) {
      text += ` (${Math.ceil(this.timeLeft)}s)`;
    }
    if (step && step.type === 'grab' && this.grabProgress > 0) {
      text += ` ${Math.round((this.grabProgress / CFG.grabTime) * 100)}%`;
    }
    return text;
  }

  // Where the beacon and the minimap marker point right now.
  targetPos() {
    const step = this.currentStep();
    if (!step) return null;
    if (step.pos) return step.pos;
    if (step.type === 'getin') {
      const car = this.game.fleet.nearestCar(this.game.player.x, this.game.player.z, 500);
      return car ? { x: car.x, z: car.z } : null;
    }
    // Steps without their own spot (the ambush fight) point at the
    // mission's marked place instead of hiding the beacon.
    const m = this.current();
    if (m) {
      const marked = m.steps.find((s) => s.pos);
      if (marked) return marked.pos;
    }
    return null;
  }

  reset() {
    this.index = 0;
    this.stepIndex = 0;
    this.timeLeft = 0;
    this.grabProgress = 0;
    this.startedFlags = {};
  }

  loadState(index, stepIndex) {
    this.index = Math.max(0, Math.min(MISSION_DEFS.length, index | 0));
    this.stepIndex = stepIndex | 0;
    this.timeLeft = 0;
    this.grabProgress = 0;
  }

  // One-off setup when a mission starts: wanted heat, ambushes, timers.
  beginMission() {
    const key = `m${this.index}`;
    if (this.startedFlags[key]) return;
    this.startedFlags[key] = true;
    const G = this.game;
    if (this.index === 3) {
      G.police.addWanted(3, G.time); // Heat starts with three stars
    }
    if (this.index === 4) {
      G.combat.spawnAmbush(PLACES.bank.x, PLACES.bank.z, 3); // guards at the bank
    }
  }

  completeStep() {
    this.stepIndex += 1;
    this.grabProgress = 0;
    const m = this.current();
    if (m && this.stepIndex >= m.steps.length) this.completeMission();
    else if (this.onStepComplete) this.onStepComplete(m, this.stepIndex);
  }

  completeMission() {
    const m = this.current();
    const G = this.game;
    G.player.money += m.reward;
    if (G.audio) G.audio.jingle();
    if (this.onMissionComplete) this.onMissionComplete(m);
    this.index += 1;
    this.stepIndex = 0;
    this.timeLeft = 0;
    this.grabProgress = 0;
    if (this.index < MISSION_DEFS.length) this.beginMission();
  }

  // The per-frame driver. dt is the frame delta in seconds.
  advance(dt) {
    if (!this.game || this.done) {
      this.beacon.visible = false;
      this.ring.visible = false;
      return;
    }
    this.beginMission();
    const G = this.game;
    const step = this.currentStep();
    if (!step) return;
    const px = G.player.inCar ? G.player.inCar.x : G.player.x;
    const pz = G.player.inCar ? G.player.inCar.z : G.player.z;
    const distTo = (p) => Math.hypot(px - p.x, pz - p.z);

    if (step.type === 'goto') {
      if (distTo(step.pos) < CFG.markerRadius) {
        if (this.index === 2) {
          // Arriving at the drop triggers the ambush.
          G.combat.spawnAmbush(step.pos.x, step.pos.z, 4);
        }
        this.completeStep();
      }
    } else if (step.type === 'getin') {
      if (G.player.inCar) this.completeStep();
    } else if (step.type === 'drive') {
      if (this.timeLeft <= 0) this.timeLeft = step.limit;
      this.timeLeft -= dt;
      if (distTo(step.pos) < CFG.markerRadius) {
        this.completeStep();
      } else if (this.timeLeft <= 0) {
        // Too slow: the clock resets and the run starts over.
        this.timeLeft = step.limit;
        if (G.audio) G.audio.fail();
      }
    } else if (step.type === 'defend') {
      if (G.combat.enemies.length === 0) this.completeStep();
    } else if (step.type === 'grab') {
      if (distTo(step.pos) < CFG.markerRadius) {
        this.grabProgress += dt;
        if (this.grabProgress >= CFG.grabTime) this.completeStep();
      } else {
        this.grabProgress = Math.max(0, this.grabProgress - dt * 2);
      }
    } else if (step.type === 'escape') {
      if (distTo(step.pos) < CFG.hideoutRadius) {
        G.police.clearWanted(G.time);
        this.completeStep();
      }
    }

    // Beacon follows the current target and pulses.
    const target = this.targetPos();
    if (target) {
      this.beacon.visible = true;
      this.ring.visible = true;
      this.beacon.position.x = target.x;
      this.beacon.position.z = target.z;
      this.ring.position.x = target.x;
      this.ring.position.z = target.z;
      const pulse = 0.7 + Math.sin(G.time * 4) * 0.25;
      this.ring.scale.set(pulse, pulse, 1);
    } else {
      this.beacon.visible = false;
      this.ring.visible = false;
    }
  }
}
