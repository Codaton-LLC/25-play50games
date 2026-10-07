// The auto-rig on the real chef (public/models/3d/food-catcher/chef.glb): the measured
// CHEF_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the hands
// clear of the apron and the toque rigid, and the apron hangs between the stepping legs
// (core/rig/characterChecks.ts). A new chef.glb must be re-measured. Then the game's own chef
// (poses.ts) on the same mesh: the catch's reach never swings the arms out through the T-pose, the
// dash's lean keeps the feet out of the floor, and the walk's stride and cadence.
import { beforeAll, describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { BONE, createPose, walkStride } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { bodyLift } from "@/arcade3d/core/rig/gait";
import { ASSETS, CHEF_LANDMARKS } from "./assets";
import {
   CHEF_MAX_CADENCE,
   CHEF_SCALE,
   CHEF_TURN_SPEED,
   REACH_S,
   chefPose,
   chefRootRoll,
   createChefGait,
   stepChefGait,
   type ChefGait,
} from "./poses";
import { CHEF } from "./rules";

describe("food-catcher chef.glb", () => {
   describeCharacter("chef", {
      asset: ASSETS.chef,
      landmarks: CHEF_LANDMARKS,
      height: 1.898,
      reach: 0.897,
      estimate: {
         // the apron's hem: its decimated middle hides the lower bands from the estimate's bridge count (0.633 for 0.53)
         tolerance: { hemY: 0.12 },
      },
      headFrom: 1.46,
      hipHalfWidth: 0.235,
      // the apron: from its hem to the crotch, in front of the thighs (the legs' front is at about z 0.09)
      apron: { hemY: 0.53, topY: 0.75, frontZ: 0.12 },
   });
});

/** The chef's gait as Scene.tsx holds it at a steady state. */
function gaitAt(amount: number, phase: number, yaw: number, lean: number): ChefGait {
   return Object.assign(createChefGait(), { amount, phase, yaw, lean });
}

/** Runs stepChefGait at a constant speed long enough for the eased amount, yaw and lean to settle. */
function settle(v: number, dt = 1 / 60): ChefGait {
   const gait = createChefGait();
   for (let i = 0; i < 240; i++) stepChefGait(gait, v, dt);
   return gait;
}

describe("food-catcher chef (poses.ts) on chef.glb", () => {
   let chef: RiggedCharacter;
   beforeAll(async () => {
      chef = await rigCharacter(ASSETS.chef);
   });

   /** The hands' widest reach from the body's middle (|x| in the chef's own frame) and the lowest vertex once lifted. */
   function measure(world: Float32Array, lift: number): { hands: number; low: number } {
      const rest = chef.glb.cloud;
      let hands = 0;
      let low = Infinity;
      for (let i = 0; i < rest.length / 3; i++) {
         low = Math.min(low, world[i * 3 + 1] + lift);
         if (Math.abs(rest[i * 3]) > CHEF_LANDMARKS.wristX) hands = Math.max(hands, Math.abs(world[i * 3]));
      }
      return { hands, low };
   }

   const STILL = { amount: 0, yaw: 0, lean: 0 };
   const WALK = { amount: 0.5, yaw: Math.PI / 2, lean: 0.03 * 3.75 };
   const DASH = { amount: 1, yaw: -Math.PI / 2, lean: -0.03 * CHEF.maxSpeed };
   const PHASES = [0, 1.6, 3.1, 4.7];

   it("a catch reaches up and down again without swinging the arms out through the T-pose: the hands stay within 0.5 of the middle (the T reach is 0.897), still, walking or dashing", () => {
      const out = createPose();
      const scratch = createPose();
      for (const [name, base] of [
         ["still", STILL],
         ["walk", WALK],
         ["dash", DASH],
      ] as const) {
         for (const phase of base === STILL ? [0] : PHASES) {
            for (const t of base === STILL ? [0.3, 1.7] : [1]) {
               let top = 0;
               for (let s = 0; s <= 24; s++) {
                  const gait = gaitAt(base.amount, phase, base.yaw, base.lean);
                  chefPose(gait, t, (s / 24) * REACH_S, out, scratch);
                  const { hands } = measure(chef.posed(out, false), 0);
                  expect(hands, `${name} phase ${phase} t ${t} k ${s}/24`).toBeLessThan(0.5);
                  top = Math.max(top, hands);
               }
               // ...and the reach does go up: the hands come off the hanging arms' sides
               expect(top).toBeGreaterThan(0.3);
            }
         }
      }
   });

   it("at the reach's peak the forearms are up in front of the chest (the hands above the shoulders' height)", () => {
      const out = createPose();
      const scratch = createPose();
      chefPose(gaitAt(0, 0, 0, 0), 1, REACH_S / 2, out, scratch);
      const world = chef.posed(out, false);
      const rest = chef.glb.cloud;
      let handY = -Infinity;
      for (let i = 0; i < rest.length / 3; i++) if (Math.abs(rest[i * 3]) > CHEF_LANDMARKS.wristX) handY = Math.max(handY, world[i * 3 + 1]);
      expect(handY).toBeGreaterThan(CHEF_LANDMARKS.shoulderY);
   });

   it("dashing at 9 m/s (turned to face the way it runs, its spine leaning into the speed), walking and still: nothing below the floor once lifted", () => {
      const out = createPose();
      const scratch = createPose();
      for (const v of [9, -9, 3.75, 0.6]) {
         const settled = settle(v);
         for (const phase of [0, 0.8, 1.6, 2.4, 3.1, 3.9, 4.7, 5.5]) {
            const gait = gaitAt(settled.amount, phase, settled.yaw, settled.lean);
            chefPose(gait, 1, -1, out, scratch);
            expect(gait.lift).toBeCloseTo(bodyLift(out, CHEF_LANDMARKS) * CHEF_SCALE, 9);
            const { low } = measure(chef.posed(out, false), bodyLift(out, CHEF_LANDMARKS));
            expect(low, `v ${v} phase ${phase}`).toBeGreaterThan(-0.005);
         }
      }
   });

   it("leans into the speed in the spine, never about the feet: the GLB's root roll is 0 (the stand-in keeps its own)", () => {
      const dash = settle(9);
      expect(dash.lean).toBeCloseTo(0.03 * 9, 3);
      expect(Math.abs(dash.yaw - Math.PI / 2)).toBeLessThan(0.01);
      expect(settle(-9).lean).toBeCloseTo(-0.03 * 9, 3);
      expect(chefRootRoll(9, true)).toBe(0);
      expect(chefRootRoll(9, false)).toBeCloseTo(-0.27, 9);
      // the spine's top tips towards the world's +x: forward when turned to face it, to its own left (+x) facing the camera
      const scratch = createPose();
      const up = (yaw: number, lean: number) => {
         const p = chefPose(gaitAt(1, 1, yaw, lean), 1, -1, createPose(), scratch);
         const o = BONE.spine * 4;
         return new Vector3(0, 1, 0).applyQuaternion(new Quaternion(p.q[o], p.q[o + 1], p.q[o + 2], p.q[o + 3]));
      };
      const forward = up(Math.PI / 2, 0.27).sub(up(Math.PI / 2, 0));
      expect(forward.z).toBeGreaterThan(0.2);
      expect(Math.abs(forward.x)).toBeLessThan(0.03);
      const side = up(0, 0.27).sub(up(0, 0));
      expect(side.x).toBeGreaterThan(0.2);
      expect(Math.abs(side.z)).toBeLessThan(0.03);
   });
});

describe("food-catcher chef gait (stepChefGait)", () => {
   const TAU = Math.PI * 2;
   /** The stride (m) the phase implies at a constant speed, and the strides a second. */
   function strideAt(v: number): { stride: number; cadence: number; gait: ChefGait } {
      const dt = 1 / 60;
      const gait = settle(v, dt);
      const before = gait.phase;
      stepChefGait(gait, v, dt);
      const step = (gait.phase - before + TAU) % TAU;
      return { stride: (v * dt * TAU) / step, cadence: step / TAU / dt, gait };
   }

   it("standing still the phase does not advance", () => {
      const gait = settle(0);
      const before = gait.phase;
      stepChefGait(gait, 0, 1 / 60);
      expect(gait.phase).toBe(before);
      expect(gait.amount).toBeLessThan(1e-6);
   });

   it("at walking speeds (up to 4 m/s) the stride is the walk's own, so the planted foot stays put", () => {
      for (const v of [0.6, 1.5, 2.5, 3.5, 4]) {
         const { stride, gait } = strideAt(v);
         expect(stride, `v ${v}`).toBeCloseTo(walkStride(gait.amount, CHEF_LANDMARKS) * CHEF_SCALE, 6);
      }
   });

   it("at the 9 m/s dash the legs beat at most CHEF_MAX_CADENCE (4) strides a second", () => {
      expect(CHEF_MAX_CADENCE).toBe(4);
      for (const v of [6, CHEF.maxSpeed, -CHEF.maxSpeed]) {
         const { cadence } = strideAt(Math.abs(v));
         expect(cadence).toBeLessThanOrEqual(CHEF_MAX_CADENCE + 1e-9);
         expect(cadence).toBeGreaterThan(CHEF_MAX_CADENCE - 0.01);
      }
   });

   it("turns to face the way it runs above CHEF_TURN_SPEED, back to the camera below it", () => {
      expect(settle(CHEF_TURN_SPEED * 2).yaw).toBeCloseTo(Math.PI / 2, 3);
      expect(settle(-CHEF_TURN_SPEED * 2).yaw).toBeCloseTo(-Math.PI / 2, 3);
      expect(settle(CHEF_TURN_SPEED * 0.5).yaw).toBeCloseTo(0, 6);
   });
});
