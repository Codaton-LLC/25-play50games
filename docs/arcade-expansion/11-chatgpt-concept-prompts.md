# ChatGPT concept prompts: all 18, ready to copy

This file is the filled-in version of P-10 (`08-prompt-library.md`) for every image-to-3D asset in `05-hyper3d-catalog.md` §E.5. You paste each prompt into ChatGPT; you never send these to Hyper3D yourself. The 9 text-to-3D assets (rock, suitcase, cauldron, fish, pineTree, leafyTree, vacuum, dummy, castleTower) need no image: Claude sends their Rodin prompts directly.

## How to use it

1. **Once, first:** run the style sheet prompt (step 0 below) and pick variation A, B or C. Keep that image: you attach it to **every** concept prompt.
2. **For each asset:** open a ChatGPT chat, attach the chosen style sheet, paste the prompt, generate.
3. **Check** the image against the asset's "Check before approving" line and the general rules below; regenerate until it passes (ChatGPT images cost no Hyper3D credits).
4. **Save** the approved image on your PC as `%USERPROFILE%\.play50\concepts\expansion\<file>` (the exact file name is given with each prompt; `.png` or `.webp` both work).
5. When a whole batch is saved, tell Claude Code **on your PC** (this cloud session cannot reach that folder or Hyper3D). Claude checks the images, shows you the batch with its credit estimate, and generates only after you write "po, gjenero batch N".

**General rules: regenerate the image if**
- any part is cut off at the edge (feet, hands, ears, wheels, the top of the object);
- there is more than one object, a shadow on the floor, a background scene, text or a logo;
- it looks glossy, plastic or candy-saturated instead of matte with calm colours;
- a face resembles a real person (all new characters get generic faces; none uses yours);
- for the five humanoids (knight, snowKid, astronaut, alien, keeper): the arms are not level, an arm touches the body, or the legs are together.

## Step 0: style sheet (once)

```text
Create a style sheet for a family-friendly 3D browser game world called "Play50 toy world, premium edition". It must match an existing game whose hero is a matte white robot with soft blue panels and a glowing visor, and stylised human characters with slightly big heads, glasses and beards. Show on one 1536x1024 image: one small friendly character in a T-pose, five props (a wooden treasure chest, a boulder, a shopping cart, a cartoon cannon, a pine tree), an 8-colour palette (warm off-white #f4efe6, light grey #d4d4d8, slate #475569, gold #fbbf24, coral #f87171, mint #34d399, cyan #22d3ee, one world colour), and two material swatches (matte painted, satin). Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette with one bright accent per object, soft studio light, no outlines, no cel shading, no glossy plastic, no saturated candy colours, no text. Make 3 variations (A, B, C) as separate images.
```

Save the chosen variation as `%USERPROFILE%\.play50\concepts\expansion\style-v2.png`.

## Batch 1 (6 images)

### chest

- File: `chest.png` · prop · used by treasure-island, pirate-cannons · becomes `/models/3d/shared/chest.glb`
- Check before approving (besides the general rules): the lid is closed; no coins spilling out; gold bands clearly visible.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single wooden treasure chest with a rounded barrel-top lid, closed, three gold metal bands, a gold front lock plate, slightly chunky toy proportions, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (warm brown wood #8b5a2b, gold #fbbf24, dark iron #334155). 1024x1024.
```

### cannon

- File: `cannon.png` · prop · used by pirate-cannons, castle-defender · becomes `/models/3d/shared/cannon.glb`
- Check before approving (besides the general rules): no cannonballs, no smoke; both wheels visible; barrel clearly separate from the carriage.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single cartoon bronze cannon on a wooden two-wheeled carriage, short thick barrel with a rounded muzzle ring, side view three-quarter, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (bronze #b45309, wood #92400e, iron #475569). 1024x1024.
```

### ship

- File: `ship.png` · prop · used by pirate-cannons · becomes `/models/3d/pirate-cannons/ship.glb`
- Check before approving (besides the general rules): no flag, no crew, no ropes or rigging lines, no water; one mast, one square sail.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single small chunky cartoon pirate sloop, rounded wooden hull, one mast with one big square cream sail, a small raised stern deck, side three-quarter view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (wood #92400e, cream sail #fef3c7, red trim #dc2626). 1024x1024.
```

### cart

- File: `cart.png` · prop · used by shopping-cart · becomes `/models/3d/shopping-cart/cart.glb`
- Check before approving (besides the general rules): the basket is solid rounded panels with big cut-outs, no thin wire mesh; no groceries inside.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single toy-like supermarket shopping cart with a solid basket made of smooth rounded panels with a few big rectangular cut-outs instead of thin wires, red plastic handle, four small chunky wheels, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (light silver #e5e7eb, red handle #ef4444, dark wheels #1f2937). 1024x1024.
```

### monster

- File: `monster.png` · creature · used by monster-kitchen · becomes `/models/3d/monster-kitchen/monster.glb`
- Check before approving (besides the general rules): no horns, no hat, no clothes (they are added in code); arms do not touch the body; pale body that can be tinted.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single cute round blob monster customer, pear-shaped soft body, two big friendly eyes, a wide happy mouth with two little teeth, short stubby arms held slightly out from the body, short feet, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (pale lavender-white body #ede9fe, soft lilac belly #c4b5fd, dark eyes #1e1b4b). 1024x1024.
```

### penguin

- File: `penguin.png` · creature · used by penguin-slide, museum-guard · becomes `/models/3d/shared/penguin.glb`
- Check before approving (besides the general rules): standing upright; flippers slightly away from the body; no scarf, no hat, no ice.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single chubby cartoon penguin standing upright, flippers held slightly out from the body, round belly, small orange beak and feet, big friendly eyes, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (charcoal back #1f2937, warm white belly #f8fafc, orange #f97316). 1024x1024.
```

## Batch 2 (5 images)

### dino

- File: `dino.png` · creature · used by dino-egg-rescue, museum-guard · becomes `/models/3d/shared/dino.glb`
- Check before approving (besides the general rules): on four legs; a broad flat back (eggs will sit on it); no saddle, no eggs.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single chubby baby dinosaur in the style of a young triceratops standing on four short sturdy legs, broad flat back, a small frill with three soft horns, short tail, big friendly eyes, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (soft leaf green #84cc16, cream belly #fef3c7, frill orange #fb923c). 1024x1024.
```

### drone

- File: `drone.png` · prop · used by delivery-drone · becomes `/models/3d/delivery-drone/drone.glb`
- Check before approving (besides the general rules): the four rotor rings are empty (no propeller blades); no parcel attached; no logo.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single friendly delivery drone, rounded white body with soft blue panels, four round rotor guards on short arms with no propeller blades inside, a small parcel hook underneath, a small glowing camera eye at the front, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (white #f8fafc, soft blue #7dd3fc, slate #475569). 1024x1024.
```

### rocket

- File: `rocket.png` · prop · used by rocket-landing · becomes `/models/3d/rocket-landing/rocket.glb`
- Check before approving (besides the general rules): standing upright; no flame, no smoke, no launch pad; three landing legs visible.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single chunky toy rocket standing upright, rounded nose cone, one round porthole, three short rounded fins, a wide red band around the middle, a short engine bell at the bottom, short landing legs, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (white #f8fafc, red band #ef4444, slate #475569). 1024x1024.
```

### windmill

- File: `windmill.png` · prop · used by mini-golf · becomes `/models/3d/mini-golf/windmill.glb`
- Check before approving (besides the general rules): no blades or sails (they are made in code); the tunnel through the base is open; a round hub on the front.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single mini-golf windmill: a small rounded tower with a cone roof, a round arched tunnel opening through the base, a round hub on the front for the blades, the blades themselves removed, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (cream walls #fef3c7, red roof #dc2626, wood trim #92400e). 1024x1024.
```

### knight

- File: `knight.png` · humanoid character (T-pose) · used by knight-arena, museum-guard · becomes `/models/3d/shared/knight.glb`
- Check before approving (besides the general rules): clean T-pose; closed helmet (no face); the tabard ends above the knee; no sword, no shield, no cape.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single young cartoon knight in rounded training armour, a closed round helmet with a T-shaped visor slit and a short yellow plume, a short blue tabard above the knee with a simple yellow star, armoured gloves and boots, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (soft steel #cbd5e1, blue #3b82f6, yellow #facc15). 1024x1024. Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.
```

## Batch 3 (7 images)

### goblin

- File: `goblin.png` · creature · used by castle-defender · becomes `/models/3d/castle-defender/goblin.glb`
- Check before approving (besides the general rules): arms hang down slightly away from the body (not a T-pose); no weapon, no helmet; simple shapes (it is drawn 40 times).

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single small round-bellied cartoon goblin raider, big pointy ears, a big friendly-mischievous grin, a simple light leather tunic and belt, arms hanging down slightly away from the body, standing, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (pale green-grey skin #d9f99d at low saturation, light tan tunic #e7d8b5, dark belt #57534e). 1024x1024.
```

### snowKid

- File: `snowKid.png` · humanoid character (T-pose) · used by snowball-battle · becomes `/models/3d/snowball-battle/snowKid.glb`
- Check before approving (besides the general rules): clean T-pose; a generic child face that resembles no real person; no hat, no scarf (added in code).

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single cheerful stylised child of about nine, generic friendly face (not a real person), puffy winter jacket in light grey-white, dark snow trousers, mittens, chunky snow boots, short hair, no hat, no scarf, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (light grey jacket #e5e7eb, slate trousers #475569, warm boots #92400e). 1024x1024. Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.
```

### astronaut

- File: `astronaut.png` · humanoid character (T-pose) · used by space-repair · becomes `/models/3d/space-repair/astronaut.glb`
- Check before approving (besides the general rules): clean T-pose; the visor hides the face; no backpack or jetpack (added in code).

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single chunky cartoon astronaut in a rounded white space suit with soft indigo panels, a round helmet with a dark gold-tinted visor that hides the face, padded gloves and boots, no backpack, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (white #f8fafc, indigo #6366f1, visor gold-dark #a16207). 1024x1024. Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.
```

### alien

- File: `alien.png` · humanoid character (T-pose) · used by alien-farm · becomes `/models/3d/alien-farm/alien.glb`
- Check before approving (besides the general rules): clean T-pose; antennae on the head; no hat, no tools.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single friendly little alien farmer, big round head with two large dark eyes and two short antennae with glowing tips, mint-green skin, denim-style overalls in soft blue over a cream shirt, small boots, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (mint skin #86efac, soft blue overalls #60a5fa, cream #fef3c7). 1024x1024. Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.
```

### glowPod

- File: `glowPod.png` · prop · used by alien-farm · becomes `/models/3d/alien-farm/glowPod.glb`
- Check before approving (besides the general rules): one single pod on one stem; no soil or pot; still readable without the glow.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single alien crop plant: one bulbous translucent-looking pod on a short curved stem with three curly leaves at the base, softly glowing from inside, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (mint pod #4ade80, cyan glow #22d3ee, deep purple leaves #6d28d9). 1024x1024.
```

### panda

- File: `panda.png` · creature · used by zoo-escape · becomes `/models/3d/zoo-escape/panda.glb`
- Check before approving (besides the general rules): standing on all four legs; no bamboo or props; no fine fur strands.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single chubby cartoon panda standing on all four legs, round body, big head with black eye patches and round ears, a cheeky smile, short legs, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (warm white #f8fafc, soft black #1f2937). 1024x1024.
```

### keeper

- File: `keeper.png` · humanoid character (T-pose) · used by zoo-escape · becomes `/models/3d/zoo-escape/keeper.glb`
- Check before approving (besides the general rules): clean T-pose; a generic adult face that resembles no real person; no flashlight, keys or animals.

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single friendly zookeeper adult with a generic stylised face (not a real person), a khaki short-sleeved shirt with pockets, khaki shorts, a wide-brim safari hat, brown boots, green neck scarf, front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette (khaki #d6c08a, olive scarf #4d7c0f, brown boots #78350f). 1024x1024. Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.
```

## Progress checklist

| Batch | Image | File | Approved |
|---|---|---|---|
| 1 | chest | `chest.png` | ☐ |
| 1 | cannon | `cannon.png` | ☐ |
| 1 | ship | `ship.png` | ☐ |
| 1 | cart | `cart.png` | ☐ |
| 1 | monster | `monster.png` | ☐ |
| 1 | penguin | `penguin.png` | ☐ |
| 2 | dino | `dino.png` | ☐ |
| 2 | drone | `drone.png` | ☐ |
| 2 | rocket | `rocket.png` | ☐ |
| 2 | windmill | `windmill.png` | ☐ |
| 2 | knight | `knight.png` | ☐ |
| 3 | goblin | `goblin.png` | ☐ |
| 3 | snowKid | `snowKid.png` | ☐ |
| 3 | astronaut | `astronaut.png` | ☐ |
| 3 | alien | `alien.png` | ☐ |
| 3 | glowPod | `glowPod.png` | ☐ |
| 3 | panda | `panda.png` | ☐ |
| 3 | keeper | `keeper.png` | ☐ |

Batch 1 is needed before the reference game (Phase 2); batch 2 during wave 1; batch 3 during wave 2 (`05-hyper3d-catalog.md` §E.6).
