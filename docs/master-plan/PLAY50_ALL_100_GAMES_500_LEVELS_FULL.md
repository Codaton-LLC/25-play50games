# PLAY50 — MASTER GAME PLAN
## 100 3D Games / 500 Levels

# MENU 1 — 50 Mixed 3D Arcade Games

# PLAY50 — MENU 1
## FULL PRODUCTION SPEC — 50 Mixed 3D Arcade Games

**Scope:** the original 30 mixed games + the later 20 mixed games live in the **same main arcade menu**.

Each game below includes the character/vehicle, full 3D asset checklist, Hyper3D production prompts, controls, systems and **five level specifications**.

## Shared technical architecture

- Next.js / React
- React Three Fiber
- @react-three/drei
- @react-three/rapier
- Zustand
- GLB/GLTF
- Shared profile / leaderboard backend
- Web Audio / Howler

### Shared runtime systems

`CharacterController`, `VehicleController`, `FlightController`, `SwimController`, `CameraController`, `InteractionSystem`, `PickupDropSystem`, `CollectibleSystem`, `TimerSystem`, `ScoreSystem`, `CheckpointSystem`, `TaskQueue`, `WaypointSystem`, `SimpleNPCSystem`, `SimpleBotAI`, `GameOver`, `WinState`, `MobileControls`, `AudioManager`, `Leaderboard`, `SkinSystem`.

### Global level rule

Prefer **1 base environment + 5 level configurations** instead of five unrelated maps. Variation should come from layout, spawn positions, objective count, hazards, speed, lighting and timing.

---

# GAME 01 — Office Escape

**Category:** Runner
**Base difficulty:** Easy
**Concept:** Short 3D office runner. The player races through an office while avoiding desks, chairs, printers and carts.
**Core loop:** Run → dodge/jump → collect bonuses → reach checkpoint → speed increases.
**Player character / vehicle:** Stylized office worker.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door, coin/bonus.
**Reusable systems:** RunnerController, jump, obstacle spawning, score, timer, checkpoints.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized office worker.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Office Escape** containing: Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door, coin/bonus.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Open Office

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Open Office interpreted in the visual language of **Office Escape**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Open Office**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 5 obstacle clusters and collect optional bonuses.
- **3D objects used:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Meeting Floor

- **Difficulty:** Easy
- **Environment / look:** Meeting Floor interpreted in the visual language of **Office Escape**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Meeting Floor**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 7 obstacle clusters and collect optional bonuses.
- **3D objects used:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Copy Room

- **Difficulty:** Medium
- **Environment / look:** Copy Room interpreted in the visual language of **Office Escape**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Copy Room**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 9 obstacle clusters and collect optional bonuses.
- **3D objects used:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Executive Floor

- **Difficulty:** Hard
- **Environment / look:** Executive Floor interpreted in the visual language of **Office Escape**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **Executive Floor**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 11 obstacle clusters and collect optional bonuses.
- **3D objects used:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — After-Hours Office

- **Difficulty:** Challenge
- **Environment / look:** After-Hours Office interpreted in the visual language of **Office Escape**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **After-Hours Office**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 14 obstacle clusters and collect optional bonuses.
- **3D objects used:** Desk, office chair, printer, cardboard box, coffee cart, computer monitor, door. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 02 — Robot Collector

**Category:** Task
**Base difficulty:** Easy
**Concept:** A small robot collects batteries in a compact warehouse before time expires.
**Core loop:** Explore → collect battery → avoid crates/obstacles → fill energy meter → finish.
**Player character / vehicle:** Small friendly warehouse robot.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Battery, crate, barrel, charging pad, warehouse rack, beacon.
**Reusable systems:** CharacterController, collectibles, timer, score, simple hazards.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Small friendly warehouse robot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Robot Collector** containing: Battery, crate, barrel, charging pad, warehouse rack, beacon.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Bay

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Bay interpreted in the visual language of **Robot Collector**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Training Bay** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 6 batteries before time expires.
- **3D objects used:** Battery, crate, barrel, charging pad, warehouse rack, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Small Warehouse

- **Difficulty:** Easy
- **Environment / look:** Small Warehouse interpreted in the visual language of **Robot Collector**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Small Warehouse** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 8 batteries before time expires.
- **3D objects used:** Battery, crate, barrel, charging pad, warehouse rack, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Conveyor Zone

- **Difficulty:** Medium
- **Environment / look:** Conveyor Zone interpreted in the visual language of **Robot Collector**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Conveyor Zone** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 10 batteries before time expires.
- **3D objects used:** Battery, crate, barrel, charging pad, warehouse rack, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Dark Storage

- **Difficulty:** Hard
- **Environment / look:** Dark Storage interpreted in the visual language of **Robot Collector**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Dark Storage** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 12 batteries before time expires.
- **3D objects used:** Battery, crate, barrel, charging pad, warehouse rack, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Mega Warehouse

- **Difficulty:** Challenge
- **Environment / look:** Mega Warehouse interpreted in the visual language of **Robot Collector**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Mega Warehouse** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 15 batteries before time expires.
- **3D objects used:** Battery, crate, barrel, charging pad, warehouse rack, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 03 — Pigeon Crossing

**Category:** Runner
**Base difficulty:** Easy–Medium
**Concept:** A stylized pigeon crosses increasingly busy roads and lanes.
**Core loop:** Move lane-to-lane → time traffic gaps → reach safe zone → next section.
**Player character / vehicle:** Stylized pigeon mascot.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Car, van, bus, road barrier, traffic light, sidewalk, coin.
**Reusable systems:** Grid movement, moving hazards, checkpoints, score.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized pigeon mascot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Pigeon Crossing** containing: Car, van, bus, road barrier, traffic light, sidewalk, coin.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Quiet Street

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Quiet Street interpreted in the visual language of **Pigeon Crossing**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Quiet Street**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Cross 3 traffic sections and reach the safe finish zone.
- **3D objects used:** Car, van, bus, road barrier, traffic light, sidewalk, coin.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Main Road

- **Difficulty:** Easy
- **Environment / look:** Main Road interpreted in the visual language of **Pigeon Crossing**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Main Road**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Cross 4 traffic sections and reach the safe finish zone.
- **3D objects used:** Car, van, bus, road barrier, traffic light, sidewalk, coin.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — City Crossing

- **Difficulty:** Medium
- **Environment / look:** City Crossing interpreted in the visual language of **Pigeon Crossing**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **City Crossing**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Cross 5 traffic sections and reach the safe finish zone.
- **3D objects used:** Car, van, bus, road barrier, traffic light, sidewalk, coin.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Night Traffic

- **Difficulty:** Hard
- **Environment / look:** Night Traffic interpreted in the visual language of **Pigeon Crossing**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **Night Traffic**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Cross 6 traffic sections and reach the safe finish zone.
- **3D objects used:** Car, van, bus, road barrier, traffic light, sidewalk, coin.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Rush Hour

- **Difficulty:** Challenge
- **Environment / look:** Rush Hour interpreted in the visual language of **Pigeon Crossing**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Rush Hour**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Cross 8 traffic sections and reach the safe finish zone.
- **3D objects used:** Car, van, bus, road barrier, traffic light, sidewalk, coin.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 04 — Tower Climb

**Category:** Platformer
**Base difficulty:** Medium
**Concept:** Vertical platformer where the player climbs a tower as quickly and safely as possible.
**Core loop:** Jump → land → climb → use moving platform → checkpoint → continue upward.
**Player character / vehicle:** Explorer or reusable arcade hero.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
**Required 3D assets:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.
**Reusable systems:** PlatformerController, vertical camera, moving platforms, checkpoints.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Explorer or reusable arcade hero.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Tower Climb** containing: Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Tower

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Tower interpreted in the visual language of **Tower Climb**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact vertical **Training Tower** route with approximately 10 platform placements and 1 checkpoint/safe zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach checkpoint height 50 m without falling.
- **3D objects used:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Safe platforms
- **Timer / target:** 90 sec
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach jump distance and safe landings.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Stone Tower

- **Difficulty:** Easy
- **Environment / look:** Stone Tower interpreted in the visual language of **Tower Climb**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical **Stone Tower** route with approximately 14 platform placements and 2 checkpoint/safe zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach checkpoint height 80 m without falling.
- **3D objects used:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving platform
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Add moving platforms or wider gaps.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Clock Tower

- **Difficulty:** Medium
- **Environment / look:** Clock Tower interpreted in the visual language of **Tower Climb**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium vertical **Clock Tower** route with approximately 18 platform placements and 3 checkpoint/safe zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach checkpoint height 120 m without falling.
- **3D objects used:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Hazard platform
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Add disappearing/slippery/animated surfaces.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Storm Tower

- **Difficulty:** Hard
- **Environment / look:** Storm Tower interpreted in the visual language of **Tower Climb**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large vertical **Storm Tower** route with approximately 22 platform placements and 4 checkpoint/safe zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach checkpoint height 170 m without falling.
- **3D objects used:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed moving/failing platforms
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Mix hazards with tighter platform spacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Sky Tower

- **Difficulty:** Challenge
- **Environment / look:** Sky Tower interpreted in the visual language of **Tower Climb**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical **Sky Tower** route with approximately 28 platform placements and 5 checkpoint/safe zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach checkpoint height 250 m without falling.
- **3D objects used:** Stone platform, moving platform, ladder, bounce pad, coin, checkpoint flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** All hazards combined
- **Timer / target:** Best-time / survival challenge
- **Camera:** Third-person follow camera; vertical framing adjusts to upcoming platforms.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** High-speed mastery route using every platform type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 05 — Penalty Hero

**Category:** Skill
**Base difficulty:** Easy
**Concept:** Arcade penalty shootout with simple direction and power selection.
**Core loop:** Aim → set power → shoot → goalkeeper reacts → score update → next shot.
**Player character / vehicle:** Football player + goalkeeper.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Football, goal, cones, stadium boards, score board.
**Reusable systems:** Ball physics, goalkeeper AI, score, rounds.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Football player + goalkeeper.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Penalty Hero** containing: Football, goal, cones, stadium boards, score board.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training interpreted in the visual language of **Penalty Hero**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Training** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score at least 3 goals from 5 shots.
- **3D objects used:** Football, goal, cones, stadium boards, score board.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Local Cup

- **Difficulty:** Easy
- **Environment / look:** Local Cup interpreted in the visual language of **Penalty Hero**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Local Cup** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score at least 4 goals from 6 shots.
- **3D objects used:** Football, goal, cones, stadium boards, score board.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Night Match

- **Difficulty:** Medium
- **Environment / look:** Night Match interpreted in the visual language of **Penalty Hero**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Night Match** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score at least 6 goals from 8 shots.
- **3D objects used:** Football, goal, cones, stadium boards, score board.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Semi Final

- **Difficulty:** Hard
- **Environment / look:** Semi Final interpreted in the visual language of **Penalty Hero**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Semi Final** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score at least 7 goals from 10 shots.
- **3D objects used:** Football, goal, cones, stadium boards, score board.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Final Shootout

- **Difficulty:** Challenge
- **Environment / look:** Final Shootout interpreted in the visual language of **Penalty Hero**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Final Shootout** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score at least 8 goals from 10 shots.
- **3D objects used:** Football, goal, cones, stadium boards, score board.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 06 — Warehouse Rush

**Category:** Task
**Base difficulty:** Easy–Medium
**Concept:** Pick up colored parcels and deliver them to the correct warehouse zones.
**Core loop:** Read task → pick parcel → deliver → earn streak → next task.
**Player character / vehicle:** Warehouse worker or robot.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.
**Reusable systems:** Pickup/drop, task queue, timer, score, waypoint.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Warehouse worker or robot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Warehouse Rush** containing: Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Depot

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Depot interpreted in the visual language of **Warehouse Rush**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Training Depot** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 5 parcels to the correct color/zone.
- **3D objects used:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Blue/Red Zones

- **Difficulty:** Easy
- **Environment / look:** Blue/Red Zones interpreted in the visual language of **Warehouse Rush**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Blue/Red Zones** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 7 parcels to the correct color/zone.
- **3D objects used:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Multi-Aisle Warehouse

- **Difficulty:** Medium
- **Environment / look:** Multi-Aisle Warehouse interpreted in the visual language of **Warehouse Rush**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Multi-Aisle Warehouse** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 9 parcels to the correct color/zone.
- **3D objects used:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Rush Shift

- **Difficulty:** Hard
- **Environment / look:** Rush Shift interpreted in the visual language of **Warehouse Rush**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Rush Shift** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 12 parcels to the correct color/zone.
- **3D objects used:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Night Logistics

- **Difficulty:** Challenge
- **Environment / look:** Night Logistics interpreted in the visual language of **Warehouse Rush**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Night Logistics** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 15 parcels to the correct color/zone.
- **3D objects used:** Colored boxes, pallet, rack, trolley, loading zone, forklift decoration.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 07 — Clean the City

**Category:** Collect
**Base difficulty:** Easy
**Concept:** Collect scattered litter across small stylized city maps.
**Core loop:** Explore → collect trash → complete area → earn stars.
**Player character / vehicle:** City cleanup mascot.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with collectible visibility priority.
**Required 3D assets:** Bottle, can, paper, trash bin, bench, street lamp, planter.
**Reusable systems:** Collectibles, map completion, stars, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: City cleanup mascot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Clean the City** containing: Bottle, can, paper, trash bin, bench, street lamp, planter.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Pocket Park

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Pocket Park interpreted in the visual language of **Clean the City**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Pocket Park** collection area with targets distributed across 2 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 10 litter items and clear the area.
- **3D objects used:** Bottle, can, paper, trash bin, bench, street lamp, planter.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Open collection area
- **Timer / target:** 90 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Teach collection and delivery/return loop.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — City Square

- **Difficulty:** Easy
- **Environment / look:** City Square interpreted in the visual language of **Clean the City**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **City Square** collection area with targets distributed across 3 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 15 litter items and clear the area.
- **3D objects used:** Bottle, can, paper, trash bin, bench, street lamp, planter.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More spread targets
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Increase target count and map size.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Shopping Street

- **Difficulty:** Medium
- **Environment / look:** Shopping Street interpreted in the visual language of **Clean the City**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Shopping Street** collection area with targets distributed across 4 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 20 litter items and clear the area.
- **3D objects used:** Bottle, can, paper, trash bin, bench, street lamp, planter.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add moving hazards or target matching.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — River Walk

- **Difficulty:** Hard
- **Environment / look:** River Walk interpreted in the visual language of **Clean the City**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **River Walk** collection area with targets distributed across 5 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 25 litter items and clear the area.
- **3D objects used:** Bottle, can, paper, trash bin, bench, street lamp, planter.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Target matching/resource pressure
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add resource/time pressure.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Festival Cleanup

- **Difficulty:** Challenge
- **Environment / look:** Festival Cleanup interpreted in the visual language of **Clean the City**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Festival Cleanup** collection area with targets distributed across 6 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 35 litter items and clear the area.
- **3D objects used:** Bottle, can, paper, trash bin, bench, street lamp, planter.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Large area + maximum density
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Large score-attack map using all collectible rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 08 — Tiny Escape Room

**Category:** Explore
**Base difficulty:** Medium
**Concept:** Small 3D room puzzle where players find items and unlock an exit.
**Core loop:** Search → inspect → collect key item → solve switch/order puzzle → unlock exit.
**Player character / vehicle:** Explorer.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
**Required 3D assets:** Key, book, battery, switch, drawer, door, lock, cabinet.
**Reusable systems:** Interaction, inventory, puzzle states, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Explorer.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Tiny Escape Room** containing: Key, book, battery, switch, drawer, door, lock, cabinet.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Office

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Office interpreted in the visual language of **Tiny Escape Room**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Office** exploration map with 3 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 2 key items and solve the exit sequence.
- **3D objects used:** Key, book, battery, switch, drawer, door, lock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No active hazard
- **Timer / target:** 180 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Teach navigation and one key interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Workshop

- **Difficulty:** Easy
- **Environment / look:** Workshop interpreted in the visual language of **Tiny Escape Room**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Workshop** exploration map with 5 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 3 key items and solve the exit sequence.
- **3D objects used:** Key, book, battery, switch, drawer, door, lock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** One blocked path
- **Timer / target:** 210 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add branching rooms/paths.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Laboratory

- **Difficulty:** Medium
- **Environment / look:** Laboratory interpreted in the visual language of **Tiny Escape Room**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Laboratory** exploration map with 7 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 4 key items and solve the exit sequence.
- **3D objects used:** Key, book, battery, switch, drawer, door, lock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Branching/locked paths
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add multi-step clue/objective chains.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Cabin

- **Difficulty:** Hard
- **Environment / look:** Cabin interpreted in the visual language of **Tiny Escape Room**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Cabin** exploration map with 9 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 4 key items and solve the exit sequence.
- **3D objects used:** Key, book, battery, switch, drawer, door, lock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Randomized objective positions
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add randomized placement or locked shortcuts.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Mini Spaceship

- **Difficulty:** Challenge
- **Environment / look:** Mini Spaceship interpreted in the visual language of **Tiny Escape Room**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Mini Spaceship** exploration map with 12 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 5 key items and solve the exit sequence.
- **3D objects used:** Key, book, battery, switch, drawer, door, lock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-map route with time pressure
- **Timer / target:** 300 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Full-map escape/treasure challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 09 — Food Catcher 3D

**Category:** Arcade
**Base difficulty:** Easy
**Concept:** Catch correct falling food items while avoiding bad items.
**Core loop:** Move left/right → catch good item → avoid bad item → maintain combo.
**Player character / vehicle:** Chef mascot.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Camera:** Third-person arcade camera with stable framing.
**Required 3D assets:** Apple, banana, strawberry, burger, spoiled item, basket.
**Reusable systems:** Lane movement, falling spawner, combo, lives.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Chef mascot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Food Catcher 3D** containing: Apple, banana, strawberry, burger, spoiled item, basket.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Fruit Catch

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Fruit Catch interpreted in the visual language of **Food Catcher 3D**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Fruit Catch** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Catch 15 correct food items while keeping at least one life.
- **3D objects used:** Apple, banana, strawberry, burger, spoiled item, basket.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Low
- **Timer / target:** 90 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Teach the primary interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Snack Catch

- **Difficulty:** Easy
- **Environment / look:** Snack Catch interpreted in the visual language of **Food Catcher 3D**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Snack Catch** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Catch 25 correct food items while keeping at least one life.
- **3D objects used:** Apple, banana, strawberry, burger, spoiled item, basket.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Low–Medium
- **Timer / target:** 120 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Add one new rule.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Fast Food Mix

- **Difficulty:** Medium
- **Environment / look:** Fast Food Mix interpreted in the visual language of **Food Catcher 3D**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Fast Food Mix** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Catch 35 correct food items while keeping at least one life.
- **3D objects used:** Apple, banana, strawberry, burger, spoiled item, basket.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Medium
- **Timer / target:** 150 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Combine two mechanics.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Speed Kitchen

- **Difficulty:** Hard
- **Environment / look:** Speed Kitchen interpreted in the visual language of **Food Catcher 3D**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Speed Kitchen** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Catch 45 correct food items while keeping at least one life.
- **3D objects used:** Apple, banana, strawberry, burger, spoiled item, basket.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** High
- **Timer / target:** 180 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Increase speed/complexity.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Master Catch

- **Difficulty:** Challenge
- **Environment / look:** Master Catch interpreted in the visual language of **Food Catcher 3D**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Master Catch** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Catch 60 correct food items while keeping at least one life.
- **3D objects used:** Apple, banana, strawberry, burger, spoiled item, basket.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** High / mixed
- **Timer / target:** High-score challenge
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** High-score mastery challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 10 — Obstacle Race

**Category:** Runner
**Base difficulty:** Medium
**Concept:** Short obstacle course with moving bars, platforms and bridges.
**Core loop:** Run → jump/dodge → pass checkpoint → finish as fast as possible.
**Player character / vehicle:** Arcade runner.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.
**Reusable systems:** Platformer, obstacle animation, timer, checkpoints, best time.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Arcade runner.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Obstacle Race** containing: Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Course

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Course interpreted in the visual language of **Obstacle Race**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Training Course**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 obstacle sections and reach the finish.
- **3D objects used:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Moving Blocks

- **Difficulty:** Easy
- **Environment / look:** Moving Blocks interpreted in the visual language of **Obstacle Race**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Moving Blocks**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 obstacle sections and reach the finish.
- **3D objects used:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Bridge Run

- **Difficulty:** Medium
- **Environment / look:** Bridge Run interpreted in the visual language of **Obstacle Race**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Bridge Run**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 obstacle sections and reach the finish.
- **3D objects used:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Spinner Arena

- **Difficulty:** Hard
- **Environment / look:** Spinner Arena interpreted in the visual language of **Obstacle Race**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **Spinner Arena**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 10 obstacle sections and reach the finish.
- **3D objects used:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Championship Course

- **Difficulty:** Challenge
- **Environment / look:** Championship Course interpreted in the visual language of **Obstacle Race**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Championship Course**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 12 obstacle sections and reach the finish.
- **3D objects used:** Rotating bar, moving block, bridge, bounce pad, checkpoint arch.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 11 — Treasure Island

**Category:** Explore
**Base difficulty:** Medium
**Concept:** Explore a compact island and discover hidden treasure chests before time expires.
**Core loop:** Follow clues → explore → open chest → collect map piece → final treasure.
**Player character / vehicle:** Young island explorer.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
**Required 3D assets:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.
**Reusable systems:** Exploration, interaction, collectibles, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Young island explorer.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Treasure Island** containing: Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Starter Beach

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Starter Beach interpreted in the visual language of **Treasure Island**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Starter Beach** exploration map with 3 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 2 clue/treasure objectives and reach the final chest.
- **3D objects used:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No active hazard
- **Timer / target:** 180 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Teach navigation and one key interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Palm Grove

- **Difficulty:** Easy
- **Environment / look:** Palm Grove interpreted in the visual language of **Treasure Island**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Palm Grove** exploration map with 5 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 3 clue/treasure objectives and reach the final chest.
- **3D objects used:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** One blocked path
- **Timer / target:** 210 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add branching rooms/paths.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Rocky Cove

- **Difficulty:** Medium
- **Environment / look:** Rocky Cove interpreted in the visual language of **Treasure Island**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Rocky Cove** exploration map with 7 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 4 clue/treasure objectives and reach the final chest.
- **3D objects used:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Branching/locked paths
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add multi-step clue/objective chains.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Jungle Interior

- **Difficulty:** Hard
- **Environment / look:** Jungle Interior interpreted in the visual language of **Treasure Island**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Jungle Interior** exploration map with 9 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 5 clue/treasure objectives and reach the final chest.
- **3D objects used:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Randomized objective positions
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add randomized placement or locked shortcuts.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Pirate Peak

- **Difficulty:** Challenge
- **Environment / look:** Pirate Peak interpreted in the visual language of **Treasure Island**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Pirate Peak** exploration map with 12 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 6 clue/treasure objectives and reach the final chest.
- **3D objects used:** Treasure chest, palm tree, rock, rope bridge, map piece, shovel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-map route with time pressure
- **Timer / target:** 300 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Full-map escape/treasure challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 12 — Museum Guard

**Category:** Explore
**Base difficulty:** Medium
**Concept:** Night guard monitors a playful museum where exhibits subtly change position.
**Core loop:** Patrol → check exhibit → identify moved item → restore/check → continue.
**Player character / vehicle:** Museum security guard.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
**Required 3D assets:** Statue, display case, painting frame, bench, flashlight, security desk.
**Reusable systems:** Patrol, object state changes, interaction, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Museum security guard.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Museum Guard** containing: Statue, display case, painting frame, bench, flashlight, security desk.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Main Hall

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Main Hall interpreted in the visual language of **Museum Guard**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Main Hall** exploration map with 3 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly inspect 4 exhibits and identify changed/moved objects.
- **3D objects used:** Statue, display case, painting frame, bench, flashlight, security desk.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No active hazard
- **Timer / target:** 180 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Teach navigation and one key interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Ancient Wing

- **Difficulty:** Easy
- **Environment / look:** Ancient Wing interpreted in the visual language of **Museum Guard**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Ancient Wing** exploration map with 5 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly inspect 6 exhibits and identify changed/moved objects.
- **3D objects used:** Statue, display case, painting frame, bench, flashlight, security desk.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** One blocked path
- **Timer / target:** 210 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add branching rooms/paths.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Art Wing

- **Difficulty:** Medium
- **Environment / look:** Art Wing interpreted in the visual language of **Museum Guard**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Art Wing** exploration map with 7 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly inspect 8 exhibits and identify changed/moved objects.
- **3D objects used:** Statue, display case, painting frame, bench, flashlight, security desk.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Branching/locked paths
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add multi-step clue/objective chains.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Science Wing

- **Difficulty:** Hard
- **Environment / look:** Science Wing interpreted in the visual language of **Museum Guard**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Science Wing** exploration map with 9 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly inspect 10 exhibits and identify changed/moved objects.
- **3D objects used:** Statue, display case, painting frame, bench, flashlight, security desk.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Randomized objective positions
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add randomized placement or locked shortcuts.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Full Museum Night

- **Difficulty:** Challenge
- **Environment / look:** Full Museum Night interpreted in the visual language of **Museum Guard**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Full Museum Night** exploration map with 12 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly inspect 12 exhibits and identify changed/moved objects.
- **3D objects used:** Statue, display case, painting frame, bench, flashlight, security desk.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-map route with time pressure
- **Timer / target:** 300 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Full-map escape/treasure challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 13 — Airport Luggage Rush

**Category:** Task
**Base difficulty:** Easy
**Concept:** Sort luggage from a conveyor into the correct destination zones.
**Core loop:** Read tag color/icon → grab luggage → place correctly → maintain streak.
**Player character / vehicle:** Airport ground worker.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Suitcase, conveyor, luggage cart, barrier, airport crate.
**Reusable systems:** Conveyor spawning, pickup/drop, sorting, combo.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Airport ground worker.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Airport Luggage Rush** containing: Suitcase, conveyor, luggage cart, barrier, airport crate.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Belt

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Belt interpreted in the visual language of **Airport Luggage Rush**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Training Belt** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Sort 8 luggage items to the correct destination bins.
- **3D objects used:** Suitcase, conveyor, luggage cart, barrier, airport crate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Two Destinations

- **Difficulty:** Easy
- **Environment / look:** Two Destinations interpreted in the visual language of **Airport Luggage Rush**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Two Destinations** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Sort 12 luggage items to the correct destination bins.
- **3D objects used:** Suitcase, conveyor, luggage cart, barrier, airport crate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Four Destinations

- **Difficulty:** Medium
- **Environment / look:** Four Destinations interpreted in the visual language of **Airport Luggage Rush**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Four Destinations** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Sort 16 luggage items to the correct destination bins.
- **3D objects used:** Suitcase, conveyor, luggage cart, barrier, airport crate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Rush Hour

- **Difficulty:** Hard
- **Environment / look:** Rush Hour interpreted in the visual language of **Airport Luggage Rush**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Rush Hour** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Sort 22 luggage items to the correct destination bins.
- **3D objects used:** Suitcase, conveyor, luggage cart, barrier, airport crate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — International Hub

- **Difficulty:** Challenge
- **Environment / look:** International Hub interpreted in the visual language of **Airport Luggage Rush**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **International Hub** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Sort 30 luggage items to the correct destination bins.
- **3D objects used:** Suitcase, conveyor, luggage cart, barrier, airport crate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 14 — Dino Egg Rescue

**Category:** Task
**Base difficulty:** Medium
**Concept:** A friendly dinosaur collects lost eggs and returns them to nests.
**Core loop:** Explore → find egg → carry to matching nest → avoid hazards.
**Player character / vehicle:** Small stylized dinosaur.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Egg, nest, rock, fern, log, mud patch, lava rock.
**Reusable systems:** Carry object, destination matching, hazards, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Small stylized dinosaur.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Dino Egg Rescue** containing: Egg, nest, rock, fern, log, mud patch, lava rock.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Green Valley

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Green Valley interpreted in the visual language of **Dino Egg Rescue**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Green Valley** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 3 eggs and return them to matching nests.
- **3D objects used:** Egg, nest, rock, fern, log, mud patch, lava rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Fern Forest

- **Difficulty:** Easy
- **Environment / look:** Fern Forest interpreted in the visual language of **Dino Egg Rescue**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Fern Forest** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 4 eggs and return them to matching nests.
- **3D objects used:** Egg, nest, rock, fern, log, mud patch, lava rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Riverbank

- **Difficulty:** Medium
- **Environment / look:** Riverbank interpreted in the visual language of **Dino Egg Rescue**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Riverbank** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 5 eggs and return them to matching nests.
- **3D objects used:** Egg, nest, rock, fern, log, mud patch, lava rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Volcanic Pass

- **Difficulty:** Hard
- **Environment / look:** Volcanic Pass interpreted in the visual language of **Dino Egg Rescue**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Volcanic Pass** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 6 eggs and return them to matching nests.
- **3D objects used:** Egg, nest, rock, fern, log, mud patch, lava rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Dino Sanctuary

- **Difficulty:** Challenge
- **Environment / look:** Dino Sanctuary interpreted in the visual language of **Dino Egg Rescue**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Dino Sanctuary** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 8 eggs and return them to matching nests.
- **3D objects used:** Egg, nest, rock, fern, log, mud patch, lava rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 15 — Delivery Drone

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Fly a compact drone and deliver packages to rooftop pads.
**Core loop:** Pick package → fly through route → avoid obstacles → land on target.
**Player character / vehicle:** Drone vehicle.
**Controls:** Keyboard: WASD/Arrows for direction, Space/Shift for vertical or thrust action; Mobile: left virtual stick + action/thrust button.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Drone, package, rooftop pad, antenna, billboard, air vent.
**Reusable systems:** FlightController, delivery targets, wind zones, timer.

### Hyper3D — main character / vehicle prompt
```text
Premium stylized 3D game-ready Drone vehicle., original design, clear readable silhouette, compact proportions, medium-low polygon count, clean topology, matte/satin materials, optimized for browser/mobile 3D, no logos, no text, centered on a plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Delivery Drone** containing: Drone, package, rooftop pad, antenna, billboard, air vent.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Rooftop

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Rooftop interpreted in the visual language of **Delivery Drone**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Training Rooftop** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 rooftop deliveries with safe landings.
- **3D objects used:** Drone, package, rooftop pad, antenna, billboard, air vent.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Residential Blocks

- **Difficulty:** Easy
- **Environment / look:** Residential Blocks interpreted in the visual language of **Delivery Drone**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Residential Blocks** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 rooftop deliveries with safe landings.
- **3D objects used:** Drone, package, rooftop pad, antenna, billboard, air vent.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Downtown

- **Difficulty:** Medium
- **Environment / look:** Downtown interpreted in the visual language of **Delivery Drone**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Downtown** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 rooftop deliveries with safe landings.
- **3D objects used:** Drone, package, rooftop pad, antenna, billboard, air vent.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Windy Towers

- **Difficulty:** Hard
- **Environment / look:** Windy Towers interpreted in the visual language of **Delivery Drone**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Windy Towers** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 rooftop deliveries with safe landings.
- **3D objects used:** Drone, package, rooftop pad, antenna, billboard, air vent.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Night Delivery

- **Difficulty:** Challenge
- **Environment / look:** Night Delivery interpreted in the visual language of **Delivery Drone**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Night Delivery** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 rooftop deliveries with safe landings.
- **3D objects used:** Drone, package, rooftop pad, antenna, billboard, air vent.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 16 — Crazy Shopping Cart

**Category:** Collect
**Base difficulty:** Medium
**Concept:** Arcade shopping-cart race through a supermarket collecting listed products.
**Core loop:** Read list → steer cart → collect item → avoid shelves → checkout.
**Player character / vehicle:** Shopper + cart.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with collectible visibility priority.
**Required 3D assets:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.
**Reusable systems:** Vehicle-like steering, item list, collisions, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Shopper + cart.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Crazy Shopping Cart** containing: Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Mini Market

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Mini Market interpreted in the visual language of **Crazy Shopping Cart**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Mini Market** collection area with targets distributed across 2 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 5 listed products and reach checkout.
- **3D objects used:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Open collection area
- **Timer / target:** 90 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Teach collection and delivery/return loop.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Fresh Food

- **Difficulty:** Easy
- **Environment / look:** Fresh Food interpreted in the visual language of **Crazy Shopping Cart**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Fresh Food** collection area with targets distributed across 3 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 7 listed products and reach checkout.
- **3D objects used:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More spread targets
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Increase target count and map size.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Household Aisles

- **Difficulty:** Medium
- **Environment / look:** Household Aisles interpreted in the visual language of **Crazy Shopping Cart**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Household Aisles** collection area with targets distributed across 4 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 9 listed products and reach checkout.
- **3D objects used:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add moving hazards or target matching.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Superstore

- **Difficulty:** Hard
- **Environment / look:** Superstore interpreted in the visual language of **Crazy Shopping Cart**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Superstore** collection area with targets distributed across 5 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 12 listed products and reach checkout.
- **3D objects used:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Target matching/resource pressure
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add resource/time pressure.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Closing-Time Rush

- **Difficulty:** Challenge
- **Environment / look:** Closing-Time Rush interpreted in the visual language of **Crazy Shopping Cart**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Closing-Time Rush** collection area with targets distributed across 6 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 15 listed products and reach checkout.
- **3D objects used:** Shopping cart, shelf, cereal box, milk, fruit, checkout gate.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Large area + maximum density
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Large score-attack map using all collectible rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 17 — Snowball Battle

**Category:** Skill
**Base difficulty:** Medium
**Concept:** Small arena battle against simple bots using snowballs.
**Core loop:** Collect snow → aim → throw → dodge → score hits.
**Player character / vehicle:** Winter arcade hero + simple bots.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Snowball, snow pile, snow fort, tree, crate, ice block.
**Reusable systems:** Projectile, bot AI, lives/score, arena rounds.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Winter arcade hero + simple bots.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Snowball Battle** containing: Snowball, snow pile, snow fort, tree, crate, ice block.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Snow Yard

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Snow Yard interpreted in the visual language of **Snowball Battle**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Snow Yard** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score 5 valid hits before opponents reach the target score.
- **3D objects used:** Snowball, snow pile, snow fort, tree, crate, ice block.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Frozen Park

- **Difficulty:** Easy
- **Environment / look:** Frozen Park interpreted in the visual language of **Snowball Battle**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Frozen Park** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score 8 valid hits before opponents reach the target score.
- **3D objects used:** Snowball, snow pile, snow fort, tree, crate, ice block.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Snow Fort

- **Difficulty:** Medium
- **Environment / look:** Snow Fort interpreted in the visual language of **Snowball Battle**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Snow Fort** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score 12 valid hits before opponents reach the target score.
- **3D objects used:** Snowball, snow pile, snow fort, tree, crate, ice block.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Ice Village

- **Difficulty:** Hard
- **Environment / look:** Ice Village interpreted in the visual language of **Snowball Battle**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Ice Village** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score 16 valid hits before opponents reach the target score.
- **3D objects used:** Snowball, snow pile, snow fort, tree, crate, ice block.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Championship Arena

- **Difficulty:** Challenge
- **Environment / look:** Championship Arena interpreted in the visual language of **Snowball Battle**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Championship Arena** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Score 20 valid hits before opponents reach the target score.
- **3D objects used:** Snowball, snow pile, snow fort, tree, crate, ice block.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 18 — Ghost Vacuum

**Category:** Explore
**Base difficulty:** Medium
**Concept:** Catch playful floating ghosts around a small mansion using a vacuum device.
**Core loop:** Detect ghost → chase → aim vacuum → capture → next room.
**Player character / vehicle:** Ghost catcher.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
**Required 3D assets:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.
**Reusable systems:** Target AI, capture beam, timer, combo.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Ghost catcher.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Ghost Vacuum** containing: Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Living Room

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Living Room interpreted in the visual language of **Ghost Vacuum**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Living Room** exploration map with 3 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Capture 4 playful ghosts.
- **3D objects used:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No active hazard
- **Timer / target:** 180 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Teach navigation and one key interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Library

- **Difficulty:** Easy
- **Environment / look:** Library interpreted in the visual language of **Ghost Vacuum**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Library** exploration map with 5 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Capture 6 playful ghosts.
- **3D objects used:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** One blocked path
- **Timer / target:** 210 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add branching rooms/paths.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Kitchen

- **Difficulty:** Medium
- **Environment / look:** Kitchen interpreted in the visual language of **Ghost Vacuum**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Kitchen** exploration map with 7 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Capture 8 playful ghosts.
- **3D objects used:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Branching/locked paths
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add multi-step clue/objective chains.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Attic

- **Difficulty:** Hard
- **Environment / look:** Attic interpreted in the visual language of **Ghost Vacuum**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Attic** exploration map with 9 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Capture 10 playful ghosts.
- **3D objects used:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Randomized objective positions
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add randomized placement or locked shortcuts.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Whole Mansion

- **Difficulty:** Challenge
- **Environment / look:** Whole Mansion interpreted in the visual language of **Ghost Vacuum**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Whole Mansion** exploration map with 12 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Capture 12 playful ghosts.
- **3D objects used:** Vacuum device, cute ghost, furniture, lamp, wardrobe, capture orb.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-map route with time pressure
- **Timer / target:** 300 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Full-map escape/treasure challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 19 — Construction Worker

**Category:** Task
**Base difficulty:** Easy–Medium
**Concept:** Move construction materials in the correct order to complete small structures.
**Core loop:** Read build step → fetch material → place in zone → next step.
**Player character / vehicle:** Construction worker.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.
**Reusable systems:** Pickup/drop, sequence tasks, snap zones, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Construction worker.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Construction Worker** containing: Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Garden Shed

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Garden Shed interpreted in the visual language of **Construction Worker**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Garden Shed** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 ordered construction placement steps.
- **3D objects used:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Tiny House

- **Difficulty:** Easy
- **Environment / look:** Tiny House interpreted in the visual language of **Construction Worker**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Tiny House** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 ordered construction placement steps.
- **3D objects used:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Garage

- **Difficulty:** Medium
- **Environment / look:** Garage interpreted in the visual language of **Construction Worker**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Garage** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 ordered construction placement steps.
- **3D objects used:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Shop Front

- **Difficulty:** Hard
- **Environment / look:** Shop Front interpreted in the visual language of **Construction Worker**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Shop Front** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 ordered construction placement steps.
- **3D objects used:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Mini Tower

- **Difficulty:** Challenge
- **Environment / look:** Mini Tower interpreted in the visual language of **Construction Worker**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Mini Tower** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 ordered construction placement steps.
- **3D objects used:** Brick stack, wood beam, window frame, roof piece, wheelbarrow, toolbox.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 20 — Alien Farm

**Category:** Task
**Base difficulty:** Easy–Medium
**Concept:** A small alien harvests unusual crops and delivers them to a spaceship.
**Core loop:** Harvest → carry → avoid odd plants → deliver → upgrade score streak.
**Player character / vehicle:** Friendly alien farmer.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.
**Reusable systems:** Harvest, carry/delivery, collectibles, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Friendly alien farmer.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Alien Farm** containing: Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Starter Plot

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Starter Plot interpreted in the visual language of **Alien Farm**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Starter Plot** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Harvest and deliver 6 alien crops.
- **3D objects used:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Crystal Farm

- **Difficulty:** Easy
- **Environment / look:** Crystal Farm interpreted in the visual language of **Alien Farm**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Crystal Farm** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Harvest and deliver 10 alien crops.
- **3D objects used:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Glow Marsh

- **Difficulty:** Medium
- **Environment / look:** Glow Marsh interpreted in the visual language of **Alien Farm**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Glow Marsh** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Harvest and deliver 14 alien crops.
- **3D objects used:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Meteor Field

- **Difficulty:** Hard
- **Environment / look:** Meteor Field interpreted in the visual language of **Alien Farm**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Meteor Field** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Harvest and deliver 18 alien crops.
- **3D objects used:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Grand Alien Harvest

- **Difficulty:** Challenge
- **Environment / look:** Grand Alien Harvest interpreted in the visual language of **Alien Farm**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Grand Alien Harvest** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Harvest and deliver 24 alien crops.
- **3D objects used:** Alien crop, strange plant, crate, mini tractor, spaceship, rock.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 21 — Mini Golf 3D

**Category:** Skill
**Base difficulty:** Easy–Medium
**Concept:** Compact stylized mini-golf courses with simple aim and power controls.
**Core loop:** Aim → set power → hit → evaluate → next stroke/hole.
**Player character / vehicle:** No character required; optional mascot.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.
**Reusable systems:** Ball physics, stroke count, hole progression.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: No character required; optional mascot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Mini Golf 3D** containing: Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Garden Course

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Garden Course interpreted in the visual language of **Mini Golf 3D**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Garden Course** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Finish 3 holes at or below the level par target.
- **3D objects used:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Ramp Course

- **Difficulty:** Easy
- **Environment / look:** Ramp Course interpreted in the visual language of **Mini Golf 3D**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Ramp Course** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Finish 4 holes at or below the level par target.
- **3D objects used:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Windmill Course

- **Difficulty:** Medium
- **Environment / look:** Windmill Course interpreted in the visual language of **Mini Golf 3D**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Windmill Course** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Finish 5 holes at or below the level par target.
- **3D objects used:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Neon Course

- **Difficulty:** Hard
- **Environment / look:** Neon Course interpreted in the visual language of **Mini Golf 3D**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Neon Course** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Finish 6 holes at or below the level par target.
- **3D objects used:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Master Course

- **Difficulty:** Challenge
- **Environment / look:** Master Course interpreted in the visual language of **Mini Golf 3D**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Master Course** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Finish 9 holes at or below the level par target.
- **3D objects used:** Golf ball, hole, flag, ramp, windmill obstacle, tunnel.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 22 — Robot Factory Sorter

**Category:** Task
**Base difficulty:** Easy
**Concept:** Sort factory parts into matching bins while the conveyor speeds up.
**Core loop:** Identify part → grab → place in correct bin → maintain streak.
**Player character / vehicle:** Factory robot.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Conveyor, gear, battery, cube part, colored bin, warning light.
**Reusable systems:** Conveyor, pickup/drop, matching, combo.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Factory robot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Robot Factory Sorter** containing: Conveyor, gear, battery, cube part, colored bin, warning light.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Basic Sort

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Basic Sort interpreted in the visual language of **Robot Factory Sorter**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Basic Sort** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly sort 12 factory parts.
- **3D objects used:** Conveyor, gear, battery, cube part, colored bin, warning light.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Shape Sort

- **Difficulty:** Easy
- **Environment / look:** Shape Sort interpreted in the visual language of **Robot Factory Sorter**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Shape Sort** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly sort 20 factory parts.
- **3D objects used:** Conveyor, gear, battery, cube part, colored bin, warning light.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Color + Shape

- **Difficulty:** Medium
- **Environment / look:** Color + Shape interpreted in the visual language of **Robot Factory Sorter**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Color + Shape** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly sort 28 factory parts.
- **3D objects used:** Conveyor, gear, battery, cube part, colored bin, warning light.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Fast Factory

- **Difficulty:** Hard
- **Environment / look:** Fast Factory interpreted in the visual language of **Robot Factory Sorter**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Fast Factory** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly sort 38 factory parts.
- **3D objects used:** Conveyor, gear, battery, cube part, colored bin, warning light.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Overdrive

- **Difficulty:** Challenge
- **Environment / look:** Overdrive interpreted in the visual language of **Robot Factory Sorter**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Overdrive** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Correctly sort 50 factory parts.
- **3D objects used:** Conveyor, gear, battery, cube part, colored bin, warning light.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 23 — Pirate Cannon Battle

**Category:** Skill
**Base difficulty:** Easy–Medium
**Concept:** Aim and fire a ship cannon at targets and enemy boats.
**Core loop:** Aim → charge power → fire → hit target → chain combo.
**Player character / vehicle:** Pirate gunner.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Cannon, cannonball, target barrel, ship section, crate, island target.
**Reusable systems:** Projectile physics, aim/power, targets, score.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Pirate gunner.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Pirate Cannon Battle** containing: Cannon, cannonball, target barrel, ship section, crate, island target.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Training Deck

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Training Deck interpreted in the visual language of **Pirate Cannon Battle**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Training Deck** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 5 targets with limited cannonballs.
- **3D objects used:** Cannon, cannonball, target barrel, ship section, crate, island target.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Harbor Targets

- **Difficulty:** Easy
- **Environment / look:** Harbor Targets interpreted in the visual language of **Pirate Cannon Battle**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Harbor Targets** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 8 targets with limited cannonballs.
- **3D objects used:** Cannon, cannonball, target barrel, ship section, crate, island target.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Moving Boats

- **Difficulty:** Medium
- **Environment / look:** Moving Boats interpreted in the visual language of **Pirate Cannon Battle**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Moving Boats** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 12 targets with limited cannonballs.
- **3D objects used:** Cannon, cannonball, target barrel, ship section, crate, island target.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Storm Battle

- **Difficulty:** Hard
- **Environment / look:** Storm Battle interpreted in the visual language of **Pirate Cannon Battle**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Storm Battle** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 16 targets with limited cannonballs.
- **3D objects used:** Cannon, cannonball, target barrel, ship section, crate, island target.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Captain Challenge

- **Difficulty:** Challenge
- **Environment / look:** Captain Challenge interpreted in the visual language of **Pirate Cannon Battle**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Captain Challenge** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 20 targets with limited cannonballs.
- **3D objects used:** Cannon, cannonball, target barrel, ship section, crate, island target.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 24 — Castle Defender

**Category:** Skill
**Base difficulty:** Medium
**Concept:** Defend a stylized castle from waves of harmless fantasy invaders using simple ranged mechanics.
**Core loop:** Target lane → fire/throw → stop wave → earn score → next wave.
**Player character / vehicle:** Young castle defender.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.
**Reusable systems:** Wave spawner, projectile, target lanes, score.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Young castle defender.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Castle Defender** containing: Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Outer Wall

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Outer Wall interpreted in the visual language of **Castle Defender**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Outer Wall** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Survive 3 short waves while keeping the castle gate intact.
- **3D objects used:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Main Gate

- **Difficulty:** Easy
- **Environment / look:** Main Gate interpreted in the visual language of **Castle Defender**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Main Gate** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Survive 4 short waves while keeping the castle gate intact.
- **3D objects used:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Twin Towers

- **Difficulty:** Medium
- **Environment / look:** Twin Towers interpreted in the visual language of **Castle Defender**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Twin Towers** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Survive 5 short waves while keeping the castle gate intact.
- **3D objects used:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Night Siege

- **Difficulty:** Hard
- **Environment / look:** Night Siege interpreted in the visual language of **Castle Defender**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Night Siege** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Survive 6 short waves while keeping the castle gate intact.
- **3D objects used:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Royal Defense

- **Difficulty:** Challenge
- **Environment / look:** Royal Defense interpreted in the visual language of **Castle Defender**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Royal Defense** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Survive 8 short waves while keeping the castle gate intact.
- **3D objects used:** Castle wall, cannon, training dummy enemy, barrel, gate, flag.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 25 — Penguin Ice Slide

**Category:** Runner
**Base difficulty:** Easy–Medium
**Concept:** Slide downhill as a penguin, collect fish and avoid obstacles.
**Core loop:** Steer → collect fish → dodge rock → hit boost → continue.
**Player character / vehicle:** Stylized penguin.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Fish, ice ramp, snow rock, ice arch, boost pad.
**Reusable systems:** SlideController, obstacle spawning, collectibles, speed.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized penguin.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Penguin Ice Slide** containing: Fish, ice ramp, snow rock, ice arch, boost pad.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Snow Hill

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Snow Hill interpreted in the visual language of **Penguin Ice Slide**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Snow Hill**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish and collect 10 fish.
- **3D objects used:** Fish, ice ramp, snow rock, ice arch, boost pad.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Ice Cave

- **Difficulty:** Easy
- **Environment / look:** Ice Cave interpreted in the visual language of **Penguin Ice Slide**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Ice Cave**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish and collect 15 fish.
- **3D objects used:** Fish, ice ramp, snow rock, ice arch, boost pad.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Frozen Lake

- **Difficulty:** Medium
- **Environment / look:** Frozen Lake interpreted in the visual language of **Penguin Ice Slide**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Frozen Lake**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish and collect 20 fish.
- **3D objects used:** Fish, ice ramp, snow rock, ice arch, boost pad.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Aurora Run

- **Difficulty:** Hard
- **Environment / look:** Aurora Run interpreted in the visual language of **Penguin Ice Slide**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **Aurora Run**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish and collect 25 fish.
- **3D objects used:** Fish, ice ramp, snow rock, ice arch, boost pad.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Glacier Sprint

- **Difficulty:** Challenge
- **Environment / look:** Glacier Sprint interpreted in the visual language of **Penguin Ice Slide**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Glacier Sprint**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish and collect 30 fish.
- **3D objects used:** Fish, ice ramp, snow rock, ice arch, boost pad.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 26 — Space Repair Mission

**Category:** Runner
**Base difficulty:** Medium
**Concept:** Repair several systems around a compact space station before the timer runs out.
**Core loop:** Navigate → find broken panel → repair interaction → next system → return.
**Player character / vehicle:** Stylized astronaut.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Repair panel, battery module, antenna, toolbox, station door, cable unit.
**Reusable systems:** Task list, interaction, waypoint, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized astronaut.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Space Repair Mission** containing: Repair panel, battery module, antenna, toolbox, station door, cable unit.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Docking Bay

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Docking Bay interpreted in the visual language of **Space Repair Mission**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Docking Bay**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Repair 2 station systems and return to the safe module.
- **3D objects used:** Repair panel, battery module, antenna, toolbox, station door, cable unit.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Power Wing

- **Difficulty:** Easy
- **Environment / look:** Power Wing interpreted in the visual language of **Space Repair Mission**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Power Wing**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Repair 3 station systems and return to the safe module.
- **3D objects used:** Repair panel, battery module, antenna, toolbox, station door, cable unit.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Comms Wing

- **Difficulty:** Medium
- **Environment / look:** Comms Wing interpreted in the visual language of **Space Repair Mission**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Comms Wing**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Repair 4 station systems and return to the safe module.
- **3D objects used:** Repair panel, battery module, antenna, toolbox, station door, cable unit.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — External Platform

- **Difficulty:** Hard
- **Environment / look:** External Platform interpreted in the visual language of **Space Repair Mission**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **External Platform**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Repair 5 station systems and return to the safe module.
- **3D objects used:** Repair panel, battery module, antenna, toolbox, station door, cable unit.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Station Emergency

- **Difficulty:** Challenge
- **Environment / look:** Station Emergency interpreted in the visual language of **Space Repair Mission**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Station Emergency**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Repair 6 station systems and return to the safe module.
- **3D objects used:** Repair panel, battery module, antenna, toolbox, station door, cable unit.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 27 — Monster Kitchen

**Category:** Task
**Base difficulty:** Easy–Medium
**Concept:** A funny monster chef prepares strange ingredient combinations.
**Core loop:** Read order → collect ingredients → assemble → serve → combo.
**Player character / vehicle:** Friendly monster chef.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.
**Reusable systems:** Order queue, pickup, assembly, timer, accuracy.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Friendly monster chef.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Monster Kitchen** containing: Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Snack Bar

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Snack Bar interpreted in the visual language of **Monster Kitchen**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Snack Bar** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 3 correct fantasy food orders.
- **3D objects used:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Monster Café

- **Difficulty:** Easy
- **Environment / look:** Monster Café interpreted in the visual language of **Monster Kitchen**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Monster Café** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 5 correct fantasy food orders.
- **3D objects used:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Busy Kitchen

- **Difficulty:** Medium
- **Environment / look:** Busy Kitchen interpreted in the visual language of **Monster Kitchen**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Busy Kitchen** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 7 correct fantasy food orders.
- **3D objects used:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Dinner Rush

- **Difficulty:** Hard
- **Environment / look:** Dinner Rush interpreted in the visual language of **Monster Kitchen**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Dinner Rush** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 9 correct fantasy food orders.
- **3D objects used:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Grand Feast

- **Difficulty:** Challenge
- **Environment / look:** Grand Feast interpreted in the visual language of **Monster Kitchen**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Grand Feast** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 12 correct fantasy food orders.
- **3D objects used:** Plate, burger bun, cheese, fantasy ingredient, pan, counter, serving bell.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 28 — Knight Training Arena

**Category:** Skill
**Base difficulty:** Medium
**Concept:** Hit training dummies and reaction targets in a fantasy practice arena.
**Core loop:** Move → target dummy → attack → combo → next target.
**Player character / vehicle:** Young stylized knight.
**Controls:** Keyboard/Mouse: aim or direction controls + primary action; Mobile: drag/tap to aim and a large action button.
**Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
**Required 3D assets:** Training dummy, wooden shield target, barrel, arena fence, score banner.
**Reusable systems:** Simple melee hitbox, target activation, combo, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Young stylized knight.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Knight Training Arena** containing: Training dummy, wooden shield target, barrel, arena fence, score banner.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Basic Training

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Basic Training interpreted in the visual language of **Knight Training Arena**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Basic Training** challenge arena/course with 3 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 8 training targets and maintain combo accuracy.
- **3D objects used:** Training dummy, wooden shield target, barrel, arena fence, score banner.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Stationary targets
- **Timer / target:** 5–8 attempts / 90 sec
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Teach aim/timing with stationary targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Moving Targets

- **Difficulty:** Easy
- **Environment / look:** Moving Targets interpreted in the visual language of **Knight Training Arena**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Moving Targets** challenge arena/course with 4 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 12 training targets and maintain combo accuracy.
- **3D objects used:** Training dummy, wooden shield target, barrel, arena fence, score banner.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Longer distance
- **Timer / target:** 8–10 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add distance or moving targets.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Timed Course

- **Difficulty:** Medium
- **Environment / look:** Timed Course interpreted in the visual language of **Knight Training Arena**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Timed Course** challenge arena/course with 5 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 18 training targets and maintain combo accuracy.
- **3D objects used:** Training dummy, wooden shield target, barrel, arena fence, score banner.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving targets
- **Timer / target:** 10–12 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add combo scoring and tighter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Combo Arena

- **Difficulty:** Hard
- **Environment / look:** Combo Arena interpreted in the visual language of **Knight Training Arena**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Combo Arena** challenge arena/course with 6 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 24 training targets and maintain combo accuracy.
- **3D objects used:** Training dummy, wooden shield target, barrel, arena fence, score banner.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smaller/faster targets
- **Timer / target:** 12–15 attempts
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Add pressure through speed and target variety.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Royal Trial

- **Difficulty:** Challenge
- **Environment / look:** Royal Trial interpreted in the visual language of **Knight Training Arena**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Royal Trial** challenge arena/course with 8 target positions or stations and clear scoring feedback.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Hit 30 training targets and maintain combo accuracy.
- **3D objects used:** Training dummy, wooden shield target, barrel, arena fence, score banner.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed target types + strict attempt limit
- **Timer / target:** Score-attack challenge
- **Camera:** Fixed or semi-fixed gameplay camera chosen to keep targets and player readable.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the target score/accuracy/goal count within the allowed attempts.
- **Lose condition:** attempts/time expire before the target is reached.
- **New mechanic / progression:** Master challenge with all target types and high-score rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 29 — Zoo Escape

**Category:** Arcade
**Base difficulty:** Medium
**Concept:** A playful animal navigates a zoo map while avoiding patrolling keepers and reaching the exit.
**Core loop:** Move → hide/use shortcut → avoid patrol → reach checkpoint → exit.
**Player character / vehicle:** Stylized zoo animal.
**Controls:** Keyboard: WASD/Arrows + contextual action; Mobile: virtual stick + action button.
**Camera:** Third-person arcade camera with stable framing.
**Required 3D assets:** Bush, rock, fence, gate, bench, food crate, directional sign.
**Reusable systems:** Stealth-lite patrol AI, checkpoints, hiding zones.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized zoo animal.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Zoo Escape** containing: Bush, rock, fence, gate, bench, food crate, directional sign.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Enclosure

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Enclosure interpreted in the visual language of **Zoo Escape**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Enclosure** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach 2 stealth checkpoints and escape without exhausting alert lives.
- **3D objects used:** Bush, rock, fence, gate, bench, food crate, directional sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Low
- **Timer / target:** 90 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Teach the primary interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Safari Zone

- **Difficulty:** Easy
- **Environment / look:** Safari Zone interpreted in the visual language of **Zoo Escape**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Safari Zone** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach 3 stealth checkpoints and escape without exhausting alert lives.
- **3D objects used:** Bush, rock, fence, gate, bench, food crate, directional sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Low–Medium
- **Timer / target:** 120 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Add one new rule.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Bird Garden

- **Difficulty:** Medium
- **Environment / look:** Bird Garden interpreted in the visual language of **Zoo Escape**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Bird Garden** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach 4 stealth checkpoints and escape without exhausting alert lives.
- **3D objects used:** Bush, rock, fence, gate, bench, food crate, directional sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Medium
- **Timer / target:** 150 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Combine two mechanics.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Central Zoo

- **Difficulty:** Hard
- **Environment / look:** Central Zoo interpreted in the visual language of **Zoo Escape**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Central Zoo** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach 5 stealth checkpoints and escape without exhausting alert lives.
- **3D objects used:** Bush, rock, fence, gate, bench, food crate, directional sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** High
- **Timer / target:** 180 sec
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** Increase speed/complexity.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Night Escape

- **Difficulty:** Challenge
- **Environment / look:** Night Escape interpreted in the visual language of **Zoo Escape**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Night Escape** arcade arena with clear start, objective zones and finish/result area.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach 6 stealth checkpoints and escape without exhausting alert lives.
- **3D objects used:** Bush, rock, fence, gate, bench, food crate, directional sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** High / mixed
- **Timer / target:** High-score challenge
- **Camera:** Third-person arcade camera with stable framing.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the objective target.
- **Lose condition:** fail the timer/life condition.
- **New mechanic / progression:** High-score mastery challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 30 — Rocket Landing Challenge

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Control a small rocket using thrust and rotation to land safely on platforms.
**Core loop:** Control descent → correct angle → manage thrust → land → score.
**Player character / vehicle:** Rocket vehicle.
**Controls:** Keyboard: WASD/Arrows for direction, Space/Shift for vertical or thrust action; Mobile: left virtual stick + action/thrust button.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Rocket, landing pad, fuel pickup, rock tower, beacon.
**Reusable systems:** 2D/3D flight physics, fuel, landing detection, score.

### Hyper3D — main character / vehicle prompt
```text
Premium stylized 3D game-ready Rocket vehicle., original design, clear readable silhouette, compact proportions, medium-low polygon count, clean topology, matte/satin materials, optimized for browser/mobile 3D, no logos, no text, centered on a plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Rocket Landing Challenge** containing: Rocket, landing pad, fuel pickup, rock tower, beacon.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Moon Pad

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Moon Pad interpreted in the visual language of **Rocket Landing Challenge**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Moon Pad** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 2 controlled landings or one precision route with safe touchdown.
- **3D objects used:** Rocket, landing pad, fuel pickup, rock tower, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Wide Crater

- **Difficulty:** Easy
- **Environment / look:** Wide Crater interpreted in the visual language of **Rocket Landing Challenge**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Wide Crater** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 controlled landings or one precision route with safe touchdown.
- **3D objects used:** Rocket, landing pad, fuel pickup, rock tower, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Mars Ridge

- **Difficulty:** Medium
- **Environment / look:** Mars Ridge interpreted in the visual language of **Rocket Landing Challenge**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Mars Ridge** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 controlled landings or one precision route with safe touchdown.
- **3D objects used:** Rocket, landing pad, fuel pickup, rock tower, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Asteroid Base

- **Difficulty:** Hard
- **Environment / look:** Asteroid Base interpreted in the visual language of **Rocket Landing Challenge**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Asteroid Base** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 controlled landings or one precision route with safe touchdown.
- **3D objects used:** Rocket, landing pad, fuel pickup, rock tower, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Precision Landing

- **Difficulty:** Challenge
- **Environment / look:** Precision Landing interpreted in the visual language of **Rocket Landing Challenge**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Precision Landing** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 controlled landings or one precision route with safe touchdown.
- **3D objects used:** Rocket, landing pad, fuel pickup, rock tower, beacon.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 31 — Firefighter Rescue

**Category:** Task
**Base difficulty:** Medium
**Concept:** Enter small buildings, extinguish fire points and escort NPCs to safety.
**Core loop:** Enter → extinguish → locate NPC → escort → next room.
**Player character / vehicle:** Firefighter + reusable civilian NPC.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet, exit sign; fire/smoke via particles.
**Reusable systems:** CharacterController, interact, task list, NPC follow, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Firefighter + reusable civilian NPC.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Firefighter Rescue** containing: Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet, exit sign; fire/smoke via particles.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Apartment

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Apartment interpreted in the visual language of **Firefighter Rescue**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Apartment** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Extinguish 2 fire points and escort 1 civilian NPC(s) to the exit.
- **3D objects used:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Light smoke zones
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Family House

- **Difficulty:** Easy
- **Environment / look:** Family House interpreted in the visual language of **Firefighter Rescue**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Family House** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Extinguish 4 fire points and escort 2 civilian NPC(s) to the exit.
- **3D objects used:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Fire blocks one route
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Office

- **Difficulty:** Medium
- **Environment / look:** Office interpreted in the visual language of **Firefighter Rescue**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Office** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Extinguish 6 fire points and escort 3 civilian NPC(s) to the exit.
- **3D objects used:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Smoke + locked door
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Hotel

- **Difficulty:** Hard
- **Environment / look:** Hotel interpreted in the visual language of **Firefighter Rescue**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Hotel** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Extinguish 8 fire points and escort 4 civilian NPC(s) to the exit.
- **3D objects used:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple hot zones
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Warehouse

- **Difficulty:** Challenge
- **Environment / look:** Warehouse interpreted in the visual language of **Firefighter Rescue**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Warehouse** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Extinguish 10 fire points and escort 5 civilian NPC(s) to the exit.
- **3D objects used:** Hose/extinguisher, hydrant, sofa, chair, door, bed, cabinet. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense smoke + moving/falling debris cues
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 32 — Taxi Rush 3D

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Pick up passengers and deliver them around a compact city.
**Core loop:** Drive to passenger → pickup → destination → drop-off → next fare.
**Player character / vehicle:** Taxi driver + passenger NPCs.
**Controls:** Keyboard: WASD/Arrows steer and accelerate/brake; Mobile: steering control + accelerate/brake buttons.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car, building modules.
**Reusable systems:** VehicleController, waypoint, passenger state, timer, score.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Taxi driver + passenger NPCs.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Taxi Rush 3D** containing: Taxi, traffic light, lamp, bus stop, bench, cone, parked car, building modules.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Quiet Neighborhood

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Quiet Neighborhood interpreted in the visual language of **Taxi Rush 3D**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Quiet Neighborhood** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 passenger rides with correct pickups and drop-offs.
- **3D objects used:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Minimal traffic
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Downtown

- **Difficulty:** Easy
- **Environment / look:** Downtown interpreted in the visual language of **Taxi Rush 3D**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Downtown** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 passenger rides with correct pickups and drop-offs.
- **3D objects used:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Intersections
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Shopping District

- **Difficulty:** Medium
- **Environment / look:** Shopping District interpreted in the visual language of **Taxi Rush 3D**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Shopping District** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 passenger rides with correct pickups and drop-offs.
- **3D objects used:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moderate traffic
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Night City

- **Difficulty:** Hard
- **Environment / look:** Night City interpreted in the visual language of **Taxi Rush 3D**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Night City** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 passenger rides with correct pickups and drop-offs.
- **3D objects used:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Night visibility + traffic
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Rush Hour

- **Difficulty:** Challenge
- **Environment / look:** Rush Hour interpreted in the visual language of **Taxi Rush 3D**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Rush Hour** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 passenger rides with correct pickups and drop-offs.
- **3D objects used:** Taxi, traffic light, lamp, bus stop, bench, cone, parked car. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense rush-hour traffic
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 33 — Burger Delivery Scooter

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Deliver food around a mini-city using a scooter.
**Core loop:** Accept order → ride route → deliver → keep quality high → next order.
**Player character / vehicle:** Delivery rider.
**Controls:** Keyboard: WASD/Arrows steer and accelerate/brake; Mobile: steering control + accelerate/brake buttons.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.
**Reusable systems:** VehicleController, delivery queue, quality meter, combo.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Delivery rider.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Burger Delivery Scooter** containing: Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Neighborhood

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Neighborhood interpreted in the visual language of **Burger Delivery Scooter**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Neighborhood** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 food deliveries while keeping average order quality above 80%.
- **3D objects used:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — City Center

- **Difficulty:** Easy
- **Environment / look:** City Center interpreted in the visual language of **Burger Delivery Scooter**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **City Center** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 food deliveries while keeping average order quality above 80%.
- **3D objects used:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Park District

- **Difficulty:** Medium
- **Environment / look:** Park District interpreted in the visual language of **Burger Delivery Scooter**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Park District** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 food deliveries while keeping average order quality above 75%.
- **3D objects used:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Rainy City

- **Difficulty:** Hard
- **Environment / look:** Rainy City interpreted in the visual language of **Burger Delivery Scooter**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Rainy City** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 food deliveries while keeping average order quality above 70%.
- **3D objects used:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Night Delivery

- **Difficulty:** Challenge
- **Environment / look:** Night Delivery interpreted in the visual language of **Burger Delivery Scooter**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Night Delivery** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 food deliveries while keeping average order quality above 70%.
- **3D objects used:** Scooter, delivery box, burger bag, food box, restaurant counter, city props.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 34 — Beach Lifeguard

**Category:** Task
**Base difficulty:** Medium
**Concept:** Respond to rescue alerts across a busy beach.
**Core loop:** Alert → run/swim to target → interact → return to safe zone.
**Player character / vehicle:** Lifeguard + beach NPC.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.
**Reusable systems:** Movement, rescue target, timer, obstacles.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Lifeguard + beach NPC.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Beach Lifeguard** containing: Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Beach

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Beach interpreted in the visual language of **Beach Lifeguard**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Beach** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 2 rescue alerts and return each NPC to a safe zone.
- **3D objects used:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Busy Beach

- **Difficulty:** Easy
- **Environment / look:** Busy Beach interpreted in the visual language of **Beach Lifeguard**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Busy Beach** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 rescue alerts and return each NPC to a safe zone.
- **3D objects used:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Resort

- **Difficulty:** Medium
- **Environment / look:** Resort interpreted in the visual language of **Beach Lifeguard**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Resort** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 rescue alerts and return each NPC to a safe zone.
- **3D objects used:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Waterpark

- **Difficulty:** Hard
- **Environment / look:** Waterpark interpreted in the visual language of **Beach Lifeguard**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Waterpark** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 rescue alerts and return each NPC to a safe zone.
- **3D objects used:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Stormy Beach

- **Difficulty:** Challenge
- **Environment / look:** Stormy Beach interpreted in the visual language of **Beach Lifeguard**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Stormy Beach** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 rescue alerts and return each NPC to a safe zone.
- **3D objects used:** Lifeguard tower, rescue float, umbrella, chair, surfboard, buoy, cooler.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 35 — Farm Tractor Challenge

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Complete farming tasks with a stylized tractor.
**Core loop:** Drive → collect/transport → pass route → park/finish.
**Player character / vehicle:** Farmer.
**Controls:** Keyboard: WASD/Arrows steer and accelerate/brake; Mobile: steering control + accelerate/brake buttons.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Tractor, hay bale, crate, fence, barn, trailer, farm gate, scarecrow.
**Reusable systems:** VehicleController, route checkpoints, carry/transport, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Farmer.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Farm Tractor Challenge** containing: Tractor, hay bale, crate, fence, barn, trailer, farm gate, scarecrow.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Farm Yard

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Farm Yard interpreted in the visual language of **Farm Tractor Challenge**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Farm Yard** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 2 farm route/task objectives without exceeding collision limits.
- **3D objects used:** Tractor, hay bale, crate, fence, barn, trailer, farm gate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Wheat Field

- **Difficulty:** Easy
- **Environment / look:** Wheat Field interpreted in the visual language of **Farm Tractor Challenge**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Wheat Field** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 farm route/task objectives without exceeding collision limits.
- **3D objects used:** Tractor, hay bale, crate, fence, barn, trailer, farm gate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Orchard

- **Difficulty:** Medium
- **Environment / look:** Orchard interpreted in the visual language of **Farm Tractor Challenge**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Orchard** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 farm route/task objectives without exceeding collision limits.
- **3D objects used:** Tractor, hay bale, crate, fence, barn, trailer, farm gate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Mud Farm

- **Difficulty:** Hard
- **Environment / look:** Mud Farm interpreted in the visual language of **Farm Tractor Challenge**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Mud Farm** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 farm route/task objectives without exceeding collision limits.
- **3D objects used:** Tractor, hay bale, crate, fence, barn, trailer, farm gate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Mega Farm

- **Difficulty:** Challenge
- **Environment / look:** Mega Farm interpreted in the visual language of **Farm Tractor Challenge**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Mega Farm** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 farm route/task objectives without exceeding collision limits.
- **3D objects used:** Tractor, hay bale, crate, fence, barn, trailer, farm gate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 36 — Cat vs Robot Vacuum

**Category:** Collect
**Base difficulty:** Easy
**Concept:** Collect cat treats while avoiding one or more robot vacuums.
**Core loop:** Find treat → dodge vacuum → use safe furniture → continue.
**Player character / vehicle:** Stylized cat with 5 optional color/collar skins.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with collectible visibility priority.
**Required 3D assets:** Robot vacuum, treat, cat toy, sofa, table, chair, bed, shelf, cardboard box.
**Reusable systems:** CharacterController, chase AI, safe zones, collectibles.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized cat with 5 optional color/collar skins.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Cat vs Robot Vacuum** containing: Robot vacuum, treat, cat toy, sofa, table, chair, bed, shelf, cardboard box.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Living Room

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Living Room interpreted in the visual language of **Cat vs Robot Vacuum**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Living Room** collection area with targets distributed across 2 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 8 treats while avoiding 1 robot vacuum(s).
- **3D objects used:** Robot vacuum, treat, cat toy, sofa, table, chair, bed. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** 1 slow vacuum
- **Timer / target:** 90 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Teach collection and delivery/return loop.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Kitchen

- **Difficulty:** Easy
- **Environment / look:** Kitchen interpreted in the visual language of **Cat vs Robot Vacuum**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Kitchen** collection area with targets distributed across 3 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 12 treats while avoiding 1 robot vacuum(s).
- **3D objects used:** Robot vacuum, treat, cat toy, sofa, table, chair, bed. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** 1 faster vacuum
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Increase target count and map size.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Bedroom

- **Difficulty:** Medium
- **Environment / look:** Bedroom interpreted in the visual language of **Cat vs Robot Vacuum**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Bedroom** collection area with targets distributed across 4 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 16 treats while avoiding 2 robot vacuum(s).
- **3D objects used:** Robot vacuum, treat, cat toy, sofa, table, chair, bed. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** 2 vacuums
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add moving hazards or target matching.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Kids Room

- **Difficulty:** Hard
- **Environment / look:** Kids Room interpreted in the visual language of **Cat vs Robot Vacuum**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Kids Room** collection area with targets distributed across 5 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 20 treats while avoiding 2 robot vacuum(s).
- **3D objects used:** Robot vacuum, treat, cat toy, sofa, table, chair, bed. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** 2 fast vacuums + toy clutter
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add resource/time pressure.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Whole House

- **Difficulty:** Challenge
- **Environment / look:** Whole House interpreted in the visual language of **Cat vs Robot Vacuum**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Whole House** collection area with targets distributed across 6 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect 25 treats while avoiding 3 robot vacuum(s).
- **3D objects used:** Robot vacuum, treat, cat toy, sofa, table, chair, bed. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** 3 vacuums across connected rooms
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Large score-attack map using all collectible rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 37 — Hotel Bellboy Rush

**Category:** Task
**Base difficulty:** Medium
**Concept:** Deliver luggage to correct hotel rooms under time pressure.
**Core loop:** Pick luggage → read room → use elevator/corridor → deliver.
**Player character / vehicle:** Bellboy + guest NPC.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa, key card.
**Reusable systems:** Pickup/drop, destination, elevator state, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Bellboy + guest NPC.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Hotel Bellboy Rush** containing: Suitcase, trolley, reception desk, bell, elevator door, room door, sofa, key card.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Lobby Floor

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Lobby Floor interpreted in the visual language of **Hotel Bellboy Rush**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Lobby Floor** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 3 luggage items to the correct room numbers.
- **3D objects used:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — 3-Floor Hotel

- **Difficulty:** Easy
- **Environment / look:** 3-Floor Hotel interpreted in the visual language of **Hotel Bellboy Rush**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **3-Floor Hotel** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 5 luggage items to the correct room numbers.
- **3D objects used:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Luxury Hotel

- **Difficulty:** Medium
- **Environment / look:** Luxury Hotel interpreted in the visual language of **Hotel Bellboy Rush**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Luxury Hotel** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 7 luggage items to the correct room numbers.
- **3D objects used:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Business Hotel

- **Difficulty:** Hard
- **Environment / look:** Business Hotel interpreted in the visual language of **Hotel Bellboy Rush**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Business Hotel** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 9 luggage items to the correct room numbers.
- **3D objects used:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Grand Hotel

- **Difficulty:** Challenge
- **Environment / look:** Grand Hotel interpreted in the visual language of **Hotel Bellboy Rush**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Grand Hotel** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 12 luggage items to the correct room numbers.
- **3D objects used:** Suitcase, trolley, reception desk, bell, elevator door, room door, sofa. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 38 — Wizard Potion Lab

**Category:** Task
**Base difficulty:** Medium
**Concept:** Collect potion ingredients in the correct recipe order.
**Core loop:** Read recipe → collect ingredients → add to cauldron → complete potion.
**Player character / vehicle:** Young wizard, optionally 5 robe colors.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb, book, candle, shelf.
**Reusable systems:** Recipe sequence, pickup/drop, timer, VFX.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Young wizard, optionally 5 robe colors.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Wizard Potion Lab** containing: Cauldron, potion bottle, mushroom, crystal, berry, flower, herb, book, candle, shelf.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Beginner Lab

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Beginner Lab interpreted in the visual language of **Wizard Potion Lab**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Beginner Lab** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 2 potion recipes with 2 ingredients per advanced recipe.
- **3D objects used:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No hazard
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Mushroom Lab

- **Difficulty:** Easy
- **Environment / look:** Mushroom Lab interpreted in the visual language of **Wizard Potion Lab**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Mushroom Lab** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 potion recipes with 3 ingredients per advanced recipe.
- **3D objects used:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wrong ingredient penalty
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Crystal Lab

- **Difficulty:** Medium
- **Environment / look:** Crystal Lab interpreted in the visual language of **Wizard Potion Lab**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Crystal Lab** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 potion recipes with 4 ingredients per advanced recipe.
- **3D objects used:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving ingredient spawns
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Forest Lab

- **Difficulty:** Hard
- **Environment / look:** Forest Lab interpreted in the visual language of **Wizard Potion Lab**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Forest Lab** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 potion recipes with 5 ingredients per advanced recipe.
- **3D objects used:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Recipe order pressure
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Master Wizard Lab

- **Difficulty:** Challenge
- **Environment / look:** Master Wizard Lab interpreted in the visual language of **Wizard Potion Lab**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Master Wizard Lab** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 potion recipes with 5 ingredients per advanced recipe.
- **3D objects used:** Cauldron, potion bottle, mushroom, crystal, berry, flower, herb. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple active recipes + time penalty
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 39 — Haunted Mansion Keys

**Category:** Explore
**Base difficulty:** Medium
**Concept:** Explore a playful mansion, find colored keys and unlock the route out.
**Core loop:** Explore → find key → open matching door → solve simple switch → escape.
**Player character / vehicle:** Explorer/detective.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
**Required 3D assets:** Recolorable key, door, chair, table, clock, painting frame, bookshelf, chest, switch.
**Reusable systems:** Inventory, door locks, interactions, randomized key placement.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Explorer/detective.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Haunted Mansion Keys** containing: Recolorable key, door, chair, table, clock, painting frame, bookshelf, chest, switch.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Entrance Hall

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Entrance Hall interpreted in the visual language of **Haunted Mansion Keys**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Entrance Hall** exploration map with 3 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 2 required key/switch objectives and unlock the exit.
- **3D objects used:** Recolorable key, door, chair, table, clock, painting frame, bookshelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** No active hazard
- **Timer / target:** 180 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Teach navigation and one key interaction.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Library

- **Difficulty:** Easy
- **Environment / look:** Library interpreted in the visual language of **Haunted Mansion Keys**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Library** exploration map with 5 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 3 required key/switch objectives and unlock the exit.
- **3D objects used:** Recolorable key, door, chair, table, clock, painting frame, bookshelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** One blocked path
- **Timer / target:** 210 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add branching rooms/paths.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Bedrooms

- **Difficulty:** Medium
- **Environment / look:** Bedrooms interpreted in the visual language of **Haunted Mansion Keys**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Bedrooms** exploration map with 7 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 3 required key/switch objectives and unlock the exit.
- **3D objects used:** Recolorable key, door, chair, table, clock, painting frame, bookshelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Branching/locked paths
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add multi-step clue/objective chains.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Basement

- **Difficulty:** Hard
- **Environment / look:** Basement interpreted in the visual language of **Haunted Mansion Keys**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Basement** exploration map with 9 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 4 required key/switch objectives and unlock the exit.
- **3D objects used:** Recolorable key, door, chair, table, clock, painting frame, bookshelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Randomized objective positions
- **Timer / target:** 240 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Add randomized placement or locked shortcuts.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Grand Mansion Escape

- **Difficulty:** Challenge
- **Environment / look:** Grand Mansion Escape interpreted in the visual language of **Haunted Mansion Keys**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Grand Mansion Escape** exploration map with 12 rooms/areas, at least one landmark, and progressively more branching paths.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Find 5 required key/switch objectives and unlock the exit.
- **3D objects used:** Recolorable key, door, chair, table, clock, painting frame, bookshelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-map route with time pressure
- **Timer / target:** 300 sec
- **Camera:** Third-person exploration camera; gentle collision avoidance and room-aware distance.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all required clues/keys/objectives and reach the final exit/treasure.
- **Lose condition:** timer reaches zero or the level-specific attempt limit is exhausted.
- **New mechanic / progression:** Full-map escape/treasure challenge.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 40 — Bee Garden

**Category:** Vehicle
**Base difficulty:** Easy
**Concept:** Fly between flowers, collect nectar and return to the hive.
**Core loop:** Fly → collect nectar → avoid obstacles → deposit at hive.
**Player character / vehicle:** Cute bee with optional color variants.
**Controls:** Keyboard: WASD/Arrows steer and accelerate/brake; Mobile: steering control + accelerate/brake buttons.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.
**Reusable systems:** FlightController, nectar capacity, deposit zone, stamina.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Cute bee with optional color variants.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Bee Garden** containing: Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Flower Garden

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Flower Garden interpreted in the visual language of **Bee Garden**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Flower Garden** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect and deposit 10 nectar units at the hive.
- **3D objects used:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Vegetable Garden

- **Difficulty:** Easy
- **Environment / look:** Vegetable Garden interpreted in the visual language of **Bee Garden**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Vegetable Garden** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect and deposit 15 nectar units at the hive.
- **3D objects used:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Greenhouse

- **Difficulty:** Medium
- **Environment / look:** Greenhouse interpreted in the visual language of **Bee Garden**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Greenhouse** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect and deposit 20 nectar units at the hive.
- **3D objects used:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Forest Flowers

- **Difficulty:** Hard
- **Environment / look:** Forest Flowers interpreted in the visual language of **Bee Garden**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Forest Flowers** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect and deposit 25 nectar units at the hive.
- **3D objects used:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Giant Garden

- **Difficulty:** Challenge
- **Environment / look:** Giant Garden interpreted in the visual language of **Bee Garden**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Giant Garden** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Collect and deposit 30 nectar units at the hive.
- **3D objects used:** Flowers A/B/C, hive, nectar orb, leaf, mushroom, branch, spider web.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 41 — Dog Park Fetch

**Category:** Collect
**Base difficulty:** Easy
**Concept:** Retrieve balls, frisbees and sticks and return them to the owner.
**Core loop:** Object thrown → chase → pickup/catch → return → combo.
**Player character / vehicle:** Stylized dog + owner NPC.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with collectible visibility priority.
**Required 3D assets:** Ball, frisbee, stick, treat, bench, tree, bush, fountain, fence, agility tunnel.
**Reusable systems:** Fetch target, pickup, return zone, combo, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized dog + owner NPC.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Dog Park Fetch** containing: Ball, frisbee, stick, treat, bench, tree, bush, fountain, fence, agility tunnel.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Park

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Park interpreted in the visual language of **Dog Park Fetch**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Park** collection area with targets distributed across 2 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 4 fetch objects; bonus for airborne frisbee catches.
- **3D objects used:** Ball, frisbee, stick, treat, bench, tree, bush. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Open collection area
- **Timer / target:** 90 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Teach collection and delivery/return loop.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — City Park

- **Difficulty:** Easy
- **Environment / look:** City Park interpreted in the visual language of **Dog Park Fetch**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **City Park** collection area with targets distributed across 3 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 6 fetch objects; bonus for airborne frisbee catches.
- **3D objects used:** Ball, frisbee, stick, treat, bench, tree, bush. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More spread targets
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Increase target count and map size.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Forest Park

- **Difficulty:** Medium
- **Environment / look:** Forest Park interpreted in the visual language of **Dog Park Fetch**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Forest Park** collection area with targets distributed across 4 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 8 fetch objects; bonus for airborne frisbee catches.
- **3D objects used:** Ball, frisbee, stick, treat, bench, tree, bush. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving hazards
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add moving hazards or target matching.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Beach Park

- **Difficulty:** Hard
- **Environment / look:** Beach Park interpreted in the visual language of **Dog Park Fetch**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Beach Park** collection area with targets distributed across 5 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 10 fetch objects; bonus for airborne frisbee catches.
- **3D objects used:** Ball, frisbee, stick, treat, bench, tree, bush. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Target matching/resource pressure
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Add resource/time pressure.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Dog Festival

- **Difficulty:** Challenge
- **Environment / look:** Dog Festival interpreted in the visual language of **Dog Park Fetch**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Dog Festival** collection area with targets distributed across 6 sub-zones and a clear return/finish point.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 12 fetch objects; bonus for airborne frisbee catches.
- **3D objects used:** Ball, frisbee, stick, treat, bench, tree, bush. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Large area + maximum density
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with collectible visibility priority.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** collect/deliver the target amount and reach the finish/return zone.
- **Lose condition:** timer/resource reaches zero or all allowed lives are lost.
- **New mechanic / progression:** Large score-attack map using all collectible rules.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 42 — Submarine Treasure Dive

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Pilot a mini-submarine to collect underwater treasure.
**Core loop:** Follow sonar → collect treasure → avoid rocks → manage battery → return.
**Player character / vehicle:** Mini-submarine acts as player character.
**Controls:** Keyboard: WASD/Arrows for direction, Space/Shift for vertical or thrust action; Mobile: left virtual stick + action/thrust button.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock, seaweed, anchor.
**Reusable systems:** UnderwaterVehicleController, sonar, battery, collectibles.

### Hyper3D — main character / vehicle prompt
```text
Premium stylized 3D game-ready Mini-submarine acts as player character., original design, clear readable silhouette, compact proportions, medium-low polygon count, clean topology, matte/satin materials, optimized for browser/mobile 3D, no logos, no text, centered on a plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Submarine Treasure Dive** containing: Submarine, treasure chest, pearl shell, coin, vase, coral, rock, seaweed, anchor.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Shallow Reef

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Shallow Reef interpreted in the visual language of **Submarine Treasure Dive**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Shallow Reef** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 3 treasure/sample objects and return to base with battery remaining.
- **3D objects used:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Coral Reef

- **Difficulty:** Easy
- **Environment / look:** Coral Reef interpreted in the visual language of **Submarine Treasure Dive**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Coral Reef** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 4 treasure/sample objects and return to base with battery remaining.
- **3D objects used:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Sunken Ship

- **Difficulty:** Medium
- **Environment / look:** Sunken Ship interpreted in the visual language of **Submarine Treasure Dive**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Sunken Ship** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 5 treasure/sample objects and return to base with battery remaining.
- **3D objects used:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Deep Cave

- **Difficulty:** Hard
- **Environment / look:** Deep Cave interpreted in the visual language of **Submarine Treasure Dive**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Deep Cave** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 6 treasure/sample objects and return to base with battery remaining.
- **3D objects used:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Ancient Ruins

- **Difficulty:** Challenge
- **Environment / look:** Ancient Ruins interpreted in the visual language of **Submarine Treasure Dive**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Ancient Ruins** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Recover 8 treasure/sample objects and return to base with battery remaining.
- **3D objects used:** Submarine, treasure chest, pearl shell, coin, vase, coral, rock. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 43 — Mars Rover Mission

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Drive a rover to scan sites, collect samples and return to base.
**Core loop:** Drive → scan marker → collect sample → recharge if needed → return.
**Player character / vehicle:** Mars rover vehicle.
**Controls:** Keyboard: WASD/Arrows steer and accelerate/brake; Mobile: steering control + accelerate/brake buttons.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate, charging station.
**Reusable systems:** VehicleController, scan interaction, battery, waypoint.

### Hyper3D — main character / vehicle prompt
```text
Premium stylized 3D game-ready Mars rover vehicle., original design, clear readable silhouette, compact proportions, medium-low polygon count, clean topology, matte/satin materials, optimized for browser/mobile 3D, no logos, no text, centered on a plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Mars Rover Mission** containing: Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate, charging station.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Landing Zone

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Landing Zone interpreted in the visual language of **Mars Rover Mission**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Landing Zone** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Scan 3 sites, collect samples and return to base.
- **3D objects used:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Rocky Plains

- **Difficulty:** Easy
- **Environment / look:** Rocky Plains interpreted in the visual language of **Mars Rover Mission**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Rocky Plains** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Scan 4 sites, collect samples and return to base.
- **3D objects used:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Mars Canyon

- **Difficulty:** Medium
- **Environment / look:** Mars Canyon interpreted in the visual language of **Mars Rover Mission**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Mars Canyon** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Scan 5 sites, collect samples and return to base.
- **3D objects used:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Crater

- **Difficulty:** Hard
- **Environment / look:** Crater interpreted in the visual language of **Mars Rover Mission**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Crater** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Scan 6 sites, collect samples and return to base.
- **3D objects used:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Ancient Mars Site

- **Difficulty:** Challenge
- **Environment / look:** Ancient Mars Site interpreted in the visual language of **Mars Rover Mission**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Ancient Mars Site** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Scan 7 sites, collect samples and return to base.
- **3D objects used:** Rover, Mars base, antenna, solar panel, sample rock, beacon, research crate. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 44 — Train Station Rush

**Category:** Task
**Base difficulty:** Medium
**Concept:** Move luggage/passengers to correct platforms before departures.
**Core loop:** Read platform → guide/carry → deliver → beat departure timer.
**Player character / vehicle:** Station worker + passenger NPCs.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.
**Reusable systems:** Task queue, destinations, train countdowns, pickup/drop.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Station worker + passenger NPCs.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Train Station Rush** containing: Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — 2 Platforms

- **Difficulty:** Tutorial / Easy
- **Environment / look:** 2 Platforms interpreted in the visual language of **Train Station Rush**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **2 Platforms** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Route 4 passengers/luggage tasks to the correct platforms before departure.
- **3D objects used:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — 4 Platforms

- **Difficulty:** Easy
- **Environment / look:** 4 Platforms interpreted in the visual language of **Train Station Rush**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **4 Platforms** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Route 6 passengers/luggage tasks to the correct platforms before departure.
- **3D objects used:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Central Station

- **Difficulty:** Medium
- **Environment / look:** Central Station interpreted in the visual language of **Train Station Rush**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Central Station** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Route 8 passengers/luggage tasks to the correct platforms before departure.
- **3D objects used:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Rush Hour

- **Difficulty:** Hard
- **Environment / look:** Rush Hour interpreted in the visual language of **Train Station Rush**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Rush Hour** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Route 10 passengers/luggage tasks to the correct platforms before departure.
- **3D objects used:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Mega Station

- **Difficulty:** Challenge
- **Environment / look:** Mega Station interpreted in the visual language of **Train Station Rush**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Mega Station** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Route 12 passengers/luggage tasks to the correct platforms before departure.
- **3D objects used:** Suitcase, backpack, luggage trolley, bench, ticket machine, station clock, platform sign.. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 45 — Pizza Kitchen 3D

**Category:** Task
**Base difficulty:** Medium
**Concept:** Prepare pizza orders accurately and quickly.
**Core loop:** Read order → dough → sauce → cheese → toppings → oven → serve.
**Player character / vehicle:** Pizza chef.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion, olive, peel, oven, box.
**Reusable systems:** Order queue, ingredient snapping, oven timer, accuracy.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Pizza chef.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Pizza Kitchen 3D** containing: Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion, olive, peel, oven, box.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Cheese Pizza

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Cheese Pizza interpreted in the visual language of **Pizza Kitchen 3D**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Cheese Pizza** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 3 correct pizza orders while maintaining order accuracy.
- **3D objects used:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Two Toppings

- **Difficulty:** Easy
- **Environment / look:** Two Toppings interpreted in the visual language of **Pizza Kitchen 3D**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Two Toppings** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 4 correct pizza orders while maintaining order accuracy.
- **3D objects used:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Restaurant Rush

- **Difficulty:** Medium
- **Environment / look:** Restaurant Rush interpreted in the visual language of **Pizza Kitchen 3D**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Restaurant Rush** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 6 correct pizza orders while maintaining order accuracy.
- **3D objects used:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Multiple Orders

- **Difficulty:** Hard
- **Environment / look:** Multiple Orders interpreted in the visual language of **Pizza Kitchen 3D**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Multiple Orders** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 8 correct pizza orders while maintaining order accuracy.
- **3D objects used:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Master Pizza Night

- **Difficulty:** Challenge
- **Environment / look:** Master Pizza Night interpreted in the visual language of **Pizza Kitchen 3D**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Master Pizza Night** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Serve 10 correct pizza orders while maintaining order accuracy.
- **3D objects used:** Pizza base, sauce, cheese, pepperoni, mushroom, tomato, onion. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 46 — Jungle Bridge Run

**Category:** Runner
**Base difficulty:** Medium
**Concept:** Short jungle obstacle course across bridges, logs and gaps.
**Core loop:** Run → jump gap → cross moving bridge → dodge log → finish.
**Player character / vehicle:** Explorer or reusable arcade hero.
**Controls:** Keyboard: Left/Right or A/D, Space/Up to jump, Down to slide where supported; Mobile: swipe/virtual buttons.
**Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
**Required 3D assets:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar, gem.
**Reusable systems:** Platformer, moving obstacles, timer, checkpoints.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Explorer or reusable arcade hero.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Jungle Bridge Run** containing: Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar, gem.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Jungle Path

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Jungle Path interpreted in the visual language of **Jungle Bridge Run**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact forward route themed as **Jungle Path**, split into 3 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 3 obstacle sections and collect optional gems.
- **3D objects used:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide safe gaps
- **Timer / target:** 60–75 sec target run
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Teach basic movement and one obstacle type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Rope Bridges

- **Difficulty:** Easy
- **Environment / look:** Rope Bridges interpreted in the visual language of **Jungle Bridge Run**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium forward route themed as **Rope Bridges**, split into 4 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 5 obstacle sections and collect optional gems.
- **3D objects used:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Static obstacle set
- **Timer / target:** 75–90 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Introduce a second obstacle and collectible line.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Waterfall

- **Difficulty:** Medium
- **Environment / look:** Waterfall interpreted in the visual language of **Jungle Bridge Run**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium forward route themed as **Waterfall**, split into 5 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 7 obstacle sections and collect optional gems.
- **3D objects used:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 90–110 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Combine obstacle types and add moving hazards.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Ancient Temple

- **Difficulty:** Hard
- **Environment / look:** Ancient Temple interpreted in the visual language of **Jungle Bridge Run**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large forward route themed as **Ancient Temple**, split into 6 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 9 obstacle sections and collect optional gems.
- **3D objects used:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Faster moving hazards
- **Timer / target:** 100–120 sec
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Increase speed and reduce recovery space.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Volcano Jungle

- **Difficulty:** Challenge
- **Environment / look:** Volcano Jungle interpreted in the visual language of **Jungle Bridge Run**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Volcano Jungle**, split into 8 readable obstacle segments with short recovery zones.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Reach the finish through 12 obstacle sections and collect optional gems.
- **3D objects used:** Wooden bridge, rope bridge, log, rock, vine, jungle plant, temple pillar. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Mixed hazards with minimal recovery space
- **Timer / target:** Endless/high-score or 120 sec challenge
- **Camera:** Third-person follow camera with forward look-ahead; minimal camera roll.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** reach the finish/checkpoint target and satisfy the required score/collectible condition.
- **Lose condition:** fall out of the playable area, lose all lives, or fail the time/route condition.
- **New mechanic / progression:** Use all mechanics together with high-score pacing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 47 — Magic Carpet Ride

**Category:** Vehicle
**Base difficulty:** Medium
**Concept:** Fly a magic carpet through rings and collect stars.
**Core loop:** Fly → pass ring → collect star → avoid obstacle → finish route.
**Player character / vehicle:** Fantasy rider.
**Controls:** Keyboard: WASD/Arrows for direction, Space/Shift for vertical or thrust action; Mobile: left virtual stick + action/thrust button.
**Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
**Required 3D assets:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud, lantern.
**Reusable systems:** FlightController, ring checkpoints, combo, collectibles.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Fantasy rider.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Magic Carpet Ride** containing: Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud, lantern.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Desert Village

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Desert Village interpreted in the visual language of **Magic Carpet Ride**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact navigable **Desert Village** route with 2 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Pass through 8 rings and collect at least 5 stars.
- **3D objects used:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Wide route / low hazard density
- **Timer / target:** 120 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Teach steering, stopping/landing and one objective.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Canyon

- **Difficulty:** Easy
- **Environment / look:** Canyon interpreted in the visual language of **Magic Carpet Ride**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium navigable **Canyon** route with 3 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Pass through 12 rings and collect at least 8 stars.
- **3D objects used:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Tighter turns
- **Timer / target:** 150 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add tighter turns or a second destination type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Cloud Kingdom

- **Difficulty:** Medium
- **Environment / look:** Cloud Kingdom interpreted in the visual language of **Magic Carpet Ride**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium navigable **Cloud Kingdom** route with 4 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Pass through 16 rings and collect at least 10 stars.
- **3D objects used:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Moving obstacles
- **Timer / target:** 180 sec
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Add moving traffic/hazards and resource management.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Night City

- **Difficulty:** Hard
- **Environment / look:** Night City interpreted in the visual language of **Magic Carpet Ride**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large navigable **Night City** route with 5 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Pass through 20 rings and collect at least 12 stars.
- **3D objects used:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Resource/time pressure
- **Timer / target:** 180 sec with tighter objectives
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Increase route complexity and reduce error tolerance.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Floating Palace

- **Difficulty:** Challenge
- **Environment / look:** Floating Palace interpreted in the visual language of **Magic Carpet Ride**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense navigable **Floating Palace** route with 6 major junctions/checkpoints and clear turnaround space.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Pass through 25 rings and collect at least 15 stars.
- **3D objects used:** Magic carpet, flying ring, star, floating rock, tower, rooftop, cloud. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Dense route + precision requirement
- **Timer / target:** 180–240 sec challenge
- **Camera:** Third-person chase camera; smooth follow; slight look-ahead in travel direction.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete all route objectives and finish/return safely within the limit.
- **Lose condition:** timer/resource reaches zero, required vehicle condition fails, or too many critical mistakes occur.
- **New mechanic / progression:** Combine all mechanics into a score-attack route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 48 — Toy Store Night Shift

**Category:** Task
**Base difficulty:** Medium
**Concept:** A small toy robot sorts scattered toys back onto correct shelves.
**Core loop:** Find toy → identify category → carry → correct shelf → repeat.
**Player character / vehicle:** Toy robot.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf, crate, shopping cart.
**Reusable systems:** Pickup/drop, category matching, timer, moving toy hazards.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Toy robot.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Toy Store Night Shift** containing: Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf, crate, shopping cart.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Toy Shelf

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Toy Shelf interpreted in the visual language of **Toy Store Night Shift**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Toy Shelf** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 5 toys to matching shelf categories.
- **3D objects used:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Store Floor

- **Difficulty:** Easy
- **Environment / look:** Store Floor interpreted in the visual language of **Toy Store Night Shift**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Store Floor** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 8 toys to matching shelf categories.
- **3D objects used:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Warehouse

- **Difficulty:** Medium
- **Environment / look:** Warehouse interpreted in the visual language of **Toy Store Night Shift**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Warehouse** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 10 toys to matching shelf categories.
- **3D objects used:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Mega Toy Store

- **Difficulty:** Hard
- **Environment / look:** Mega Toy Store interpreted in the visual language of **Toy Store Night Shift**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Mega Toy Store** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 14 toys to matching shelf categories.
- **3D objects used:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Toy Chaos

- **Difficulty:** Challenge
- **Environment / look:** Toy Chaos interpreted in the visual language of **Toy Store Night Shift**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Toy Chaos** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Return 18 toys to matching shelf categories.
- **3D objects used:** Teddy bear, toy car, toy robot prop, blocks, toy airplane, ball, shelf. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 49 — Aquarium Cleaner

**Category:** Task
**Base difficulty:** Medium
**Concept:** A diver completes maintenance tasks inside stylized aquarium tanks.
**Core loop:** Swim → clean spot → collect trash → inspect station → complete task list.
**Player character / vehicle:** Diver.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine, bubble station, fish.
**Reusable systems:** SwimController, task list, interactions, collectibles.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Diver.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Aquarium Cleaner** containing: Cleaning tool, bottle, can, seaweed, coral, rock, filter machine, bubble station, fish.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Tank

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Tank interpreted in the visual language of **Aquarium Cleaner**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Tank** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 3 maintenance tasks including cleaning and trash collection.
- **3D objects used:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Tropical Tank

- **Difficulty:** Easy
- **Environment / look:** Tropical Tank interpreted in the visual language of **Aquarium Cleaner**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Tropical Tank** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 4 maintenance tasks including cleaning and trash collection.
- **3D objects used:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Shark Tunnel

- **Difficulty:** Medium
- **Environment / look:** Shark Tunnel interpreted in the visual language of **Aquarium Cleaner**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Shark Tunnel** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 5 maintenance tasks including cleaning and trash collection.
- **3D objects used:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — Giant Aquarium

- **Difficulty:** Hard
- **Environment / look:** Giant Aquarium interpreted in the visual language of **Aquarium Cleaner**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **Giant Aquarium** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 6 maintenance tasks including cleaning and trash collection.
- **3D objects used:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Deep Sea Exhibit

- **Difficulty:** Challenge
- **Environment / look:** Deep Sea Exhibit interpreted in the visual language of **Aquarium Cleaner**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Deep Sea Exhibit** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Complete 8 maintenance tasks including cleaning and trash collection.
- **3D objects used:** Cleaning tool, bottle, can, seaweed, coral, rock, filter machine. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# GAME 50 — Postman 3D

**Category:** Task
**Base difficulty:** Medium
**Concept:** Deliver letters and parcels to correct addresses across compact neighborhoods.
**Core loop:** Read list → choose route → find house → deliver → next address.
**Player character / vehicle:** Stylized postman with optional uniform skins.
**Controls:** Keyboard: WASD to move, Space to jump where needed, E to interact/pick up; Mobile: virtual stick + contextual action button.
**Camera:** Third-person follow camera with interaction focus assist.
**Required 3D assets:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp, bench, fence, bicycle.
**Reusable systems:** Delivery queue, address matching, route scoring, timer.

### Hyper3D — main character / vehicle prompt
```text
Original premium stylized 3D game character: Stylized postman with optional uniform skins.. Full body, friendly readable proportions, clean silhouette, medium-low polygon count, game-ready topology, matte/satin materials, optimized for browser/mobile 3D, suitable for rigging, neutral T-pose where anatomically appropriate, no logos, no text, plain light-grey studio background.
```

### Hyper3D — object pack prompt
```text
Create a cohesive low-poly premium mobile/browser game prop pack for **Postman 3D** containing: Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp, bench, fence, bicycle.. Use consistent scale, rounded/beveled edges, clean silhouettes, game-ready geometry, matte/satin materials, no text or logos unless functionally required, and neutral lighting on a plain background.
```

## Levels

### Level 1 — Small Street

- **Difficulty:** Tutorial / Easy
- **Environment / look:** Small Street interpreted in the visual language of **Postman 3D**. Bright, readable lighting with strong gameplay contrast.
- **Map size:** Compact
- **Layout:** Compact **Small Street** work area containing 2 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 4 letters/parcels to correct addresses.
- **3D objects used:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Simple path
- **Timer / target:** 120 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Bright, readable lighting with strong gameplay contrast.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Teach one task and one interactable type.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 2 — Neighborhood

- **Difficulty:** Easy
- **Environment / look:** Neighborhood interpreted in the visual language of **Postman 3D**. Natural/clean lighting with slightly stronger environmental mood.
- **Map size:** Small–Medium
- **Layout:** Small–Medium **Neighborhood** work area containing 3 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 6 letters/parcels to correct addresses.
- **3D objects used:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** More travel distance
- **Timer / target:** 150 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Natural/clean lighting with slightly stronger environmental mood.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Add a second task type and longer route.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 3 — Village

- **Difficulty:** Medium
- **Environment / look:** Village interpreted in the visual language of **Postman 3D**. More dramatic lighting while keeping objectives clearly readable.
- **Map size:** Medium
- **Layout:** Medium **Village** work area containing 4 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 8 letters/parcels to correct addresses.
- **3D objects used:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Multiple workstations
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** More dramatic lighting while keeping objectives clearly readable.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Run multiple objectives in sequence.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 4 — City District

- **Difficulty:** Hard
- **Environment / look:** City District interpreted in the visual language of **Postman 3D**. Stronger contrast, denser effects and clearer hazard highlights.
- **Map size:** Large
- **Layout:** Large **City District** work area containing 5 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 10 letters/parcels to correct addresses.
- **3D objects used:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Parallel objectives
- **Timer / target:** 180 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Stronger contrast, denser effects and clearer hazard highlights.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Introduce parallel tasks or stricter timing.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

### Level 5 — Holiday Rush

- **Difficulty:** Challenge
- **Environment / look:** Holiday Rush interpreted in the visual language of **Postman 3D**. Cinematic challenge lighting with all interactive objects still easy to read.
- **Map size:** Large / Dense
- **Layout:** Large / Dense **Holiday Rush** work area containing 6 functional zones/workstations connected by readable routes.
- **Player start:** Safe, readable start area facing the first objective or route landmark.
- **Main objective:** Deliver 14 letters/parcels to correct addresses.
- **3D objects used:** Letter, parcel, mailbag, mailbox, door, houses A/B/C, street lamp. Reuse the shared prop library where possible; level-specific placement/layout changes create variation.
- **Hazards / pressure:** Full-system workload under time pressure
- **Timer / target:** 210 sec
- **Camera:** Third-person follow camera with interaction focus assist.
- **Lighting / mood:** Cinematic challenge lighting with all interactive objects still easy to read.
- **Win condition:** complete the entire task queue correctly within the allowed time.
- **Lose condition:** timer reaches zero or the maximum error/failure limit is exceeded.
- **New mechanic / progression:** Full shift/challenge combining every task mechanic.
- **Replay goal:** Better time, higher accuracy, more collectibles or longer combo than the previous personal best.

---

# Shared asset library for Menu 1

Create once and reuse aggressively:

- Crate / box family
- Barrel
- Bench
- Street lamp
- Traffic cone / barrier
- Generic doors
- Tables / chairs
- Rocks / trees / bushes
- Fences
- Generic signs
- Coin / star / gem
- Shelves / cabinets
- Modular walls / floors / roofs
- Checkpoint arch / destination pad
- Generic collectible glow/VFX in engine

## Production target

- 50 games
- 5 levels each
- **250 level specifications**
- roughly 20–25 main characters/creatures
- roughly 10–12 vehicles
- shared generic prop library
- environment modules reused across multiple games

## Recommended implementation order

1. Runner template
2. Platformer template
3. Vehicle template
4. Delivery/job template
5. Collect/mission template
6. Flight/swim template
7. Puzzle/interact template
8. Arena/skill template

After those templates are stable, each game should mostly become configuration + assets + level layout rather than a new engine.

---

# MENU 2 — 50 Color Shell Ninja Games

# PLAY50 — MENU 2
## FULL PRODUCTION SPEC — Color Shell Ninjas — 30 3D Games

**Scope:** this is a completely separate arcade menu from Menu 1.

The menu uses one original character family, one shared rig and a strong five-color ability system.

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
Original stylized 3D anthropomorphic turtle ninja hero for a premium mobile and browser game, completely original character design and not based on or resembling any existing franchise character.

Full body, compact athletic proportions, slightly oversized head, expressive friendly face, rounded turtle shell on the back, strong hands and feet, clean ninja outfit, dark charcoal fabric clothing, simple belt, wrist wraps and ankle wraps.

No weapons, no logos, no text, no cape.

Clean T-pose, arms straight horizontally to the sides, legs slightly apart, palms down, symmetrical pose, nothing touching the arms.

Premium stylized game art, soft bevelled shapes, medium-low polygon count, clean game-ready topology, clear silhouette, matte painted materials, optimized for a browser 3D game, suitable for rigging and animation.

Neutral studio lighting, plain light grey background.

Color accent: RED #EF4444 on eye mask, belt details and wrist wraps.
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
- Same Color Shell Ninja mesh and rig.
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

# GAME 02 — Ninja Rooftop Climb

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
- Same Color Shell Ninja mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Low Roofs

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Low Roofs** using the same art direction as Ninja Rooftop Climb; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Office Roofs** using the same art direction as Ninja Rooftop Climb; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Moving Rooftops** using the same art direction as Ninja Rooftop Climb; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Night Skyline** using the same art direction as Ninja Rooftop Climb; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **High-Rise Climb** using the same art direction as Ninja Rooftop Climb; color-coded gameplay elements must be readable at a glance.
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

# GAME 03 — Turtle Sewer Escape

**Game type:** Vertical escape
**Core objective:** Climb pipes and ledges while rising water chases the player.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** Keyboard: WASD/Arrows to move, Space to jump; Mobile: virtual stick + jump button.
**Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard

### Hyper3D — primary level asset prompt
```text
Large stylized sewer pipe section, dark grey metal, modular shape, subtle green water stains, premium low-poly game-ready prop.
```

### Character use
- Same Color Shell Ninja mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Drain Entry

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Drain Entry** using the same art direction as Turtle Sewer Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Compact
- **Layout:** Compact vertical route in **Drain Entry** with 10 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 3 vertical sections.
- **Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard. Recolor neutral assets at runtime whenever possible.
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
- **Environment / visual:** **Pipe Maze** using the same art direction as Turtle Sewer Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Small–Medium
- **Layout:** Small–Medium vertical route in **Pipe Maze** with 14 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 4 vertical sections.
- **Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard. Recolor neutral assets at runtime whenever possible.
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
- **Environment / visual:** **Valve Shaft** using the same art direction as Turtle Sewer Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Medium
- **Layout:** Medium vertical route in **Valve Shaft** with 18 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 5 vertical sections.
- **Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard. Recolor neutral assets at runtime whenever possible.
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
- **Environment / visual:** **Flood Rise** using the same art direction as Turtle Sewer Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large
- **Layout:** Large vertical route in **Flood Rise** with 22 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 6 vertical sections.
- **Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard. Recolor neutral assets at runtime whenever possible.
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
- **Environment / visual:** **Final Escape** using the same art direction as Turtle Sewer Escape; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense vertical route in **Final Escape** with 28 primary landing surfaces and increasing moving/failing platform density.
- **Player start:** Safe start platform/zone with the first route or color objective visible.
- **Main objective:** Reach the exit before the rising water catches the player; pass 8 vertical sections.
- **Required 3D assets:** Sewer pipe, brick ledge, valve, metal platform, water hazard. Recolor neutral assets at runtime whenever possible.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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

# GAME 11 — Ninja Dash

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
- Same Color Shell Ninja mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Training Street

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Training Street** using the same art direction as Ninja Dash; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Market Lane** using the same art direction as Ninja Dash; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Old Town** using the same art direction as Ninja Dash; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Night Street** using the same art direction as Ninja Dash; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Endless Dash** using the same art direction as Ninja Dash; color-coded gameplay elements must be readable at a glance.
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

# GAME 12 — Turtle Tunnel Run

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
- Same Color Shell Ninja mesh and rig.
- Accent color changes by selected hero.
- Hero ability is available where it does not bypass the entire level mechanic.
- Ability cooldown resets at level start unless a game mode explicitly says otherwise.

## Levels

### Level 1 — Dry Tunnel

- **Difficulty:** Tutorial / Easy
- **Environment / visual:** **Dry Tunnel** using the same art direction as Turtle Tunnel Run; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Pipe Zone** using the same art direction as Turtle Tunnel Run; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Water Gaps** using the same art direction as Turtle Tunnel Run; color-coded gameplay elements must be readable at a glance.
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
- **Environment / visual:** **Fast Tunnel** using the same art direction as Turtle Tunnel Run; color-coded gameplay elements must be readable at a glance.
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

### Level 5 — Sewer Sprint

- **Difficulty:** Challenge
- **Environment / visual:** **Sewer Sprint** using the same art direction as Turtle Tunnel Run; color-coded gameplay elements must be readable at a glance.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward course in **Sewer Sprint** split into 8 obstacle segments, collectible lines and safe recovery pockets.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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
- Same Color Shell Ninja mesh and rig.
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

# ADDITIONAL 20 COLOR SHELL NINJA GAMES
## Games 31–50

These 20 games use the same Color Shell Ninja characters, rig, animations, five-color abilities and shared arcade systems.

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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 32 — Shell Bounce Arena

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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 33 — Shadow Clone Dash

**Game type:** Runner memory challenge
**Core objective:** Follow a short route preview and then repeat it correctly at speed.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block

### Hyper3D — primary asset prompt
```text
Stylized glowing route marker tile for a memory-based arcade runner, clear directional symbol area without text, neutral material for runtime color/emissive changes, low-poly game asset.
```

### Character use
- Same Color Shell Ninja base mesh and shared skeleton.
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
- **3D objects used:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block. Reuse neutral recolorable versions when possible.
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
- **3D objects used:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block. Reuse neutral recolorable versions when possible.
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
- **3D objects used:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block. Reuse neutral recolorable versions when possible.
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
- **3D objects used:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block. Reuse neutral recolorable versions when possible.
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
- **3D objects used:** Memory gate, arrow tile, route marker, shadow clone marker, obstacle block. Reuse neutral recolorable versions when possible.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 37 — Shell Surf

**Game type:** Downhill board/shell surf
**Core objective:** Surf downhill, collect energy and pass through gates.
**Playable characters:** Riko, Nami, Kiro, Zuno or Vexa.
**Controls:** A/D or Left/Right to steer; Space/Up for jump/action where applicable; mobile uses swipe or virtual left/right + action.
**Required 3D assets:** Surf shell board, slope gate, energy orb, ramp, rock obstacle

### Hyper3D — primary asset prompt
```text
Stylized turtle-shell-inspired surf board for an original arcade game, rounded aerodynamic shape, neutral premium material, no franchise references, low-poly game-ready geometry.
```

### Character use
- Same Color Shell Ninja base mesh and shared skeleton.
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

### Level 5 — Shell Surf Master

- **Difficulty:** Master Challenge
- **Environment / look:** **Shell Surf Master** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense forward route themed as **Shell Surf Master**, with 8 mechanic segments and short recovery areas.
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

# GAME 38 — Laser Maze Ninja

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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 40 — Ninja Target Throw

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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 43 — Shell Cannon Jump

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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 47 — Ninja Balance Path

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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

# GAME 49 — Ninja Zipline Rush

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
- Same Color Shell Ninja base mesh and shared skeleton.
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
- Same Color Shell Ninja base mesh and shared skeleton.
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

### Level 5 — Grand Ninja Trial

- **Difficulty:** Master Challenge
- **Environment / look:** **Grand Ninja Trial** in the same premium stylized arcade art direction; gameplay colors must remain instantly readable.
- **Map size:** Large / Dense
- **Layout:** Large / Dense arcade arena/course themed as **Grand Ninja Trial**, with clear start, challenge zones and finish/result area.
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


# Shared Color Shell Ninja 3D asset library

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
- 1 Color Shell Ninja base mesh
- 5 color variants
- 1 shared rig
- 12 shared animations
- shared runtime recoloring system
- approximately 50–70 special environment/obstacle assets
- approximately 20–25 generic reusable assets

# Recommended build order

1. Sky Tower Jump — vertical/platformer template
2. Ninja Dash — runner template
3. Color Arena Survival — color/round template
4. Wall Run Temple — advanced traversal template
5. Color Bridge Builder — puzzle template
6. Ultimate Color Trial — integration/finale template

After these are stable, most remaining games should be configuration, level layout and asset composition rather than new engine development.
