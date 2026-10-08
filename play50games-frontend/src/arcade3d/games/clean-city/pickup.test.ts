// The cleaner's pickup (pickup.ts) on the core rig with the cleaner's landmarks, as Scene.tsx builds
// it (the walk or the idle, then pickupPose by the window's weight): the stoop lowers the body over
// soles kept on the floor (knees and back bent), the nearer hand reaches down towards the piece,
// and no arm ever comes near the T-pose (level, out to the side) at any weight, speed or piece
// position. The real mesh: cleaner.test.ts.
import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
   BONE,
   BONE_COUNT,
   BONE_PARENT,
   POSE_MASK,
   blendPoses,
   bodyLift,
   copyPose,
   createPose,
   humanoidJoints,
   idlePose,
   reachPose,
   resolvePose,
   soleHeight,
   walkPose,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { CLEANER_LANDMARKS } from "./assets";
import { CLEANER_SCALE } from "./gait";
import { PICKUP_AIM, REACH_DOWN, REACH_OUT, STOOP, createPickupMark, localOffset, notePickup, pickupPose, pickupSide, type PickupMark } from "./pickup";
import { ITEMS_PER_MAP, MAP_COUNT, NONE, createRun, createStepInput, step, type CleanRun } from "./rules";

const L = CLEANER_LANDMARKS;
const J = humanoidJoints(L);
const RESOLVED = new Float32Array(BONE_COUNT * 4);
const PARENT = BONE_PARENT;

/** As Scene.tsx Cleaner: the walk, the idle's upper body when slow, then the pickup by `k`. */
function scenePose(phase: number, amount: number, k: number, side: 1 | -1, lx: number, lz: number, p = createPose(), scratch = createPose()): HumanoidPose {
   walkPose(phase, amount, p);
   blendPoses(p, idlePose(1.3, scratch), 1 - Math.min(1, amount * 5), p, POSE_MASK.upper);
   return pickupPose(p, k, side, lx, lz, scratch);
}

/** Every bone's joint and rotation from the root in `pose` (resolved like the rig, the body lifted by bodyLift), GLB units. */
function skeleton(pose: HumanoidPose): { at: Vector3[]; rot: Quaternion[] } {
   resolvePose(pose, L.armSpread, RESOLVED);
   const lift = bodyLift(pose, L);
   const at: Vector3[] = [];
   const rot: Quaternion[] = [];
   for (let b = 0; b < BONE_COUNT; b++) {
      const q = new Quaternion(RESOLVED[b * 4], RESOLVED[b * 4 + 1], RESOLVED[b * 4 + 2], RESOLVED[b * 4 + 3]);
      const p = PARENT[b];
      if (p < 0) {
         at.push(new Vector3(J[0], J[1] + lift, J[2]));
         rot.push(q);
         continue;
      }
      const off = new Vector3(J[b * 3] - J[p * 3], J[b * 3 + 1] - J[p * 3 + 1], J[b * 3 + 2] - J[p * 3 + 2]).applyQuaternion(rot[p]);
      at.push(at[p].clone().add(off));
      rot.push(rot[p].clone().multiply(q));
   }
   return { at, rot };
}

/** The fingertip (the arm's reach, along the forearm from the elbow) of `side`'s hand. */
function fingertip(pose: HumanoidPose, side: 1 | -1): Vector3 {
   const { at, rot } = skeleton(pose);
   const fore = side > 0 ? BONE.lowerArmL : BONE.lowerArmR;
   return at[fore].clone().add(new Vector3(side * (0.949 - L.elbowX), 0, 0).applyQuaternion(rot[fore]));
}

/** The upper arm's direction in the character's frame (the clavicle's shrug included). */
function upperArmDir(pose: HumanoidPose, side: 1 | -1): Vector3 {
   const { rot } = skeleton(pose);
   return new Vector3(side, 0, 0).applyQuaternion(rot[side > 0 ? BONE.upperArmL : BONE.upperArmR]);
}

/** The upper arm's angle (rad) from its T-pose direction in the chest's frame (as poseWeights.test.ts measures the cheer). */
function fromTPose(pose: HumanoidPose, side: 1 | -1): number {
   const { rot } = skeleton(pose);
   const chest = rot[BONE.chest].clone().invert();
   const d = new Vector3(side, 0, 0).applyQuaternion(chest.multiply(rot[side > 0 ? BONE.upperArmL : BONE.upperArmR]));
   return Math.acos(Math.max(-1, Math.min(1, d.x * side)));
}

const S = CLEANER_SCALE;
/** Pieces around the cleaner (its own frame, world units): ahead, ahead-left/right, beside, under it, behind. */
const PIECES: Array<[number, number]> = [
   [0, 0.8],
   [0.35, 0.7],
   [-0.35, 0.7],
   [0.75, 0.15],
   [-0.75, 0.15],
   [0.05, 0.05],
   [0.3, -0.5],
   [-0.3, -0.5],
];
const PHASES = Array.from({ length: 8 }, (_v, i) => (i / 8) * Math.PI * 2);

describe("clean-city pickup: helpers (pickup.ts)", () => {
   it("localOffset turns a world offset into the cleaner's frame (rules heading 0 = facing +z; +x is its left)", () => {
      const o = { x: 0, z: 0 };
      expect(localOffset(0.3, 0.8, 0, o)).toEqual({ x: 0.3, z: 0.8 });
      // facing +x (heading π/2): a piece at world +x is ahead, one at world -z is on its left
      localOffset(1, 0, Math.PI / 2, o);
      expect(o.x).toBeCloseTo(0, 12);
      expect(o.z).toBeCloseTo(1, 12);
      localOffset(0, -1, Math.PI / 2, o);
      expect(o.x).toBeCloseTo(1, 12);
      expect(o.z).toBeCloseTo(0, 12);
      // facing the camera's way (-z, heading π): world +x is on its right
      localOffset(1, 0, Math.PI, o);
      expect(o.x).toBeCloseTo(-1, 12);
   });

   it("pickupSide picks the nearer hand: the left (1) for a piece on its left or straight ahead, the right (-1) otherwise", () => {
      expect(pickupSide(0.3)).toBe(1);
      expect(pickupSide(0)).toBe(1);
      expect(pickupSide(-0.01)).toBe(-1);
   });
});

describe("clean-city pickup: the stoop on the core rig (pickup.ts)", () => {
   it("weight 0 changes nothing", () => {
      for (const [lx, lz] of PIECES) {
         const p = walkPose(1.1, 0.6, createPose());
         const before = copyPose(p, createPose());
         pickupPose(p, 0, pickupSide(lx), lx, lz, createPose());
         expect(Array.from(p.q)).toEqual(Array.from(before.q));
         expect([p.dropL, p.dropR, p.lift, p.ground]).toEqual([before.dropL, before.dropR, before.lift, before.ground]);
      }
   });

   it("keeps the soles on the floor: at full weight the lower sole is on it (a run's flight lets go of the floor, the stoop does not), at every weight neither sole is under it", () => {
      for (const amount of [0, 0.3, 0.6, 1]) {
         for (const phase of PHASES) {
            for (const [lx, lz] of PIECES) {
               for (const k of [0.25, 0.5, 0.75, 1]) {
                  const p = scenePose(phase, amount, k, pickupSide(lx), lx, lz);
                  const left = soleHeight(p, L, 1);
                  const right = soleHeight(p, L, -1);
                  const label = `amount ${amount} phase ${phase.toFixed(2)} piece (${lx}, ${lz}) k ${k}`;
                  expect(Math.min(left, right), label).toBeGreaterThan(-1e-6);
                  if (k === 1) expect(Math.min(left, right), label).toBeLessThan(1e-6);
               }
            }
         }
      }
   });

   it("crouches: both knees bend and the back leans forward, so the hips drop over 5 cm and the head over 15 cm (7 and 17; standing, world units: the cleaner is 0.95 tall)", () => {
      const stand = scenePose(0, 0, 0, 1, 0.35, 0.7);
      const stoop = scenePose(0, 0, 1, 1, 0.35, 0.7);
      const a = skeleton(stand);
      const b = skeleton(stoop);
      expect((a.at[BONE.hips].y - b.at[BONE.hips].y) * S).toBeGreaterThan(0.05);
      expect((a.at[BONE.head].y - b.at[BONE.head].y) * S).toBeGreaterThan(0.15);
      // the head joint moves forward over the feet, the knees forward of the hips' line
      expect(b.at[BONE.head].z - a.at[BONE.head].z).toBeGreaterThan(0.2);
      for (const knee of [BONE.lowerLegL, BONE.lowerLegR]) expect(b.at[knee].z).toBeGreaterThan(a.at[knee].z + 0.1);
      expect(STOOP.knee).toBeGreaterThan(1);
      expect(STOOP.hips + STOOP.spine + STOOP.chest).toBeGreaterThan(0.9);
   });

   it("reaches with the nearer hand: its fingertip goes towards the piece (over 10 cm nearer than standing with the arms down, nearer than the other hand) and stays low, under 0.34 over the floor (a drawn piece is 0.78-0.9 tall), at a stand, a walk and a run", () => {
      for (const amount of [0, 0.5, 1]) {
         for (const [lx, lz] of PIECES.slice(0, 5)) {
            const side = pickupSide(lx);
            const p = scenePose(0.7, amount, 1, side, lx, lz);
            const near = fingertip(p, side);
            const far = fingertip(p, side > 0 ? -1 : 1);
            const piece = new Vector3(lx / S, 0, lz / S);
            const flat = (v: Vector3) => Math.hypot(v.x - piece.x, v.z - piece.z);
            const label = `amount ${amount} piece (${lx}, ${lz})`;
            expect(near.y * S, label).toBeLessThan(0.34);
            expect(flat(near), label).toBeLessThan(flat(far));
            // standing with the arms down the same hand was further from the piece, and no lower
            const rest = fingertip(scenePose(0.7, 0, 0, side, lx, lz), side);
            expect((flat(rest) - flat(near)) * S, label).toBeGreaterThan(0.1);
            expect(near.y, label).toBeLessThanOrEqual(rest.y);
         }
      }
   });

   it("aims within a hand's reach and at least REACH_DOWN below level, never behind the shoulder", () => {
      const p = createPose();
      const scratch = createPose();
      for (const amount of [0, 0.5, 1]) {
         for (const [lx, lz] of PIECES) {
            scenePose(2.2, amount, 1, pickupSide(lx), lx, lz, p, scratch);
            const dx = PICKUP_AIM[3] - PICKUP_AIM[0];
            const dy = PICKUP_AIM[4] - PICKUP_AIM[1];
            const dz = PICKUP_AIM[5] - PICKUP_AIM[2];
            const label = `amount ${amount} piece (${lx}, ${lz})`;
            expect(Math.hypot(dx, dz) * S, label).toBeLessThanOrEqual(REACH_OUT + 1e-9);
            expect(Math.atan2(-dy, Math.hypot(dx, dz)), label).toBeGreaterThanOrEqual(REACH_DOWN - 1e-9);
            expect(dz, label).toBeGreaterThan(0);
         }
      }
   });

   it("never looks like the T-pose: at every weight, speed, stride phase and piece position both upper arms stay over 45° from level-out-to-the-side, in the body's frame and in the chest's (46.7° / 50.7° at the closest: a piece beside it at a run), and an arm reaching sideways points over 35° down (41.5°); the old reachPose(1, 0.35) was under 30° from it", () => {
      const p = createPose();
      const scratch = createPose();
      let nearestBody = Infinity;
      let nearestChest = Infinity;
      let sideways = 0;
      let lowestSideways = -Infinity;
      for (const amount of [0, 0.3, 0.6, 1]) {
         for (const phase of PHASES) {
            for (const [lx, lz] of PIECES) {
               for (let k = 0; k <= 1.0001; k += 0.05) {
                  scenePose(phase, amount, k, pickupSide(lx), lx, lz, p, scratch);
                  for (const side of [1, -1] as const) {
                     const d = upperArmDir(p, side);
                     nearestBody = Math.min(nearestBody, Math.acos(Math.max(-1, Math.min(1, side * d.x))));
                     nearestChest = Math.min(nearestChest, fromTPose(p, side));
                     // an arm reaching out sideways (a piece beside the cleaner) points well down
                     if (side * d.x > 0.5) {
                        sideways++;
                        lowestSideways = Math.max(lowestSideways, Math.asin(d.y));
                     }
                  }
               }
            }
         }
      }
      expect(sideways).toBeGreaterThan(0);
      expect(lowestSideways).toBeLessThan((-35 * Math.PI) / 180);
      expect(nearestBody).toBeGreaterThan((45 * Math.PI) / 180);
      expect(nearestChest).toBeGreaterThan((45 * Math.PI) / 180);
      // the measure sees the old pickup reach (the left arm 27° above level, straight out) as T-like
      const old = createPose();
      walkPose(0.7, 0.6, old);
      blendPoses(old, reachPose(1, 0.35, createPose()), 1, old, POSE_MASK.arms);
      expect(Math.acos(upperArmDir(old, 1).x)).toBeLessThan((30 * Math.PI) / 180);
   });

   it("writes into `out` and its scratch only (the same objects back, the input pose's other fields kept)", () => {
      const p = createPose();
      const scratch = createPose();
      walkPose(0.4, 0.8, p);
      const before = copyPose(p, createPose());
      expect(pickupPose(p, 0.6, -1, -0.3, 0.6, scratch)).toBe(p);
      expect(Array.from(p.q)).not.toEqual(Array.from(before.q));
   });
});

// Scene.tsx Cleaner's per-frame bookkeeping (notePickup) on a real seeded run: rules.ts createRun +
// step with the runner put next to a piece, as the frame loop runs it (step, then notePickup).
describe("clean-city pickup: the bookkeeping on a real run (pickup.ts notePickup)", () => {
   const IDLE = createStepInput();

   /** Puts the runner at rest at (x, z) facing `heading`, steps one 16 ms frame, and returns run.events.collected. */
   function collectFrom(run: CleanRun, x: number, z: number, heading: number): number {
      const r = run.runner;
      r.x = x;
      r.z = z;
      r.vx = 0;
      r.vz = 0;
      r.heading = heading;
      const got = step(run, 16, IDLE).collected;
      // nothing pushed it (unless the map's 20th parked it on the next start pad): the side is judged from where it was put
      if (!run.events.mapCleared) expect([r.x, r.z, r.heading]).toEqual([x, z, heading]);
      return got;
   }

   it("a piece on the cleaner's left takes its left hand (1), on its right its right hand (-1), judged in its own frame (heading), and the piece read is the slot this step collected (not slot 0)", () => {
      const cases: [dx: number, heading: number, side: 1 | -1][] = [
         [0.4, 0, 1], // facing +z, the piece towards +x = its left
         [-0.4, 0, -1],
         [0.4, Math.PI, -1], // facing -z, the same world +x is its right
         [-0.4, Math.PI, 1],
      ];
      for (const [k, [dx, heading, side]] of cases.entries()) {
         const run = createRun(77);
         const slotIndex = 3 + k;
         const slot = run.litter[slotIndex];
         const mark = createPickupMark();
         const local = { x: 0, z: 0 };
         expect(collectFrom(run, slot.x - dx, slot.z, heading)).toBe(slotIndex);
         notePickup(mark, run, 2.5, false, local);
         expect(mark.side).toBe(side);
         expect([mark.pieceX, mark.pieceZ]).toEqual([slot.x, slot.z]);
         expect([mark.pieceX, mark.pieceZ]).not.toEqual([run.litter[0].x, run.litter[0].z]);
         expect([mark.reachAt, mark.cheerAt, mark.collected, mark.map, mark.won]).toEqual([2.5, -10, 1, 0, false]);
         // the next frame without a pickup keeps the stoop where it started
         expect(step(run, 16, IDLE).collected).toBe(NONE);
         notePickup(mark, run, 2.6, false, local);
         expect([mark.reachAt, mark.side, mark.pieceX, mark.pieceZ]).toEqual([2.5, side, slot.x, slot.z]);
      }
   });

   it("over a whole run: every piece stoops to its own slot, each map's 20th piece cheers instead (reachAt unchanged), and the won end cheers once", () => {
      const run = createRun(4242);
      const mark: PickupMark = createPickupMark();
      const local = { x: 0, z: 0 };
      let t = 1;
      let cheers = 0;
      let stoops = 0;
      for (let map = 0; map < MAP_COUNT; map++) {
         // the slots are picked last first, so the slot index differs from the count and from slot 0
         for (let i = ITEMS_PER_MAP - 1; i >= 0; i--) {
            t += 0.5;
            const slot = run.litter[i];
            const sx = slot.x;
            const sz = slot.z;
            const before = { reachAt: mark.reachAt, cheerAt: mark.cheerAt };
            // put on the piece's side towards the middle (clear of the walls), facing so the piece is on its left
            const s = sx >= 0 ? 1 : -1;
            expect(collectFrom(run, sx - 0.3 * s, sz, s > 0 ? 0 : Math.PI)).toBe(i);
            notePickup(mark, run, t, run.ended === "win", local);
            if (i > 0) {
               stoops++;
               expect([mark.reachAt, mark.cheerAt, mark.side, mark.pieceX, mark.pieceZ]).toEqual([t, before.cheerAt, 1, sx, sz]);
            } else {
               cheers++;
               expect([mark.reachAt, mark.cheerAt]).toEqual([before.reachAt, t]);
               expect(mark.map).toBe(run.map);
            }
         }
      }
      expect(run.ended).toBe("win");
      expect([stoops, cheers, mark.collected, mark.won]).toEqual([57, 3, 60, true]);
      // the won end cheers once: later frames of the over phase keep it
      notePickup(mark, run, t + 1, true, local);
      notePickup(mark, run, t + 2, true, local);
      expect(mark.cheerAt).toBe(t);
   });

   it("a won end seen a frame after its pickup still cheers then, and only then", () => {
      const run = createRun(9);
      const mark = createPickupMark();
      const local = { x: 0, z: 0 };
      mark.reachAt = 3;
      notePickup(mark, run, 4, true, local);
      notePickup(mark, run, 5, true, local);
      expect([mark.cheerAt, mark.reachAt, mark.won]).toEqual([4, 3, true]);
   });
});
