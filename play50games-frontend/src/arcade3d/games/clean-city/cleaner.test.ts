// The auto-rig on the real cleaner (public/models/3d/clean-city/cleaner.glb, 2026-10-08): the
// measured CLEANER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor,
// the hands clear of the hips and the bearded head rigid (core/rig/characterChecks.ts); its scale
// keeps it 0.95 tall. A new cleaner.glb must be re-measured. Then the game's own use of it on the
// same mesh: the pickup reach and the cheer keep it above the floor, and through the gait (gait.ts)
// the soles of the planted foot stay put at a walk and at the top-speed run (net over a stance;
// within a walking stance they rock up to 2 cm, at a run under 4 mm).
import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { POSE_MASK, applyHumanoidPose, armsDownPose, blendPoses, bodyLift, cheerPose, createPose, idlePose, reachPose, walkPose } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, CLEANER_LANDMARKS } from "./assets";
import { CLEANER_SCALE, createCleanerGait, stepCleanerGait } from "./gait";

const L = CLEANER_LANDMARKS;

describe("clean-city cleaner.glb", () => {
   describeCharacter("cleaner", {
      asset: ASSETS.cleaner,
      landmarks: L,
      // the arm span (1.898) and the height (1.902) are both about Rodin's 1.9
      height: 1.902,
      reach: 0.949,
      estimate: {
         // set by eye (assets.ts): the head joint on the collar (the beard reaches 1.505), so the face
         // and beard turn as one (estimate 1.526 / 1.565); no cloth bridges the legs (hemY = crotchY:
         // the estimate's 0.634 is the close cargo thighs)
         tolerance: { neckY: 0.08, headY: 0.09, hemY: 0.17 },
      },
      // the head joint 1.49 + its 0.012 blend: the beard, face, glasses and hair above it are rigid
      headFrom: 1.505,
      // the vest is 0.21-0.23 wide beside the wrists (posed y 0.80-0.90), the cargo pockets 0.26 beside
      // the fingertips (y 0.70-0.72, which hang at 0.29): the hands clear the body by 2.7-6.5 cm
      hipHalfWidth: 0.25,
   });

   it("its scale draws it 0.95 tall (the shared runner it replaced: 0.95), the same everywhere the rules measure it", () => {
      expect(CLEANER_SCALE).toBe(ASSETS.cleaner.scale);
      expect(1.9022 * CLEANER_SCALE).toBeCloseTo(0.95, 3);
   });

   it("no cloth bridges the legs (hemY = crotchY: the vest ends at the hips; the cargo thighs are not a skirt)", () => {
      expect(L.hemY).toBe(L.crotchY);
   });
});

describe("clean-city cleaner.glb: the thick sleeves", () => {
   let cleaner: RiggedCharacter;
   beforeAll(async () => {
      cleaner = await rigCharacter(ASSETS.cleaner);
   });

   it("with the arms down (and in the idle) nothing above the chest sticks out past |x| 0.39: the whole sleeve hangs with the arm (at the estimate's armRadius 0.067 its top stayed out at 0.47)", () => {
      for (const pose of [armsDownPose(createPose()), idlePose(1.3, createPose())]) {
         const world = cleaner.posed(pose);
         let widest = 0;
         for (let i = 0; i < world.length; i += 3) if (world[i + 1] > L.chestY) widest = Math.max(widest, Math.abs(world[i]));
         expect(widest).toBeLessThan(0.39);
      }
   });
});

describe("clean-city cleaner as the Scene drives it (cleaner.glb)", () => {
   let cleaner: RiggedCharacter;
   beforeAll(async () => {
      cleaner = await rigCharacter(ASSETS.cleaner);
   });

   const lowest = (world: Float32Array) => {
      let low = Infinity;
      for (let i = 1; i < world.length; i += 3) low = Math.min(low, world[i]);
      return low;
   };

   it("the pickup reach over a run, and the cheer, keep every vertex above the floor (the group raised by bodyLift)", () => {
      const p = createPose();
      const scratch = createPose();
      for (let k = 0; k < 8; k++) {
         for (const reach of [0.5, 1]) {
            walkPose((k / 8) * Math.PI * 2, 1, p);
            blendPoses(p, reachPose(1, 0.35, scratch), reach, p, POSE_MASK.arms);
            expect(lowest(cleaner.posed(p, false)) + bodyLift(p, L), `phase ${k} reach ${reach}`).toBeGreaterThan(-0.005);
         }
         cheerPose(k * 0.3, p);
         expect(lowest(cleaner.posed(p, false)) + bodyLift(p, L), `cheer ${k}`).toBeGreaterThan(-0.005);
         // easing in and out (poseWeights.ts) the cheer is blended over the walk
         for (const cheer of [0.25, 0.5, 0.75]) {
            walkPose((k / 8) * Math.PI * 2, 0.6, p);
            blendPoses(p, cheerPose(k * 0.3, scratch), cheer, p);
            expect(lowest(cleaner.posed(p, false)) + bodyLift(p, L), `cheer ${k} at ${cheer}`).toBeGreaterThan(-0.005);
         }
      }
   });

   /**
    * stepCleanerGait at a steady `v` for half a second, then for a second more the real mesh's soles
    * (their vertices within 3.5 cm of the floor at rest) skinned 300 times a second: per stance of the
    * left foot (its lowest point within 2 mm of its own lowest and no higher than the right sole's
    * over its own: the foot that carries the body): `net`, its sole's centroid's travel from
    * touch-down to lift-off over the body's travel meanwhile (0 = it stays put, 1 = it slides with
    * the body), and `maxDrift`, the farthest (world units) the centroid gets from its touch-down
    * point within any stance.
    */
   function soleSlide(v: number): { net: number; maxDrift: number } {
      const rest = cleaner.glb.cloud;
      const soles: [number[], number[]] = [[], []];
      for (let i = 0; i < rest.length / 3; i++) if (rest[i * 3 + 1] < 0.035) soles[rest[i * 3] > 0 ? 0 : 1].push(i);
      const gait = createCleanerGait();
      const pose = createPose();
      const at = new Vector3();
      const dt = 1 / 300;
      let x = 0;
      const frames: Array<{ x: number; z: number; low: number[] }> = [];
      for (let f = 0; f < 450; f++) {
         stepCleanerGait(gait, v, dt);
         x += v * dt;
         if (f < 150) continue;
         walkPose(gait.phase, gait.amount, pose);
         // only the soles' vertices, skinned like RiggedCharacter.posed does
         applyHumanoidPose(cleaner.rig, pose, false);
         cleaner.rig.root.updateMatrixWorld(true);
         const lift = bodyLift(pose, L);
         let z = 0;
         const low = [Infinity, Infinity];
         soles.forEach((ids, side) => {
            for (const i of ids) {
               cleaner.skin.applyBoneTransform(i, at.fromBufferAttribute(cleaner.position, i)).applyMatrix4(cleaner.skin.matrixWorld);
               if (side === 0) z += at.z;
               low[side] = Math.min(low[side], at.y + lift);
            }
         });
         frames.push({ x, z: x + (z / soles[0].length) * CLEANER_SCALE, low });
      }
      // each sole over its own lowest (the right one sits 2 mm above the left in the mesh)
      const floor = [0, 1].map((k) => Math.min(...frames.map((fr) => fr.low[k])));
      const on = (i: number) => frames[i].low[0] - floor[0] < 0.002 && frames[i].low[0] - floor[0] <= frames[i].low[1] - floor[1] + 1e-6;
      let slide = 0;
      let body = 0;
      let maxDrift = 0;
      let drift = 0;
      let start = -1;
      for (let i = 0; i < frames.length; i++) {
         if (on(i) && start < 0) {
            start = i;
            drift = 0;
         }
         if (on(i)) drift = Math.max(drift, Math.abs(frames[i].z - frames[start].z));
         if (!on(i) && start >= 0) {
            if (start > 0 && i - 1 > start) {
               slide += Math.abs(frames[i - 1].z - frames[start].z);
               body += frames[i - 1].x - frames[start].x;
               maxDrift = Math.max(maxDrift, drift);
            }
            start = -1;
         }
      }
      expect(body).toBeGreaterThan(0);
      return { net: slide / body, maxDrift };
   }

   const SLIDE = new Map<number, { net: number; maxDrift: number }>();
   const slideAt = (v: number) => {
      if (!SLIDE.has(v)) SLIDE.set(v, soleSlide(v));
      return SLIDE.get(v)!;
   };

   it("the planted sole stays put at a walk (1 and 2 u/s) and at a run (3.5 and 5 u/s): its net travel under 7 % of the ground covered in a stance", () => {
      for (const v of [1, 2, 3.5, 5]) {
         expect(slideAt(v).net, `v ${v}`).toBeLessThan(0.07);
      }
   });

   it("within a stance the planted sole gets under 3 cm from where it touched down at a walk (1 and 2 u/s: it rocks forward, then back) and under 6 mm at a run (3.5 and 5 u/s)", () => {
      for (const v of [1, 2]) expect(slideAt(v).maxDrift, `v ${v}`).toBeLessThan(0.03);
      for (const v of [3.5, 5]) expect(slideAt(v).maxDrift, `v ${v}`).toBeLessThan(0.006);
   });
});
