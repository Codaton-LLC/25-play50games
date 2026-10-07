// The auto-rig on the real keeper (public/models/3d/penalty-hero/keeper.glb, v2): the measured
// KEEPER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the gloves
// clear of the shorts and the head rigid (core/rig/characterChecks.ts). A new keeper.glb must be
// re-measured. Then its ready stance's weight shift on the same mesh (nothing below the grass, the
// legs never cross) and its dives as the scene draws them (nothing below the grass).
import { beforeAll, describe, expect, it } from "vitest";
import { blendPoses, createPose } from "@/arcade3d/core/rig/poses";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { bodyLift } from "@/arcade3d/core/rig/gait";
import { ASSETS, KEEPER_LANDMARKS } from "./assets";
import { KEEPER_BOUNCE, KEEPER_HIP, KEEPER_SWAY, keeperDivePlacement } from "./layout";
import { keeperDivePose, keeperReadyPose } from "./poses";

describe("penalty-hero keeper.glb", () => {
   describeCharacter("keeper", {
      asset: ASSETS.keeper,
      landmarks: KEEPER_LANDMARKS,
      height: 1.8155,
      reach: 0.947,
      estimate: {
         // the knee is set behind the lower kneecap (the estimate takes half the hip height, 0.399);
         // the shorts' inner sides part at their hem (0.59), which the estimate reads as a skirt's;
         // the ankle blend is narrowed to keep the boots rigid
         tolerance: { kneeY: 0.09, hemY: 0.14, ankleBlend: 0.03 },
      },
      headFrom: 1.52,
      hipHalfWidth: 0.24,
   });
});

describe("penalty-hero keeper's weight shift and dives on keeper.glb", () => {
   let keeper: RiggedCharacter;
   beforeAll(async () => {
      keeper = await rigCharacter(ASSETS.keeper);
   });

   it("at the sway's ends and with the knees' deepest dip: nothing below the grass once lifted, and the legs stay apart (the inner boot never crosses the middle of the stance)", () => {
      const l = KEEPER_LANDMARKS;
      const rest = keeper.glb.cloud;
      const p = createPose();
      for (const sway of [-KEEPER_SWAY.glb, 0, KEEPER_SWAY.glb]) {
         for (const dip of [0, KEEPER_BOUNCE.glb]) {
            const shift = sway / ASSETS.keeper.scale;
            keeperReadyPose(0.7, p, shift, dip);
            const world = keeper.posed(p, false);
            const lift = bodyLift(p, l);
            let low = Infinity;
            // per leg (rest x side, below the crotch): its innermost x relative to the stance's middle
            let innerL = Infinity;
            let innerR = -Infinity;
            for (let i = 0; i < rest.length / 3; i++) {
               low = Math.min(low, world[i * 3 + 1] + lift);
               if (rest[i * 3 + 1] > l.kneeY) continue;
               // the stance's middle stays where it stood: the hips moved by `shift` over it
               const x = world[i * 3] + shift;
               if (rest[i * 3] > 0) innerL = Math.min(innerL, x);
               else innerR = Math.max(innerR, x);
            }
            expect(low, `sway ${sway} dip ${dip}`).toBeGreaterThan(-0.005);
            expect(innerL, `sway ${sway} dip ${dip}`).toBeGreaterThan(0.02);
            expect(innerR, `sway ${sway} dip ${dip}`).toBeLessThan(-0.02);
         }
      }
   });

   it("through every dive (the six zones, from the ready stance to the full dive, the sway's ends and the knees' dip): nothing below the grass, drawn as Scene.tsx draws it", () => {
      const scale = ASSETS.keeper.scale;
      const p = createPose();
      const dive = createPose();
      const place = { x: 0, y: 0, roll: 0 };
      let worst = Infinity;
      let where = "";
      for (const [side, row] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 0], [0, 1]] as const) {
         for (let k = 0; k <= 10; k++) {
            const d = k / 10;
            for (const [sway, dip] of [[-KEEPER_SWAY.glb, 0], [KEEPER_SWAY.glb, 0], [0, KEEPER_BOUNCE.glb]]) {
               // Scene.tsx Keeper: the ready stance (its weight shift faded by the dive) blended into the dive
               keeperReadyPose(0.7, p, (sway * (1 - d)) / scale, dip);
               if (d > 0.001) blendPoses(p, keeperDivePose(side, row, dive), d, p);
               // <HumanoidModel> lifts the hips (applyLift); its group is scaled, rolled about the
               // pivot KEEPER_HIP and placed (the sway moves it along x only)
               const world = keeper.posed(p);
               keeperDivePlacement(d, side, row, true, place);
               const c = Math.cos(place.roll);
               const s = Math.sin(place.roll);
               let low = Infinity;
               for (let i = 0; i < world.length / 3; i++) {
                  const x = world[i * 3] * scale;
                  const y = world[i * 3 + 1] * scale - KEEPER_HIP;
                  low = Math.min(low, x * s + y * c + KEEPER_HIP + place.y);
               }
               if (low < worst) {
                  worst = low;
                  where = `side ${side} row ${row} dive ${d} sway ${sway} dip ${dip}`;
               }
            }
         }
      }
      expect(worst, where).toBeGreaterThan(-0.005);
   }, 30_000);
});
