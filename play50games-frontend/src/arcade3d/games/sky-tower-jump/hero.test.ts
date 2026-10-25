// The auto-rig on the Sky Tower hero (public/models/3d/menu2/m2HeroRiko.glb, 2026-10-25): the measured
// RIKO_LANDMARKS match the seeded estimate, the poses keep the feet on the floor and the hands clear
// of the hips, and the helmet and snout stay rigid (core/rig/characterChecks.ts). Drawn 1.45 m, the
// stand-in's height. The tail is not a limb: its tip is weighted to the hips and the spine. A new
// m2HeroRiko.glb must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { BONE, computeSkinWeights } from "@/arcade3d/core/rig/humanoid";
import { armsDownPose, createPose, gaitPhaseStep, walkStride } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, RIKO_GLB_HEIGHT, RIKO_LANDMARKS, RIKO_SCALE } from "./assets";
import { HERO_CADENCE } from "./Hero";
import { V_RUN } from "./rules";

const L = RIKO_LANDMARKS;

describe("sky-tower-jump m2HeroRiko.glb", () => {
   describeCharacter("Riko", {
      asset: ASSETS.hero,
      landmarks: L,
      height: RIKO_GLB_HEIGHT,
      reach: 0.7524892687797546,
      estimate: {
         // set by eye (assets.ts): the tail hides the crotch, the shins are in front of it, the head
         // joint is under the snout, and the small paws need a slightly nearer wrist
         explicit: {
            wristX: 0.6,
            crotchY: 0.58,
            hipY: 0.64,
            hipX: 0.22,
            hipZ: 0.42,
            kneeY: 0.4,
            ankleY: 0.2,
            ankleBlend: 0.03,
            legDepth: 0.12,
            legOuterX: 0.34,
            hemY: 0.3,
            hipBlend: 0.04,
            headY: 1.36,
            neckY: 1.3,
            neckBlend: 0.02,
         },
      },
      // headY + neckBlend: the helmet, face and snout above the collar stay one piece
      headFrom: 1.38,
      // the hips are narrow; the hanging paws stay outside them
      hipHalfWidth: 0.2,
   });

   it("caps a full run at 5 strides a second (the own stride would buzz at 8)", () => {
      const own = walkStride(1, L) * RIKO_SCALE;
      expect(own).toBeGreaterThan(0.7);
      expect(own).toBeLessThan(V_RUN / HERO_CADENCE);
      const step = gaitPhaseStep(1, L, RIKO_SCALE, V_RUN, 1, HERO_CADENCE);
      expect(step).toBeCloseTo(HERO_CADENCE * Math.PI * 2, 6);
   });

   it("its scale draws it 1.45 m tall, feet on y = 0", async () => {
      expect(ASSETS.hero.scale).toBe(RIKO_SCALE);
      expect(ASSETS.hero.url).toBe("/models/3d/menu2/m2HeroRiko.glb");
      expect(ASSETS.hero.humanoid?.landmarks).toBe(L);
      expect(RIKO_GLB_HEIGHT * RIKO_SCALE).toBeCloseTo(1.45, 6);
      const { cloud } = await readCharacterGlb(ASSETS.hero.url);
      let top = -Infinity;
      let low = Infinity;
      for (let i = 1; i < cloud.length; i += 3) {
         top = Math.max(top, cloud[i]);
         low = Math.min(low, cloud[i]);
      }
      expect(low).toBeCloseTo(0, 3);
      expect(top * RIKO_SCALE).toBeCloseTo(1.45, 3);
   });

   it("weights the tail tip to the hips and the spine, and leaves the shins on the legs", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.hero.url);
      const w = computeSkinWeights(cloud, L);
      const n = cloud.length / 3;
      const share = (pred: (x: number, y: number, z: number) => boolean) => {
         let count = 0;
         let trunk = 0;
         let legs = 0;
         let heavyTrunk = 0;
         for (let i = 0; i < n; i++) {
            const x = cloud[i * 3];
            const y = cloud[i * 3 + 1];
            const z = cloud[i * 3 + 2];
            if (!pred(x, y, z)) continue;
            count++;
            let best = 0;
            let bestW = -1;
            for (let k = 0; k < 4; k++) {
               const weight = w.skinWeight[i * 4 + k];
               const bone = w.skinIndex[i * 4 + k];
               if (bone === BONE.hips || bone === BONE.spine || bone === BONE.chest) trunk += weight;
               if (bone >= BONE.upperLegL && bone <= BONE.footR) legs += weight;
               if (weight > bestW) {
                  bestW = weight;
                  best = bone;
               }
            }
            if (best === BONE.hips || best === BONE.spine || best === BONE.chest) heavyTrunk++;
         }
         return { count, trunk: trunk / count, legs: legs / count, heavyTrunk: heavyTrunk / count };
      };
      const tip = share((x, y, z) => z < -0.6 && Math.abs(x) < 0.32 && y < 0.75);
      expect(tip.count).toBeGreaterThan(200);
      expect(tip.trunk).toBeGreaterThan(0.6);
      expect(tip.heavyTrunk).toBeGreaterThan(0.85);
      const shin = share((x, y, z) => z > 0.28 && y > 0.22 && y < 0.42 && Math.abs(x) > 0.1 && Math.abs(x) < 0.4);
      expect(shin.count).toBeGreaterThan(500);
      expect(shin.legs).toBeGreaterThan(0.9);
   });
});

describe("sky-tower-jump m2HeroRiko.glb: the arms", () => {
   let hero: RiggedCharacter;
   beforeAll(async () => {
      hero = await rigCharacter(ASSETS.hero);
   });

   it("with the arms down, nothing from the chest to the collar sticks out past the hanging arm (the plates come down with it)", () => {
      const world = hero.posed(armsDownPose(createPose()));
      let widest = 0;
      for (let i = 0; i < world.length; i += 3) {
         const y = world[i + 1];
         if (y > L.chestY && y < L.headY) widest = Math.max(widest, Math.abs(world[i]));
      }
      // the T-pose reach is 0.75; a hanging arm stays in under half of that
      expect(widest).toBeLessThan(0.55);
   });
});
