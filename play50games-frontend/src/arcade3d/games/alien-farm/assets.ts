// Alien Farm models: every fit is derived from the GLB's measured bounds (core EXPANSION_GLB_SIZE /
// SHARED_GLB_SIZE / EXPANSION_CHARACTER_GLB_HEIGHT, or measured here for the ufo) and checked on the
// real mesh in assets.test.ts. Unlisted or broken GLBs draw the Primitives.tsx stand-ins.
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTER_GLB_HEIGHT,
   EXPANSION_CHARACTERS,
   EXPANSION_GLB_SIZE,
   SHARED_ASSETS,
   SHARED_GLB_SIZE,
} from "@/arcade3d/core/sharedAssets";

/** The farmer: 1.3 m (README: taller than the core default 1.1 m so it reads on a phone). */
export const ALIEN_HEIGHT = 1.3;
export const ALIEN_SCALE = ALIEN_HEIGHT / EXPANSION_CHARACTER_GLB_HEIGHT.alien;

/**
 * Crops at maturity: 1.0 m tall, scaled uniformly (the GLB's own proportions, no squash), so the
 * glowPod is 0.67 m and the gourd 0.95 m across; Crops.tsx grows them 0.5 -> 1.0 in height while
 * the width stays at least 0.75 of it.
 */
export const CROP_HEIGHT = 1.0;
export const GLOW_POD_SCALE = CROP_HEIGHT / EXPANSION_GLB_SIZE.glowPod.height;
export const GOURD_SCALE = CROP_HEIGHT / EXPANSION_GLB_SIZE.gourd.height;

/** Decor: six purple rocks 1.2 m on their longest side, three 0.8 m crates. */
export const ROCK_WIDTH = 1.2;
export const ROCK_SCALE = ROCK_WIDTH / EXPANSION_GLB_SIZE.rock.width;
export const CRATE_WIDTH = 0.8;
export const CRATE_SCALE = CRATE_WIDTH / SHARED_GLB_SIZE.crate.width;

/** The ufo GLB (Hyper3D, 2026-10-24) as measured: 1.890 x 1.049 x 1.898, floor pivot, rim at y 0.47. */
export const UFO_GLB_SIZE = { width: 1.89, height: 1.049, depth: 1.898 } as const;
/** The saucer: 2.8 m across (README radius 1.4); its underside hovers at SHIP.hoverY. */
export const UFO_DIAMETER = 2.8;
export const UFO_SCALE = UFO_DIAMETER / Math.max(UFO_GLB_SIZE.width, UFO_GLB_SIZE.depth);

export const ASSETS = {
   alien: { ...EXPANSION_CHARACTERS.alien, scale: ALIEN_SCALE },
   glowPod: { ...EXPANSION_ASSETS.glowPod, scale: GLOW_POD_SCALE, material: { color: "#bbf7d0", roughness: 0.7, emissive: "#052e16" } },
   gourd: { ...EXPANSION_ASSETS.gourd, scale: GOURD_SCALE, material: { color: "#a5f3fc", roughness: 0.7, emissive: "#083344" } },
   rock: { ...EXPANSION_ASSETS.rock, scale: ROCK_SCALE, material: { color: "#7c3aed", roughness: 0.9 } },
   crate: { ...SHARED_ASSETS.crate, scale: CRATE_SCALE },
   ufo: {
      id: "ufo",
      url: "/models/3d/alien-farm/ufo.glb",
      scale: UFO_SCALE,
      fallback: "sphere",
      fallbackColor: "#94a3b8",
      budget: { tris: 3000, bytes: 300 * 1024 },
   },
} satisfies Record<string, ModelAsset>;
