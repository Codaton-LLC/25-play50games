// Cat vs Robot Vacuum models: the ready Hyper3D GLBs (menu1-cat-vs-robot-vacuum, the regenerated
// catTreatFish / catToyPlush and catTreeR, not the flagged originals) and the shared furniture set
// (sofa, bed, table, bookshelfFull, woodenChair). Fitted from their measured bounds (GLB_SIZE);
// assets.test.ts checks every fit on the real mesh. Solid pieces fit their rules.ts boxes; decor is
// fitted to 1 m, so a decor spot's scale is its size in metres (never scaled twice).
import type { ModelAsset } from "@/arcade3d/core/types";
import type { QuadrupedLandmarks } from "@/arcade3d/core/rig/quadruped";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { CLUTTER_HALF, FURN_SIZE, VAC_R } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   cat: { width: 0.528, height: 1.3564, depth: 1.9 },
   robotVacuum: { width: 1.9036, height: 0.4794, depth: 1.8385 },
   catTreatFish: { width: 0.7727, height: 0.9249, depth: 1.9 },
   catToyPlush: { width: 1.2353, height: 1.0829, depth: 1.8945 },
   catBox: { width: 1.8927, height: 1.2693, depth: 1.9023 },
   catTreeR: { width: 1.2806, height: 1.8921, depth: 1.0941 },
   bed: { width: 1.5701, height: 0.7446, depth: 1.8954 },
   table: { width: 1.896, height: 0.8729, depth: 0.9264 },
   bookshelfFull: { width: 1.6086, height: 1.8941, depth: 0.4207 },
   woodenChair: { width: 0.9054, height: 1.8967, depth: 1.0048 },
   sofa: { width: 1.8916, height: 0.9388, depth: 0.9125 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   /** nose to tail */
   catLength: 0.7,
   treatLength: 0.32,
   toyLength: 0.36,
} as const;

/**
 * The cat's joints for the core quadruped rig, measured on cat.glb (GLB units, faces +z, L = +x):
 * front legs from the shoulder through the wrist (bends forward, the paw folds back in the swing),
 * hind legs from the hip through the hock (bends back). Rodin gave the cat two tails: the raised
 * one is the tail, the one lying on the floor behind it is folded away (`stray`). Checked on the
 * real mesh in assets.test.ts.
 */
export const CAT_LANDMARKS: QuadrupedLandmarks = {
   front: { top: [0.13, 0.62, 0.45], knee: [0.135, 0.33, 0.47], ankle: [0.14, 0.09, 0.48], toeZ: 0.67, radius: 0.065, bend: 1 },
   hind: { top: [0.12, 0.52, -0.17], knee: [0.125, 0.24, -0.215], ankle: [0.135, 0.075, -0.13], toeZ: -0.01, radius: 0.07, bend: -1 },
   bellyY: 0.36,
   thighBlend: 0.18,
   neck: [0.45, 0.78],
   head: [0.6, 0.95],
   mouth: [0, 0.97, 0.9],
   tail: [
      [0.015, 0.6, -0.46],
      [0.005, 0.82, -0.5],
      [-0.01, 1.02, -0.54],
      [-0.03, 1.25, -0.525],
   ],
   tailRadius: 0.08,
   stray: [
      {
         line: [
            [0.045, 0.37, -0.35],
            [0.05, 0.27, -0.48],
            [0.07, 0.17, -0.62],
            [0.08, 0.12, -0.75],
            [0.098, 0.09, -0.96],
         ],
         radius: 0.1,
      },
   ],
};

const budget = { ...PROP_BUDGET };
const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/cat-vs-robot-vacuum/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
   ...fit,
});
const shared = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   ...local(id, fit, fallback, fallbackColor),
   url: `/models/3d/shared/${id}.glb`,
});

/**
 * A piece whose GLB is long in its own x, stood along the hall (the spot turns it a quarter): its
 * GLB x becomes the box's z, its GLB z the box's x.
 */
function turned(id: "sofa" | "table" | "bookshelfFull", box: { x: number; y: number; z: number }): Partial<ModelAsset> {
   const g = GLB_SIZE[id];
   const scale = box.z / g.width;
   return { scale, stretch: [1, box.y / (g.height * scale), box.x / (g.depth * scale)] };
}
const bedScale = FURN_SIZE.bed.z / GLB_SIZE.bed.depth;

export const ASSETS = {
   // a creature: one unskinned mesh with hop / waddle (core/motion), tinted per level
   cat: local("cat", { scale: FIT.catLength / GLB_SIZE.cat.depth, budget: { tris: 20000, bytes: 400_000 }, quadruped: { landmarks: CAT_LANDMARKS } }, "capsule", "#fb923c"),
   // the hazard: drawn in dark graphite (the GLB's silver read as part of the light floor), with a
   // red glow ring and a red floor aura in the Scene while it can hurt
   vacuum: local("robotVacuum", { scale: (2 * VAC_R) / GLB_SIZE.robotVacuum.width, material: { color: "#30353f", roughness: 0.4, metalness: 0.35 } }, "cylinder", "#30353f"),
   treat: local("catTreatFish", { scale: FIT.treatLength / GLB_SIZE.catTreatFish.depth }, "sphere", "#f97316"),
   // the bonus toy: a pink plush mouse (the GLB's grey mouse vanished on the floors)
   toy: local("catToyPlush", { scale: FIT.toyLength / GLB_SIZE.catToyPlush.depth, material: { color: "#f472b6", roughness: 0.75, emissive: "#3b0a24" } }, "sphere", "#f472b6"),
   clutter: local("catBox", { scale: (2 * CLUTTER_HALF) / GLB_SIZE.catBox.depth }, "box", "#a16207"),
   sofa: shared("sofa", turned("sofa", FURN_SIZE.sofa), "box", "#78716c"),
   bed: shared("bed", { scale: bedScale, stretch: [FURN_SIZE.bed.x / (GLB_SIZE.bed.width * bedScale), FURN_SIZE.bed.y / (GLB_SIZE.bed.height * bedScale), 1] }, "box", "#a8a29e"),
   table: shared("table", turned("table", FURN_SIZE.table), "box", "#92400e"),
   bookshelf: shared("bookshelfFull", turned("bookshelfFull", FURN_SIZE.bookshelf), "box", "#57534e"),
   // decor, 1 m tall
   catTree: local("catTreeR", { scale: 1 / GLB_SIZE.catTreeR.height }, "cylinder", "#a16207"),
   chair: shared("woodenChair", { scale: 1 / GLB_SIZE.woodenChair.height }, "box", "#92400e"),
} satisfies Record<string, ModelAsset>;
