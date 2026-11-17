# SOLMAR

[![SOLMAR on make.fun](https://img.shields.io/badge/make.fun-gta--01-ff6b35)](https://make.fun/c/gta6-01)
[![Prize $1,666](https://img.shields.io/badge/prize-%241%2C666-gold)](https://make.fun/c/gta6-01)
[![three.js](https://img.shields.io/badge/three.js-r187-blue)](https://threejs.org)

SOLMAR is an original open-world crime game for the make.fun competition **gta6-01 "Make GTA 6"**. You play a new driver for Rico's crew in Solmar, a sun-soaked coastal city of palm courts, beach roads and bad decisions: pick up the package, outrun the law, survive the drop — and pull the big score.

Everything in it is original: the city, the characters, the vehicles, the names and the story. Nothing is taken from any commercial game.

## What is in the game

- **An open city** on a street grid with sidewalks, varied buildings, a beach and sea along the east edge, palm trees, streetlights and traffic lights. You cannot leave the map.
- **On foot**: third-person camera, mouse look with pointer lock, WASD, Shift to sprint, Space to jump.
- **By car**: press E near a car to enter or exit. Parked cars are free; cars in traffic have a driver, and taking one raises your wanted level. W/S accelerate and brake/reverse, A/D steer, Space is the handbrake. The HUD shows your speed.
- **Traffic and pedestrians**: cars drive the road grid and stop at red lights; people stroll the sidewalks and flee when you drive at them or shoot near them.
- **Wanted level (0–5 stars)**: stealing a car with a driver, hitting pedestrians and shooting raise it. Police cruisers spawn and chase you — more stars, more chasers, more aggressive. At zero stars they just patrol. Lie low and unseen and the heat cools off.
- **Five chained story missions** with a beam-of-light objective marker and a minimap marker: The Pickup, Getaway Driver (timed), The Drop (gang ambush), Heat (escape the police), and The Big Score (bank heist). Each pays money and unlocks the next.
- **Combat**: a pistol (click to shoot, R to reload, 12-round magazine), gang enemies who shoot back, muzzle flashes, tracers, sparks and smoke. Health regenerates when you stay out of trouble; dying shows a game-over screen with a retry.
- **HUD**: health bar, money, wanted stars, current objective, ammo, speed while driving, and a live minimap (streets, player arrow, police, enemies, mission marker).
- **Menus and save**: title screen with New Game and Continue (localStorage save of money, mission progress and position), pause with P or Escape.
- **Sound**: synthesised WebAudio only — engine hum, footsteps, gunshots, sirens, a mission-complete jingle and interface clicks. No audio files.

## How to run it

No build step, no install, no network. Serve the `game/` folder with any static server and open `index.html` in a desktop browser:

```sh
node serve.ts
# then open http://localhost:8080
```

Or from the repository root, any static server works, for example `npx serve game` or `python3 -m http.server --directory game`.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look (click the game to capture the mouse) |
| Shift | Sprint |
| Space | Jump on foot, handbrake while driving |
| E | Enter or exit a car |
| Click | Shoot the pistol |
| R | Reload |
| P / Esc | Pause |

## Files

- `game/index.html` — the page, HUD and menus
- `game/src/` — one module per job: `config`, `random`, `world`, `player`, `vehicles`, `pedestrians`, `police`, `combat`, `missions`, `particles`, `hud`, `audio`, `input`, `render`, `shots`, `main`
- `game/vendor/three/` — vendored three.js (minified builds)
- `main.ts` — the Node 22 program that hands the game in to make.fun (`MAKEFUN_OUTPUT_DIR=out node main.ts`)
- `screenshots/` — four screenshots of the game itself: chase, city, mission, title

## License

MIT — see `LICENSE`.
