// Models used by Clean the City. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Only urls listed in core/modelManifest.ts are fetched. All are except tree and building, which go
// straight to their primitives in Primitives.tsx, so swapping a GLB in later is a scale tweak
// here, never a scene change. Collision never comes from a model (rules.ts).
//
// Rodin makes the longest side about 1.9 and the optimize step stands the mesh on y = 0.
// Measured (w x h x d): tinCan 1.83 x 1.69 x 1.90, banana 1.90 x 1.56 x 1.85. Scale 0.5 makes
// the longest side 0.95, inside the README's drawn size of about 0.9-1.0. The pickup circle
// stays r = 0.3 whatever the mesh does. The stand-in parts are authored at that drawn size
// already (DynamicInstancedModel does not scale fallbackParts by asset.scale).
// Group C (2026-10-07): bottle 1.26 x 1.91 x 1.20 and bag 1.90 x 1.90 x 1.21 are fitted to their
// stand-ins (Primitives.tsx createLitterStandIns): the bottle 0.44 x 0.90 x 0.44 (slimmed: the
// GLB is a squat clear jar of colourful scraps with a red cap, not the spec's crushed bottle; at
// play size a multicoloured piece in its ring. README "Group C": the user decides on a
// regeneration), the bag 0.62 x 0.80 x 0.46. Both centred and standing on y = 0 like the
// stand-ins (sizes.test.ts measures the real GLBs).
// Decor (2026-10-07, README "Decor around the maps"): the parked cars reuse the pigeon-crossing
// GLBs (same urls, already in the manifest; no new generation). Their stretch and rotationY are
// pigeon-crossing's fitted numbers, copied (a game never imports another game's code); the scale is
// pigeon-crossing's times one size factor, so they stand at life size next to this game's 0.95
// runner (a 1.75 m person: 1 unit = 1.84 m). decorSpots.test.ts measures the real meshes.
//   car  pigeon-crossing 1.11 x 1.14 x 2.66 (w x h x l) x 0.82 -> 0.91 x 0.93 x 2.18 (4.0 m long)
//   taxi 1.16 x 1.29 x 2.95 x 0.82 -> 0.95 x 1.06 x 2.42; van 1.26 x 1.29 x 3.66 x 0.82 -> 1.03 x 1.06 x 3.00
// The park pigeons are not a GLB: pigeon-crossing's pigeon has 12,000 triangles, 60,000 for the
// flock of birds a few px tall, so Decor.tsx builds a 600-triangle bird in code (createPigeonParts).
// Obstacle props (group D, 2026-10-07, README "Obstacle props"): bench, bin, lamp, palm and umbrella
// are fitted to the obstacle squares of rules.ts MAPS (the runner collides with those squares, never
// with a mesh), centred on the square, feet on y = 0. Measured on the optimized GLBs (w x h x d; the
// optimize step centres x and z): bench 1.893 x 0.842 x 0.803, bin 1.023 x 1.899 x 1.019 (2026-10-08:
// the flat-lid regeneration, a lidded can with a lid handle on a base ring; the domed 1.390 x 1.903 x
// 1.394 one read as a green ball at play size), lamp 0.448 x 1.900 x 0.432, palm 1.775 x 1.903 x 1.782,
// umbrella 1.780 x 1.902 x 1.737 (pole about 0.09 across, canopy from y 1.17). Drawn (props.test.ts
// checks every one on the real mesh, as placed by propSpots.ts):
//   bench    2.40 x 0.84 x 0.80  the 2.4 x 0.8 square, the GLB's own height for that depth
//   bin      1.40 x 1.25 x 1.40  the 1.4 square (scale 1.3684, depth stretched 1.0038 to the square);
//                                lower than the GLB's 2.60 at that width (a bin 1.3 x the runner)
//   lamp     0.60 x 2.00 x 0.58  the base (below 0.2) and the globe fill the 0.6 square, the post
//                                between them narrows from 0.35 to about 0.12; lower than uniform (2.55)
//   palm     1.20 x 1.70 x 1.20  the crown fills the 1.2 square from about 1.0 up, above the runner's
//                                head; the trunk below is about 0.3 across and off the square's centre;
//                                taller than uniform (1.28)
//   umbrella 1.50 x 1.60 x 1.46  uniform. The pole (0.07) stands in its 0.5 square; the canopy is the
//            one part the rules call visual (README obstacle table): it reaches 0.75 from the pole, where
//            the runner's centre stops (0.25 + its radius 0.5), never over a litter spot, and its lowest
//            edge (0.99) clears the runner's 0.95 head.
// So from the camera the crown, the canopy and the globe mark where the runner stops. At the runner's
// height the palm trunk and the pole alone left it 0.33-0.57 and 0.20-0.23 short, so each stands on
// a primitive base that fills its square near the ground (propSpots.ts PROP_BASE: a wooden planter,
// an umbrella stand; README "Obstacle props"; props.test.ts BODY_GAP and the coverage test).
// No prop hides a litter piece: from every fitted camera, the middle of every litter spot near it
// stays in view (props.test.ts casts the rays). The primitives in Primitives.tsx are the fallbacks.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CLEANER_LANDMARKS, CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// measured in this game, kept in core so other games reuse the character (REUSED_ASSETS)
export { CLEANER_LANDMARKS };

const LITTER_SCALE = 0.5;
/** cleaner.glb is 1.9022 tall: 0.4994 draws it 0.95, the README's "about 1 unit" (the runner it replaced). */
const CLEANER_SCALE = 0.4994;
/** pigeon-crossing's vehicle scales times this: a 4 m car next to the 0.95 runner. */
const CAR_SIZE = 0.82;
/**
 * The bin's colour, GLB and stand-in alike (2026-10-08): dark slate. The flat-lid bin GLB is green
 * and melted into the park's green lawn, so Primitives.tsx draws it in this colour (binLook.ts: its
 * own material with the albedo map dropped, the normal and metal/roughness maps kept).
 */
export const BIN_COLOR = "#475569";


const prop = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/clean-city/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
});

export const ASSETS = {
   // this game's character (2026-10-08, image-to-3D, a static T-pose). Scene draws
   // <HumanoidModel asset={ASSETS.cleaner}> (auto-rigged) with PrimitiveRunner (0.90 tall, drawn
   // unscaled, in the orange vest) as its fallback. The scale draws the GLB 0.95 tall, and gait.ts's
   // stride and body lift use it too.
   cleaner: {
      id: "cleaner",
      url: "/models/3d/clean-city/cleaner.glb",
      scale: CLEANER_SCALE,
      humanoid: { landmarks: CLEANER_LANDMARKS },
      fallback: "capsule",
      fallbackColor: "#f97316",
      budget: { ...CHARACTER_BUDGET },
   },
   // shared litter (public/models/3d/shared/*.glb), longest side 0.95
   tinCan: { ...SHARED_ASSETS.tinCan, scale: LITTER_SCALE },
   banana: { ...SHARED_ASSETS.banana, scale: LITTER_SCALE },
   // this game only (./assets.spec.json, group C): fitted to the stand-ins' footprint and height
   bottle: { ...prop("bottle", "cylinder", "#4ade80"), scale: 0.471, stretch: [0.743, 1, 0.776] },
   bag: { ...prop("bag", "box", "#d6a46b"), scale: 0.421, stretch: [0.775, 1, 0.9] },
   // obstacle props (./assets.spec.json, group D): fitted to their obstacle squares (see above)
   bench: { ...prop("bench", "box", "#c4a574"), scale: 0.996, stretch: [1.2727, 1, 1] },
   bin: { ...prop("bin", "cylinder", BIN_COLOR), scale: 1.3684, stretch: [1, 0.481, 1.0038] },
   lamp: { ...prop("lamp", "cylinder", "#94a3b8"), scale: 1.3404, stretch: [1, 0.7852, 1] },
   palm: { ...prop("palm", "cylinder", "#15803d"), scale: 0.6734, stretch: [1, 1.3264, 1] },
   umbrella: { ...prop("umbrella", "cylinder", "#38bdf8"), scale: 0.8428 },
   // scenery that stays primitives (no GLB in the manifest, nothing fetched). Same swap path.
   tree: prop("tree", "cylinder", "#166534"),
   building: prop("building", "box", "#64748b"),
   // decor (pigeon-crossing's GLBs): parked cars on the city's far street. Long along the GLB's z,
   // front at +z after rotationY, wheels on y = 0.
   car: {
      id: "car", url: "/models/3d/pigeon-crossing/car.glb", scale: 1.4 * CAR_SIZE, stretch: [0.87, 1, 1], rotationY: Math.PI,
      fallback: "box", fallbackColor: "#f47967", budget: { ...PROP_BUDGET },
   },
   taxi: {
      id: "taxi", url: "/models/3d/pigeon-crossing/taxi.glb", scale: 1.56 * CAR_SIZE, stretch: [0.795, 0.742, 1],
      fallback: "box", fallbackColor: "#ffd15b", budget: { ...PROP_BUDGET },
   },
   van: {
      id: "van", url: "/models/3d/pigeon-crossing/van.glb", scale: 1.93 * CAR_SIZE, stretch: [0.56, 0.64, 1],
      fallback: "box", fallbackColor: "#e9edf3", budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** Drawn litter size the stand-ins are built at (the GLBs reach it through LITTER_SCALE). */
export const LITTER_DRAW = 0.95;
