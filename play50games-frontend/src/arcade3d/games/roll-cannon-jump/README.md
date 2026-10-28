# Roll Cannon Jump (Menu 2, game 43, World 1 Ember Heights): AIM, TIME, FIRE

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 60. Built to its
approved design card (`docs/menu2-super/world-1-ember-heights.md` "43 Roll Cannon Jump", framework
`00-framework.md`) on the menu2 shared systems, after the cloud-hopper / plate-surf adoptions. Kimi's
first rules (`kimi/m2-roll-cannon-jump`) were reviewed and rewritten: their floor assumed every
planned cannon is visited (a 40 m shot skips cannons, so it was not a bound), the stick set the aim
by position (a keyboard only reached 3 pitches), and Riko's dash left the hero at 30 m/s after it.

## Concept and controls

A colour-drained circus big top. The hero curls into its ball in a circus cannon, turns the barrel,
watches the power ring pulse and fires itself to the next cannon, a trampoline, a balloon bunch or
the gold finish ring. Every shot is one committed ballistic decision. Red comes back to the tent's
stripes, the bulbs and the crowd behind the hero as the show goes on.

- Keyboard: in a cannon **WASD / arrows turn the barrel** (left / right: yaw, up / down: pitch, held
  keys turn at 110 / 75 deg/s, so every angle is reachable), **Space fires**; in flight WASD nudges
  (camera-relative) and **Space again, held, roll-dives**; E or Enter is the hero power.
- Touch: joystick + Fire (then hold to dive) + Power. The same timings on touch and keyboard.
- Camera (menu2/camera, the shared orbit): drag / two fingers turn, wheel / pinch zoom, Q/Z C/X R/F V.
  Each new aim swings it in behind the barrel (the barrel yaw is the orbit yaw) with its pivot led
  3.4 m along the aim; in flight the pivot leads the travel. The nudge and the walk read the camera
  yaw (`StepInput.yaw`); the barrel is turned by the raw stick.
- Hero: the shared picker (start card, pause, result). **Riko** (W1's lead) is preselected.

## Files

| File | What |
|---|---|
| `meta.ts`, `index.tsx` | plain data (time game, five levels, order 60), the GameDefinition (intro, star screen, runPlayers) |
| `levels.ts` | caps, star targets, par shots, the preview share, the boss flag |
| `show.ts`, `layouts.ts` | the course types and builder; the five layouts (and the honest bot's route) |
| `rules.ts` | pure rules: aim, pulse, shot, catches, trampolines, balloons, platforms, hazards, powers, Ashbag, the store hand-off, the pinned limits |
| `bound.ts` | the score proof: the Dijkstra lower bound over every rest |
| `bot.ts` | the honest planning bot (tests, `?autoplay=1` on preview builds) |
| `heroes.ts`, `progression.ts`, `levelEnd.ts`, `StarResult.tsx` | heroes and powers; combo, stars, secrets, Ashbag; progress; the star screen with the par line |
| `Scene.tsx`, `Course.tsx`, `World.tsx`, `Hero.tsx`, `camera.ts`, `look.ts`, `Hud.tsx` | the scene, the show, the big top, the hero, the orbit, the palette, the HUD |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players |

## Rules

Units m, the show runs towards -z, the clock is whole ms (the fraction carried), stepped 1 ms at a time.

- **Aim:** yaw within +-60 deg of the cannon's base (a balloon re-aim: any yaw), pitch 20-70 deg.
- **Power ring:** 60 % -> 100 % (600 ms) -> 60 % (1200 ms), from the moment the hero settles in; launch
  speed 12-22 m/s, linear. G = 20, so a 45 deg shot carries 7.2 m at 60 % and 24.2 m at 100 %.
  The aim times out at 2.4 s (it fires). A press up to 130 ms early (in the hit-stop) counts.
- **Kinds:** aim cannons; fixed (L1's first, aim and power locked: just press fire); wheel (the
  barrel sweeps +-40 deg on its own, the power is fixed: fire on timing); auto (locked aim and power,
  fires on its own after 1.5 s, Jump fires it early); rail cannons slide (2.8 s cycle).
- **Flight:** gravity, the air nudge 1.5 m/s^2 (capped at 22 m/s across), the roll-dive (+30 m/s^2
  down while held, fall capped at 26 m/s).
- **Catch:** any cannon mouth within 1.2 m of the hero's middle (not the one just fired from for
  300 ms; a hidden one only once its board is smashed): a 0.4 s hit-stop, then the aim opens.
  Walking into a cannon on a platform climbs in with the same 0.4 s.
- **Trampolines:** the first bounce of a flight returns 1.3x the incoming height (vy x sqrt 1.3, at
  most 16 m/s) and keeps 35 % of the run-in (at most 4 m/s); a second bounce on the same flight keeps
  70 % and spills the hero off at 3 m/s.
- **Balloon bunches:** pop on touch, hang 350 ms, then a free re-aim with the ring.
- **Platforms:** land from above, walk 4 m/s, hop 7 m/s.
- **Losses:** the safety net (the middle under 1.4 m), a bonk on a wall, trapeze banner, pole or
  board, a live smoke jet: 0.8 s later the hero is back in the last cannon, the balloons back.
- **Finish:** through the gold ring (level 5: Ashbag's defeat). The cap (`durationMs`) ends a run
  "timeup", unranked.

### Hero roles (the card; every level has all five, all bonus, never required)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | in-flight dash, +8 m/s for 500 ms = exactly 4 m, once a flight (5 s) | smashes a cracked target board; the hidden cannon behind it fires a bonus orb line |
| Nami | double jump in flight: vy back up to 12 m/s, once a flight (2 s) | the high trapeze orbs, over the reach of any plain shot (L1: the trapeze sticker) |
| Kiro | shield 2.5 s (10 s) | flies through a smoke column with its orbs (L3: the smoke sticker in the timed jet) |
| Zuno | magnet 3 s, 4 m (10 s) | the orb trail hidden in the tent canvas shows and flies in |
| Vexa | phase 1.5 s (9 s) | the flat line through a ghost tent pole that everyone else lobs over (L4: the ghost-pole sticker) |

## Levels (the card)

| Level | Cap | Twist |
|---|---:|---|
| 1 Short Launch | 75 s | three beats: a fixed cannon at a wide platform; aim at a cannon 8 m away (full arc preview); a short shot, a long shot, a trampoline catch, the finish ring. Par 6 |
| 2 Angle Practice | 90 s | lob over tent walls, fire flat under trapeze banners; half the arc previewed |
| 3 Moving Pads | 110 s | rail cannons, a wheel cannon, an auto-cannon chain, a timed smoke jet |
| 4 Long Distance | 125 s | 26 m shots across the big top, the balloon re-aim over a 36 m gap, smoke jets; 30 % preview; the one-shot line (only a 100 % shot from c1 reaches the low perch that skips the balloon) |
| 5 Big Top Finale | 200 s | a run-in with a rail cannon onto the round stage, then **Ashbag** |

### Boss: Ashbag, the Smoke Blimp (level 5, menu2/boss `ASHBAG`, `m2SmokeBlimpBoss`, 10 m long)

Starts when the hero reaches the stage (a landing on it or a stage cannon). 6 hp, one hit per window.
The four stage cannons face inward, two trampolines sit on the stage.
1. **Smoke pods** (3 hits): it drifts round the ring and hangs at a spot, one pod swelling (1 s
   telegraph); fire yourself through it. Each pod rains three orbs onto the stage.
2. **Paint bombs** (2 hits): a shadow marks a stage cannon (1 s), grey paint jams it for 3 s; between
   bombs it hangs low over a trampoline: bounce up into the gondola (a hit counts only rising from a bounce).
3. **Valve** (1 hit): it rises to the tent top; ride the four auto-cannons up the poles and
   roll-dive into the open valve (a hit counts only diving). Slow-mo, confetti, the tent turns red.

## Scoring

A **time game**: `score = floor((timeBaseMs - duration) / 10)`, duration = finish ms - 100 ms per orb -
the flow bonus. Flow: 2 s window, +0.25, x2 cap; orbs 20, first catch of each cannon 10, each fire hoop
15, each boss hit 40. Only a win is ranked.

### Server limits and why they hold (the proof, `bound.ts`)

The run is a chain of rests (in a cannon, on a platform, on a balloon, off a trampoline) joined by
flights. For every input:
1. **Across:** a flight covers at most `Vh t + 1.5 t^2 / 2` (the launch's horizontal speed plus the
   nudge), plus Riko's one 4 m dash. Walls, poles and boards only end flights.
2. **Up:** the height is at most the free arc `Vy t - G t^2 / 2` (a dive only pulls down); Nami's one
   reset to 12 m/s is taken at its best moment (exact, the envelope is concave).
3. **Rests:** a cannon costs its 0.4 s hit-stop and a shot of power P waits (P - 0.6) / 0.4 * 600 ms;
   a fixed / wheel / auto cannon fires its locked shot at once; a balloon hangs 350 ms then pulses;
   a trampoline throws at most 4 m/s across and 16 m/s up; a platform walks 4 m/s, hops 7 m/s.
Every rest is a node (a rail cannon is the box its rail sweeps; hidden cannons count as open). An
edge costs the least wait plus flight over a 40 x 50 grid of (power, pitch) cells, each cell taken at
its fastest corner, with the target's reach (1.2 m catch, the ring, the trampoline and platform
edges) taken off both the gap and the climb. Dijkstra from cannon 0, for plain heroes, Riko and Nami,
gives the least arrival at the finish (level 5: at the stage, plus Ashbag's least defeat time,
every window hit at its first ms = 25 900 ms). Less 2 ms per node for the whole-ms steps. The least
duration then takes off every orb (100 ms each, bonus orbs included) and the most flow bonus
(`comboMaxBonus`). The limit is the bound less about 4.5 %, rounded down to 100 ms.

| Level | Least finish | Orbs | Least duration | minDurationMs | max / timeBase | maxScore |
|---|---:|---:|---:|---:|---:|---:|
| 1 Short Launch | 4 049 | 21 | 1 469 | 1 400 | 75 000 | 7 360 |
| 2 Angle Practice | 4 616 | 20 | 2 161 | 2 100 | 90 000 | 8 790 |
| 3 Moving Pads | 6 098 | 22 | 3 373 | 3 200 | 110 000 | 10 680 |
| 4 Long Distance | 7 054 | 21 | 4 489 | 4 300 | 125 000 | 12 070 |
| 5 Big Top Finale | 2 594 + 25 900 | 25 | 25 149 | 24 000 | 200 000 | 17 600 |

The bound is loose in milliseconds (it lets a dive land anywhere, walks for free, skips through walls)
but tight in points, because the cap is long: the honest bot reaches 86-95 % of maxScore. `meta.ts`,
`arcade-games.json` and `proof.test.ts` (PINNED) carry this table.

### What the bots and probes reached

BOTS_TABLE

## Stars, flow, secrets, progress, juice

- **Stars:** clear, every main orb, the target time (20 / 26 / 34 / 34 / 60 s). **Badge:** no fall and
  no bonk. The star screen adds the card's golf line: shots against par (stored, never scored).
- **Secrets** (two a level): L1 ember shard (aim wide off beat 2) + trapeze sticker (Nami); L2 ticket
  stub on a tent wall + target-board shard (Riko); L3 rail shard + smoke sticker (Kiro); L4 one-shot
  shard (the 100 % perch) + ghost-pole sticker (Vexa); L5 ash shard under the stage's edge + the valve
  sticker over the blimp (on the chain's last arc).
- **Juice:** barrel recoil camera kick and smoke on every shot, a hit-stop and "PERFECT!" on a 100 %
  shot, the trail ribbon in the hero's colour, the drumroll ticks while aiming (rising with the ring),
  catch thumps, trampoline boings, balloon pops, crowd bands that turn red and hop as you pass, the
  tent's stripes and bulbs turning red behind you, boss hits, the slow-mo defeat with confetti.

## Local multiplayer (menu2/multiplayer, M1)

`multiplayer.ts`: N runs from one seed share the orbs, the smashed boards and the jams. Co-op: shield,
magnet and phase cover the team; the team clears when everyone is through. Versus: the same lane
(the card's mirrored lanes are one tent), first through the ring wins, then the grace. One shared
camera (the card: one tent). Never ranked.

## Open issues

OPEN_ISSUES
