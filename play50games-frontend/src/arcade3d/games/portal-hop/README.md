# Rift Hop (Menu 2, game 24, World 5 Neon Cosmos): CHOOSE WHERE THE EXIT OPENS

Card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` / the W5 card "24 Rift Hop". Slug `portal-hop`, order 86, owner claude, status dev, lead hero Vexa (`defaultHeroFor`, World 5). A time game.

## Concept and controls

Floating void ruins crossed through portal PAIRS. Each pair has one fixed ENTRY (a violet wall frame you run into, or a floor pad you fall into) and 1-4 ANCHOR obelisks; its EXIT (the cyan frame) opens in front of the selected anchor. Moving it takes 0.4 s, and the pair is closed meanwhile (the exit frame is drawn as a wireframe). **Speed in = speed out**, along the exit's facing (yaw and pitch): fall 10 m into a pad and a pitched exit flings you 20 m. Nothing is placed freely, so it reads on a phone. Near an entry a ghost arc of dots shows where its exit flings you at the speed you would carry in, and it updates live as you switch.

- Choose an exit: click or tap an obelisk; press 1-4 (the nearest pair with a choice); or press the HUD's Exit button (it cycles; its dots show the anchors, filled = the exit is there, dashed = moving). Q / E (the card's keys) are camera keys in Menu 2, so the digits replace them.
- Keyboard: WASD / arrows (camera-relative), Space jumps, E / Enter fires the power; camera: drag, Q / C turn, R / F tilt, wheel, V recenters.
- Touch: joystick, Jump, Power, the Exit button, tap an obelisk; two fingers rotate, pinch zooms.
- Camera (`camera.ts`): the shared orbit, with its auto-follow swinging behind your travel. Through a portal it keeps your facing and turns at most 90 degrees towards the exit's way (the card's "never flips more than 90 degrees"); the Scene adds a swirl burst. Island slabs are its collision boxes.

## Files

- `levels.ts` (5 configs)
- `course.ts` (islands, pairs, anchors, orbs, crystals, plates, beacons, the bot's route; pure)
- `rules.ts` (the pure fixed-step simulation, 1000/120 ms)
- `bound.ts` (the score bound)
- `progression.ts` (combo, stars, secrets, the Rift Serpent)
- `heroes.ts`
- `bot.ts` (the honest bot, `?autoplay=1` in preview builds)
- `latch.ts` (a tapped obelisk and the Exit button, handed to the rules)
- Scene and visuals: `Scene.tsx`, `CourseView.tsx`, `World.tsx`, `Wyrm.tsx`, `Hero.tsx`, `camera.ts`, `Hud.tsx` + CSS
- Level end: `StarResult.tsx`, `levelEnd.ts`
- Multiplayer: `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx`
- Tests: `rules`, `proof`, `orbit`, `multiplayer`, `assets`

## Levels (the card)

| Level | Name | Target | What it adds |
|---|---|---|---|
| L1 | Two Rifts | 45 s | Three beats: (1) walk into a frame and pop out on the next island; (2) choose between 2 anchors, the plateau one leads to an orb; (3) walk off an 8 m cliff into a floor pad and fling out of the pillar's 30 degree exit across a 17 m gap. |
| L2 | Two Pairs | 60 s | Fall from the plateau into pad A; its exit opens 18 m up, pointing down at pad B. The speed stacks (to the 24 m/s cap) and B's launcher flings you 30 m to the goal. Every pair has 3 anchors, one a false lead (back onto the plateau, back to the orb island). A hidden anchor shows only from one corner of the plateau. |
| L3 | Moving Rifts | 75 s | The three exits ride round their tower at 20 degrees/s, facing out. You choose when you drop in as well as where (the arc shows it); the orb island and the goal lie in different directions. |
| L4 | Cargo | 90 s | Push a void crystal into the frame: on the right anchor it slides onto the pressure plate and raises the bridge. Then push the second crystal to the foot of the 2.4 m ledge and use it as a step (Nyla double-jumps it without). |
| L5 | Rift Master | 150 s | The Rift Serpent (below). |

### Boss: the Rift Serpent (level 5)

The `m2PortalWyrmBoss` head, with its body a chain of `m2VoidCrystal` segments that follow its own trail. It swims through YOUR portals (`progression.ts WYRM`, six plates).

- P1 "Open its exit at a beacon" (6 to 3): in each window it dives into the west frame. Open that pair's exit facing an intact beacon spike and it bonks (the spike shatters, so each hit needs another anchor).
- P2 "Fling onto its back" (3 to 1): it coils round the centre. Go up to the plateau, drop off its edge into the pad, and the pillar flings you onto its back crystal at 12 m/s or more.
- P3 "Tie it in a knot" (1 to 0): set both pairs on their magenta loop anchors and it swims into its own tail. Then touch its knotted head (slow-mo finish).
- Between windows its tail sweeps the centre island (a red wedge first): jump it. It swats you towards the middle, never off.

## Heroes

- **Riko:** a dash. Dashing into a frame on the ground adds +4 m/s, and the dash smashes the cracked crystal round her orb (L1).
- **Nyla:** a double jump. It stretches an arc after an exit and reaches the orbs 3.3 m over a landing.
- **Kiro:** a shield. It passes the laser cages round his orbs (L2, L3).
- **Zuno:** a magnet. It pulls the orbs floating off an island's edge, from 6 m.
- **Vexa (lead):** a phase. It carries her THROUGH a frame without teleporting, onto the ghost route behind it where her shard waits (every level).

## Scoring

The submitted time is the finish less 0.1 s an orb and the flow bonus. The flow meter (`menu2/combo`) chains portal passes, orbs and Wyrm hits; only the first pass out of each anchor's exit counts.

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)

**Levels 1-4.** For each hero, the floor is the quickest route through the portal graph in horizontal travel:

- **Walking is never faster than V_RUN.**
  - In the air, unless just flung out of an exit, the rules clamp horizontal speed to V_RUN.
  - A landing sticks: it also clamps the speed to V_RUN.
  - Riko's dash adds a bounded allowance (one dash per 6 s).
- **Only a flight out of an exit moves faster.**
  - The exit's speed is what went in. That is at most one of: a run-in (Riko +4 on the ground), a jump, a fall from an island its walker can reach in time, or an earlier flight that can actually reach the entry. That last check is direction-aware: along the exit's line, plus the stick's drift.
  - The flight is then timed at its longest (with Nyla's second jump) down to the lowest surface.
- **The level's floor is the least over the five heroes.**

**Level 5.** The floor is `bossMinMs()`, menu2/boss with a perfect hitter.

Each row is that floor less the largest bonus, less 6 %, rounded down to 100 ms:

| Level | maxScore | minDurationMs | time base |
|---|---|---|---|
| L1 | 14 950 | 500 | 150 s |
| L2 | 17 920 | 800 | 180 s |
| L3 | 20 960 | 400 | 210 s |
| L4 | 23 950 | 500 | 240 s |
| L5 | 28 370 | 16 300 | 300 s |

**How tight the L1-L4 floors are.** They are sound but loose: chained momentum is real (a jump into a frame keeps its speed through the next one).

| Level | Floor | The honest bot |
|---|---|---|
| L1 | 1.8 s | 10.0 s |
| L2 | 2.3 s | 12.3 s |
| L3 | 1.8 s | 30.1 s |
| L4 | 2.0 s | 18.7 s |

**What `proof.test.ts` checks:**

- The rows equal `proposeLimits`, meta and `arcade-games.json`.
- Honest, random and spamming players of every hero, at 30 / 60 / 144 fps, never submit under the row.
- The honest bot wins every level with three stars and no hit.
- A ragged-frame run through the real store gives a ranked win inside the limits.

## Secrets, stars, progress

Secrets (`menu2/secrets`, never score):

- **Behind the frame** (Vexa's shard, every level).
- **Terminal Velocity** (out of an exit at 18 m/s or more: L1, L3, L5).
- **Rift Economy** (finish with no more anchor switches than the level's par: L1-L4).
- **The Hidden Anchor** (L2).

Stars: the clear, the five main orbs, the target time; no-hit is the badge. The level end goes through `menu2/progress` (`levelEnd.ts`). The star screen is `StarResult.tsx`.

## Local multiplayer (menu2/multiplayer, M1)

Two to four heroes on the same chain (`multiplayer.ts`):

- The orbs, the bridge and the crystals are shared; only the first run moves the crystals.
- **Co-op:** the portals are shared too, so one player can hold an exit on a far anchor while another launches. Shield, magnet and phase cover the team, and a portal pass keeps everyone's flow alive. The team clears when everyone is through.
- **Versus:** a race with each player's own portals.

The shared camera frames everyone and pans between islands. A tapped obelisk or the Exit button counts for P1.

Not built from the card: "Portal Tag" (party).

## Look

World 5 (`look.ts`): a violet void with stars, a neon grid far below, a ringed planet, drifting ruins and spare islands (`m2FloatingRuinBg`, islandB-D).

- **Islands:** the shared islandA slab, with a glass column under plateaus and pillars and a glowing edge strip on every rim (purple, then cyan, then magenta as the levels go: the colour returning).
- **Portals:**
  - Entry frames are `m2PortalFrame`; floor pads are an `m2PortalIsle` rim round a swirling disc.
  - Anchors are `m2GlowObelisk` on `m2PortalAnchorPad`; a hollow ring over an obelisk marks where an exit can open.
  - The exit is `m2PortalFrameV2`.
- **Pieces:** cargo is `m2VoidCrystal`; beacon spikes are `m2ColorBeacon`.
- **Readability:** state is shown by shape and fill (filled, hollow, wireframe), never by hue alone.

## Open issues

- **The L1-L4 limits are sound but loose** (header of `bound.ts`). The bound credits any exit's flight with the stick's full drift and every hero's best fall. A tighter proof would track per-island reachability.
- **Not built from the card:**
  - Kiro's laser curtain guarding an anchor (his shield passes the orb cages instead).
  - The co-op-only routes.
  - Portal Tag.
- **Audio:** the whoosh pitch rises with the speed, but there is no world music stem (`menu2/audio` does not exist yet).
- **Hidden levels:** `?level=n` only opens levels already unlocked on the slice (unlock-all lives on main).
