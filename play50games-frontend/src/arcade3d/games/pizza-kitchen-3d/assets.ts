// Pizza Kitchen 3D models: the ready Hyper3D GLBs (menu1-pizza-kitchen-3d, the R / Clean / Closed
// versions), fitted from their measured bounds (assets.test.ts checks every fit on the real mesh).
// The chef is the shared food-catcher chef through the core auto-rig (CHEF_LANDMARKS, 1.82 m).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   pizzaBase: { width: 1.8938, height: 0.2804, depth: 1.887 },
   sauceBowl: { width: 1.2439, height: 0.9364, depth: 1.9006 },
   cheeseBowl: { width: 1.8943, height: 0.7342, depth: 1.8865 },
   mushroomBowlR: { width: 1.899, height: 0.8728, depth: 1.8899 },
   oliveBowl: { width: 1.8934, height: 1.0343, depth: 1.9036 },
   pepperoni: { width: 1.7862, height: 0.3087, depth: 1.9007 },
   tomato: { width: 1.8987, height: 1.1992, depth: 1.0057 },
   onion: { width: 1.8946, height: 1.2886, depth: 1.0336 },
   pizzaOven: { width: 1.8882, height: 1.568, depth: 1.4866 },
   pizzaPeelCleanT: { width: 1.894, height: 0.073, depth: 1.119 },
   prepCounterR: { width: 1.5933, height: 1.8967, depth: 1.1 },
   pizzaBoxClosed: { width: 1.859, height: 0.5537, depth: 1.9015 },
} as const;

/** The counter's worktop in GLB units (the top slab's upper face, 1.11-1.12 at full depth; only a thin shelf frame rises above it). */
export const COUNTER_TOP_GLB = 1.125;

/** Drawn sizes in metres. */
export const FIT = {
   counterTop: 0.95,
   /** one counter per station, 1.6 m apart: stretched along x to meet its neighbours */
   counterWidth: 1.6,
   ovenWidth: 1.5,
   bowl: 0.5,
   base: 0.6,
   pepperoni: 0.12,
   slice: 0.1,
   peel: 0.95,
   box: 0.62,
   bin: 0.8,
   crate: 0.7,
   /** a topping pile in its station's steel bowl */
   pile: 0.28,
} as const;

const COUNTER_SCALE = FIT.counterTop / COUNTER_TOP_GLB;
const longest = (s: { width: number; height: number; depth: number }) => Math.max(s.width, s.depth);

const local = (id: keyof typeof GLB_SIZE, size: number, fallback: ModelAsset["fallback"], fallbackColor: string, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id,
   url: `/models/3d/pizza-kitchen-3d/${id}.glb`,
   scale: size / longest(GLB_SIZE[id]),
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...extra,
});

export const ASSETS = {
   chef: { ...REUSED_ASSETS.chef, scale: 0.975 },
   bin: { ...REUSED_ASSETS.bin, scale: FIT.bin / REUSED_GLB_SIZE.bin.height },
   crate: { ...SHARED_ASSETS.crate, scale: FIT.crate / SHARED_GLB_SIZE.crate.width },
   // flour crate at the hatch end of the row: 0.7 m across, a stack of boxes on it
   pizzaBase: local("pizzaBase", FIT.base, "cylinder", "#e7b76f"),
   sauceBowl: local("sauceBowl", FIT.bowl, "cylinder", "#dc2626"),
   cheeseBowl: local("cheeseBowl", FIT.bowl, "cylinder", "#facc15"),
   mushroom: local("mushroomBowlR", FIT.bowl, "cylinder", "#d6c3a6"),
   olive: local("oliveBowl", FIT.bowl, "cylinder", "#3f6212"),
   pepperoni: local("pepperoni", FIT.pepperoni, "cylinder", "#b91c1c"),
   tomato: local("tomato", FIT.slice, "sphere", "#f43f5e"),
   onion: local("onion", FIT.slice, "sphere", "#c084fc"),
   oven: local("pizzaOven", FIT.ovenWidth, "box", "#292524"),
   counter: {
      ...local("prepCounterR", FIT.counterWidth, "box", "#a16207"),
      scale: COUNTER_SCALE,
      stretch: [FIT.counterWidth / (GLB_SIZE.prepCounterR.width * COUNTER_SCALE), 1, 1] as const,
   },
   // the same topping GLBs at pile size in the pepperoni / tomato / onion stations' steel bowls
   pepperoniPile: { ...local("pepperoni", FIT.pile, "cylinder", "#b91c1c"), id: "pepperoniPile" },
   tomatoPile: { ...local("tomato", FIT.pile, "sphere", "#f43f5e"), id: "tomatoPile" },
   onionPile: { ...local("onion", FIT.pile, "sphere", "#c084fc"), id: "onionPile" },
   peel: local("pizzaPeelCleanT", FIT.peel, "box", "#a16207"),
   box: local("pizzaBoxClosed", FIT.box, "box", "#f5f5f4"),
} satisfies Record<string, ModelAsset>;
