// Models used by Obstacle Race. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx renders them.
// The shared runner GLB (v2, 2026-10-07) is a 1.886-tall static T-pose animated by the core
// auto-rig in Scene.tsx; the stand-in (Primitives.tsx RunnerPrimitive) is its fallback. Collision
// never comes from a model: the course is primitives sized from rules.ts.
// The finish arch (group D, 2026-10-07) is the single-arch v2 finishArch.glb, fitted to the rules'
// ARCH: its legs stand on the two solid post circles (r 0.4 at x +-3.6) and its top reaches
// ARCH.height. FinishArchPrimitive (sized from ARCH) stays its fallback. finishArch.test.ts measures
// the real GLB; README "Assets" has the numbers.
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ARCH } from "./rules";

/**
 * The v2 finishArch.glb as optimized, in GLB units (y up, standing on y = 0, the banner's front
 * towards +z): one arch spanning x, 1.894 x 0.871 x 0.250, its two round legs (0.25 thick) centred
 * at x +-0.822, its top at y 0.871, the checkered banner's lower edge at y 0.447 (0.40 where it
 * meets the legs).
 */
export const ARCH_GLB = { legX: 0.822, top: 0.871 } as const;
/** The legs' centres on the posts (x +-3.6): 4.38. x and z alike, so the legs stay round. */
const ARCH_SCALE = ARCH.postX / ARCH_GLB.legX;

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/runner.glb).
   // The runner GLB faces +z by convention and this game runs towards -z, so it is turned round;
   // 0.795 draws it 1.50 m, the rules' RUNNER.height (the stand-in is scaled to it too).
   runner: { ...SHARED_ASSETS.runner, scale: 0.795, rotationY: Math.PI },
   // this game's (./assets.spec.json). Scale 4.38 puts the legs on the posts: 1.09 m thick round
   // sleeves, 0.15 m round each 0.8 m post, so a runner stopped by a post touches the leg it sees;
   // stretch y 1.10 lifts the top to ARCH.height (4.2) and the banner's lower edge to 2.15 m (1.93
   // by the legs) over the 1.5 m runner. No turn: the banner's front faces +z, the way the runner
   // comes and the follow camera (yaw 0) looks. 8.30 x 4.20 x 1.10 m on the 8 m finish pad.
   finishArch: {
      id: "finishArch",
      url: "/models/3d/obstacle-race/finishArch.glb",
      scale: ARCH_SCALE,
      stretch: [1, ARCH.height / (ARCH_GLB.top * ARCH_SCALE), 1],
      fallback: "box",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
