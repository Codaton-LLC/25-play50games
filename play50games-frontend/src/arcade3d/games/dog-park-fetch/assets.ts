// Dog Park Fetch models: the ready menu1-dog-park-fetch GLBs plus shared civilianNpc (the owner),
// fitted from their measured bounds (assets.test.ts checks every fit on the real mesh). Gameplay
// pieces are fitted to their size in metres; decor is fitted to 1 m so a decor spot's `scale` is its
// size (never scaled twice). Left out on purpose: dogHouse*, dogBone* (the spec's skip list),
// dogOwnerNpc (a dog is baked in at its feet), agilityHurdle (dog on the bar), and the shared
// picketFence (80+ copies x 1.5k tris round the lawn: the code fence draws it in 2 calls).
import type { ModelAsset } from "@/arcade3d/core/types";
import type { QuadrupedLandmarks } from "@/arcade3d/core/rig/quadruped";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (Rodin units, pivot on the floor centre) and triangles, measured 2026-10-26. */
export const GLB_SIZE = {
   dog: { width: 1.0087, height: 1.5248, depth: 1.8976, tris: 18000 },
   tennisBall: { width: 1.8966, height: 1.8944, depth: 1.8919, tris: 1500 },
   frisbee: { width: 1.8408, height: 0.4416, depth: 1.891, tris: 1500 },
   fetchStick: { width: 1.8965, height: 0.2891, depth: 0.2951, tris: 1500 },
   parkFountain: { width: 1.899, height: 1.2848, depth: 1.898, tris: 3000 },
   agilityTunnel: { width: 1.2752, height: 1.0974, depth: 1.8893, tris: 3000 },
   agilityHurdleR: { width: 1.897, height: 0.9694, depth: 1.1733, tris: 1500 },
   lawnMower: { width: 1.5209, height: 1.4492, depth: 1.8953, tris: 1500 },
   parkBush: { width: 1.8705, height: 0.6774, depth: 1.8817, tris: 1500 },
   festivalTent: { width: 1.6243, height: 1.9073, depth: 1.5879, tris: 3000 },
   civilianNpc: { width: 0.766, height: 1.902, depth: 0.3757, tris: 18000 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   /** nose to tail: a medium dog, a little over twice its 0.32 m radius */
   dogLength: 0.9,
   ownerHeight: 1.75,
   ball: 0.14,
   stick: 0.6,
   frisbee: 0.28,
   /** the fountain's solid circle is 1.2 m: its bowl is drawn 2.4 m across */
   fountain: 2.4,
   /** the mower's hit circle is 0.6 m: drawn 1.3 m long */
   mowerLength: 1.3,
   /** a bench seat for the 0.5 m solid circle: 1.2 m long */
   bench: 1.2,
} as const;

/**
 * The dog's joints for the core quadruped rig, measured on dog.glb (GLB units, faces +z, L = +x):
 * front legs from the shoulder through the wrist (bends forward), hind legs from the hip through
 * the hock (bends back). Rodin gave the dog a raised tail and a second, low curled one: the raised
 * one wags, the low one is folded away (`stray`). Checked on the real mesh in assets.test.ts.
 */
export const DOG_LANDMARKS: QuadrupedLandmarks = {
   front: { top: [0.17, 0.62, 0.28], knee: [0.205, 0.35, 0.31], ankle: [0.24, 0.12, 0.33], toeZ: 0.58, radius: 0.085, bend: 1 },
   hind: { top: [0.15, 0.6, -0.25], knee: [0.18, 0.28, -0.33], ankle: [0.24, 0.09, -0.25], toeZ: -0.05, radius: 0.09, bend: -1 },
   bellyY: 0.43,
   thighBlend: 0.2,
   neck: [0.22, 0.78],
   head: [0.36, 0.96],
   mouth: [0, 0.98, 0.84],
   tail: [
      [0, 0.8, -0.45],
      [0, 0.93, -0.54],
      [0, 1.07, -0.615],
      [0, 1.21, -0.665],
   ],
   tailRadius: 0.09,
   stray: [
      {
         line: [
            [0, 0.6, -0.47],
            [0, 0.56, -0.62],
            [-0.04, 0.6, -0.78],
            [-0.09, 0.7, -0.88],
            [-0.09, 0.9, -0.86],
         ],
         radius: 0.11,
      },
   ],
};

const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/dog-park-fetch/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
   ...fit,
});
const centred = (id: keyof typeof GLB_SIZE, size: number, axis: "width" | "height" | "depth") => {
   const scale = size / GLB_SIZE[id][axis];
   return { scale, yOffset: (-GLB_SIZE[id].height * scale) / 2 };
};

export const ASSETS = {
   // the dog faces +z (its head is the tall end at +z), feet on the floor
   dog: local("dog", { scale: FIT.dogLength / GLB_SIZE.dog.depth, quadruped: { landmarks: DOG_LANDMARKS } }, "capsule", "#d6a15b", CHARACTER_BUDGET),
   owner: {
      id: "civilianNpc",
      url: "/models/3d/shared/civilianNpc.glb",
      scale: FIT.ownerHeight / GLB_SIZE.civilianNpc.height,
      fallback: "capsule",
      fallbackColor: "#e7e5e4",
      budget: CHARACTER_BUDGET,
   } satisfies ModelAsset,
   // toys are centred on their point (like the stand-ins), the Scene lifts them by their half size
   ball: local("tennisBall", centred("tennisBall", FIT.ball, "height"), "sphere", "#d9f99d"),
   stick: local("fetchStick", centred("fetchStick", FIT.stick, "width"), "cylinder", "#a16207"),
   // drawn in a group turned over about x (the GLB lies concave side up)
   frisbee: local("frisbee", centred("frisbee", FIT.frisbee, "depth"), "cylinder", "#f97316"),
   mower: local("lawnMower", { scale: FIT.mowerLength / GLB_SIZE.lawnMower.depth }, "box", "#16a34a"),
   fountain: local("parkFountain", { scale: FIT.fountain / GLB_SIZE.parkFountain.width }, "cylinder", "#cbd5e1"),
   bench: { ...REUSED_ASSETS.bench, scale: FIT.bench / REUSED_GLB_SIZE.bench.width, stretch: undefined } satisfies ModelAsset,
   // decor, fitted to 1 m (bush and tunnel/hurdle by width, tent and tree by height)
   bush: local("parkBush", { scale: 1 / GLB_SIZE.parkBush.width }, "sphere", "#16a34a"),
   tent: local("festivalTent", { scale: 1 / GLB_SIZE.festivalTent.height }, "box", "#f59e0b"),
   tunnel: local("agilityTunnel", { scale: 1 / GLB_SIZE.agilityTunnel.depth }, "cylinder", "#2563eb"),
   hurdle: local("agilityHurdleR", { scale: 1 / GLB_SIZE.agilityHurdleR.width }, "box", "#ef4444"),
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: 1 / EXPANSION_GLB_SIZE.leafyTree.height } satisfies ModelAsset,
} satisfies Record<string, ModelAsset>;
