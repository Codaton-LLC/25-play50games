// Ground contact and stride (pure forward kinematics of the legs, no three.js): the lower sole on
// the floor, the body's height, and the stride the planted foot needs.
import { describe, expect, it } from "vitest";
import { ROBOT_LANDMARKS, RUNNER_LANDMARKS } from "../sharedAssets";
import {
   CONTACT_EPS,
   CONTACT_TABLE_STEPS,
   MIN_GAIT_STRIDE,
   bodyLift,
   contactStride,
   footPoint,
   gaitPhaseStep,
   groundLift,
   measureContactStride,
   soleHeight,
   walkStride,
} from "./gait";
import { BONE, estimateHumanoidLandmarks, type HumanoidLandmarks } from "./humanoid";
import { ankleFeet, gaitSlide } from "./stanceSlide";
import { armsDownPose, createPose, idlePose, jumpPose, restPose, setBoneEuler, walkPose } from "./poses";
import { HUMAN_FEET, HUMAN_PARTS, buildShape } from "./testShapes";

const human = estimateHumanoidLandmarks(buildShape([...HUMAN_PARTS, HUMAN_FEET]));
const BODIES = [
   ["robot", ROBOT_LANDMARKS],
   ["human", human],
] as const;
const PHASES = [0, 0.5, Math.PI / 2, 2.2, Math.PI, 4, (3 * Math.PI) / 2, 5.5];

describe("groundLift and bodyLift", () => {
   it("straight legs stand on the floor: 0 for the rest pose, arms down, idle", () => {
      for (const [, l] of BODIES) {
         for (const pose of [restPose(createPose()), armsDownPose(createPose()), idlePose(2.3, createPose())]) expect(groundLift(pose, l)).toBeCloseTo(0, 9);
      }
   });

   it("a walk lowers the body at the long stride (straight legs apart), barely at mid-stance", () => {
      for (const [, l] of BODIES) {
         const legLength = l.hipY - l.ankleY;
         const stride = walkPose(Math.PI / 2, 0.5, createPose());
         // both legs straight at ±0.36 rad: the hips are legLength (1 - cos 0.36) lower
         expect(groundLift(stride, l)).toBeCloseTo(-legLength * (1 - Math.cos(0.36)), 2);
         expect(Math.abs(groundLift(walkPose(Math.PI, 0.5, createPose()), l))).toBeLessThan(0.002);
      }
   });

   it("after bodyLift, the lower sole is on the floor and the other one is not below it", () => {
      for (const [, l] of BODIES) {
         for (const amount of [0.2, 0.5]) {
            for (const phase of PHASES) {
               const p = walkPose(phase, amount, createPose());
               const left = soleHeight(p, l, 1);
               const right = soleHeight(p, l, -1);
               expect(Math.min(left, right)).toBeCloseTo(0, 9);
               expect(Math.max(left, right)).toBeGreaterThanOrEqual(-1e-9);
            }
         }
      }
   });

   it("bodyLift = ground x groundLift + lift x hip height; a jump (ground 0) keeps only its lift", () => {
      const l = ROBOT_LANDMARKS;
      const p = walkPose(Math.PI / 2, 0.5, createPose());
      const contact = groundLift(p, l);
      expect(bodyLift(p, l)).toBeCloseTo(contact, 9);
      p.ground = 0.25;
      p.lift = 0.1;
      expect(bodyLift(p, l)).toBeCloseTo(0.25 * contact + 0.1 * l.hipY, 9);
      const jump = jumpPose(1, createPose());
      expect(groundLift(jump, l)).toBeLessThan(-0.01); // tucked legs would pull the body down...
      expect(bodyLift(jump, l)).toBe(0); // ...but a jump is in the air
   });

   it("a tipped foot touches with its toe or heel: the sole's ends count, not the ankle", () => {
      for (const [, l] of BODIES) {
         // the left foot alone pitched toes-down by 0.3 rad (the leg straight)
         const p = armsDownPose(createPose());
         setBoneEuler(p.q, BONE.footL, 0.3, 0, 0);
         const toeDrop = -(Math.sin(0.3) * (l.toeZ - l.hipZ) - l.ankleY * (1 - Math.cos(0.3)));
         expect(groundLift(p, l)).toBeCloseTo(-toeDrop, 4);
         // and heels-down by the heel's lever
         setBoneEuler(p.q, BONE.footL, -0.3, 0, 0);
         const heelDrop = -(Math.sin(0.3) * (l.hipZ - l.heelZ) - l.ankleY * (1 - Math.cos(0.3)));
         expect(groundLift(p, l)).toBeCloseTo(-heelDrop, 4);
      }
   });
});

describe("walkStride", () => {
   it("0 standing, longer with the amount, about 4 x leg length x sin(swing) at a walk", () => {
      for (const [, l] of BODIES) {
         expect(walkStride(0, l)).toBeCloseTo(0, 9);
         let last = 0;
         for (const amount of [0.1, 0.3, 0.5, 0.7, 1]) {
            const stride = walkStride(amount, l);
            expect(stride).toBeGreaterThan(last);
            last = stride;
         }
         // a straight leg swept ±0.36 rad from the hip (plus the hips' turn, which adds a little)
         const legLength = l.hipY - l.ankleY;
         const walk = walkStride(0.5, l);
         expect(walk).toBeGreaterThan(4 * legLength * Math.sin(0.36));
         expect(walk).toBeLessThan(4 * legLength * Math.sin(0.36) * 1.25);
         // out of range clamps
         expect(walkStride(2, l)).toBeCloseTo(walkStride(1, l), 9);
      }
   });
});

/**
 * The contact stride by brute force (GLB units), independent of gait.ts's search: walkPose at 3600
 * phases over the left foot's stance half, its sole lifted by bodyLift (both soles' forward
 * kinematics from footPoint), the longest run of phases where it is within CONTACT_EPS of the floor
 * and not above the right one, and the ankle's sweep over it per radian x 2π.
 */
function bruteContact(amount: number, l: HumanoidLandmarks): { stride: number; share: number } {
   const n = 3600;
   const p = createPose();
   const f = new Float64Array(4);
   let best = { from: 0, to: -1 };
   let start = -1;
   const z: number[] = [];
   for (let i = 0; i <= n + 1; i++) {
      let on = false;
      if (i <= n) {
         walkPose(Math.PI / 2 + (i / n) * Math.PI, amount, p);
         const lift = bodyLift(p, l);
         const right = footPoint(p, l, -1, f)[3];
         footPoint(p, l, 1, f);
         z.push(f[2]);
         on = f[3] + lift < CONTACT_EPS && f[3] <= right + 1e-9;
      }
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
         if (i - 1 - start > best.to - best.from) best = { from: start, to: i - 1 };
         start = -1;
      }
   }
   const dphi = ((best.to - best.from) / n) * Math.PI;
   return { stride: (Math.PI * 2 * (z[best.from] - z[best.to])) / dphi, share: dphi / (Math.PI * 2) };
}

describe("contactStride", () => {
   const LANDMARKS = [...BODIES, ["runner", RUNNER_LANDMARKS] as const];

   it("0 standing; the walk's own stride at a walk (amount up to 0.5, the foot down for the whole stance half); out of range clamps", () => {
      for (const [name, l] of LANDMARKS) {
         expect(contactStride(0, l)).toBe(0);
         expect(contactStride(-1, l)).toBe(0);
         expect(measureContactStride(0, l)).toBe(0);
         for (const a of [0.05, 0.1, 0.2, 0.3, 0.4, 0.5]) {
            expect(measureContactStride(a, l) / walkStride(a, l), `${name} ${a}`).toBeCloseTo(1, 3);
            expect(contactStride(a, l) / walkStride(a, l), `${name} ${a}`).toBeCloseTo(1, 2);
            expect(bruteContact(a, l).share, `${name} ${a}`).toBeCloseTo(0.5, 2);
         }
         expect(contactStride(3, l)).toBe(contactStride(1, l));
      }
   });

   it("at a run it is the stride that matches the ankle's sweep while the foot touches the floor: within 0.5 % of a 3600-phase brute-force sweep of walkPose + footPoint + bodyLift, up to 1.42 x walkStride, the contact 9-11 % of the cycle at a full run", () => {
      for (const [name, l] of LANDMARKS) {
         for (const a of [0.55, 0.6, 0.7, 0.8, 0.9, 1]) {
            const brute = bruteContact(a, l);
            expect(Math.abs(measureContactStride(a, l) / brute.stride - 1), `${name} ${a}: x${(brute.stride / walkStride(a, l)).toFixed(3)}`).toBeLessThan(0.005);
            expect(brute.stride / walkStride(a, l), `${name} ${a}`).toBeGreaterThan(1.1);
         }
         const full = bruteContact(1, l);
         expect(full.share, name).toBeGreaterThan(0.08);
         expect(full.share, name).toBeLessThan(0.12);
         expect(full.stride / walkStride(1, l), name).toBeGreaterThan(1.38);
         expect(full.stride / walkStride(1, l), name).toBeLessThan(1.45);
      }
   });

   it("the table (CONTACT_TABLE_STEPS) interpolates the measurement within 1 %, 7 % inside the walk-to-run handover (0.53-0.56)", () => {
      expect(CONTACT_TABLE_STEPS).toBe(128);
      for (const [name, l] of LANDMARKS) {
         for (let a = 0.01; a <= 1; a += 0.0137) {
            const handover = a > 0.53 && a < 0.56;
            expect(Math.abs(contactStride(a, l) / measureContactStride(a, l) - 1), `${name} ${a.toFixed(4)}`).toBeLessThan(handover ? 0.07 : 0.01);
         }
      }
   });

   it("driving walkPose's phase by the distance over it keeps the planted ankle put at every amount (net under 3 % of the body's travel per stance); walkStride slides it 25-45 % at a run", () => {
      for (const [name, l] of LANDMARKS) {
         for (const a of [0.2, 0.4, 0.5, 0.6, 0.75, 0.9, 1]) {
            const drive = (stride: (amount: number) => number) => {
               let phase = 0;
               return (dt: number) => {
                  phase += ((2 * dt) / stride(a)) * Math.PI * 2;
                  return { phase, amount: a, speed: 2 };
               };
            };
            const now = gaitSlide(l, 1, ankleFeet(l), drive((x) => contactStride(x, l)), 6, 1);
            expect(now.stances, `${name} ${a}`).toBeGreaterThan(4);
            expect(now.net, `${name} ${a}`).toBeLessThan(0.03);
            if (a >= 0.75) expect(gaitSlide(l, 1, ankleFeet(l), drive((x) => walkStride(x, l)), 6, 1).net, `${name} ${a} walkStride`).toBeGreaterThan(0.25);
         }
      }
   });
});

describe("gaitPhaseStep", () => {
   const TAU = Math.PI * 2;

   it("0 standing still (or for no time); otherwise the distance over the contact stride x scale (the walk's own at a walk), so the planted foot stays put", () => {
      for (const [, l] of BODIES) {
         expect(gaitPhaseStep(0.5, l, 0.8, 0, 1 / 60, 4)).toBe(0);
         expect(gaitPhaseStep(0.5, l, 0.8, 1.2, 0, 4)).toBe(0);
         for (const [amount, scale, speed] of [
            [0.3, 0.8, 0.6],
            [0.5, 0.96, 1.4],
            [0.5, 0.82, 1.1],
            [0.8, 0.82, 3.5],
            [1, 0.5, 2.5],
         ] as const) {
            const step = gaitPhaseStep(amount, l, scale, speed, 0.02, 4);
            // the stride it implies is the contact stride (well under the cadence cap at these speeds)
            expect((speed * 0.02 * TAU) / step).toBeCloseTo(contactStride(amount, l) * scale, 9);
            if (amount <= 0.5) expect((speed * 0.02 * TAU) / step / (walkStride(amount, l) * scale)).toBeCloseTo(1, 2);
         }
      }
   });

   it("never beats faster than maxCadence strides a second (the stride stretches), and never steps on a stride under minStride", () => {
      for (const [, l] of BODIES) {
         for (const speed of [5, 9, 16]) {
            const dt = 1 / 60;
            const cadence = gaitPhaseStep(1, l, 0.82, speed, dt, 4) / TAU / dt;
            expect(cadence).toBeLessThanOrEqual(4 + 1e-9);
            // capped exactly where the contact stride would beat faster
            if (speed / 4 > contactStride(1, l) * 0.82) expect(cadence).toBeCloseTo(4, 9);
         }
         // a creep at amount 0 (walkStride 0): the default shortest stride, or the given one
         expect((0.05 * 0.1 * TAU) / gaitPhaseStep(0, l, 1, 0.05, 0.1)).toBeCloseTo(MIN_GAIT_STRIDE, 9);
         expect((0.05 * 0.1 * TAU) / gaitPhaseStep(0, l, 1, 0.05, 0.1, Infinity, 0.3)).toBeCloseTo(0.3, 9);
      }
   });
});

describe("footPoint", () => {
   it("the ankle under the hip joint in the T-pose, the sole on the floor; its sole y plus bodyLift is soleHeight", () => {
      for (const [, l] of BODIES) {
         const out = new Float64Array(4);
         expect(footPoint(armsDownPose(createPose()), l, 1, out)).toBe(out);
         expect(out[0]).toBeCloseTo(l.hipX, 9);
         expect(out[1]).toBeCloseTo(l.ankleY, 9);
         expect(out[2]).toBeCloseTo(l.hipZ, 9);
         expect(out[3]).toBeCloseTo(0, 9);
         const p = walkPose(1, 0.6, createPose());
         for (const side of [1, -1] as const) expect(footPoint(p, l, side)[3] + bodyLift(p, l)).toBeCloseTo(soleHeight(p, l, side), 9);
         expect(footPoint(p, l, -1)[0]).toBeLessThan(0);
      }
   });
});
