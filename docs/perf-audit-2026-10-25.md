# Perf audit — 2026-10-25

Static read of `play50games-frontend/src/arcade3d/games/*` and `core/`, against `core/README.md` (no per-frame allocation, instancing for repeats, phone quality tiers, blob shadows rather than shadow maps, ≤ 150 draw calls). No build, no server, no `?perf=1` numbers. Live draw-call counts are not in this report; repeated meshes were judged from the scene graph.

Frame callbacks (`useFrame`, `useRunFrame`, `useHumanoidPose`) do not construct `Vector3`, `Matrix4`, `Color`, `Quaternion`, or `BufferGeometry`. Scratch objects live at module scope or in `useState` / `useMemo`. The breaks below are helpers those callbacks call, geometry uploaded every frame, quality caps that do not move, and GPU objects created on mount and never disposed. Scene remounts on every run (`ShellStage` keys the game clock by `runId`), so a `useMemo` geometry without `dispose` is a new GPU buffer on every Retry.

No game sets a shadow-map size. `ShellStage` does not enable `gl.shadowMap`, so `castShadow` / `receiveShadow` do not allocate maps.

Severity: **high** = every frame on a phone, or a grid that stays desktop-sized on the mid tier. **med** = every frame but small, or a leak / clone count that grows with Retries or with the pool. **low** = a few vertices, a tap, or a count under the "20 identical meshes" line.

## Top 10

| # | Where | Severity | Issue |
|---|---|---|---|
| 1 | `core/env/Water.tsx:44` + `games/pirate-cannons/Bay.tsx:199` | high | Sea of 500 × 360 m. `waterDetail` caps both full and reduced at 96 segments per side, so a phone (mid tier) shades the same 96 × 96 wave grid as desktop until two declines force `"flat"`. |
| 2 | `core/env/Water.tsx:44` + `games/treasure-island/Island.tsx:140` | high | Same cap. A 180 × 180 m sea is 96 × 96 on full (step 0.6 m) and still 96 × 96 on reduced (step 1.2 m; the cap is hit at 115 m). |
| 3 | `core/ShellStage.tsx:28`, `:118`, `:162` | high | Canvas DPR starts at 1.75 with antialias on. `quality.maxDpr` is 1.5 on mid and 1 on low (`quality.ts:34-36`) and is never passed to `<Canvas>`. A coarse pointer is mid from the first frame and still renders at 1.75 until `PerformanceMonitor` declines, then jumps to 1. |
| 4 | `games/ghost-vacuum/Vacuum.tsx:43` (called from `Scene.tsx:86`) | high | Every frame: `computeVertexNormals()` and `computeBoundingSphere()` on the hose tube, including while the hunter stands still. |
| 5 | `games/museum-guard/Hud.tsx:57` | med | A `requestAnimationFrame` loop rewrites the radar SVG every frame (`paint` at `:30` builds new path strings and calls `setAttribute`), whether or not a statue moved. |
| 6 | `games/museum-guard/Gallery.tsx:585` | med | Pedestal, vase, paintings, fixtures, wash, rope, posts, and the mote cloud are `useMemo` geometries with no `dispose`. Each Retry allocates another set. `mergeGeometries` inputs inside the factories are also never disposed. |
| 7 | `games/food-catcher/Scene.tsx:217` | med | 16 slots (`MAX_ALIVE` in `rules.ts:19`) each mount all 5 food `<Model>`s (`slots` at `:305`, rendered at `:313`). 80 GLB clones stay resident; hidden kinds are not a pool. |
| 8 | `games/space-repair/Scene.tsx:121` | med | Every frame spreads a new safe-area object into `markerBounds`, which itself allocates two rects (`core/hud/markerPlacement.ts:34-35`). Stars at `:136` drop only when `tier === "low"`, so a phone (mid) still draws 600. |
| 9 | `games/knight-arena/Dummies.tsx:130` | med | Fallback parts, disc, ring, arrow, shield, and tomato geometries and materials are created in `useMemo` (`:130-169`) and never disposed. |
| 10 | `games/delivery-drone/Decor.tsx:104` and `games/mini-golf/Islands.tsx:295` | med | River 14 × 220 m and the golf sea 70 × 150 m. The long side stays at the 96-segment cap on both full and reduced. |

## Core

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `core/ShellStage.tsx:118`, `:162-164` | `maxDpr` state starts at `MAX_DPR` (1.75) and only falls to 1 after a decline. `quality.maxDpr` (`quality.ts:26-36`) is not the canvas cap. Antialias stays on for phones. | high | Set the canvas `dpr` max from `quality.maxDpr` (1.5 mid, 1 low) on the first frame, and turn antialias off on low. |
| `core/env/Water.tsx:44-45` | Segment count is `min(96, length / step)`. Any side longer than ~58 m (full) or ~115 m (reduced) is 96. Mid does not shrink pirate, treasure, the golf sea's long side, or the drone river's long side. | high | Cap by tier (96 / 48 / 1) or drop the shared cap so reduced step 1.2 m can go below 96. |
| `core/hud/markerPlacement.ts:34-35` | `markerBounds` returns a new rect every call (`plain` and `bounds`). Safe when memoised (`TargetMarkers.tsx:52`). Not safe from a frame callback. | med | Write into a caller-owned rect. |
| `core/useArcadeStore.ts:223-226` | `setScore` always calls `set`, even when the number is unchanged. Selectors skip a React render; every subscriber still runs. | low | Return early when `score` is already that value, the way `setStat` does at `:230`. |
| `core/env/SnowFall.tsx:125-133` | Drawn count follows `useQuality().particles`, but `needsUpdate` uploads the whole position buffer (allocated for the full `count`). | low | Upload only the shown range, or size the buffer to the scaled count. |
| `core/kit/Flashlight.tsx:157-163` | Clip writes an existing buffer and skips `computeBoundingSphere` after the first clip (`:103-109`). The real light is omitted on low (`:139`). | — | No change. This is the pattern the hose and the motes should follow. |

`HumanoidModel`, `DynamicInstanced`, `FxLayer`, `EyeRig`, and `CameraRig` keep their scratch in `useState` / module scope. `SnowFall` and `Water` are the only env pieces that read the tier themselves, so a game that renders them without calling `useQuality` still gets particle and wave scaling — except where the water cap above cancels it.

## alien-farm

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Crops, rings, and rocks are instanced (`Crops.tsx:86`, `Farm.tsx:91`). Stars use `scaledCount` (`Farm.tsx:84`). No per-frame allocation in the frame callbacks. | — | — |

## castle-defender

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Castle.tsx:192` | Night levels map `TORCHES` (`:79`, two points) to a `<pointLight>` each. That is two extra dynamic lights on those levels. Goblins are one instanced pool of 40 (`Goblins.tsx:76`). The moat is 6.5 × 28 m, under the water cap, so the tier does shrink it. | low | Keep a single pooled light, or drop the lights and keep the emissive lantern material (`:189`). |

## clean-city

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Litter is one `DynamicInstancedModel` per kind (`Scene.tsx:241`). Parked cars and the five pigeons are instanced (`Decor.tsx:78`, `:166`; `decorSpots.ts:110`). No frame allocation. Decor counts are small enough that skipping `useQuality` does not change the phone. | — | — |

## construction-worker

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Pieces.tsx:80-87` | While a piece is on the hook, the guide line writes both vertices and sets `needsUpdate` every frame. | low | Two vertices is cheap; skip the upload when the hook has not moved. |
| `Pieces.tsx:43-48` | The `Line` geometry and `LineDashedMaterial` are created in `useMemo` and never disposed. | low | Dispose both in the effect cleanup. |
| `Scene.tsx:113-115` | `setStat` for stability and swing runs every frame. `setStat` bails when the value is unchanged (`useArcadeStore.ts:230`); swing is rounded to 0.1, so the HUD updates a few times a second while the load moves, not every frame. | low | Gate on the previous rounded value before calling `setStat`. |

## delivery-drone

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Decor.tsx:104` | River is 14 × 220 m (`looks.ts:130-131`). The 220 m side is 96 segments on full and on reduced. `reduced` here is `prefers-reduced-motion` (`amplitude` zeroed), not the quality tier. | med | Pass a shorter size on mid, or fix the core cap. |
| `Drone.tsx:145-161` | While a parcel is attached or falling, the cable and outline position attribute is rewritten and uploaded every frame. | low | The buffer is tiny; upload only when the parcel moves. |
| `Decor.tsx:72-74` | Outer skyline spots are not passed through `scaledCount`. Trees next to them are (`:77`). Buildings are instanced, so this is vertex count, not draw calls. | low | Slice `OUTER_BUILDING_SPOTS` with `scaledCount(..., decor)` the same way as the trees. |

## dino-egg-rescue

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:636-667` | `REGULAR_EGG_POOL` is 9 (`:48`). Each egg is its own circle (20 segments) plus a sphere (16 × 16), each with its own material. Under the 20-copy line, and the groups start `visible={false}`. Boulders are instanced (`:627`). | low | One `DynamicInstanced` for the glow discs and one for the eggs. |
| `Scene.tsx:177` | `setScore(run.score)` runs every frame, not only when the score changes. The store does not bail (`useArcadeStore.ts:223`). | low | Call it only when `store.score !== run.score`. |
| `Primitives.tsx:143-150` | `useBoulderParts` allocates an icosahedron and a material with no dispose. | low | Dispose both on unmount. |

## escape-room

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Raycaster and basis vectors are module-scope (`Scene.tsx:77-85`). Desks and chairs are instanced (`Primitives.tsx:170`). Stations are unique furniture, not a repeated pool. No particle field to scale. | — | — |

## food-catcher

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:217` | Each of the 16 slots (`rules.ts:19`, `Scene.tsx:305` and `:313`) mounts every kind as its own `<Model>`. That is 80 clones. Only one kind is visible per slot, so draw calls stay near 16, which is under 20 identical copies of one mesh. | med | One `DynamicInstancedModel` per kind, count 16, and hide the slot in `update`. |
| — | `setScore` is gated on a catch, a miss, or the end (`Scene.tsx:106`). No per-frame allocation in `useRunFrame`. | — | — |

## ghost-vacuum

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Vacuum.tsx:31-44` | `Scene.tsx:86` calls `hose.update()` from `useFrame` every frame. The loop writes positions into the existing tube attribute (that part is fine), then `:43-44` recomputes normals and the bounding sphere. | high | Write normals in the same loop, set `frustumCulled={false}`, and delete both computes. |
| — | Suction sparks are instanced and cut on low (`Scene.tsx:98-99`). Trees are `scaledCount` (`Decor.tsx:91`). The torch light is dropped on low via `Flashlight`. `markerBounds` is memoised (`Scene.tsx:133`). | — | — |

## knight-arena

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Dummies.tsx:130-169` | Cylinder, sphere, ring, and octahedron geometries plus five materials are created in `useMemo` and never disposed. The playable dummies themselves are instanced (`count={8}` at `:338`). | med | Dispose every geometry and material in the effect cleanup. |
| `Primitives.tsx:19` and `Arena.tsx:80` | Stand-ins and the banner cloth set `castShadow`. The canvas never turns shadow maps on (`ShellStage.tsx:164`), so this does not allocate a map. It also does not draw a shadow. | low | Remove `castShadow`, or keep the flags and accept they are unused. |
| — | Score and the metronome HUD update only when combo, spin, bpm, or stage change (`Scene.tsx:199-218`). Trees are 4 instanced spots (`Arena.tsx:149`). | — | — |

## luggage-rush

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Suitcase pool is instanced (`POOL` is 40 in `rules.ts:11`). Hall, belt, and suitcase geometries are module singletons with `dispose={null}` (`Hall.tsx:137`, `Belts.tsx:126`, `Primitives.tsx:119`), so Retries do not clone them. Decor geometries are disposed (`Decor.tsx:157`) and decor counts use `scaledCount` (`Decor.tsx:166`). | — | — |

## mini-golf

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Islands.tsx:295` | The open sea is 70 × 150 m. The 150 m side stays at 96 segments on full and on reduced. | med | Shorter sea on mid, or fix `waterDetail`. |
| — | Only the current hole and the next are mounted (`Scene.tsx:285`). Pond patches are small (`Islands.tsx:171`). | — | — |

## monster-kitchen

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Wheel ingredients are one `DynamicInstancedModel` per kind (`Wheel.tsx:135`). Bubble count uses `scaledCount` (`Cauldron.tsx:45`). No per-frame allocation in the frame callbacks. | — | — |

## museum-guard

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Hud.tsx:55-63` | `requestAnimationFrame` calls `paint` (`:30-48`) every frame: new path strings (`wedge` at `:19`, `shape` at `:12`) and `setAttribute` on the beam and all 8 blips, with no dirty check. | med | Write the DOM only when yaw, mode, or a blip position changes; keep the path strings in a scratch buffer. |
| `Gallery.tsx:655-674` | `MOTES` is 40 (`:78`). Every frame rewrites Y and the colour of every mote and uploads both attributes. The count is not scaled by tier. | med | Scale the draw range with `useQuality().particles`, and upload only when the beam yaw changes. |
| `Gallery.tsx:585`, `:595`, `:606`, `:616-617`, `:631-632`, `:648` | Those `useMemo` geometries (and the boxes merged into them) have no `dispose` anywhere in the file. Textures from `useCanvasTexture` are disposed; the geometries are not. | med | Return a cleanup from `useEffect` that disposes each geometry, and dispose merge inputs inside the factories. |
| — | The spotlight is omitted on low (`Beam.tsx:98`). Eight statues, not a pool of 20. | — | — |

## obstacle-race

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:294-298` | `flushSync(setCut)` runs from `useFrame`, once per respawn, so the follow camera can remount in that frame. It returns immediately on every other frame. | low | Leave it. It is not a per-frame React render. |
| — | `<Water />` uses the default 40 m size, which the tier does shrink. Course pieces are instanced in `Primitives.tsx`. | — | — |

## office-escape

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Obstacles are instanced per type (`Scene.tsx:309-315`, capacity at `:251`). The frame callback only writes matrices. Coins are a pool. No decor field large enough to need a tier. | — | — |

## penalty-hero

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | `setScore` and the HUD stats run on a shot result (`Scene.tsx:114-128`), not every frame. The pitch is one scene, not a repeated mesh. `Primitives.tsx` is the stand-in for that one scene. | — | — |

## penguin-slide

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | `fillTrack` (`Track.tsx:168-173`) and the terrain strip (`Terrain.tsx:183-194`) rewrite a chunk only when its index changes (about every 60 m), then upload. Frame callbacks otherwise move one group. Trees use `scaledCount` (`Track.tsx:128`). `<SnowFall count={300}>` (`Scene.tsx:235`) is scaled again inside `SnowFall`. | — | — |

## pigeon-crossing

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Lanes and each vehicle kind are `DynamicInstanced` / `DynamicInstancedModel` (`Scene.tsx:146-161`). No per-frame allocation in the callbacks. | — | — |

## pirate-cannons

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Bay.tsx:199-210` | `<Water size={[500, 360]}`. Both sides hit the 96 cap on full and on reduced, so the phone tier does not thin the sea. `reduced` at `:136` is `prefers-reduced-motion` (it zeros amplitude) and is not the quality tier. The far plane at `:193` is one quad (default `planeGeometry` segments). | high | Give mid and low a smaller size, and lower the core segment cap. |
| — | Ships are an instanced pool (`Ships.tsx`). Decor reads `useQuality`. | — | — |

## robot-collector

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:259-277` | Ten batteries (`rules.ts` `BATTERY_COUNT`) are each a group: glow mesh, beam mesh, and a `<Model>`. Under 20, and only the active ones are shown. | low | One instanced glow and one instanced battery for the ten slots. |
| `Scene.tsx:181` | One `<pointLight>` on the lamp, distance 4.5. That is the one extra dynamic light the budget allows. | low | Leave it, or fold the glow into the emissive material. |

## robot-factory

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:252` | One `<pointLight>` over the bay. Within the one-extra-light budget. Bay copies are instanced (`Bay.tsx`). Quality scales the bay dressing. | low | Leave the light. |

## rocket-landing

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:128-129` | The guide line's two vertices are uploaded every frame, including when the ship has not moved. | low | Set `needsUpdate` only after a real move. |
| — | The ground mesh is rebuilt only when the planet index changes (`Planet.tsx:20`) and the geometry is disposed. Stars use `scaledCount` (`Scene.tsx:136`). | — | — |

## shopping-cart

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:350-378` | The list is 6 items (`rules.ts:25`). Each is its own `<Model>` and its own `useFrame`. Halos and badges are instanced (`:338`, `:344`). Four shoppers plus the pusher are separate skinned meshes (`:191`, `:247`). | low | Instance the six products if the list grows; six is under the line today. |

## snowball-battle

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:49` | `fillTaps` spreads a new object into `markerBounds` (two more rects inside). Called from the frame callback only on a coarse-pointer tap (`:154-155`), not every frame. | low | Hoist one rect and refill it. |
| — | `<SnowFall count={360}>` (`Yard.tsx:181`) is scaled inside `SnowFall`. Balls and the yard props write instance matrices. `setScore` runs only when the run ends (`Scene.tsx:194`). | — | — |

## space-repair

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Scene.tsx:121` | Every frame: `{ ...area, width, height }` plus the two rects `markerBounds` allocates (`markerPlacement.ts:34-35`). The rest of that callback reuses `scratch.project`. | med | Memo the bounds the way `TargetMarkers.tsx:52` does, and pass a scratch rect into `markerBounds`. |
| `Scene.tsx:136` | Star count is 600 unless `tier === "low"` (200). A phone is mid (`quality.ts` coarse pointer) and still gets 600. | med | `scaledCount(600, quality.particles)` (420 mid, 240 low). |

## tower-climb

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Slabs, spurs, coins, flags, springs, rockets, wind, and the tower are `DynamicInstanced` / `DynamicInstancedModel` (`Scene.tsx:101-172`). No per-frame allocation in the callbacks. The pools are the level, not decor, so they correctly ignore the cosmetic tier. | — | — |

## treasure-island

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| `Island.tsx:140` | `<Water size={[180, 180]}`. Both sides are 96 segments on full and on reduced. The island mesh itself is built once (`:102-106`, including `computeVertexNormals`) and disposed. | high | Shrink the sea on mid, or fix the core cap. |
| — | Palms and rocks go through decor spots and `useQuality` (`Decor.tsx`). Crabs are instanced. Detector material is created once. | — | — |

## warehouse-rush

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Four pallets plus a carry slot and a sink slot (`rules.ts` `PALLET_COUNT` is 4, `Scene.tsx:378-380`). Rings and arrows are instanced (`:672`). Too few boxes to need a pool of 20, and the frame callback only moves those slots. | — | — |

## zoo-escape

| Where | Issue | Severity | Suggested fix |
|---|---|---|---|
| — | Snacks, bars, and clouds are instanced (`Stage.tsx:272`, `:380`, `Decor.tsx:129`). Three keepers (`Keepers.tsx:23`). The water strip is 14 × 2 m (`Terrain.tsx:198`), so the tier can shrink it. Decor reads `useQuality`. | — | — |

## Cleanest

These games match the rules on the points this audit can see: frame callbacks do not allocate, repeats are instanced or there are fewer than 20 of them, and they either read the quality tier or they have no cosmetic field the tier would thin.

- **alien-farm, luggage-rush, monster-kitchen, zoo-escape** — instanced pools and `scaledCount` on the decor or the stars.
- **pigeon-crossing, office-escape, tower-climb, warehouse-rush, escape-room, penalty-hero, clean-city** — instanced game objects, no per-frame geometry rebuild, nothing large left unscaled.
- **penguin-slide** — the track and the snow field upload only when a new 60 m chunk appears; snow and trees follow the tier.
- **robot-factory** — one extra light, instanced bay, tier used on the dressing.

The four that need a change before a phone pass are **pirate-cannons**, **treasure-island**, **ghost-vacuum**, and the shared **Water / ShellStage** caps those seas sit on. Museum-guard, food-catcher, space-repair, and knight-arena are the next tier: real, but not a full-screen grid.
