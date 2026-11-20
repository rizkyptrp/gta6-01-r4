# NEON DUSK — Sable City

An original open-world crime game in the browser. You are **Kai Mercer**, a
wheelman fresh out of a bad deal in **Sable City**, a sun-soaked coastal
metropolis of neon boulevards, palm-lined avenues and a restless harbour.
Steal cars, outrun the Sable City Police, and work your way through five
story missions to settle the score with the crew that burned you.

## How to play

- Open `game/index.html` in desktop Chrome. No network needed.
- **W / A / S / D** — move on foot, drive when in a car
- **E** — enter / exit the nearest car (steal parked and traffic cars)
- **Space** — handbrake / sprint on foot
- **F** — punch (on foot) / shoot while driving is not allowed; **mouse click** — shoot on foot
- **Shift** — sprint
- **M** — toggle the mission list, **P / Esc** — pause, **R** — restart after busted/wasted
- **H** — honk

## Systems

- A living city: traffic, pedestrians, day-to-night sky, a harbour district
  and a downtown core, all rendered in three.js.
- Wanted stars (0–5): police cruisers chase, ram and arrest you; lay low
  and the heat cools off.
- Five story missions with objectives, a payout in Sable dollars, and a
  free-roam mode after the finale.
- Save: progress, cash and best wanted level persist in localStorage.
- Synthesised WebAudio sound: engine hum, sirens, gunshots, cash register.

## Build

`main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to
`/output` and writes `/output/dossier.json` via the vendored make.fun
library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.
