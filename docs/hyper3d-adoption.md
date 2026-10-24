# Hyper3D adoption map (batch 2, part A)

Source ledger: `%USERPROFILE%\.play50\hyper3d\archive2\LEDGER.md` (generated 2026-10-24, outside git).
Optimized GLBs live at `%USERPROFILE%\.play50\hyper3d\ready\<slug>\<id>.glb` — **none are copied into the
repo by this map**. This doc maps every part-A object with ledger status "ready" to the procedural
stand-in it replaces. Excluded: `dinoNest` (optimize-failed, 6552/5000 tris — regenerate at ~1500),
`cityBuilding` (user-rejected, folded wedge — superseded by `cityBuildingV2`).

Integration pattern (all games): add a `ModelAsset` to the game's `assets.ts` (+ `assets.spec.json`
row), register the URL in Claude-owned `core/modelManifest.ts`, render via `Model` / `InstancedModel` /
`DynamicInstancedModel` from `@/arcade3d/core/assets`, keeping the old JSX as `fallback`. URLs not in the
manifest are never fetched and the fallback renders instead. Game status from each `meta.ts`
(live = shown on production).

## food-catcher (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| kitchenCounter | `ready/food-catcher/kitchenCounter.glb` | `play50games-frontend/src/arcade3d/games/food-catcher/Primitives.tsx:269` (counter box; worktop `:273`, cabinet `:264`) | 9.4 w × ~0.62 h × 1.7 d (`COUNTER` `:66`, `WORKTOP` `:68`) | Static. **Counter top face is the rules' floor (y=0)** — catching, chef anchor (`WORKTOP_TOP_Y`, used in `Scene.tsx`) and `chef.test.ts:328` all depend on it; GLB must keep top at y=0 or be re-anchored. |
| cookingPot | `ready/food-catcher/cookingPot.glb` | `Primitives.tsx:142` `addPot()`, stockpot instance `:216`, drawn in merged `decor-metal` at `:244` | stockpot Ø ~0.52 × ~0.43 h; shelf top y=4.78, x=1.6, z=−0.58 (`SHELF` `:80`) | Baked into one merged vertex-coloured BufferGeometry — adoption pulls the stockpot out of the merge and draws the GLB at that slot. Pure background decor, no collision. |

## monster-kitchen (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| stoveHearth | `ready/monster-kitchen/stoveHearth.glb` | `Kitchen.tsx:135` (stove drum) | Ø ~1.2 × 0.9 h (`COUNTER_TOP` = 0.9, `Kitchen.tsx:14`) | Cauldron feet must land on drum top at `STOVE_TOP`=0.9 (`assets.ts:30`). Emissive fire-glow disc at `Kitchen.tsx:140` probably stays procedural. |
| slimeCube | `ready/monster-kitchen/slimeCube.glb` | `Primitives.tsx:111` (`useSlimeParts`), pool `Wheel.tsx:145` | 0.34 × 0.3 × 0.34 | `DynamicInstanced` pool, 9 copies (8 wheel slots + 1 in flight). Base-at-origin pivot, per-frame yaw + `frontScale` up to 1.3×. Swap two lines for `DynamicInstancedModel`. |
| monsterEyeball | `ready/monster-kitchen/monsterEyeball.glb` | `Primitives.tsx:83` (white sphere) + `:88` (iris), pool `Wheel.tsx:144` | Ø 0.36 (`INGREDIENT_LONGEST`, `assets.ts:26`) | Same pool contract as slimeCube. Iris baked into the GLB must face up/front at the wheel front slot. |
| lazySusan | `ready/monster-kitchen/lazySusan.glb` | `Wheel.tsx:118` (disc) + `:122` (rim torus) | Ø 1.9 disc × 0.05 (`WHEEL.discR`=0.95, `rules.ts:23`) | Rotates about its centre y at `WHEEL.y`=0.9; slot ring (`WHEEL.ringR`=0.75) must stay procedural — GLB replaces only disc+rim. No collision (screen-space picking). |
| potionJar | `ready/monster-kitchen/potionJar.glb` | `Kitchen.tsx:150` (`Instanced` jars, geometry `:151`) | Ø 0.14 × 0.22 h (`JAR_H`, `Kitchen.tsx:33`) | Static `Instanced` pool, 8 spots, per-spot scale 0.9–1.14, pivot at jar's vertical centre. Shared CanvasTexture label would be dropped. Use `InstancedModel` like the mushroom (`Kitchen.tsx:155`). |
| monsterTopHat | `ready/monster-kitchen/monsterTopHat.glb` | `Primitives.tsx:144` (`TopHat`, in `Headgear` `:176`), mounted `Monsters.tsx:96,138` | brim Ø 0.34, ~0.26 h | Child at monster head anchor (GLB-scaled units, `MONSTER_HEAD_ANCHOR_GLB`); inherits hop/waddle. Keep `Headgear`'s type switch. Not instanced (≤3). |

## dino-egg-rescue (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| dinoEgg | `ready/dino-egg-rescue/dinoEgg.glb` | `Scene.tsx:640` (ground egg), also `:476`, `:490`, `:504` (carried stack) | 0.30 w × 0.40 h (r 0.15 sphere × 1.33 y-stretch) | Visibility-toggled pool of 9 groups (not InstancedMesh). One GLB needs per-slot scale factors (radii 0.13–0.18). Carried copies anchor to `DINO_BACK_TOP_ANCHOR` with spring sway. Spotted texture `eggTexture` (`Scene.tsx:113`) can drop; keep emissive glow discs. `ASSET_DIMENSIONS.egg` (`assets.ts:59`) has width/height **swapped** vs the drawn mesh — verify convention before fitting. Golden variant (`Scene.tsx:525`, `:668`) needs an emissive override or second material. |

## museum-guard (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| museumPedestal | `ready/museum-guard/museumPedestal.glb` | `Gallery.tsx:477` (`pedestalGeometry`), drawn `:584` | 0.8 h, ~0.8–0.92 footprint (`RING.pedestalTop`, `rules.ts:15`) | Instanced pool of 8. Collision square `pedestalHalf`=0.4 (`rules.ts:17`); statues stand on top at exactly y=0.8 — origin at floor, top at 0.8. Note castle-defender wants 1.2 h / 1.7 w — per-game scale. |
| museumVase | `ready/museum-guard/museumVase.glb` | `Gallery.tsx:486` (`vaseGeometry`), drawn `:594` | ~0.53 h × 0.32 w | Static InstancedMesh pool of 4. Decorative only. |
| velvetStanchion | `ready/museum-guard/velvetStanchion.glb` | `Gallery.tsx:544` (`postGeometry`), drawn `:630`/`:635` | 0.75 h (`BARRIER`, `looks.ts:105-116`) | Instanced pool of 10. **Rope is separate** (`ropeGeometry` `:554`) and stays. `looks.test.ts` asserts post tops project below the statue band — do not exceed ~0.75 m. |
| wallLantern | `ready/castle-defender/wallLantern.glb` (shared) | `Gallery.tsx:524` (`fixturesGeometry`), drawn `:620` | ~0.1 w × 0.36 h, mounted y=2.55 | 8 sconces baked into ONE merged unlit mesh — adoption splits them out. Built facing +z, rotated `angle+π` (`onWall`, `:497`). Keep glow wash planes (`:540`) aligned. castle-defender's lantern is Ø 0.24 sphere — one GLB must serve both scales. |

## castle-defender (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| museumPedestal | `ready/museum-guard/museumPedestal.glb` (shared) | `Castle.tsx:196` (`<Pedestal width={1.7} height={1.2}>`) | **1.2 h, 1.7 w** — different from museum-guard's 0.8/0.92 | Cannon body sits at `PEDESTAL_TOP(1.2)` (`Cannon.tsx:66`) — top surface must stay at y=1.2. Stand-in lives in Claude-owned `core/kit/Pedestal.tsx:34-57`. |
| leafyBush | `ready/zoo-escape/leafyBush.glb` | **not used in this game** | — | No bush exists here; nearest are grass tufts / tree crowns in `Decor.tsx:37,40` (crowns pair with trunks). If shared adoption is intended, castle-defender needs a new prop spot list, not a swap. |
| goblinShield | `ready/castle-defender/goblinShield.glb` | `Goblins.tsx:77` (`DynamicInstanced` shield disc, update `:63-66`) | Ø 0.6 × 0.1 thick | Moving pool of 40, matrix per frame, disc axis rotated to face +z (goblin travel direction — front-hit damage rule in `rules.ts:216` depends on facing). Collision is a separate rules circle (r=0.3). |
| wallLantern | `ready/castle-defender/wallLantern.glb` | `Castle.tsx:187-190` (`Instanced` spheres) | Ø 0.24 | Static pool of 4 on the wall face; keep emissive look. See museum-guard row for the shared-GLB scale conflict. |

## robot-factory (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| robotHeadDome | `ready/robot-factory/robotHeadDome.glb` | `partShapes.ts:67` (`BUILDERS[3]`), pool `Parts.tsx:161-162` | 0.45 (`SHAPE_SIZE[3]`, `rules.ts:119`) | One shared `DynamicInstanced` pool for all part shapes (cradle + conveyor + flying). Per-instance **tint** multiplies a white shell — GLB materials must accept instanceColor. Feet-at-origin pivot; cradle slots scale ×0.85. |
| robotHeadBox | `ready/robot-factory/robotHeadBox.glb` | `partShapes.ts:74` (`BUILDERS[4]`) | 0.45 (`SHAPE_SIZE[4]`) | Same pool/tint contract. |
| robotHeadAntenna | `ready/robot-factory/robotHeadAntenna.glb` | `partShapes.ts:82` (`BUILDERS[5]`) | 0.45 (`SHAPE_SIZE[5]`; tip ~0.465) | Same pool/tint contract. |
| robotArmClaw | `ready/robot-factory/robotArmClaw.glb` | `partShapes.ts:90` (`BUILDERS[6]`) | 0.45 (`SHAPE_SIZE[6]`) | Same pool. This is the small arm part, not the overhead crane. |
| robotArmWrench | `ready/robot-factory/robotArmWrench.glb` | `partShapes.ts:97` (`BUILDERS[7]`) | 0.45 (`SHAPE_SIZE[7]`) | Same pool. |
| robotArmDrill | `ready/robot-factory/robotArmDrill.glb` | `partShapes.ts:103` (`BUILDERS[8]`) | 0.45 (`SHAPE_SIZE[8]`) | Same pool. Adopting six GLBs means splitting the single shared pool per kind (or a multi-asset pool). |
| clawHead | `ready/robot-factory/clawHead.glb` | `Bay.tsx:256` (`buildClawHead`), drawn `:301-304` | ~1.4 h; head body Ø ~0.35 | Single moving mesh on the gantry, positioned per frame; origin at grip point (`CLAW_GRIP`=0.5 gap must be preserved). Pure visual, no collision. |

## construction-worker (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| buildSlab | `ready/construction-worker/buildSlab.glb` | `Pieces.tsx:115` (pool) + `:131` (carried), unit geo `Primitives.tsx:58`, scale `KIND_SCALE[0]` (`:45`) | 1.1 × 0.28 × 1.1 | All 5 piece kinds share ONE tinted `DynamicInstanced` pool (16 slots) with per-kind scale — per-kind GLBs require splitting the pool. Pivot at box centre (placed at `floor*FLOOR + size[1]/2`); GLB needs base-centre pivot or a +h/2 wrap. Scoring is distance math, no mesh collision. |
| buildColumn | `ready/construction-worker/buildColumn.glb` | same pool, `KIND_SCALE[1]` (`Primitives.tsx:46`) | 0.34 × 0.75 × 0.34 | Same contract. In-game name "Pillar". |
| buildWall | `ready/construction-worker/buildWall.glb` | same pool, `KIND_SCALE[2]` (`:47`) | 1.15 × 0.75 × 0.22 | Thin axis must be z (no per-piece yaw). |
| buildWindow | `ready/construction-worker/buildWindow.glb` | same pool, `KIND_SCALE[3]` (`:48`) | 1.0 × 0.75 × 0.18 | Thinnest piece. |
| buildRoof | `ready/construction-worker/buildRoof.glb` — **known-bad GLB (whole house)** | same pool, `KIND_SCALE[4]` (`:49`) | 1.35 × 0.28 × 1.35 | Stand-in is a flat cap. **Regenerate the GLB** as a flat roof cap before adopting. |
| craneHook | `ready/construction-worker/craneHook.glb` | `Crane.tsx:72` (geo `Primitives.tsx:191-204`) | ~1.2 h × 0.35 w (`HOOK_BLOCK`, `rules.ts:9`) | Single mesh; block centred 0.6 above the hook point where the cable ends. Keep that pivot. Carried piece hangs 0.45 below (`VISUAL_EXTENSION`). |
| craneMast | `ready/construction-worker/craneMast.glb` — **A-frame trestle, wrong shape** | `Crane.tsx:66` (geo `Primitives.tsx:122-140`) | exactly 10 m tall, ~0.44² lattice section, base pad 0.9² | Jib group mounts at `JIB_Y`=10 — GLB must be exactly 10 m, base pivot. **Regenerate** as a square lattice tower. |
| craneJib | `ready/construction-worker/craneJib.glb` — **mobile crane truck, wrong object** | `Crane.tsx:68` (geo `Primitives.tsx:143-171`) | arm ~10.5 m +z, counter-jib 3.2 m −z, apex +0.55 | Rotates about mast top; trolley rides the arm at radius 4.5–9.6. **Regenerate** as a slewing tower-crane jib. |

## delivery-drone (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| cityBuildingV2 | `ready/delivery-drone/cityBuildingV2.glb` | `City.tsx:33` (merged box, `b.tower === false`) + roof cap `:34` + window quads `:36-37` | 5 × 5 footprint, h ∈ 2/5/8 (`CITY`, `rules.ts:8`) | Merged vertex-coloured chunks (16 draw calls total). Collision AABBs `b.box` (x±2.5, z±2.5) are logic-side — footprint must stay exactly 5×5, base y=0. Three discrete heights → per-height instances or a `stretch` fit (`sharedAssets.ts:593` pattern). |
| cityBuildingTall | `ready/delivery-drone/cityBuildingTall.glb` | `City.tsx:33` (same line, `b.tower === true`) + crown strips `:39` | 5 × 16 × 5 (`CITY.towerHeight`) | Towers are the only XZ collision for the drone (swept AABB) — 5×5 footprint critical. Crown strips are the tower identifier; fold into GLB or keep. |
| cardboardParcel | `ready/delivery-drone/cardboardParcel.glb` (shared with office-escape) | `Drone.tsx:90` (`<Parcel size={0.4}>`; kit `core/kit/Parcel.tsx:60`) | 0.4³ cube (`PARCEL.size`, `rules.ts:11`) | Single moving object, bottom-centre origin, positioned at `parcel.y − PARCEL.half`. Logic AABB `PARCEL_HALF`=0.2 — visual must stay exactly 0.4 m. Kit component is Claude-owned core. office-escape wants ~1.1×1.6×0.6 — **one GLB cannot serve both without per-game scale** (fine: scale is per-asset-entry). |

## clean-city (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| cityBuildingV2 | `ready/delivery-drone/cityBuildingV2.glb` (shared) | `Primitives.tsx:328` (facade box) + roof cap `:332` | 3.2 × 2.6 × 3.2 | Static `<Instanced>` pool, 4 spots. Collision `HALF.building`=1.6 (`rules.ts:118`) is separate. `ASSETS.building` (`assets.ts:109`) already exists **url-less** — adoption is data-only (add url+scale in `assets.ts` + manifest entry). GLB must cover facade+roof; drops the canvas facade texture. |
| cityBuildingTall | — | **not used in this game** | — | Only one building type exists in clean-city; the 16 m tower concept is delivery-drone only. |

## shopping-cart (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| supermarketShelf | `ready/shopping-cart/supermarketShelf.glb` — single-sided (thin back) | `Scene.tsx:560-573` (3 instanced boxes) | 1.2 × 2.0 × 12.0 (collision 1.2 × 2.2 × 12.0, `rules.ts:44-49`) | Instanced pool, 4 shelf islands, 3 draw calls. Collision AABBs separate. Items spawn at shelf faces (y=0.8). Dead `ShelfUnitPrimitive` (`Primitives.tsx:89`) can become the fallback or be deleted. |
| checkoutCounter | `ready/shopping-cart/checkoutCounter.glb` | `Scene.tsx:608-616` | 0.8 × 1.0 × 1.8 (collision 0.8 × 1.2 × 1.8, `rules.ts:61-65`) | Instanced pool, 3 counters. Register boxes sit on top (y=1.15, z−0.3) — GLB absorbs them or they stay. |
| freezerCase | `ready/shopping-cart/freezerCase.glb` | `Scene.tsx:594-605` | 24.0 × 2.0 × 1.2 (collision matches, `rules.ts:56-59`) | Single translucent box along the north wall. 24 m wide — needs a stretch/tile fit or multiple instances. |
| fruitStand | `ready/shopping-cart/fruitStand.glb` | `Scene.tsx:576-591` | 3.0 × 0.9 × 6.0 (collision 3.0 × 1.2 × 6.0, `rules.ts:51-54`) | Single group; keep top within the 1.2 m collision height. |
| wetFloorCone | `ready/shopping-cart/wetFloorCone.glb` | `Scene.tsx:471-474` (`SpillItem`) | cone r 0.15 × 0.5 h | Per-spill conditional object; gameplay uses `spill.radius`=1.2, not the cone — visual only. Base at y≈0, +0.8 x-offset from puddle. |

## rocket-landing (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| landingPad | `ready/rocket-landing/landingPad.glb` | `Planet.tsx:39-43` (3 child meshes of the `pad` group) | authored 1 w (x) × 0.4 h × 2 d; group gets runtime `scale.x = PLANETS[p].width` (6/5.5/5/4.5/4, `rules.ts:12-16`) | Single pad, **moving on planet 4** (`padX()` drives position.x). Slab top must land +0.2 above group origin to match the physics surface (`WORLD.padY`=2). Collision is a separate polygon — GLB only needs the top surface and full scaled width. New beacon cone in the GLB is additive detail (no stand-in). |

## treasure-island (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| rowboat | `ready/treasure-island/rowboat.glb` | `Island.tsx:130` (whole `Rowboat`) | 2.6 long × ~1.0 w × ~0.45 h (collision `FIXED.rowboat` hx 1.3 / hz 0.55, `rules.ts:122`) | Static prop; parent group tilted [0.18, 0.12, 0] — bake the tilt or keep the group. |
| woodenJetty | `ready/treasure-island/woodenJetty.glb` — **GLB is upside down** | `Island.tsx:156` (whole `Dock`) | deck 1.8 w × 5.8 l × 0.1 thick, top at world y≈0.17; posts 2.3 h | Static. **Apply 180° rotation in code** on the Model wrapper. Collision AABB `FIXED.dock` matches deck footprint. |
| treasureGem | `ready/treasure-island/treasureGem.glb` | `Scene.tsx:250` (`<Gem size={0.26}>`, kit `core/kit/Gem.tsx:36`) | 0.26 across × ~0.33 h | 2 slots, rise animation via ref-wrapped groups (`Scene.tsx:222-227`); kit Gem self-animates spin+bob — preserve or bake. |
| explorerHat | `ready/treasure-island/explorerHat.glb` | `Primitives.tsx:68` (`ExplorerHat`), attached `Scene.tsx:124` | brim Ø 0.36 (`HAT.brim`, `:40`), ~0.125 h | Parented to the runner rig's head bone via `HumanoidModel attach` — inherits head animation. Pivot at origin/head anchor. |

## zoo-escape (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| zooKiosk | `ready/zoo-escape/zooKiosk.glb` | `Primitives.tsx:324` (`kioskPieces`), `<Merged spots={SPOTS.kiosk}>` `Stage.tsx:466` | ~2.6 h; per-spot stretched to collision footprint 2.0×1.6 or 1.8×4.5 (`level.ts:111,152`) | Merged instanced pool; box is solid + sight blocker (logic-side). Separate awning instanced boxes (`Stage.tsx:467`) — absorb into GLB or keep at its roof height. |
| leafyBush | `ready/zoo-escape/leafyBush.glb` (shared with castle-defender) | `Primitives.tsx:297` (`bushPieces`), `<Merged>` `Stage.tsx:468` | unit 1 × 0.9 × 1; per-spot scaled to `box width + 0.5` on x/z (`Stage.tsx:100-108`) | Static merged pool. Logic uses `BUSHES` boxes (1.8×1.8×0.9, walkable hiding spots); visual intentionally overscales +0.5 m. Per-spot rotY. castle-defender has no bush stand-in — shared adoption there means a new prop, not a swap. |
| woodenFootbridge | `ready/zoo-escape/woodenFootbridge.glb` | `Primitives.tsx:377` (`bridgePieces`), drawn `Terrain.tsx:217` | deck 2.2 w × 2.6 l, rails ~0.86 h; spans 2 m moat (`level.ts:116`) | Single static mesh; keep deck top ≈ y 0.14. The moat (not the bridge) is the solid. Runs along +z. |
| searchlightTower | `ready/zoo-escape/searchlightTower.glb` | `Primitives.tsx:355` (`towerPieces`), drawn `Stage.tsx:470` | ~5 m tall; footprint 1.2×1.2, ~6 m clearance (`level.ts:156`) | **Orientation matters**: mesh rotated `rotation-y={−π/2}` so the lamp faces −x = beam rest direction. Lamp head must sit ~4.5–4.75 m; beam (`Flashlight`, `Keepers.tsx:128-140`) stays procedural. |
| bambooSnack | `ready/zoo-escape/bambooSnack.glb` | `Primitives.tsx:306` (`snackPieces`), pool `Stage.tsx:380-383` | unit ~0.42 h, drawn ×1.6 ≈ 0.67 m | `DynamicInstanced` pool (12 snacks), spin+bob per frame. Pickup radius 0.8 m is logic-side. Glow disc (`Stage.tsx:384-394`) keyed to centre point — keep. |

## penguin-slide (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| iceBlock | `ready/penguin-slide/iceBlock.glb` | `Primitives.tsx:51` (`usePropParts` "ice"), pool `Track.tsx:153` | 1.05 × 1.0 × 1.05, base-centre pivot | `DynamicInstanced` pool of 15 scrolling obstacles. Collision circle r=0.6 (`rules.ts:130`) logic-side — visual should cover it. Only yaw from track tangent. |
| snowRamp | `ready/penguin-slide/snowRamp.glb` | `Primitives.tsx:48-50` ("ramp" parts), pool `Track.tsx:156` | 1.6 w × 3.0 l; rails ~0.3–0.4; slope 0.2 rad baked about local X | Pool of 3. Placement applies yaw only (no pitch) — the slope must be inside the GLB, aligned to local z. Launch trigger is distance-based (`rules.ts:344`). |

## snowball-battle (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| snowFort | `ready/snowball-battle/snowFort.glb` | `Yard.tsx:132` (blocks pool; builder `Forts` `:50-142`; layout `looks.ts:61`) | 1.40 h (`FORT.heights[0]`); collision square ±0.90 (`FORT.half`, `rules.ts:60`) | **Hard case**: 16 squashed-sphere blocks × 7 forts (112 instances) + icicles + shadow. Damage animation scales each block's y per fort hp (4 height states, `looks.ts:94-105`). A single GLB must reproduce those states or the hp logic changes; `InstancedModel` has no per-instance damage scaling. Horseshoe opening faces +z, yawed toward the origin snowman. |

## obstacle-race (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| inflatablePusher | `ready/obstacle-race/inflatablePusher.glb` | `Primitives.tsx:500` (`useBlockMesh`), pool `Scene.tsx:351` | 2.4 × 0.6 × 2.2 (`BLOCK`, `rules.ts:63`) | **Moving** instanced pool (±2.4 m triangle-wave slide, matrix per frame); separate moving AABB collision must match. Origin = middle of top face. GLB-in-per-frame-instanced-pool is non-trivial. **Naming ambiguity**: if "pusher" meant the sweeper bar instead, stand-in is `SweeperBar` (`Primitives.tsx:458`, 11.8 × 0.45 × 0.35) — confirm with model owner. |
| sweeperHub | `ready/obstacle-race/sweeperHub.glb` | `Primitives.tsx:443,447` (yellow cylinder + cap), in `CourseStatic` | Ø 1.4 × 1.6 h (`HUB`, `rules.ts:52`) | Static single mesh; solid collision circle r=0.7 (`pushOutOfCircle`) — widest point must stay within Ø1.4. The procedural bar+collar passes through it; a different silhouette may intersect. |
| checkpointGate | `ready/obstacle-race/checkpointGate.glb` — solid, OK per ledger | `Primitives.tsx:542` (`Gates`; posts pool `:555`, beam/flag `:558-567`) | posts Ø 0.24 × 4.9 h at x ±3.3; beam 6.9 × 0.36 × 0.16 at y 2.9 (`GATE`, `Primitives.tsx:533`) | Posts instanced (2×3). Beam recolours on reach + flag pops (`Scene.tsx:385`) — GLB must expose/drop the banner material + flag rig. No collision (line-crossing detection). Posts rise from water (`WATER_Y`=−2). |

## penalty-hero (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| goalFrame | `ready/penalty-hero/goalFrame.glb` — **solid net sheet, not open frame** | `Primitives.tsx:194` (whole `Goal()` group: posts `:201-206`, crossbar `:207-210`, net `:215-217`), drawn `Scene.tsx:454` | opening 7.32 × 2.44; frame 7.44 × 2.50; net 1.5 deep (`GOAL`, `Primitives.tsx:37`) | Static. Goal mouth is pure math (`rules.ts:53-54`) — GLB must sit posts exactly on x=±3.66 and net behind z=0 (ball "goal" drop sinks to z≈−1.25). **Current net is see-through (opacity 0.45, depthWrite off)** — zone overlays and ball-behind-net readability rely on that; a solid sheet needs alpha blending or retuned zones. Faces +z. |

## escape-room (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| cupboardBody | `ready/escape-room/cupboardBody.glb` | `cupboard.ts:42-47` (six `panel()` boxes in `createCupboardShell`), built `Primitives.tsx:282-300` | 1.1 × 1.3 × 1.25 (`HALF_X/HALF_Z/HEIGHT`, `cupboard.ts:6-8`); collision envelope 1.2 × 1.4 × 1.4 (`STATION_BODY`, `rules.ts:25`) | Imperative per-station geometry, 2 mirrored instances. **Door is a separate swinging part** (`cupboard.ts:49-53`) — body GLB must exclude it; roof mesh is removed from the graph while open (camera raycast) — a one-piece roof must keep that behaviour or be split. |
| lockbox | `ready/escape-room/lockbox.glb` | `Primitives.tsx:217-229` (under-desk box + hinged lid, `UNDER_DESK` `desk.ts:23-34`) | 0.4 × 0.28 × 0.55 (`UNDER_DESK.size`, `desk.ts:24`) | Single instance, animated: slides out then lid swings 1.9 rad about its back edge. GLB must preserve the box/lid split + pivot, or keep the lid procedural. No literal "lockbox" in code — if the drawer was meant instead, that's `Primitives.tsx:200-203` (0.45 × 0.16 × 0.7). |

## office-escape (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| cardboardParcel | `ready/delivery-drone/cardboardParcel.glb` (shared) | `Primitives.tsx:348-361` (`OBSTACLE_DEFS.boxes`), pool `Scene.tsx:314` | drawn ~1.2 × 0.9 × 0.65 (tallest 0.65); **collision 1.1 × 1.6 × 0.6** (`rules.ts:113`) | **Adoption is already wired**: `OBSTACLE_ASSETS["boxes"]` is null at `Scene.tsx:253` — adding the asset makes `<InstancedProp>` auto-swap. Moving instanced pool (24 cap), per-frame matrices, yaw jitter ±0.15, knock/tilt on hit. Visual must clear the 0.6 m jump-top. Note the hitbox is deeper (1.6) than the drawn boxes (0.9) — the GLB footprint should respect the hitbox, not the old visual. |
| pottedPlant | `ready/office-escape/pottedPlant.glb` | `Primitives.tsx:652-658` (pot + leaf spots), drawn `:715-722` | pot ~0.46 Ø × 0.48 h; plant total ~1.45 h | Static corridor decor, two `Instanced` pools, 2 per side every 12 m. **No GLB path exists for decor** — needs core `<InstancedModel>` adoption in `OfficeCorridor`. No collision. |
| filingCabinet | `ready/office-escape/filingCabinet.glb` | `Primitives.tsx:659-662` (`CABINET_SPOTS`), drawn `:723-726` | 0.5 w × 1.1 h × 0.62 d | Static decor, one `Instanced` pool, left wall every 12 m. Same decor-GLB path needed as the plant. No collision. |

## pirate-cannons (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| lighthouse | `ready/pirate-cannons/lighthouse.glb` — includes grassy island base + houses | `Bay.tsx:145-156` (mole box, tower cylinder, cap cone) | footprint 9 × 4 (mole), tower 5.6 h, total ~7.5 above water | Static decor, no logic. GLB replaces all three meshes incl. the mole; origin on the water at (22, 0, −61), base slab where the mole was (`SEA.harbourX+6`). |
| harbourBuoy | `ready/pirate-cannons/harbourBuoy.glb` | `Bay.tsx:137-144` (two `Instanced` pools, red/white) | 1.3 h, Ø ~0.9 | Static pool of 6 (3 per colour). Geometry is centred (half submerged) — a feet-at-y0 GLB needs yOffset ≈ −0.65 or adjusted spots. Baked orange colour collapses the two pools to one. Harbour rule triggers on ship x≥18 — visual only marks the line. |

## space-repair (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| stationHub | `ready/space-repair/stationHub.glb` — spherical, not a wide cylinder | `Station.tsx:84` (hub cylinder) | Ø 2.4 × 0.6 h | Single static mesh. Collision is a 16-gon polygon r=1.2 (`rules.ts:7,28`) — visual radius must stay ~1.2. Sits under the 8 module-pod GLBs; `STRUTS` and `Pedestal` stay. |
| solarPanelWing | `ready/space-repair/solarPanelWing.glb` | `Station.tsx:86` (`Instanced`, `PANELS` `:17`) | 1.2 × 0.1 × 2.0 per wing, at x=±8.7 | Static pool of 2, flat/horizontal. Collision rects match exactly (`rules.ts:29-31`). Decide whether GLB absorbs the `PANEL_LINES` grid (`:87`) and `STRUTS` booms (`:83`). |

## ghost-vacuum (dev)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| candelabra | `ready/ghost-vacuum/candelabra.glb` | `Mansion.tsx:281-291` (geo `:117-124`, `propsGeo.candelabraBrass`) | ~0.36 w × ~0.38 h (README decor class says 0.6 — mesh is authoritative) | `DynamicInstanced` pool of 4 on desks at y=0.6. Upright, no rotation. Candle stalks (`:294-306`) and flickering flames (`:309-326`) are separate — keep them, or drop if the GLB includes candles. Pure decor, no collision. |

## tower-climb (live)

| model id | ready path | replaces | target size (m) | notes |
|---|---|---|---|---|
| rocketBooster | `ready/tower-climb/rocketBooster.glb` — egg-shaped pod | `Primitives.tsx:176-184` (rocket InstanceParts), drawn `Scene.tsx:146` | ~0.56 h visual (`ROCKET_SCALE` ×1.8 of a ~0.31 unit) | `DynamicInstancedModel` pool of 8, slow spin, hidden when taken. Pickup radius `ROCKET.reach`=0.42, floats 0.7 above slab (`Scene.tsx:142`). Placeholder `ASSETS.rocket` already exists without a manifest URL. Backpack `rocketPack` (`Primitives.tsx:113-119`) is a separate mesh — only replace if intended. |
| springPad | `ready/tower-climb/springPad.glb` — no coil, flat disc on stem | `Primitives.tsx:161-175` (spring InstanceParts), drawn `Scene.tsx:135` | pad Ø ~0.51 × 0.036 thick; unit tops at 0.24 | `DynamicInstanced` pool of 16 (no GLB declared yet). Squash-stretch launch animation (`writeSpring`, `visuals.ts:79-87`) — GLB must survive non-uniform sy scaling or the anim moves to a wrapper. Collision half-width `SPRING.half`=0.26 (`rules.ts:34`) — the visual radius must match. |
| towerLedge | `ready/tower-climb/towerLedge.glb` | `Primitives.tsx:149` (ledge InstanceParts), drawn `Scene.tsx:101-103` | 4.4 × 0.16 × 0.6 (top face at y=0, `SLAB` `rules.ts:21`) | `DynamicInstancedModel` pool (32, shared with slabs). Collision = landable slab top at slot.y. **GLB already declared**: `ASSETS.ledge` (`assets.ts:29`) — needs only the manifest URL + spec row. |

## Per-game effort and suggested order

Effort (S = asset entry + single swap; M = pool split, logic/animation coupling, or anchor risks):

| game | status | objects | effort | why |
|---|---|---|---|---|
| clean-city | live | 1 | **S** | url-less `ASSETS.building` stub — data-only change |
| tower-climb | live | 3 | **S** | pools already `DynamicInstancedModel`; ledge GLB pre-declared |
| penalty-hero | live | 1 | **S** | one static group; only the solid-net readability caveat |
| museum-guard | live | 4 | **M** | instanced pools + merged-sconce split + test height constraint |
| castle-defender | live | 2 (+1 n/a) | **S** | pedestal (core kit) + shield pool; leafyBush has no stand-in here |
| office-escape | live | 3 | **M** | parcel swap is wired; plants/cabinets need a new decor-GLB path |
| food-catcher | live | 2 | **M** | counter top-face-is-floor anchoring; pot extraction from merged geometry |
| escape-room | live | 2 | **M** | imperative geometry, door/lid splits, camera raycast behaviour |
| obstacle-race | live | 3 | **M** | moving instanced pool; banner/flag animation rig; pusher naming ambiguity |
| zoo-escape | dev | 5 | **M** | merged per-spot-stretched pools, tower orientation |
| robot-factory | dev | 7 | **M** | six GLBs force a per-kind split of one tinted pool |
| construction-worker | dev | 8 | **M** | pool split + exact 10 m mast; **buildRoof, craneMast, craneJib GLBs must be regenerated first** |
| monster-kitchen | dev | 6 | **M** | several instanced pools + headgear anchor |
| shopping-cart | dev | 5 | **M** | instanced pools; 24 m freezer needs stretch/tile |
| treasure-island | dev | 4 | **M** | jetty 180° rotation; gem rise/spin animation |
| dino-egg-rescue | dev | 1 | **M** | 4 draw sites, per-slot scales, hp/texture conventions |
| snowball-battle | dev | 1 | **M** | per-instance damage scaling — likely needs logic change |
| delivery-drone | dev | 3 | **M** | merged city chunks; 5×5 footprint is a collision contract |
| rocket-landing | dev | 1 | **S** | single pad group; keep runtime `scale.x` plumbing |
| penguin-slide | dev | 2 | **S** | two `DynamicInstancedModel` swaps |
| pirate-cannons | dev | 2 | **S** | two straightforward swaps (buoy half-submerge offset) |
| space-repair | dev | 2 | **S** | two simple swaps; collision dims given |
| ghost-vacuum | dev | 1 | **S** | one `DynamicInstancedModel` swap |

Suggested order (P1 objects in live games first, then by priority and effort):

1. **P1, live:** clean-city `cityBuildingV2` (S) → castle-defender `museumPedestal` (S) → food-catcher `kitchenCounter` (M) → museum-guard `museumPedestal` (M) → office-escape `cardboardParcel` (S, swap already wired).
2. **P1, dev (GLBs ready):** monster-kitchen `stoveHearth`/`slimeCube`/`monsterEyeball` → zoo-escape `zooKiosk` + `leafyBush` → rocket-landing `landingPad` → penguin-slide `iceBlock` → shopping-cart `supermarketShelf`/`checkoutCounter` → treasure-island `rowboat` → snowball-battle `snowFort` (needs the damage-state design first) → dino-egg-rescue `dinoEgg` → delivery-drone `cityBuildingV2`/`cardboardParcel`.
3. **Blocked on regeneration (do not adopt as-is):** construction-worker `buildRoof`, `craneMast`, `craneJib`; dino-egg-rescue `dinoNest` (not ready at all).
4. **P2:** live games (obstacle-race, penalty-hero, escape-room, tower-climb, office-escape) before dev games.
5. **P3:** last (monsterTopHat, wallLantern, cookingPot, explorerHat, towerLedge — towerLedge is trivial since the asset is pre-declared).

Cross-game conflicts to resolve before adoption: `museumPedestal` (0.8 m museum-guard vs 1.2 m castle-defender), `wallLantern` (0.36 m sconce vs Ø 0.24 sphere), `cardboardParcel` (0.4 m cube vs 1.1×1.6×0.6 obstacle) — all fine as long as each game keeps its own scale fit; `leafyBush` has no castle-defender stand-in. Registry/manifest/spec entries (`core/modelManifest.ts`, some `assets.spec.json` rows) are Claude-owned — game owners must request them.
