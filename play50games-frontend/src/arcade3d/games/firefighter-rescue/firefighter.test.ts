// The auto-rig on the firefighter (public/models/3d/firefighter-rescue/charFirefighter.glb, 2026-10-28):
// the committed FIREFIGHTER_LANDMARKS match what the heuristics find, his poses keep the feet on the
// floor, the hands clear of the hips and the head (with its helmet) rigid (core/rig/characterChecks.ts),
// his scale draws him 1.82 m tall, and the game's own poses (extinguisher carry, spray, guide, cheer)
// never put a vertex through the floor. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { bodyLift, createPose, walkStride } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, FIREFIGHTER_LANDMARKS, FIREFIGHTER_SCALE, FIT, GLB_SIZE } from "./assets";
import { HOP_H } from "./rules";
import { firefighterPose, type FirefighterPoseState } from "./poses";

describe("firefighter-rescue charFirefighter.glb", () => {
   describeCharacter("firefighter", {
      asset: ASSETS.firefighter,
      landmarks: FIREFIGHTER_LANDMARKS,
      height: GLB_SIZE.charFirefighter.height,
      reach: GLB_SIZE.charFirefighter.width / 2,
      // the head joint 1.4882 + its blend: the face and the helmet above it are rigid
      headFrom: 1.52,
      hipHalfWidth: 0.22,
   });

   describe("on the real mesh", () => {
      let ff: RiggedCharacter;
      beforeAll(async () => {
         ff = await rigCharacter(ASSETS.firefighter);
      });

      it("is drawn 1.82 m tall with his soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = ff.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * FIREFIGHTER_SCALE).toBeCloseTo(FIT.firefighterHeight, 3);
         expect(ASSETS.firefighter.scale).toBe(FIREFIGHTER_SCALE);
      });

      it("the walk's own stride is the one the scene steps the gait by (planted feet): 0.5 to 2 m at a walk and a run", () => {
         for (const amount of [0.4, 1]) {
            const stride = walkStride(amount, FIREFIGHTER_LANDMARKS) * FIREFIGHTER_SCALE;
            expect(stride).toBeGreaterThan(0.5);
            expect(stride).toBeLessThan(2);
         }
      });

      it("every game pose (walk, run, carry, spray, guide, hop, cheer, idle) keeps the whole body above the floor", () => {
         const p = createPose();
         const states: FirefighterPoseState[] = [];
         for (const amount of [0, 0.4, 1]) {
            for (const spray of [false, true]) {
               for (const guide of [false, true]) {
                  for (let k = 0; k < 8; k++) states.push({ phase: (k / 8) * Math.PI * 2, amount, now: k * 0.37, spray, guide, hop: 0, win: false });
               }
            }
         }
         for (const hop of [0.3, 1]) states.push({ phase: 0, amount: 0.6, now: 0.2, spray: true, guide: true, hop, win: false });
         states.push({ phase: 0, amount: 0, now: 0.4, spray: false, guide: false, hop: 0, win: true });
         states.push({ phase: 0, amount: 0, now: 1.1, spray: false, guide: false, hop: 0, win: true });
         for (const s of states) {
            firefighterPose(s, p);
            const world = ff.posed(p, false);
            let low = Infinity;
            for (let i = 1; i < world.length; i += 3) low = Math.min(low, world[i]);
            // a hop's tuck rides on the hop's height (the scene raises the group by run.hero.y = hop x HOP_H)
            const raised = (s.hop * HOP_H) / FIREFIGHTER_SCALE;
            expect(low + bodyLift(p, FIREFIGHTER_LANDMARKS) + raised, JSON.stringify(s)).toBeGreaterThan(-0.01);
         }
      });

      it("never a T-pose: the arms hang or hold the extinguisher in every state", () => {
         const p = createPose();
         for (const spray of [false, true]) {
            firefighterPose({ phase: 1, amount: 0.5, now: 1, spray, guide: true, hop: 0, win: false }, p);
            const world = ff.posed(p);
            // no vertex out at the T-pose's arm reach
            let reach = 0;
            for (let i = 0; i < world.length; i += 3) reach = Math.max(reach, Math.abs(world[i]));
            expect(reach).toBeLessThan(GLB_SIZE.charFirefighter.width / 2 - 0.25);
         }
      });
   });
});
