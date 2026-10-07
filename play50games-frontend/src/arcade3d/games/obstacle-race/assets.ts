// Models used by Obstacle Race. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes) and Scene.tsx renders them.
// The shared runner GLB (v2, 2026-10-07) is a 1.886-tall static T-pose animated by the core
// auto-rig in Scene.tsx; the stand-in (Primitives.tsx RunnerPrimitive) is its fallback. Collision
// never comes from a model: the course is primitives sized from rules.ts.
// The finish arch is not a model here. The group A finishArch.glb (main 1acca9c) is a deep double
// arch, 1.85 x 1.36 x 1.90, with its legs at |x| 0.44-0.78 (centre 0.61): the clear opening is about
// half its width, against the rules' 80 % (posts r 0.4 at x +-3.6, 6.4 m clear of 8 m, ARCH in
// rules.ts). No scale / stretch fits it: legs centred on the posts are 2 m thick (the runner sinks
// 0.6 m into them before the post stops it) with the feet about 1.5 m out over the pool; the 8 m outline
// puts the legs at |x| 1.9-3.4, where the runner runs through them. So Scene.tsx draws
// FinishArchPrimitive (sized from ARCH) and never requests the GLB. README "Assets": the spec
// change for a regenerated arch, which comes back as a `finishArch` entry here plus <Model>.
import type { ModelAsset } from "@/arcade3d/core/types";
import { SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const ASSETS = {
   // shared cast (src/arcade3d/assets/shared.spec.json -> public/models/3d/shared/runner.glb).
   // The runner GLB faces +z by convention and this game runs towards -z, so it is turned round;
   // 0.795 draws it 1.50 m, the rules' RUNNER.height (the stand-in is scaled to it too).
   runner: { ...SHARED_ASSETS.runner, scale: 0.795, rotationY: Math.PI },
} satisfies Record<string, ModelAsset>;
