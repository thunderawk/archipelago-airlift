# archipelago-airlift

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/thunderawk/archipelago-airlift/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/thunderawk/archipelago-airlift/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Archipelago Airlift — a flight game. One twin-prop island-hopper, three sorties over a tropical archipelago: thread eight sky rings against the clock, hop between island runways on a tight fuel budget, or carry medicine through a storm front to Selatan. Chase view over recognisable terrain, a lit HUD (airspeed, altitude, heading, attitude, fuel, throttle), and landings that read — flare soft or the airframe takes it.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network — every file the game loads sits under `game/`.

## Controls

- **Mouse** — hold the button and drag to steer, wheel for throttle
- **W / S** — throttle down / up (Shift = full, Ctrl = idle)
- **Arrow keys / A D** — pitch and roll
- **Q / E** — rudder
- **G** — landing gear · **F** — flaps · **P** — pause

## The sorties

1. **Ring Rally** — fly all eight rings in order. Full throttle burns fuel fast; ease off on the straights.
2. **Island Hop** — land on Palma, then Karang, then home. A soft touchdown refuels you and banks a bonus.
3. **Storm Courier** — deliver cargo to Selatan through the front. Keep the speed down inside the cell or the airframe takes damage.

## Layout

- `game/` — the game itself: `index.html` + one module per job under `src/` (`main` loop, `plane` physics, `world` terrain and camera, `render` picture, `hud` instruments, `missions` sorties, `audio` synth, `particles`, `input`, `shots`, `config`, `random`)
- `screenshots/` — four real renders of the game, taken with Playwright
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — a tiny static server for local play
- `shots.json` — the four screenshot poses (`?shot=start|flight|approach|storm`)

---

<sub>Entered on [make.fun](https://make.fun/?ref=mt633ffr&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
