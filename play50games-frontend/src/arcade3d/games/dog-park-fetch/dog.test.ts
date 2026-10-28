// The dog on the core quadruped rig, checked on the real mesh: its committed landmarks, every part's
// bones, the bind pose, the folded stray part, planted paws at a walk, a trot and a gallop, and
// idle / sit / leap (core/rig/quadrupedChecks.ts).
import { describe } from "vitest";
import { describeQuadruped } from "@/arcade3d/core/rig/quadrupedChecks";
import { ASSETS, DOG_LANDMARKS, GLB_SIZE } from "./assets";

describe("dog-park-fetch dog (quadruped rig, real mesh)", () => {
   describeQuadruped("dog", { asset: ASSETS.dog, landmarks: DOG_LANDMARKS, size: GLB_SIZE.dog, minPawVertices: 100 });
});
