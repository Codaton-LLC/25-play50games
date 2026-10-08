// The explorer on the real runner.glb (core/rig characterChecks rigCharacter, CPU skinning like the
// vertex shader): drawn 1.556 m tall; soles on the floor in the walk, the dig and the cheer; the hat
// anchor rides the head; the dig blend never swings the arms out through the T-pose; the walk's
// cadence cap does not bite at top speed (the planted foot stays put).
import { beforeAll, describe, expect, it } from "vitest";
import { Vector3, type Group } from "three";
import { bodyLift, createAnchorGroup, createPose, walkStride, type HumanoidPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, EXPLORER_SCALE } from "./assets";
import { MAX_CADENCE, RUN_AMOUNT, digPose, explorerPose, explorerPhaseStep, gaitAmount, type ExplorerLook } from "./poses";
import { EXPLORER } from "./rules";

/** 1 cm in GLB units at the explorer's scale */
const CM = 0.01 / EXPLORER_SCALE;
const L = RUNNER_LANDMARKS;

describe("treasure-island explorer on runner.glb", () => {
   let runner: RiggedCharacter;
   let hat: Group;
   let headIds: number[];

   beforeAll(async () => {
      runner = await rigCharacter(ASSETS.explorer);
      hat = createAnchorGroup(runner.rig, "head", [EXPLORER_SCALE, EXPLORER_SCALE, EXPLORER_SCALE]);
      runner.rig.bones[runner.rig.anchors.head.bone].add(hat);
      const c = runner.glb.cloud;
      const a = runner.rig.anchors.head;
      headIds = Array.from({ length: c.length / 3 }, (_, i) => i)
         .sort((i, j) => Math.hypot(c[i * 3] - a.x, c[i * 3 + 1] - a.y, c[i * 3 + 2] - a.z) - Math.hypot(c[j * 3] - a.x, c[j * 3 + 1] - a.y, c[j * 3 + 2] - a.z))
         .slice(0, 12);
   }, 30_000);

   const look = (amount: number, phase: number, dig: number, cheer: number): ExplorerLook => ({ amount, phase, dig, cheer });
   const scratch = [createPose(), createPose()] as const;
   const posed = (l: ExplorerLook, now: number): HumanoidPose => explorerPose(l, now, createPose(), scratch[0], scratch[1]);

   /** Everything the explorer does in play: walk and run phases, a dig blending in and held, the cheer. */
   function poses(): Array<[string, HumanoidPose]> {
      const list: Array<[string, HumanoidPose]> = [];
      for (let k = 0; k < 8; k++) {
         const phase = (k / 8) * Math.PI * 2;
         list.push([`walk ${k}`, posed(look(0.45, phase, 0, 0), k * 0.3)], [`run ${k}`, posed(look(RUN_AMOUNT, phase, 0, 0), k * 0.3)]);
      }
      for (let w = 0; w <= 12; w++) list.push([`dig ${w}/12`, posed(look(0, 0, w / 12, 0), 1 + w * 0.07)]);
      for (let t = 0; t < 0.4; t += 0.05) list.push([`dig held ${t.toFixed(2)}`, posed(look(0, 0, 1, 0), t)]);
      for (const t of [0, 0.3, 0.7, 1.1]) list.push([`cheer ${t}`, posed(look(0, 0, 0, 1), t)]);
      return list;
   }

   it("is drawn 1.556 m tall (the head anchor, the top of the head)", () => {
      expect(runner.rig.anchors.head.y * EXPLORER_SCALE).toBeCloseTo(1.556, 2);
   });

   it("keeps the lower sole on the floor within 1 cm in the walk, the dig and the cheer; the run's flight never goes through it", () => {
      for (const [name, pose] of poses()) {
         // posed(pose, true) raises the hips by bodyLift, as the Scene's group does (applyLift false)
         const world = runner.posed(pose, true);
         let low = Infinity;
         for (let i = 0; i < world.length / 3; i++) low = Math.min(low, world[i * 3 + 1]);
         expect(low, name).toBeGreaterThan(-CM);
         if (!name.startsWith("run")) expect(low, name).toBeLessThan(CM);
         else expect(bodyLift(pose, L), name).toBeLessThan(0.1);
      }
   });

   it("keeps the hat on the head within 1 cm through everything", () => {
      const c = runner.glb.cloud;
      const a = runner.rig.anchors.head;
      const rest = headIds.map((i) => Math.hypot(c[i * 3] - a.x, c[i * 3 + 1] - a.y, c[i * 3 + 2] - a.z));
      const at = new Vector3();
      let worst = 0;
      for (const [, pose] of poses()) {
         const world = runner.posed(pose);
         hat.getWorldPosition(at);
         headIds.forEach((i, k) => {
            const d = Math.hypot(world[i * 3] - at.x, world[i * 3 + 1] - at.y, world[i * 3 + 2] - at.z);
            worst = Math.max(worst, Math.abs(d - rest[k]));
         });
      }
      expect(worst).toBeLessThan(CM);
   });

   it("blends the dig in without swinging the arms out through the T-pose: the hands stay within 0.5 of the middle (the T reach is 0.95)", () => {
      const rest = runner.glb.cloud;
      let top = 0;
      for (const amount of [0, 0.3]) {
         for (let w = 0; w <= 24; w++) {
            for (const now of [0, 0.1, 0.2, 0.3]) {
               const world = runner.posed(posed(look(amount, 1, w / 24, 0), now), false);
               for (let i = 0; i < rest.length / 3; i++) if (Math.abs(rest[i * 3]) > L.wristX) top = Math.max(top, Math.abs(world[i * 3]));
            }
         }
      }
      expect(top).toBeLessThan(0.5);
   });

   it("digs: the hands reach down in front of the toes at mid-scoop and stay below the hips through it", () => {
      const rest = runner.glb.cloud;
      const hands = (t: number) => {
         const world = runner.posed(digPose(t, createPose()), true);
         let y = 0;
         let z = 0;
         let n = 0;
         for (let i = 0; i < rest.length / 3; i++) {
            if (Math.abs(rest[i * 3]) <= L.wristX) continue;
            y += world[i * 3 + 1];
            z += world[i * 3 + 2];
            n++;
         }
         return { y: y / n, z: z / n };
      };
      expect(hands(0).z).toBeGreaterThan(L.toeZ + 0.05);
      for (let t = 0; t < 0.4; t += 0.05) {
         expect(hands(t).y).toBeLessThan(L.hipY - 0.1);
         expect(hands(t).z).toBeGreaterThan(L.toeZ - 0.1);
      }
   });

   it("walks at the walk's own stride up to top speed: the cadence cap does not bite at 5 m/s", () => {
      const stride = walkStride(RUN_AMOUNT, L) * EXPLORER_SCALE;
      expect(stride * MAX_CADENCE).toBeGreaterThanOrEqual(EXPLORER.maxSpeed);
      // one stride of distance advances the phase by exactly one cycle, at every speed up to the top
      for (const v of [1, 2.5, 4, 5]) {
         const amount = gaitAmount(v);
         const own = walkStride(amount, L) * EXPLORER_SCALE;
         expect(explorerPhaseStep(amount, v, own / v)).toBeCloseTo(Math.PI * 2, 6);
      }
      expect(explorerPhaseStep(0, 0, 0.1)).toBe(0);
   });
});
