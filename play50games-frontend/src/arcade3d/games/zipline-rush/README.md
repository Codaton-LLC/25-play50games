# Zipline Rush — Menu 2 #49 (World 2 Sky & Sea)

Hang under a pulley trolley and race down sagging cables between sea-stack towers: tuck (Down) to
gain speed, brake (Up) to lose it, hop (Jump + sideways) between lines, release onto the landing mat
in the green band. Five levels, Volt Eel boss on L5. Default hero Nami (W2 lead). Status `dev`.

Built by Codex (rules, levels, proofs, multiplayer), gated and brought up to the Menu 2 bar by Claude
(world, stations, rider, boss staging, HUD, audio/juice pass).

## Files

| File | What |
|---|---|
| `rules.ts` | pure 120 Hz simulation: spans, lanes, tuck/brake speed, release/landing zones, hazards, powers, Volt Eel windows, score; `limitsFor` |
| `levels.ts`, `progression.ts`, `levelEnd.ts`, `heroes.ts` | the five configs, combo/secrets/boss config, stars + progress, the shared hero pick |
| `layout.ts` | pure world layout: stations (sea stacks) where every span launches and lands, gantry / anchor positions, seeded scenery (pines, boulders, cliff islands, buoys, lighthouses, far stacks), corridor clearance |
| `look.ts` | one palette per level (sky, sun/moon, sea, rock, cable, clouds, stars, lantern, storm) + `lightningFlash` |
| `World.tsx` | sky dome, world-space sea (stack foam, sun path), clouds, rain + lightning (L5), scenery GLBs (culled by distance), key/rim lights |
| `Stations.tsx` | merged flat-shaded sea-stack geometry, steel gantries + anchor frames, watch towers, lamps, landing mats with the three-zone projection, moving decks (L3/L5), night lighthouses with beams, Tide Bell station |
| `Course.tsx` | cables (one merged tube mesh: hop wobble, beam-lit on night levels, fade near the camera), spark-storm and eel-charge glows with lightning ribbons, the L4 beam line, orbs, gulls, Riko's rock barrier, Vexa's ghost gate, Nami's shard |
| `Boss.tsx` | Volt Eel staging per phase (cables / coiled / plunge), weak-point ring, arcs, defeat fall |
| `Hero.tsx` | the hero on the shared animator + a hang pose (`hangPose`: hands on the T-grip, dangling legs, tuck, brake lean), pendulum swing, trolley riding the cable, the walk across the station deck |
| `Culled.tsx` | static spots through `<DynamicInstancedModel>` skipping copies far from the camera |
| `Hud.tsx` | HudStack placement: line / orbs / power pills, speed gauge with landing bands, combo, title + clock + star target, coach line (`coachLine`, teaches L1 by playing), Volt Eel bar, speed lines |
| `Scene.tsx` | run wiring, orbit camera (drag / two fingers / pinch), speed lens, juice + audio, intro shots |

## Level look

L1 morning pine headlands · L2 golden afternoon · L3 open sea, bare stacks, gulls, moving decks ·
L4 moonlit night, cables lit only by the lighthouse beam, spark storms · L5 violet storm (rain,
lightning), Volt Eel.

## Assets

`zipline-rush/`: m2ZiplineTower, m2ZiplineTrolleyI (the pulley trolley; the old m2ZiplineTrolley was a
wheeled cart and is removed), m2TreetopDeck (moving decks), m2LandingMat, m2ForestCanopyBg (pines),
m2SeaRock, m2SeaCliffBg, m2MarkerBuoy, m2SeaGullDiver, m2AquaOrb, m2VoltEelBoss. Reused:
`pirate-cannons/lighthouseV2`, `hotel-bellboy-rush/serviceBellV2`. Rock stacks, cables, gantries,
mats' zones, sea and sky are code (terrain / markers).

## Checks

```
npx tsc --noEmit
npx vitest run src/arcade3d/games/zipline-rush
```

`layout.test.ts` pins the stations to the rules' launch and landing points, keeps every prop out of
the riders' corridor and the sea under every rider, checks the palettes and the coach line.
Score ceilings `320 × spans + 500 (+1250 boss)`: **1460, 1780, 2100, 2420, 3990**, proven through the
real store for all heroes at 30/60/144 Hz (`proof.test.ts`).
