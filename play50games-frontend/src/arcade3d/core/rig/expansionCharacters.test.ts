// The auto-rig on the expansion batch 2-3 characters (sharedAssets EXPANSION_CHARACTERS, 2026-10-08):
// each GLB's committed landmarks match what the heuristics find (or the documented tolerance for a
// field set by eye), its poses keep the feet on the floor, the hands clear of the body and the head
// (with its helmet, hat or antennae) rigid (characterChecks.ts), and the default fit draws it at its
// target height on the real mesh. A new GLB must be re-measured.
import { describe, expect, it } from "vitest";
import { hasModel } from "../modelManifest";
import {
   ALIEN_LANDMARKS,
   ASTRONAUT_LANDMARKS,
   EXPANSION_CHARACTER_GLB_HEIGHT,
   EXPANSION_CHARACTER_HEIGHT,
   EXPANSION_CHARACTERS,
   KNIGHT_LANDMARKS,
   SNOW_KID_LANDMARKS,
   ZOO_KEEPER_LANDMARKS,
   type ExpansionCharacterId,
} from "../sharedAssets";
import type { HumanoidLandmarks } from "./humanoid";
import { describeCharacter, rigCharacter } from "./characterChecks";
import { armsDownPose, createPose } from "./poses";
import { readCharacterGlb } from "./robotGlb";

const C = EXPANSION_CHARACTERS;
const LANDMARKS: Record<ExpansionCharacterId, HumanoidLandmarks> = {
   knight: KNIGHT_LANDMARKS,
   snowKid: SNOW_KID_LANDMARKS,
   astronaut: ASTRONAUT_LANDMARKS,
   alien: ALIEN_LANDMARKS,
   keeper: ZOO_KEEPER_LANDMARKS,
};
const lm = (id: ExpansionCharacterId) => LANDMARKS[id];
const IDS = Object.keys(C) as ExpansionCharacterId[];

describe("expansion characters: assets", () => {
   it("every character is listed, humanoid with a full committed landmark set, within the character budget", () => {
      expect(IDS).toHaveLength(5);
      for (const id of IDS) {
         expect(hasModel(C[id].url), C[id].url).toBe(true);
         expect(C[id].rigged).toBeFalsy();
         expect(C[id].humanoid?.landmarks, id).toBe(lm(id));
         expect(Object.keys(lm(id)).length, id).toBe(32);
         expect(C[id].budget.tris).toBe(20000);
      }
   });

   it("the default fit draws each one at its target height on the real mesh (knight 1.75, snow kid 1.30, astronaut 1.75, alien 1.10, keeper 1.75 m), feet on y = 0", async () => {
      for (const id of IDS) {
         const { cloud, indices } = await readCharacterGlb(C[id].url);
         let top = -Infinity;
         let low = Infinity;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(top, id).toBeCloseTo(EXPANSION_CHARACTER_GLB_HEIGHT[id], 3);
         expect(Math.abs(low), id).toBeLessThan(1e-4);
         expect(top * (C[id].scale ?? 1), id).toBeCloseTo(EXPANSION_CHARACTER_HEIGHT[id], 3);
         expect(indices.length / 3, `${id} tris`).toBeLessThanOrEqual(20000);
      }
   });
});

describe("shared knight.glb", () => {
   describeCharacter("knight", {
      asset: C.knight,
      landmarks: lm("knight"),
      height: 1.884,
      reach: 0.9488,
      estimate: { tolerance: { armRadius: 0.08 } },
      headFrom: lm("knight").headY + lm("knight").neckBlend + 0.005,
      hipHalfWidth: 0.27,
   });
});

describe("snowball-battle snowKid.glb", () => {
   describeCharacter("snowKid", {
      asset: C.snowKid,
      landmarks: lm("snowKid"),
      height: 1.9011,
      reach: 0.9428,
      estimate: { tolerance: { armRadius: 0.04, hemY: 0.13 } },
      headFrom: lm("snowKid").headY + lm("snowKid").neckBlend + 0.005,
      hipHalfWidth: 0.27,
   });
});

describe("space-repair astronaut.glb", () => {
   describeCharacter("astronaut", {
      asset: C.astronaut,
      landmarks: lm("astronaut"),
      height: 1.8231,
      reach: 0.9446,
      estimate: { tolerance: { armRadius: 0.04, hemY: 0.12 } },
      headFrom: lm("astronaut").headY + lm("astronaut").neckBlend + 0.005,
      hipHalfWidth: 0.285,
   });
});

describe("alien-farm alien.glb", () => {
   describeCharacter("alien", {
      asset: C.alien,
      landmarks: lm("alien"),
      height: 1.8902,
      reach: 0.9278,
      estimate: { tolerance: { armRadius: 0.04, hemY: 0.09 } },
      headFrom: lm("alien").headY + lm("alien").neckBlend + 0.005,
      hipHalfWidth: 0.3,
   });
});

describe("zoo-escape keeper.glb", () => {
   describeCharacter("keeper", {
      asset: C.keeper,
      landmarks: lm("keeper"),
      height: 1.8921,
      reach: 0.9511,
      estimate: { tolerance: { armRadius: 0.05, hemY: 0.19 } },
      headFrom: lm("keeper").headY + lm("keeper").neckBlend + 0.005,
      hipHalfWidth: 0.28,
   });
});

describe("expansion characters: the sleeves, pauldrons and puffy arms hang with the arms", () => {
   it("with the arms down every vertex between the chest and the neck 6 cm or more outside the shoulder joint moves with the arm (over 3 cm): no sleeve or pauldron stays out as a fin", async () => {
      for (const id of IDS) {
         const L = lm(id);
         const character = await rigCharacter(C[id]);
         const rest = character.glb.cloud;
         const world = character.posed(armsDownPose(createPose()));
         let fins = 0;
         let worst = Infinity;
         for (let i = 0; i < rest.length; i += 3) {
            if (Math.abs(rest[i]) < L.shoulderX + 0.06 || rest[i + 1] < L.chestY || rest[i + 1] > L.neckY) continue;
            const moved = Math.hypot(world[i] - rest[i], world[i + 1] - rest[i + 1], world[i + 2] - rest[i + 2]);
            worst = Math.min(worst, moved);
            if (moved < 0.03) fins++;
         }
         expect(fins, `${id}: least moved ${worst.toFixed(3)}`).toBe(0);
      }
   }, 60000);
});
