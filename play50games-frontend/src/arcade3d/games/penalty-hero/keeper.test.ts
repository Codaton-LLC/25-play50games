// The auto-rig on the real keeper (public/models/3d/penalty-hero/keeper.glb, v2): the measured
// KEEPER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the gloves
// clear of the shorts and the head rigid (core/rig/characterChecks.ts). A new keeper.glb must be
// re-measured. Then its ready stance's weight shift on the same mesh (nothing below the grass, the
// legs never cross) and its dives as the scene draws them (nothing below the grass).
import { beforeAll, describe, expect, it } from "vitest";
import { blendPoses, createPose } from "@/arcade3d/core/rig/poses";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { bodyLift } from "@/arcade3d/core/rig/gait";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
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

   it("its scale draws it 1.85 m tall, the first GLB's height (the v2 GLB's 1.89 longest side is the arm span, not the height)", async () => {
      const glb = await readCharacterGlb(ASSETS.keeper.url);
      let top = 0;
      let reach = 0;
      for (let i = 0; i < glb.cloud.length; i += 3) {
         top = Math.max(top, glb.cloud[i + 1]);
         reach = Math.max(reach, Math.abs(glb.cloud[i]));
      }
      expect(2 * reach).toBeGreaterThan(top);
      expect(top * (ASSETS.keeper.scale ?? 1)).toBeCloseTo(1.85, 2);
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

   it("the beard stays on the chin: no edge of the face and beard (the middle of the head from the collar up) stretches more than 1.5x in the ready stance over a breath or through any dive", () => {
      // the head joint (headY 1.494) is inside the beard (rest y 1.41-1.52 at the front): a full
      // head turn tore the beard off the face (2.8x in a side dive, 2.3x in the ready stance)
      const rest = keeper.glb.cloud;
      const idx = keeper.glb.indices;
      const n = rest.length / 3;
      const near = (i: number) => rest[i * 3 + 1] > 1.36 && rest[i * 3 + 1] < 1.7 && Math.abs(rest[i * 3]) < 0.13;
      const edges: number[] = [];
      const seen = new Set<number>();
      for (let t = 0; t < idx.length; t += 3) {
         for (let e = 0; e < 3; e++) {
            const a = Math.min(idx[t + e], idx[t + ((e + 1) % 3)]);
            const b = Math.max(idx[t + e], idx[t + ((e + 1) % 3)]);
            if (seen.has(a * n + b) || !near(a) || !near(b)) continue;
            seen.add(a * n + b);
            const length = Math.hypot(rest[a * 3] - rest[b * 3], rest[a * 3 + 1] - rest[b * 3 + 1], rest[a * 3 + 2] - rest[b * 3 + 2]);
            if (length > 1e-4) edges.push(a, b, length);
         }
      }
      // the chin's front (the beard) is among the edges
      expect(edges.length).toBeGreaterThan(1000);
      const stretch = (world: Float32Array) => {
         let most = 0;
         for (let i = 0; i < edges.length; i += 3) {
            const a = edges[i];
            const b = edges[i + 1];
            const d = Math.hypot(world[a * 3] - world[b * 3], world[a * 3 + 1] - world[b * 3 + 1], world[a * 3 + 2] - world[b * 3 + 2]);
            most = Math.max(most, d / edges[i + 2]);
         }
         return most;
      };
      const p = createPose();
      const dive = createPose();
      let worst = 0;
      let where = "";
      for (const t of [0, 0.7, 1.3, 2.2, 3.1, 4.4]) {
         const s = stretch(keeper.posed(keeperReadyPose(t, p)));
         if (s > worst) [worst, where] = [s, `ready t ${t}`];
      }
      for (const [side, row] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [0, 0], [0, 1]] as const) {
         for (const d of [0.25, 0.5, 0.75, 1]) {
            // Scene.tsx Keeper: the ready stance blended into the dive
            keeperReadyPose(0.7, p);
            blendPoses(p, keeperDivePose(side, row, dive), d, p);
            const s = stretch(keeper.posed(p));
            if (s > worst) [worst, where] = [s, `side ${side} row ${row} dive ${d}`];
         }
      }
      expect(worst, where).toBeLessThan(1.5);
   }, 30_000);
});
