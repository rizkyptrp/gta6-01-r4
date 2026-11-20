# gta6-01-r4

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/rizkyptrp/gta6-01-r4/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/rizkyptrp/gta6-01-r4/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

NEON DUSK — Sable City: an original open-world crime game in the browser. You are **Kai Mercer**, a wheelman fresh out of a bad deal in **Sable City**, a sun-soaked coastal metropolis of neon boulevards, palm-lined avenues and a restless harbour. Steal cars, outrun the Sable City Police, and work your way through five story missions to settle the score with the crew that burned you.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Open `game/index.html` in desktop Chrome to play. No network needed.

## How to play

- **W / A / S / D** — move on foot, drive when in a car
- **E** — enter / exit the nearest car (steal parked and traffic cars)
- **Space** — handbrake / sprint on foot
- **F** — punch (on foot) / shoot while driving is not allowed; **mouse click** — shoot on foot
- **Shift** — sprint
- **M** — toggle the mission list, **P / Esc** — pause, **R** — restart after busted/wasted
- **H** — honk

## Systems

- A living city: traffic, pedestrians, day-to-night sky, a harbour district and a downtown core, all rendered in three.js.
- Wanted stars (0–5): police cruisers chase, ram and arrest you; lay low and the heat cools off.
- Five story missions with objectives, a payout in Sable dollars, and a free-roam mode after the finale.
- Save: progress, cash and best wanted level persist in localStorage.
- Synthesised WebAudio sound: engine hum, sirens, gunshots, cash register.

## Build

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` via the vendored make.fun library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=67v2e6cq&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
