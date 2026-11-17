// SOLMAR — bootstrap and the main loop. Fixed 60 Hz simulation, render every animation
// frame. The sim owns all state in G; render/hud/audio only read it. Screens: title,
// play, pause, busted, wasted, complete. Save lives in localStorage.
// ?seed=N fixes the city. ?shot=chase|city|mission|start (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { CAR_MAX_SPEED, LANDMARKS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPeds, stepPeds } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat, spawnEnemies } from './combat.js';
import { createMissions } from './missions.js';
import { createParticles } from './particles.js';
import { createHUD } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { stepPlayer } from './player.js';
import { stepVehicles } from './vehicles.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot') || null;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

function createGame(seedValue) {
  const canvas = $('game');
  const G = {
    seed: seedValue, time: 0, screen: 'title', events: {}, shotCam: null,
    world: createWorld(seedValue),
    camera: { yaw: Math.PI, pitch: 0.22 },
    input: null, audio: null, hud: null, particles: createParticles(),
    player: null, cars: [], peds: [], enemies: [],
    police: null, combat: null, missions: null, renderer: null,
  };
  G.input = createInput(canvas);
  G.audio = createAudio();
  G.hud = createHUD();
  G.player = createPlayer();
  G.peds = [];
  G.cars = createVehicles(G);
  G.peds.push(...createPeds(G));
  G.police = createPolice(G);
  G.combat = createCombat(G);
  G.missions = createMissions(G);
  G.renderer = createRenderer(canvas, G);
  G.save = () => saveGame(G);
  G.load = () => loadSave(G);
  return G;
}

function saveGame(G) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.player.money, health: G.player.health,
      mission: G.missions.index, step: G.missions.step, kills: G.missions.kills,
      x: G.player.x, z: G.player.z, wanted: G.police.level,
    }));
  } catch { /* storage can be off; the save then lasts this visit only */ }
}

function loadSave(G) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.player.money = s.money ?? 50;
    G.player.health = s.health ?? 100;
    G.player.x = s.x ?? 60;
    G.player.z = s.z ?? 90;
    G.missions.index = s.mission ?? 0;
    G.missions.stepIndex = s.step ?? 0;
    G.missions.kills = s.kills ?? 0;
    G.missions.done = false;
    const m = G.missions.current();
    if (m) {
      G.hud.setMission(m.name);
      G.hud.setObjective(G.missions.label());
      if (G.missions.index === 2 && G.missions.stepIndex === 0) {
        spawnEnemies(G, LANDMARKS.buyer.x, LANDMARKS.buyer.z, 3 - (s.kills ?? 0));
      }
      if (G.missions.index === 3) G.police.level = Math.max(G.police.level, 3);
    }
    if (s.wanted > 0) G.police.level = Math.min(5, s.wanted);
    return true;
  } catch { return false; }
}

function stepSim(G, dt) {
  G.time += dt;
  const input = G.input;
  G.camera.yaw -= input.mouseDX * 0.0028;
  G.camera.pitch = Math.max(-0.15, Math.min(0.9, G.camera.pitch + input.mouseDY * 0.0022));
  stepPlayer(G, dt);
  stepVehicles(G, dt);
  stepPeds(G, dt);
  G.police.step(dt);
  G.combat.step(dt);
  G.missions.step(dt);
  G.particles.step(dt);
  const inCar = !!G.player.inCar;
  G.audio.engine(inCar, inCar ? Math.abs(G.player.inCar.speed) / CAR_MAX_SPEED : 0);
  G.audio.siren(G.police.level > 0);
  G.hud.setSpeed(inCar ? Math.abs(G.player.inCar.speed) * 3.6 : 0);
  G.hud.setCrosshair(!inCar);
  G.hud.drawMinimap(G);
  if (G.events.busted) {
    G.events.busted = false;
    G.audio.busted();
    G.audio.siren(false);
    G.player.money = Math.max(0, G.player.money - 150);
    G.hud.setMoney(G.player.money);
    G.screen = 'busted';
    G.hud.setEnd('BUSTED', 'The Solmar PD caught you. You paid $150 in fines and walked out at the station.');
    G.hud.showScreen('end');
  } else if (G.events.wasted) {
    G.events.wasted = false;
    G.audio.busted();
    G.audio.siren(false);
    G.player.money = Math.max(0, G.player.money - 200);
    G.hud.setMoney(G.player.money);
    G.screen = 'wasted';
    G.hud.setEnd('WASTED', 'You went down in the streets of Solmar. The hospital patched you up for $200.');
    G.hud.showScreen('end');
  } else if (G.events.storyComplete) {
    G.events.storyComplete = false;
    G.screen = 'complete';
    G.hud.setEnd('SOLMAR COMPLETE', `You pulled the big score and walked away clean with $${Math.floor(G.player.money).toLocaleString('en-US')}. The city is yours.`);
    G.hud.showScreen('end');
  }
  input.clearEdges();
}

function respawn(G, where) {
  const lm = LANDMARKS[where];
  G.player.inCar = null;
  G.player.x = lm.x; G.player.z = lm.z; G.player.y = 0;
  G.player.health = 100;
  G.player.heading = 0;
  G.police.level = 0;
  G.police.quietTimer = 0;
  for (const car of G.cars) if (car.kind === 'police') car.kind = 'parked';
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.hud.setHealth(100);
  G.hud.setStars(0);
  G.hud.setMoney(G.player.money);
  G.save();
  G.screen = 'play';
  G.hud.showScreen('play');
}

function startPlay(G, fresh) {
  G.audio.unlock();
  G.audio.music(true);
  if (fresh) {
    G.missions.startMission(0);
    G.hud.setMission('The Pickup');
  }
  G.hud.setHealth(G.player.health);
  G.hud.setMoney(G.player.money);
  G.hud.setStars(G.police.level);
  G.hud.setAmmo(G.combat.ammo);
  G.hud.setObjective(G.missions.label());
  G.screen = 'play';
  G.hud.showScreen('play');
  G.input.requestLock();
}

function main() {
  const G = createGame(seed);
  window.__game = { G, stepSim, version: 'solmar-1' };
  const canvas = $('game');
  canvas.addEventListener('click', () => {
    if (G.screen === 'play') G.input.requestLock();
    if (G.screen === 'busted' || G.screen === 'wasted') respawn(G, G.screen === 'busted' ? 'policeStation' : 'hospital');
    if (G.screen === 'complete') { G.hud.showScreen('title'); G.screen = 'title'; }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') G.audio.toggleMute();
    if (e.code === 'Enter') {
      if (G.screen === 'title') $('btn-new').click();
      else if (G.screen === 'busted' || G.screen === 'wasted') respawn(G, G.screen === 'busted' ? 'policeStation' : 'hospital');
    }
  });
  $('btn-new').addEventListener('click', () => {
    const fresh = createGame(Math.floor(Math.random() * 4294967296));
    Object.assign(G, fresh);
    window.__game.G = G;
    startPlay(G, true);
  });
  const hasSave = (() => { try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; } })();
  $('btn-continue').disabled = !hasSave;
  $('btn-continue').addEventListener('click', () => {
    if (loadSave(G)) startPlay(G, false);
  });
  $('btn-resume').addEventListener('click', () => {
    G.screen = 'play';
    G.hud.showScreen('play');
    G.input.requestLock();
  });
  $('btn-quit').addEventListener('click', () => {
    G.save();
    G.screen = 'title';
    G.hud.showScreen('title');
  });
  $('btn-end').addEventListener('click', () => {
    if (G.screen === 'busted' || G.screen === 'wasted') respawn(G, G.screen === 'busted' ? 'policeStation' : 'hospital');
    else if (G.screen === 'complete') { G.hud.showScreen('title'); G.screen = 'title'; }
  });
  window.addEventListener('resize', () => G.renderer.resize());

  if (shotMode) {
    const scene = stageShot(shotMode, G, stepSim);
    G.hud.setHealth(G.player.health);
    G.hud.setMoney(G.player.money);
    G.hud.setStars(G.police.level);
    G.hud.setAmmo(G.combat.ammo);
    G.hud.setMission(G.missions.current() ? G.missions.current().name : '');
    G.hud.setObjective(G.missions.label());
    G.hud.drawMinimap(G);
    // The mission toast would cover the objective in the frame; hide it for the shot.
    document.getElementById('toast')?.classList.remove('show');
    // Warm the camera up: it lerps toward the player, and the two paint frames alone
    // would leave it stranded at the origin.
    for (let i = 0; i < 40; i += 1) G.renderer.render(1 / 60);
    if (scene.screen === 'title') G.hud.showScreen('title');
    else G.hud.showScreen('play');
    let painted = 0;
    const paint = () => {
      G.renderer.render(1 / 60);
      painted += 1;
      if (painted < 2) requestAnimationFrame(paint);
      else window.__shotReady = true;
    };
    requestAnimationFrame(paint);
    return;
  }

  G.hud.showScreen('title');
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > MAX_FRAME) elapsed = MAX_FRAME;
    if (G.screen === 'title') {
      G.camera.yaw += elapsed * 0.03;
      G.time += elapsed;
      G.renderer.render(elapsed);
      return;
    }
    if (G.screen !== 'play') {
      G.renderer.render(elapsed);
      return;
    }
    if (G.input.pausePressed) {
      G.input.clearEdges();
      G.screen = 'pause';
      G.hud.showScreen('pause');
      document.exitPointerLock?.();
      return;
    }
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepSim(G, STEP);
      accumulator -= STEP;
      if (G.screen !== 'play') break;
    }
    G.renderer.render(elapsed);
  }
  requestAnimationFrame(frame);
}

main();
