# Spin Pole Climb (Menu 2, game 34, World 3 Wild Temples): ORBIT TO RISE

Card: `docs/menu2-super/world-3-wild-temples.md` "34 Spin Pole Climb" (branch `claude/m2-super-plan`). Slug `spin-pole-climb`, order 71, owner claude, status dev, lead hero Kiro (`defaultHeroFor`). A time game.

## Concept and controls

You climb ancient stone poles by running round their spiral stairs: every lap lifts you 3 m. The hero is locked onto a stair; the stick's screen left / right (camera-relative through `StepInput.yaw = orbit.viewYaw`, projected on the stair's way round) runs up or down it. The stairs are fixed in the world; each pole's stone core turns and drags whoever stands on its stair (the card's escalator / treadmill): jade chevrons on the pole show it, green when the spin carries you up, red when it drags you down, gold for a still pole, flashing white a second before a level-3 pole flips. Jump (Space / the Jump button) hops a sweeper bar, a spike collar or a gap. Facing a neighbouring pole, Jump while pushing towards it hops across (a gold ring shows the landing, a HUD prompt says so): the hero lands on the highest turn of the other pole's stair at or under his height, so **a hop never lifts you**. On the wide tower (L4) Jump while pushing in hops onto the next stair round the same tower. The hop is the hero's signature ball-roll. Power on E / Enter / the Power button.

- Keyboard: A / D or the arrows (left / right on the screen), Space, E or Enter; camera: drag, Q / C, R / F, wheel, V recenters.
- Touch: joystick, Jump, Power; two fingers rotate, pinch zooms (`OrbitHud` recenter button).
- Camera (`camera.ts`): the shared orbit (`menu2/camera`), its own auto-follow off. `followPole` swings the yaw out behind the hero's angle round his pole once the player has left the camera alone for 1.2 s, eased (2.4/s) and never faster than 1.6 rad/s (the card's motion-sickness fix: a lag, a level horizon, a capped yaw speed). The other poles are the camera's collision boxes (`courseSolids`); the hero's own pole is behind him.

## Files

`levels.ts` (5 configs) · `course.ts` (the poles, stairs, hazards, orbs, the bot's route; pure geometry) · `rules.ts` (the pure, fixed-step simulation, 1000/120 ms) · `bound.ts` (the score bound) · `progression.ts` (combo, stars, secrets, Coilstone) · `heroes.ts` · `bot.ts` (the honest bot, `?autoplay=1` in preview builds) · `Scene.tsx` · `CourseView.tsx` · `World.tsx` · `Coilstone.tsx` · `Hero.tsx` · `camera.ts` · `Hud.tsx` + CSS · `StarResult.tsx` + `levelEnd.ts` · `multiplayer.ts` + `MultiScene.tsx` + `MultiplayerHud.tsx` · tests `rules`, `proof`, `orbit`, `multiplayer`, `assets`.

## Levels (the card)

| Level | Field | Twist | Height | Target |
|---|---|---|---|---|
| 1 Slow Poles | A still, B with you, C against you, D with you beside C, Vexa's ghost pole | the 3 beats: run round and rise, ride the escalator, hop off the treadmill onto its neighbour | 18 m | 60 s |
| 2 Twin Poles | two 24 m poles turning opposite ways | sweeper bars on their own spin (ten, every 4.5 m), a gap each, a spore vent | 24 m | 85 s |
| 3 Mixed Rotation | three poles at overlapping heights | each flips every 6 s, a second apart, a 1 s glyph flash first: hop to the one turning your way | 30 m | 110 s |
| 4 Fast Tower | one wide tower (core 2.4 m), four stairs at 3.0 / 3.6 / 4.2 / 4.8 m a lap | push in + Jump onto a steeper stair; spike collars ride up and down the steep ones | 36 m | 130 s |
| 5 Spin Master | the central pole, two side poles, the ghost pole | the boss | 18 m | 170 s |

Each level has a gated route or reward for every hero (never a hard block): **Riko** dashes through the cracked urn on the stair (its orb), **Nami** double-jumps to the orb floating 2.3 m over the steps (a single jump peaks at 1.24 m), **Kiro** shields into the still spore veil for the orb inside it (the veil hurts nobody; the timed vents do, and the shield stops them, the sweepers and the spikes), **Zuno**'s magnet pulls the orb out of the hollow pole from 6 m, **Vexa** phases to hop onto the translucent ghost pole whose stair leads to the colour shard.

### Boss: Coilstone, the Temple Serpent (level 5)

World 3's guardian (the shared `m2CoilstoneHead` GLB, `m2CoilstoneSegment` GLBs for the dark plated segments, a code-built jade-and-sandstone body between them so the serpent stays in the triangle budget), wound round the central pole in the opposite spiral. `menu2/boss`, six hits, `progression.ts` `COILSTONE`:
- **P1 Jump the coils** (3 hits): a coil slides down the stair at you (2.4 s, 4.2 rad/s; red-rimmed while it gathers); jump it. Then a glowing plated segment rests 1.9 rad ahead: land on it from a jump.
- **P2 Strike the crown** (2 hits): the head swings out to the angle you stood on and bites (run on and it misses); then it lays its crown on a side pole's cap: hop onto that cap from the central stair.
- **P3 Ring the gong** (1 hit): it shakes you three laps down and the pole spins your way at 60 deg/s; climb to the Great Gong (`menu2/props` GreatGong) and stand on the cap while it glows. Slow-mo finish; the plates fall dark and the serpent sleeps (the story goes on in 36).

## Scoring

A time game. The submitted time is the finish less 0.1 s per orb (all nine, main and hero orbs) and less the flow meter's bonus: each stair's laps (first time each), each orb and each Coilstone hit link a chain inside 3.5 s, +0.25 a link up to x2 (`menu2/combo`; bases 40 / 30 / 80 ms). Stars: clear, the five main orbs, the target time; a no-hit badge.

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)

The floor on a finish: the hero's height is the stair's height at his angle. A stair rises `pitch / 2 pi` m a radian and the angle grows at most `V_RUN / walk + spin`, where `spin` is the fastest pole on the level (the checkpoint disc spins every pole that fast your way; L5 includes the 60 deg/s of P3). A hop lands at a turn no higher than it left; a gap or a hit only drops you; a jump's air is not height. Riko's dash adds at most `DASH_EXTRA` m (0.35 s at 11 m/s instead of 4.6, every 8 s from the start). So `T >= (H - extra) / (rate + extra / 8)`. Level 5's win is Coilstone's defeat: `bossMinMs()` runs `menu2/boss` with a perfect hitter (a hit in the first ms of every window) = 19.8 s. The row is that floor less the largest bonus, less 6 %, rounded down to 100 ms:

| Level | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---|---|---|
| 1 | 8 500 | 150 000 | 14 150 |
| 2 | 11 900 | 180 000 | 16 810 |
| 3 | 14 500 | 210 000 | 19 550 |
| 4 | 19 800 | 240 000 | 22 020 |
| 5 | 16 600 | 300 000 | 28 340 |

`meta.ts`, `arcade-games.json` (`enabled: false`) and `proof.test.ts` (PINNED) carry the same rows. The proof tests: every row equals `proposeLimits`; random players (10 seeds a level, every hero, random yaw, 60 and 144 fps) never rise above the climb line; Riko pressing the dash at every chance stays under it; the honest bot wins every level at 30, 60 and 144 fps with all five main orbs, under the target time and inside the limits; every hero clears every level; idle runs time out unranked; a ragged-frame bot run through the real store submits a ranked score inside the limits.

## Secrets, stars, progress

Secrets (`menu2/secrets`, never score): **Against the Grain** (climb a stair against its pole's spin from its foot to its top without a hop: L1 C, L2 B), **Ghost pole shard** (Vexa, every level), **Spin Disc** (the checkpoint disc hidden on a mushroom cap: L1 B's cap, L3 A's cap; standing on it spins every pole your way for 10 s), **Steepest Stair** (L4: finish on the 4.8 m stair), **Never Bitten** (L5: no coil or bite hit). The level end goes through `menu2/progress` (`levelEnd.ts`), the star screen is `StarResult.tsx`.

## Local multiplayer (menu2/multiplayer, M1)

2-4 heroes on the same field (`multiplayer.ts`): orbs and the urn are shared; versus race (first to the goal cap, then the grace) and co-op (the team clears when everyone is through; shield / magnet / phase cover the team; a lap counted by one hero keeps teammates on the same stair's chain alive, the card's shared lap combo). The shared camera frames every hero, turnable by mouse, two fingers or P1's keys; each hero has a ring in its player colour. Not built from the card: the co-op hub lever that stops a pole.

## Look

Per level (`look.ts`): misty morning, green noon, golden hour, blue night with torches, storm grey (the World 3 card). The canopy far below greens up with your height and the steps behind you turn moss-green (the card's colour return). Steps are code-built bevelled slabs with a jade edge (one instanced pool: a grip-ledge GLB per step would be ~2k triangles x 800 steps); every full lap is marked with an `m2GripLedge`; pole sections are `m2RotatingPole` / `V2`, caps `m2CircularPlatform` / `m2MushroomCapTop`, sweepers `m2SweeperBar`, the disc `m2CheckpointDisc`, background towers `m2SpiralTowerBg`.

## Open issues

- The card's "a perfect sweeper hop (within 0.15 s) gives a chime" and Doppler stone hum are not built (generic jump / lap sounds); no world music stems (`menu2/audio` does not exist yet).
- No "fixed camera" setting (the card's alternative to the turning camera): the follow is gentle and any manual turn overrides it.
- The co-op hub lever is not built.
