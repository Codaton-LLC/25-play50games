// The auto-rig's pure half: landmarks found in synthetic T-pose meshes, and skin weights.
import { describe, expect, it } from "vitest";
import {
   BONE,
   BONE_COUNT,
   BONE_MIRROR,
   BONE_PARENT,
   HUMANOID_BONES,
   SKIN_INFLUENCES,
   computeSkinWeights,
   estimateHumanoidLandmarks,
   humanoidJoints,
   smoothstep,
   type HumanoidLandmarks,
} from "./humanoid";
import { APRON, HUMAN, HUMAN_FEET, HUMAN_PARTS, ROBOT_LIKE, ROBOT_LIKE_PARTS, SKIRT, buildShape, mirrorPartners } from "./testShapes";

const human = buildShape(HUMAN_PARTS);
const humanL = estimateHumanoidLandmarks(human);

/** Weight of `bone` on vertex i (0 when it is not among its 4 influences). */
function weightOf(w: { skinIndex: Uint16Array; skinWeight: Float32Array }, i: number, bone: number): number {
   let sum = 0;
   for (let k = 0; k < SKIN_INFLUENCES; k++) if (w.skinIndex[i * 4 + k] === bone) sum += w.skinWeight[i * 4 + k];
   return sum;
}

function weightsAt(points: number[], l: HumanoidLandmarks) {
   return computeSkinWeights(Float32Array.from(points), l);
}

describe("bones", () => {
   it("a fixed order with parents before children; L = +x mirrors R", () => {
      expect(HUMANOID_BONES).toHaveLength(17);
      expect(BONE_COUNT).toBe(17);
      HUMANOID_BONES.forEach((name, i) => expect(BONE[name]).toBe(i));
      BONE_PARENT.forEach((parent, i) => expect(parent).toBeLessThan(i));
      expect(BONE_PARENT[BONE.clavicleL]).toBe(BONE.chest);
      expect(BONE_PARENT[BONE.upperArmL]).toBe(BONE.clavicleL);
      expect(BONE_PARENT[BONE.upperArmR]).toBe(BONE.clavicleR);
      expect(BONE_PARENT[BONE.lowerArmR]).toBe(BONE.upperArmR);
      expect(BONE_PARENT[BONE.upperLegL]).toBe(BONE.hips);
      expect(BONE_PARENT[BONE.footL]).toBe(BONE.lowerLegL);
      expect(BONE_PARENT[BONE.footR]).toBe(BONE.lowerLegR);
      for (let b = 0; b < BONE_COUNT; b++) {
         expect(BONE_MIRROR[BONE_MIRROR[b]]).toBe(b);
         const name = HUMANOID_BONES[b];
         const other = HUMANOID_BONES[BONE_MIRROR[b]];
         expect(other).toBe(name.endsWith("L") ? name.slice(0, -1) + "R" : name.endsWith("R") ? name.slice(0, -1) + "L" : name);
      }
   });

   it("joints: the left limbs on +x, the right ones mirrored, the trunk on x = 0", () => {
      const j = humanoidJoints(humanL);
      const x = (b: number) => j[b * 3];
      expect(x(BONE.upperArmL)).toBeCloseTo(humanL.shoulderX, 9);
      expect(x(BONE.lowerArmL)).toBeCloseTo(humanL.elbowX, 9);
      expect(x(BONE.upperLegL)).toBeCloseTo(humanL.hipX, 9);
      expect(x(BONE.upperArmR)).toBeCloseTo(-humanL.shoulderX, 9);
      expect(x(BONE.lowerLegR)).toBeCloseTo(-humanL.hipX, 9);
      expect(x(BONE.clavicleL)).toBeCloseTo(humanL.clavicleX, 9);
      expect(x(BONE.clavicleR)).toBeCloseTo(-humanL.clavicleX, 9);
      expect(x(BONE.footR)).toBeCloseTo(-humanL.hipX, 9);
      for (const b of [BONE.hips, BONE.spine, BONE.chest, BONE.neck, BONE.head]) expect(x(b)).toBe(0);
      expect(j[BONE.lowerLegL * 3 + 1]).toBeCloseTo(humanL.kneeY, 9);
      expect(j[BONE.footL * 3 + 1]).toBeCloseTo(humanL.ankleY, 9);
      expect(j[BONE.head * 3 + 1]).toBeCloseTo(humanL.headY, 9);
      expect(j[BONE.clavicleL * 3 + 1]).toBeCloseTo(humanL.shoulderY, 9);
   });
});

describe("estimateHumanoidLandmarks", () => {
   it("finds the joints of a box human", () => {
      const l = humanL;
      expect(l.shoulderY).toBeCloseTo(HUMAN.shoulderY, 1);
      expect(Math.abs(l.shoulderY - HUMAN.shoulderY)).toBeLessThan(0.02);
      expect(Math.abs(l.armRadius - HUMAN.armRadius)).toBeLessThan(0.015);
      // the torso ends at 0.2; the joint sits half an arm radius further out
      expect(l.shoulderX).toBeGreaterThan(HUMAN.torsoHalf + 0.3 * HUMAN.armRadius);
      expect(l.shoulderX).toBeLessThan(HUMAN.torsoHalf + HUMAN.armRadius);
      expect(l.elbowX).toBeGreaterThan(l.shoulderX);
      expect(l.wristX).toBeGreaterThan(l.elbowX);
      expect(l.wristX).toBeLessThan(HUMAN.reach);
      expect(l.elbowX).toBeCloseTo((l.shoulderX + l.wristX) / 2, 9);
      expect(Math.abs(l.crotchY - HUMAN.crotchY)).toBeLessThan(0.045);
      expect(l.hipY).toBeGreaterThan(l.crotchY);
      expect(l.hipY - l.crotchY).toBeLessThan(0.1);
      expect(Math.abs(l.hipX - HUMAN.legX)).toBeLessThan(0.02);
      expect(l.kneeY).toBeCloseTo(l.hipY / 2, 9);
      expect(l.neckY).toBeGreaterThan(HUMAN.neck[0] - 0.02);
      expect(l.neckY).toBeLessThan(HUMAN.neck[1] + 0.02);
      expect(l.headY).toBeGreaterThan(l.neckY);
      // the head joint at the top of the neck: the whole skull (from 1.52 up) is rigid on the head
      expect(l.headY + l.neckBlend).toBeLessThanOrEqual(HUMAN.neck[1] + 0.001);
      expect(l.headY + l.neckBlend).toBeGreaterThan(HUMAN.neck[1] - 0.02);
      expect(l.neckY - l.neckBlend).toBeGreaterThanOrEqual(HUMAN.neck[0] - 0.005);
      // no feet modelled: the ankle low on the shin, below the knee's blend
      expect(l.ankleY).toBeGreaterThan(0.05);
      expect(l.ankleY + l.ankleBlend).toBeLessThan(l.kneeY - l.kneeBlend);
      expect(l.clavicleX).toBeCloseTo(l.shoulderX / 2, 9);
      // nothing bridges the legs: no cloth
      expect(l.hemY).toBe(l.crotchY);
      expect(Math.abs(l.legDepth - 0.08)).toBeLessThan(0.005);
      expect(Math.abs(l.legOuterX - 0.19)).toBeLessThan(0.005);
      // the trunk chain goes up in order
      expect(l.hipY).toBeLessThan(l.spineY);
      expect(l.spineY).toBeLessThan(l.chestY);
      expect(l.chestY).toBeLessThan(l.shoulderY);
      for (const z of [l.shoulderZ, l.hipZ, l.spineZ]) expect(Math.abs(z)).toBeLessThan(0.02);
      expect(l.armSpread).toBeGreaterThanOrEqual(0.1);
      expect(l.armSpread).toBeLessThanOrEqual(0.6);
   });

   it("is deterministic", () => {
      expect(estimateHumanoidLandmarks(human)).toEqual(humanL);
      expect(estimateHumanoidLandmarks(Array.from(human))).toEqual(humanL);
   });

   it("an apron in front of the legs, or a short skirt round them, does not move the crotch or the legs; its hem is found", () => {
      for (const [extra, hem] of [
         [[APRON], 0.5],
         [SKIRT, 0.55],
      ] as const) {
         const l = estimateHumanoidLandmarks(buildShape([...HUMAN_PARTS, ...extra]));
         // seen from the front the cloth hides the gap down to 0.5 / 0.55; the crotch stays at 0.85
         expect(Math.abs(l.crotchY - HUMAN.crotchY)).toBeLessThan(0.045);
         expect(Math.abs(l.hipX - HUMAN.legX)).toBeLessThan(0.03);
         expect(Math.abs(l.shoulderY - humanL.shoulderY)).toBeLessThan(1e-9);
         // the legs' depth comes from the bare shins, so the cloth in front does not pull it forward
         expect(Math.abs(l.hipZ)).toBeLessThan(0.005);
         expect(Math.abs(l.legDepth - 0.08)).toBeLessThan(0.005);
         expect(Math.abs(l.hemY - hem)).toBeLessThan(0.02);
      }
   });

   it("long feet: the ankle above the shoe, toes and heels at the sole's ends", () => {
      const l = estimateHumanoidLandmarks(buildShape([...HUMAN_PARTS, HUMAN_FEET]));
      // the shoe (0.07 high) is all below the ankle's blend: it stays rigid on the foot
      expect(l.ankleY - l.ankleBlend).toBeGreaterThanOrEqual(0.07 - 0.002);
      expect(l.ankleY + l.ankleBlend).toBeLessThan(l.kneeY - l.kneeBlend);
      expect(l.toeZ).toBeCloseTo(0.22, 2);
      expect(l.heelZ).toBeCloseTo(-0.1, 2);
      // the rest as without feet
      expect(Math.abs(l.crotchY - humanL.crotchY)).toBeLessThan(0.02);
      expect(l.hipZ).toBeCloseTo(0, 2);
   });

   it("a robot with a head wider than its shoulders and flat hands", () => {
      const l = estimateHumanoidLandmarks(buildShape(ROBOT_LIKE_PARTS));
      expect(Math.abs(l.shoulderY - ROBOT_LIKE.shoulderY)).toBeLessThan(0.02);
      expect(l.shoulderX).toBeGreaterThan(ROBOT_LIKE.torsoHalf - 0.02);
      expect(l.shoulderX).toBeLessThan(0.36);
      expect(Math.abs(l.crotchY - ROBOT_LIKE.crotchY)).toBeLessThan(0.045);
      expect(l.neckY).toBeGreaterThan(1.15);
      expect(l.neckY).toBeLessThan(1.22);
      expect(l.wristX).toBeLessThan(ROBOT_LIKE.reach);
   });

   it("explicit landmarks win field by field, and later estimates build on them", () => {
      const l = estimateHumanoidLandmarks(human, { hipY: 0.9, shoulderX: 0.3, armSpread: 0.25 });
      expect(l.hipY).toBe(0.9);
      expect(l.shoulderX).toBe(0.3);
      expect(l.armSpread).toBe(0.25);
      expect(l.kneeY).toBeCloseTo(0.45, 9);
      expect(l.wristX).toBeCloseTo(0.3 + 0.7 * (HUMAN.reach - 0.3), 6);
      expect(l.shoulderY).toBe(humanL.shoulderY);
   });

   it("refuses an empty or flat cloud", () => {
      expect(() => estimateHumanoidLandmarks([])).toThrow(RangeError);
      expect(() => estimateHumanoidLandmarks([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0])).toThrow(RangeError);
   });
});

describe("computeSkinWeights", () => {
   const w = computeSkinWeights(human, humanL);
   const n = human.length / 3;

   it("4 influences per vertex, valid bones, weights >= 0, every row sums to 1", () => {
      expect(w.skinIndex).toHaveLength(n * 4);
      expect(w.skinWeight).toHaveLength(n * 4);
      for (let i = 0; i < n; i++) {
         let sum = 0;
         for (let k = 0; k < 4; k++) {
            expect(w.skinIndex[i * 4 + k]).toBeLessThan(BONE_COUNT);
            expect(w.skinWeight[i * 4 + k]).toBeGreaterThanOrEqual(0);
            if (k > 0) expect(w.skinWeight[i * 4 + k]).toBeLessThanOrEqual(w.skinWeight[i * 4 + k - 1]);
            sum += w.skinWeight[i * 4 + k];
         }
         expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
      }
   });

   it("hand tips ride the lower arm of their own side (L = +x)", () => {
      const tips = weightsAt([0.84, 1.38, 0, -0.84, 1.38, 0, 0.8, 1.42, 0.04, -0.8, 1.34, -0.04], humanL);
      expect(weightOf(tips, 0, BONE.lowerArmL)).toBeGreaterThan(0.999);
      expect(weightOf(tips, 1, BONE.lowerArmR)).toBeGreaterThan(0.999);
      expect(weightOf(tips, 2, BONE.lowerArmL)).toBeGreaterThan(0.999);
      expect(weightOf(tips, 3, BONE.lowerArmR)).toBeGreaterThan(0.999);
   });

   it("the chest centre is spine and chest only; the head is head only; soles are feet, shins lower legs", () => {
      const l = humanL;
      const p = weightsAt(
         [0, l.chestY, 0.11, 0, l.chestY + 0.05, -0.11, 0, 1.75, 0, 0.12, 0.02, 0, -0.12, 0.02, 0, 0.12, (l.ankleY + l.kneeY) / 2, 0],
         l
      );
      expect(weightOf(p, 0, BONE.spine) + weightOf(p, 0, BONE.chest)).toBeGreaterThan(0.999);
      expect(weightOf(p, 1, BONE.chest)).toBeGreaterThan(0.5);
      expect(weightOf(p, 2, BONE.head)).toBeGreaterThan(0.999);
      expect(weightOf(p, 3, BONE.footL)).toBeGreaterThan(0.999);
      expect(weightOf(p, 4, BONE.footR)).toBeGreaterThan(0.999);
      expect(weightOf(p, 5, BONE.lowerLegL)).toBeGreaterThan(0.999);
   });

   it("between the clavicle joint and the shoulder: the clavicle; the neck and the chest's middle are no clavicle", () => {
      const l = humanL;
      const mid = (l.clavicleX + l.shoulderX - l.shoulderBlend) / 2;
      const p = weightsAt([l.shoulderX - l.shoulderBlend, l.shoulderY, 0, -(l.shoulderX - l.shoulderBlend), l.shoulderY, 0, mid, l.shoulderY, 0, 0.02, l.shoulderY, 0, mid, l.shoulderY + 2 * l.armRadius, 0], l);
      expect(weightOf(p, 0, BONE.clavicleL)).toBeGreaterThan(0.999);
      expect(weightOf(p, 1, BONE.clavicleR)).toBeGreaterThan(0.999);
      expect(weightOf(p, 2, BONE.clavicleL)).toBeGreaterThan(0.2);
      expect(weightOf(p, 2, BONE.clavicleL)).toBeLessThan(0.999);
      expect(weightOf(p, 3, BONE.clavicleL) + weightOf(p, 3, BONE.clavicleR)).toBe(0);
      // above the arm band (the neck, a wide head) stays on the trunk
      expect(weightOf(p, 4, BONE.clavicleL)).toBe(0);
   });

   it("blends monotonically across the shoulder, the elbow and the knee", () => {
      const along = (from: number[], to: number[], steps = 40) => {
         const pts: number[] = [];
         for (let i = 0; i <= steps; i++) for (let a = 0; a < 3; a++) pts.push(from[a] + ((to[a] - from[a]) * i) / steps);
         return weightsAt(pts, humanL);
      };
      const l = humanL;
      const series = (wt: ReturnType<typeof weightsAt>, bone: number, steps = 40) =>
         Array.from({ length: steps + 1 }, (_v, i) => weightOf(wt, i, bone));
      const nonDecreasing = (s: number[]) => s.every((v, i) => i === 0 || v >= s[i - 1] - 1e-6);

      // out along the arm: chest 1 -> 0, arm (upper + lower) 0 -> 1, smooth (no jump bigger than 0.2)
      const shoulder = along([l.shoulderX - 2 * l.shoulderBlend, l.shoulderY, 0], [l.shoulderX + 2 * l.shoulderBlend, l.shoulderY, 0]);
      const arm = series(shoulder, BONE.upperArmL).map((v, i) => v + weightOf(shoulder, i, BONE.lowerArmL));
      expect(nonDecreasing(arm)).toBe(true);
      expect(arm[0]).toBeLessThan(1e-6);
      expect(arm[40]).toBeGreaterThan(0.999);
      expect(arm.some((v) => v > 0.2 && v < 0.8)).toBe(true);
      expect(Math.max(...arm.slice(1).map((v, i) => v - arm[i]))).toBeLessThan(0.2);
      const elbow = along([l.elbowX - 2 * l.elbowBlend, l.shoulderY, 0], [l.elbowX + 2 * l.elbowBlend, l.shoulderY, 0]);
      const fore = series(elbow, BONE.lowerArmL);
      expect(nonDecreasing(fore)).toBe(true);
      expect(fore[0]).toBeLessThan(1e-6);
      expect(fore[40]).toBeGreaterThan(0.999);
      // down the left leg: upper leg -> lower leg
      const knee = along([l.hipX, l.kneeY + 2 * l.kneeBlend, 0], [l.hipX, l.kneeY - 2 * l.kneeBlend, 0]);
      const shin = series(knee, BONE.lowerLegL);
      expect(nonDecreasing(shin)).toBe(true);
      expect(shin[0]).toBeLessThan(1e-6);
      expect(shin[40]).toBeGreaterThan(0.999);
      // down the left shin: lower leg -> foot
      const ankle = along([l.hipX, l.ankleY + 2 * l.ankleBlend, 0], [l.hipX, l.ankleY - 2 * l.ankleBlend, 0]);
      const foot = series(ankle, BONE.footL);
      expect(nonDecreasing(foot)).toBe(true);
      expect(foot[0]).toBeLessThan(1e-6);
      expect(foot[40]).toBeGreaterThan(0.999);
      // from the chest's middle out to the arm: chest 1 -> 0, then clavicle, then arm, smoothly
      const out = along([0, l.shoulderY, 0], [l.shoulderX + 2 * l.shoulderBlend, l.shoulderY, 0]);
      const chest = series(out, BONE.chest);
      const beyond = chest.map((_v, i) => weightOf(out, i, BONE.clavicleL) + weightOf(out, i, BONE.upperArmL) + weightOf(out, i, BONE.lowerArmL));
      expect(nonDecreasing(beyond)).toBe(true);
      expect(nonDecreasing(chest.map((v) => -v))).toBe(true);
      expect(beyond[0]).toBe(0);
      expect(beyond[40]).toBeGreaterThan(0.999);
      expect(Math.max(...beyond.slice(1).map((v, i) => v - beyond[i]))).toBeLessThan(0.2);
   });

   it("the crotch and an apron between the legs blend both legs (and the hips), never one leg", () => {
      const l = humanL;
      const p = weightsAt([0, l.crotchY, 0.08, 0, l.crotchY - 0.2, 0.1, 0.01, l.crotchY - 0.2, 0.1], l);
      for (let i = 0; i < 2; i++) {
         const left = weightOf(p, i, BONE.upperLegL) + weightOf(p, i, BONE.lowerLegL);
         const right = weightOf(p, i, BONE.upperLegR) + weightOf(p, i, BONE.lowerLegR);
         expect(Math.abs(left - right)).toBeLessThan(1e-6);
         expect(left).toBeGreaterThan(0.2);
      }
      expect(weightOf(p, 0, BONE.hips)).toBeGreaterThan(0.05);
      // just left of the middle leans left, smoothly
      const left = weightOf(p, 2, BONE.upperLegL) + weightOf(p, 2, BONE.lowerLegL);
      expect(left).toBeGreaterThan(0.5);
      expect(left).toBeLessThan(0.75);
   });

   it("cloth that bridges the legs (an apron) is skirt-weighted: wider L/R share down to the hem, some hips; the legs stay on their own leg", () => {
      const withApron = buildShape([...HUMAN_PARTS, APRON]);
      const l = estimateHumanoidLandmarks(withApron);
      const legOf = (w: ReturnType<typeof weightsAt>, i: number, side: 1 | -1) =>
         side > 0
            ? weightOf(w, i, BONE.upperLegL) + weightOf(w, i, BONE.lowerLegL) + weightOf(w, i, BONE.footL)
            : weightOf(w, i, BONE.upperLegR) + weightOf(w, i, BONE.lowerLegR) + weightOf(w, i, BONE.footR);
      // the apron's front at the hem: x = 0 shares both legs, in front of the left leg mostly (not only) the left
      const hem = weightsAt([0, 0.51, 0.11, 0.12, 0.51, 0.11, 0.2, 0.51, 0.11, 0.12, 0.8, 0.11, 0.12, 0.6, 0, 0.12, 0.51, 0], l);
      expect(legOf(hem, 0, 1)).toBeCloseTo(legOf(hem, 0, -1), 6);
      expect(legOf(hem, 1, 1)).toBeGreaterThan(0.6);
      expect(legOf(hem, 1, 1)).toBeLessThan(0.9);
      expect(legOf(hem, 2, 1)).toBeGreaterThan(legOf(hem, 1, 1));
      // up the apron the hips take a share that fades out down to the hem
      expect(weightOf(hem, 3, BONE.hips)).toBeGreaterThan(0.2);
      expect(weightOf(hem, 1, BONE.hips)).toBeLessThan(0.05);
      // the leg inside its column: all left, cloth or not around it
      expect(legOf(hem, 4, 1)).toBeGreaterThan(0.999);
      expect(legOf(hem, 5, 1)).toBeGreaterThan(0.999);
      // the same apron point on a body whose legs nothing bridges: all left (the hard split)
      const bare = weightsAt([0.12, 0.51, 0.11], humanL);
      expect(legOf(bare, 0, 1)).toBeGreaterThan(0.999);
   });

   it("a head wider than the shoulders stays on the head (the arm band gates by height)", () => {
      const robot = buildShape(ROBOT_LIKE_PARTS);
      const l = estimateHumanoidLandmarks(robot);
      const wr = computeSkinWeights(robot, l);
      let checked = 0;
      for (let i = 0; i < robot.length / 3; i++) {
         const ax = Math.abs(robot[i * 3]);
         const y = robot[i * 3 + 1];
         if (y < ROBOT_LIKE.head[0] || ax < l.shoulderX - l.shoulderBlend) continue;
         checked++;
         const arm =
            weightOf(wr, i, BONE.upperArmL) + weightOf(wr, i, BONE.lowerArmL) + weightOf(wr, i, BONE.upperArmR) + weightOf(wr, i, BONE.lowerArmR);
         expect(arm).toBe(0);
      }
      expect(checked).toBeGreaterThan(100);
   });

   it("mirror vertices get mirror bones with the same weights", () => {
      const partners = mirrorPartners(human);
      for (let i = 0; i < n; i += 7) {
         const j = partners[i];
         for (let b = 0; b < BONE_COUNT; b++) expect(weightOf(w, j, BONE_MIRROR[b])).toBeCloseTo(weightOf(w, i, b), 6);
      }
   });

   it("is deterministic and fills a given output", () => {
      const out = { skinIndex: new Uint16Array(n * 4), skinWeight: new Float32Array(n * 4) };
      const again = computeSkinWeights(human, humanL, out);
      expect(again.skinIndex).toBe(out.skinIndex);
      expect(again.skinWeight).toBe(out.skinWeight);
      expect(Array.from(out.skinIndex)).toEqual(Array.from(w.skinIndex));
      expect(Array.from(out.skinWeight)).toEqual(Array.from(w.skinWeight));
   });
});

describe("smoothstep", () => {
   it("0 below, 1 above, 1/2 halfway, a step when the edges meet", () => {
      expect(smoothstep(1, 2, 0.5)).toBe(0);
      expect(smoothstep(1, 2, 2.5)).toBe(1);
      expect(smoothstep(1, 2, 1.5)).toBeCloseTo(0.5, 12);
      expect(smoothstep(1, 1, 0.99)).toBe(0);
      expect(smoothstep(1, 1, 1)).toBe(1);
   });
});
