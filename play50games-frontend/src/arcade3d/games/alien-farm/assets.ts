import {
   EXPANSION_ASSETS,
   EXPANSION_CHARACTER_GLB_HEIGHT,
   EXPANSION_CHARACTERS,
   EXPANSION_GLB_SIZE,
   SHARED_ASSETS,
} from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/types";

function fit(
   raw: { width: number; height: number; depth: number },
   target: { width?: number; height?: number; depth?: number },
): number {
   const factors: number[] = [];
   if (target.width) factors.push(target.width / raw.width);
   if (target.height) factors.push(target.height / raw.height);
   if (target.depth) factors.push(target.depth / raw.depth);
   return Math.min(...factors);
}

export const ALIEN_HEIGHT = 1.3;
export const ALIEN_SCALE = ALIEN_HEIGHT / EXPANSION_CHARACTER_GLB_HEIGHT.alien;

export const GLOW_POD_WIDTH = 1.1;
export const GLOW_POD_HEIGHT = 1.0;
export const GLOW_POD_SCALE = fit(EXPANSION_GLB_SIZE.glowPod, {
   width: GLOW_POD_WIDTH,
   height: GLOW_POD_HEIGHT,
});

export const GOURD_WIDTH = 1.1;
export const GOURD_HEIGHT = 1.0;
export const GOURD_SCALE = fit(EXPANSION_GLB_SIZE.gourd, {
   width: GOURD_WIDTH,
   height: GOURD_HEIGHT,
});

export const ROCK_WIDTH = 1.2;
export const ROCK_RAW_WIDTH = 1.9011;
export const ROCK_SCALE = ROCK_WIDTH / ROCK_RAW_WIDTH;

export const CRATE_WIDTH = 0.8;
export const CRATE_RAW_WIDTH = 1.8797;
export const CRATE_SCALE = CRATE_WIDTH / CRATE_RAW_WIDTH;

export const UFO_DIAMETER = 2.8;
export const UFO_RAW_DIAMETER = 1.8984;
export const UFO_SCALE = UFO_DIAMETER / UFO_RAW_DIAMETER;

export const ASSETS = {
   alien: {
      ...EXPANSION_CHARACTERS.alien,
      scale: ALIEN_SCALE,
   },
   glowPod: {
      ...EXPANSION_ASSETS.glowPod,
      scale: GLOW_POD_SCALE,
      material: { color: "#bbf7d0", roughness: 0.7, emissive: "#052e16" },
   },
   gourd: {
      ...EXPANSION_ASSETS.gourd,
      scale: GOURD_SCALE,
      material: { color: "#a5f3fc", roughness: 0.7, emissive: "#083344" },
   },
   rock: {
      ...EXPANSION_ASSETS.rock,
      scale: ROCK_SCALE,
      material: { color: "#7c3aed", roughness: 0.9 },
   },
   crate: {
      ...SHARED_ASSETS.crate,
      scale: CRATE_SCALE,
   },
   ufo: {
      name: "ufo",
      url: "/models/3d/alien-farm/ufo.glb",
      license: "Hyper3D Rodin Gen-2 (play50games)",
      scale: UFO_SCALE,
      budget: { tris: 3000, bytes: 300 * 1024 },
   },
} as const satisfies Record<string, ModelAsset>;
