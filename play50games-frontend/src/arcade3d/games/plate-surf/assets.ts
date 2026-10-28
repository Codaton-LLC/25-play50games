// Plate Surf's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts). This
// game's props live in public/models/3d/plate-surf: its own set from ready/menu2/plate-surf (the orb,
// the buoy, the sea rock, the sea cliff, the surf plate from the image batch, the diving gull), plus
// King Breaker and the jelly (m2GiantCrabBoss, m2SlimeBlob from ready/menu2/shared) and the lip gates
// (m2NeutralRing from ready/menu2/ring-jump-challenge). The checkpoint beacon is menu2's shared one.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), measured on the meshopt-decoded meshes. */
export const GLB_SIZE = {
   // the colour orb: a disc facing +z
   orb: { x: 1.9015, y: 1.9055, z: 0.4392 },
   // the surf plate: long along z, its upturned nose at +z; the deck's top is 0.353 over its keel mid-board
   plate: { x: 0.6534, y: 0.5567, z: 1.8992, deck: 0.353 },
   buoy: { x: 1.4565, y: 1.8454, z: 1.89 },
   rock: { x: 1.9104, y: 0.9254, z: 1.7609 },
   cliff: { x: 1.8975, y: 1.2833, z: 1.7506 },
   ring: { x: 1.8979, y: 0.5159, z: 1.8998 },
   jelly: { x: 1.9013, y: 1.6739, z: 1.2935 },
   // King Breaker, front towards +z
   crab: { x: 1.8988, y: 1.6109, z: 1.4055 },
   // the gull, wings spread along x, beak towards +z
   gull: { x: 1.8951, y: 1.3931, z: 1.4035 },
   beacon: { x: 1.168, y: 1.902, z: 0.989 },
} as const;

/** The plate's drawn length (m) and its scale; the deck stands PLATE_DECK over the water. */
export const PLATE_LENGTH = 1.7;
export const PLATE_SCALE = PLATE_LENGTH / GLB_SIZE.plate.z;
export const PLATE_DECK = GLB_SIZE.plate.deck * PLATE_SCALE;

/** A colour orb is drawn 0.7 m across, its centre on the rules' pickup point. */
export const ORB_SIZE = 0.7;
/** The buoy stands 1.5 m tall; a sea rock is drawn at its rules radius (x 2.1 per radius); a lip gate at its rules radius. */
export const BUOY_HEIGHT = 1.5;
/** King Breaker is drawn this wide (m). */
export const CRAB_WIDTH = 5.2;
export const CRAB_SCALE = CRAB_WIDTH / GLB_SIZE.crab.x;
/** A jelly is drawn 1.2 m across; a gull 2.2 m wingspan. */
export const JELLY_WIDTH = 1.2;
export const GULL_SPAN = 2.2;

const prop = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/plate-surf/${id}.glb`,
   fallback: "sphere",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("nami"),
   orb: prop("m2AquaOrb", "#38bdf8"),
   plate: { ...prop("m2SurfPlateI", "#f8fafc"), fallback: "box" },
   buoy: prop("m2MarkerBuoy", "#f97316"),
   rock: { ...prop("m2SeaRock", "#64748b"), fallback: "box" },
   cliff: { ...prop("m2SeaCliffBg", "#a8a29e"), fallback: "box" },
   ring: prop("m2NeutralRing", "#e2e8f0"),
   jelly: prop("m2SlimeBlob", "#7dd3fc"),
   // King Breaker and the gull are character-sized GLBs (5-7k tris, 0.5 MB): the character budget
   crab: { ...prop("m2GiantCrabBoss", "#ef4444", CHARACTER_BUDGET) },
   gull: { ...prop("m2SeaGullDiver", "#f1f5f9", CHARACTER_BUDGET) },
   beacon: { id: "checkpointBeacon", url: "/models/3d/menu2/checkpointBeacon.glb", fallback: "cylinder", fallbackColor: "#fbbf24", budget: PROP_BUDGET },
};
