// The cat on the core quadruped rig, checked on the real mesh: its committed landmarks, every part's
// bones, the bind pose, the folded stray part, planted paws at a walk, a trot and a gallop, and
// idle / sit / leap (core/rig/quadrupedChecks.ts).
import { describe } from "vitest";
import { describeQuadruped } from "@/arcade3d/core/rig/quadrupedChecks";
import { ASSETS, CAT_LANDMARKS, GLB_SIZE } from "./assets";

describe("cat-vs-robot-vacuum cat (quadruped rig, real mesh)", () => {
   describeQuadruped("cat", { asset: ASSETS.cat, landmarks: CAT_LANDMARKS, size: GLB_SIZE.cat, minPawVertices: 100 });
});
