// The quadruped auto-rig on a synthetic animal (pure modules: weights, joints, poses, gait). The
// real meshes are checked by each game (describeQuadruped in quadrupedChecks.ts).
import { describe, expect, it } from "vitest";
import { QBONE, QUAD_BONE_COUNT, QUAD_BONE_PARENT, QUAD_LEGS, computeQuadrupedWeights, quadrupedJoints, type QuadrupedLandmarks } from "./quadruped";
import {
   blendQuadrupedPoses,
   createQuadrupedPose,
   quadrupedAnkles,
   quadrupedGait,
   quadrupedGaitMix,
   quadrupedIdle,
   quadrupedLeap,
   quadrupedLegLength,
   quadrupedPhaseStep,
   quadrupedSit,
   quadrupedStand,
   quadrupedStride,
} from "./quadrupedPoses";

/** A dog-like animal 1.9 long: legs 0.6 tall under a trunk, head ahead, tail up behind. */
const LM: QuadrupedLandmarks = {
   front: { top: [0.18, 0.62, 0.3], knee: [0.2, 0.34, 0.325], ankle: [0.22, 0.1, 0.33], toeZ: 0.5, radius: 0.08, bend: 1 },
   hind: { top: [0.16, 0.6, -0.3], knee: [0.18, 0.3, -0.37], ankle: [0.2, 0.1, -0.3], toeZ: -0.12, radius: 0.08, bend: -1 },
   bellyY: 0.42,
   thighBlend: 0.2,
   neck: [0.35, 0.8],
   head: [0.5, 0.98],
   mouth: [0, 1.0, 0.85],
   tail: [
      [0, 0.8, -0.5],
      [0, 0.95, -0.58],
      [0, 1.1, -0.64],
      [0, 1.25, -0.68],
   ],
   tailRadius: 0.06,
   stray: [{ line: [[0, 0.55, -0.52], [0, 0.4, -0.75], [0, 0.3, -0.9]], radius: 0.06 }],
};

/** Points on the synthetic animal: a trunk box, four leg columns, a head ball, a tail line, a stray. */
function cloud(): Float32Array {
   const pts: number[] = [];
   for (let z = -0.5; z <= 0.45; z += 0.05) for (let y = 0.45; y <= 0.85; y += 0.05) for (const x of [-0.25, 0.25]) pts.push(x, y, z);
   for (const leg of QUAD_LEGS) {
      const m = leg.front ? LM.front : LM.hind;
      for (let y = 0; y <= 0.42; y += 0.03) pts.push(m.ankle[0] * leg.side, y, m.ankle[2] + (y < 0.05 ? 0.06 : 0));
   }
   for (let a = 0; a < 6.28; a += 0.4) pts.push(Math.cos(a) * 0.2, 1.1 + Math.sin(a) * 0.2, 0.6);
   for (let k = 0; k <= 10; k++) pts.push(0, 0.8 + k * 0.045, -0.5 - k * 0.018);
   for (let k = 0; k <= 10; k++) pts.push(0, 0.55 - k * 0.025, -0.52 - k * 0.038);
   return Float32Array.from(pts);
}

describe("quadruped skeleton", () => {
   it("has every parent before its child, and the legs hang from the chest (front) and the hips (hind)", () => {
      expect(QUAD_BONE_PARENT.length).toBe(QUAD_BONE_COUNT);
      QUAD_BONE_PARENT.forEach((p, b) => expect(p).toBeLessThan(b));
      for (const leg of QUAD_LEGS) {
         expect(QUAD_BONE_PARENT[leg.upper]).toBe(leg.front ? QBONE.chest : QBONE.hips);
         expect(QUAD_BONE_PARENT[leg.lower]).toBe(leg.upper);
         expect(QUAD_BONE_PARENT[leg.paw]).toBe(leg.lower);
      }
   });

   it("puts the joints on the landmarks, the right legs mirrored", () => {
      const j = quadrupedJoints(LM);
      const at = (b: number) => [j[b * 3], j[b * 3 + 1], j[b * 3 + 2]];
      expect(at(QBONE.upperFL)).toEqual([0.18, 0.62, 0.3].map((v) => expect.closeTo(v, 6)));
      expect(at(QBONE.upperFR)[0]).toBeCloseTo(-0.18, 6);
      expect(at(QBONE.pawHR)).toEqual([-0.2, 0.1, -0.3].map((v) => expect.closeTo(v, 6)));
      expect(at(QBONE.head)).toEqual([0, 0.98, 0.5].map((v) => expect.closeTo(v, 6)));
   });
});

describe("quadruped skin weights", () => {
   const positions = cloud();
   const { skinIndex, skinWeight } = computeQuadrupedWeights(positions, LM);
   const n = positions.length / 3;
   const dominant = (i: number) => {
      let best = 0;
      for (let k = 1; k < 4; k++) if (skinWeight[i * 4 + k] > skinWeight[i * 4 + best]) best = k;
      return skinIndex[i * 4 + best];
   };
   const find = (x: number, y: number, z: number) => {
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
         const d = Math.hypot(positions[i * 3] - x, positions[i * 3 + 1] - y, positions[i * 3 + 2] - z);
         if (d < bd) {
            bd = d;
            best = i;
         }
      }
      return best;
   };

   it("sum to 1 with valid bones on every vertex", () => {
      for (let i = 0; i < n; i++) {
         let sum = 0;
         for (let k = 0; k < 4; k++) {
            expect(skinIndex[i * 4 + k]).toBeLessThan(QUAD_BONE_COUNT);
            expect(skinWeight[i * 4 + k]).toBeGreaterThanOrEqual(0);
            sum += skinWeight[i * 4 + k];
         }
         expect(sum).toBeCloseTo(1, 5);
      }
   });

   it("give each part its bone: paws, legs, trunk, head, tail, and the stray to the stash", () => {
      expect(dominant(find(0.22, 0.0, 0.39))).toBe(QBONE.pawFL);
      expect(dominant(find(-0.2, 0.0, -0.24))).toBe(QBONE.pawHR);
      expect(dominant(find(0.22, 0.27, 0.33))).toBe(QBONE.lowerFL);
      expect(dominant(find(-0.25, 0.65, -0.5))).toBe(QBONE.hips);
      expect(dominant(find(0.25, 0.65, 0.0))).toBe(QBONE.spine);
      expect(dominant(find(0.2, 1.1, 0.6))).toBe(QBONE.head);
      expect(dominant(find(0, 1.24, -0.68))).toBe(QBONE.tail3);
      expect(dominant(find(0, 0.3, -0.9))).toBe(QBONE.stash);
   });
});

describe("quadruped poses", () => {
   it("standing is the bind pose: no rotation anywhere", () => {
      const p = quadrupedStand(LM, createQuadrupedPose());
      for (const v of p.rot) expect(Math.abs(v)).toBeLessThan(1e-6);
      expect(p.lift).toBe(0);
   });

   it("the gait blends walk -> trot -> gallop with speed, slow steps short, and the stride is sweep / duty", () => {
      const walk = { ...quadrupedGaitMix(0.2, LM), offsets: [...quadrupedGaitMix(0.2, LM).offsets] };
      expect(walk.walk).toBe(1);
      expect(walk.offsets).toEqual([0.25, 0.75, 0, 0.5]);
      const trot = quadrupedGaitMix(0.6, LM);
      expect(trot.trot).toBeCloseTo(1, 6);
      expect(trot.offsets).toEqual([0.5, 1, 0, 0.5]);
      const gallop = quadrupedGaitMix(1, LM);
      expect(gallop.gallop).toBe(1);
      expect(gallop.duty).toBeLessThan(0.35);
      expect(quadrupedStride(1, LM)).toBeCloseTo(gallop.sweep / gallop.duty, 9);
      expect(quadrupedStride(0.05, LM)).toBeLessThan(quadrupedStride(0.25, LM));
      expect(quadrupedStride(1, LM)).toBeGreaterThan(3 * quadrupedLegLength(LM));
   });

   for (const speed of [0.15, 0.6, 1]) {
      it(`at speed ${speed} every paw in stance stays on its ground point while the body travels the stride`, () => {
         const pose = createQuadrupedPose();
         const stride = quadrupedStride(speed, LM);
         const mix = quadrupedGaitMix(speed, LM);
         const offsets = [...mix.offsets];
         const duty = mix.duty;
         const STEPS = 48;
         const prev: Array<number | null> = [null, null, null, null];
         for (let k = 0; k <= STEPS; k++) {
            const f = k / STEPS;
            const ankles = quadrupedAnkles(quadrupedGait(f * Math.PI * 2, speed, LM, pose), LM);
            for (let l = 0; l < 4; l++) {
               const c = (((f - offsets[l]) % 1) + 1) % 1;
               const leg = QUAD_LEGS[l];
               const rest = leg.front ? LM.front.ankle : LM.hind.ankle;
               if (c < duty - 1e-6) {
                  // on the ground at its rest height, and fixed in the world
                  expect(ankles[l * 2 + 1]).toBeCloseTo(rest[1], 3);
                  const ground = ankles[l * 2] + stride * f;
                  if (prev[l] !== null) expect(Math.abs(ground - prev[l]!)).toBeLessThan(1e-4);
                  prev[l] = ground;
               } else {
                  prev[l] = null;
                  expect(ankles[l * 2 + 1]).toBeGreaterThanOrEqual(rest[1] - 1e-6);
               }
            }
         }
      });
   }

   it("the phase step keeps the paws planted (2π per stride) and caps the cadence", () => {
      const scale = 0.5;
      const stride = quadrupedStride(0.6, LM) * scale;
      expect(quadrupedPhaseStep(0, stride / 4, 0.6, LM, scale, 1)).toBeCloseTo(Math.PI / 2, 9);
      // 10 strides in 1/60 s: capped at 5 cycles a second
      expect(quadrupedPhaseStep(0, stride * 10, 0.6, LM, scale, 1 / 60, 5)).toBeCloseTo((Math.PI * 2 * 5) / 60, 9);
   });

   it("idle, sit and leap stay finite; sit puts the rump down and the nose up; the leap pitches nose up then down", () => {
      for (const p of [quadrupedIdle(3.3, LM, createQuadrupedPose()), quadrupedSit(1, 2, LM, createQuadrupedPose()), quadrupedLeap(0.5, LM, createQuadrupedPose())]) {
         for (const v of p.rot) expect(Number.isFinite(v)).toBe(true);
         expect(Number.isFinite(p.lift)).toBe(true);
      }
      const sit = quadrupedSit(1, 0, LM, createQuadrupedPose());
      expect(sit.lift).toBeLessThan(-0.2);
      expect(sit.rot[QBONE.hips * 3]).toBeLessThan(-0.3);
      // the front paws stay where they stood
      const ankles = quadrupedAnkles(sit, LM);
      expect(ankles[0]).toBeCloseTo(LM.front.ankle[2], 2);
      expect(ankles[1]).toBeCloseTo(LM.front.ankle[1], 2);
      expect(quadrupedLeap(0, LM, createQuadrupedPose()).rot[QBONE.hips * 3]).toBeLessThan(0);
      expect(quadrupedLeap(1, LM, createQuadrupedPose()).rot[QBONE.hips * 3]).toBeGreaterThan(0);
   });

   it("blends angle by angle", () => {
      const a = quadrupedIdle(1, LM, createQuadrupedPose());
      const b = quadrupedSit(1, 1, LM, createQuadrupedPose());
      const out = blendQuadrupedPoses(a, b, 0.25, createQuadrupedPose());
      for (let i = 0; i < out.rot.length; i++) expect(out.rot[i]).toBeCloseTo(a.rot[i] + (b.rot[i] - a.rot[i]) * 0.25, 6);
      expect(out.lift).toBeCloseTo(a.lift + (b.lift - a.lift) * 0.25, 9);
   });
});
