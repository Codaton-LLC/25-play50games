// The five Color Roll Heroes' own GLBs on the real meshes: listed, one height when drawn, feet on the
// ground, facing +z (the head over +z, the tail toward -z), and each auto-rigs cleanly with the shared joints.
import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { HERO_GLB, HERO_HEIGHT_M, HERO_LANDMARKS, HERO_SCALE, M2_HERO_IDS, heroModelAsset, heroUrl } from "./heroModels";

describe("the five hero models", () => {
   it("lists exactly five heroes, each its own GLB (never the old m2Hero1-3 or m2ArmadilloHero)", () => {
      expect(M2_HERO_IDS).toEqual(["riko", "nami", "kiro", "zuno", "vexa"]);
      expect(new Set(M2_HERO_IDS.map(heroUrl)).size).toBe(5);
      for (const id of M2_HERO_IDS) {
         expect(hasModel(heroUrl(id)), id).toBe(true);
         expect(heroUrl(id)).toMatch(/m2Hero(Riko|Nami|Kiro|Zuno|Vexa)\.glb$/);
         expect(heroModelAsset(id).scale).toBe(HERO_SCALE[id]);
         expect(heroModelAsset(id).humanoid?.landmarks).toBe(HERO_LANDMARKS[id]);
      }
      for (const old of ["m2Hero1", "m2Hero2", "m2Hero3", "m2ArmadilloHero"]) expect(hasModel(`/models/3d/menu2/${old}.glb`)).toBe(false);
   });

   for (const id of M2_HERO_IDS) {
      it(`${id}: the real mesh is ${HERO_HEIGHT_M} m tall when drawn, stands on y = 0, centred, and faces +z`, async () => {
         const { cloud, indices } = await readCharacterGlb(heroUrl(id));
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i++) {
            const a = i % 3;
            min[a] = Math.min(min[a], cloud[i]);
            max[a] = Math.max(max[a], cloud[i]);
         }
         expect(min[1]).toBeCloseTo(0, 3);
         expect(max[1]).toBeCloseTo(HERO_GLB[id].height, 6);
         expect(max[1] * HERO_SCALE[id]).toBeCloseTo(HERO_HEIGHT_M, 6);
         expect(max[0]).toBeCloseTo(HERO_GLB[id].reach, 6);
         expect(max[2]).toBeCloseTo(HERO_GLB[id].depth, 5);
         expect((min[0] + max[0]) / 2).toBeCloseTo(0, 3);
         expect((min[2] + max[2]) / 2).toBeCloseTo(0, 3);
         expect(indices.length / 3).toBe(20000);
         // the head (the top 15 %) sits over +z: the hero faces +z
         let z = 0;
         let n = 0;
         for (let i = 0; i < cloud.length; i += 3) {
            if (cloud[i + 1] > max[1] * 0.85) {
               z += cloud[i + 2];
               n++;
            }
         }
         expect(z / n).toBeGreaterThan(0.2);
      });
   }
});

for (const id of M2_HERO_IDS) {
   describe(`rig of ${id}`, () => {
      describeCharacter(HERO_GLB[id].name, {
         asset: heroModelAsset(id),
         landmarks: HERO_LANDMARKS[id],
         height: HERO_GLB[id].height,
         reach: HERO_GLB[id].reach,
         estimate: {
            explicit: {
               wristX: 0.6, crotchY: 0.58, hipY: 0.64, hipX: 0.22, hipZ: 0.42, kneeY: 0.4, ankleY: 0.2, ankleBlend: 0.03,
               legDepth: 0.12, legOuterX: 0.34, hemY: 0.3, hipBlend: 0.04, headY: 1.36, neckY: 1.3, neckBlend: 0.02,
            },
         },
         // Kiro's shoulder plates stand up past 1.38, so the rigid-head check starts above them
         headFrom: id === "kiro" ? 1.52 : 1.38,
         hipHalfWidth: 0.2,
      });
   });
}
