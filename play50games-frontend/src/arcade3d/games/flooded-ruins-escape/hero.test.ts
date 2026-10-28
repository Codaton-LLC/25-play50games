// The auto-rig on the Sky Tower hero (public/models/3d/menu2/m2HeroRiko.glb, 2026-10-25): the measured
// RIKO_LANDMARKS match the seeded estimate, the poses keep the feet on the floor and the hands clear
// of the hips, and the helmet and snout stay rigid (core/rig/characterChecks.ts). Drawn 1.45 m, the
// stand-in's height. The tail is not a limb: its tip is weighted to the hips and the spine. A new
// m2HeroRiko.glb must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { BONE, computeSkinWeights } from "@/arcade3d/core/rig/humanoid";
import { armsDownPose, createPose, walkStride } from "@/arcade3d/core/rig";
import { createHeroMotion, heroStride } from "@/arcade3d/menu2/heroAnim";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, RIKO_GLB_HEIGHT, RIKO_LANDMARKS, RIKO_SCALE } from "./assets";
import { airRing, createHeroAnim, createMotionMemo, groundUnder, writeHeroMotion } from "./Hero";
import { AIR_MS, V_RUN, createRun, createStepInput, step, surfaceAt } from "./rules";

const L = RIKO_LANDMARKS;

describe("flooded-ruins-escape m2HeroRiko.glb", () => {
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

   it("runs on the shared animator's stride: about five strides a second at V_RUN (the walk's own stride would buzz)", () => {
      const own = walkStride(1, L) * RIKO_SCALE;
      expect(V_RUN / own).toBeGreaterThan(7);
      const cadence = V_RUN / (heroStride(1, L) * RIKO_SCALE);
      expect(cadence).toBeGreaterThan(4);
      expect(cadence).toBeLessThan(6);
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

describe("flooded-ruins-escape m2HeroRiko.glb: the arms", () => {
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

describe("flooded-ruins-escape: the run -> the animator's motion", () => {
   it("velocity, grounded and the power from the run; one-frame events from the Scene's stamps, once each; the cheer only at the gate", () => {
      const run = createRun(1, 1, "nami");
      const anim = createHeroAnim();
      const m = createHeroMotion();
      const memo = createMotionMemo();
      run.hero.vx = 3;
      writeHeroMotion(m, memo, run, anim, 0);
      expect(m.vx).toBe(3);
      expect(m.grounded).toBe(true);
      expect(m.power).toBeNull();
      expect(m.rolling).toBe(false);
      expect(m.celebrating).toBe(false);
      anim.jumpAt = 1;
      writeHeroMotion(m, memo, run, anim, 1);
      expect(m.events.jumped).toBe(true);
      m.events.jumped = false;
      writeHeroMotion(m, memo, run, anim, 1.1);
      expect(m.events.jumped).toBe(false);
      anim.landAt = 2;
      writeHeroMotion(m, memo, run, anim, 2);
      expect(m.events.landed).toBe(true);
      anim.winAt = 3;
      writeHeroMotion(m, memo, run, anim, 3.5);
      expect(m.celebrating).toBe(true);
   });

   it("a swimmer paddles (the ground cycle, no fall), Riko's dash and the intro's drop are the ball, a loss on the spot is a hit", () => {
      const run = createRun(1, 1, "nami");
      Object.assign(run.hero, { grounded: false, swim: true, support: -1, vx: 2, vz: -1 });
      const m = createHeroMotion();
      writeHeroMotion(m, createMotionMemo(), run, createHeroAnim(), 0);
      expect(m.grounded).toBe(true);
      expect(m.vy).toBe(0);
      expect(m.rolling).toBe(false);
      const intro = createHeroAnim();
      intro.intro = 0.4;
      writeHeroMotion(m, createMotionMemo(), createRun(1, 1), intro, 0);
      expect(m.rolling).toBe(true);
      expect(m.grounded).toBe(false);
      const riko = createRun(1, 1, "riko");
      const input = createStepInput();
      input.actionPressed = true;
      input.moveZ = -1;
      step(riko, 20, input);
      writeHeroMotion(m, createMotionMemo(), riko, createHeroAnim(), 0);
      expect(m.power).toBe("dash");
      expect(m.rolling).toBe(true);
      expect(Math.hypot(m.vx, m.vz)).toBeGreaterThan(V_RUN);
      const hit = createHeroAnim();
      const memo = createMotionMemo();
      writeHeroMotion(m, memo, createRun(1, 1), hit, 0);
      hit.lostAt = 1;
      writeHeroMotion(m, memo, createRun(1, 1), hit, 1);
      expect(m.events.hurt).toBe(true);
   });

   it("the air ring: hidden on land with a full meter, shown with the head under water, its fill the meter's", () => {
      const run = createRun(1, 1, "nami");
      expect(airRing(run).show).toBe(false);
      expect(airRing(run).fill).toBe(1);
      run.hero.air = AIR_MS / 4;
      expect(airRing(run).show).toBe(true);
      expect(airRing(run).fill).toBeCloseTo(0.25, 9);
      // a lost hero shows no ring
      run.hero.state = "lost";
      expect(airRing(run).show).toBe(false);
   });

   it("the shadow sits on the block under the hero, or on the chamber's water when it is higher", () => {
      const run = createRun(1, 1, "nami");
      const h = run.hero;
      expect(groundUnder(run, h.x, h.z, h.y, 0)).toBeCloseTo(h.y, 9);
      // over a chamber whose water is up, the surface (when under the feet) wins over its floor
      const course = run.course;
      for (let zi = 0; zi < course.zones.length; zi++) {
         const z = course.zones[zi];
         const x = (z.minX + z.maxX) / 2;
         const zz = (z.minZ + z.maxZ) / 2;
         const surface = surfaceAt(course, run.water, x, zz, 0);
         if (!Number.isFinite(surface)) continue;
         expect(groundUnder(run, x, zz, surface + 5, 0)).toBeGreaterThanOrEqual(surface - 1e-9);
      }
   });
});
