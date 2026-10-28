# Sky Hook Swing (Menu 2, game 45, World 2)

Status: **dev**. Aim, reel, release. The rope is an analytic pendulum (gravity 30, length 3–12 m), not a physics engine. Screen-up walks +x: the orbit starts at yaw −π/2.

## Controls

WASD or arrows move. While the rope is hooked, stick up reels in (down to 3 m) and stick down reels out (up to 12 m). Space jumps. E or Enter throws the hook at the nearest ring within 14 m inside a 35° cone, and throws it again to release along the tangent. A release while the rope flashes green (still climbing, past the bottom, faster than 5.2 m/s) leaves 25% faster, capped at 27.5 m/s. Touch uses the same timings: joystick, Jump, Hook.

## Levels

1. **Single Swing.** One ring over a net, a wall you reel over, then three rings to the pad.
2. **Double Swing.** Peak releases chained from rest to rest.
3. **Moving Anchors.** A swaying airship, one windmill blade, then the pad.
4. **Long Gaps.** A crosswind, and cracked rings that drop the rope after 3 s.
5. **Sky Swing Master.** The Gust Galleon. Cannons (3 hits), a drone swung into the mast (1 hit), then falling rings up to the Tide Bell (1 hit). The bell is the win.

Any hero can finish. Riko dashes 6 m out of a release and smashes crates. Nami jumps again after a release. Kiro's shield ignores sparks and smoke. Zuno pulls orbs from 6 m. Vexa phases through ghost panels. Nami is the default.

Stars: clear, every main orb, and a submitted time at or under 45 / 70 / 90 / 100 / 150 s. The no-hit badge is the sky chain (no landing off a checkpoint). The shared star screen labels that badge "No-hit run".

## Score limit

Time game. Submitted time = play time − 80 ms per orb − the flow meter's bonus. The flow meter fills on a chain of 4 (window 3.2 s, bases 36 ms per new anchor and 24 ms per orb, cap ×2). Secrets do not score.

The floor is the dock span divided by 27.5 m/s, or, on level 5, the time to hit the galleon at the first instant of every vulnerable window, whichever is longer. Subtract every orb and the largest combo bonus. `proposeLimits` keeps 95% of that, rounded down to 100 ms. Horizontal speed is clamped, so a run cannot beat the span. The rows in `meta.ts` and `arcade-games.json` are `PROPOSED_LEVEL_LIMITS`:

| Level | min duration | max score | time base |
|---|---:|---:|---:|
| 1 | 1300 ms | 9870 | 100 s |
| 2 | 2000 ms | 13800 | 140 s |
| 3 | 2300 ms | 17770 | 180 s |
| 4 | 2500 ms | 19750 | 200 s |
| 5 | 9200 ms | 23080 | 240 s |

`proof.test.ts` runs every hero to a win on all five levels and checks a mashed power and 40 spam runs stay at or above that floor.

## Known issues

Not playtested in a browser and not measured for frame time (Claude playtests). The cannon and the hook claw are code. The drone GLB is about 520 KB, so it uses the character byte budget. Level 2's third rest sits under the third ring so a low swing can still land.
