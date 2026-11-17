# Color Arena Survival (Menu 2, game 26, World 6 Prism Fortress): STAND ON THE CALLED COLOUR

Card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md`, "GAME 26 — Color Arena Survival" (round-based survival: "Stand on the announced color before all wrong-color tiles disappear"). Slug `color-arena-survival`, order 95, owner claude, status dev. World 6 has no lead hero: the default is your last pick anywhere, else Riko (`menu2/heroes defaultHeroFor`). A time game.

## Concept and controls

A floor of colour tiles hangs over a glowing pit. Each round:

1. **Call.** A colour is called: the arena beacon's crown turns to it, and the HUD's CALL chip shows it with its symbol, its name and the seconds left. The called tiles pulse. Over the last second of the call the wrong tiles fade dark and blink.
2. **Lock in.** Stand still (under 1.2 m/s) on the called colour for 0.35 s. Once the call is 1 s old, a lock-in ends it at once, so the speed of your lock-ins is your time. The HUD's ring fills as you lock in.
3. **Drop.** Every tile of another colour drops; 0.15 s in, it no longer holds you. Still on a tile at the end of the drop: the round is survived.
4. **Rise.** The tiles come back (they hold you from halfway up), and the floor is repainted for the next call.

A fall into the pit costs a heart (three a level). You come back on the **safe marker** (menu2/props `CheckpointPad`) on the nearest safe tile; it shows while you fall.

- **Keyboard:** WASD / arrows (camera-relative); Space jumps; E / Enter fires the power. Camera: drag, Q / C turn, R / F tilt, wheel, V recenters.
- **Touch:** joystick, Jump, Power; two fingers rotate, pinch zooms.
- **Camera** (`camera.ts`): the shared orbit, high behind the hero (looking north at the beacon and the Keeper). It has no auto-follow swing (the card's "stable framing"), and its pivot leans 40 % from the hero to the floor's middle, so the floor stays in view.
- **Readability:** every colour has a **symbol** on its tiles and on the chip (red circle, blue square, green triangle, yellow star, purple diamond), so the floor reads without hue. The wrong tiles also fade by brightness, cracked tiles shake darker, and swapping tiles blink between their two colours.

## Files

- `levels.ts` (5 configs)
- `rules.ts` (the arena, the rounds, the hero, the powers, the hazards, the Keeper; pure, fixed 1000/120 ms steps)
- `bound.ts` (the score bound)
- `progression.ts` (combo, stars, secrets, the Prism Keeper)
- `heroes.ts`
- `bot.ts` (the honest bot, `?autoplay=1` in preview builds)
- Scene and visuals: `Scene.tsx`, `ArenaView.tsx`, `World.tsx`, `Keeper.tsx`, `Hero.tsx`, `camera.ts`, `look.ts`, `Hud.tsx` + CSS
- Level end: `StarResult.tsx`, `levelEnd.ts`
- Multiplayer: `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx`
- Tests: `rules`, `proof`, `orbit`, `multiplayer`, `assets`

## Levels (the card)

| Level | Name | Floor | Rounds | Call | Target | What it adds |
|---|---|---|---|---|---|---|
| L1 | Slow Rounds | 5 x 5 | 5 | 6.0 s | 60 s | Two colours in big 2 x 2 patches: learn to lock in. |
| L2 | Three Colors | 6 x 6 | 8 | 5.0 s | 75 s | Three colours. Each round one tile of another colour cracks (it shakes darker) and stays down as a hole. |
| L3 | Five Colors | 7 x 7 | 12 | 4.2 s | 90 s | Every colour, the holes, and four tiles that blink and swap colour halfway through each call (two onto the called colour, two off it). |
| L4 | Fast Rounds | 8 x 8 | 16 | 3.0 s | 105 s | Fast calls, two holes a round, and a sweeper bar (menu2/props `SweeperBar`) turning at 55 degrees/s: jump its padded face. |
| L5 | Survival Master | 7 x 7 | ~18 | 3.4 s | 120 s | The Prism Keeper (below). |

**Holes never split the floor:** a crack is only chosen where the rest stays 4-connected (`staysConnected`), and never below the level's floor share. Every tile can always be walked to.

### Boss: the Prism Keeper (level 5)

`m2PrismArenaBoss` hovers low off the floor's north-west corner, facing the middle (clear of the HUD's top centre). Its attack cycle IS the round:

- its telegraph is the call;
- its attack is the drop;
- its vulnerable window is the rise.

Level 5 has no lock-in: the Keeper sets the pace. Every third round a **colour beacon** (`m2ColorBeacon`) stands on one tile of the called colour. Be on it when the floor drops, and when the Keeper's window opens the beacon's beam strikes it (one hit a window).

Six plates in three phases (`progression.ts KEEPER`):

- **P1 "Cracked Tiles"** (6 to 4): it cracks two tiles of the called colour; they drop with the wrong ones.
- **P2 "Shock Rings"** (4 to 2): as the floor drops, a ring races out from the middle at 11 m/s. Jump it, or it knocks you.
- **P3 "Repaint"** (2 to 0): halfway through the call (after a 0.6 s flicker of the beacon's crown) the called colour changes. The beacon stays where it stands, and its tile takes the new colour.

## Heroes

The card says "restrict any ability that would trivialize this level". No power keeps a wrong tile up or counts as a lock-in.

- **Riko:** a dash (0.35 s at 11 m/s, along the stick) to a far tile in time. Over a hole it carries no footing.
- **Nami:** a second jump: over a hole, the sweeper, a shock ring.
- **Kiro:** a shield (3 s). A knock passes him, and a drop under him bounces him onto the safe marker instead of costing a heart.
- **Zuno:** a magnet that pulls the orb from 6 m.
- **Vexa:** a phase (1.2 s): she walks over holes and dropped tiles. She cannot lock in while phased, and when it ends over the void she falls.

## Scoring

The submitted time is the finish time (the end of the drop that completes the last survived round; on level 5, the Keeper's defeat). Nothing comes off it. The flow meter (`menu2/combo`) chains lock-ins, orbs and Keeper hits within 9 s; it is shown, never scored.

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)

**Levels 1-4.** The arena's clock (`stepArena`) reads no hero.

- The first call starts 1.5 s in.
- A call lasts at least 1 s: a lock-in only ends it once it is that old.
- A drop lasts 0.9 s and a rise 0.8 s.
- A fall survives nothing, so the k-th survived drop ends no sooner than the k-th drop of the run.

The floor is therefore `START_MS + rounds x (MIN_CALL_MS + DROP_MS) + (rounds - 1) x RISE_MS`.

**Level 5.** The floor is `bossMinMs()`: menu2/boss with a perfect hitter, one hit at the first ms of every vulnerable window. The game arms a hit only on a beacon round, every third round, so real runs take about three times as long.

Each row is that floor less 6 %, rounded down to 100 ms:

| Level | maxScore | minDurationMs | time base |
|---|---|---|---|
| L1 | 13 670 | 13 300 | 150 s |
| L2 | 15 910 | 20 900 | 180 s |
| L3 | 18 890 | 31 100 | 220 s |
| L4 | 20 880 | 41 200 | 250 s |
| L5 | 28 100 | 19 000 | 300 s |

**What the honest bot reached** (60 fps, seeds 1-3, every hero):

| Level | Bot finish |
|---|---|
| L1 | 14.3-15.1 s |
| L2 | 22.6-25.1 s |
| L3 | 34.7-37 s |
| L4 | 46.8-56 s |
| L5 | 97-142 s |

The L1-L4 floors are tight (the bot locks in within about 0.3 s of the minimum call). The L5 floor is loose (see above).

**What `proof.test.ts` checks:**

- The rows equal `proposeLimits`, meta and `arcade-games.json`.
- Honest, random and spamming players of every hero, at 30 / 60 / 144 fps, never submit under the row.
- The honest bot wins every level with every hero on three seeds, and Vexa wins with three stars and no hit.
- A ragged-frame run through the real store gives a ranked win inside the limits.

## Secrets, stars, progress

Secrets (`menu2/secrets`, never score):

- **Rainbow Tile** (a shard, every level): on round 2 one tile shines in every colour; it is safe whatever is called. Be on it when the floor drops.
- **Quick Lock** (a sticker, L1-L4): lock in under 1.5 s three rounds running.
- **Over the Gap** (a shard, L2-L3): on round 4 a shard floats over the hole nearest the middle. Vexa phases to it, Nami jumps to it.
- **Bar Hopper** (a sticker, L4): jump the sweeper bar five times.
- **Beacon Streak** (a sticker, L5): three beacon rounds running, each a hit.

Stars:

- The clear.
- The five orbs: one floats over a called tile near the middle on five rounds; it is gone at the rise.
- The target time.

No-hit is the badge (no fall, no knock). The level end goes through `menu2/progress` (`levelEnd.ts`). The star screen is `StarResult.tsx`.

## Local multiplayer (menu2/multiplayer, M1)

Two to four heroes on ONE arena (`multiplayer.ts`). Run 0 advances the floor, the rounds and the Keeper, even after its own hero is out.

- **The lock-in** needs every hero still in standing on the colour.
- **Shared:** the orb, the gap shard and the beacon (first come).
- **Co-op:** shield, magnet and phase cover the team. The team clears when every hero survives.
- **Versus:** the same floor; the survivors finish together, placed by their orbs.

The shared camera frames everyone still in.

## Look

World 6 "Prism Fortress" (`look.ts`): a prism sky that goes from a bright morning (L1) to a pink dusk (L3) to a cinematic night (L4-L5).

- **Around the floor:** a glowing pit with rings far under it, the shared fortress gate beyond the north edge, drifting islands (menu2 islandB-D), prism shards turning beyond the far side, and a stone rim with a glowing strip and corner crystals.
- **Tiles:** one instanced bevelled tile mesh coloured per tile at runtime (the card's "recolorable floor tile"), plus five instanced symbol decals. 18-30 draw calls.
- **Models:**
  - `m2PrismArenaBoss`: from the user's new Hyper3D batch (`p50-assets/hyper3d-new`), optimized here with `tools/hyper3d`'s optimizer to 15k triangles and 377 KB. No credits spent.
  - `m2ColorBeacon`: Portal Hop's prop, copied in.

## Open issues

- **The card's round counts.** Level 5 is won by the Keeper's defeat: about 18 rounds when every beacon lands, more when one is missed (the card says 20).
- **Not built from the card:** a separate "Survival Master" endless mode (level 5 is the boss level, like every Menu 2 level 5).
- **Audio:** no world music stem (`menu2/audio` does not exist yet).
- **Hidden levels:** `?level=n` only opens levels already unlocked on the slice.

## Playtest (dev server, headless Chrome, bot autoplay)

All five levels at 1280×800 (mouse drag orbit, wheel zoom) and levels 1, 3 and 5 at 390×844 (touch: joystick, Jump, Power, two-finger orbit). Every run cleared or played on cleanly with 0 console errors. Frame p50 16.7 ms, p95 17-19 ms on desktop (spikes to 40-60 ms while the dev server compiles), 30-42 draw calls, 84k-116k triangles.

Fixed from the playtest:

- The called tiles were lerped towards a pastel, which washed them out (blue read grey). They now pulse brighter in their own colour.
- The Prism Keeper hovered above the frame behind the HUD banner. It now hovers low off the north-west corner, 7 m wide, turned to the floor, and level 5's camera pitch is 36 degrees.
- The dark slab under the floor read as a strange column in the intro, so it is gone.
- Prism shards on the camera's side drifted across the floor. They now stay beyond the far side.

Still open: on a 390 px phone the Keeper's corner sits off the left edge at the default camera (two fingers turn it into view).
