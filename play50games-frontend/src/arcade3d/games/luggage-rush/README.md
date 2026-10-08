# Airport Luggage Rush

Owner: Cursor. Slug: `luggage-rush`. Adventure game 3 (order 13), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §3. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south, y up. Every "Changed from spec" line says what and why. P-15 tests the junction rule at the crossing line.

## Concept

A compact baggage hall. Suitcases ride a belt graph; each tag is a flight (colour + symbol + the same shape on its chute). The player flips diverters so a bag takes the branch showing **when it crosses that junction line**. One flip can save or misroute a whole queue. Three strikes (wrong chute or the overflow end) end the run; otherwise the 120 s clock does. Accent `#60a5fa`.

## Controls

`meta.ts` will say: `scheme: "tap-target"`, `touchControls: ["tap"]` (no on-screen button; taps hit the belts).

- `keyboard`: "A / left, S / down and D / right flip diverters 1–3; W / up flips diverter 4 after 70 s; or click a diverter". Changed from the stub ("A / S / D / W or a click flip the diverters"): the stub omits arrows and the 70 s lock.
- `touch`: "Tap a diverter to flip it" (unchanged from the stub).
- Input: keyboard reads `pressed` (`left` / `down` / `right` / `up` = diverters 1–4) only on frames where `swipe` is null. **If `swipe` is set, ignore `pressed` that frame** (`pressed` already copied the swipe direction, and `tapDown` on the pointer-down frame — the start of that swipe — already flipped the diverter under the finger, so reading both would flip two). `swipe` itself is not read. A click or a touch reads `tapDown` only, never `tap`. The Scene picks the nearest unlocked diverter whose screen box contains the point. Esc / P pause (shell). Locked diverters ignore both.

## Rules

All numbers live in `rules.ts` (`HALL`, `BELT`, `SPAWN`, `DIVERTERS`, `FLIGHTS`, `SCORE`) and are proven in `rules.test.ts`. One `useRunFrame`; input is applied, then bags move, so a flip on the crossing frame counts.

- **Graph** (fixed segments, `createPath` polylines, one `createPathGraph`). Spine runs +z; chutes run +x to gates at x = 6.2. Lengths: entry 4.4 (spawn (2.2, 0.45, 0) → D1), mid 3.6 (D1 → D2), chuteR / chuteB / chuteG / chuteY 4.0 each, toD3 3.2, hold 3.0, overflow 2.8. Belt top y = 0.45. Shortest delivery = entry + chuteR = **8.4**. There is no `greenDirect` segment: before 40 s that route is toD3 + chuteG (3.2 + 4.0 = 7.2) with D3 locked to 0, and its first leg **is** toD3 (one belt, no mesh stacked on it).
- **Junction line:** `advanceGraph(rider, graph, choose, ds)`. `choose(endingSegment)` returns the outgoing segment index. It is read only when this step's overflow crosses the end (`s` passes the segment length). A flip 1 ms **before** that crossing takes the new branch; a flip 1 ms **after** (the rider's `segment` is already the old branch) does not pull the bag back. Changed from a loose "the diverter it sees": the sample point is that overflow, which is what P-15 tests.
- **Phases.** The graph exists at t = 0. 0–40 s: D1 and D2 take input. D1 choice 0 = chuteR, 1 = mid. D2 choice 0 = chuteB, 1 = toD3. D3 is locked to 0 (chuteG); D4 ignores input; overflow is unreachable. 40 s: D3 unlocks (0 = chuteG, 1 = hold). Bags already on toD3 or chuteG stay on that segment. 70 s: the hold's end becomes D4 (0 = chuteY, 1 = overflow). **Before 70 s, a bag routed onto the hold strikes at that D3 crossing and is removed** (decision b): it does not ride the hold. Start: every unlocked diverter on choice 0.
- **Belt** (`BELT`): base 1.35 m/s, ×1.03 at 15, 30, 45, 60, 75, 90 and 105 s (seven steps, 1.660 m/s after 105). Heavy bags (from 30 s) ride at 0.70 × the current belt speed. Conveyor `speed` uses the same number.
- **Spawn** (`SPAWN`): one bag at t = 0, then when the wait finishes. `interval(t) = 2.2 − 1.3 · min(t, 120) / 120` (2.2 s → 0.9 s). If the previous bag on the entry is closer than **1.1** m, the spawn waits (the bag is kept, not dropped). A follower's `ds` shrinks so it never passes or closes inside 1.1. Across a junction the gap is measured on the **follower's** branch under this frame's diverter state: if the leader is already on the segment `choose` would give the follower, gap = `(segmentLength − follower.s) + leader.s`; a leader on any other branch does not count, so a flip can release the follower the same frame. Pool 40; a full pool waits. Alive bags ≤ 33.0 / 1.1 ≤ 40 (the segments above, toD3 not counted twice). Normal bags never bunch: minimum gap is 1.660 × 0.9 = 1.49 > 1.1.
- **Tags** (`FLIGHTS`): 0 red `#f87171` circle, 1 blue `#60a5fa` square, 2 green `#34d399` triangle, 3 yellow `#fbbf24` star. Seeded uniform among 0–2 before 70 s, 0–3 from 70 s. From 30 s a roll < 0.20 is heavy (else normal); from 50 s a roll < 0.12 is VIP, < 0.30 and ≥ 0.12 is heavy, else normal. VIP and heavy are exclusive. VIP is a ×2 score, not a fifth flight and not a new shell colour (the shell keeps its flight tint).
- **Strike and delivery** resolve at a segment **end**, except the early hold. A correct bag scores at the chute end (s = 4.0). A wrong chute strikes there too, not on entry: striking at the junction (4.4 m from spawn) would put the third strike at **7.64 s**, under the 10 s floor. Overflow strikes at the overflow end (s = 2.8). A hold route before 70 s strikes on the D3 crossing, the bag is removed, and the puff / tumble plays that frame. Each strike scores 0 and sets the streak to 0. The third strike resolves on that frame.
- **Clock:** `durationMs: 120000` (fixed; the shell counts it down). The first 20 s are the slow part of `interval` (2.20 → 1.98 at 20 s), not a second speed ramp.

## Scoring

`mult(streak) = min(3, 1 + 0.25 · (streak − 1))` on a correct delivery (streak counts that bag: 1 → ×1, 9 → ×3 and stays there). `points = 20 · mult · (vip ? 2 : 1)` (always an integer: 20, 25, … 60, VIP 40 … 120). `addScore(points)` on delivery. A strike does not add. Popups "+20" … "+120".

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `meta.ts` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` | 7500 | **7620** |
| duration | 10000–122000 ms | **10000–122000 ms** |
| `base` / `max_pps` | 7500 / 7500 | **0 / 64** |

An oracle that never strikes, sends each bag down the 8.4 m chute, and is allowed every post-50 s spawn to be VIP, delivers **77** bags and scores **7500**. The 77th spawns at 114.33 s and arrives at 119.39 s; the 78th spawns at 115.29 s and arrives at 120.35 s, after the clock. The chord `score / t` peaks at the 77th delivery (**62.82** pts/s). Heavy bags and the 1.1 m wait only delay spawns, so they score less. Decision (a): the server cap is 7620 and 64 pts/s, a cushion of one max VIP delivery over that ceiling; `0 + 64 · seconds` stays above every prefix and above 7620 at 120 s (7680). Proof plan (through the real store, `advanceRunClock` + `playedFrameDt`):

1. **Schedule:** spawn times match `interval`; a bag ahead at < 1.1 m delays the next spawn; the junction gap uses the follower's current branch; alive bags ≤ 33.0 / 1.1 ≤ 40.
2. **Speed:** a normal step never moves more than `beltSpeed(t) · dt`; a heavy step never more than 0.70 × that; seven ×1.03 steps and no eighth.
3. **Junction:** a toggle 1 ms before the crossing line selects the new branch; 1 ms after, the old one. Phase swaps at 40 s and 70 s obey the same line. Before 70 s a hold choice strikes on that crossing and the bag is gone; it is not waiting at the hold end.
4. **Combo:** `mult` and VIP ×2; a strike zeros the streak and adds 0; three strikes stop the run.
5. **Earliest lose:** three wrong trips that strike at the chute end (8.4 m at 1.35 m/s), spawns at 0, 2.2 and 4.376 s, third strike at **10.60 s** ≥ 10.5 s. Striking at chute entry instead is the rejected 7.64 s case. The hold cannot beat this: D3 stays locked until 40 s, and the path to that crossing is 11.2 m.
6. **Ceiling:** the oracle scores 7500, under the 7620 cap; every prefix passes `withinServerLimits` at base 0 and 64 pts/s (peak 62.82); `capScore` is a no-op on legal runs. Measured in the build: that bot on the store at 60 fps, 20 fps and random 4–50 ms frames.

## Run end

- `end("lose")` on the frame the third strike resolves. `resultDelayMs: 900` so the tumble is seen. Points game: the score so far is ranked.
- `"timeup"` by the shell at 120 s: bags still on the belts do not score. Also ranked. No `"win"`. A strike on the time-up frame is a time-up (the clock runs first).

## Scene and camera

- **Fixed isometric, pitch 50°**: every junction is on screen and the camera never moves. `useFittedView({ area, pitch: 50°, yaws: [0.55, 0.55 + π/2], margin: { top: 0.10, bottom: 0.08, left: 0.02, right: 0.02 }, padding: 8, shift: true })`. `area` is the hall box x 0.4–11.6, z −0.6–14.8, y 0–2.6 (belts, gates, handler). Landscape yaw 0.55 shows the spine in depth and the chutes to the right; portrait adds π/2. No `follow`, no `CameraRig` follow.
- **Hall:** floor `#cbd5e1`, belts `#334155`, one window bay on the north wall. Lighting `indoor` only.
- **Handler** (decor): `SHARED_ASSETS.runner` at the same 0.825 scale as the other games (1.556 m), `useHumanoidPose`, `applyLift={false}`, group raised by `bodyLift × 0.825`. `idlePose` with a `reachPose` wave on one arm (the core pose that reads as a wave). Feet on the floor. Hidden when `useQuality().decor` is the low tier.
- Diverter arrows are a yaw, not a colour. Each on-screen hit box is at least 64 × 64 px; if two would overlap, the nearest diverter wins and the boxes are clipped apart.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `hudStats` for strikes and combo, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`pressed`, `tapDown`), `useFittedView` (fixed; `shift: true`), `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setStat`, `end`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `createPath`, `createPathGraph`, `advanceGraph`, `pointAt`, `tangentAt` (`core/path`), `<DynamicInstancedModel tinted>` (the `update` `color` argument), `<DynamicInstanced>`, `<Instanced>`, `<Model fallback>`, `BlobShadow`, `useCanvasTexture`, `EXPANSION_ASSETS` / `SHARED_ASSETS`, rig (`<HumanoidModel>`, `useHumanoidPose`, `idlePose`, `reachPose`, `bodyLift`, `RUNNER_LANDMARKS`), `core/kit` `<Conveyor>`, `core/fx` (`useFx`: `burst` sparkle on a correct chute, `burst` puff on a strike, `score`; `fx.shake` on overflow, off when reduced motion is set), `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below). Not used: Rapier, `core/ai`, `followFocus`. Nothing generic is planned in the game folder; the queue gap and the phase locks are the rules.

## Assets

No new generation. Suitcase and plane are already in `core/modelManifest.ts` (`EXPANSION_ASSETS`). Fits checked in `assets.test.ts` on the real meshes.

| id | class / source | target in game | rules | fallback |
|---|---|---|---|---|
| suitcase | A `EXPANSION_ASSETS.suitcase`, pool of 40, `<DynamicInstancedModel tinted>` | shell 0.70 along the belt, 0.50 across, 0.25 thick, lying flat | a point on the path | box |
| plane | E `EXPANSION_ASSETS.plane` | **3.2** long in the window bay (default asset scale is 8 m) | none | box |
| handler | D `SHARED_ASSETS.runner` scale 0.825 | 1.556 m | none | capsule |
| procedural | B: hall, window, `<Conveyor>` strips, rollers, diverter arrows, chute mouths (circle / square / triangle / star), flight boards (`useCanvasTexture`), tag quads | | | |

- The suitcase GLB still has a short trolley handle above the shell (drawn about 0.90 m tall if it stood). It lies on the belt; the handle is a stub, not a collision and not a reason to regenerate. Flight tint is `color.copy(FLIGHT_COLOR[flight])` with `tinted` set so the shader is compiled at mount. VIP keeps that flight colour. A gold rim (`#fde68a`, a slightly larger quad in its own pool, hidden when the bag is not VIP) marks it. `#fbbf24` stays the yellow flight only: a red VIP must not read as a yellow bag.
- Tags are four `<DynamicInstanced>` quad pools (one UV window each: circle, square, triangle, star), not tinted, so the symbol stays black, plus the VIP rim pool. Each tag is a **billboard ≥ 0.45 m**. On 390×844 the closer fit (yaw 0.55, fov 50, this hall box) is about **20 px/m**, so the tag is about **9 px**; the chute mouth repeats the same shape at 0.9 m (about 18 px) and is the mark a phone can read. Changed from spec (one atlas on the suitcase mesh): per-copy UVs are not in the instancing helper, and a tint would dye the symbol.
- Changed from the shared plane scale (8 m, single propeller, wingspan about 9.4, height about 4.0): this game draws it at 3.2 m so the fit box stays on the belts. An 8 m plane inside `area` would shrink the diverters under a 64 px target. It taxis 1.2 m on a decor path. Hidden on the low tier. Changed from spec (procedural silhouette): the imported GLB is the window toy. Changed from the catalog prompt (two engines): the file is the single-propeller plane and is not regenerated.
- `assets.spec.json` lists suitcase and plane only (the GLBs under `/models/3d/luggage-rush/`). The handler is shared.

## Files

`meta.ts` (data, scoring; strings as Controls) · `index.tsx` (`GameDefinition`) · `rules.ts` (graph, spawn, phases, junction choice, queue, scoring; pure, seeded) · `rules.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` (one `useRunFrame`, fit, input pick, fx, audio) · `Hall.tsx` (floor, window, plane, boards, handler) · `Belts.tsx` (conveyors, arrows, chutes) · `Bags.tsx` (pool, tags, tumble) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/luggage-rush.webp` · `tools/thumbs/inputs/luggage-rush.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4). Core path, tint and conveyor are already tested.

- **Graph:** lengths 8.4 and toD3 + chuteG = 7.2; no second segment on toD3; D3 locked to chuteG before 40 s; overflow unreachable before 70 s; bags already on toD3 or chuteG are not moved at 40 s.
- **Junction:** toggle 1 ms before the line vs 1 ms after, for all four diverters, including the 40 s and 70 s swaps. The follower gap uses its own branch when the leader has already crossed.
- **Spawn:** deterministic per seed; interval integral; the 1.1 m wait; heavy 0.70 and no passing; alive ≤ 40; VIP only from 50 s and never also heavy.
- **Scoring + proof:** `mult` and VIP ×2; a wrong chute strikes at s = 4.0 (not at 4.4 m); a hold before 70 s strikes on the D3 frame and is removed; oracle 77 bags, 7500 points, 78th arrival > 120 s, chord peak 62.82; third chute-end strike at 10.60 s and the 7.64 s entry reading is rejected; every oracle prefix passes `withinServerLimits` at 0 / 64; `capScore` a no-op; the store bot never exceeds 7500 and a three-strike lose is ≥ 10000 ms.
- `assets.test.ts`: suitcase shell 0.70 × 0.50 × 0.25 lying down; plane 3.2 long in this game's fit; handler height 1.556 and soles within 1 cm; tag quad ≥ 0.45 m.
- Browser (headless CDP, flags + mock): the common criteria (03), banner open, Retry ×10 keeps `geometries` flat; on 390×844 a tag is about 9 px and the chute mouth about 18 px; a grey-scale shot still separates flights by symbol; hit boxes ≥ 64 px and disjoint; a swipe that starts on a diverter flips only that one.

## Performance

Target **30** draw calls (the spec's estimate), cap **40** (the spec's "≤ 40 with 40 bags"), and under the 150 hard cap. Each `<Conveyor>` is 2 calls. The spine is **one** path (entry + mid + toD3 + hold) = 2, not a conveyor per segment and not a second strip on toD3. Four chutes = 8, overflow = 2, so the belts are 12. Plus suitcase 1–2, tag symbols 4, VIP rim 1, arrows 1, boards 1, hall 2, window 1, plane 1, handler 1, one fx burst 1. Steady **26** with one suitcase mesh, **27** with two; a score sprite stays inside the cap of 40. No separate roller pass (the chevron is the belt). Lights: the `indoor` preset only. Pool 40 warmed with `fx.warm("sparkle", "puff", "score")`. Plane and handler drop out on the low tier. No per-frame allocation. Measured with `?perf=1` (p95 on the mid-phone profile, 09 §L.3) and written back here.

## Audio

P-06 is not merged. Designed against 06 §9.3 (`playSfx(name, { pitch, volume })`, `startLoop`): `startLoop("belt", { volume: 0.35 })` on play (the shell stops it on pause, over and mute); diverter `playSfx("click")`; correct `playSfx("chime", { pitch: 0.9 + 0.15 · (mult − 1) })` or `"combo"` once that cue exists; strike `"buzz"`; overflow `"thud"`. Until P-06 lands, as treasure-island does: correct `"pickup"`, strike and overflow `"hit"`, and no belt loop (the moving chevrons carry it).

## Accessibility

Each flight has a colour, a tag symbol and the same shape on the chute, so a grey-scale frame still tells them apart. The tag is a 0.45 m billboard (about 9 px on 390×844); the chute mouth at 0.9 m (about 18 px) is the readable copy of that shape. VIP is a gold rim, not a recolour, so it stays distinct from the yellow flight. Diverter state is an arrow. Hit boxes ≥ 64 × 64 px, nearest-wins if the fit would overlap them. The opening interval is the slow start. Keyboard and touch both finish the run. `fx.shake` honours reduced motion (core). Strikes read as "Strikes x/3", not colour alone.

## Risks and open questions

### Decisions (user, 2026-10-08)

- **(a) Limits.** `maxScore` **7620** and `maxPointsPerSec` **64**, base 0. The proof stays 77 bags and a **62.82** pts/s chord. 7500 / 63 had no cushion; 7620 is one max VIP delivery (120) above the legal 7500.
- **(b) Hold.** A bag misrouted into the hold before 70 s strikes at once, with the puff and tumble that frame, and is removed. It does not travel the hold and strike at the far end.

- **7620 is a cushion, not a new oracle.** Lengths and `BELT` stay the constants above. The test fails if bag 78 arrives at ≤ 120 s: that run would still be under 7620 only if it scored ≤ 120 more, and it must not be treated as the design ceiling.
- Portrait fit vs 64 px boxes: nearest-wins is the mitigation; the browser check records the centre distance. If centres land under 64 px, the hall box is tightened in the build (camera only), not the rules.
- The suitcase handle sticks up off the belt. It must not be read as a second bag (the tag sits on the shell).
- A 0.45 m tag is about 9 px on 390×844 at this fit. The chute mouth is the readable symbol. Enlarging the tag later is a camera or quad change, not a rules change.
- P-06 timing (audio above).
- No further design question: the swipe rule, the chute-end strike, the locked D3 route and the VIP rim are fixed above.

## Status

(empty until the build)
