# Burger Delivery Scooter

Game 33. Five configurations of one 12 m block / 6 m street grid. The shell owns levels, lives, clock, pause and results. Rules are DOM-free and seeded.

## Play

W / Up accelerates; S / Down brakes, then reverses. A / D steers; Space or Hop hops. Touch uses the same input state, stop window and hop window. Speed 11 m/s, acceleration 14, braking 16, reverse 2.5, steering 2.6 rad/s, drag 0.35, body radius 0.55.

Stop below 0.5 m/s inside the 1.1 m shop pad for 0.45 s to accept an order. Quality resets to 100. Ride to the green door ring and stop for the same 0.45 s. Return to the shop for each subsequent order. The arrow points to the active stop. Pink marks the fixed shop; dark reflective patches mark wet streets.

A hop lasts 0.40 s, ignores barrier overlaps only during its middle 0.20 s, and lifts the drawing 0.15 m without changing quality. Barriers cost 12 quality at any speed; cars cost 12 above 3 m/s, once per contact. Wet rectangles drain 4 or 5 quality/s in L4/L5 and never overlap stop pads.

At zero quality, one life is lost; quality returns to 100 and the same slot remains active. The original order clock continues. Three misses lose. Every successful slot pays once: floor(quality), plus 40 within 25 seconds of acceptance. Average quality includes successful drops only. A full quota below the quality threshold immediately loses; a successful quota wins and adds 4 per full second left. Partial scores rank; only a win clears.

## Levels and scoring proof

| Level | Orders | Quality | Time | Base | PPS | Max score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Neighborhood | 3 | 80 | 120 s | 420 | 14 | 820 |
| City Center | 4 | 80 | 150 s | 560 | 13 | 1040 |
| Park District | 5 | 75 | 180 s | 700 | 12 | 1250 |
| Rainy City | 6 | 70 | 180 s | 840 | 9 | 1340 |
| Night Delivery | 8 | 70 | 210 s | 1120 | 8 | 1670 |

Each server level uses minDurationMs 4000 and maxDurationMs equal to its clock. These are the spec's limits, unchanged.

There are N slots, so objective points are at most B = 140N, including retries. No failed slot pays. On a win raw score is at most B + 4 floor(T - t); on any other end it is at most B. No idle or input-spam reward exists.

The generator selects the N farthest street intersections before shuffling their order. Buildings expanded by the 0.55 m scooter radius block diagonal shortcuts. The independent visibility-graph proof in levels.test.ts finds shortest shop-to-door routes around these rectangles. With distances d_i and K = 2N-1 legs, total travel is at least 2 sum(d_i) - max(d_i) - 2.2K: the last leg can be the longest and both endpoint pad radii are credited on every leg.

Every stop requires speed below 0.5. At maximum speed 11 the acceleration/braking time penalty per leg is at least ((11-0.5)^2 / 22)(1/14+1/16). The proof subtracts an additional 0.05 s per leg for the integrator's worst 50 ms discretization. It adds 0.45 s for each of the 2N stops. Collision bodies are outside every stop pad; a collision stop followed by re-acceleration cannot shorten the optimal approach to a pad. Hazards, steering and wet quality losses only reduce achievable scores.

| Level | Conservative earliest win | Raw score upper bound | Server max |
| --- | ---: | ---: | ---: |
| 1 | 26.746 s | 792 | 820 |
| 2 | 45.375 s | 976 | 1040 |
| 3 | 53.833 s | 1204 | 1250 |
| 4 | 78.540 s | 1244 | 1340 |
| 5 | 100.111 s | 1556 | 1670 |

The tests also compare each raw bound with base + PPS * earliestWin, so the linear envelope holds at the earliest win; later wins have a falling bonus and a rising envelope. Gameplay publishes raw scores without clipping; the proof also checks capScore would be a no-op for these bounds. Human-paced bots clear every level through the actual integrator and real shell store at 30, 60 and 144 Hz; a wet-patch detour deliberately spoils and retries an order without teleporting or editing quality. Idle and held-input spam score zero. Keyboard/touch input-controller traces match frame for frame.

## Models and look

All important objects route through core Model / InstancedModel / HumanoidModel. assets.ts references the ready V2 box and food assets and the named rider, scooter, bag, counter, shop and barrier. No legacy deliveryBox, foodBox or hero is used. Cars, lamps and benches reuse core assets. Repeated buildings, hazards and dressing are instanced; fallback draw count is approximately 41 before transient core FX, below 60. One rounded-box geometry gives stand-ins beveled two/three-tone surfaces.

The rider's measured GLB standing height is 1.8482906818389893 units; scale is 1.70 / that height. HumanoidModel receives a local seated pose using upper/lower leg turnBone and aimArm toward the handlebars, with automatic floor lift disabled. Rider and box inherit the scooter transform and hop. One COLORS palette, core day/sunset/night lighting, wet-level closer fog, core floating scores, bursts and shake provide feedback. The follow camera has 50 degree pitch, 2.5 m heading look-ahead and lens shift.

## Registration for Claude

Add the slug to ARCADE_SLUGS in types.ts, then remove the two temporary ArcadeSlug casts in meta.ts and index.tsx when convenient.

In registry.ts:

    import { burgerDeliveryScooterMeta } from "./games/burger-delivery-scooter/meta";

Append burgerDeliveryScooterMeta to ARCADE_GAMES. In loaders.ts:

    "burger-delivery-scooter": () => import("./games/burger-delivery-scooter"),

Add an enabled:false points entry to arcade-games.json, mirroring LIMITS from meta.ts exactly, with all five levels and top-level limits equal to level 1. Only win clears; do not set clearScore.

Copy the ready GLBs to public/models/3d/burger-delivery-scooter/ and add their exact URLs to modelManifest.ts together. assets.ts deliberately uses unlisted URLs until then, so core renders the authored fallbacks without network requests. The shared trafficCone source can be copied to trafficCone.glb in this slug's folder. No new generation is needed.
