// The pulled cart and the bellboy's grip (cart.ts, rules.ts stepTrolley): the cart follows the hitch
// behind him with no lag at a steady walk, pivots about its rear axle instead of sliding sideways,
// swings round with him on a turn on the spot without touching him, stays clear of the walls, and the
// two-bone IK puts each palm exactly on its grip with the elbow bent back.
import { describe, expect, it } from "vitest";
import { BONE, BONE_COUNT, BONE_PARENT, humanoidJoints } from "@/arcade3d/core/rig/humanoid";
import { createPose, idlePose, resolvePose, walkPose, type HumanoidPose } from "@/arcade3d/core/rig/poses";
import { footPoint } from "@/arcade3d/core/rig/gait";
import { mulQuat, rotateVec } from "@/arcade3d/core/rig/quat";
import { BELLBOY_LANDMARKS as L, BELLBOY_SCALE as S } from "./assets";
import { AXLE_BACK, GRIP_AHEAD, HITCH, TOW, MAX_SWING, PALM, gripPoint, hitchPoint, reachArm, toBodyFrame } from "./cart";
import { LEVELS } from "./levels";
import { HALF_W, TROLLEY_GAP, TROLLEY_LAG, createRun, step, stepTrolley, type Run } from "./rules";

const DT = 1 / 60;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The drawn cart's footprint (m): half its width and half its length (bellboyTrolleyV3T at 1.30 m). */
const HALF_WIDTH = 0.385;
const HALF_LENGTH = 0.58;

function bar(run: Run) {
   const t = run.trolley;
   return { x: t.x.x + Math.sin(t.yaw) * GRIP_AHEAD, z: t.z.x + Math.cos(t.yaw) * GRIP_AHEAD };
}

/** Distance from (px, pz) to the cart's footprint rectangle (0 inside). */
function toFootprint(run: Run, px: number, pz: number) {
   const t = run.trolley;
   const dx = px - t.x.x;
   const dz = pz - t.z.x;
   const along = dx * Math.sin(t.yaw) + dz * Math.cos(t.yaw);
   const across = dx * Math.cos(t.yaw) - dz * Math.sin(t.yaw);
   return Math.hypot(Math.max(0, Math.abs(along) - HALF_LENGTH), Math.max(0, Math.abs(across) - HALF_WIDTH));
}

/** An open floor: the same run without decor, the hero scripted by hand. */
function openRun(x: number, z: number, yaw: number): Run {
   const run = createRun(3, LEVELS[5]);
   run.solids = [];
   run.hero.x = x;
   run.hero.z = z;
   run.hero.yaw = yaw;
   const h = hitchPoint(x, z, yaw, { x: 0, z: 0 });
   run.trolley.x.x = h.x - Math.sin(yaw) * GRIP_AHEAD;
   run.trolley.z.x = h.z - Math.cos(yaw) * GRIP_AHEAD;
   run.trolley.yaw = yaw;
   run.trolley.hx = h.x;
   run.trolley.hz = h.z;
   return run;
}

describe("hotel cart: follow", () => {
   it("at a steady walk the bar sits on the hitch and the cart is straight behind him", () => {
      const run = createRun(5, LEVELS[5]);
      const input = { moveX: 0, moveY: 1, actionPressed: false, yaw: 0 };
      for (let i = 0; i < 90; i++) step(run, input, DT, 100_000);
      const h = run.hero;
      const hitch = hitchPoint(h.x, h.z, h.yaw, { x: 0, z: 0 });
      const b = bar(run);
      expect(Math.hypot(h.vx, h.vz)).toBeGreaterThan(3.9);
      expect(Math.hypot(b.x - hitch.x, b.z - hitch.z)).toBeLessThan(0.01);
      expect(Math.abs(wrap(run.trolley.yaw - h.yaw))).toBeLessThan(0.01);
      expect(Math.hypot(run.trolley.x.x - h.x, run.trolley.z.x - h.z)).toBeCloseTo(TROLLEY_GAP, 2);
   });

   it("a start and a stop leave the bar at most TROLLEY_LAG off the hitch, and it springs back", () => {
      const run = createRun(5, LEVELS[5]);
      let most = 0;
      for (let i = 0; i < 150; i++) {
         const input = { moveX: 0, moveY: i < 70 ? 1 : 0, actionPressed: false, yaw: 0 };
         step(run, input, DT, 100_000);
         const h = run.hero;
         const hitch = hitchPoint(h.x, h.z, h.yaw, { x: 0, z: 0 });
         const b = bar(run);
         most = Math.max(most, Math.hypot(b.x - hitch.x, b.z - hitch.z));
      }
      expect(most).toBeGreaterThan(0.005); // there is a lag ...
      expect(most).toBeLessThanOrEqual(TROLLEY_LAG + 1e-9); // ... and it is short
      const h = run.hero;
      const hitch = hitchPoint(h.x, h.z, h.yaw, { x: 0, z: 0 });
      const b = bar(run);
      expect(Math.hypot(b.x - hitch.x, b.z - hitch.z)).toBeLessThan(0.005);
   });

   it("on an S-curve the rear axle rolls along the cart (no sideways slide) and the swing stays inside MAX_SWING", () => {
      // x = 0.8 sin(z / 2): the tightest bend is 2 m round
      const speed = 3;
      const run = openRun(0, 3, 0);
      let prevAx = NaN;
      let prevAz = NaN;
      let slide = 0;
      let z = 3;
      for (let i = 0; i < 300; i++) {
         const dxdz = 0.4 * Math.cos(z / 2);
         z += (speed * DT) / Math.hypot(1, dxdz);
         run.hero.x = 0.8 * Math.sin(z / 2);
         run.hero.z = z;
         run.hero.yaw = Math.atan2(0.4 * Math.cos(z / 2), 1);
         stepTrolley(run, DT);
         const t = run.trolley;
         expect(Math.abs(wrap(t.yaw - run.hero.yaw))).toBeLessThanOrEqual(MAX_SWING + 1e-9);
         const ax = t.x.x - Math.sin(t.yaw) * AXLE_BACK;
         const az = t.z.x - Math.cos(t.yaw) * AXLE_BACK;
         if (i > 0) {
            // the axle's speed across the cart, over his speed
            const across = ((ax - prevAx) * Math.cos(t.yaw) - (az - prevAz) * Math.sin(t.yaw)) / DT;
            slide = Math.max(slide, Math.abs(across) / speed);
         }
         prevAx = ax;
         prevAz = az;
      }
      expect(slide).toBeLessThan(0.05);
   });

   it("a turn on the spot carries the cart round with him and it never touches him", () => {
      const run = openRun(0, 12, 0);
      for (let i = 0; i < 90; i++) {
         // half a turn in 0.35 s (his own turn rate), then standing
         run.hero.yaw = Math.min(Math.PI, (Math.PI * i * DT) / 0.35);
         stepTrolley(run, DT);
         expect(Math.abs(wrap(run.trolley.yaw - run.hero.yaw))).toBeLessThanOrEqual(MAX_SWING + 1e-9);
         // his body (0.2 m round the centre) stays out of the footprint
         expect(toFootprint(run, run.hero.x, run.hero.z)).toBeGreaterThan(0.2);
      }
      // a trailer only straightens when pulled: three metres of walk line it up behind him again
      for (let i = 0; i < 180; i++) {
         run.hero.z -= DT;
         stepTrolley(run, DT);
         expect(toFootprint(run, run.hero.x, run.hero.z)).toBeGreaterThan(0.2);
      }
      expect(Math.abs(wrap(run.trolley.yaw - Math.PI))).toBeLessThan(0.1);
   });

   it("turning away from a door wall the cart's far end and centre stay inside the corridor", () => {
      const run = openRun(HALF_W - 0.4, 12, Math.PI / 2);
      for (let i = 0; i < 200; i++) {
         if (i < 20) run.hero.yaw = Math.PI / 2 + (Math.PI * i) / 20;
         else if (run.hero.x > -1) run.hero.x -= 3 * DT;
         stepTrolley(run, DT);
         const t = run.trolley;
         expect(Math.abs(t.x.x)).toBeLessThanOrEqual(HALF_W - 0.45 + 1e-9);
         const far = Math.abs(t.x.x - Math.sin(t.yaw) * 0.25);
         expect(far).toBeLessThanOrEqual(HALF_W - 0.36 + 0.01);
      }
      // once he walks off, it is back on the hitch, straight behind him
      const b = bar(run);
      const hitch = hitchPoint(run.hero.x, run.hero.z, run.hero.yaw, { x: 0, z: 0 });
      expect(Math.hypot(b.x - hitch.x, b.z - hitch.z)).toBeLessThan(0.01);
   });
});

// ---------- the grip ----------

const J = humanoidJoints(L);
const RQ = new Float32Array(BONE_COUNT * 4);
const WQ = new Float64Array(BONE_COUNT * 4);
const WP = new Float64Array(BONE_COUNT * 3);
const V = new Float64Array(3);

/** Forward kinematics of the skinned rig (resolvePose, as drawn): the palm and the elbow of arm `side`. */
function armPoints(pose: HumanoidPose, side: 1 | -1) {
   resolvePose(pose, L.armSpread, RQ);
   for (let b = 0; b < BONE_COUNT; b++) {
      const p = BONE_PARENT[b];
      if (p < 0) {
         WQ.set(RQ.subarray(b * 4, b * 4 + 4), b * 4);
         WP.set(J.subarray(b * 3, b * 3 + 3), b * 3);
         continue;
      }
      rotateVec(WQ, p * 4, J[b * 3] - J[p * 3], J[b * 3 + 1] - J[p * 3 + 1], J[b * 3 + 2] - J[p * 3 + 2], V, 0);
      WP[b * 3] = WP[p * 3] + V[0];
      WP[b * 3 + 1] = WP[p * 3 + 1] + V[1];
      WP[b * 3 + 2] = WP[p * 3 + 2] + V[2];
      mulQuat(WQ, p * 4, RQ, b * 4, WQ, b * 4);
   }
   const lower = side > 0 ? BONE.lowerArmL : BONE.lowerArmR;
   const upper = side > 0 ? BONE.upperArmL : BONE.upperArmR;
   rotateVec(WQ, lower * 4, side * (L.wristX - L.elbowX + PALM), 0, 0, V, 0);
   return {
      palm: [WP[lower * 3] + V[0], WP[lower * 3 + 1] + V[1], WP[lower * 3 + 2] + V[2]],
      elbow: [WP[lower * 3], WP[lower * 3 + 1], WP[lower * 3 + 2]],
      shoulder: [WP[upper * 3], WP[upper * 3 + 1], WP[upper * 3 + 2]],
   };
}

describe("hotel cart: the bellboy's grip", () => {
   const run = createRun(1, LEVELS[1]);
   for (let i = 0; i < 60; i++) stepTrolley(run, DT);
   const poses: [string, HumanoidPose][] = [["idle", idlePose(0.7, createPose())]];
   for (const ph of [0, 1.2, 2.5, 4, 5.5]) poses.push([`walk ${ph}`, walkPose(ph, 0.85, createPose())]);

   for (const [name, pose] of poses) {
      it(`${name}: each palm lands on its grip, the elbow bent back, the hand behind his back`, () => {
         const W = { x: 0, y: 0, z: 0 };
         const B = { x: 0, y: 0, z: 0 };
         for (const side of [1, -1] as const) {
            gripPoint(run.trolley.x.x, run.trolley.z.x, run.trolley.yaw, run.hero.yaw, side, W);
            toBodyFrame(run.hero.x, run.hero.z, run.hero.yaw, 0, S, W.x, W.y, W.z, B);
            // his own side of the bar
            expect(Math.sign(B.x)).toBe(side);
            const k = reachArm(pose, L, side, B.x, B.y, B.z, 0.45, 0.1, -1);
            // in reach, with a bent elbow (not a stiff straight arm)
            expect(k).toBeGreaterThan(0.75);
            expect(k).toBeLessThan(0.97);
            const { palm, elbow, shoulder } = armPoints(pose, side);
            expect(Math.hypot(palm[0] - B.x, palm[1] - B.y, palm[2] - B.z)).toBeLessThan(1e-3);
            // the elbow behind the shoulder-to-palm line, and out from the body
            const s = (elbow[1] - shoulder[1]) / (palm[1] - shoulder[1]);
            const lineZ = shoulder[2] + (palm[2] - shoulder[2]) * s;
            expect(elbow[2]).toBeLessThan(lineZ);
            expect(side * elbow[0]).toBeGreaterThan(side * shoulder[0] - 0.02);
            // the hand behind his back (the jacket's back is at about -0.18 GLB units)
            expect(palm[2]).toBeLessThan(-0.25);
         }
      });
   }

   it("an out-of-reach point gets a straight arm pointing at it", () => {
      const pose = idlePose(0, createPose());
      const k = reachArm(pose, L, 1, 1.5, 1.2, 0.8, 0.3, -1, -0.3);
      expect(k).toBeGreaterThan(1);
      const { palm, elbow, shoulder } = armPoints(pose, 1);
      const arm = Math.hypot(palm[0] - shoulder[0], palm[1] - shoulder[1], palm[2] - shoulder[2]);
      expect(arm).toBeCloseTo(L.wristX - L.shoulderX + PALM, 2);
      const d = Math.hypot(1.5 - shoulder[0], 1.2 - shoulder[1], 0.8 - shoulder[2]);
      const cos = ((palm[0] - shoulder[0]) * (1.5 - shoulder[0]) + (palm[1] - shoulder[1]) * (1.2 - shoulder[1]) + (palm[2] - shoulder[2]) * (0.8 - shoulder[2])) / (arm * d);
      expect(cos).toBeGreaterThan(0.999);
      expect(elbow[1]).toBeLessThan(shoulder[1] + 0.2);
   });

   it("the walk's feet never reach the cart's deck (it overhangs the crossbar by 0.21 m, the tow bar keeps it 0.60 m back)", () => {
      const pose = createPose();
      const out = new Float64Array(4);
      let back = 0;
      for (let ph = 0; ph < Math.PI * 2; ph += 0.05) {
         walkPose(ph, 0.85, pose);
         for (const side of [1, -1] as const) {
            footPoint(pose, L, side, out);
            back = Math.min(back, (out[2] + L.heelZ - L.hipZ) * S);
         }
      }
      expect(back).toBeGreaterThan(-(HITCH + TOW - 0.21) + 0.03);
   });
});
