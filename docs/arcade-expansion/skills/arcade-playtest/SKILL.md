---
name: arcade-playtest
description: Playtest a 3D Arcade game locally (headless Chrome over CDP or a browser agent) at desktop and phone sizes, capture screenshots and tools/perf numbers, and report findings. Never against production. Use before a review, for visual or mobile QA, at a wave end, or when asked to "play", "check on mobile" or "measure performance" of an arcade game.
---

# Arcade playtest

## Setup (local only)
In `play50games-frontend`:
```sh
NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 NEXT_PUBLIC_ARCADE_PREVIEW=1 npx next build
npx next start -p 3100
```
(Windows: set the variables with `$env:NAME="1"` in PowerShell.) Only `localhost` URLs. The flags are inlined at build time: rebuild after changing them.

## Steps
1. Open `http://localhost:3100/3d/<slug>?perf=1`.
2. Sizes: 1280 × 800 (keyboard, mouse), 390 × 844 and 360 × 740 (touch emulation, cookie banner open, then closed), 844 × 390 landscape.
3. For each size: Play → one full run to the end → Pause (Esc / P, and switching tabs) → Resume → Retry ×3 → Exit.
4. Check: nothing important under the HUD, the joystick/buttons or the banner; text readable; touch targets ≥ 44 px; the controls do what the start card says; characters never in a T-pose, feet on the floor, no clipping; effects readable; result delay shows the end animation; console free of errors and warnings (except the known "Context Lost" on exit).
5. Perf: read `window.__arcadePerf` after 30 s of play, or run `node tools/perf/capture.mjs --slugs <slug>` (desktop + 4× CPU mobile) and `node tools/perf/compare.mjs`.
6. Screenshots: one in play and one of the result per size; a short recording if the agent can.

## Output
A report ≤ 40 lines ordered by severity (blocker / should / nice), each with size, steps, expected vs actual, and the screenshot path; the perf JSON path and any budget breach.

## Validation checklist
- [ ] Never pointed at cms.play50.games or the live site.
- [ ] Every size covered; banner open and closed on phones.
- [ ] Perf numbers attached.

## Reuse
Every game review (G4), every wave end (P-20), every go-live audit (P-21).
