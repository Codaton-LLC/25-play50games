// Models shared by several games (public/models/3d/shared/<id>.glb). Plain data, no three.js.
// Mirrors src/arcade3d/assets/shared.spec.json. Owned by Claude: games reuse these entries
// (spread them to change scale/rotation) but never edit this file.
import type { ModelAsset } from "./types";
import type { HumanoidLandmarks } from "./rig/humanoid";

export type SharedAssetId = "runner" | "robot" | "battery" | "crate" | "tinCan" | "banana" | "desk" | "chair" | "coin";

/** Budgets after `optimize` (platform-plan §4). */
export const CHARACTER_BUDGET = { tris: 20000, bytes: 1_500_000 } as const;
export const PROP_BUDGET = { tris: 5000, bytes: 300_000 } as const;

const shared = (id: SharedAssetId) => `/models/3d/shared/${id}.glb`;

/**
 * The robot's joints (GLB units: 1.90 x 1.72 x 0.60 T-pose, faces +z), measured once from
 * robot.glb (2026-10-06, core/README "Measuring a character") and checked in the rig preview.
 * estimateHumanoidLandmarks finds most of them within 3 cm (rig/robot.test.ts pins the rest):
 * - shoulderX 0.30 (estimate 0.292): the joint on the outer edge of the shoulder caps;
 * - armSpread 0.28 rad = 16° (estimate 0.162 = 9°): raised by eye so the hanging arms clear the body;
 * - elbowX / wristX on the model's own joints (5 cm inside the estimate), the hips 3 cm lower;
 * - hipZ 0.033 (estimate -0.022, the shins' middle; the robot's calves reach back): the thighs' and
 *   knees' middle; legDepth is measured about it;
 * - neckY 1.15, headY 1.18, neckBlend 0.015 (estimate 1.179 / 1.193 / 0.007): the head joint at the
 *   top of the neck, so the whole helmet (from 1.195 up) is rigid on the head bone;
 * - ankleY 0.17 with a 0.03 blend (estimate 0.177 / 0.034): the boots (up to about 0.14) are rigid feet;
 * - nothing bridges its legs: hemY = crotchY (no skirt weights).
 */
export const ROBOT_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.079,
   shoulderX: 0.3,
   shoulderZ: 0.031,
   armRadius: 0.093,
   clavicleX: 0.15,
   elbowX: 0.47,
   wristX: 0.7,
   armSpread: 0.28,
   crotchY: 0.65,
   hipY: 0.71,
   hipX: 0.172,
   hipZ: 0.033,
   kneeY: 0.355,
   ankleY: 0.17,
   toeZ: 0.29,
   heelZ: -0.218,
   legDepth: 0.203,
   legOuterX: 0.322,
   hemY: 0.65,
   spineY: 0.821,
   chestY: 0.931,
   neckY: 1.15,
   headY: 1.18,
   spineZ: 0.057,
   shoulderBlend: 0.056,
   elbowBlend: 0.046,
   hipBlend: 0.071,
   kneeBlend: 0.053,
   ankleBlend: 0.03,
   crotchBlend: 0.063,
   spineBlend: 0.033,
   neckBlend: 0.015,
};

/**
 * The runner's joints (GLB units: 1.90 x 1.886 x 0.52 T-pose, the arm span the longest side; faces
 * +z, stylised: a big head with glasses and a beard, hoodie, joggers, sneakers), measured from the
 * v2 runner.glb (2026-10-07, the same recipe as the robot's; rig/runner.test.ts). The estimate finds
 * most of them; set by eye:
 * - armRadius 0.095 (estimate 0.076) about shoulderY 1.35: the thick sleeve's top (its stripe, up to
 *   about 1.44 at the shoulder) and underside are in the arm band, so they go down with the arm
 *   instead of staying out as fins;
 * - headY 1.53 / neckY 1.49 (estimate 1.599 / 1.56): there is no neck to see in front (the beard
 *   reaches the hood's collar), so the estimate's narrowest bands are the beard and the mouth and its
 *   head joint fell at the mouth; at the top of the collar the face, glasses and beard turn as one
 *   (the hood's top behind the head, up to 1.535, follows the head a little);
 * - hipZ -0.035 (estimate -0.058, the shins' middle): between the thighs' middle (about -0.005) and
 *   the knees' (-0.05), so the legs swing about their own axis; legDepth widened with it;
 * - ankleY 0.205 with a 0.025 blend (estimate 0.169 / 0.043): the sneakers (up to about 0.19) are
 *   rigid, the ankle bends in the sock;
 * - hemY = crotchY: nothing bridges the legs (the estimate agrees).
 */
export const RUNNER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.35,
   shoulderX: 0.275,
   shoulderZ: -0.033,
   armRadius: 0.095,
   clavicleX: 0.138,
   elbowX: 0.511,
   wristX: 0.747,
   armSpread: 0.164,
   crotchY: 0.747,
   hipY: 0.827,
   hipX: 0.157,
   hipZ: -0.035,
   kneeY: 0.414,
   ankleY: 0.205,
   toeZ: 0.258,
   heelZ: -0.139,
   legDepth: 0.1,
   legOuterX: 0.269,
   hemY: 0.747,
   spineY: 0.983,
   chestY: 1.139,
   neckY: 1.49,
   headY: 1.53,
   spineZ: 0.003,
   shoulderBlend: 0.045,
   elbowBlend: 0.038,
   hipBlend: 0.083,
   kneeBlend: 0.062,
   ankleBlend: 0.025,
   crotchBlend: 0.076,
   spineBlend: 0.047,
   neckBlend: 0.02,
};

export const SHARED_ASSETS: Record<SharedAssetId, ModelAsset> = {
   // Rodin characters come as static T-poses: the core auto-rig (core/rig) animates them. The
   // runner is 1.886 tall in GLB units (its arm span, 1.90, is the longest side): a game sets
   // `scale` for its own drawn height (office-escape 0.825 = 1.556 m, obstacle-race 0.795 = 1.50 m).
   // There is deliberately no default: drawn as is (`SHARED_ASSETS.runner.scale ?? 1`) it stands
   // 1.886 m tall. A game draws `{ ...SHARED_ASSETS.runner, scale }` from its own assets.ts and
   // derives its stride and lift scale from that asset (clean-city 0.503 = 0.95 m; escape-room 0.744
   // = 1.40 m, its stand-in's height; tower-climb 0.2916 = 0.55 m); RUNNER_LANDMARKS are complete,
   // so no ROBOT_LANDMARKS spread.
   runner: {
      id: "runner",
      url: shared("runner"),
      humanoid: { landmarks: RUNNER_LANDMARKS },
      fallback: "capsule",
      fallbackColor: "#f97316",
      budget: { ...CHARACTER_BUDGET },
   },
   robot: {
      id: "robot",
      url: shared("robot"),
      humanoid: { landmarks: ROBOT_LANDMARKS },
      fallback: "capsule",
      fallbackColor: "#2dd4bf",
      budget: { ...CHARACTER_BUDGET },
   },
   battery: {
      id: "battery",
      url: shared("battery"),
      fallback: "cylinder",
      fallbackColor: "#4ade80",
      budget: { ...PROP_BUDGET },
   },
   crate: {
      id: "crate",
      url: shared("crate"),
      fallback: "box",
      fallbackColor: "#b45309",
      budget: { ...PROP_BUDGET },
   },
   tinCan: {
      id: "tinCan",
      url: shared("tinCan"),
      fallback: "cylinder",
      fallbackColor: "#94a3b8",
      budget: { ...PROP_BUDGET },
   },
   banana: {
      id: "banana",
      url: shared("banana"),
      fallback: "capsule",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
   desk: {
      id: "desk",
      url: shared("desk"),
      fallback: "box",
      fallbackColor: "#a16207",
      budget: { ...PROP_BUDGET },
   },
   chair: {
      id: "chair",
      url: shared("chair"),
      fallback: "box",
      fallbackColor: "#475569",
      budget: { ...PROP_BUDGET },
   },
   // A gold coin with a raised star on both faces (group D, 2026-10-07), COIN_GLB_SIZE below. Like
   // the runner, no default scale: a game spreads it with its own `scale` and `yOffset`.
   coin: {
      id: "coin",
      url: shared("coin"),
      fallback: "cylinder",
      fallbackColor: "#fbbf24",
      budget: { ...PROP_BUDGET },
   },
};

/**
 * SHARED_ASSETS.coin's measured bounds in GLB units: it stands on its edge on y = 0 (centre at
 * y 0.93), its faces along ±z, about 0.33 deep at the rim. A game fits it from these, never from
 * copies of the numbers: `scale` = its diameter / width and, for a coin placed by its centre,
 * `yOffset` = -scale x height / 2 (office-escape, tower-climb; office-escape/coin.test.ts checks
 * them against the real mesh).
 */
export const COIN_GLB_SIZE = { width: 1.899, height: 1.861, depth: 0.492 } as const;

/**
 * GLBs that live in an original game's folder and are reused by the expansion games
 * (docs/arcade-expansion/06 §F.1). The URLs stay where they are (thumbnails, tests and the manifest
 * keep working); a new game imports these aliases from core, never from another game's folder.
 * No scale: Rodin GLBs are about 1.9 units on their longest side, so each game fits the model from
 * its own measured size (spread the entry: `{ ...REUSED_ASSETS.palm, scale: 1.2 / 1.9 }`), as
 * office-escape and tower-climb do with the coin. The originals keep their own assets.ts entries.
 * chef and cleaner are T-pose characters: their landmarks (CHEF_LANDMARKS, CLEANER_LANDMARKS) still
 * live in food-catcher / clean-city and move to core in the first expansion game that animates them.
 */
export type ReusedAssetId =
   | "barrel"
   | "apple"
   | "burger"
   | "sock"
   | "chef"
   | "cleaner"
   | "bottle"
   | "bag"
   | "bench"
   | "bin"
   | "lamp"
   | "palm"
   | "umbrella"
   | "book"
   | "door"
   | "pallet"
   | "checkpointFlag"
   | "car"
   | "taxi"
   | "van"
   | "pigeon";

const reused = (
   id: ReusedAssetId,
   url: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({ id, url, fallback, fallbackColor, budget });

export const REUSED_ASSETS: Record<ReusedAssetId, ModelAsset> = {
   barrel: reused("barrel", "/models/3d/robot-collector/barrel.glb", "cylinder", "#38bdf8"),
   apple: reused("apple", "/models/3d/food-catcher/apple.glb", "sphere", "#ef4444"),
   burger: reused("burger", "/models/3d/food-catcher/burger.glb", "cylinder", "#d97706"),
   sock: reused("sock", "/models/3d/food-catcher/sock.glb", "box", "#a78bfa"),
   chef: reused("chef", "/models/3d/food-catcher/chef.glb", "capsule", "#f8fafc", CHARACTER_BUDGET),
   cleaner: reused("cleaner", "/models/3d/clean-city/cleaner.glb", "capsule", "#f97316", CHARACTER_BUDGET),
   bottle: reused("bottle", "/models/3d/clean-city/bottle.glb", "cylinder", "#22c55e"),
   bag: reused("bag", "/models/3d/clean-city/bag.glb", "box", "#e2e8f0"),
   bench: reused("bench", "/models/3d/clean-city/bench.glb", "box", "#92400e"),
   bin: reused("bin", "/models/3d/clean-city/bin.glb", "cylinder", "#64748b"),
   lamp: reused("lamp", "/models/3d/clean-city/lamp.glb", "cylinder", "#94a3b8"),
   palm: reused("palm", "/models/3d/clean-city/palm.glb", "cylinder", "#4d7c0f"),
   umbrella: reused("umbrella", "/models/3d/clean-city/umbrella.glb", "cylinder", "#f43f5e"),
   book: reused("book", "/models/3d/escape-room/book.glb", "box", "#7c3aed"),
   door: reused("door", "/models/3d/escape-room/door.glb", "box", "#a16207"),
   pallet: reused("pallet", "/models/3d/warehouse-rush/pallet.glb", "box", "#b45309"),
   checkpointFlag: reused("checkpointFlag", "/models/3d/tower-climb/checkpoint-flag.glb", "cylinder", "#fbbf24"),
   car: reused("car", "/models/3d/pigeon-crossing/car.glb", "box", "#f47967"),
   taxi: reused("taxi", "/models/3d/pigeon-crossing/taxi.glb", "box", "#ffd15b"),
   van: reused("van", "/models/3d/pigeon-crossing/van.glb", "box", "#e9edf3"),
   pigeon: reused("pigeon", "/models/3d/pigeon-crossing/pigeon.glb", "sphere", "#8192a9", CHARACTER_BUDGET),
};

/**
 * Expansion batch 1 (2026-10-08): Hyper3D Rodin GLBs for the 20 expansion games, optimized with
 * tools/hyper3d (docs/arcade-expansion/05-hyper3d-catalog.md §E.4 / §E.5). None of those games has a
 * scene yet, so each entry carries a default fit: drawn as is, the model stands on y = 0 at the
 * catalog's target size in metres, its front (the cannon's barrel, the ship's bow, the cart's
 * handle) towards +z. A game spreads an entry to refit it (`{ ...EXPANSION_ASSETS.rock, scale }`)
 * and derives that fit from EXPANSION_GLB_SIZE, never from copied numbers. Every optimized GLB is
 * centred on x / z with its lowest point on y = 0, so no entry needs a yOffset.
 */
export type ExpansionAssetId =
   | "chest"
   | "cannon"
   | "rock"
   | "fish"
   | "pineTree"
   | "penguin"
   | "ship"
   | "cart"
   | "suitcase"
   | "monster"
   | "cauldron"
   // batch 2-3
   | "dino"
   | "drone"
   | "rocket"
   | "windmill"
   | "leafyTree"
   | "vacuum"
   | "dummy"
   | "goblin"
   | "castleTower"
   | "glowPod"
   | "panda"
   // tier 3 (class E decor)
   | "bust"
   | "mushroom"
   | "plane"
   | "crab"
   | "gourd";

/**
 * The optimized GLBs' bounds in GLB units (x = width, y = height, z = depth, before rotationY),
 * measured 2026-10-08 (core/expansionAssets.test.ts checks them against the real meshes). Rodin
 * scales the longest side to about 1.9.
 */
export const EXPANSION_GLB_SIZE = {
   chest: { width: 1.8972, height: 1.634, depth: 1.5005 },
   cannon: { width: 1.3736, height: 1.4473, depth: 1.8975 },
   // v2 (2026-10-08, regenerated grey stone, same url)
   rock: { width: 1.9011, height: 0.8989, depth: 1.857 },
   fish: { width: 0.6609, height: 1.1352, depth: 1.8988 },
   pineTree: { width: 1.3784, height: 1.9181, depth: 1.3535 },
   penguin: { width: 1.9003, height: 1.8671, depth: 1.2884 },
   ship: { width: 1.2975, height: 1.7119, depth: 1.8944 },
   cart: { width: 1.2879, height: 1.897, depth: 1.6085 },
   // v2 (2026-10-08, same url): the extended trolley handle is still there
   suitcase: { width: 1.0493, height: 1.8981, depth: 0.5448 },
   monster: { width: 1.8973, height: 1.7788, depth: 1.2314 },
   cauldron: { width: 1.9041, height: 1.2522, depth: 1.6892 },
   // batch 2-3
   dino: { width: 1.1249, height: 1.4694, depth: 1.8939 },
   drone: { width: 1.8941, height: 1.0245, depth: 1.4229 },
   rocket: { width: 1.3018, height: 1.8955, depth: 1.2424 },
   windmill: { width: 1.3533, height: 1.8979, depth: 1.2987 },
   leafyTree: { width: 1.804, height: 1.9133, depth: 1.247 },
   vacuum: { width: 0.7937, height: 1.6149, depth: 1.8963 },
   dummy: { width: 0.7805, height: 1.8965, depth: 0.6395 },
   goblin: { width: 1.4028, height: 1.8957, depth: 0.7557 },
   castleTower: { width: 1.3862, height: 1.91, depth: 1.4204 },
   glowPod: { width: 1.2724, height: 1.8995, depth: 1.0186 },
   panda: { width: 1.1989, height: 1.6446, depth: 1.8992 },
   // tier 3
   bust: { width: 1.2118, height: 1.9114, depth: 1.0072 },
   mushroom: { width: 1.8782, height: 1.9016, depth: 1.8658 },
   plane: { width: 1.9045, height: 0.8171, depth: 1.628 },
   crab: { width: 1.9036, height: 1.3386, depth: 1.5298 },
   gourd: { width: 1.7987, height: 1.8942, depth: 1.1177 },
} as const satisfies Record<ExpansionAssetId, { width: number; height: number; depth: number }>;

/** Points measured on the GLBs (GLB units, before the fit; `expansionPoint` maps them to metres). */
export const EXPANSION_GLB_POINTS = {
   /** the centre of the cannon's muzzle ring, on its front face (the barrel points +z, slightly up) */
   cannonMuzzle: { x: 0, y: 1.036, z: 0.9488 },
   /** the sloop's hull side top at midship (the deck edge); the keel is at y = 0 */
   shipDeck: { x: 0, y: 0.495, z: 0 },
   /**
    * A waterline for the bob: 40 % of the midship side height, at the hull's widest band (the beam
    * is greatest at y 0.2-0.4). A judgement, not a mesh feature: a game may sink it further.
    */
   shipWaterline: { x: 0, y: 0.2, z: 0 },
   /** the middle of the red push bar (GLB -z, +z after rotationY π): where the runner's hands go */
   cartHandle: { x: 0, y: 1.777, z: -0.7 },
   /** the inner edge of the cauldron's rolled rim (radius 0.70 at its narrowest, y 1.1) */
   cauldronInnerRim: { x: 0, y: 1.235, z: 0 },
   /** the cauldron's inner floor (the bottom of its interior) */
   cauldronInnerFloor: { x: 0, y: 0.263, z: 0 },
   /**
    * The top of the suitcase's hard shell (v2: flat at 1.46-1.47 across it); the extended trolley handle
    * rises above it to y 1.90 at its back (z -0.2), a short carry handle to 1.55 beside it.
    */
   suitcaseShellTop: { x: 0, y: 1.47, z: 0 },
   // batch 2-3
   /** the top of the dino's back at mid-body (the egg stack's base): flat within 1 cm from z -0.3 to 0, the frill rises from z 0.1 */
   dinoBackTop: { x: 0, y: 0.756, z: -0.1 },
   /** the drone's claw, centre of its lowest part (the parcel hangs here); the body's underside is at y 0.31 */
   droneHook: { x: 0, y: 0.03, z: 0.38 },
   /** the base of the dummy's post: its wobble pivot (the red base disc, radius 0.355, top at y 0.048) */
   dummyPivot: { x: 0, y: 0, z: 0 },
   /** the rocket's engine bell: centre of its lowest rim (the flame starts here) */
   rocketBell: { x: 0, y: 0.13, z: 0 },
   /**
    * The windmill's hub: the centre of the round wooden boss on its front face (the disc spans y 0.84-1.15,
    * x ±0.2; its front at z 0.56): the procedural blades turn about +z here.
    */
   windmillHub: { x: 0, y: 0.99, z: 0.56 },
   /** the castle tower's walkway inside the battlements (the cone roof fills the middle, radius < 0.45) */
   castleTowerPlatform: { x: 0, y: 1.374, z: 0 },
   /**
    * The hose connector: the small block on top of the pack behind its carry handle (the handle runs along
    * z 0.1-0.5 up to y 1.61). Rodin modelled no real connector; this is the nearest feature.
    */
   vacuumHose: { x: 0, y: 1.52, z: -0.02 },
} as const;

/**
 * The drone's four rotor-ring centres (GLB units, for the code blur discs), about ±3 cm: the model is
 * pitched nose-down (the front rings lower) and its rear rings sit slightly inward and asymmetric.
 */
export const DRONE_ROTORS_GLB = [
   { x: -0.7, y: 0.7, z: 0.41 },
   { x: 0.7, y: 0.7, z: 0.41 },
   { x: -0.64, y: 0.9, z: -0.46 },
   { x: 0.5, y: 0.9, z: -0.46 },
] as const;

/** The rocket's four landing feet (GLB units, centres of the pads on y = 0), for the 2D landing polygon. */
export const ROCKET_FEET_GLB = [
   { x: 0, y: 0, z: 0.449 },
   { x: 0, y: 0, z: -0.424 },
   { x: 0.43, y: 0, z: 0 },
   { x: -0.429, y: 0, z: 0.021 },
] as const;

/**
 * The leafy tree's trunk radius (GLB units): its collision circle. The trunk is 0.08-0.15 from the axis
 * at y 0.1-0.3 (mean 0.11; the roots flare to 0.19 at y 0.05), so 0.14 covers it but for one root.
 */
export const LEAFY_TREE_TRUNK_RADIUS_GLB = 0.14;

/**
 * The windmill's tunnel (GLB units), open straight through along z (front arch at z +0.65, back at -0.65).
 * Its narrowest section is the back arch's throat at z -0.4..-0.5: `width` across at the floor (y 0.05),
 * `height` its ceiling at x = 0; `clearWidth` the box |x| < clearWidth / 2 that is free from y 0 to
 * `clearHeight` along the whole tunnel. The front arch is wider (0.47 x 0.37).
 */
export const WINDMILL_TUNNEL_GLB = { width: 0.31, height: 0.247, clearWidth: 0.2, clearHeight: 0.2 } as const;

/** The cauldron's inner radius at its rim, GLB units (the liquid disc's radius × the fit's scale). */
export const CAULDRON_INNER_RADIUS_GLB = 0.7;

const EX = EXPANSION_GLB_SIZE;
const expansion = (id: ExpansionAssetId, slug: string, fit: Pick<ModelAsset, "scale" | "stretch" | "rotationY">, fallback: ModelAsset["fallback"], fallbackColor: string, tris: number, bytes: number = PROP_BUDGET.bytes): ModelAsset => ({
   id,
   url: `/models/3d/${slug}/${id}.glb`,
   ...fit,
   fallback,
   fallbackColor,
   budget: { tris, bytes },
});

/**
 * Default fits (budget = the catalog's tris cap, 300 KB). Where Rodin's proportions differ from the
 * catalog's box the fit stretches the model to it (chest, cart, suitcase); a game that prefers the
 * model's own proportions keeps `scale` and drops `stretch`.
 */
export const EXPANSION_ASSETS: Record<ExpansionAssetId, ModelAsset> = {
   // 0.9 wide x 0.6 tall x 0.6 deep, lock plate +z. Rodin's chest is taller (1.63 / 1.90): the
   // stretch flattens it by about a quarter.
   chest: expansion("chest", "shared", { scale: 0.9 / EX.chest.width, stretch: [1, 0.6 / (EX.chest.height * (0.9 / EX.chest.width)), 0.6 / (EX.chest.depth * (0.9 / EX.chest.width))] }, "box", "#8b5a2b", 4000),
   // 1.6 long, barrel +z
   cannon: expansion("cannon", "shared", { scale: 1.6 / EX.cannon.depth }, "cylinder", "#b45309", 4000),
   // a 1 m unit on its longest side (x); games vary scale / stretch / yaw per copy
   rock: expansion("rock", "shared", { scale: 1 / EX.rock.width }, "sphere", "#78716c", 3000),
   // 0.35 long, head +z
   fish: expansion("fish", "shared", { scale: 0.35 / EX.fish.depth }, "capsule", "#f97316", 1500),
   // 4 m tall
   pineTree: expansion("pineTree", "shared", { scale: 4 / EX.pineTree.height }, "cylinder", "#166534", 3000),
   // 0.8 m standing, faces +z (penguin-slide lays it on its belly in code)
   penguin: expansion("penguin", "shared", { scale: 0.8 / EX.penguin.height }, "capsule", "#1f2937", 8000),
   // the sloop: 6 m long, bow +z (dinghy x0.5, galleon x1.5 in the game)
   ship: expansion("ship", "pirate-cannons", { scale: 6 / EX.ship.depth }, "box", "#92400e", 5000),
   // 0.6 wide x 1.0 tall x 1.0 long, push handle +z (the GLB has it at -z). Rodin's cart is wider
   // and shorter than the catalog's: stretch x 0.88, z 1.18.
   cart: expansion("cart", "shopping-cart", { scale: 1 / EX.cart.height, stretch: [0.6 / (EX.cart.width / EX.cart.height), 1, 1 / (EX.cart.depth / EX.cart.height)], rotationY: Math.PI }, "box", "#e5e7eb", 4000),
   // upright, front +z: the shell 0.5 wide x 0.7 tall x 0.25 deep (the game lays it on the belt).
   // The v2 GLB (regenerated without the handle in its prompt) still has an extended trolley handle
   // above the shell at its back: drawn 0.90 m tall in all.
   suitcase: expansion("suitcase", "luggage-rush", {
      scale: 0.7 / EXPANSION_GLB_POINTS.suitcaseShellTop.y,
      stretch: [0.5 / (EX.suitcase.width * (0.7 / EXPANSION_GLB_POINTS.suitcaseShellTop.y)), 1, 0.25 / (EX.suitcase.depth * (0.7 / EXPANSION_GLB_POINTS.suitcaseShellTop.y))],
   }, "box", "#d4d4d8", 2500),
   // 1.4 m tall, faces +z
   monster: expansion("monster", "monster-kitchen", { scale: 1.4 / EX.monster.height }, "capsule", "#ede9fe", 8000),
   // 0.9 m wide across its side handles (x), the rim 0.81 across
   cauldron: expansion("cauldron", "monster-kitchen", { scale: 0.9 / EX.cauldron.width }, "cylinder", "#334155", 3000),

   // batch 2-3. dino and panda are solid creatures optimized with the character profile (1024 px).
   // 1.1 long x 0.8 tall, head +z (Rodin's dino is taller: stretch y 0.94)
   dino: expansion("dino", "shared", { scale: 1.1 / EX.dino.depth, stretch: [1, 0.8 / (EX.dino.height * (1.1 / EX.dino.depth)), 1] }, "capsule", "#84cc16", 12000, CHARACTER_BUDGET.bytes),
   // 0.9 wide, camera eye +z, claw under the nose
   drone: expansion("drone", "delivery-drone", { scale: 0.9 / EX.drone.width }, "box", "#e2e8f0", 3000),
   // 2.2 m tall (catalog), window +z
   rocket: expansion("rocket", "rocket-landing", { scale: 2.2 / EX.rocket.height }, "capsule", "#e5e7eb", 3000),
   // 2.2 m tall, hub and tunnel arch +z (the tunnel runs through along z)
   windmill: expansion("windmill", "mini-golf", { scale: 2.2 / EX.windmill.height }, "cylinder", "#fde68a", 4000),
   // 3.5 m tall (the catalog says 3-4 m)
   leafyTree: expansion("leafyTree", "shared", { scale: 3.5 / EX.leafyTree.height }, "cylinder", "#65a30d", 3000),
   // 0.55 m tall, the glowing canister +z, the back with its straps at -z (on a +z-facing runner's back:
   // rotationY π). Rodin added shoulder straps that hang to the floor behind the pack (z -0.5 to -0.95).
   vacuum: expansion("vacuum", "ghost-vacuum", { scale: 0.55 / EX.vacuum.height }, "box", "#e5e7eb", 2500),
   // 1.5 m on its base disc (the pivot at y = 0): a wooden mannequin standing on a red disc (r 0.32, its
   // centre 3 cm to -x), no post
   dummy: expansion("dummy", "knight-arena", { scale: 1.5 / EX.dummy.height }, "capsule", "#d97706", 3000),
   // 0.9 m, faces +z
   goblin: expansion("goblin", "castle-defender", { scale: 0.9 / EX.goblin.height }, "capsule", "#a3b18a", 4500),
   // 6 m tall, door +z
   castleTower: expansion("castleTower", "shared", { scale: 6 / EX.castleTower.height }, "cylinder", "#a8a29e", 4000),
   // 1.0 m: the grown stage (a game scales it down to 0.5 for the first stage)
   glowPod: expansion("glowPod", "alien-farm", { scale: 1 / EX.glowPod.height }, "sphere", "#22d3ee", 2000),
   // 1.0 m long on all fours, faces +z
   panda: expansion("panda", "zoo-escape", { scale: 1 / EX.panda.depth }, "capsule", "#f8fafc", 10000, CHARACTER_BUDGET.bytes),

   // tier 3 (class E decor, 2026-10-08)
   // 0.6 m tall on its short round foot, face +z (a marble head and shoulders)
   bust: expansion("bust", "museum-guard", { scale: 0.6 / EX.bust.height }, "capsule", "#f5f5f4", 3000),
   // 0.5 m tall, cap 0.49 across
   mushroom: expansion("mushroom", "shared", { scale: 0.5 / EX.mushroom.height }, "sphere", "#dc2626", 2000),
   // 8 m long, nose (propeller) +z: a single-propeller toy plane, wingspan 9.4 m, 4.0 m tall on its wheels
   plane: expansion("plane", "luggage-rush", { scale: 8 / EX.plane.depth }, "box", "#e0f2fe", 4000),
   // 0.35 m wide across its claws, eyes +z
   crab: expansion("crab", "treasure-island", { scale: 0.35 / EX.crab.width }, "sphere", "#ef4444", 2000),
   // 0.6 m tall with its curled tendrils (they spread along x)
   gourd: expansion("gourd", "alien-farm", { scale: 0.6 / EX.gourd.height }, "sphere", "#22d3ee", 3000),
};

/**
 * A point measured on an expansion GLB (EXPANSION_GLB_POINTS, GLB units) where the asset's fit draws
 * it, in metres relative to the model's origin: scale x stretch per GLB axis, then rotationY, then
 * yOffset (the order <Model> applies them).
 */
export function expansionPoint(asset: Pick<ModelAsset, "scale" | "stretch" | "rotationY" | "yOffset">, p: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1], a = asset.rotationY ?? 0;
   const x = p.x * s * k[0], y = p.y * s * k[1], z = p.z * s * k[2];
   const c = Math.cos(a), sn = Math.sin(a);
   return { x: x * c + z * sn, y: y + (asset.yOffset ?? 0), z: -x * sn + z * c };
}

/**
 * Expansion batch 2-3 characters (2026-10-08): Hyper3D Rodin image-to-3D T-pose GLBs (the user's
 * face on the knight, the astronaut and the keeper; the snow kid a child, the alien its own),
 * optimized with the character profile and drawn through the core auto-rig: each asset carries
 * `humanoid: { landmarks }` measured from its mesh (core/README "Landmarks, and measuring a
 * character"; rig/expansionCharacters.test.ts checks them on the real meshes). The default fit
 * stands each one on y = 0, facing +z, at its target height in metres; a game spreads the entry to
 * change the scale and derives it from EXPANSION_CHARACTER_GLB_HEIGHT.
 */
export type ExpansionCharacterId = "knight" | "snowKid" | "astronaut" | "alien" | "keeper";

/** The T-pose GLBs' heights (GLB units; the arm span is the longest side, about 1.9). */
export const EXPANSION_CHARACTER_GLB_HEIGHT = {
   knight: 1.884,
   snowKid: 1.9011,
   astronaut: 1.8231,
   alien: 1.8902,
   keeper: 1.8921,
} as const satisfies Record<ExpansionCharacterId, number>;

/** The default heights in metres (a game may refit: museum-guard's statue knight is 1.6 m in the catalog). */
export const EXPANSION_CHARACTER_HEIGHT = {
   knight: 1.75,
   snowKid: 1.3,
   astronaut: 1.75,
   alien: 1.1,
   keeper: 1.75,
} as const satisfies Record<ExpansionCharacterId, number>;

/**
 * The shared knight's joints (GLB units: 1.884 tall T-pose, reach 0.949, faces +z; open-face helmet
 * with a plume, pauldrons, gauntlets, a tabard to mid-thigh, boots), measured 2026-10-08. The
 * estimate's set but:
 * - armRadius 0.17 (estimate 0.101) about shoulderY 1.148: the pauldrons reach up to 1.32, so their
 *   tops go down with the arms instead of staying out as fins;
 * - hemY 0.55 (the estimate): the tabard bridges the legs above the knee, so it is skirt-weighted.
 */
export const KNIGHT_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.148,
   shoulderX: 0.276,
   shoulderZ: 0.019,
   armRadius: 0.17,
   clavicleX: 0.138,
   elbowX: 0.511,
   wristX: 0.747,
   armSpread: 0.227,
   crotchY: 0.707,
   hipY: 0.775,
   hipX: 0.15,
   hipZ: 0.028,
   kneeY: 0.388,
   ankleY: 0.165,
   toeZ: 0.328,
   heelZ: -0.095,
   legDepth: 0.118,
   legOuterX: 0.259,
   hemY: 0.55,
   spineY: 0.887,
   chestY: 0.999,
   neckY: 1.358,
   headY: 1.405,
   spineZ: 0.076,
   shoulderBlend: 0.06,
   elbowBlend: 0.05,
   hipBlend: 0.078,
   kneeBlend: 0.058,
   ankleBlend: 0.039,
   crotchBlend: 0.045,
   spineBlend: 0.034,
   neckBlend: 0.024,
};

/**
 * The snowball-battle kid's joints (GLB units: 1.901 tall, reach 0.943; puffer jacket, cargo
 * trousers, boots), measured 2026-10-08. The estimate's set but: armRadius 0.115 (estimate 0.091):
 * the puffy sleeves span y 1.12-1.32 about shoulderY 1.209; hemY = crotchY (the estimate's 0.602 is
 * the close cargo thighs: the jacket ends above the crotch).
 */
export const SNOW_KID_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.209,
   shoulderX: 0.305,
   shoulderZ: -0.006,
   armRadius: 0.115,
   clavicleX: 0.152,
   elbowX: 0.528,
   wristX: 0.751,
   armSpread: 0.237,
   crotchY: 0.713,
   hipY: 0.785,
   hipX: 0.174,
   hipZ: -0.047,
   kneeY: 0.393,
   ankleY: 0.194,
   toeZ: 0.282,
   heelZ: -0.185,
   legDepth: 0.141,
   legOuterX: 0.338,
   hemY: 0.713,
   spineY: 0.912,
   chestY: 1.039,
   neckY: 1.458,
   headY: 1.521,
   spineZ: 0.016,
   shoulderBlend: 0.055,
   elbowBlend: 0.046,
   hipBlend: 0.079,
   kneeBlend: 0.059,
   ankleBlend: 0.035,
   crotchBlend: 0.061,
   spineBlend: 0.038,
   neckBlend: 0.032,
};

/**
 * The space-repair astronaut's joints (GLB units: 1.823 tall, reach 0.945; bulky suit, round helmet,
 * a backpack on the GLB), measured 2026-10-08. The estimate's set but: armRadius 0.115 (estimate
 * 0.099): the suit's arms span y 1.02-1.23; armSpread 0.24 (estimate 0.202): the gloves hang clear
 * of the suit's hips; hemY = crotchY (the estimate's 0.577 is the bulky thighs). The helmet (from
 * headY 1.352 + its blend) is rigid.
 */
export const ASTRONAUT_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.123,
   shoulderX: 0.309,
   shoulderZ: 0.047,
   armRadius: 0.115,
   clavicleX: 0.155,
   elbowX: 0.532,
   wristX: 0.754,
   armSpread: 0.24,
   crotchY: 0.684,
   hipY: 0.751,
   hipX: 0.18,
   hipZ: -0.007,
   kneeY: 0.376,
   ankleY: 0.185,
   toeZ: 0.313,
   heelZ: -0.156,
   legDepth: 0.133,
   legOuterX: 0.319,
   hemY: 0.684,
   spineY: 0.863,
   chestY: 0.974,
   neckY: 1.291,
   headY: 1.352,
   spineZ: -0.006,
   shoulderBlend: 0.059,
   elbowBlend: 0.05,
   hipBlend: 0.075,
   kneeBlend: 0.056,
   ankleBlend: 0.034,
   crotchBlend: 0.066,
   spineBlend: 0.033,
   neckBlend: 0.03,
};

/**
 * The alien-farm alien's joints (GLB units: 1.890 tall, reach 0.928; a big head with antennae on a
 * short neck, shirt, short dungarees, boots), measured 2026-10-08. The estimate's set but:
 * armRadius 0.105 (estimate 0.089): the rolled sleeves span y 0.93-1.12; hemY = crotchY (the
 * estimate's 0.473 is the dungaree legs). The head joint at the top of the short neck (headY 1.142,
 * the estimate) keeps the head and antennae rigid.
 */
export const ALIEN_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.027,
   shoulderX: 0.3,
   shoulderZ: -0.043,
   armRadius: 0.105,
   clavicleX: 0.15,
   elbowX: 0.52,
   wristX: 0.739,
   armSpread: 0.25,
   crotchY: 0.551,
   hipY: 0.613,
   hipX: 0.179,
   hipZ: -0.022,
   kneeY: 0.306,
   ankleY: 0.18,
   toeZ: 0.29,
   heelZ: -0.178,
   legDepth: 0.115,
   legOuterX: 0.306,
   hemY: 0.551,
   spineY: 0.737,
   chestY: 0.861,
   neckY: 1.126,
   headY: 1.142,
   spineZ: -0.001,
   shoulderBlend: 0.053,
   elbowBlend: 0.045,
   hipBlend: 0.061,
   kneeBlend: 0.046,
   ankleBlend: 0.022,
   crotchBlend: 0.055,
   spineBlend: 0.037,
   neckBlend: 0.008,
};

/**
 * The zoo-escape keeper's joints (GLB units: 1.892 tall, reach 0.951; safari hat, short-sleeved
 * shirt, neckerchief, shorts, hiking boots), measured 2026-10-08. The estimate's set but:
 * armRadius 0.11 (estimate 0.073): the short sleeves span y 1.10-1.31 about shoulderY 1.213, so they
 * hang with the arm instead of staying out as fins; hemY = crotchY (the estimate's 0.536 is the
 * shorts). The hat (from y 1.48) is above the head joint, rigid.
 */
export const ZOO_KEEPER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.213,
   shoulderX: 0.286,
   shoulderZ: -0.074,
   armRadius: 0.11,
   clavicleX: 0.143,
   elbowX: 0.519,
   wristX: 0.752,
   armSpread: 0.181,
   crotchY: 0.71,
   hipY: 0.782,
   hipX: 0.167,
   hipZ: -0.059,
   kneeY: 0.391,
   ankleY: 0.179,
   toeZ: 0.257,
   heelZ: -0.205,
   legDepth: 0.121,
   legOuterX: 0.323,
   hemY: 0.71,
   spineY: 0.911,
   chestY: 1.041,
   neckY: 1.372,
   headY: 1.435,
   spineZ: -0.01,
   shoulderBlend: 0.044,
   elbowBlend: 0.037,
   hipBlend: 0.078,
   kneeBlend: 0.059,
   ankleBlend: 0.037,
   crotchBlend: 0.065,
   spineBlend: 0.039,
   neckBlend: 0.032,
};

const character = (id: ExpansionCharacterId, slug: string, landmarks: HumanoidLandmarks, fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/${slug}/${id}.glb`,
   scale: EXPANSION_CHARACTER_HEIGHT[id] / EXPANSION_CHARACTER_GLB_HEIGHT[id],
   humanoid: { landmarks },
   fallback: "capsule",
   fallbackColor,
   budget: { ...CHARACTER_BUDGET },
});

export const EXPANSION_CHARACTERS: Record<ExpansionCharacterId, ModelAsset> = {
   knight: character("knight", "shared", KNIGHT_LANDMARKS, "#2563eb"),
   snowKid: character("snowKid", "snowball-battle", SNOW_KID_LANDMARKS, "#e5e7eb"),
   astronaut: character("astronaut", "space-repair", ASTRONAUT_LANDMARKS, "#f8fafc"),
   alien: character("alien", "alien-farm", ALIEN_LANDMARKS, "#4ade80"),
   keeper: character("keeper", "zoo-escape", ZOO_KEEPER_LANDMARKS, "#d6c29a"),
};
