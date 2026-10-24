// The chef's poses on the real chef.glb (core/rig characterChecks rigCharacter, CPU skinning like the
// vertex shader): the reach-and-throw reads over the wheel's back arc — the posed right hand passes
// within 15 cm of the back-slot ring and never dips into the wheel disc — the blend never swings the
// hands out through the T-pose, and the soles stay on the floor in the idle, the reach and the cheer.
import { beforeAll, describe, expect, it } from "vitest";
import { createPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { CHEF_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { BACK_SLOT_RING, chefPose, CHEF_POS, CHEF_YAW, type ChefLook } from "./poses";

const SCALE = ASSETS.chef.scale ?? 1;
/** 1 cm in GLB units at the chef's scale */
const CM = 0.01 / SCALE;
const L = CHEF_LANDMARKS;

describe("monster-kitchen chef poses (poses.ts) on chef.glb", () => {
   let chef: RiggedCharacter;
   beforeAll(async () => {
      chef = await rigCharacter(ASSETS.chef);
   });

   const scratch = [createPose(), createPose(), createPose()] as const;
   const build = (look: ChefLook, now: number) => {
      const p = createPose();
      chefPose(look, now, p, scratch[0], scratch[1], scratch[2]);
      return p;
   };
   const posed = (throwK: number, cheer: number, now: number) =>
      chef.posed(build({ throwK, cheer }, now), true);

   /** The right-hand vertices' centroid, world metres (the Scene's group: scaled, turned, placed). */
   function handWorld(world: Float32Array): { x: number; y: number; z: number } {
      const rest = chef.glb.cloud;
      let x = 0;
      let y = 0;
      let z = 0;
      let n = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         if (rest[i * 3] > -L.wristX) continue; // x < 0 is the right arm
         x += world[i * 3];
         y += world[i * 3 + 1];
         z += world[i * 3 + 2];
         n++;
      }
      expect(n).toBeGreaterThan(100);
      x = (x / n) * SCALE;
      y = (y / n) * SCALE;
      z = (z / n) * SCALE;
      const c = Math.cos(CHEF_YAW);
      const s = Math.sin(CHEF_YAW);
      return { x: CHEF_POS.x + x * c + z * s, y: CHEF_POS.y + y, z: CHEF_POS.z - x * s + z * c };
   }

   it("the reach at its peak passes within 15 cm of the wheel's back-slot ring", () => {
      let best = Infinity;
      for (let k = 0.3; k <= 0.5; k += 0.01) {
         const hand = handWorld(posed(k, 0, 1.2));
         best = Math.min(best, Math.hypot(hand.x - BACK_SLOT_RING.x, hand.y - BACK_SLOT_RING.y, hand.z - BACK_SLOT_RING.z));
      }
      expect(best).toBeLessThan(0.15);
   });

   it("the reach never dips into the wheel disc (r 0.95, y 0.875..0.925 at (-2, 0.9, 0))", () => {
      for (let k = 0; k <= 1.0001; k += 0.04) {
         const hand = handWorld(posed(Math.min(1, k), 0, 1.2));
         const dh = Math.hypot(hand.x - BACK_SLOT_RING.x, hand.z - BACK_SLOT_RING.z);
         const clear = Math.max(dh - 0.95, Math.abs(hand.y - 0.9) - 0.025);
         expect(clear, `k ${k.toFixed(2)} at (${hand.x.toFixed(2)}, ${hand.y.toFixed(2)}, ${hand.z.toFixed(2)})`).toBeGreaterThan(0.03);
      }
   });

   it("blends the throw and the cheer in without ever swinging the hands out through the T reach (the hands stay within 0.8 of the middle; the T reach is 0.95)", () => {
      const rest = chef.glb.cloud;
      let top = 0;
      for (let k = 0; k <= 1.0001; k += 0.04) {
         for (const cheer of [0, 1]) {
            const world = chef.posed(build({ throwK: Math.min(1, k), cheer }, 1.2), false);
            for (let i = 0; i < rest.length / 3; i++) {
               if (Math.abs(rest[i * 3]) <= L.wristX) continue;
               top = Math.max(top, Math.abs(world[i * 3]));
            }
         }
      }
      expect(top).toBeLessThan(0.8);
   });

   it("keeps the soles within 1 cm of the floor in the idle, the reach and the cheer", () => {
      for (const [name, throwK, cheer] of [
         ["idle", -1, 0],
         ["reach", 0.45, 0],
         ["throw", 1, 0],
         ["cheer", -1, 1],
      ] as const) {
         const world = posed(throwK, cheer, 1.2);
         let low = Infinity;
         for (let i = 0; i < world.length / 3; i++) low = Math.min(low, world[i * 3 + 1]);
         expect(low * SCALE, name).toBeGreaterThan(-CM * SCALE);
         expect(low * SCALE, name).toBeLessThan(CM * SCALE);
      }
   });
});
