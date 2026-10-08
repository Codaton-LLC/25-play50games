# Deliverable F: Shared asset library, shared technical architecture (§9) and performance (§10)

## F. Shared asset library

### F.1 Existing GLBs (D) and where the expansion reuses them

No file moves: the URLs stay where they are (thumbnails, tests and the manifest keep working). P1-A adds **alias entries** for the reused game-folder GLBs to `core/sharedAssets.ts` (`REUSED_ASSETS`: id, url, budget, fallback, default fit), so a new game imports them from core, never from another game's folder.

| GLB (path under `/models/3d/`) | Reused by |
|---|---|
| `shared/runner.glb` | treasure-island (explorer), shopping-cart (pusher), ghost-vacuum (hunter), construction-worker (worker), luggage-rush (handler) |
| `shared/robot.glb` | robot-factory (finished robots), museum-guard (gold statue) |
| `shared/battery.glb` | robot-factory (power cell), space-repair (power cells), rocket-landing (fuel cells, optional) |
| `shared/crate.glb` | treasure-island, delivery-drone, robot-factory, pirate-cannons, construction-worker, alien-farm |
| `robot-collector/barrel.glb` | pirate-cannons (powder barrels), robot-factory (torso) |
| `shared/coin.glb` | treasure-island (coin piles) |
| `shared/tinCan.glb`, `shared/banana.glb`, `food-catcher/apple.glb`, `food-catcher/burger.glb` | shopping-cart (products), monster-kitchen (ingredients) |
| `food-catcher/sock.glb` | monster-kitchen (a monster delicacy) |
| `food-catcher/chef.glb` | monster-kitchen (the cook), shopping-cart (shopper) |
| `clean-city/cleaner.glb` | shopping-cart (shopper) |
| `clean-city/bottle.glb`, `clean-city/bag.glb` | shopping-cart (products) |
| `shared/desk.glb`, `shared/chair.glb`, `escape-room/book.glb` | ghost-vacuum (haunted furniture) |
| `escape-room/door.glb` | ghost-vacuum (room doors), museum-guard (exit), castle-defender (gate, scaled) |
| `warehouse-rush/pallet.glb` | construction-worker (material yard) |
| `tower-climb/checkpoint-flag.glb` | mini-golf (hole flags, red override), penguin-slide (gates, blue) |
| `pigeon-crossing/car.glb`, `taxi.glb`, `van.glb` | delivery-drone (traffic), zoo-escape (parking lot), construction-worker (site van) |
| `pigeon-crossing/pigeon.glb` | delivery-drone (flying obstacles), treasure-island (seagull hint, white override) |
| `clean-city/bench.glb`, `bin.glb`, `lamp.glb` | zoo-escape (plaza), museum-guard (bench) |
| `clean-city/palm.glb` | treasure-island, dino-egg-rescue, pirate-cannons, zoo-escape |
| `clean-city/umbrella.glb` | treasure-island |

### F.2 New shared GLBs (C)

| Shared GLB | Games | Variation per game |
|---|---|---|
| `shared/chest.glb` | treasure-island, pirate-cannons | scale, glow |
| `shared/rock.glb` | treasure-island, dino-egg-rescue, mini-golf, castle-defender, zoo-escape, alien-farm | stretch, yaw, material tint (purple on the alien farm) |
| `shared/cannon.glb` | pirate-cannons, castle-defender | none needed |
| `shared/penguin.glb` | penguin-slide, museum-guard | standing / on its belly; bronze override |
| `shared/fish.glb` | penguin-slide, monster-kitchen | scale |
| `shared/pineTree.glb` | penguin-slide, snowball-battle | scale, yaw |
| `shared/leafyTree.glb` | dino-egg-rescue, delivery-drone, mini-golf, castle-defender, knight-arena, zoo-escape | scale, yaw, lighting preset |
| `shared/dino.glb` | dino-egg-rescue, museum-guard | bone override |
| `shared/knight.glb` | knight-arena, museum-guard | stone override |
| `shared/castleTower.glb` | castle-defender, knight-arena | backdrop vs gameplay |

### F.3 Procedural kit (B) in core

Generic procedural pieces used by two or more games live in core so games never copy each other's code. Claude-owned; each with a small test or a visual check.

| Module | Pieces | Games |
|---|---|---|
| `core/env/` | `<Water>` (vertex-wave plane, fresnel colour, foam band), `<SkyDome>` (2-colour gradient), `<Starfield>` (one `Points`), `<SnowFall>` (light particle layer) | treasure-island, pirate-cannons, mini-golf · all outdoor games · space-repair, rocket-landing, alien-farm · snowball-battle, penguin-slide |
| `core/kit/` | `<Conveyor>` (belt with scrolling canvas texture along a `Path`), `<Fence>` (posts + rails along a path, instanced), `<Flashlight>` (spot light + additive cone mesh), `<Pedestal>`, `<Gem>`, `<Parcel>` | luggage-rush, robot-factory · zoo-escape, construction-worker, knight-arena · museum-guard, ghost-vacuum, zoo-escape · museum-guard · treasure-island · delivery-drone |
| `core/fx/` | pooled `burst` kinds (sparkle, puff, splash, debris, confetti, smoke, sparks, snow), `<FloatingScores>`, `useCameraShake`, `<Trail>` | all 20 |
| `core/hud/` | `<TargetMarkers>` (off-screen arrows clear of the safe area), `<TimingRing>` (needle + arc, for space-repair; reusable) | delivery-drone, space-repair, treasure-island (optional) |
| attachments (`rig/`) | procedural hats (explorer, hard hat, beanie, safari), scarf, sword, shield, jetpack, wrench, flashlight | treasure-island, construction-worker, snowball-battle, knight-arena, space-repair, zoo-escape |

### F.4 Avoiding a repetitive look with few models

1. **Material overrides** (stone, bronze, gold, bone, tint): one GLB, several roles.
2. **Per-copy tint** on pooled models (suitcases, goblins, robot torsos): one GLB, many readable variants.
3. **Attachments**: the runner becomes four different jobs.
4. **Scale / stretch / yaw jitter** for rocks and trees, seeded, so no two groves match.
5. **World palettes and lighting presets** (`day`, `indoor`, `night`, new `sunset`, `snow`, `space`): the same props read differently in each world.
6. **Procedural set dressing** built from canvas textures (posters, shelves, wallpapers, windows) generated per game.

---

## §9 Shared technical architecture

### 9.1 System map: what exists, what is extended, what is new

| System | Status | Where | Notes |
|---|---|---|---|
| Game registration and discovery | **extend** | `types.ts`, `registry.ts`, `loaders.ts`, `app/3d/**` | 30 slugs, `collection`, `status: "dev"`, new owners and schemes, sections on `/3d` |
| Lifecycle | exists | `GameShell`, `useArcadeStore`, `frameLoop.ts` | unchanged |
| Asset preloading and caching | **extend** | `assets.tsx`, `ArcadeCard` | drei `useGLTF` cache per session (exists); new: prefetch the game's JS chunk on card hover/focus (`GAME_LOADERS[slug]()`); no top-level `useGLTF.preload` (rule kept) |
| Disposal and memory | exists + **probe** | `GameShell.tsx:288`, per-run Scene remount, `disposeHumanoid` | new: perf probe reports `geometries`/`textures`; the 10-retry flatness test becomes a gate |
| Keyboard, mouse, touch | **extend** | `inputController.ts`, `input.tsx`, `TouchControls` | new aim-drag gesture (`InputState.drag`), digit keys (`InputState.digit`), keyboard aim fallback; Jump/Action labels per game (`touchLabels`) |
| Camera | exists + **extend** | `useFittedView`, `CameraRig` | new `shake` impulse on `CameraRig`; first-person yaw mode (museum) is game-local |
| Collision | exists + **extend** | `collision.ts` | new `kinematics.ts`: circle vs segment with restitution, moving segments, 2D rigid body step |
| Physics | **decision: none** | – | custom pure kinematics; Rapier stays installed for a future game (D6) |
| NPC behaviour | **new** | `core/ai/` | steering (seek, arrive, flee, wander, separate), vision (cone + line of sight), patrol (waypoint loops with pauses, investigate/return) |
| Paths | **new** | `core/path.ts` | polyline and Catmull-Rom paths, arc-length sampling, conveyor advance, junction graphs |
| Ballistics | **new** | `core/ballistics.ts` | launch solve, step with wind, trajectory points, landing point |
| Procedural creature motion | **new** | `core/motion.ts` | hop, waddle, hover-bob, bank, squash-stretch, spring |
| Scoring | exists | `scores.ts`, `limits.ts` | unchanged; every new game proves its limits |
| Timers | exists | `durationMs`, `timeLeftMs`, run clock | unchanged; battery/power meters are game rules |
| Pause and resume | exists | shell | fix the Esc/P-behind-rotate-overlay bug (L12) in P1-B |
| Audio | **extend** | `audio.ts` | new cues + loops + pan (9.3) |
| HUD and menus | exists + **extend** | `ShellOverlays`, `Hud?`, `core/hud/` | `<TargetMarkers>`, `<TimingRing>` |
| Restart, win/lose screens | exists | shell + `ui/ResultPanel` | unchanged |
| Local score persistence | exists | `scores.ts` | unchanged |
| Achievements | **optional (Phase 7)** | `core/achievements.ts` + ResultPanel | local only, 3 per game, no server (D11) |
| Loading transitions | exists + polish | `ArcadeGameMount`, shell loading | a branded loading card with the game's thumbnail (UI kit task) |
| Error boundaries and fallback rendering | exists | `ErrorBoundary`, `<Model fallback>`, manifest gating | unchanged |
| Responsive layout | exists | safe area, fitted view, rotate overlay | report `env(safe-area-inset-bottom)` (L12) |
| Graphics quality presets | **new** | `core/quality.ts` | tiers from `PerformanceMonitor` + device hints; games scale particles and decor |
| Shared visual effects | **new** | `core/fx/`, `core/env/`, `core/kit/` | see F.3 |
| Perf instrumentation | **new** | `core/perfProbe.tsx`, `tools/perf` | `?perf=1` → `window.__arcadePerf` |

### 9.2 Directory structure after Phase 1

```
play50games-frontend/src/arcade3d/
  types.ts registry.ts loaders.ts flags.ts            # + collection, "dev", owners, schemes, PREVIEW flag
  core/
    (existing files unchanged)
    ballistics.ts ballistics.test.ts                  # P1-C
    path.ts path.test.ts                              # P1-C
    motion.ts motion.test.ts                          # P1-C
    kinematics.ts kinematics.test.ts                  # P1-C
    ai/ steering.ts vision.ts patrol.ts index.ts *.test.ts   # P1-C
    quality.ts quality.test.ts                        # P1-B
    perfProbe.tsx                                     # P1-B
    fx/ Bursts.tsx bursts.ts FloatingScores.tsx cameraShake.ts Trail.tsx index.ts bursts.test.ts   # P1-B
    env/ Water.tsx SkyDome.tsx Starfield.tsx SnowFall.tsx index.ts                               # P1-B
    kit/ Conveyor.tsx Fence.tsx Flashlight.tsx Pedestal.tsx Gem.tsx Parcel.tsx index.ts         # P1-D
    hud/ TargetMarkers.tsx TimingRing.tsx targetMarkers.ts targetMarkers.test.ts                 # P1-D
    render/ TrajectoryDots.tsx                        # P1-D
    rig/ attachments.ts attachments.test.ts           # P1-D (bone anchors from landmarks)
  games/<30 slugs>/                                   # 20 new folders, status "dev" stubs from P1-A
tools/
  gamecheck/ index.mjs README.md                      # mechanical checks for one game (Kimi, Phase 1)
  perf/ capture.mjs scenarios.mjs README.md           # CDP perf capture + baseline JSON (Kimi, Phase 1)
  thumbs/ inputs.mjs                                  # + 20 input scripts as games land
docs/arcade-expansion/                                # this plan
```

### 9.3 Representative interfaces

```ts
// types.ts (P1-A)
export type ArcadeCollection = "originals" | "adventure" | "skill";
export type ArcadeStatus = "live" | "soon" | "dev";   // "dev": hidden on production, playable with NEXT_PUBLIC_ARCADE_PREVIEW
export type AgentOwner = "claude" | "cursor" | "codex" | "antigravity" | "kimi";
export type ControlScheme =
   | "joystick" | "lanes" | "runner" | "hop" | "tap-target" | "platformer" | "point-and-move"
   | "aim-drag" | "steer" | "timing" | "look" | "flight";

export interface ArcadeGameMeta {
   // ...existing fields
   status: ArcadeStatus;
   /** omitted on the first ten = "originals" (so their meta files stay untouched) */
   collection?: ArcadeCollection;
}

// flags.ts (P1-A)
/** Shows "dev" games in /3d and serves their routes (preview builds only, never on Vercel production). */
export const ARCADE_PREVIEW = on(process.env.NEXT_PUBLIC_ARCADE_PREVIEW);
```

```ts
// core/types.ts (P1-B, P1-D)
export interface AimDrag {
   /** a drag is in progress on the canvas */
   active: boolean;
   /** one frame: the drag ended this frame (fire on this) */
   released: boolean;
   /** pointer coordinates (-1..1, y up) where the drag started and where it is now */
   start: { x: number; y: number };
   current: { x: number; y: number };
   /** 0..1, drag length over AIM_DRAG_FULL_PX */
   power: number;
   /** screen angle of (start - current), rad: "pull back to shoot" */
   angle: number;
   /** a quick release under AIM_DRAG_MIN_PX cancels (no shot) */
   cancelled: boolean;
}
export interface InputState {
   // ...existing fields
   drag: AimDrag;
   /** one frame: a digit key 1–9 (Digit or Numpad) was pressed, else null (pile, upgrade and slot choices) */
   digit: number | null;
}

export type LightingPreset = "day" | "indoor" | "night" | "sunset" | "snow" | "space";

export interface ModelAsset {
   // ...existing fields
   /** P1-D: draw this GLB with another look, e.g. a statue */
   material?: "stone" | "bronze" | "gold" | "bone" | { color: string; roughness?: number; metalness?: number; emissive?: string };
}
// plus a `tint?: string` prop on <Model> and <HumanoidModel> (multiplies the GLB colour; one cached material per tint)

export interface GameDefinition {
   // ...existing fields
   environment?: { background: string; fog?: [string, number, number]; lighting: LightingPreset };
   /** P1-B: labels for the touch Jump / Action buttons (default "Jump" / "Action") */
   touchLabels?: { jump?: string; action?: string };
   /** P1-D: opt in to the aim-drag gesture (a canvas drag then fills `drag` and is never reported as a swipe) */
   input?: { drag?: boolean };
}
```

```ts
// core/ballistics.ts (pure, P1-C)
export interface BallisticParams { gravity: number; wind?: { x: number; z: number } }
export interface Projectile { x: number; y: number; z: number; vx: number; vy: number; vz: number }
/** velocity that reaches `to` from `from` at `speed` (low or high arc); null if out of range */
export function solveLaunch(from: Vec3, to: Vec3, speed: number, p: BallisticParams, highArc?: boolean, out?: Vec3): Vec3 | null;
/** velocity that lands on `to` after `flightTime` seconds (castle-defender taps) */
export function launchForTime(from: Vec3, to: Vec3, flightTime: number, p: BallisticParams, out?: Vec3): Vec3;
export function stepProjectile(proj: Projectile, dt: number, p: BallisticParams): void;
/** writes up to `count` points into `out` (x,y,z triplets); returns the number written */
export function trajectoryPoints(proj: Readonly<Projectile>, p: BallisticParams, count: number, step: number, out: Float32Array, groundY?: number): number;
```

```ts
// core/path.ts (pure, P1-C)
export interface Path { readonly points: readonly Vec3[]; readonly closed: boolean; readonly total: number }
export function createPath(points: readonly Vec3[], options?: { closed?: boolean; smooth?: boolean; samples?: number }): Path;
export function pointAt(path: Path, s: number, out?: Vec3): Vec3;      // s = arc length, wrapped when closed
export function tangentAt(path: Path, s: number, out?: Vec3): Vec3;
export function nearestS(path: Path, point: Vec3): number;
/** junction graphs for conveyors: which segment a rider takes at a node */
export interface PathGraph { segments: Path[]; next(segment: number, choice: number): number | null }
```

```ts
// core/ai (pure, P1-C)
export function inViewCone(origin: Vec3, yaw: number, halfAngle: number, range: number, target: Vec3): boolean;
export function hasLineOfSightXZ(a: Vec3, b: Vec3, blockers: readonly Box[]): boolean;
export interface PatrolState { index: number; wait: number; mode: "patrol" | "investigate" | "return"; target: Vec3 }
export function stepPatrol(agent: Agent, state: PatrolState, route: Path, dt: number, opts: PatrolOptions): void;
export function seek(agent: Agent, target: Vec3, maxSpeed: number, out: Vec3): Vec3;   // also arrive, flee, wander, separate
```

```ts
// core/motion.ts (pure, P1-C) — whole-body motion for solid creatures and vehicles
export function hop(phase: number, height: number, out: BodyOffset): BodyOffset;         // y, squash
export function waddle(phase: number, amount: number, out: BodyOffset): BodyOffset;      // roll, bob, yaw wobble
export function hover(t: number, amount: number, out: BodyOffset): BodyOffset;
export function bank(lateralAccel: number, maxRoll: number): number;
export function spring(state: { x: number; v: number }, target: number, stiffness: number, damping: number, dt: number): number;
```

```tsx
// rig attachments (P1-D)
<HumanoidModel asset={RUNNER} pose={pose}
   attach={{ head: <ExplorerHat />, chest: <VacuumPack />, handR: <Sword /> }} />
// anchors computed from the landmarks: head (top of the head joint), chest (back of the chest), handL/handR (wrist + palm offset)

// per-copy tint (P1-D)
<DynamicInstancedModel asset={SUITCASE} count={40} update={(i, m, color) => { …; color.set(FLIGHT_COLOR[bag.flight]); }} />

// effects (P1-B)
const fx = useFx();                       // pooled, no allocation per emit
fx.burst("sparkle", position, 18);
fx.score(position, "+200");
useCameraShake()(0.3);

// quality (P1-B)
const { tier, particles, decor } = useQuality();   // tier "low" | "mid" | "high"; particles 0.4 / 0.7 / 1; decor 0.5 / 0.8 / 1
```

```ts
// audio (P1-B): synthesized only, no audio files (zero download)
export type SfxName = "pickup" | "hit" | "jump" | "win" | "lose" | "countdown" | "go"
   | "whoosh" | "splash" | "thud" | "chime" | "combo" | "buzz" | "boom" | "click" | "pop" | "zap" | "alarm";
export function playSfx(name: SfxName, opts?: { pitch?: number; pan?: number; volume?: number }): void;
export type LoopName = "engine" | "rotor" | "vacuum" | "belt" | "surf" | "bubbling" | "slide" | "thrust" | "hum" | "ambient";
/** returns a handle; stops itself on pause, mute and unmount (GameShell) */
export function startLoop(name: LoopName, opts?: { volume?: number }): { set(o: { pitch?: number; volume?: number; pan?: number }): void; stop(): void };
```

### 9.4 Rules that keep 30 games modular

1. A game folder imports only from `core/`, `types.ts` and its own files.
2. Anything a second game needs moves to core (Claude review), never copied.
3. Pure logic in `rules.ts`; every core helper the rules use is pure too (ballistics, path, ai, motion, kinematics, collision, math, limits).
4. New core APIs are additive; existing games are not edited by core PRs (as in follow-up 2).
5. `core/README.md` gets one section per new module with a 10-line usage example; agents read that, not the source.

---

## §10 Performance and visual quality

### 10.1 Budgets (testable)

Devices: **desktop** = a 2020+ laptop with integrated graphics in Chrome; **mid phone** = in emulation, Chrome DevTools "Moto G Power"-class profile (390 × 844 css px, DPR 2.75 capped by the shell at 1.75, CPU throttled 4×); real-device checks on your phone(s) before go-live. Emulation is a regression signal, **not** a frame-rate promise.

| Metric | Desktop | Mid phone (emulation) | Gate |
|---|---|---|---|
| Draw calls (`renderer.info.render.calls`) | ≤ 150 hard cap; per-game target in its spec (30–80) | same | G4 review |
| Visible triangles | ≤ 300k | ≤ 150k | G4 |
| Skinned characters on screen | ≤ 6 | ≤ 5 | design |
| Extra dynamic lights (beyond the preset) | ≤ 1 spot or point | ≤ 1 | design |
| Shadow maps | none (blob shadows) | none | design |
| Transparent overdraw | ≤ 3 full-screen layers | ≤ 2 | G4 |
| Frame time p95 (perf probe, 30 s of scripted play) | ≤ 16.7 ms | ≤ 33 ms in 4× CPU emulation | G4; real phone: report, no promise |
| GLB bytes fetched for one game (cold, excluding cached shared) | ≤ 3 MB | same | assets PR |
| JS chunk of one game (gzip) | ≤ baseline max of the existing 10 + 15 % (measured in P1-B) | same | build route table |
| Time to start card, cold, "Fast 4G" | ≤ 3 s | ≤ 4 s | G4 |
| Memory after 10 Retries | `geometries` and `textures` flat (± 2), JS heap growth ≤ 5 MB | same | G4 |

### 10.2 Pipeline and assets

- GLB via `tools/hyper3d optimize`: centred pivot, webp textures (1024 characters / 512 props), simplify, **meshopt** compression (loaded with `useGLTF(url, false, true)`, no Draco CDN) **[V]**. Budgets enforced by the tool.
- One material per GLB where possible (Rodin outputs one); per-copy variety by instance colour and overrides, which share programs.
- Canvas textures (`useCanvasTexture`) for signs, labels, terrains: power-of-two sizes ≤ 1024, built once per mount, disposed on unmount.
- No post-processing (bloom, SSAO) in v1: glow = emissive + additive sprites.

### 10.3 Rendering techniques

- **Instancing:** static repeats with `<InstancedModel>`, moving pools with `<DynamicInstancedModel>` (one draw call per mesh for the whole pool) **[V]**.
- **Draw-call reduction:** merge static procedural set dressing per material (`BufferGeometryUtils.mergeGeometries` at build time of the scene), canvas atlases for signs.
- **Culling:** static meshes keep three's frustum culling; pools and skinned meshes are not culled **[V]**, so big worlds use **chunks** (penguin-slide track, delivery-drone city blocks) mounted by distance.
- **Lighting consistency:** only the six presets, plus at most one spot (flashlight games); emissive for gameplay highlights.
- **Animation cost:** humanoid poses are allocation-free and computed once per character per frame **[V]**; creature motion is a few trig calls; no animation mixers.
- **Collision:** n is small (≤ 60 movers), pure XZ tests; a uniform grid is added to core only if a game exceeds 100 movers (none planned).

### 10.4 Adaptive quality

`core/quality.ts` maps drei `PerformanceMonitor` (already driving DPR 1.75 → 1 **[V]**) to three tiers:

| Tier | When | DPR | Particles | Decor density | Water/env |
|---|---|---|---|---|---|
| high | desktop, no declines | 1–1.75 | 1.0 | 1.0 | full waves |
| mid | coarse pointer or 1 decline | 1–1.5 | 0.7 | 0.8 | reduced waves |
| low | 2+ declines | 1 | 0.4 | 0.5 | flat water |

Games read `useQuality()` only for cosmetic counts; rules never depend on the tier (scores stay fair).

### 10.5 Measuring and diagnosing regressions

1. **Perf probe** (`?perf=1`): `window.__arcadePerf = { calls, triangles, geometries, textures, programs, frames, p50, p95, max }`, sampled every frame, no allocation (generalises tower-climb's `__towerProbe` **[V]**).
2. **`tools/perf`** (CDP, like `tools/thumbs`): builds nothing, points at a local `next start` (never production), plays a scripted 30 s per game with CPU throttling 1× and 4×, writes `tools/perf/out/<slug>.json`, and compares with `tools/perf/baseline.json` (committed). Fails when calls +10 %, p95 +20 % or geometries grow over retries.
3. **Baseline first**: P1-B records the 10 existing games so regressions in shared code show at once.
4. **Diagnosis order** when a gate fails: probe numbers (calls/triangles/textures) → Chrome Performance trace of 5 s (scripting vs GPU) → `renderer.info.programs` (shader variants exploding from per-object materials) → transparent overdraw (fx counts) → GC (allocations in `useFrame`, visible as sawtooth heap).
5. **Real devices**: before each go-live you run the game once on your phone with `?perf=1` and the overlay (P1-B adds a tiny on-screen readout when `perf=1`), and paste the numbers into the go-live checklist.
