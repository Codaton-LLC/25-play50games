// Models used by Clean the City. Plain data, no three.js: index.tsx hands them to GameShell
// (which frees the GLBs when the game closes) and Scene.tsx / Primitives.tsx render them.
// Only urls listed in core/modelManifest.ts are fetched. All are except tree and building, which go
// straight to their primitives in Primitives.tsx, so swapping a GLB in later is a scale tweak
// here, never a scene change. Collision never comes from a model (rules.ts).
//
// Real-world scale (2026-10-28, README "Real-world scale"): 1 unit = 1 m. The cleaner is drawn
// 1.75 m tall, an adult; every prop is drawn at a believable size for that, inside the same rules
// squares as before (the collision geometry, runner radius 0.5, pickup radius 0.3 and the 28 m floor
// are unchanged: this is a look-only change). Before it the cleaner was 0.95 tall (1 unit = 1.84 m)
// and the props were fitted to the squares at that scale, so a bin stood 1.3 x the cleaner.
//
// Rodin makes the longest side about 1.9 and the optimize step stands the mesh on y = 0.
// Litter, drawn about 0.45-0.48 at its longest (knee height on the cleaner; a real can is smaller,
// but a 0.12 m can is under 4 CSS px on a phone): tinCan 1.83 x 1.69 x 1.90 and banana
// 1.90 x 1.56 x 1.85 at scale 0.25 (longest 0.475); bottle 1.26 x 1.91 x 1.20 and bag
// 1.90 x 1.90 x 1.21 fitted to their stand-ins (Primitives.tsx createLitterStandIns): the bottle
// 0.22 x 0.45 x 0.22 (slimmed: the GLB is a squat clear jar of colourful scraps with a red cap;
// README "Group C"), the bag 0.31 x 0.40 x 0.23, centred and on y = 0 (sizes.test.ts measures the
// real GLBs). The pickup circle stays r = 0.3 whatever the mesh does. The stand-in parts are
// authored at the drawn size (DynamicInstancedModel does not scale fallbackParts by asset.scale).
// Decor: the parked cars reuse the pigeon-crossing GLBs (same urls, in the manifest). Their stretch
// and rotationY are pigeon-crossing's fitted numbers (a game never imports another game's code),
// the scale pigeon-crossing's times CAR_SIZE, with the car and the taxi lowered to a road car's
// height (decorSpots.test.ts measures the real meshes; l x w x h):
//   car 4.26 x 1.77 x 1.49, taxi 4.72 x 1.84 x 1.55, van 5.84 x 2.00 x 2.06.
// The park pigeons are not a GLB (Decor.tsx createPigeonParts, 600 triangles).
// Obstacle props (group D, README "Obstacle props"): bench, bin, lamp, palm and umbrella stand in
// the obstacle squares of rules.ts MAPS (the runner collides with those squares, never with a
// mesh), centred on the square, feet on y = 0. Measured on the optimized GLBs (w x h x d; the
// optimize step centres x and z): bench 1.893 x 0.842 x 0.803, bin 1.023 x 1.899 x 1.019 (the
// flat-lid regeneration), lamp 0.448 x 1.900 x 0.432, palm 1.775 x 1.903 x 1.782, umbrella
// 1.780 x 1.902 x 1.737 (pole about 0.09 across, canopy from 0.6 of its height). Drawn (props.test.ts
// checks every one on the real mesh, as placed by propSpots.ts):
//   bench    2.40 x 0.84 x 0.80  unchanged: the 2.4 x 0.8 square, seat at about 0.40, backrest 0.84
//   bin      1.40 x 1.05 x 1.40  the 1.4 square (scale 1.3684, depth stretched 1.0038), a squat
//                                communal bin at the cleaner's hip (was 1.25: 1.3 x the old runner)
//   lamp     0.60 x 3.60 x 0.58  a street lamp twice the cleaner: base (below 0.36) and lantern fill
//                                the 0.6 square, the post between is about 0.12 across (was 2.00)
//   palm     1.20 x 3.20 x 1.20  the crown fills the 1.2 square from about 1.75 up, over the
//                                cleaner's head; the trunk below is about 0.3 across (was 1.70)
//   umbrella 1.50 x 3.03 x 1.46  the pole (0.07) stands in its 0.5 square; the canopy, the one part
//            the rules call visual (README obstacle table), reaches 0.75 from the pole, where the
//            runner's centre stops (0.25 + its radius 0.5), never over a litter spot, and its lowest
//            edge (1.82) clears the cleaner's 1.75 head (was 1.60 tall, edge 0.99).
// At the cleaner's height the palm trunk and the pole alone leave their squares short, so each
// stands on a primitive base that fills its square near the ground (propSpots.ts PROP_BASE: a
// wooden planter, an umbrella stand; props.test.ts BODY_GAP and the coverage test).
// No prop hides a litter piece: from every fitted camera, the middle of every litter spot near it
// stays in view (props.test.ts casts the rays). The primitives in Primitives.tsx are the fallbacks.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CLEANER_LANDMARKS, CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

// measured in this game, kept in core so other games reuse the character (REUSED_ASSETS)
export { CLEANER_LANDMARKS };

const LITTER_SCALE = 0.25;
/** cleaner.glb is 1.9022 tall: 0.92 draws it 1.75 tall, an adult in metres (1 unit = 1 m). It was 0.4994 (0.95). */
const CLEANER_SCALE = 0.92;
/** pigeon-crossing's vehicle scales times this: a 4.26 m car next to the 1.75 m cleaner. */
const CAR_SIZE = 1.6;
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
   // scaled to 1.75, in the orange vest) as its fallback. The scale draws the GLB 1.75 tall, and gait.ts's
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
   // shared litter (public/models/3d/shared/*.glb), longest side 0.475
   tinCan: { ...SHARED_ASSETS.tinCan, scale: LITTER_SCALE },
   banana: { ...SHARED_ASSETS.banana, scale: LITTER_SCALE },
   // this game only (./assets.spec.json, group C): fitted to the stand-ins' footprint and height
   bottle: { ...prop("bottle", "cylinder", "#4ade80"), scale: 0.2355, stretch: [0.743, 1, 0.776] },
   bag: { ...prop("bag", "box", "#d6a46b"), scale: 0.2105, stretch: [0.775, 1, 0.9] },
   // obstacle props (./assets.spec.json, group D): fitted to their obstacle squares (see above)
   bench: { ...prop("bench", "box", "#c4a574"), scale: 0.996, stretch: [1.2727, 1, 1] },
   bin: { ...prop("bin", "cylinder", BIN_COLOR), scale: 1.3684, stretch: [1, 0.4041, 1.0038] },
   lamp: { ...prop("lamp", "cylinder", "#94a3b8"), scale: 1.3404, stretch: [1, 1.4135, 1] },
   palm: { ...prop("palm", "cylinder", "#15803d"), scale: 0.6734, stretch: [1, 2.497, 1] },
   umbrella: { ...prop("umbrella", "cylinder", "#38bdf8"), scale: 0.8428, stretch: [1, 1.89, 1] },
   // Measured GLB: 1.893705 x 1.778490 x 1.264846, min y = 0. At 1 unit = 1 m the stall is
   // 3.03 m wide, 2.85 m tall and 2.02 m deep.
   festivalStall: { ...prop("festivalStall", "box", "#f59e0b"), scale: 1.6, rotationY: 0, yOffset: 0 },
   // scenery that stays primitives (no GLB in the manifest, nothing fetched). Same swap path.
   tree: prop("tree", "cylinder", "#166534"),
   building: prop("building", "box", "#64748b"),
   // decor (pigeon-crossing's GLBs): parked cars on the city's far street. Long along the GLB's z,
   // front at +z after rotationY, wheels on y = 0.
   car: {
      id: "car", url: "/models/3d/pigeon-crossing/car.glb", scale: 1.4 * CAR_SIZE, stretch: [0.87, 0.82, 1], rotationY: Math.PI,
      fallback: "box", fallbackColor: "#f47967", budget: { ...PROP_BUDGET },
   },
   taxi: {
      id: "taxi", url: "/models/3d/pigeon-crossing/taxi.glb", scale: 1.56 * CAR_SIZE, stretch: [0.795, 0.5565, 1],
      fallback: "box", fallbackColor: "#ffd15b", budget: { ...PROP_BUDGET },
   },
   van: {
      id: "van", url: "/models/3d/pigeon-crossing/van.glb", scale: 1.93 * CAR_SIZE, stretch: [0.56, 0.64, 1],
      fallback: "box", fallbackColor: "#e9edf3", budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** Drawn litter size the stand-ins are built at (the GLBs reach it through LITTER_SCALE). */
export const LITTER_DRAW = 0.475;

/** Beyond the far street (the parked cars reach z -16.7, the centre line is at -17.6): the far pavement. */
export const FESTIVAL_STALL_SPOTS = [
   { x: -5, y: 0, z: -19.6 },
   { x: 0, y: 0, z: -19.6 },
   { x: 6, y: 0, z: -19.6 },
] as const;
