// SOLMAR — main.js
// The game loop and the wiring: it builds the city, the cars, the people, the
// police, the combat and the missions, runs the frame loop, and owns the
// title / pause / game-over flow plus saving to localStorage. This is the
// only module that knows about all the others.

import * as THREE from 'three';
import { CFG, PLACES } from './config.js';
import { Rng } from './random.js';
import { CityWorld } from './world.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Renderer3D } from './render.js';
import { Player } from './player.js';
import { VehicleFleet } from './vehicles.js';
import { PedCrowd } from './pedestrians.js';
import { PoliceForce } from './police.js';
import { Combat } from './combat.js';
import { MissionChain } from './missions.js';
import { Hud } from './hud.js';
import { ShotDirector } from './shots.js';

const canvas = document.getElementById('game-canvas');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || CFG.seedDefault;
const shotMode = ShotDirector.modeFromUrl();

// ---- build the game state (G) ----
const rng = new Rng(seed);
const render = new Renderer3D(canvas);
const world = new CityWorld(render.scene, rng);
const input = new Input(canvas);
const audio = new SoundBank();
const particles = new ParticleSystem(render.scene);
const player = new Player(render.scene, world);
const fleet = new VehicleFleet(render.scene, world, rng);
const peds = new PedCrowd(render.scene, world, rng);
const police = new PoliceForce(fleet, world, rng);
const combat = new Combat(render.scene, world, particles, audio);
const missions = new MissionChain(render.scene);
const hud = new Hud();

const G = {
  seed,
  screen: 'title', // title | playing | paused | gameover
  time: 0,
  player,
  cars: fleet.cars,
  peds: peds.peds,
  police,
  missions,
  combat,
  fleet,
  world,
  input,
  audio,
  render,
  particles,
  rng,
};
missions.bind(G);
window.__game = { G };
window.__shotReady = false;

// ---- world population ----
fleet.spawnInitial();
peds.spawnInitial();
player.reset(PLACES.start);

// ---- screens ----
const titleScreen = document.getElementById('title-screen');
const pauseScreen = document.getElementById('pause-screen');
const overScreen = document.getElementById('gameover-screen');
const btnNew = document.getElementById('btn-new');
const btnContinue = document.getElementById('btn-continue');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnRetry = document.getElementById('btn-retry');
const btnMenu = document.getElementById('btn-menu');
const btnMenu2 = document.getElementById('btn-menu2');
const saveInfo = document.getElementById('save-info');

function showOnly(el) {
  for (const s of [titleScreen, pauseScreen, overScreen]) s.classList.add('hidden');
  if (el) el.classList.remove('hidden');
  document.getElementById('hud').classList.toggle('hidden', el === titleScreen);
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGame() {
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify({
      money: Math.floor(player.money),
      index: missions.index,
      stepIndex: missions.stepIndex,
      x: player.x,
      z: player.z,
      health: player.health,
    }));
  } catch {}
}

function refreshContinue() {
  const save = loadSave();
  if (save) {
    btnContinue.classList.remove('hidden');
    saveInfo.textContent = `Saved game: $${save.money} — mission ${Math.min(save.index + 1, 5)}/5`;
  } else {
    btnContinue.classList.add('hidden');
    saveInfo.textContent = 'No saved game yet.';
  }
}

function startGame(fromSave) {
  audio.ensure();
  audio.click();
  const save = fromSave ? loadSave() : null;
  combat.clearEnemies();
  combat.resetAmmo();
  police.clearWanted(G.time);
  missions.reset();
  if (save) {
    player.money = save.money || CFG.startMoney;
    missions.loadState(save.index || 0, save.stepIndex || 0);
    player.reset({ x: save.x ?? PLACES.start.x, z: save.z ?? PLACES.start.z });
    player.health = save.health || CFG.playerHealth;
  } else {
    player.money = CFG.startMoney;
    player.reset(PLACES.start);
  }
  G.screen = 'playing';
  showOnly(null);
  input.consumeClick();
  input.requestLock();
  hud.toast(save ? 'Welcome back to Solmar.' : 'Welcome to Solmar. Follow the yellow beam.');
  if (!missions.done) hud.toast(`${missions.current().name}: ${missions.current().intro}`, 5200);
  saveGame();
}

function pauseGame() {
  if (G.screen !== 'playing' || shotMode) return;
  G.screen = 'paused';
  showOnly(pauseScreen);
  input.releaseLock();
  audio.engine(0);
  audio.siren(false);
  saveGame();
}

function resumeGame() {
  audio.ensure();
  audio.click();
  G.screen = 'playing';
  showOnly(null);
  input.requestLock();
}

function gameOver() {
  G.screen = 'gameover';
  showOnly(overScreen);
  input.releaseLock();
  audio.engine(0);
  audio.siren(false);
  audio.fail();
  document.getElementById('over-stats').textContent =
    `You made $${Math.floor(player.money).toLocaleString('en-US')} and reached mission ${Math.min(missions.index + 1, 5)}/5.`;
}

function retryAfterDeath() {
  audio.click();
  combat.clearEnemies();
  police.clearWanted(G.time);
  player.reset(PLACES.hideout);
  player.money = Math.max(0, player.money - 100);
  missions.stepIndex = 0;
  missions.timeLeft = 0;
  G.screen = 'playing';
  showOnly(null);
  input.requestLock();
  hud.toast('Back on your feet. The hideout is safe — for now.');
}

btnNew.addEventListener('click', () => startGame(false));
btnContinue.addEventListener('click', () => startGame(true));
btnResume.addEventListener('click', resumeGame);
btnRestart.addEventListener('click', () => startGame(false));
btnRetry.addEventListener('click', retryAfterDeath);
btnMenu.addEventListener('click', () => {
  audio.click();
  G.screen = 'title';
  showOnly(titleScreen);
  refreshContinue();
  input.releaseLock();
});
if (btnMenu2) btnMenu2.addEventListener('click', () => {
  audio.click();
  G.screen = 'title';
  showOnly(titleScreen);
  refreshContinue();
  input.releaseLock();
});

input.onPauseKey = () => {
  if (G.screen === 'playing') pauseGame();
  else if (G.screen === 'paused') resumeGame();
};

// ---- interactions ----
let lastRamAt = -99;
let lastStepAt = 0;

input.onInteractKey = () => {
  if (G.screen !== 'playing') return;
  audio.ensure();
  if (player.inCar) {
    player.exitCar();
    audio.click();
    return;
  }
  const car = player.tryEnterCar(fleet.cars);
  if (car) {
    audio.click();
    if (car.driver) {
      car.driver = false;
      police.addWanted(CFG.stealWanted, G.time);
      hud.toast('You stole a car with its driver inside! Wanted +1 ★');
      audio.siren(true);
    } else {
      hud.toast(`You took the ${car.kind}. Drive!`);
    }
  }
};

input.onReloadKey = () => {
  if (G.screen === 'playing') combat.startReload();
};

// ---- police / crime wiring ----
police.onLevelChange = (level) => {
  audio.siren(level > 0);
};

function onPoliceRam(car, dist, now) {
  if (now - lastRamAt < CFG.policeRamCooldown) return;
  lastRamAt = now;
  audio.thud();
  render.addShake(0.7);
  if (player.inCar) {
    player.inCar.speed *= 0.45;
  } else {
    player.takeDamage(CFG.policeRamDamage, now);
    audio.hurt();
    const away = Math.atan2(player.x - car.x, player.z - car.z);
    player.x += Math.sin(away) * 2;
    player.z += Math.cos(away) * 2;
  }
}

function onCarHitPeds(car) {
  const hit = peds.checkCarHits(car);
  for (const ped of hit) {
    particles.blood({ x: ped.x, y: 1, z: ped.z });
    audio.thud();
    render.addShake(0.5);
    if (!ped.counted) {
      ped.counted = true;
      police.addWanted(CFG.hitPedWanted, G.time);
      hud.toast('You hit a pedestrian! Wanted +1 ★');
    }
  }
}

combat.onPlayerShot = (origin) => {
  peds.fleeFrom(origin.x, origin.z, 26);
  police.addWanted(CFG.shootWanted, G.time);
};

combat.onEnemyKilled = (enemy) => {
  player.money += CFG.enemyDropMoney;
  hud.toast(`Red Viper down — +$${CFG.enemyDropMoney}`);
  audio.pickup();
};

missions.onMissionComplete = (m) => {
  hud.toast(`Mission complete: ${m.name} — +$${m.reward.toLocaleString('en-US')}`, 4500);
  saveGame();
  if (!missions.done) {
    setTimeout(() => {
      if (G.screen === 'playing') hud.toast(`${missions.current().name}: ${missions.current().intro}`, 5200);
    }, 4600);
  } else {
    hud.toast('Story complete! Solmar is yours. Free roam — keep the money coming.', 6000);
  }
};

// ---- shooting ----
function tryShoot() {
  if (G.screen !== 'playing' || player.dead || player.inCar) return;
  const dir = new THREE.Vector3();
  render.camera.getWorldDirection(dir);
  const origin = { x: player.x, y: player.y + 1.5, z: player.z };
  const d = { x: dir.x, y: dir.y, z: dir.z };
  const before = combat.mag;
  combat.shoot(origin, d, 'player');
  if (combat.mag !== before) render.addShake(0.12);
}

// ---- the frame loop ----
// A plain performance.now clock (THREE.Clock is deprecated in this three.js).
let lastFrameAt = performance.now();
let saveTimer = 0;
const shots = new ShotDirector(G);

function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now();
  const dt = Math.min((nowMs - lastFrameAt) / 1000, 0.05);
  lastFrameAt = nowMs;
  if (G.screen === 'playing') G.time += dt;

  if (G.screen === 'playing' && !player.dead) {
    // On foot or driving.
    if (player.inCar) {
      const car = player.inCar;
      fleet.drivePlayerCar(car, dt, input, world, onCarHitPeds);
      player.x = car.x;
      player.z = car.z;
      player.yaw = car.angle + Math.PI;
      player.speed = Math.abs(car.speed);
      audio.engine(Math.abs(car.speed) / CFG.carTopSpeed);
    } else {
      player.update(dt, input, G.time);
      audio.engine(0);
      // Footsteps.
      if (player.speed > 1 && G.time - lastStepAt > 0.45) {
        lastStepAt = G.time;
        audio.step();
      }
      // Shooting.
      if (input.consumeClick() || input.mouseDown) tryShoot();
      else input.consumeClick();
    }
    // The rest of the world keeps moving.
    fleet.update(dt, G.time, player, onCarHitPeds);
    peds.update(dt, player, fleet.cars);
    police.update(dt, G.time, player, onPoliceRam);
    combat.update(dt, player, G.time, render);
    missions.advance(dt);
    player.healTick(dt, G.time);
    world.updateLights(G.time);
    particles.update(dt);
    hud.update(G);
    // Camera follows the player or their car.
    const target = player.inCar
      ? { x: player.inCar.x, y: 0, z: player.inCar.z }
      : { x: player.x, y: player.y, z: player.z };
    const yaw = player.inCar ? player.inCar.angle + Math.PI : player.yaw;
    render.follow(dt, target, yaw, player.pitch, !!player.inCar, player.inCar ? Math.abs(player.inCar.speed) / CFG.carTopSpeed : 0);
    // Death.
    if (player.dead) gameOver();
    // Autosave.
    saveTimer += dt;
    if (saveTimer > 12) {
      saveTimer = 0;
      saveGame();
    }
  } else if (G.screen === 'title') {
    // Slow orbit over the city behind the title screen.
    render.orbitView(G.time + performance.now() / 1000, { x: 0, z: 0 });
    fleet.update(dt, G.time, player, onCarHitPeds);
    peds.update(dt, player, fleet.cars);
    world.updateLights(G.time);
    particles.update(dt);
  } else {
    // Paused or game over: frozen world, still rendering.
    particles.update(dt);
  }

  render.render();
  if (shotMode) shots.tick();
}

showOnly(titleScreen);
refreshContinue();
if (shotMode) {
  shots.begin(shotMode);
  // Staged gameplay shots hide the title screen; the start shot keeps it.
  if (shotMode !== 'start') showOnly(null);
}
frame();
