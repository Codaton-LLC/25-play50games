# Postman 3D

Five seeded neighbourhood configurations use the core level system. Status is `dev`; owner stays `claude`. No registry, backend, manifest, dependency or shared file is changed.

## Playing

WASD/arrows or joystick moves at 4.6 m/s, reduced to 85% with a parcel. E/Enter or **Deliver** acts within 1.2 m. The courier radius is 0.38 m. Match the number and colour on the next-three HUD chips to the street plates. Letters go to mailboxes; parcels go to doors, 3 m behind their mailboxes. Deliver any loaded item; list order earns the route bonus.

The initial bag holds `bagCap` letters and at most one parcel. Return to **POST** and press Deliver to refill available spaces and pick up the next parcel. The HUD and L1–L2 markers direct the player back when the next item is not loaded. Parcels need a separate post-office visit after each delivery. Wrong-address attempts preserve the inventory and stun for 0.40 s. Dog overlaps stun for 0.60 s with 0.80 s mercy. Cars use relative swept collision, spend a life, and stun for 0.60 s. Approaching traffic yields outside the zebra when the courier is crossing. Stopped vehicles retain their colliders.

All items delivered wins. Three lives apply only to L4–L5; zero lives loses. The shell owns countdown, pause, timeup, results and score submission. All timing uses the same pure step for keyboard and touch. Holding Deliver does not repeat the action.

## Score and bounds

Every delivery pays 100, plus 40 if it was the first undelivered item in list order. Every item pays once. On win, add `5 * floor(seconds remaining)`. No clipping or artificial minimum completion time is applied.

The spec's score-limit table is a **sketch**, and its assumed minimum completion times do not follow from the stated movement rules. A real walking bot initially scored 1,045 at 22.23 s on L1: below maxScore 1,070, but rejected by `560 + 17*t`. L3 similarly produced 1,745 at 54.50 s, exceeding `1120 + 11*t`. Scoring is preserved; `scoring.ts` proposes conservative replacement limits for Claude to align with the backend at the gate.

Proof: every winning path connects the post-office start and every target's radius-1.2 interaction disc. Compute a minimum spanning tree with edge weight `max(0, distance - 2*1.2)` (subtract only 1.2 on edges from the exact start). Any completion path is at least this tree's length. Divide by the maximum speed 4.6 to obtain a lower bound `T`. Ignore house collisions, traffic, carrying slowdown, stuns and refills; these only lengthen a real run. The generator has exactly two positional layouts per level; colours vary independently. Tests cover both, plus 200 seeds per level.

Let `B = 140 * items`, `D = duration seconds`, `W = 5 * floor(D - T)`. Partial runs never exceed B. Completed runs are bounded by `B + W`, and their bonus rate by `W/T`. The selected limits include rounding headroom. The proof never relies on human reaction delays or the walking bot.

| L | Items | D | Lower bound T (s) | B | Bound B+W | Proposed maxScore | Proposed pps |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4 | 120 | 5.6334 | 560 | 1130 | 1150 | 110 |
| 2 | 6 | 150 | 9.4226 | 840 | 1540 | 1570 | 80 |
| 3 | 8 | 180 | 11.8574 | 1120 | 1960 | 2000 | 75 |
| 4 | 10 | 180 | 18.3578 | 1400 | 2205 | 2250 | 50 |
| 5 | 14 | 210 | 21.0379 | 1960 | 2900 | 2950 | 50 |

All levels use minDurationMs 4,000 and their specified maxDurationMs. L5/L1 maximum ratio is 2.5653, below 3. Any non-quit loss needs three separated traffic contacts after leaving the safe start, so cannot occur before 4 seconds. Timeup durations meet the minimum automatically. The geometric win bounds also exceed 4 seconds.

Tests also compare list-order distance with an exact subset-DP oracle. Its trips enforce the bag capacity, the actual refill order and one parcel per office visit; it permits arbitrary delivery order and early refills. Both tours use the same Euclidean distances and ignore hazards. This checks the generator rather than assuming that a random shuffle is a sensible route.

## Presentation and assets

One `COLORS` palette, core day/sunset/night lighting and fog, a 52° follow camera with 2 m look-ahead and fitted HUD/touch clearance. The camera fits a local window so plates remain readable in larger neighbourhoods. Ground extends 650 m; no screen-edge void. House colliders leave their front paths and cross street open. Plates use one 1024² atlas and one non-indexed mesh, with 0.95 m tall contrasting number plates. Decoration uses bevelled unit geometry scaled once per spot. The fallback scene is approximately 40 draw calls before core FX, below the 60-call game budget; loaded GLB draw calls need the gate measurement. No indexed/non-indexed geometry merging.

Houses, mailboxes, doors, fences, lamps and traffic are instanced. Dogs use an animated pool. Delivery puffs, floating scores and hit shake use core FX. Night has lit Victorian lamps and instanced holiday bulbs. All important props have GLB assets and intentional coloured fallbacks. `assets.spec.json` records ready filenames, including the already-ready holiday tree. Existing core door, bench and car meshes are reused. Every new local URL is `/models/3d/postman-3d/<id>.glb`; unlisted models deliberately draw fallbacks.

The 1.78 m stand-in is wrapped in `HumanoidModel` with walk/carry/reach/cheer drivers and an attachment for the bag. Claude measures the character and prop GLBs, corrects their scale/rotation and humanoid landmarks, copies the ready files and updates the manifest at the gate. The old `hero.glb` is unused and untouched. No credits are spent.

## Validation

Run from `play50games-frontend`:

```powershell
npx vitest run src/arcade3d/games/postman-3d
npx tsc --noEmit
```

The handoff records actual results, sandbox workarounds and remaining visual checks. The bot walks legal pavement/crossing waypoints at the real speed, reads each new item for 0.3 s, and presses Deliver at human intervals. Idle and spam bots cannot earn points. Tests exercise shared input-controller action latching, inventory, wrong targets, scoring, terminal runs, hazards, reachability and per-level bounds.
