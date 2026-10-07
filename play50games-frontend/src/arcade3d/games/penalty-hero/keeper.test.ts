// The auto-rig on the real keeper (public/models/3d/penalty-hero/keeper.glb): the measured
// KEEPER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the gloves
// clear of the shorts and the head rigid (core/rig/characterChecks.ts). A new keeper.glb must be
// re-measured. Then its ready stance's weight shift on the same mesh: nothing below the grass, the
// legs never cross.
import { beforeAll, describe, expect, it } from "vitest";
import { createPose } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { bodyLift } from "@/arcade3d/core/rig/gait";
import { ASSETS, KEEPER_LANDMARKS } from "./assets";
import { KEEPER_SWAY, KEEPER_BOUNCE } from "./layout";
import { keeperReadyPose } from "./poses";

describe("penalty-hero keeper.glb", () => {
   describeCharacter("keeper", {
      asset: ASSETS.keeper,
      landmarks: KEEPER_LANDMARKS,
      height: 1.89,
      reach: 0.932,
      estimate: {
         // the arm band is widened by hand to the raglan sleeves; the shorts' inner sides read as a hem
         // (0.662); the ankle blend is narrowed to keep the boots rigid
         tolerance: { armRadius: 0.035, hemY: 0.15, ankleBlend: 0.03 },
      },
      headFrom: 1.58,
      hipHalfWidth: 0.24,
   });
});

describe("penalty-hero keeper's weight shift on keeper.glb", () => {
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
});
