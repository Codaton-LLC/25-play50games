# PLAY50 — MENU 2
## FULL PRODUCTION SPEC — Color Roll Heroes — 30 3D Games

**Scope:** this is a completely separate arcade menu from Menu 1.

The menu uses one original character family, one shared rig and a strong five-color ability system.

> **REDESIGN 2026-10-25 (user decision, overrides everything below):** to lower the trademark-resemblance risk before anything of Menu 2 is built or published:
> - **Hero = an original armadillo/pangolin-style hero**, NOT a turtle. A natural armoured shell of overlapping plates that can roll into a ball (dash/bounce moves). **No eye masks.** The hero colour (Riko red, Nami blue, Kiro green, Zuno yellow, Vexa purple) is carried by the **shell plates and armour** plus glowing lines on the shell; the face shows through an open **helmet with a visor** (or headphones/ear guards), never a cloth mask. One base mesh + rig, colour by material, as before.
> - **No TMNT-like elements:** no turtles, no green-skinned turtle look, no eye masks, no katanas/sai/nunchaku/bo staff, no pizza, no sewers, no rats, no "sensei" mentor. Game 03 "Flooded Ruins Escape" becomes **Flooded Ruins Escape** (ancient stone water channels, levers, rising water; assets: stone channel, brick ledge, lever, stone platform, water hazard) and game 12 "Mine Tunnel Run" becomes **Mine Tunnel Run** (mine tunnels, rails, carts; level 5 "Deep Mine Sprint" becomes "Deep Mine Sprint"). The Hyper3D props m2RuinPipe and m2RuinRat are dropped and replaced (stone water channel, cave beetle/mole). Any "turtle-shell" wording below means the hero's armadillo shell.
> - **Game titles (2026-10-25):** no "Ninja"/"Shell"/"Shadow Clone" in titles or visible text (renamed: Rooftop Roll Climb, Roll Dash, Mirror Dash, Plate Bounce Arena, Plate Surf, Laser Maze Run, Disc Target Throw (discs, never throwing stars), Roll Cannon Jump, Tightrope Path, Zipline Rush); temples/gongs use a generic ancient-ruins style (stone, jungle), not a Japanese ninja-dojo look; the signature move is rolling into a ball.
> - **Name:** the menu is now called **"Color Roll Heroes"** (user, 2026-10-25); the earlier working name is retired. Before Menu 2 is published: check the final name in DPMA (dpma.de) and EUIPO/TMview, confirm the Hyper3D plan allows commercial use of the models, and a short consult with an IP lawyer (Fachanwalt für Urheber- und Medienrecht / IT-Recht).

# Character family

| Hero | Color | Ability | Suggested cooldown |
|---|---|---|---:|
| Riko | Red `#EF4444` | Dash | 15 sec |
| Nami | Blue `#2563EB` | Double Jump | 10 sec |
| Kiro | Green `#22C55E` | Shield | 20 sec |
| Zuno | Yellow `#FACC15` | Coin Magnet | 20 sec |
| Vexa | Purple `#8B5CF6` | Phase | 20 sec |

Use **one base mesh + one skeleton + material/color variants** wherever possible.

## Hyper3D master character prompt
```text
Original stylized 3D anthropomorphic armadillo hero (pangolin-like armoured shell of overlapping plates) for a premium mobile and browser game, completely original character design and not based on or resembling any existing franchise character.

Full body, compact athletic proportions, slightly oversized head, expressive friendly face, armoured shell of overlapping plates over the back and head that can curl into a ball, strong hands and feet, clean hero outfit, dark charcoal fabric clothing, simple belt, wrist wraps and ankle wraps.

No weapons, no logos, no text, no cape.

Clean T-pose, arms straight horizontally to the sides, legs slightly apart, palms down, symmetrical pose, nothing touching the arms.

Premium stylized game art, soft bevelled shapes, medium-low polygon count, clean game-ready topology, clear silhouette, matte painted materials, optimized for a browser 3D game, suitable for rigging and animation.

Neutral studio lighting, plain light grey background.

Color accent: RED #EF4444 on the shell plates, armour pads and glowing shell lines; an open helmet with a clear visor; no eye mask.
```

Create Blue, Green, Yellow and Purple variants by changing only the accent material.

## Shared animation set

`Idle`, `Walk`, `Run`, `Jump`, `DoubleJump`, `Fall`, `Land`, `Dash`, `Stumble`, `Collect`, `Celebrate`, `Defeat`.

## Shared technical systems

`CharacterController`, `VerticalCamera`, `RunnerCamera`, `ColorAbilitySystem`, `PlatformSpawner`, `ObstacleSpawner`, `CollectibleSystem`, `TimerSystem`, `ScoreSystem`, `CheckpointSystem`, `RoundManager`, `GameOver`, `WinState`, `MobileControls`, `AudioManager`, `Leaderboard`, `SkinSystem`.

---

# GAME 01 — Sky Tower Jump

**Game type:** Vertical infinite jump
**Core objective:** Reach maximum height on floating platforms.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Floating stone platform, coin, checkpoint beacon

### Hyper3D — primary level asset prompt
```text
Stylized floating stone platform for a premium mobile/browser arcade game, rounded rectangular shape, grass top, clean low-poly game-ready geometry, no text.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Training Sky

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Training Sky** using the same art direction as Sky Tower Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Training Sky** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 60 m height and collect optional coins.
- **Required 3D assets:** Floating stone platform, coin, checkpoint beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Cloud Steps

- **Difficulty:** Easy
- **Environment / visual:** **Cloud Steps** using the same art direction as Sky Tower Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Cloud Steps** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 100 m height and collect optional coins.
- **Required 3D assets:** Floating stone platform, coin, checkpoint beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Moving Platforms

- **Difficulty:** Medium
- **Environment / visual:** **Moving Platforms** using the same art direction as Sky Tower Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Moving Platforms** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 150 m height and collect optional coins.
- **Required 3D assets:** Floating stone platform, coin, checkpoint beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Storm Heights

- **Difficulty:** Hard
- **Environment / visual:** **Storm Heights** using the same art direction as Sky Tower Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Storm Heights** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 220 m height and collect optional coins.
- **Required 3D assets:** Floating stone platform, coin, checkpoint beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Infinite Tower

- **Difficulty:** Challenge
- **Environment / visual:** **Infinite Tower** using the same art direction as Sky Tower Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Infinite Tower** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 300 m height and collect optional coins.
- **Required 3D assets:** Floating stone platform, coin, checkpoint beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 02 — Rooftop Roll Climb

**Game type:** Vertical rooftop climb
**Core objective:** Jump between rooftops and climb as high as possible.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge

### Hyper3D — primary level asset prompt
```text
Stylized compact rooftop air-conditioning unit, dark grey metal, rounded edges, premium mobile game prop, clean low-poly geometry, no branding.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Low Roofs

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Low Roofs** using the same art direction as Rooftop Roll Climb; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Low Roofs** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 8 rooftop sections without falling.
- **Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Office Roofs

- **Difficulty:** Easy
- **Environment / visual:** **Office Roofs** using the same art direction as Rooftop Roll Climb; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Office Roofs** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 12 rooftop sections without falling.
- **Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Moving Rooftops

- **Difficulty:** Medium
- **Environment / visual:** **Moving Rooftops** using the same art direction as Rooftop Roll Climb; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Moving Rooftops** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 16 rooftop sections without falling.
- **Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Night Skyline

- **Difficulty:** Hard
- **Environment / visual:** **Night Skyline** using the same art direction as Rooftop Roll Climb; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Night Skyline** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 20 rooftop sections without falling.
- **Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — High-Rise Climb

- **Difficulty:** Challenge
- **Environment / visual:** **High-Rise Climb** using the same art direction as Rooftop Roll Climb; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **High-Rise Climb** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 25 rooftop sections without falling.
- **Required 3D assets:** AC unit, water tank, chimney, antenna, rooftop ledge. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 03 — Flooded Ruins Escape

**Game type:** Vertical escape
**Core objective:** Climb pipes and ledges while rising water chases the player.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard

### Hyper3D — primary level asset prompt
```text
Large stylized ancient stone water channel section, weathered sandstone, modular shape, subtle moss and water stains, premium low-poly game-ready prop.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Drain Entry

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Drain Entry** using the same art direction as Flooded Ruins Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Drain Entry** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 3 vertical sections.
- **Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Pipe Maze

- **Difficulty:** Easy
- **Environment / visual:** **Pipe Maze** using the same art direction as Flooded Ruins Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Pipe Maze** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 4 vertical sections.
- **Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Valve Shaft

- **Difficulty:** Medium
- **Environment / visual:** **Valve Shaft** using the same art direction as Flooded Ruins Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Valve Shaft** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 5 vertical sections.
- **Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Flood Rise

- **Difficulty:** Hard
- **Environment / visual:** **Flood Rise** using the same art direction as Flooded Ruins Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Flood Rise** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 6 vertical sections.
- **Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Final Escape

- **Difficulty:** Challenge
- **Environment / visual:** **Final Escape** using the same art direction as Flooded Ruins Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Final Escape** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 8 vertical sections.
- **Required 3D assets:** Stone water channel, brick ledge, stone lever, stone platform, water hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 04 — Lava Pillar Jump

**Game type:** Rising hazard platformer
**Core objective:** Jump upward while lava rises and platforms sink.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible

### Hyper3D — primary level asset prompt
```text
Stylized volcanic stone pillar platform, dark basalt with subtle glowing orange cracks, flat playable top, premium low-poly game asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Warm Cavern

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Warm Cavern** using the same art direction as Lava Pillar Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Warm Cavern** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 10 pillars while staying above the rising lava.
- **Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Pillar Field

- **Difficulty:** Easy
- **Environment / visual:** **Pillar Field** using the same art direction as Lava Pillar Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Pillar Field** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 14 pillars while staying above the rising lava.
- **Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Falling Rocks

- **Difficulty:** Medium
- **Environment / visual:** **Falling Rocks** using the same art direction as Lava Pillar Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Falling Rocks** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 18 pillars while staying above the rising lava.
- **Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Lava

- **Difficulty:** Hard
- **Environment / visual:** **Fast Lava** using the same art direction as Lava Pillar Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Fast Lava** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 22 pillars while staying above the rising lava.
- **Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Volcano Core

- **Difficulty:** Challenge
- **Environment / visual:** **Volcano Core** using the same art direction as Lava Pillar Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Volcano Core** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 28 pillars while staying above the rising lava.
- **Required 3D assets:** Basalt pillar, lava rock, collapsing platform, ember collectible. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 05 — Cloud Hopper

**Game type:** Soft vertical jumper
**Core objective:** Bounce upward on clouds, including disappearing clouds.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Cloud platform, feather power-up, star, wind ring

### Hyper3D — primary level asset prompt
```text
Cute stylized solid cloud platform, soft rounded silhouette, white matte material, subtle blue underside, premium 3D low-poly game asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Soft Clouds

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Soft Clouds** using the same art direction as Cloud Hopper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Soft Clouds** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 12 cloud platforms and maintain a landing streak.
- **Required 3D assets:** Cloud platform, feather power-up, star, wind ring. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Moving Clouds

- **Difficulty:** Easy
- **Environment / visual:** **Moving Clouds** using the same art direction as Cloud Hopper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Moving Clouds** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 16 cloud platforms and maintain a landing streak.
- **Required 3D assets:** Cloud platform, feather power-up, star, wind ring. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Wind Zone

- **Difficulty:** Medium
- **Environment / visual:** **Wind Zone** using the same art direction as Cloud Hopper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Wind Zone** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 20 cloud platforms and maintain a landing streak.
- **Required 3D assets:** Cloud platform, feather power-up, star, wind ring. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fading Clouds

- **Difficulty:** Hard
- **Environment / visual:** **Fading Clouds** using the same art direction as Cloud Hopper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Fading Clouds** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 24 cloud platforms and maintain a landing streak.
- **Required 3D assets:** Cloud platform, feather power-up, star, wind ring. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Sky Sprint

- **Difficulty:** Challenge
- **Environment / visual:** **Sky Sprint** using the same art direction as Cloud Hopper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Sky Sprint** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 30 cloud platforms and maintain a landing streak.
- **Required 3D assets:** Cloud platform, feather power-up, star, wind ring. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 06 — Temple Lantern Jump

**Game type:** Temple vertical platformer
**Core objective:** Use balconies and lantern bounce pads to climb.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin

### Hyper3D — primary level asset prompt
```text
Stylized fantasy temple lantern, warm glowing paper lantern in a dark wooden frame, original design, low-poly premium game asset, no text.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Temple Gate

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Temple Gate** using the same art direction as Temple Lantern Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Temple Gate** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb to the temple roof using 8 platforms/lantern bounce points.
- **Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Lantern Hall

- **Difficulty:** Easy
- **Environment / visual:** **Lantern Hall** using the same art direction as Temple Lantern Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Lantern Hall** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb to the temple roof using 12 platforms/lantern bounce points.
- **Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Balcony Climb

- **Difficulty:** Medium
- **Environment / visual:** **Balcony Climb** using the same art direction as Temple Lantern Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Balcony Climb** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb to the temple roof using 16 platforms/lantern bounce points.
- **Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Night Temple

- **Difficulty:** Hard
- **Environment / visual:** **Night Temple** using the same art direction as Temple Lantern Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Night Temple** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb to the temple roof using 20 platforms/lantern bounce points.
- **Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Golden Roof

- **Difficulty:** Challenge
- **Environment / visual:** **Golden Roof** using the same art direction as Temple Lantern Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Golden Roof** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb to the temple roof using 24 platforms/lantern bounce points.
- **Required 3D assets:** Lantern, wooden balcony, beam, temple ledge, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 07 — Neon Cube Jump

**Game type:** Reactive platformer
**Core objective:** Jump across cubes that move, toggle and recolor.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Neon cube, energy pad, laser wall, digital coin

### Hyper3D — primary level asset prompt
```text
Futuristic floating cube platform, dark graphite surface with cyan edge strips, beveled corners, clean sci-fi low-poly game-ready asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Static Grid

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Static Grid** using the same art direction as Neon Cube Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Static Grid** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 30 seconds and reach the highest active cube chain.
- **Required 3D assets:** Neon cube, energy pad, laser wall, digital coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Moving Cubes

- **Difficulty:** Easy
- **Environment / visual:** **Moving Cubes** using the same art direction as Neon Cube Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Moving Cubes** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 45 seconds and reach the highest active cube chain.
- **Required 3D assets:** Neon cube, energy pad, laser wall, digital coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Blink Grid

- **Difficulty:** Medium
- **Environment / visual:** **Blink Grid** using the same art direction as Neon Cube Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Blink Grid** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 60 seconds and reach the highest active cube chain.
- **Required 3D assets:** Neon cube, energy pad, laser wall, digital coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Laser Grid

- **Difficulty:** Hard
- **Environment / visual:** **Laser Grid** using the same art direction as Neon Cube Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Laser Grid** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 75 seconds and reach the highest active cube chain.
- **Required 3D assets:** Neon cube, energy pad, laser wall, digital coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Neon Overdrive

- **Difficulty:** Challenge
- **Environment / visual:** **Neon Overdrive** using the same art direction as Neon Cube Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Neon Overdrive** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 90 seconds and reach the highest active cube chain.
- **Required 3D assets:** Neon cube, energy pad, laser wall, digital coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 08 — Jungle Vine Jump

**Game type:** Vertical jungle climb
**Core objective:** Use branches, ruins and swinging vines to climb.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem

### Hyper3D — primary level asset prompt
```text
Stylized thick jungle vine suitable as a swinging game platform, twisted green vine, broad leaves, premium low-poly game geometry.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Green Start

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Green Start** using the same art direction as Jungle Vine Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Green Start** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 8 jungle sections using platforms and swinging vines.
- **Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Branch Climb

- **Difficulty:** Easy
- **Environment / visual:** **Branch Climb** using the same art direction as Jungle Vine Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Branch Climb** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 12 jungle sections using platforms and swinging vines.
- **Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Swinging Vines

- **Difficulty:** Medium
- **Environment / visual:** **Swinging Vines** using the same art direction as Jungle Vine Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Swinging Vines** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 16 jungle sections using platforms and swinging vines.
- **Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Ruins

- **Difficulty:** Hard
- **Environment / visual:** **Ruins** using the same art direction as Jungle Vine Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Ruins** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 20 jungle sections using platforms and swinging vines.
- **Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Canopy Peak

- **Difficulty:** Challenge
- **Environment / visual:** **Canopy Peak** using the same art direction as Jungle Vine Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Canopy Peak** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb 24 jungle sections using platforms and swinging vines.
- **Required 3D assets:** Vine, branch platform, ruin stone, jungle leaf, gem. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 09 — Ice Peak Jumper

**Game type:** Slippery platformer
**Core objective:** Climb slippery ice platforms while avoiding falling snowballs.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal

### Hyper3D — primary level asset prompt
```text
Stylized floating ice platform, pale blue ice with snowy top, angular rounded edges, premium winter low-poly game asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Snow Base

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Snow Base** using the same art direction as Ice Peak Jumper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Snow Base** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the summit through 10 slippery/cracking platforms.
- **Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Ice Steps

- **Difficulty:** Easy
- **Environment / visual:** **Ice Steps** using the same art direction as Ice Peak Jumper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Ice Steps** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the summit through 14 slippery/cracking platforms.
- **Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Cracking Ice

- **Difficulty:** Medium
- **Environment / visual:** **Cracking Ice** using the same art direction as Ice Peak Jumper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Cracking Ice** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the summit through 18 slippery/cracking platforms.
- **Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Snowfall

- **Difficulty:** Hard
- **Environment / visual:** **Snowfall** using the same art direction as Ice Peak Jumper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Snowfall** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the summit through 22 slippery/cracking platforms.
- **Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Frozen Summit

- **Difficulty:** Challenge
- **Environment / visual:** **Frozen Summit** using the same art direction as Ice Peak Jumper; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Frozen Summit** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the summit through 26 slippery/cracking platforms.
- **Required 3D assets:** Ice platform, snowball, icicle, snow ledge, crystal. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 10 — Space Pod Jump

**Game type:** Low-gravity vertical jumper
**Core objective:** Jump between station pods and satellites in low gravity.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Space pod, satellite panel, floating crate, energy orb

### Hyper3D — primary level asset prompt
```text
Small futuristic space-station platform module, white/dark grey panels, blue glowing accents, rounded sci-fi low-poly design.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Dock

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Dock** using the same art direction as Space Pod Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Dock** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 8 low-gravity pod checkpoints.
- **Required 3D assets:** Space pod, satellite panel, floating crate, energy orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Pod Line

- **Difficulty:** Easy
- **Environment / visual:** **Pod Line** using the same art direction as Space Pod Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Pod Line** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 12 low-gravity pod checkpoints.
- **Required 3D assets:** Space pod, satellite panel, floating crate, energy orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Satellite Field

- **Difficulty:** Medium
- **Environment / visual:** **Satellite Field** using the same art direction as Space Pod Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Satellite Field** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 16 low-gravity pod checkpoints.
- **Required 3D assets:** Space pod, satellite panel, floating crate, energy orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Zero-G Gap

- **Difficulty:** Hard
- **Environment / visual:** **Zero-G Gap** using the same art direction as Space Pod Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Zero-G Gap** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 20 low-gravity pod checkpoints.
- **Required 3D assets:** Space pod, satellite panel, floating crate, energy orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Orbital Peak

- **Difficulty:** Challenge
- **Environment / visual:** **Orbital Peak** using the same art direction as Space Pod Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Orbital Peak** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach 24 low-gravity pod checkpoints.
- **Required 3D assets:** Space pod, satellite panel, floating crate, energy orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 11 — Roll Dash

**Game type:** 3-lane endless runner
**Core objective:** Dodge, jump and slide through a stylized city.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Street crate, barrier, cart, sign, coin

### Hyper3D — primary level asset prompt
```text
Stylized wooden street-market crate, warm brown wood, rounded edges, premium low-poly mobile-game obstacle.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Training Street

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Training Street** using the same art direction as Roll Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Training Street** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run 600 m or complete the stage while avoiding obstacle clusters.
- **Required 3D assets:** Street crate, barrier, cart, sign, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Market Lane

- **Difficulty:** Easy
- **Environment / visual:** **Market Lane** using the same art direction as Roll Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Market Lane** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run 900 m or complete the stage while avoiding obstacle clusters.
- **Required 3D assets:** Street crate, barrier, cart, sign, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Old Town

- **Difficulty:** Medium
- **Environment / visual:** **Old Town** using the same art direction as Roll Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Old Town** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run 1200 m or complete the stage while avoiding obstacle clusters.
- **Required 3D assets:** Street crate, barrier, cart, sign, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Night Street

- **Difficulty:** Hard
- **Environment / visual:** **Night Street** using the same art direction as Roll Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Night Street** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run 1500 m or complete the stage while avoiding obstacle clusters.
- **Required 3D assets:** Street crate, barrier, cart, sign, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Endless Dash

- **Difficulty:** Challenge
- **Environment / visual:** **Endless Dash** using the same art direction as Roll Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Endless Dash** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run 2000 m or complete the stage while avoiding obstacle clusters.
- **Required 3D assets:** Street crate, barrier, cart, sign, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 12 — Mine Tunnel Run

**Game type:** Tunnel runner
**Core objective:** Run through tunnels with barrels, pipes and water gaps.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard

### Hyper3D — primary level asset prompt
```text
Stylized rusty metal barrel, cylindrical shape, dark steel with subtle wear, rounded edges, low-poly optimized arcade-game prop.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Dry Tunnel

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Dry Tunnel** using the same art direction as Mine Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Dry Tunnel** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 4 tunnel segments with jumps/slides and collectible streaks.
- **Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Pipe Zone

- **Difficulty:** Easy
- **Environment / visual:** **Pipe Zone** using the same art direction as Mine Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Pipe Zone** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 5 tunnel segments with jumps/slides and collectible streaks.
- **Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Water Gaps

- **Difficulty:** Medium
- **Environment / visual:** **Water Gaps** using the same art direction as Mine Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Water Gaps** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 6 tunnel segments with jumps/slides and collectible streaks.
- **Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Tunnel

- **Difficulty:** Hard
- **Environment / visual:** **Fast Tunnel** using the same art direction as Mine Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Fast Tunnel** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 7 tunnel segments with jumps/slides and collectible streaks.
- **Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Deep Mine Sprint

- **Difficulty:** Challenge
- **Environment / visual:** **Deep Mine Sprint** using the same art direction as Mine Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Deep Mine Sprint** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 9 tunnel segments with jumps/slides and collectible streaks.
- **Required 3D assets:** Barrel, pipe, maintenance cart, puddle hazard. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 13 — Robot Factory Run

**Game type:** Factory endless runner
**Core objective:** Run across conveyors and dodge robotic arms and laser gates.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Robot arm, conveyor section, crate, laser gate

### Hyper3D — primary level asset prompt
```text
Stylized industrial robotic arm, compact mechanical design, orange and dark grey materials, clean low-poly geometry, no branding.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Assembly Start

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Assembly Start** using the same art direction as Robot Factory Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Assembly Start** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 60 sec across conveyors, robot arms and laser gates.
- **Required 3D assets:** Robot arm, conveyor section, crate, laser gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Conveyor Hall

- **Difficulty:** Easy
- **Environment / visual:** **Conveyor Hall** using the same art direction as Robot Factory Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Conveyor Hall** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 75 sec across conveyors, robot arms and laser gates.
- **Required 3D assets:** Robot arm, conveyor section, crate, laser gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Robot Arms

- **Difficulty:** Medium
- **Environment / visual:** **Robot Arms** using the same art direction as Robot Factory Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Robot Arms** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 90 sec across conveyors, robot arms and laser gates.
- **Required 3D assets:** Robot arm, conveyor section, crate, laser gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Laser Line

- **Difficulty:** Hard
- **Environment / visual:** **Laser Line** using the same art direction as Robot Factory Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Laser Line** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 105 sec across conveyors, robot arms and laser gates.
- **Required 3D assets:** Robot arm, conveyor section, crate, laser gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Factory Overdrive

- **Difficulty:** Challenge
- **Environment / visual:** **Factory Overdrive** using the same art direction as Robot Factory Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Factory Overdrive** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 120 sec across conveyors, robot arms and laser gates.
- **Required 3D assets:** Robot arm, conveyor section, crate, laser gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 14 — Dragon Cave Rush

**Game type:** Cave runner
**Core objective:** Race through a crystal cave while dodging rocks and collecting crystals.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart

### Hyper3D — primary level asset prompt
```text
Large stylized fantasy crystal cluster, faceted translucent blue crystals on a rock base, premium clean low-poly game prop.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Crystal Entry

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Crystal Entry** using the same art direction as Dragon Cave Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Crystal Entry** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the cave exit and collect 8 crystals.
- **Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Rockfall

- **Difficulty:** Easy
- **Environment / visual:** **Rockfall** using the same art direction as Dragon Cave Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Rockfall** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the cave exit and collect 12 crystals.
- **Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Glow Tunnel

- **Difficulty:** Medium
- **Environment / visual:** **Glow Tunnel** using the same art direction as Dragon Cave Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Glow Tunnel** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the cave exit and collect 16 crystals.
- **Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Deep Cave

- **Difficulty:** Hard
- **Environment / visual:** **Deep Cave** using the same art direction as Dragon Cave Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Deep Cave** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the cave exit and collect 20 crystals.
- **Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Crystal Rush

- **Difficulty:** Challenge
- **Environment / visual:** **Crystal Rush** using the same art direction as Dragon Cave Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Crystal Rush** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the cave exit and collect 25 crystals.
- **Required 3D assets:** Crystal cluster, cave rock, hanging crystal, mine cart. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 15 — Color City Sprint

**Game type:** Color-aware runner
**Core objective:** Collect only the active target color while running.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Recolorable gem, city barrier, colored gate, coin

### Hyper3D — primary level asset prompt
```text
Floating faceted energy gem collectible, clean stylized crystal shape, premium arcade-game asset, neutral material suitable for runtime recoloring.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Red/Blue

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Red/Blue** using the same art direction as Color City Sprint; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Red/Blue** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 15 correct-color gems while maintaining a color streak.
- **Required 3D assets:** Recolorable gem, city barrier, colored gate, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / visual:** **Three Colors** using the same art direction as Color City Sprint; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Three Colors** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 22 correct-color gems while maintaining a color streak.
- **Required 3D assets:** Recolorable gem, city barrier, colored gate, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Fast Switch

- **Difficulty:** Medium
- **Environment / visual:** **Fast Switch** using the same art direction as Color City Sprint; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Fast Switch** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 30 correct-color gems while maintaining a color streak.
- **Required 3D assets:** Recolorable gem, city barrier, colored gate, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Night Colors

- **Difficulty:** Hard
- **Environment / visual:** **Night Colors** using the same art direction as Color City Sprint; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Night Colors** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 40 correct-color gems while maintaining a color streak.
- **Required 3D assets:** Recolorable gem, city barrier, colored gate, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Rainbow Rush

- **Difficulty:** Challenge
- **Environment / visual:** **Rainbow Rush** using the same art direction as Color City Sprint; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Rainbow Rush** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 50 correct-color gems while maintaining a color streak.
- **Required 3D assets:** Recolorable gem, city barrier, colored gate, coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 16 — Temple Coin Rush

**Game type:** Temple runner
**Core objective:** Follow coin paths through temple gates and broken floors.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle

### Hyper3D — primary level asset prompt
```text
Ancient fantasy temple stone gate, original design, weathered sandstone, simple carvings without real-world religious symbols, premium stylized low-poly asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Temple Entry

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Temple Entry** using the same art direction as Temple Coin Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Temple Entry** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 20 coins and reach the temple finish.
- **Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Coin Hall

- **Difficulty:** Easy
- **Environment / visual:** **Coin Hall** using the same art direction as Temple Coin Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Coin Hall** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 30 coins and reach the temple finish.
- **Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Broken Floors

- **Difficulty:** Medium
- **Environment / visual:** **Broken Floors** using the same art direction as Temple Coin Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Broken Floors** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 40 coins and reach the temple finish.
- **Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Rolling Hazards

- **Difficulty:** Hard
- **Environment / visual:** **Rolling Hazards** using the same art direction as Temple Coin Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Rolling Hazards** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 50 coins and reach the temple finish.
- **Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Temple Sprint

- **Difficulty:** Challenge
- **Environment / visual:** **Temple Sprint** using the same art direction as Temple Coin Rush; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Temple Sprint** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 65 coins and reach the temple finish.
- **Required 3D assets:** Temple gate, coin, broken floor tile, stone obstacle. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 17 — Alien Lane Escape

**Game type:** Alien-planet runner
**Core objective:** Run through alien terrain while avoiding plants and meteor hazards.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Alien plant, crystal, meteor rock, alien pod

### Hyper3D — primary level asset prompt
```text
Original alien plant obstacle, twisting purple stem, cyan leaves, whimsical sci-fi design, premium low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Alien Meadow

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Alien Meadow** using the same art direction as Alien Lane Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Alien Meadow** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete the alien route and survive 4 hazard segments.
- **Required 3D assets:** Alien plant, crystal, meteor rock, alien pod. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Crystal Route

- **Difficulty:** Easy
- **Environment / visual:** **Crystal Route** using the same art direction as Alien Lane Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Crystal Route** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete the alien route and survive 5 hazard segments.
- **Required 3D assets:** Alien plant, crystal, meteor rock, alien pod. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Meteor Zone

- **Difficulty:** Medium
- **Environment / visual:** **Meteor Zone** using the same art direction as Alien Lane Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Meteor Zone** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete the alien route and survive 6 hazard segments.
- **Required 3D assets:** Alien plant, crystal, meteor rock, alien pod. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Glow Plants

- **Difficulty:** Hard
- **Environment / visual:** **Glow Plants** using the same art direction as Alien Lane Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Glow Plants** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete the alien route and survive 7 hazard segments.
- **Required 3D assets:** Alien plant, crystal, meteor rock, alien pod. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Planet Escape

- **Difficulty:** Challenge
- **Environment / visual:** **Planet Escape** using the same art direction as Alien Lane Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Planet Escape** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete the alien route and survive 9 hazard segments.
- **Required 3D assets:** Alien plant, crystal, meteor rock, alien pod. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 18 — Toy Room Run

**Game type:** Tiny-character runner
**Core objective:** Run across desks, books and toys in a giant room.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car

### Hyper3D — primary level asset prompt
```text
Set of oversized stylized toy building blocks, rounded cube shapes, bright surfaces, no letters or logos, premium low-poly game prop.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Desk Start

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Desk Start** using the same art direction as Toy Room Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Desk Start** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Cross 4 giant-room sections and reach the final toy chest.
- **Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Book Bridge

- **Difficulty:** Easy
- **Environment / visual:** **Book Bridge** using the same art direction as Toy Room Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Book Bridge** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Cross 5 giant-room sections and reach the final toy chest.
- **Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Keyboard Run

- **Difficulty:** Medium
- **Environment / visual:** **Keyboard Run** using the same art direction as Toy Room Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Keyboard Run** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Cross 6 giant-room sections and reach the final toy chest.
- **Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Toy Zone

- **Difficulty:** Hard
- **Environment / visual:** **Toy Zone** using the same art direction as Toy Room Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Toy Zone** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Cross 7 giant-room sections and reach the final toy chest.
- **Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Whole Room Sprint

- **Difficulty:** Challenge
- **Environment / visual:** **Whole Room Sprint** using the same art direction as Toy Room Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Whole Room Sprint** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Cross 9 giant-room sections and reach the final toy chest.
- **Required 3D assets:** Toy blocks, pencil, book stack, keyboard key, toy car. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 19 — Candy World Runner

**Game type:** Candy runner
**Core objective:** Run through a colorful candy world with edible-looking obstacles.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin

### Hyper3D — primary level asset prompt
```text
Large stylized spiral lollipop obstacle, oversized candy proportions, rounded glossy surface, colorful stripes, premium low-poly arcade asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Candy Lane

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Candy Lane** using the same art direction as Candy World Runner; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Candy Lane** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run through 4 candy sections and collect bonus sweets.
- **Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Cookie Road

- **Difficulty:** Easy
- **Environment / visual:** **Cookie Road** using the same art direction as Candy World Runner; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Cookie Road** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run through 5 candy sections and collect bonus sweets.
- **Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Jelly Jump

- **Difficulty:** Medium
- **Environment / visual:** **Jelly Jump** using the same art direction as Candy World Runner; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Jelly Jump** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run through 6 candy sections and collect bonus sweets.
- **Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Lollipop Forest

- **Difficulty:** Hard
- **Environment / visual:** **Lollipop Forest** using the same art direction as Candy World Runner; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Lollipop Forest** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run through 7 candy sections and collect bonus sweets.
- **Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Sugar Rush

- **Difficulty:** Challenge
- **Environment / visual:** **Sugar Rush** using the same art direction as Candy World Runner; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Sugar Rush** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Run through 9 candy sections and collect bonus sweets.
- **Required 3D assets:** Lollipop, jelly cube, cookie arch, candy coin. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 20 — Snow Slide Dash

**Game type:** Downhill slide runner
**Core objective:** Slide downhill, collect stars and dodge winter obstacles.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Pine tree, snow rock, star, ice gate

### Hyper3D — primary level asset prompt
```text
Stylized snow-covered pine-tree obstacle, compact triangular silhouette, layered rounded branches, thick snow caps, premium low-poly winter asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Snow Hill

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Snow Hill** using the same art direction as Snow Slide Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Snow Hill** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Finish the downhill route and collect 10 stars.
- **Required 3D assets:** Pine tree, snow rock, star, ice gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Pine Run

- **Difficulty:** Easy
- **Environment / visual:** **Pine Run** using the same art direction as Snow Slide Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Pine Run** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Finish the downhill route and collect 15 stars.
- **Required 3D assets:** Pine tree, snow rock, star, ice gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Ice Gates

- **Difficulty:** Medium
- **Environment / visual:** **Ice Gates** using the same art direction as Snow Slide Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Ice Gates** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Finish the downhill route and collect 20 stars.
- **Required 3D assets:** Pine tree, snow rock, star, ice gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Night Snow

- **Difficulty:** Hard
- **Environment / visual:** **Night Snow** using the same art direction as Snow Slide Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Night Snow** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Finish the downhill route and collect 25 stars.
- **Required 3D assets:** Pine tree, snow rock, star, ice gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Glacier Dash

- **Difficulty:** Challenge
- **Environment / visual:** **Glacier Dash** using the same art direction as Snow Slide Dash; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Glacier Dash** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Finish the downhill route and collect 30 stars.
- **Required 3D assets:** Pine tree, snow rock, star, ice gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 21 — Color Match Jump

**Game type:** Color survival platformer
**Core objective:** Move to the announced color before all other platforms fall.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Recolorable hex platform, countdown beacon

### Hyper3D — primary level asset prompt
```text
Simple floating hexagonal game platform, beveled edges, neutral white material for dynamic runtime recoloring, premium low-poly mobile-arcade style.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Two Colors

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Two Colors** using the same art direction as Color Match Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Two Colors** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 5 color-call rounds.
- **Required 3D assets:** Recolorable hex platform, countdown beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / visual:** **Three Colors** using the same art direction as Color Match Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Three Colors** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 8 color-call rounds.
- **Required 3D assets:** Recolorable hex platform, countdown beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Five Colors

- **Difficulty:** Medium
- **Environment / visual:** **Five Colors** using the same art direction as Color Match Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Five Colors** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 12 color-call rounds.
- **Required 3D assets:** Recolorable hex platform, countdown beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Countdown

- **Difficulty:** Hard
- **Environment / visual:** **Fast Countdown** using the same art direction as Color Match Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Fast Countdown** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 16 color-call rounds.
- **Required 3D assets:** Recolorable hex platform, countdown beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Color Master

- **Difficulty:** Challenge
- **Environment / visual:** **Color Master** using the same art direction as Color Match Jump; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Color Master** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 20 color-call rounds.
- **Required 3D assets:** Recolorable hex platform, countdown beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 22 — Switch Color Hero

**Game type:** Color-gate runner
**Core objective:** Switch hero color to pass through matching energy gates.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Recolorable color gate, energy pickup, checkpoint

### Hyper3D — primary level asset prompt
```text
Futuristic color gate, rounded rectangular arch, dark neutral frame, glowing energy field designed for runtime recoloring, clean low-poly asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Two Gates

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Two Gates** using the same art direction as Switch Color Hero; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Two Gates** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 8 color gates with correct hero color.
- **Required 3D assets:** Recolorable color gate, energy pickup, checkpoint. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / visual:** **Three Colors** using the same art direction as Switch Color Hero; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Three Colors** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 12 color gates with correct hero color.
- **Required 3D assets:** Recolorable color gate, energy pickup, checkpoint. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Fast Switching

- **Difficulty:** Medium
- **Environment / visual:** **Fast Switching** using the same art direction as Switch Color Hero; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Fast Switching** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 16 color gates with correct hero color.
- **Required 3D assets:** Recolorable color gate, energy pickup, checkpoint. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Mixed Obstacles

- **Difficulty:** Hard
- **Environment / visual:** **Mixed Obstacles** using the same art direction as Switch Color Hero; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Mixed Obstacles** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 20 color gates with correct hero color.
- **Required 3D assets:** Recolorable color gate, energy pickup, checkpoint. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Color Overdrive

- **Difficulty:** Challenge
- **Environment / visual:** **Color Overdrive** using the same art direction as Switch Color Hero; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Color Overdrive** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 25 color gates with correct hero color.
- **Required 3D assets:** Recolorable color gate, energy pickup, checkpoint. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 23 — Gem Collector 3D

**Game type:** Color collection arena
**Core objective:** Collect only gems matching the current hero color.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Recolorable gem, arena tile, score beacon

### Hyper3D — primary level asset prompt
```text
Floating faceted energy gem collectible, neutral material suitable for runtime recoloring, clean low-poly premium arcade-game asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Small Arena

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Small Arena** using the same art direction as Gem Collector 3D; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact color-mechanic arena/course in **Small Arena** using 2 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 20 correct-color gems before time expires.
- **Required 3D assets:** Recolorable gem, arena tile, score beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Long reaction window
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Moving Gems

- **Difficulty:** Easy
- **Environment / visual:** **Moving Gems** using the same art direction as Gem Collector 3D; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium color-mechanic arena/course in **Moving Gems** using 3 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 30 correct-color gems before time expires.
- **Required 3D assets:** Recolorable gem, arena tile, score beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** More colors
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Wrong-Gem Penalty

- **Difficulty:** Medium
- **Environment / visual:** **Wrong-Gem Penalty** using the same art direction as Gem Collector 3D; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium color-mechanic arena/course in **Wrong-Gem Penalty** using 4 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 40 correct-color gems before time expires.
- **Required 3D assets:** Recolorable gem, arena tile, score beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving/hidden color targets
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Spawn

- **Difficulty:** Hard
- **Environment / visual:** **Fast Spawn** using the same art direction as Gem Collector 3D; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large color-mechanic arena/course in **Fast Spawn** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 50 correct-color gems before time expires.
- **Required 3D assets:** Recolorable gem, arena tile, score beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Shorter countdown + decoys
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Gem Master

- **Difficulty:** Challenge
- **Environment / visual:** **Gem Master** using the same art direction as Gem Collector 3D; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense color-mechanic arena/course in **Gem Master** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect 65 correct-color gems before time expires.
- **Required 3D assets:** Recolorable gem, arena tile, score beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum color density and fastest reaction window
- **Timer / target:** 120 sec challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 24 — Portal Hop

**Game type:** Portal-selection arena
**Core objective:** Find and enter the correct colored portal under a countdown.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Portal frame, platform, color beacon

### Hyper3D — primary level asset prompt
```text
Stylized circular sci-fi portal frame, chunky rounded geometry, dark stone/metal, empty center for engine-generated glow, premium low-poly asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Two Portals

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Two Portals** using the same art direction as Portal Hop; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact color-mechanic arena/course in **Two Portals** using 2 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Enter 5 correct portals in sequence.
- **Required 3D assets:** Portal frame, platform, color beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Long reaction window
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Three Portals

- **Difficulty:** Easy
- **Environment / visual:** **Three Portals** using the same art direction as Portal Hop; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium color-mechanic arena/course in **Three Portals** using 3 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Enter 8 correct portals in sequence.
- **Required 3D assets:** Portal frame, platform, color beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** More colors
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Moving Portals

- **Difficulty:** Medium
- **Environment / visual:** **Moving Portals** using the same art direction as Portal Hop; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium color-mechanic arena/course in **Moving Portals** using 4 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Enter 12 correct portals in sequence.
- **Required 3D assets:** Portal frame, platform, color beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving/hidden color targets
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Countdown

- **Difficulty:** Hard
- **Environment / visual:** **Fast Countdown** using the same art direction as Portal Hop; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large color-mechanic arena/course in **Fast Countdown** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Enter 16 correct portals in sequence.
- **Required 3D assets:** Portal frame, platform, color beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Shorter countdown + decoys
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Portal Master

- **Difficulty:** Challenge
- **Environment / visual:** **Portal Master** using the same art direction as Portal Hop; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense color-mechanic arena/course in **Portal Master** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Enter 20 correct portals in sequence.
- **Required 3D assets:** Portal frame, platform, color beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum color density and fastest reaction window
- **Timer / target:** 120 sec challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 25 — Paint the Platforms

**Game type:** Area-painting challenge
**Core objective:** Touch platforms to paint them in the hero color and reach coverage target.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Recolorable floor tile, paint pickup, arena wall

### Hyper3D — primary level asset prompt
```text
Square modular arena floor tile with softly beveled edges, neutral pale-grey material for runtime recoloring, premium clean low-poly geometry.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — 25% Goal

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **25% Goal** using the same art direction as Paint the Platforms; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact arcade layout themed as **25% Goal** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Paint 30% of the playable arena.
- **Required 3D assets:** Recolorable floor tile, paint pickup, arena wall. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Low
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — 40% Goal

- **Difficulty:** Easy
- **Environment / visual:** **40% Goal** using the same art direction as Paint the Platforms; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade layout themed as **40% Goal** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Paint 40% of the playable arena.
- **Required 3D assets:** Recolorable floor tile, paint pickup, arena wall. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Low–Medium
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Moving Tiles

- **Difficulty:** Medium
- **Environment / visual:** **Moving Tiles** using the same art direction as Paint the Platforms; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium arcade layout themed as **Moving Tiles** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Paint 50% of the playable arena.
- **Required 3D assets:** Recolorable floor tile, paint pickup, arena wall. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Medium
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Time Attack

- **Difficulty:** Hard
- **Environment / visual:** **Time Attack** using the same art direction as Paint the Platforms; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large arcade layout themed as **Time Attack** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Paint 65% of the playable arena.
- **Required 3D assets:** Recolorable floor tile, paint pickup, arena wall. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** High
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — 80% Master

- **Difficulty:** Challenge
- **Environment / visual:** **80% Master** using the same art direction as Paint the Platforms; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade layout themed as **80% Master** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Paint 80% of the playable arena.
- **Required 3D assets:** Recolorable floor tile, paint pickup, arena wall. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Mixed challenge
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 26 — Color Arena Survival

**Game type:** Round-based survival
**Core objective:** Stand on the announced color before all wrong-color tiles disappear.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Recolorable floor tile, color beacon, safe marker

### Hyper3D — primary level asset prompt
```text
Square modular arena tile, beveled edges, neutral material designed for runtime color changes, clean premium low-poly asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Slow Rounds

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Slow Rounds** using the same art direction as Color Arena Survival; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact arcade layout themed as **Slow Rounds** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 5 color-floor rounds.
- **Required 3D assets:** Recolorable floor tile, color beacon, safe marker. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Low
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / visual:** **Three Colors** using the same art direction as Color Arena Survival; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade layout themed as **Three Colors** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 8 color-floor rounds.
- **Required 3D assets:** Recolorable floor tile, color beacon, safe marker. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Low–Medium
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Five Colors

- **Difficulty:** Medium
- **Environment / visual:** **Five Colors** using the same art direction as Color Arena Survival; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium arcade layout themed as **Five Colors** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 12 color-floor rounds.
- **Required 3D assets:** Recolorable floor tile, color beacon, safe marker. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Medium
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Rounds

- **Difficulty:** Hard
- **Environment / visual:** **Fast Rounds** using the same art direction as Color Arena Survival; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large arcade layout themed as **Fast Rounds** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 16 color-floor rounds.
- **Required 3D assets:** Recolorable floor tile, color beacon, safe marker. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** High
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Survival Master

- **Difficulty:** Challenge
- **Environment / visual:** **Survival Master** using the same art direction as Color Arena Survival; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade layout themed as **Survival Master** with clear start, objective sequence and finish/result zone.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Survive 20 color-floor rounds.
- **Required 3D assets:** Recolorable floor tile, color beacon, safe marker. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Mixed challenge
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 27 — Ring Jump Challenge

**Game type:** Forward ring-run
**Core objective:** Pass through rings matching the active color and build a streak.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Required 3D assets:** Recolorable ring, star, speed boost

### Hyper3D — primary level asset prompt
```text
Large floating circular checkpoint ring, thick rounded tube geometry, neutral white material for dynamic recoloring, clean premium low-poly game asset.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Wide Rings

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Wide Rings** using the same art direction as Ring Jump Challenge; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact forward course in **Wide Rings** split into 3 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 10 correct rings and build a perfect streak.
- **Required 3D assets:** Recolorable ring, star, speed boost. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Static obstacles
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Moving Rings

- **Difficulty:** Easy
- **Environment / visual:** **Moving Rings** using the same art direction as Ring Jump Challenge; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward course in **Moving Rings** split into 4 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 15 correct rings and build a perfect streak.
- **Required 3D assets:** Recolorable ring, star, speed boost. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Two obstacle types
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Color Rings

- **Difficulty:** Medium
- **Environment / visual:** **Color Rings** using the same art direction as Ring Jump Challenge; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium forward course in **Color Rings** split into 5 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 20 correct rings and build a perfect streak.
- **Required 3D assets:** Recolorable ring, star, speed boost. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Route

- **Difficulty:** Hard
- **Environment / visual:** **Fast Route** using the same art direction as Ring Jump Challenge; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large forward course in **Fast Route** split into 6 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 25 correct rings and build a perfect streak.
- **Required 3D assets:** Recolorable ring, star, speed boost. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Higher speed + mixed hazards
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed and reduce recovery space.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Perfect Streak

- **Difficulty:** Challenge
- **Environment / visual:** **Perfect Streak** using the same art direction as Ring Jump Challenge; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Perfect Streak** split into 8 obstacle segments, collectible lines and safe recovery pockets.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Pass 30 correct rings and build a perfect streak.
- **Required 3D assets:** Recolorable ring, star, speed boost. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum speed with short recovery windows
- **Timer / target:** 120 sec / endless score option
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 28 — Crystal Tower

**Game type:** Memory + vertical climb
**Core objective:** Collect colored crystals in the shown sequence while climbing.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Crystal, platform, sequence beacon

### Hyper3D — primary level asset prompt
```text
Stylized faceted crystal collectible, neutral base material suitable for runtime recoloring, premium low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — 3-Color Sequence

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **3-Color Sequence** using the same art direction as Crystal Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **3-Color Sequence** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 3 color sequences while climbing the tower.
- **Required 3D assets:** Crystal, platform, sequence beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Wide safe platforms
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach jump distance and safe landings.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — 4 Colors

- **Difficulty:** Easy
- **Environment / visual:** **4 Colors** using the same art direction as Crystal Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **4 Colors** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 4 color sequences while climbing the tower.
- **Required 3D assets:** Crystal, platform, sequence beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving platforms
- **Timer / target:** 120 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add moving platforms or wider gaps.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — 5 Colors

- **Difficulty:** Medium
- **Environment / visual:** **5 Colors** using the same art direction as Crystal Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **5 Colors** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 5 color sequences while climbing the tower.
- **Required 3D assets:** Crystal, platform, sequence beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving + disappearing/slippery surfaces
- **Timer / target:** 150 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Moving Crystals

- **Difficulty:** Hard
- **Environment / visual:** **Moving Crystals** using the same art direction as Crystal Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Moving Crystals** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 6 color sequences while climbing the tower.
- **Required 3D assets:** Crystal, platform, sequence beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Faster hazards and tighter gaps
- **Timer / target:** 180 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Memory Tower

- **Difficulty:** Challenge
- **Environment / visual:** **Memory Tower** using the same art direction as Crystal Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Memory Tower** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Complete 8 color sequences while climbing the tower.
- **Required 3D assets:** Crystal, platform, sequence beacon. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** All platform hazards combined
- **Timer / target:** Best-time / survival challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-speed mastery route using every platform type.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 29 — Energy Core Hunt

**Game type:** Third-person mission arena
**Core objective:** Collect a requested combination of colored energy cores.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Energy core, arena crate, beacon, gate

### Hyper3D — primary level asset prompt
```text
Small futuristic energy-core collectible, glowing spherical center inside curved metallic supports, neutral material for runtime color changes.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Simple Hunt

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Simple Hunt** using the same art direction as Energy Core Hunt; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact color-mechanic arena/course in **Simple Hunt** using 2 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect the requested mix of 6 energy cores.
- **Required 3D assets:** Energy core, arena crate, beacon, gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Long reaction window
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Mixed Colors

- **Difficulty:** Easy
- **Environment / visual:** **Mixed Colors** using the same art direction as Energy Core Hunt; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium color-mechanic arena/course in **Mixed Colors** using 3 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect the requested mix of 9 energy cores.
- **Required 3D assets:** Energy core, arena crate, beacon, gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** More colors
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Larger Arena

- **Difficulty:** Medium
- **Environment / visual:** **Larger Arena** using the same art direction as Energy Core Hunt; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium color-mechanic arena/course in **Larger Arena** using 4 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect the requested mix of 12 energy cores.
- **Required 3D assets:** Energy core, arena crate, beacon, gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving/hidden color targets
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Moving Cores

- **Difficulty:** Hard
- **Environment / visual:** **Moving Cores** using the same art direction as Energy Core Hunt; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large color-mechanic arena/course in **Moving Cores** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect the requested mix of 15 energy cores.
- **Required 3D assets:** Energy core, arena crate, beacon, gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Shorter countdown + decoys
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Core Master

- **Difficulty:** Challenge
- **Environment / visual:** **Core Master** using the same art direction as Energy Core Hunt; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense color-mechanic arena/course in **Core Master** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Collect the requested mix of 20 energy cores.
- **Required 3D assets:** Energy core, arena crate, beacon, gate. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum color density and fastest reaction window
- **Timer / target:** 120 sec challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

# GAME 30 — Color Boss Tower

**Game type:** Boss challenge
**Core objective:** Climb the tower, switch to the boss color weakness and strike during openings.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb

### Hyper3D — primary level asset prompt
```text
Original giant stone training guardian, broad stylized silhouette, rounded stone body, glowing circular chest core, no weapons, medium-low polygon count, suitable for rigging; chest core recolorable at runtime.
```

### Character use
- Same Color Shell Hero mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Training Guardian

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Training Guardian** using the same art direction as Color Boss Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact color-mechanic arena/course in **Training Guardian** using 2 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb the tower and complete 2 boss vulnerability cycles.
- **Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Long reaction window
- **Timer / target:** 60 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Teach the primary interaction.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 2 — Two Colors

- **Difficulty:** Easy
- **Environment / visual:** **Two Colors** using the same art direction as Color Boss Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium color-mechanic arena/course in **Two Colors** using 3 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb the tower and complete 3 boss vulnerability cycles.
- **Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** More colors
- **Timer / target:** 75 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Add one new rule.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 3 — Three Colors

- **Difficulty:** Medium
- **Environment / visual:** **Three Colors** using the same art direction as Color Boss Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium color-mechanic arena/course in **Three Colors** using 4 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb the tower and complete 4 boss vulnerability cycles.
- **Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Moving/hidden color targets
- **Timer / target:** 90 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Combine two mechanics.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 4 — Fast Switch Boss

- **Difficulty:** Hard
- **Environment / visual:** **Fast Switch Boss** using the same art direction as Color Boss Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large color-mechanic arena/course in **Fast Switch Boss** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb the tower and complete 5 boss vulnerability cycles.
- **Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Shorter countdown + decoys
- **Timer / target:** 105 sec
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** Increase speed/complexity.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

### Level 5 — Grand Color Guardian

- **Difficulty:** Challenge
- **Environment / visual:** **Grand Color Guardian** using the same art direction as Color Boss Tower; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense color-mechanic arena/course in **Grand Color Guardian** using 5 active colors and progressively shorter reaction windows.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Climb the tower and complete 6 boss vulnerability cycles.
- **Required 3D assets:** Stone guardian boss, energy core, tower platform, hazard orb. Recolor neutral assets at runtime whenever possible.
- **Hazards / pressure:** Maximum color density and fastest reaction window
- **Timer / target:** 120 sec challenge
- **Hero abilities:** Red Dash, Blue Double Jump, Green Shield, Yellow Magnet, Purple Phase; tune or temporarily restrict any ability that would trivialize this level.
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** Complete the required objective/round target and remain in a valid playable state.
- **Lose condition:** Fall/leave the playable area, lose all lives, or fail the timer/round requirement.
- **Progression:** High-score mastery challenge.
- **Replay goal:** Beat personal best time/height/score and improve collectible or combo performance.

---

---

# ADDITIONAL 20 COLOR ROLL HEROES GAMES
## Games 31–50

These 20 games use the same Color Shell Hero characters, rig, animations, five-color abilities and shared arcade systems.

# GAME 31 — Wall Run Temple

**Game type:** Wall-run platformer
**Core objective:** Run along walls, jump between columns and reach the temple exit.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb

### Hyper3D — primary asset prompt
```text
Stylized fantasy temple wall module designed for wall-running gameplay, clean stone surfaces, strong readable ledges, premium low-poly browser game asset, neutral material, no text.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Training Wall

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Training Wall** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Training Wall**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 core challenge interactions and reach the finish.
- **3D objects used:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Double Wall

- **Difficulty:** Easy
- **Environment / look:** **Double Wall** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Double Wall**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 core challenge interactions and reach the finish.
- **3D objects used:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Column Hall

- **Difficulty:** Medium
- **Environment / look:** **Column Hall** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Column Hall**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 core challenge interactions and reach the finish.
- **3D objects used:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Broken Temple

- **Difficulty:** Hard
- **Environment / look:** **Broken Temple** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Broken Temple**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 core challenge interactions and reach the finish.
- **3D objects used:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Master Wall Run

- **Difficulty:** Master Challenge
- **Environment / look:** **Master Wall Run** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Master Wall Run**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 core challenge interactions and reach the finish.
- **3D objects used:** Temple wall module, wall-run marker, stone column, gap platform, collectible orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 32 — Plate Bounce Arena

**Game type:** Physics bounce arena
**Core objective:** Use shell-bounce pads to chain jumps and reach score zones.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Bounce pad, angled ramp, score ring, arena block, star collectible

### Hyper3D — primary asset prompt
```text
Stylized circular bounce pad for a premium arcade platformer, soft rubber-like surface, thick beveled rim, neutral material for runtime recoloring, low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Single Bounce

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Single Bounce** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Single Bounce**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 core challenge interactions and reach the finish.
- **3D objects used:** Bounce pad, angled ramp, score ring, arena block, star collectible. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Combo Pads

- **Difficulty:** Easy
- **Environment / look:** **Combo Pads** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Combo Pads**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 core challenge interactions and reach the finish.
- **3D objects used:** Bounce pad, angled ramp, score ring, arena block, star collectible. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Pads

- **Difficulty:** Medium
- **Environment / look:** **Moving Pads** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Moving Pads**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 core challenge interactions and reach the finish.
- **3D objects used:** Bounce pad, angled ramp, score ring, arena block, star collectible. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Vertical Bounce

- **Difficulty:** Hard
- **Environment / look:** **Vertical Bounce** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Vertical Bounce**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 core challenge interactions and reach the finish.
- **3D objects used:** Bounce pad, angled ramp, score ring, arena block, star collectible. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Infinite Bounce

- **Difficulty:** Master Challenge
- **Environment / look:** **Infinite Bounce** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Infinite Bounce**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 core challenge interactions and reach the finish.
- **3D objects used:** Bounce pad, angled ramp, score ring, arena block, star collectible. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 33 — Mirror Dash

**Game type:** Runner memory challenge
**Core objective:** Follow a short route preview and then repeat it correctly at speed.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block

### Hyper3D — primary asset prompt
```text
Stylized glowing route marker tile for a memory-based arcade runner, clear directional symbol area without text, neutral material for runtime color/emissive changes, low-poly game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — 3-Step Route

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **3-Step Route** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **3-Step Route**, with 3 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Repeat 3 memorized route actions correctly.
- **3D objects used:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Low speed / wide margins
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — 5-Step Route

- **Difficulty:** Easy
- **Environment / look:** **5-Step Route** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **5-Step Route**, with 4 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Repeat 5 memorized route actions correctly.
- **3D objects used:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moderate speed
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Split Path

- **Difficulty:** Medium
- **Environment / look:** **Split Path** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Split Path**, with 5 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Repeat 7 memorized route actions correctly.
- **3D objects used:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Memory

- **Difficulty:** Hard
- **Environment / look:** **Fast Memory** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large forward route themed as **Fast Memory**, with 6 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Repeat 9 memorized route actions correctly.
- **3D objects used:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** High speed + tighter timing
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Clone Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Clone Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Clone Master**, with 8 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Repeat 12 memorized route actions correctly.
- **3D objects used:** Memory gate, arrow tile, route marker, mirror copy marker, obstacle block. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Maximum speed + mixed hazards
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 34 — Spin Pole Climb

**Game type:** Vertical rotating-platform game
**Core objective:** Jump between rotating poles and platforms while climbing upward.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin

### Hyper3D — primary asset prompt
```text
Stylized vertical rotating pole obstacle with rounded ends and simple mounting hub, premium mobile arcade asset, clean low-poly geometry, neutral material.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Slow Poles

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Slow Poles** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact arcade arena/course themed as **Slow Poles**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 core challenge interactions and reach the finish.
- **3D objects used:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Twin Poles

- **Difficulty:** Easy
- **Environment / look:** **Twin Poles** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade arena/course themed as **Twin Poles**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 core challenge interactions and reach the finish.
- **3D objects used:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Mixed Rotation

- **Difficulty:** Medium
- **Environment / look:** **Mixed Rotation** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium arcade arena/course themed as **Mixed Rotation**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 core challenge interactions and reach the finish.
- **3D objects used:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Tower

- **Difficulty:** Hard
- **Environment / look:** **Fast Tower** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large arcade arena/course themed as **Fast Tower**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 core challenge interactions and reach the finish.
- **3D objects used:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Spin Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Spin Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Spin Master**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 core challenge interactions and reach the finish.
- **3D objects used:** Rotating pole, circular platform, grip ledge, checkpoint disc, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 35 — Color Rail Grind

**Game type:** Rail-grind runner
**Core objective:** Grind on rails and switch to the matching color rail at intersections.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Rail segment, rail switch, colored junction, ring collectible, support pillar

### Hyper3D — primary asset prompt
```text
Stylized arcade grind rail segment, thick rounded metal rail on simple supports, neutral material for runtime recoloring, premium low-poly browser game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Two Rails

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Two Rails** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Two Rails**, with 3 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 rail sections and choose the correct color junctions.
- **3D objects used:** Rail segment, rail switch, colored junction, ring collectible, support pillar. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Low speed / wide margins
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / look:** **Three Colors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Three Colors**, with 4 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 rail sections and choose the correct color junctions.
- **3D objects used:** Rail segment, rail switch, colored junction, ring collectible, support pillar. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moderate speed
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Rail Crossings

- **Difficulty:** Medium
- **Environment / look:** **Rail Crossings** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Rail Crossings**, with 5 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 rail sections and choose the correct color junctions.
- **3D objects used:** Rail segment, rail switch, colored junction, ring collectible, support pillar. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Switches

- **Difficulty:** Hard
- **Environment / look:** **Fast Switches** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large forward route themed as **Fast Switches**, with 6 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 rail sections and choose the correct color junctions.
- **3D objects used:** Rail segment, rail switch, colored junction, ring collectible, support pillar. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** High speed + tighter timing
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Rainbow Grind

- **Difficulty:** Master Challenge
- **Environment / look:** **Rainbow Grind** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Rainbow Grind**, with 8 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 25 rail sections and choose the correct color junctions.
- **3D objects used:** Rail segment, rail switch, colored junction, ring collectible, support pillar. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Maximum speed + mixed hazards
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 36 — Temple Gong Timing

**Game type:** Rhythm timing challenge
**Core objective:** Hit target gongs in the correct timing window while moving through the arena.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows for position where needed; mouse/tap or action button for timing/target input.
**Required 3D assets:** Temple gong, striker post, timing ring, platform, lantern

### Hyper3D — primary asset prompt
```text
Stylized fantasy temple gong on a simple wooden frame, large round bronze disc, no real-world religious symbols, clean premium low-poly game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Slow Beat

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Slow Beat** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact arcade arena/course themed as **Slow Beat**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 8 timing targets with at least 70% accuracy.
- **3D objects used:** Temple gong, striker post, timing ring, platform, lantern. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Alternating Gongs

- **Difficulty:** Easy
- **Environment / look:** **Alternating Gongs** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade arena/course themed as **Alternating Gongs**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 12 timing targets with at least 75% accuracy.
- **3D objects used:** Temple gong, striker post, timing ring, platform, lantern. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Targets

- **Difficulty:** Medium
- **Environment / look:** **Moving Targets** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium arcade arena/course themed as **Moving Targets**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 16 timing targets with at least 80% accuracy.
- **3D objects used:** Temple gong, striker post, timing ring, platform, lantern. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Rhythm

- **Difficulty:** Hard
- **Environment / look:** **Fast Rhythm** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large arcade arena/course themed as **Fast Rhythm**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 20 timing targets with at least 85% accuracy.
- **3D objects used:** Temple gong, striker post, timing ring, platform, lantern. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Perfect Timing

- **Difficulty:** Master Challenge
- **Environment / look:** **Perfect Timing** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Perfect Timing**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 25 timing targets with at least 90% accuracy.
- **3D objects used:** Temple gong, striker post, timing ring, platform, lantern. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 37 — Plate Surf

**Game type:** Downhill board/plate surf
**Core objective:** Surf downhill, collect energy and pass through gates.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Surf shell board, slope gate, energy orb, ramp, rock obstacle

### Hyper3D — primary asset prompt
```text
Stylized armadillo-shell-inspired surf board for an original arcade game, rounded aerodynamic shape, neutral premium material, no franchise references, low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Training Slope

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Training Slope** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Training Slope**, with 3 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Finish the downhill course and collect 10 energy orbs.
- **3D objects used:** Surf shell board, slope gate, energy orb, ramp, rock obstacle. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Low speed / wide margins
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Rocky Path

- **Difficulty:** Easy
- **Environment / look:** **Rocky Path** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Rocky Path**, with 4 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Finish the downhill course and collect 15 energy orbs.
- **3D objects used:** Surf shell board, slope gate, energy orb, ramp, rock obstacle. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moderate speed
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Jump Gates

- **Difficulty:** Medium
- **Environment / look:** **Jump Gates** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Jump Gates**, with 5 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Finish the downhill course and collect 20 energy orbs.
- **3D objects used:** Surf shell board, slope gate, energy orb, ramp, rock obstacle. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Speed Canyon

- **Difficulty:** Hard
- **Environment / look:** **Speed Canyon** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large forward route themed as **Speed Canyon**, with 6 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Finish the downhill course and collect 25 energy orbs.
- **3D objects used:** Surf shell board, slope gate, energy orb, ramp, rock obstacle. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** High speed + tighter timing
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Plate Surf Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Plate Surf Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Plate Surf Master**, with 8 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Finish the downhill course and collect 30 energy orbs.
- **3D objects used:** Surf shell board, slope gate, energy orb, ramp, rock obstacle. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Maximum speed + mixed hazards
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 38 — Laser Maze Run

**Game type:** Precision maze challenge
**Core objective:** Navigate through a laser maze using timing, jumps and phase ability windows.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action to activate switches; mobile uses virtual stick + action.
**Required 3D assets:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile

### Hyper3D — primary asset prompt
```text
Compact futuristic laser emitter device for a stylized arcade game, dark graphite body with neutral emissive strip, rounded sci-fi design, low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Static Lasers

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Static Lasers** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact puzzle layout themed as **Static Lasers**, with 2 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 3 laser zones and reach the exit.
- **3D objects used:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Long reaction windows
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Moving Lasers

- **Difficulty:** Easy
- **Environment / look:** **Moving Lasers** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium puzzle layout themed as **Moving Lasers**, with 3 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 4 laser zones and reach the exit.
- **3D objects used:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** One moving/timed element
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Cross Grid

- **Difficulty:** Medium
- **Environment / look:** **Cross Grid** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium puzzle layout themed as **Cross Grid**, with 4 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 5 laser zones and reach the exit.
- **3D objects used:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Multiple linked elements
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Maze

- **Difficulty:** Hard
- **Environment / look:** **Fast Maze** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large puzzle layout themed as **Fast Maze**, with 5 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 6 laser zones and reach the exit.
- **3D objects used:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Shorter timers + decoys
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Laser Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Laser Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense puzzle layout themed as **Laser Master**, with 6 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 8 laser zones and reach the exit.
- **3D objects used:** Laser emitter, laser beam source frame, moving barrier, checkpoint pad, floor tile. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All puzzle mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 39 — Color Bridge Builder

**Game type:** Light puzzle platformer
**Core objective:** Activate color switches to create the correct bridge path.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action to activate switches; mobile uses virtual stick + action.
**Required 3D assets:** Bridge tile, color switch, bridge anchor, gap platform, energy node

### Hyper3D — primary asset prompt
```text
Modular floating bridge tile for a color puzzle game, beveled square platform, neutral material designed for runtime recoloring, premium low-poly browser game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Two Switches

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Two Switches** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Two Switches**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 2 linked puzzle objectives and open the final route.
- **3D objects used:** Bridge tile, color switch, bridge anchor, gap platform, energy node. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Long reaction windows
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / look:** **Three Colors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Three Colors**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 3 linked puzzle objectives and open the final route.
- **3D objects used:** Bridge tile, color switch, bridge anchor, gap platform, energy node. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** One moving/timed element
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Split Bridge

- **Difficulty:** Medium
- **Environment / look:** **Split Bridge** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Split Bridge**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 4 linked puzzle objectives and open the final route.
- **3D objects used:** Bridge tile, color switch, bridge anchor, gap platform, energy node. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Multiple linked elements
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Timed Bridge

- **Difficulty:** Hard
- **Environment / look:** **Timed Bridge** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Timed Bridge**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 linked puzzle objectives and open the final route.
- **3D objects used:** Bridge tile, color switch, bridge anchor, gap platform, energy node. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Shorter timers + decoys
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Bridge Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Bridge Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Bridge Master**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 6 linked puzzle objectives and open the final route.
- **3D objects used:** Bridge tile, color switch, bridge anchor, gap platform, energy node. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All puzzle mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 40 — Disc Target Throw

**Game type:** Arcade target challenge
**Core objective:** Throw harmless training discs at targets to build accuracy combos.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows for position where needed; mouse/tap or action button for timing/target input.
**Required 3D assets:** Training disc, circular target, moving target rail, score marker, arena wall

### Hyper3D — primary asset prompt
```text
Stylized harmless training throwing disc and circular practice target for a premium arcade game, rounded safe shapes, no weapon realism, low-poly game-ready design.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Static Targets

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Static Targets** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact arcade arena/course themed as **Static Targets**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 10 training targets while maintaining an accuracy combo.
- **3D objects used:** Training disc, circular target, moving target rail, score marker, arena wall. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Moving Targets

- **Difficulty:** Easy
- **Environment / look:** **Moving Targets** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade arena/course themed as **Moving Targets**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 15 training targets while maintaining an accuracy combo.
- **3D objects used:** Training disc, circular target, moving target rail, score marker, arena wall. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Color Targets

- **Difficulty:** Medium
- **Environment / look:** **Color Targets** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium arcade arena/course themed as **Color Targets**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 20 training targets while maintaining an accuracy combo.
- **3D objects used:** Training disc, circular target, moving target rail, score marker, arena wall. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Combo

- **Difficulty:** Hard
- **Environment / look:** **Fast Combo** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large arcade arena/course themed as **Fast Combo**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 25 training targets while maintaining an accuracy combo.
- **3D objects used:** Training disc, circular target, moving target rail, score marker, arena wall. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Accuracy Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Accuracy Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Accuracy Master**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Hit 30 training targets while maintaining an accuracy combo.
- **3D objects used:** Training disc, circular target, moving target rail, score marker, arena wall. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 41 — Wind Tunnel Escape

**Game type:** Air-current platformer
**Core objective:** Use wind streams to move between floating platforms and reach the exit.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Wind fan, air vent, floating platform, wind ring, checkpoint

### Hyper3D — primary asset prompt
```text
Stylized oversized air fan device for an arcade platform game, rounded protective housing, simple broad blades, clean neutral materials, premium low-poly game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Gentle Wind

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Gentle Wind** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Gentle Wind**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 6 wind-assisted platform sections.
- **3D objects used:** Wind fan, air vent, floating platform, wind ring, checkpoint. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Cross Wind

- **Difficulty:** Easy
- **Environment / look:** **Cross Wind** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Cross Wind**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 8 wind-assisted platform sections.
- **3D objects used:** Wind fan, air vent, floating platform, wind ring, checkpoint. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Vertical Lift

- **Difficulty:** Medium
- **Environment / look:** **Vertical Lift** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Vertical Lift**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 10 wind-assisted platform sections.
- **3D objects used:** Wind fan, air vent, floating platform, wind ring, checkpoint. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Moving Fans

- **Difficulty:** Hard
- **Environment / look:** **Moving Fans** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Moving Fans**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 12 wind-assisted platform sections.
- **3D objects used:** Wind fan, air vent, floating platform, wind ring, checkpoint. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Storm Tunnel

- **Difficulty:** Master Challenge
- **Environment / look:** **Storm Tunnel** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Storm Tunnel**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 15 wind-assisted platform sections.
- **3D objects used:** Wind fan, air vent, floating platform, wind ring, checkpoint. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 42 — Magnet Coin Lab

**Game type:** Collectible puzzle
**Core objective:** Use polarity/color zones to pull the correct coins through small obstacle setups.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action to activate switches; mobile uses virtual stick + action.
**Required 3D assets:** Magnet pad, coin, polarity gate, metal block, lab platform

### Hyper3D — primary asset prompt
```text
Stylized futuristic magnet pad, circular floor device with clean segmented rings, neutral material and emissive area for runtime recoloring, premium low-poly asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Basic Magnet

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Basic Magnet** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact puzzle layout themed as **Basic Magnet**, with 2 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 2 linked puzzle objectives and open the final route.
- **3D objects used:** Magnet pad, coin, polarity gate, metal block, lab platform. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Long reaction windows
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Two Poles

- **Difficulty:** Easy
- **Environment / look:** **Two Poles** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium puzzle layout themed as **Two Poles**, with 3 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 3 linked puzzle objectives and open the final route.
- **3D objects used:** Magnet pad, coin, polarity gate, metal block, lab platform. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** One moving/timed element
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Blocks

- **Difficulty:** Medium
- **Environment / look:** **Moving Blocks** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium puzzle layout themed as **Moving Blocks**, with 4 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 4 linked puzzle objectives and open the final route.
- **3D objects used:** Magnet pad, coin, polarity gate, metal block, lab platform. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Multiple linked elements
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Color Polarity

- **Difficulty:** Hard
- **Environment / look:** **Color Polarity** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large puzzle layout themed as **Color Polarity**, with 5 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 linked puzzle objectives and open the final route.
- **3D objects used:** Magnet pad, coin, polarity gate, metal block, lab platform. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Shorter timers + decoys
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Magnet Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Magnet Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense puzzle layout themed as **Magnet Master**, with 6 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 6 linked puzzle objectives and open the final route.
- **3D objects used:** Magnet pad, coin, polarity gate, metal block, lab platform. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All puzzle mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 43 — Roll Cannon Jump

**Game type:** Launch trajectory platformer
**Core objective:** Launch the hero from safe arcade cannons between platforms and land accurately.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Arcade launch cannon, landing pad, target ring, floating platform, star

### Hyper3D — primary asset prompt
```text
Stylized non-realistic arcade launch cannon for character launching, oversized rounded barrel, toy-like safe proportions, premium low-poly game asset, no weapon realism.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Short Launch

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Short Launch** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Short Launch**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 core challenge interactions and reach the finish.
- **3D objects used:** Arcade launch cannon, landing pad, target ring, floating platform, star. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Angle Practice

- **Difficulty:** Easy
- **Environment / look:** **Angle Practice** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Angle Practice**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 core challenge interactions and reach the finish.
- **3D objects used:** Arcade launch cannon, landing pad, target ring, floating platform, star. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Pads

- **Difficulty:** Medium
- **Environment / look:** **Moving Pads** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Moving Pads**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 core challenge interactions and reach the finish.
- **3D objects used:** Arcade launch cannon, landing pad, target ring, floating platform, star. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Long Distance

- **Difficulty:** Hard
- **Environment / look:** **Long Distance** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Long Distance**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 core challenge interactions and reach the finish.
- **3D objects used:** Arcade launch cannon, landing pad, target ring, floating platform, star. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Precision Cannon

- **Difficulty:** Master Challenge
- **Environment / look:** **Precision Cannon** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Precision Cannon**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 core challenge interactions and reach the finish.
- **3D objects used:** Arcade launch cannon, landing pad, target ring, floating platform, star. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 44 — Crystal Cave Switch

**Game type:** Color-switch puzzle
**Core objective:** Activate crystals in the correct color order to open each cave gate.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action to activate switches; mobile uses virtual stick + action.
**Required 3D assets:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon

### Hyper3D — primary asset prompt
```text
Stylized crystal switch pedestal for a fantasy cave puzzle, faceted crystal mounted on rounded stone base, neutral crystal material for runtime recoloring, low-poly game asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Two Crystals

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Two Crystals** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact puzzle layout themed as **Two Crystals**, with 2 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 2 linked puzzle objectives and open the final route.
- **3D objects used:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Long reaction windows
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Three Sequence

- **Difficulty:** Easy
- **Environment / look:** **Three Sequence** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium puzzle layout themed as **Three Sequence**, with 3 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 3 linked puzzle objectives and open the final route.
- **3D objects used:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** One moving/timed element
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Hidden Crystal

- **Difficulty:** Medium
- **Environment / look:** **Hidden Crystal** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium puzzle layout themed as **Hidden Crystal**, with 4 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 4 linked puzzle objectives and open the final route.
- **3D objects used:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Multiple linked elements
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Timed Sequence

- **Difficulty:** Hard
- **Environment / look:** **Timed Sequence** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large puzzle layout themed as **Timed Sequence**, with 5 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 linked puzzle objectives and open the final route.
- **3D objects used:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Shorter timers + decoys
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Crystal Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Crystal Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense puzzle layout themed as **Crystal Master**, with 6 linked rooms/zones and progressively more interdependent switches.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 6 linked puzzle objectives and open the final route.
- **3D objects used:** Crystal switch, cave gate, crystal cluster, stone platform, color beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All puzzle mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 45 — Sky Hook Swing

**Game type:** Swing platformer
**Core objective:** Swing between anchor points and reach floating islands.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin

### Hyper3D — primary asset prompt
```text
Stylized floating swing anchor point for a fantasy arcade platformer, rounded metallic ring on a compact support, clean low-poly game-ready geometry, no text.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Single Swing

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Single Swing** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Single Swing**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 core challenge interactions and reach the finish.
- **3D objects used:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Double Swing

- **Difficulty:** Easy
- **Environment / look:** **Double Swing** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Double Swing**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 core challenge interactions and reach the finish.
- **3D objects used:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Anchors

- **Difficulty:** Medium
- **Environment / look:** **Moving Anchors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Moving Anchors**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 core challenge interactions and reach the finish.
- **3D objects used:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Long Gaps

- **Difficulty:** Hard
- **Environment / look:** **Long Gaps** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Long Gaps**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 16 core challenge interactions and reach the finish.
- **3D objects used:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Sky Swing Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Sky Swing Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Sky Swing Master**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 20 core challenge interactions and reach the finish.
- **3D objects used:** Swing anchor, rope/energy tether visual anchor, floating island, landing pad, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 46 — Color Door Sprint

**Game type:** Reaction runner
**Core objective:** Choose the correct colored door before reaching each gate wall.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Recolorable door, gate wall, floor arrow, speed pad, score orb

### Hyper3D — primary asset prompt
```text
Stylized arcade doorway module with thick rounded frame, neutral surface suitable for runtime recoloring, premium low-poly game-ready geometry.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Two Doors

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Two Doors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Two Doors**, with 3 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Pass 8 correct color doors in sequence.
- **3D objects used:** Recolorable door, gate wall, floor arrow, speed pad, score orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Low speed / wide margins
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Three Doors

- **Difficulty:** Easy
- **Environment / look:** **Three Doors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Three Doors**, with 4 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Pass 12 correct color doors in sequence.
- **3D objects used:** Recolorable door, gate wall, floor arrow, speed pad, score orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moderate speed
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Fake Door

- **Difficulty:** Medium
- **Environment / look:** **Fake Door** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Fake Door**, with 5 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Pass 16 correct color doors in sequence.
- **3D objects used:** Recolorable door, gate wall, floor arrow, speed pad, score orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Gates

- **Difficulty:** Hard
- **Environment / look:** **Fast Gates** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large forward route themed as **Fast Gates**, with 6 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Pass 20 correct color doors in sequence.
- **3D objects used:** Recolorable door, gate wall, floor arrow, speed pad, score orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** High speed + tighter timing
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Door Sprint Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Door Sprint Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Door Sprint Master**, with 8 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Pass 25 correct color doors in sequence.
- **3D objects used:** Recolorable door, gate wall, floor arrow, speed pad, score orb. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Maximum speed + mixed hazards
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 47 — Tightrope Path

**Game type:** Balance obstacle course
**Core objective:** Cross narrow beams and moving balance platforms without falling.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Balance beam, rotating beam, moving platform, checkpoint post, coin

### Hyper3D — primary asset prompt
```text
Stylized narrow balance beam obstacle with rounded edges and clear top surface, premium low-poly mobile arcade game asset, neutral wood/stone material.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Wide Beams

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Wide Beams** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact traversal course themed as **Wide Beams**, with 8 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 6 balance elements and reach the finish.
- **3D objects used:** Balance beam, rotating beam, moving platform, checkpoint post, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Narrow Beams

- **Difficulty:** Easy
- **Environment / look:** **Narrow Beams** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium traversal course themed as **Narrow Beams**, with 12 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 8 balance elements and reach the finish.
- **3D objects used:** Balance beam, rotating beam, moving platform, checkpoint post, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Beams

- **Difficulty:** Medium
- **Environment / look:** **Moving Beams** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium traversal course themed as **Moving Beams**, with 16 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 10 balance elements and reach the finish.
- **3D objects used:** Balance beam, rotating beam, moving platform, checkpoint post, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Rotating Path

- **Difficulty:** Hard
- **Environment / look:** **Rotating Path** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large traversal course themed as **Rotating Path**, with 20 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 12 balance elements and reach the finish.
- **3D objects used:** Balance beam, rotating beam, moving platform, checkpoint post, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Balance Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Balance Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense traversal course themed as **Balance Master**, with 24 major jumps/anchors/platform interactions.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Cross 15 balance elements and reach the finish.
- **3D objects used:** Balance beam, rotating beam, moving platform, checkpoint post, coin. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 48 — Color Orb Defense

**Game type:** Color defense arena
**Core objective:** Stand on matching color zones to block incoming harmless energy orbs.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows for position where needed; mouse/tap or action button for timing/target input.
**Required 3D assets:** Energy orb, color zone, shield pedestal, arena pillar, score beacon

### Hyper3D — primary asset prompt
```text
Stylized glowing energy orb collectible/projectile for a colorful arcade defense game, spherical core with soft emissive shell, neutral base for runtime recoloring, premium low-poly asset.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Two Colors

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Two Colors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact arcade arena/course themed as **Two Colors**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Survive 4 color waves and block the required matching orbs.
- **3D objects used:** Energy orb, color zone, shield pedestal, arena pillar, score beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Three Colors

- **Difficulty:** Easy
- **Environment / look:** **Three Colors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade arena/course themed as **Three Colors**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Survive 6 color waves and block the required matching orbs.
- **3D objects used:** Energy orb, color zone, shield pedestal, arena pillar, score beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Four Colors

- **Difficulty:** Medium
- **Environment / look:** **Four Colors** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium arcade arena/course themed as **Four Colors**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Survive 8 color waves and block the required matching orbs.
- **3D objects used:** Energy orb, color zone, shield pedestal, arena pillar, score beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Fast Waves

- **Difficulty:** Hard
- **Environment / look:** **Fast Waves** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large arcade arena/course themed as **Fast Waves**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Survive 10 color waves and block the required matching orbs.
- **3D objects used:** Energy orb, color zone, shield pedestal, arena pillar, score beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Orb Defense Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Orb Defense Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Orb Defense Master**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Survive 12 color waves and block the required matching orbs.
- **3D objects used:** Energy orb, color zone, shield pedestal, arena pillar, score beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 49 — Zipline Rush

**Game type:** Zipline traversal game
**Core objective:** Ride ziplines between rooftops and jump off at the correct timing.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Zipline handle, cable anchor, rooftop platform, landing zone, ring

### Hyper3D — primary asset prompt
```text
Stylized arcade zipline handle and anchor system, chunky rounded grip, simple metal support, premium low-poly browser game asset, no text.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Training Line

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Training Line** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Training Line**, with 3 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 4 zipline transfers and land in the marked zones.
- **3D objects used:** Zipline handle, cable anchor, rooftop platform, landing zone, ring. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Low speed / wide margins
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Twin Lines

- **Difficulty:** Easy
- **Environment / look:** **Twin Lines** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Twin Lines**, with 4 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 6 zipline transfers and land in the marked zones.
- **3D objects used:** Zipline handle, cable anchor, rooftop platform, landing zone, ring. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moderate speed
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Moving Landing

- **Difficulty:** Medium
- **Environment / look:** **Moving Landing** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Moving Landing**, with 5 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 8 zipline transfers and land in the marked zones.
- **3D objects used:** Zipline handle, cable anchor, rooftop platform, landing zone, ring. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Night Skyline

- **Difficulty:** Hard
- **Environment / look:** **Night Skyline** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large forward route themed as **Night Skyline**, with 6 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 10 zipline transfers and land in the marked zones.
- **3D objects used:** Zipline handle, cable anchor, rooftop platform, landing zone, ring. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** High speed + tighter timing
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Zipline Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Zipline Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Zipline Master**, with 8 mechanic segments and short recovery areas.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 12 zipline transfers and land in the marked zones.
- **3D objects used:** Zipline handle, cable anchor, rooftop platform, landing zone, ring. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Maximum speed + mixed hazards
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---

# GAME 50 — Ultimate Color Trial

**Game type:** Mixed-mechanic finale
**Core objective:** Complete a short sequence combining jump, dash, color gates, rings and survival rounds.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** WASD/Arrows to move, Space to jump, E/action for contextual interaction; mobile uses virtual stick + jump/action.
**Required 3D assets:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon

### Hyper3D — primary asset prompt
```text
Premium modular arcade challenge asset pack with neutral recolorable gate, ring, platform and energy core, rounded stylized shapes, clean low-poly browser game geometry, consistent scale.
```

### Character use
- Same Color Shell Hero base mesh and shared skeleton.
- Runtime accent color selects Red / Blue / Green / Yellow / Purple hero.
- Red Dash, Blue Double Jump, Green Shield, Yellow Magnet and Purple Phase remain available unless a level temporarily restricts one to preserve the core mechanic.

## Levels

### Level 1 — Jump Trial

- **Difficulty:** Tutorial / Easy
- **Environment / look:** **Jump Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Compact
- **Layout:** Compact arcade arena/course themed as **Jump Trial**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 3 mixed mechanic sections without exhausting lives.
- **3D objects used:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Simple static setup
- **Timer / target:** 75 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Bright and highly readable.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 1 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 2 — Runner Trial

- **Difficulty:** Easy
- **Environment / look:** **Runner Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Small–Medium
- **Layout:** Small–Medium arcade arena/course themed as **Runner Trial**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 4 mixed mechanic sections without exhausting lives.
- **3D objects used:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Moving element introduced
- **Timer / target:** 90 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Clean environmental lighting with moderate contrast.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 2 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 3 — Color Trial

- **Difficulty:** Medium
- **Environment / look:** **Color Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Medium
- **Layout:** Medium arcade arena/course themed as **Color Trial**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 5 mixed mechanic sections without exhausting lives.
- **3D objects used:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Mixed movement/timing
- **Timer / target:** 105 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** More atmospheric lighting while gameplay colors remain clear.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 3 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 4 — Mixed Trial

- **Difficulty:** Hard
- **Environment / look:** **Mixed Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large
- **Layout:** Large arcade arena/course themed as **Mixed Trial**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 6 mixed mechanic sections without exhausting lives.
- **3D objects used:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** Tighter gaps and faster cycles
- **Timer / target:** 120 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Higher contrast with stronger hazard highlights.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 4 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

### Level 5 — Grand Hero Trial

- **Difficulty:** Master Challenge
- **Environment / look:** **Grand Hero Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Grand Hero Trial**, with clear start, challenge zones and finish/result area.
- **Player start:** Safe intro zone with the first mechanic visible before movement begins.
- **Main objective:** Complete 7 mixed mechanic sections without exhausting lives.
- **3D objects used:** Recolorable gate, platform, ring, energy core, checkpoint, boss beacon. Reuse neutral recolorable versions when possible.
- **Hazards / pressure:** All mechanics combined
- **Timer / target:** 150 sec target window, unless score-attack/endless mode is more appropriate.
- **Camera:** Third-person arcade follow camera tuned to keep the next interaction visible.
- **Lighting / mood:** Cinematic finale lighting with strong readability.
- **Win condition:** Complete the target objective and reach the result/finish zone where applicable.
- **Lose condition:** Fall out of bounds, lose all lives, or fail the timer/round requirement.
- **Progression:** Level 5 increases mechanic density, timing pressure and route complexity.
- **Replay goal:** Improve personal best time, score, combo, accuracy or collectible count.

---


# Shared Color Shell Hero 3D asset library

Generate/reuse:

- 1 hero base mesh
- 5 accent materials
- 1 skeleton
- shared animation set
- neutral recolorable gem
- neutral recolorable ring
- neutral recolorable portal
- neutral recolorable gate
- neutral recolorable floor tile
- neutral recolorable energy core
- coin
- star
- checkpoint
- generic stone platform
- generic sci-fi platform
- crate
- rock
- tree/plant
- barrier
- bounce pad
- rail segment
- bridge tile
- laser emitter
- swing anchor
- zipline anchor
- balance beam

## Runtime recoloring rule

Do not generate separate meshes for each color variant. Use one neutral mesh and change material/emissive colors in-engine.

# Level architecture

Each game should be configuration-driven. Each level config should define:

- layout seed / placements
- active obstacle types
- target count
- active colors
- timer
- platform / runner speed
- collectible count
- ability restrictions if required
- lighting/environment preset
- score thresholds

# Production total for Menu 2

- **50 games**
- **5 levels per game**
- **250 complete level specifications**
- 1 Color Shell Hero base mesh
- 5 color variants
- 1 shared rig
- 12 shared animations
- shared runtime recoloring system
- approximately 50–70 special environment/obstacle assets
- approximately 20–25 generic reusable assets

# Recommended build order

1. Sky Tower Jump — vertical/platformer template
2. Roll Dash — runner template
3. Color Arena Survival — color/round template
4. Wall Run Temple — advanced traversal template
5. Color Bridge Builder — puzzle template
6. Ultimate Color Trial — integration/finale template

After these are stable, most remaining games should be configuration, level layout and asset composition rather than new engine development.
