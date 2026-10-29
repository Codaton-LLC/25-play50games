# Snow Slide Dash

Menu 2 #20, World 4 Frost & Sweets. Order 80. Preview-only (`dev`); backend disabled.

Carve freely downhill, thread ice gates for speed, and land aligned spins/flips to boost. The mountain has no lanes. Hold Down to carve (15% speed cost); ramp launches are automatic. Space/Hop adds a small jump. Left/right spins and up/down flips in the air; release on a full rotation. E/Power activates the selected hero. Drag/two fingers orbit, wheel/pinch zoom, Q/C turn, R/F tilt, V recenter. Zuno is the shared world's default; the shared picker remembers the player's own selection.

## Levels

| Level | Length | Starting speed | Gate stars | Third-star target | Run cap |
|---|---:|---:|---:|---:|---:|
| Bunny Hill | 650 m | 12 m/s | 20 | 45 s | 100 s |
| Pine Run | 920 m | 16 m/s | 25 | 60 s | 125 s |
| Frozen Lake | 1100 m | 20 m/s | 30 | 70 s | 145 s |
| Lantern Slope | 1300 m | 24 m/s | 35 | 80 s | 165 s |
| Avalanche Run | 1800 m | 28 m/s | 40 | 100 s | 210 s |

L1 first leaves a 4 m pine-free corridor, then three straight ice gates, then the first trick ramp. Later gates make a broad slalom. L2 adds powder beside the packed line and a fast rooftop ramp. L3 alternates 90 m gripless blue ice sheets and packed sections; lake fragments fall behind. L4 adds night lighting, luminous gate lanterns, moving sled-mounted snowmen and paired ramps. L5 puts everything into Big Drift's chase and a final 40 m cliff.

Each consecutive gate adds 1.5 m/s up to six. Powder uses 72% speed and full grip; packed snow is fast; ice uses 120% speed and no steering. Carving increases steering response and turn speed. A landing within 20 degrees of a full spin/flip banks 2 m/s per half rotation (8 m/s boost cap, decaying). Misalignment stumbles for 0.6 s; loaded pine hits bury for 1 s. Downhill speed is absolutely capped at 44 m/s after all effects.

## Heroes, boss, secrets

Each level has five optional side pockets: Riko's cracked pond dash, Nami's high ridge jump, Kiro's snow-dump line, Zuno's frozen creek trail and Vexa's ghost-fence gully. Their power opens their own pocket; every hero can finish the central line. Zuno passively collects gate stars within four lateral metres, while gates themselves still require a 3.2 m pass. Powers have independent cooldowns and shared animated auras. The gully saves a colour shard; L2's >20 m/s cabin rooftop has another; carving five moving snowmen in L4 earns the sticker. Secrets never add leaderboard points.

Big Drift uses `menu2/boss`: Outrun (chain at least three gates to hold the avalanche gap), Barrage (perfect ramp landings charge frost stars, gates fire them; three hits), Cliff (two spins and a landing in the three-metre head cone). Attacks telegraph their targeted snowball, which settles into a rock. Failed cliff attempts return to the approach; insufficient barrage hits return to its ramp section without duplicating stars or flow events. The final impact uses shared hit-stop, gold particles and the boss visual time scale; rules time never slows.

Shared Menu 2 hero animation, juice, combo, secrets, stars and progress are imported. Stars are clear / every gate star / target time, with a separate no-hit badge. Original synthesized 132 BPM celesta-like ostinato and slide/ambient loops use core audio; no music files or third-party licences.

## Multiplayer

Shared lobby, input hub, player simulations, chips, podium and leaderboard exclusion. 2–4 local players, keyboard split/gamepads; phones remain solo under the shared policy. Co-op adds a 10% drafting boost within 1–7 m behind a friend and twin gates every sixth gate (two passes within 0.6 s). Kiro shares protection; Riko/Zuno share a small boost. Co-op requires everyone to finish; versus uses finish order with 15 s grace. The orbit camera fits the pack, switches two players to the shared split-screen component beyond 35 m separation, and leashes a larger pack to the leader's checkpoint beyond 55 m. Split camera offsets also follow the shared orbit state.

## Score proof

Leaderboard time is the integer ceiling of actual finishing milliseconds. Score is `max(0, floor((timeBaseMs - durationMs) / 10))`. Pickups, combo, stars, no-hit badges and secrets add no direct score. They improve movement or progression only. `LIMITS` and the backend JSON agree per level:

| Level | Min duration | Max duration / time base | Max score |
|---|---:|---:|---:|
| 1 | 14771 | 100000 | 8522 |
| 2 | 20908 | 125000 | 10409 |
| 3 | 24999 | 145000 | 12000 |
| 4 | 29544 | 165000 | 13545 |
| 5 | 40908 | 210000 | 16909 |

Every run starts at distance zero, must travel the entire level length, and advances at most 44 m/s in every substep, including powers, ice, drafting and boosts. Rewinds only decrease distance. Thus `length / 44 * 1000` is an absolute time floor; the integer min duration is its floor minus one millisecond. Applying the server time formula gives the listed maximum. No win-time or score clamping hides proof failures. Multiplayer is unranked through `sessionRunPlayers` and the shell.

`proof.test.ts` runs an input-only bot through the actual arcade store on every level with all five heroes, checks maximum speed, finishing time and score, and prints attained results. Other tests pin the limits and check handling, camera-relative controls, routes, unique pickups, multiplayer and leaderboard exclusion.

## Models and performance

All eight supplied game GLBs are used, including `m2ToySled` under moving snowmen. Existing repo models `m2SnowYeti`, `m2Snowball`, `m2CrackedIcePlatform` are referenced from ice-peak-jumper. All five heroes use `heroModelAsset`. No external copies or generation. `assets.ts` records measured accessor dimensions, with feet-on-ground node translations; scale/stretch derives from them. Repeated GLBs use shared dynamic instancing and a 155 m visibility range. Snow terrain, the avalanche, marker rings and particles are code geometry. No shared implementation was copied into the game.

Browser playtesting and actual draw-call/triangle/FPS measurements are assigned to Claude, per this handoff. No Next build/dev or Chrome was run here. See `.handoff/K-m2-snow/HANDOFF.md` for verification and remaining visual QA.
