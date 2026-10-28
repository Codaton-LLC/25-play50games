# Color City Sprint (Menu 2, game 15, World 1 Ember Heights)

Status: **dev** (`enabled: false` in `arcade-games.json`). Route-making laps on an open pastel city. Beacons light one at a time; the path you take is painted red, and a later lap is 30% faster on red (`V_RED` 8.5 m/s). Time game. The lead hero is Riko.

## Controls

- Keyboard: WASD / arrows move, Space jumps, E or Enter uses the power.
- Touch: joystick + Jump + Power. Same timings as the keyboard.
- Camera: the shared orbit (`camera.ts` `CITY_ORBIT`, yaw −π/2 so stick-up runs along +x). Drag, wheel, Q / C turn, R / F tilt, V recenters. Movement is camera-relative (`inputToWorld`). Bots leave yaw at 0.

## Levels

1. **Red Block.** 3×3 intersections, 2 laps, 4 beacons. Beat 1 is a straight avenue, beat 2 is a cone alley against the clear avenue (the alley is shorter), beat 3 is lap 2 on glowing red lanes into the plaza. No bus, gate, sludge or ramp.
2. **Bus Line.** A bus loops in 9 s. One beacon is collected on the roof. A ramp launches onto the roof (`BUS_ROOF` 3.15 m); a street jump cannot reach it.
3. **Rush Hour.** Colour gates cycle open 2.2 s / closed 1.8 s. Grey sludge slows to 60% unless Kiro's shield is up. A cut and a ghost shop are shortcuts.
4. **Night Neon.** Same corners, 3 laps, night lighting. Painting every perimeter street drops the perfect-loop shard.
5. **Greyout Avenue.** Boss level. Beacons only repaint; the win is beating Greyout.

## Heroes

Any hero can finish. Gates are shortcuts.

- **Riko** (default): dash is a burst up to `V_RED` (never faster than a red lane) and smashes a cracked hoarding, opening a diagonal cut.
- **Nami:** a second jump. From a bus roof it reaches the elevated rail (`RAIL_Y` 5.2). A single jump from the roof does not.
- **Kiro:** shield ignores sludge.
- **Zuno:** magnet, 6 m, pulls gems out of drains.
- **Vexa:** phase through the ghost shop only.

## Boss — Greyout, the Street Sweeper (7 HP)

`progression.ts` `GREYOUT`. One hit per vulnerable window. The rules clock is never scaled; slow-mo is juice only.

1. **Brushes** (ends at 4/7). Three hits. A jump whose height is at least `BRUSH_Y` 3.75 and whose xz is within 1.7 m of the brush. Each hit stops the erase for 5 s. The bus parks at the ramp lip during the window so the jump can come off the roof.
2. **Valves** (ends at 2/7). Two hits. Grounded, under 1.6 m, at least 90% of run speed, within 2.3 m of the truck's rear.
3. **Ram** (ends at 0). Two hits. Lure the truck through the colour gate while the gate is closed, standing on the far side so it commits. A hero still south of the slam point is struck.

`bossMinMs()` hits each window on the instant it opens. That clock is the level 5 floor before orb and combo bonuses.

## Scoring

Submitted duration = finish time − 200 ms × orbs − combo bonus. The server recomputes the score from that duration (`timeBaseMs` is the level timer). Combo window 2800 ms, gain 1/3, cap 2. Bases: beacon 48, lane 28, orb 36, boss hit 24.

The floor is 95% of (least travel − every orb − the max combo), floored to 100 ms.

Travel is a state Dijkstra at `V_RED` on every walkable edge, including cuts and ghost shops (the rail is the same length as the street, so it is left out). The first edge off a node pays its full length; a corner turn saves the shortcut across the intersection. Each beacon leg also drops 2 × the pickup radius. A bus beacon is bounded by the street path to the ramp lip, not by boarding a bus that is already there. Horizontal speed, including a bus carry, never exceeds `V_RED`, so the dash cannot beat the bound.

Level 5 ignores travel: the floor is the boss clock minus orbs and combo.

| Level | minDurationMs | maxScore | timeBaseMs |
|---|---:|---:|---:|
| 1 Red Block | 21000 | 6900 | 90000 |
| 2 Bus Line | 20200 | 9980 | 120000 |
| 3 Rush Hour | 26900 | 11310 | 140000 |
| 4 Night Neon | 41200 | 13880 | 180000 |
| 5 Greyout Avenue | 9200 | 15080 | 160000 |

An honest bot is slower than this floor (lap 1 is run speed, and it stays on the centre line). The tests require a win at or above the floor, not 90% of `maxScore`.

Stars: clear, every main orb, and a target time (62 / 54 / 78 / 100 / 22 s). The no-hit badge is Greyout clipping the hero.

## Known

- The ramp GLB's high end is assumed to be +z. That was not measured on the mesh.
- Daily beacon reorder is not implemented. The order is fixed so the proof holds.
- `m2TrafficLight` was not in the ready set.
- `m2FactoryDrone.glb` is about 520 KB, so it uses the character budget.
