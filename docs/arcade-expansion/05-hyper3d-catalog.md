# Deliverable E: Hyper3D production catalog

Rule zero: **no generation before you approve the batch in chat** ("po, gjenero …"), and no download of result files without your explicit OK (CLAUDE.md). This catalog is the approved-manifest candidate; it becomes the manifest only after D1 and D7 (README §A.6).

## E.1 Style "Play50 toy world, premium edition"

The existing assets are the reference (01 §B.5): friendly stylised shapes, but **matte and restrained**, not saturated vinyl. Your brief's "friendly, colourful toy world" is kept in the shapes and in one bright accent per asset; the materials and the palette stay calm.

**Style block** (used in every prompt below, already merged into each one):

> premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials (no glossy plastic, no photoreal texture noise), restrained palette of two or three main colours plus one accent, clean readable silhouette

**Palette rules**
- Neutrals: warm off-white `#f4efe6`, light grey `#d4d4d8`, slate `#475569`, deep navy shell `#0b1020` (UI only).
- Gameplay signals, never used as decoration: collectible gold `#fbbf24`, danger coral `#f87171`, success mint `#34d399`, interactable glow cyan `#22d3ee`.
- Each world adds 3–4 colours (listed in each game spec, field 11).
- **Assets that are tinted in code** (suitcase, monster, goblin, snow kid's clothes via attachments) are generated with a **light neutral base** so a per-copy tint multiplies cleanly.

**Never**: saturated candy colours, outlines, cel shading, realism, gore, real-looking weapons (cannons are cartoon, swords are wooden), text or logos on models, your face on any new character (D8).

## E.2 What a prompt controls vs what must be validated

| Property | The prompt / concept controls it? | How we guarantee it |
|---|---|---|
| Subject, shapes, proportions, colours, materials' look | yes (prompt + concept image) | your approval of the concept image before generation |
| Pose (T-pose for humanoids) | only through the **concept image**: the MCP has no T-pose flag **[V]** CLAUDE.md | regenerate the concept until the T is clean (arms level, legs apart, nothing bridging arm and body) |
| Triangle count | partly (`quality_override` at generation) | `optimize` simplifies and **fails over budget** (characters 20k, props 5k) |
| Texture size and format | no | `optimize` → webp 1024 (characters) / 512 (props) |
| Pivot and centring | no | `optimize` centres the pivot on the floor |
| Real-world scale | no (Rodin normalises the longest side to about 1.9) | `scale` / `stretch` in the game's `assets.ts`, from the measured bounds, with a size test |
| Facing direction | weakly | `rotationY` in `assets.ts`; characters must face +z for the auto-rig |
| Separate moving parts (blades, rotors, lids, wheels) | **no**: Rodin returns one mesh | generate the body **without** the moving part and build that part in code (windmill blades, drone rotors, chest burst, hose) |
| Baked shadows / lighting in textures | partly ("clean PBR, no baked shadows") | visual check under the `day` and `night` presets |
| Symmetry | approximately | visual check; mirrored landmarks for humanoids |
| Thin parts (wires, straps, hair strands) | the prompt can avoid them | prompts ask for solid shapes; a failure is a regeneration |
| Rig and animation | not used | humanoids: core auto-rig (`core/rig`), non-humanoids: `core/motion` |

## E.3 Verified workflow and animation needs

- Generation runs **only in your local Claude Code** through the official Rodin MCP (`hyper3d-rodin`): `rodin_create_uploads` (+ HTTP PUT of the concept for image-to-3D), `rodin_generate`, `rodin_wait`, `rodin_get_result` **[V]** CLAUDE.md. Tiers via MCP: Gen-2.5-Extreme-Low / Medium / High; **no seed, no T-pose flag, no balance tool** **[V]**.
- Settings used so far and kept: characters = image-to-3D, Gen-2.5-Medium, `quality_override` 18000; props = text-to-3D (simple) or image-to-3D (hero props, as group D did), Gen-2.5-Medium, `quality_override` 1500 (3000 for big hero props) **[V]**.
- Then: download `base_basic_pbr.glb` to the scratchpad → `node tools/hyper3d/src/cli.mjs import <file> --slug <shared|slug> --id <id>` → `optimize <slug> --id <id>` → manifest line in `core/modelManifest.ts` → fit in `assets.ts` → size test → commit GLB + manifest (+ concept if it shows no face) **[V]**.
- Rodin also advertises rigging/animation features in its web product **[W]**; **not used and not verified**: the arcade's characters are animated in code, which is already proven on seven characters.

| Character | Kind | What it needs | Delivered by |
|---|---|---|---|
| knight, snowKid, astronaut, alien, keeper | humanoid | static T-pose GLB + measured landmarks + procedural poses (walk, idle, reach, carry, cheer, game-local swings) | core auto-rig (`humanoid: { landmarks }`), `<HumanoidModel>` |
| dino, penguin, panda, monster | solid creature | static model + whole-body procedural motion (waddle roll, bob, squash, bank, wobble) | `<Model>` + `core/motion` (P1-C) |
| goblin | solid creature, pooled ×40 | static low-poly model + hop-march per copy | `<DynamicInstancedModel>` + `core/motion` |
| drone, rocket, ship, cart, cannon | vehicles/props | static model + code transforms (bank, bob, recoil, sink) + procedural moving parts | `<Model>` + code |
| statues (museum) | reuse | other games' models with a material override, standing (humanoids arms down) | `<Model material>` (P1-D) |

No skeletal animation clips and no separate clip files are needed anywhere.

## E.4 Asset manifests per game (classification A–E)

Classes: **A** custom Hyper3D · **B** procedural in code · **C** shared library (new shared GLB used by ≥ 2 games) · **D** existing asset (already in `public/models/3d`) · **E** optional polish (later, only if credits and time remain). Priority: P1 needed for the game's first playable with models, P2 polish, P3 optional. Sizes are the in-game target (metres); collision is what `rules.ts` uses, never the mesh.

### 1 treasure-island
| Asset | Class | Source | Size / orientation | Collision | Tris / tex | Animation | Prio |
|---|---|---|---|---|---|---|---|
| explorer = runner + hat | D + B | `shared/runner.glb` + procedural hat on the head bone | 1.56 m (0.825 scale) | circle r 0.4 | 18k / 1024 | auto-rig walk, dig, cheer | P1 |
| chest | C (A) | `shared/chest.glb` | 0.9 × 0.6 × 0.6 m, front +z | AABB | ≤ 4k / 512 | pop-up + burst (code) | P1 |
| rock | C (A) | `shared/rock.glb` | 0.6–2.5 m (instanced, random yaw, scale) | circle | ≤ 3k / 512 | none | P1 |
| palm, umbrella, coin, crate | D | existing | as fitted in clean-city / office-escape | circle | – | sway (code) | P1 |
| gems | B | icosahedron + emissive | 0.3 m | none | <200 | spin | P1 |
| island, water, sky, ring, rowboat | B | code / `core/env` | – | polygon | – | water shader | P1 |
| crab | E | `treasure-island/crab.glb` | 0.3 m | – | ≤ 2k | scuttle | P3 |

### 2 museum-guard
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| knight statue | C (A, stone override) | `shared/knight.glb` | 1.6 m | circle | 18k | tiptoe (code) | P1 |
| dino skeleton | C (A, bone override) | `shared/dino.glb` | 1.1 m long | circle | ≤ 12k | skitter | P1 |
| penguin statue | C (A, bronze) | `shared/penguin.glb` | 0.8 m | circle | ≤ 8k | slide | P1 |
| robot statue | D (gold override) | `shared/robot.glb` | 1.2 m | circle | 18k | hop | P1 |
| exit door | D | `escape-room/door.glb` | 2.1 m | – | – | opens (code) | P1 |
| bench | D | `clean-city/bench.glb` | – | – | – | – | P2 |
| vases, pedestals, paintings, room, flashlight | B | code / kit | – | – | – | – | P1 |
| marble bust | E (A) | `museum-guard/bust.glb` | 0.7 m | circle | ≤ 5k | hop | P3 |

### 3 luggage-rush
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| suitcase | A | `luggage-rush/suitcase.glb` (light grey base, tinted per flight) | 0.7 × 0.5 × 0.25 m | path position only | ≤ 2.5k / 512 | ride, tumble | P1 |
| belts, rollers, diverters, chutes, boards, hall | B | kit conveyor + code | – | path graph | – | scrolling texture | P1 |
| handler (runner) | D | `shared/runner.glb` | 1.56 m | – | – | wave | P2 |
| plane (window) | E (A) | `luggage-rush/plane.glb` | backdrop | – | ≤ 5k | taxi | P3 |

### 4 dino-egg-rescue
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| dino | C (A) | `shared/dino.glb` | 1.1 m long, 0.8 m tall, faces +z | circle r 0.55 | ≤ 12k / 1024 | waddle, squash (code) | P1 |
| boulders | C (A) | `shared/rock.glb` pool | 0.8–1.2 m | circle | – | roll | P1 |
| trees | C (A) | `shared/leafyTree.glb` | 3–4 m | circle (trunk) | ≤ 4k | sway | P1 |
| palm | D | `clean-city/palm.glb` | – | circle | – | sway | P2 |
| eggs, nest, volcano, mud, valley | B | code | – | circles / zones | – | wobble | P1 |

### 5 delivery-drone
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| drone | A | `delivery-drone/drone.glb` (rotor guards, **no blades**) | 0.9 m wide | circle r 0.5 | ≤ 5k / 512 | bank, hover; blades = code discs | P1 |
| car, taxi, van, pigeon | D | pigeon-crossing GLBs | as fitted | – | – | path motion | P1 |
| crate (depot) | D | `shared/crate.glb` | – | – | – | – | P2 |
| parcels, buildings, roofs, pads, beacons | B | code + canvas | – | AABB | – | – | P1 |
| trees (park) | C | `shared/leafyTree.glb` | – | – | – | – | P2 |

### 6 shopping-cart
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| cart | A | `shopping-cart/cart.glb` (solid rounded basket, no wires) | 1.0 × 1.0 × 0.6 m | circle r 0.55 | ≤ 4k / 512 | tilt, rattle (code) | P1 |
| pusher (runner) | D | `shared/runner.glb` | 1.56 m | (part of the cart circle) | – | walk + carry pose | P1 |
| shoppers | D | `clean-city/cleaner.glb`, `food-catcher/chef.glb` | as fitted | circle | – | walk patrol | P1 |
| products | D | apple, banana, burger, tinCan, bottle, bag | 0.15–0.3 m | pick-up circle | – | bob | P1 |
| shelves, checkout, signs, spills, can pyramids | B | code | – | AABB | – | topple | P1 |

### 7 snowball-battle
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| snow kid ×4 | A | `snowball-battle/snowKid.glb` (light neutral jacket) | 1.25 m | capsule r 0.35 | ≤ 18k / 1024 | auto-rig: walk, crouch, throw, cheer | P1 |
| beanies, scarves (team colours) | B | attachments | – | – | – | – | P1 |
| pine trees | C (A) | `shared/pineTree.glb` | 3–5 m | circle | ≤ 3k | – | P1 |
| forts, snowman, snowballs, fence, ground | B | code | – | AABB / spheres | – | crumble | P1 |

### 8 ghost-vacuum
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| hunter = runner | D | `shared/runner.glb` | 1.56 m | circle r 0.4 | – | auto-rig walk, aim arm | P1 |
| vacuum backpack | A | `ghost-vacuum/vacuum.glb` (no straps, flat back) | 0.55 m tall | – | ≤ 3k / 512 | attached to chest bone | P1 |
| hose + nozzle | B | tube along a curve | – | – | – | follows hand | P1 |
| ghosts | B | lathe + wobble shader, pooled | 0.8 m | circle | <500 each | float, wobble | P1 |
| desk, chair, book, door | D | existing | – | AABB | – | shake | P1 |
| rooms, candelabras, paintings, flashlight | B | code / kit | – | AABB | – | – | P1 |

### 9 construction-worker
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| crane, hook, cable | B | instanced lattice bars | 14 m | – | – | rotate, pendulum | P1 |
| building pieces, piles, fence | B | code + canvas (brick, concrete, glass) | – | slot rule | – | drop, wobble | P1 |
| worker = runner + hard hat | D + B | runner + attachment | 1.56 m | – | – | point, cheer | P2 |
| pallet, crate, van | D | existing | – | – | – | – | P2 |
| cement mixer | E (A) | – | – | – | ≤ 4k | spin | P3 |

### 10 alien-farm
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| alien farmer | A | `alien-farm/alien.glb` | 1.3 m | circle r 0.4 | ≤ 18k / 1024 | auto-rig: walk, reach, carry | P1 |
| glowPod crop | A | `alien-farm/glowPod.glb` | 0.5–1.0 m (by stage) | plot cell | ≤ 3k / 512 | grow scale, emissive pulse | P1 |
| saucer, beam, plots, channels | B | lathe + emissive | – | beam circle | – | path motion | P1 |
| rocks (purple tint) | C (A) | `shared/rock.glb` + material | – | circle | – | – | P2 |
| crates | D | `shared/crate.glb` | – | – | – | – | P2 |
| spiral gourd | E (A) | `alien-farm/gourd.glb` | – | – | ≤ 3k | pulse | P3 |

### 11 mini-golf
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| windmill (no blades) | A | `mini-golf/windmill.glb` | 2.2 m tall, tunnel arch at the base | segments in `rules.ts` | ≤ 4k / 512 | blades in code rotate | P1 |
| course tiles, rails, cups, ball | B | code | – | segments + height functions | – | – | P1 |
| flag | D | `tower-climb/checkpoint-flag.glb`, red tint | 0.8 m | – | – | wave | P1 |
| trees, rocks | C (A) | shared | – | – | – | – | P2 |

### 12 robot-factory
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| robot (finished) | D | `shared/robot.glb`, tinted | 1.2 m | – | 18k | auto-rig walk, wave | P1 |
| torso parts | D | `robot-collector/barrel.glb`, `shared/crate.glb`, `shared/battery.glb`, tinted | 0.3–0.5 m | path position | – | ride, snap | P1 |
| heads, arms, belt, robot arm, cradle, bin | B | code + kit conveyor | – | – | – | – | P1 |

### 13 pirate-cannons
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| cannon | C (A) | `shared/cannon.glb` | 1.6 m long | – | ≤ 4k / 512 | aim, recoil (code) | P1 |
| ship | A | `pirate-cannons/ship.glb` (no flag) | sloop 6 m long; dinghy ×0.5, galleon ×1.5 | 2–3 spheres | ≤ 5k / 512 | bob, sail, sink | P1 |
| chest (bonus target) | C (A) | `shared/chest.glb` | – | sphere | – | float | P2 |
| barrels, crates, palm | D | existing | – | spheres | – | float, explode | P1 |
| water, parapet, sails, flags, cannonballs | B | code / env | – | – | – | – | P1 |

### 14 castle-defender
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| goblin ×40 | A | `castle-defender/goblin.glb` (light green-grey base, arms down) | 0.9 m | circle r 0.3 | **≤ 4.5k** / 512 | hop-march (code), pooled | P1 |
| castle tower ×2 | C (A) | `shared/castleTower.glb` | 6 m | AABB | ≤ 5k / 512 | – | P1 |
| cannon | C (A) | `shared/cannon.glb` | – | – | – | – | P1 |
| gate | D | `escape-room/door.glb` scaled | 3 m | AABB | – | shake | P1 |
| walls, ladders, field, banners | B | code | – | – | – | – | P1 |
| rocks, trees | C | shared | – | – | – | – | P2 |

### 15 penguin-slide
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| penguin | C (A) | `shared/penguin.glb` (standing, flippers slightly out) | 0.8 m, used on its belly | circle r 0.35 (track space) | ≤ 8k / 1024 | bank, squash (solid model) | P1 |
| fish | C (A) | `shared/fish.glb` | 0.35 m | circle | ≤ 1.5k / 512 | spin, bob | P1 |
| pine trees | C (A) | `shared/pineTree.glb` | 3–5 m | – | – | – | P1 |
| gate flags | D | `tower-climb/checkpoint-flag.glb`, tinted | – | – | – | – | P2 |
| track, ice blocks, snowmen, gates | B | code | – | track-space circles | – | – | P1 |

### 16 space-repair
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| astronaut | A | `space-repair/astronaut.glb` (no backpack: jetpack in code) | 1.5 m | circle r 0.45 | ≤ 18k / 1024 | auto-rig float, reach | P1 |
| jetpack, wrench | B | attachments | – | – | – | flame fx | P1 |
| modules, panels, Earth, debris, stars | B | code / env | – | circles | – | spin | P1 |
| power cells | D | `shared/battery.glb` | – | circle | – | bob | P2 |

### 17 monster-kitchen
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| monster ×3 variants | A | `monster-kitchen/monster.glb` (pale base, tinted) | 1.4 m | – | ≤ 8k / 1024 | wobble, dance (code) | P1 |
| cauldron | A | `monster-kitchen/cauldron.glb` (empty, open) | 0.9 m | – | ≤ 3k / 512 | liquid = code | P1 |
| chef | D | `food-catcher/chef.glb` | 1.82 m | – | – | idle, reach, cheer | P1 |
| ingredients | D + C | apple, banana, burger, sock, tinCan; `shared/fish.glb` | 0.15–0.35 m | – | – | toss arc | P1 |
| eyeball, slime cube, wheel, counter, jars | B | code | – | – | – | – | P1 |
| mushroom | E (A) | `shared/mushroom.glb` | 0.3 m | – | ≤ 2k | – | P3 |

### 18 knight-arena
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| knight | C (A) | `shared/knight.glb` | 1.6 m | – | ≤ 18k / 1024 | auto-rig: 4 swings, spin, cheer | P1 |
| training dummy | A | `knight-arena/dummy.glb` | 1.5 m on its post | – | ≤ 3k / 512 | spring wobble | P1 |
| sword, shield | B | attachments | – | – | – | – | P1 |
| castle towers | C (A) | `shared/castleTower.glb` | backdrop | – | – | – | P2 (procedural until batch 3) |
| targets, fence, banners | B | code | – | – | – | – | P1 |

### 19 zoo-escape
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| panda | A | `zoo-escape/panda.glb` (on all fours) | 1.0 m long | circle r 0.45 | ≤ 10k / 1024 | waddle, crouch (code) | P1 |
| zookeeper ×3 | A | `zoo-escape/keeper.glb` | 1.75 m | circle (vision is logic) | ≤ 18k / 1024 | auto-rig walk, look-around | P1 |
| flashlight | B | attachment + cone | – | – | – | – | P1 |
| bench, bin, lamp, palm, car | D | existing | – | AABB | – | – | P1 |
| rocks, trees | C | shared | – | AABB / circle | – | – | P1 |
| bushes, fences, cones, gate, bamboo | B | code / kit | – | zones | – | rustle | P1 |

### 20 rocket-landing
| Asset | Class | Source | Size | Collision | Tris | Animation | Prio |
|---|---|---|---|---|---|---|---|
| rocket | A | `rocket-landing/rocket.glb` (no flame, no pad) | 2.2 m tall | 2D body polygon in `rules.ts` | ≤ 5k / 512 | rotate, flame fx | P1 |
| fuel cells | D | `shared/battery.glb` | – | circle | – | bob | P3 |
| terrains, pads, planets, stars, flame | B | code / env | – | polylines | – | – | P1 |

## E.5 Prompt library for every custom model

Format per asset: header (id, path, class, tier, batch, mode, settings), **concept prompt** for ChatGPT (image-to-3D assets only; you paste it into ChatGPT and hand the image to Claude), **Rodin prompt** (sent with the concept, or alone for text-to-3D), **fit and checks**. Shared defaults: Gen-2.5-Medium, mesh Raw, PBR, GLB; characters `quality_override` 18000, props 1500 (3000 where noted). Never HighPack, never Extreme-High.

**Concept prompt frame** (ChatGPT; the asset line is filled in below):

```text
Premium stylised mobile-game concept art. One single <ASSET>, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette <PALETTE>. 1024x1024.
```

For humanoid characters the frame adds: `Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.` Regenerate the concept if the T is not clean, a hand or foot is cropped, or an extra object appears.

### Tier 1 (batch 1: reference game + wave 1)

#### chest (`/models/3d/shared/chest.glb`) · C · tier 1 · batch 1 · image-to-3D · 1500
- Concept asset line: `wooden treasure chest with a rounded barrel-top lid, closed, three gold metal bands, a gold front lock plate, slightly chunky toy proportions` · palette `warm brown wood #8b5a2b, gold #fbbf24, dark iron #334155`.
- Rodin prompt:
```text
Closed wooden treasure chest with a rounded barrel-top lid, three gold metal bands and a gold lock plate on the front, chunky friendly proportions. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, warm brown wood, gold bands, dark iron hinges. Single object, centred, upright, front facing the viewer, symmetrical left to right, closed solid shape, no floating parts. No base, no ground, no coins outside, no text, no logo. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 0.9 × 0.6 × 0.6 m; lid closed (the reveal is a pop + burst in code); front faces +z after `rotationY`; ≤ 4k tris; reads as gold-banded from the 55° camera.

#### rock (`/models/3d/shared/rock.glb`) · C · tier 1 · batch 1 · text-to-3D · 1500
```text
Single rounded boulder with a few soft broad facets, slightly flattened bottom, smooth stylised stone. Premium stylised mobile-game look, soft bevelled edges, simple clean shape, matte painted stone material in warm grey with subtle lighter top and a hint of moss green on one side. Single object, centred, resting upright, no cracks, no small pebbles around it. No base, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: unit size ~1 m, used 0.6–2.5 m with random yaw and non-uniform `stretch`; tint via material override (purple on alien-farm); ≤ 3k tris; looks right from every side (it will be rotated).

#### cannon (`/models/3d/shared/cannon.glb`) · C · tier 1 · batch 1 · image-to-3D · 3000
- Concept asset line: `cartoon bronze cannon on a wooden two-wheeled carriage, short thick barrel with a rounded muzzle ring, side view three-quarter` · palette `bronze #b45309, wood #92400e, iron #475569`.
- Rodin prompt:
```text
Cartoon cannon: a short thick bronze barrel with a rounded muzzle ring, resting on a simple wooden carriage with two big round wooden wheels. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte bronze and painted wood, dark iron rims. Single object, centred, standing on its wheels, barrel pointing forward toward the viewer's right at a slight upward angle, symmetrical left to right. No cannonballs, no smoke, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.6 m long; `rotationY` so the barrel points +z; the barrel's muzzle point measured for the projectile spawn; recoil is a whole-object slide (one mesh).

#### ship (`/models/3d/pirate-cannons/ship.glb`) · A · tier 1 · batch 1 · image-to-3D · 3000
- Concept asset line: `small chunky cartoon pirate sloop, rounded wooden hull, one mast with one big square cream sail, a small raised stern deck, side three-quarter view` · palette `wood #92400e, cream sail #fef3c7, red trim #dc2626`.
- Rodin prompt:
```text
Small chunky cartoon pirate sloop: a rounded wooden hull with a red trim line, one mast with one large square cream sail, a small raised stern deck and a short bowsprit. Premium stylised mobile-game look, friendly rounded toy proportions, soft bevelled edges, matte painted wood and cloth. Single object, centred, upright on its keel, bow pointing to the viewer's left, symmetrical port and starboard. No flag, no crew, no cannons, no water, no ropes or rigging lines, no text, no skull logo. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: sloop 6 m long (dinghy ×0.5, galleon ×1.5 with extra sail planes in code); hull waterline measured for the bob; flags and sail tints are code attachments; ≤ 5k tris.

#### suitcase (`/models/3d/luggage-rush/suitcase.glb`) · A · tier 1 · batch 1 · text-to-3D · 1500
```text
Hard-shell travel suitcase, upright, rounded corners, two soft vertical ribs on the front, a top carry handle and two small wheels at the bottom. Premium stylised mobile-game look, soft bevelled edges, simple clean shape, matte light grey shell (#d4d4d8) with dark grey handle and wheels. Single object, centred, front facing the viewer, symmetrical. No stickers, no tags, no straps, no extended trolley handle, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 0.7 × 0.5 × 0.25 m lying on the belt (rotated in code); the shell must stay light so per-copy tints read as red / blue / green / yellow; ≤ 2.5k tris.

#### cart (`/models/3d/shopping-cart/cart.glb`) · A · tier 1 · batch 1 · image-to-3D · 3000
- Concept asset line: `toy-like supermarket shopping cart with a solid basket made of smooth rounded panels with a few big rectangular cut-outs instead of thin wires, red plastic handle, four small chunky wheels` · palette `light silver #e5e7eb, red handle #ef4444, dark wheels #1f2937`.
- Rodin prompt:
```text
Toy-like supermarket shopping cart: a solid basket made of smooth rounded light silver panels with a few large rectangular cut-outs (no thin wires), a red plastic push handle at the back, a small lower tray and four small chunky dark wheels. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte silver and matte red. Single object, centred, standing on its wheels, handle side facing the viewer at three-quarter view, symmetrical left to right. No groceries inside, no child seat flap, no logo, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.0 × 1.0 × 0.6 m; handle height measured for the runner's carry pose (hands within 3 cm of the handle); ≤ 4k tris.

#### cauldron (`/models/3d/monster-kitchen/cauldron.glb`) · A · tier 1 · batch 1 · text-to-3D · 1500
```text
Round cartoon cauldron pot with a thick rolled rim, two small side handles and three short stubby legs, open top with an empty interior. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte dark charcoal iron with subtle warm highlights. Single object, centred, upright, symmetrical. No liquid, no smoke, no bubbles, no fire, no spoon, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 0.9 m wide; the inner rim height measured for the procedural liquid disc; ≤ 3k tris.

#### monster (`/models/3d/monster-kitchen/monster.glb`) · A · tier 1 · batch 1 · image-to-3D · 18000 (budgeted ≤ 8k after optimize)
- Concept asset line: `cute round blob monster customer, pear-shaped soft body, two big friendly eyes, a wide happy mouth with two little teeth, short stubby arms held slightly out from the body, short feet` · palette `pale lavender-white body #ede9fe, soft lilac belly #c4b5fd, dark eyes #1e1b4b`.
- Rodin prompt:
```text
Cute round blob monster: a soft pear-shaped body, two big friendly round eyes, a wide happy mouth with two small teeth, short stubby arms held slightly away from the body, two short feet, standing. Premium stylised mobile-game look, friendly rounded proportions, smooth soft shapes, matte pale lavender-white body with a lighter belly patch. Single character, centred, standing upright, facing the viewer, symmetrical. No horns, no hat, no clothes, no props, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.4 m; the pale base must tint well (lilac, green, pink); horns and hats are code attachments; `optimize` to ≤ 8k tris (prop-like use) with a 1024 texture.

#### penguin (`/models/3d/shared/penguin.glb`) · C · tier 1 · batch 1 · image-to-3D · 18000 (≤ 8k after optimize)
- Concept asset line: `chubby cartoon penguin standing upright, flippers held slightly out from the body, round belly, small orange beak and feet, big friendly eyes` · palette `charcoal back #1f2937, warm white belly #f8fafc, orange #f97316`.
- Rodin prompt:
```text
Chubby cartoon penguin standing upright, round body, white belly, dark charcoal back and head, small orange beak and orange feet, big friendly eyes, both flippers held slightly out from the body (not touching it). Premium stylised mobile-game look, friendly rounded proportions, smooth soft shapes, matte painted materials. Single character, centred, standing, facing the viewer, symmetrical. No scarf, no hat, no ice, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 0.8 m standing; penguin-slide rotates it 90° onto its belly (test: the belly is the lowest surface, nothing below the track); museum-guard draws it with a bronze override.

#### fish (`/models/3d/shared/fish.glb`) · C · tier 1 · batch 1 · text-to-3D · 1500
```text
Small chubby cartoon fish, side view, rounded body, a fan tail, a small dorsal fin, big friendly eye on each side. Premium stylised mobile-game look, soft bevelled edges, simple clean shape, matte orange body with a cream belly and soft darker orange fins. Single object, centred, horizontal, head pointing to the viewer's left, symmetrical left and right sides. No water, no bubbles, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 0.35 m long; instanced (penguin-slide trails, monster-kitchen ingredient); ≤ 1.5k tris.

#### pineTree (`/models/3d/shared/pineTree.glb`) · C · tier 1 · batch 1 · text-to-3D · 1500
```text
Stylised pine tree made of four stacked rounded cone layers with a light dusting of snow on the tips of each layer, short brown trunk. Premium stylised mobile-game look, soft bevelled edges, simple clean shapes, matte deep green layers, white snow tips, warm brown trunk. Single object, centred, upright, symmetrical around its trunk. No ground, no snow pile, no ornaments, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 3–5 m with random scale and yaw, instanced; ≤ 3k tris.

### Tier 1 (batch 2: wave 2)

#### leafyTree (`/models/3d/shared/leafyTree.glb`) · C · tier 1 · batch 2 · text-to-3D · 1500
```text
Stylised round tree with one big puffy cloud-shaped canopy made of three soft lumps, a short slightly curved brown trunk. Premium stylised mobile-game look, soft bevelled edges, simple clean shapes, matte fresh green canopy with lighter top, warm brown trunk. Single object, centred, upright. No fruit, no flowers, no ground, no grass, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 3–4 m, instanced; trunk radius measured for the collision circle; ≤ 4k tris.

#### dino (`/models/3d/shared/dino.glb`) · C · tier 1 · batch 2 · image-to-3D · 18000 (≤ 12k after optimize)
- Concept asset line: `chubby baby dinosaur in the style of a young triceratops standing on four short sturdy legs, broad flat back, a small frill with three soft horns, short tail, big friendly eyes` · palette `soft leaf green #84cc16, cream belly #fef3c7, frill orange #fb923c`.
- Rodin prompt:
```text
Chubby baby dinosaur like a young triceratops: standing on four short sturdy legs, a broad flat back, a small rounded head frill with three soft short horns, a short thick tail, big friendly eyes, a gentle smile. Premium stylised mobile-game look, friendly rounded proportions, smooth soft shapes, matte leaf-green skin with a cream belly and a soft orange frill. Single character, centred, standing, facing the viewer at three-quarter view, symmetrical left to right. No saddle, no eggs, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.1 m long, 0.8 m tall, faces +z; the back's top surface measured for the egg stack (eggs sit on it within 1 cm through the waddle); bone override for the museum skeleton look.

#### drone (`/models/3d/delivery-drone/drone.glb`) · A · tier 1 · batch 2 · image-to-3D · 3000
- Concept asset line: `friendly delivery drone, rounded white body with soft blue panels, four round rotor guards on short arms with no propeller blades inside, a small parcel hook underneath, a small glowing camera eye at the front` · palette `white #f8fafc, soft blue #7dd3fc, slate #475569`.
- Rodin prompt:
```text
Friendly delivery drone: a rounded white body with soft blue panels, four short arms ending in round rotor guard rings that are empty inside (no propeller blades), a small hook underneath, a small glowing camera eye at the front. Premium stylised mobile-game look, soft bevelled edges, clean simple shapes, matte white and soft blue, slate details. Single object, centred, level, front facing the viewer, symmetrical. No propellers, no parcel, no logo, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 0.9 m wide; rotor-ring centres measured for the code blur discs; the hook point for the winch; ≤ 5k tris.

#### rocket (`/models/3d/rocket-landing/rocket.glb`) · A · tier 1 · batch 2 · image-to-3D · 3000
- Concept asset line: `chunky toy rocket standing upright, rounded nose cone, one round porthole, three short rounded fins, a wide red band around the middle, a short engine bell at the bottom, short landing legs` · palette `white #f8fafc, red band #ef4444, slate #475569`.
- Rodin prompt:
```text
Chunky toy rocket standing upright: a rounded nose cone, one round porthole window, a wide red band around the middle, three short rounded fins, a short engine bell at the bottom and three short landing legs. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte white body, red band, slate engine. Single object, centred, vertical, symmetrical around its axis. No flame, no smoke, no launch pad, no base, no ground, no text, no flag. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 2.2 m tall; leg tips measured for the 2D landing polygon; engine bell centre for the flame; ≤ 5k tris.

#### windmill (`/models/3d/mini-golf/windmill.glb`) · A · tier 1 · batch 2 · image-to-3D · 3000
- Concept asset line: `mini-golf windmill: a small rounded tower with a cone roof, a round arched tunnel opening through the base, a round hub on the front for the blades, the blades themselves removed` · palette `cream walls #fef3c7, red roof #dc2626, wood trim #92400e`.
- Rodin prompt:
```text
Mini-golf windmill: a small rounded tower with cream walls, a red cone roof, wooden trim, a round arched tunnel opening through the base from front to back, and a round wooden hub on the front where the blades would attach. Premium stylised mobile-game look, friendly rounded toy proportions, soft bevelled edges, matte painted materials. Single object, centred, upright, front facing the viewer, symmetrical left to right. No blades, no sails, no base, no ground, no grass, no text. Clean game-ready low-poly topology, clean PBR textures without baked shadows.
```
- Fit and checks: 2.2 m tall; the tunnel must be open (a ball fits: test the opening width ≥ 0.25 m in game units); hub centre measured for the procedural blades; ≤ 4k tris.

#### vacuum (`/models/3d/ghost-vacuum/vacuum.glb`) · A · tier 1 · batch 2 · text-to-3D · 1500
```text
Ghost-hunting vacuum backpack unit: an upright rounded cylinder canister with a flat back plate, two small round gauges and a glowing violet light strip on the front, a short hose connector at the bottom. Premium stylised mobile-game look, soft bevelled edges, simple clean shapes, matte white and slate grey with a violet glow strip. Single object, centred, upright, front facing the viewer, symmetrical. No shoulder straps, no hose, no nozzle, no base, no ground, no text, no logo. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 0.55 m tall on the runner's back (attachment offset measured against the runner's chest); hose connector point measured; ≤ 3k tris.

#### knight (`/models/3d/shared/knight.glb`) · C · tier 1 · batch 2 · image-to-3D · 18000
- Concept (humanoid frame) asset line: `young cartoon knight in rounded training armour, a closed round helmet with a T-shaped visor slit and a short yellow plume, a short blue tabard above the knee with a simple yellow star, armoured gloves and boots` · palette `soft steel #cbd5e1, blue #3b82f6, yellow #facc15`.
- Rodin prompt (sent with the concept):
```text
Young cartoon knight in rounded training armour, closed round helmet with a T-shaped visor slit and a short yellow plume, short blue tabard ending above the knee with a simple yellow star, armoured gloves and boots, full body, clean T-pose with arms straight out level, legs slightly apart, facing forward, empty hands. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte soft steel, blue and yellow. Single character, centred. No sword, no shield, no cape, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.6 m; landmarks measured (`KNIGHT_LANDMARKS`): tabard → `hemY` above the knee (skirt weights), helmet rigid (`headY` at the top of the neck), gauntlets in the arm band (`armRadius`); stone override reads as a statue in museum-guard.

#### dummy (`/models/3d/knight-arena/dummy.glb`) · A · tier 1 · batch 2 · text-to-3D · 1500
```text
Training dummy: a straw-stuffed burlap torso and round head with stitched seams, two short stubby arms sticking out sideways, mounted on a single thick wooden post. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte burlap beige, warm brown wood, a red cloth band around the waist. Single object, centred, upright, front facing the viewer, symmetrical. No face, no weapons, no base plate, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 1.5 m on its post; the post base at y = 0 (the spring wobble pivots there); ≤ 3k tris.

### Tier 2 (batch 3: wave 3)

#### goblin (`/models/3d/castle-defender/goblin.glb`) · A · tier 2 · batch 3 · image-to-3D · 3000 (≤ 4.5k after optimize)
- Concept asset line: `small round-bellied cartoon goblin raider, big pointy ears, a big friendly-mischievous grin, a simple light leather tunic and belt, arms hanging down slightly away from the body, standing` · palette `pale green-grey skin #d9f99d at low saturation, light tan tunic #e7d8b5, dark belt #57534e`.
- Rodin prompt:
```text
Small round-bellied cartoon goblin raider: big pointy ears, a wide mischievous grin, a simple light leather tunic with a belt, short legs with bare feet, arms hanging down slightly away from the body, standing upright. Premium stylised mobile-game look, friendly rounded proportions, smooth simple shapes, matte pale green-grey skin and light tan tunic. Single character, centred, facing the viewer, symmetrical. No weapon, no helmet, no shield, no base, no ground, no text. Very simple low-poly game-ready topology for a crowd, clean PBR textures without baked shadows.
```
- Fit and checks: 0.9 m; **≤ 4.5k tris** after optimize (40 copies); the pale base takes per-type tints; solid (hop-march), not rigged.

#### castleTower (`/models/3d/shared/castleTower.glb`) · C · tier 2 · batch 3 · text-to-3D · 3000
```text
Round stone castle tower with a flat crenellated top, two small arched windows, a wooden door at the base and a slightly wider stone foot. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte warm grey stone blocks with soft colour variation, warm wood door. Single object, centred, upright, symmetrical around its axis. No flag, no roof, no wall attached, no base, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 6 m tall; top platform height measured; ≤ 5k tris; procedural walls match its stone tone.

#### snowKid (`/models/3d/snowball-battle/snowKid.glb`) · A · tier 2 · batch 3 · image-to-3D · 18000
- Concept (humanoid frame) asset line: `cheerful stylised child of about nine, generic friendly face (not a real person), puffy winter jacket in light grey-white, dark snow trousers, mittens, chunky snow boots, short hair, no hat, no scarf` · palette `light grey jacket #e5e7eb, slate trousers #475569, warm boots #92400e`.
- Rodin prompt:
```text
Cheerful stylised child about nine years old with a generic friendly face, short hair, a puffy light grey-white winter jacket, dark slate snow trousers, mittens and chunky warm brown snow boots, full body, clean T-pose with arms straight out level, legs slightly apart, facing forward, empty hands. Premium stylised mobile-game look, friendly rounded proportions, soft shapes, matte fabric materials. Single character, centred. No hat, no scarf, no backpack, no snowball, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.25 m; puffy sleeves → widen `armRadius`; boots rigid (`ankleY` above the boot top); team beanies/scarves are attachments.

#### astronaut (`/models/3d/space-repair/astronaut.glb`) · A · tier 2 · batch 3 · image-to-3D · 18000
- Concept (humanoid frame) asset line: `chunky cartoon astronaut in a rounded white space suit with soft indigo panels, a round helmet with a dark gold-tinted visor that hides the face, padded gloves and boots, no backpack` · palette `white #f8fafc, indigo #6366f1, visor gold-dark #a16207`.
- Rodin prompt:
```text
Chunky cartoon astronaut in a rounded white space suit with soft indigo panels on the chest and knees, a round helmet with a dark gold-tinted visor that hides the face, padded gloves and boots, full body, clean T-pose with arms straight out level, legs slightly apart, facing forward, empty hands. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte suit fabric, glossy-but-soft visor. Single character, centred. No backpack, no jetpack, no hoses, no flag patch, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.5 m; helmet rigid; bulky suit: check that arms hang clear of the torso (`armSpread`); jetpack is an attachment on the chest bone (back).

#### alien (`/models/3d/alien-farm/alien.glb`) · A · tier 2 · batch 3 · image-to-3D · 18000
- Concept (humanoid frame) asset line: `friendly little alien farmer, big round head with two large dark eyes and two short antennae with glowing tips, mint-green skin, denim-style overalls in soft blue over a cream shirt, small boots` · palette `mint skin #86efac, soft blue overalls #60a5fa, cream #fef3c7`.
- Rodin prompt:
```text
Friendly little alien farmer: a big round head with two large dark eyes and two short antennae with softly glowing tips, mint-green skin, soft blue overalls over a cream shirt, small boots, full body, clean T-pose with arms straight out level, legs slightly apart, facing forward, empty hands. Premium stylised mobile-game look, friendly rounded proportions, smooth soft shapes, matte materials. Single character, centred. No hat, no tools, no crops, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.3 m; big head → `headY` at the top of a short neck, antennae rigid on the head; carry pose clears the head.

#### glowPod (`/models/3d/alien-farm/glowPod.glb`) · A · tier 2 · batch 3 · image-to-3D · 1500
- Concept asset line: `alien crop plant: one bulbous translucent-looking pod on a short curved stem with three curly leaves at the base, softly glowing from inside` · palette `mint pod #4ade80, cyan glow #22d3ee, deep purple leaves #6d28d9`.
- Rodin prompt:
```text
Alien crop plant: one bulbous rounded pod on a short curved stem with three curly leaves at the base, the pod looks softly lit from inside. Premium stylised mobile-game look, friendly rounded shapes, soft bevelled edges, matte mint-green pod with lighter cyan stripes, deep purple leaves. Single object, centred, upright. No soil, no pot, no ground, no other plants, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```
- Fit and checks: 0.5–1.0 m by stage (scale); emissive driven in code (instance colour), so the texture must stay readable unlit; ≤ 3k tris.

#### panda (`/models/3d/zoo-escape/panda.glb`) · A · tier 2 · batch 3 · image-to-3D · 18000 (≤ 10k after optimize)
- Concept asset line: `chubby cartoon panda standing on all four legs, round body, big head with black eye patches and round ears, a cheeky smile, short legs` · palette `warm white #f8fafc, soft black #1f2937`.
- Rodin prompt:
```text
Chubby cartoon panda standing on all four short legs, round body, big round head with black eye patches and round black ears, a cheeky friendly smile, black legs and shoulders, warm white body. Premium stylised mobile-game look, friendly rounded proportions, smooth soft shapes, matte fur-like painted material without fine fur strands. Single character, centred, standing on all fours, facing the viewer at three-quarter view, symmetrical. No bamboo, no props, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.0 m long, faces +z; solid (waddle and sneak squash in code); ≤ 10k tris.

#### keeper (`/models/3d/zoo-escape/keeper.glb`) · A · tier 2 · batch 3 · image-to-3D · 18000
- Concept (humanoid frame) asset line: `friendly zookeeper adult with a generic stylised face (not a real person), a khaki short-sleeved shirt with pockets, khaki shorts, a wide-brim safari hat, brown boots, green neck scarf` · palette `khaki #d6c08a, olive scarf #4d7c0f, brown boots #78350f`.
- Rodin prompt:
```text
Friendly zookeeper adult with a generic stylised face, a khaki short-sleeved shirt with two chest pockets, khaki shorts, a short green neck scarf, a wide-brim safari hat and brown boots, full body, clean T-pose with arms straight out level, legs slightly apart, facing forward, empty hands. Premium stylised mobile-game look, friendly rounded proportions, soft shapes, matte fabric materials. Single character, centred. No flashlight, no keys, no backpack, no animals, no base, no ground, no text. Clean game-ready topology, clean PBR textures without baked shadows.
```
- Fit and checks: 1.75 m; short sleeves → `armRadius` covers the sleeve; hat rigid on the head; flashlight is an attachment on the right forearm.

### Tier 3 (optional, only if credits remain after batch 3)

#### bust (`/models/3d/museum-guard/bust.glb`) · E · text-to-3D · 1500
```text
Classical marble bust of a friendly smiling bearded figure with curly hair, head and shoulders on a short round neck stand. Premium stylised mobile-game look, soft rounded shapes, matte white marble with soft warm veins. Single object, centred, upright, facing the viewer, symmetrical. No pedestal column, no plaque, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```

#### mushroom (`/models/3d/shared/mushroom.glb`) · E · text-to-3D · 1500
```text
Cartoon toadstool mushroom with a round red cap and soft white spots, a thick cream stem. Premium stylised mobile-game look, soft bevelled edges, matte painted materials. Single object, centred, upright, symmetrical. No grass, no ground, no other mushrooms, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```

#### plane (`/models/3d/luggage-rush/plane.glb`) · E · text-to-3D · 3000
```text
Chunky toy passenger airplane, rounded short fuselage, white with a soft blue tail and a blue stripe, two round engines under the wings, small round windows. Premium stylised mobile-game look, friendly rounded proportions, soft bevelled edges, matte materials. Single object, centred, level, side three-quarter view, symmetrical. No airline logo, no text, no ground, no runway. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```

#### crab (`/models/3d/treasure-island/crab.glb`) · E · text-to-3D · 1500
```text
Small cartoon beach crab with a round coral-red shell, two big friendly eyes on short stalks, two rounded claws raised, six short legs. Premium stylised mobile-game look, soft bevelled edges, matte coral red with a cream underside. Single object, centred, standing, facing the viewer, symmetrical. No sand, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```

#### gourd (`/models/3d/alien-farm/gourd.glb`) · E · text-to-3D · 1500
```text
Alien spiral gourd: a twisted spiral-shaped gourd with soft ridges on a short stem with two broad leaves, looks softly lit from inside. Premium stylised mobile-game look, rounded shapes, matte cyan-blue gourd with mint stripes, deep purple leaves. Single object, centred, upright. No soil, no pot, no ground, no text. Clean game-ready low-poly topology, clean PBR texture without baked shadows.
```

## E.6 Master inventory and totals

| Measure | Count |
|---|---|
| Distinct assets across the 20 games (all classes) | ≈ 125 |
| Existing GLBs reused (D) | **30** of 39: runner, robot, battery, crate, barrel, tinCan, banana, desk, chair, coin, apple, burger, sock, chef, cleaner, pallet, bottle, bag, book, door, checkpoint-flag, car, taxi, van, pigeon, bench, bin, lamp, palm, umbrella |
| New shared GLBs (C, each used by ≥ 2 games) | 10: chest, rock, cannon, penguin, fish, pineTree, leafyTree, dino, knight, castleTower |
| New game-only GLBs (A) | 17 tier 1–2 + 5 tier 3 |
| Hyper3D generations, tier 1 | 19 (batch 1: 11, batch 2: 8) |
| Hyper3D generations, tier 2 | 8 (batch 3) |
| Retry reserve | 7 (≈ 25 %; characters first) |
| Tier 3 (optional) | 5 |
| Procedural assets (B) | ≈ 60 (ghosts, eggs, nest, gems, parcels, buildings, crane, building pieces, tracks, ice blocks, snowmen, forts, saucer, modules, planets, terrains, pads, belts, diverters, conveyors, fences, bushes, vision cones, flashlight, hats, scarves, sword, shield, jetpack, hose, wrench, vases, paintings, pedestals, …) |
| High priority (P1) GLB generations | 25 (all tier 1 + the tier 2 heroes) |

**Credits** (rate unverified: read the dashboard first)

| Scenario | Generations | At 0.5 credit | At 1.0 credit |
|---|---|---|---|
| Low (tier 1 only, 3 retries) | 22 | 11 | 22 |
| Balanced (tier 1 + 2, 7 retries) | 34 | **17** | 34 |
| High (+ tier 3, 10 retries) | 42 | 21 | 42 |

Recorded spend so far ≈ 40 generations ≈ 20 credits at 0.5 **[V]** → about 25 left of 45 **[A]**. If the dashboard shows less than the balanced scenario needs, the **cut list** (in order): tier 3 → castleTower (procedural tower) → dummy (procedural) → glowPod (procedural pod) → goblin (procedural blob goblin) → keeper (runner + safari hat attachment). Each cut is pre-designed in the game spec so no game is blocked.

**Batches and approvals**

| Batch | When | Assets | Gens (+ reserve) | Your approval |
|---|---|---|---|---|
| 1 | Phase 2 (before the reference game) | chest, rock, cannon, ship, suitcase, cart, cauldron, monster, penguin, fish, pineTree | 11 (+3) | concepts for chest, cannon, ship, cart, monster, penguin; then "po, gjenero batch 1" |
| 2 | during wave 1 | leafyTree, dino, drone, rocket, windmill, vacuum, knight, dummy | 8 (+2) | concepts for dino, drone, rocket, windmill, knight; then "po, gjenero batch 2" |
| 3 | during wave 2 | goblin, castleTower, snowKid, astronaut, alien, glowPod, panda, keeper | 8 (+2) | concepts for all but castleTower; then "po, gjenero batch 3" |
| 4 | Phase 7, optional | tier 3 | 5 | only if credits remain |
