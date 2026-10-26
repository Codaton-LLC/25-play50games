// Dog Park Fetch models: the ready menu1-dog-park-fetch GLBs plus shared civilianNpc (the owner),
// fitted from their measured bounds (assets.test.ts checks every fit on the real mesh). Gameplay
// pieces are fitted to their size in metres; decor is fitted to 1 m so a decor spot's `scale` is its
// size (never scaled twice). Left out on purpose: dogHouse*, dogBone* (the spec's skip list),
// dogOwnerNpc (a dog is baked in at its feet), agilityHurdle (dog on the bar), and the shared
// picketFence (80+ copies x 1.5k tris round the lawn: the code fence draws it in 2 calls).
import type { ModelAsset } from "@/arcade3d/core/types";
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
   dog: local("dog", { scale: FIT.dogLength / GLB_SIZE.dog.depth }, "capsule", "#d6a15b", CHARACTER_BUDGET),
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
