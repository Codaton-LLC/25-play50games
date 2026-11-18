# Menu 2 local multiplayer (phase M1)

1-4 players on one device (framework `00-framework.md` "Multiplayer", phase M1). Pure logic with tests,
plus thin React / R3F parts. Reference adoption: `games/sky-tower-jump` (`multiplayer.ts`,
`MultiScene.tsx`, `MultiplayerHud.tsx`).

## Modules

| File | What |
|---|---|
| `playerInput.ts` (pure) | Devices `kb1` (WASD, Space jump, E power), `kb2` (arrows, Enter or Right-Ctrl jump, Right-Shift power), `pad0..pad3` (Gamepad API standard mapping: stick + d-pad, A jump, X or B power, Start pause, radial deadzone). `createPlayerInputHub()` → `keyDown/keyUp`, `pollGamepads(pads)` (returns hot-plug events), `latch()`, `device(id)` → `PlayerInput` (same fields as the core `InputState`: `moveX/moveY`, `jump/action`, one-frame `jumpPressed/actionPressed/pressed`, plus `pausePressed`). Never touches the core `useInput()`. |
| `MultiplayerInput.tsx` | The DOM wiring: `playerInputHub` (page singleton), `<PlayerInputLatch />` (inside the Canvas, `FRAME_PRIORITY.input`; a pad's Start pauses and resumes), `playerInputFor(index)`, `useLobbyFrame`, `useConnectedPads`. Keys are taken over (no scroll / no button press) only in the lobby and during multiplayer runs. |
| `players.ts` | The session store: `phase` `off → lobby → playing`, `mode`, `heroes`, `players[]` (`index`, `device`, `heroId`, `ready`, `score`, `lives`, live `position`, `finished`, `finishMs`, `progress`). Pure reducers (`joinPlayer`, `pickHero` (unique in co-op), `setReady`, `setMode`, `startBlocker`, `beginRun`, `updatePlayer`, `applyLobbyInput`) behind `playersStore` / `usePlayers(selector)`. `setPosition` writes in place (no re-render). |
| `simulate.ts` (pure) | `createPlayerSims(spec, seed, n)` and `stepPlayerSims(spec, group, dtMs, inputs, idle)`: the game's own `create` / `step` run N times from the SAME seed, in lock-step. |
| `modes.ts` (pure) | `MODES.coop` / `MODES.versus` as config (`uniqueHeroes`, `sharedCheckpoints`, `allyPowers`, `ranking`, `finishGraceMs`). `dispatchAllyPower(mode, sims, from, power, onAllyPower, active?)` calls the game's `onAllyPower` for every active ally, co-op only. |
| `framing.ts` (pure) + `SharedCamera.tsx` | One camera for all heroes: `useFittedView` fits a reference cube once per canvas / safe area; every frame `frameHeroes` (min / max span = the zoom limit, anchor = leader or centroid, `inView` per hero) scales that fit (perspective scales exactly). `splitViewports` + `SplitScreen.tsx`: optional 2-4 viewports (takes over the render; never together with SharedCamera). |
| `results.ts` (pure) | `rankRace` (finishers by time then score, the rest by progress, ties share a place), `teamResult` (co-op), `podiumOrder`. |
| `JoinScreen.tsx`, `PlayerHud.tsx`, `Podium.tsx` (+ CSS modules) | "Press A / Space to join" with hero pick, mode switch and ready-up (auto start 1.2 s after everyone is ready); the per-player chip strip (`data-arcade-safe-area`); the podium (Play again / Lobby / Solo). |
| `device.ts` + `useMultiplayerAllowed.ts` | Phones stay single player: hidden under 700 px, and on coarse-only pointers unless a gamepad is connected. |
| `leaderboard.ts` | `sessionRunPlayers()` for `GameDefinition.runPlayers`. |

## Leaderboards

Multiplayer runs never reach the solo board. Core changes (small, tested in `core/scores.test.ts`):
`GameDefinition.runPlayers?(state)`; GameShell passes it to `isRankedRun(rules, reason, players)`
(false for players > 1, so the result is `unranked` and nothing is saved or sent) and marks the
`FinishedRun` with `players`; `submitScore` / `saveRunToAccount` also refuse any run marked
`players > 1`. Own multiplayer boards (co-op best time, versus wins) come later.

## Adoption guide (per game)

1. **Pure rules stay as they are.** Add `games/<slug>/multiplayer.ts`: `createMultiRun(seed, level, heroes, mode)` with `createPlayerSims` (same seed for everyone), `stepMulti` with `stepPlayerSims`, the mode rules you need (shared pickups, shared checkpoints, end conditions: `ranking: "team"` = everyone must finish, `"race"` = first finisher + `finishGraceMs`), and `onAllyPower` (what each power does for an ally; dispatch it with `dispatchAllyPower` when a step reports the power fired). Test it with the game's bot (`multiplayer.test.ts`).
2. **Scene:** keep the solo scene untouched and branch at the top: `usePlayers((s) => s.phase === "playing") ? <MultiScene /> : <SoloScene />`. MultiScene renders one hero per player, `<PlayerInputLatch />`, reads `playerInputFor(i)` in `useRunFrame` (map it with `inputToWorld` like `useInput()`), calls `stepMulti`, writes `setPosition` every frame and `update(i, {score, progress, finished, finishMs})` when they change, calls `playersStore.getState().beginRun()` when a new multi run is made (Retry / Restart), and ends the run with `store.end(...)`. Camera: `<SharedCamera points active anchor pitch minSpan maxSpan />` (or `<SplitScreen>` for lane games).
3. **index.tsx:** `runPlayers: () => sessionRunPlayers()`. Nothing else; the score proof is untouched because multiplayer runs are never ranked. A new solo score source still goes into the per-level maxScore proof as before.
4. **HUD:** a `2-4 players` button (shown when `useMultiplayerAllowed()`) that calls `playersStore.getState().openLobby(heroIds)`; render `<JoinScreen>` while `phase === "lobby"` (`onStart`: `arcadeStore.getState().start()`, which skips the intro), `<PlayerHud>` in place of the solo pills while `phase === "playing"`, and `<Podium>` once `isResultShown`. End the session when the HUD unmounts (Exit).
5. **Hero ids** are the game's own (all Menu 2 games use the five heroes); pass `{ id, name, color, powerLabel }` to the UI.

## Open points

- Touch-only tablets get multiplayer only with a gamepad connected (the brief said "hide on coarse-only pointers"; a coarse-only device with pads can still host 2-4 players). Revert in `device.ts` if the user wants it hidden there too.
- The intro is skipped for multiplayer runs (it shows one hero landing).
- Heroes do not collide with each other; respawns at a shared checkpoint overlap.
- No real-gamepad or tablet hardware test yet, and no browser playtest in this branch.
