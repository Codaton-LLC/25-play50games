import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, SHARED_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/**
 * The shared runner GLB (v2) is 1.886 tall (T-pose and arms down alike): 0.2916 draws it 0.55 m,
 * RUNNER.height (README "Scene and camera"; runner.test.ts measures it on the real mesh). Its stride and
 * body lift (runnerGait.ts, Scene.tsx) use the same scale. The stand-in (Primitives.tsx) is authored 0.55 m tall.
 */
export const RUNNER_SCALE = 0.2916;

/**
 * The shared coin GLB (group D) is 1.899 x 1.861 x 0.492 (COIN_GLB_SIZE), standing on its edge on
 * y = 0, its faces along ±z, about 0.33 deep at the rim. COIN_SCALE (about 0.316) draws it 0.60
 * across, the stand-in disc's diameter (2 x COIN.radius), 0.59 tall; yOffset centres it on the
 * coin's point, so writeCoin's spin and bob place it like the disc and its 0.294 half-height stays
 * inside COIN.radius (writeCoin's "whole inside the column" margin); stretch z 0.7 thins the rim to
 * 0.074, the disc's 0.08.
 */
export const COIN_SCALE = 0.6 / COIN_GLB_SIZE.width;

const primitive = (id: string, color: string): ModelAsset => ({
   id, url: `/models/3d/tower-climb/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET,
});

/**
 * towerLedge.glb raw bounds, measured on the mesh (assets.test.ts): a ledge chunk, feet on y = 0,
 * centred on x/z. The checkpoint pool draws it at the slab slot's matrix (writeSlab: the slab's
 * top). It takes the stand-in's 4.4 x 0.6 footprint and 0.16 body thickness, sunk yOffset so its
 * top lands exactly on the slab top (slot.y): the same stand-on surface the rules measure.
 */
export const LEDGE_GLB = { width: 1.88069, height: 0.82993, depth: 1.89599 } as const;
export const LEDGE_SCALE = 0.16 / LEDGE_GLB.height;
export const LEDGE_STRETCH = [
   4.4 / (LEDGE_GLB.width * LEDGE_SCALE), 1, 0.6 / (LEDGE_GLB.depth * LEDGE_SCALE),
] as const;
export const LEDGE_Y_OFFSET = -0.16;

/**
 * springPad.glb raw bounds, measured on the mesh (assets.test.ts): a flat disc on a stem, feet on
 * y = 0. writeSpring places the matrix at the parent slab's top and squashes y on launch, so the
 * pad is fitted to the stand-in's footprint and top: 0.51 across (the disc's 0.6 x 0.85, the rules'
 * SPRING trigger half-width 0.26 + the runner) and 0.24 tall, the primitive arrow tips' top that
 * stays under the 0.29 m clearance to the next slab. Feet at y = 0 keep it planted while it squishes.
 */
export const SPRING_GLB = { width: 1.8904, height: 0.77344, depth: 1.90084 } as const;
// Review: the pad is drawn 0.12 tall (not 0.24) so the stand-in's double up-chevron, kept on its own
// pool over the GLB (Scene.tsx SpringPads), still reads "up" above it; both stay under the 0.29 m clearance.
export const SPRING_DRAWN = { diameter: 0.51, height: 0.12 } as const;
export const SPRING_SCALE = SPRING_DRAWN.height / SPRING_GLB.height;
export const SPRING_STRETCH = [
   SPRING_DRAWN.diameter / (SPRING_GLB.width * SPRING_SCALE), 1,
   SPRING_DRAWN.diameter / (SPRING_GLB.depth * SPRING_SCALE),
] as const;

/**
 * rocketBooster.glb raw bounds, measured on the mesh (assets.test.ts): an egg-shaped pod with fins,
 * feet on y = 0. The world pickup spins at writeRocket's 1.8 matrix scale, so the asset is fitted to
 * the primitive's matrix-local size: 0.28 tall (x1.8 = 0.50 m on screen, the README's "about
 * 0.5 m"), its footprint the body's 0.14 x 0.17 including the fin's reach. The feet stay on y = 0,
 * so ROCKET.lift keeps floating the origin the same 0.7 m above the slab.
 */
export const ROCKET_GLB = { width: 1.3042, height: 1.89886, depth: 1.54154 } as const;
export const ROCKET_DRAWN = { width: 0.14, depth: 0.17, height: 0.28 } as const;
export const ROCKET_SCALE = ROCKET_DRAWN.height / ROCKET_GLB.height;
export const ROCKET_STRETCH = [
   ROCKET_DRAWN.width / (ROCKET_GLB.width * ROCKET_SCALE), 1,
   ROCKET_DRAWN.depth / (ROCKET_GLB.depth * ROCKET_SCALE),
] as const;

export const ASSETS: Record<string, ModelAsset> = {
   runner: { ...SHARED_ASSETS.runner, scale: RUNNER_SCALE },
   slab: primitive("slab", "#38c9df"),
   movingSlab: primitive("moving-slab", "#a58bec"),
   // The GLB urls for slab / movingSlab / spur are absent from the model manifest, so nothing is
   // fetched: those platforms keep their box stand-ins until their own GLBs land.
   ledge: {
      id: "ledge", url: "/models/3d/tower-climb/towerLedge.glb",
      scale: LEDGE_SCALE, stretch: LEDGE_STRETCH, yOffset: LEDGE_Y_OFFSET,
      // Review: the mossy stone texture stretched 12x along the ledge read as dark debris at night
      // (L4/L5); the tower's checkpoint teal with a faint glow keeps "safe ledge" readable.
      material: { color: "#3fbfbc", roughness: 0.85, emissive: "#0c3534" },
      fallback: "box", fallbackColor: "#32aeac", budget: PROP_BUDGET,
   },
   spur: primitive("spur", "#ffa862"),
   coin: { ...SHARED_ASSETS.coin, scale: COIN_SCALE, stretch: [1, 1, 0.7], yOffset: (-COIN_SCALE * COIN_GLB_SIZE.height) / 2 },
   flag: {
      id: "checkpoint-flag", url: "/models/3d/tower-climb/checkpoint-flag.glb",
      scale: 0.8 / 1.9, fallback: "box", fallbackColor: "#ffd35d", budget: PROP_BUDGET,
   },
   spring: {
      id: "spring", url: "/models/3d/tower-climb/springPad.glb",
      scale: SPRING_SCALE, stretch: SPRING_STRETCH,
      fallback: "box", fallbackColor: "#c6f54a", budget: PROP_BUDGET,
   },
   rocket: {
      id: "rocket", url: "/models/3d/tower-climb/rocketBooster.glb",
      scale: ROCKET_SCALE, stretch: ROCKET_STRETCH,
      fallback: "box", fallbackColor: "#e8eef2", budget: PROP_BUDGET,
   },
};
