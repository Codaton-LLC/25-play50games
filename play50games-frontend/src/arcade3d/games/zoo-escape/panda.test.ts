// The panda on the core quadruped rig, on the real mesh (core/rig/quadrupedChecks rigQuadruped): the
// GLB has no skeleton, the rig is built in code from PANDA_LANDMARKS. The checks follow
// describeQuadruped's, at the panda's own gaits (the diagonal walk and the trot, crouched or not; it
// never gallops) and with two mesh facts allowed for: the right front paw rests 1.4 cm above the
// floor in the GLB (Rodin asymmetry), and the tail is a tiny tuft (a few dozen vertices).
import { beforeAll, describe, expect, it } from "vitest";
import { QUAD_LEGS, QBONE } from "@/arcade3d/core/rig/quadruped";
import { rigQuadruped, type RiggedQuadruped } from "@/arcade3d/core/rig/quadrupedChecks";
import { createQuadrupedPose, quadrupedCrouch, quadrupedGait, quadrupedIdle, quadrupedStand, quadrupedStride } from "@/arcade3d/core/rig/quadrupedPoses";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, PANDA_GLB, PANDA_LANDMARKS as L, PANDA_SCALE } from "./assets";
import { PANDA_GAIT, PANDA_GAIT_OPTIONS, pandaGait } from "./pandaGait";
import { PANDA } from "./rules";

let animal: RiggedQuadruped;
beforeAll(async () => {
   animal = await rigQuadruped(ASSETS.panda);
});

const pawLows = (world: Float32Array) =>
   QUAD_LEGS.map((leg) => {
      let low = Infinity;
      for (let i = 0; i < animal.dominant.length; i++) if (animal.dominant[i] === leg.paw) low = Math.min(low, world[i * 3 + 1]);
      return low;
   });
const soles = (world: Float32Array, rest: number[]) =>
   QUAD_LEGS.map((leg, l) => {
      let z = 0, n = 0;
      for (let i = 0; i < animal.dominant.length; i++) {
         if (animal.dominant[i] !== leg.paw || animal.glb.cloud[i * 3 + 1] > rest[l] + 0.03) continue;
         z += world[i * 3 + 2]; n++;
      }
      return z / n;
   });

describe("zoo-escape panda (quadruped rig, real mesh)", () => {
   it("is panda.glb, 1.15 m long, carrying its landmarks", () => {
      expect(PANDA_GLB).toEqual(EXPANSION_GLB_SIZE.panda);
      let h = 0, d = 0;
      const c = animal.glb.cloud;
      for (let i = 0; i < c.length; i += 3) { h = Math.max(h, c[i + 1]); d = Math.max(d, Math.abs(c[i + 2]) * 2); }
      expect(h).toBeCloseTo(PANDA_GLB.height, 2);
      expect(d).toBeCloseTo(PANDA_GLB.depth, 1);
      expect(PANDA_SCALE * PANDA_GLB.depth).toBeCloseTo(1.15, 9);
      expect(ASSETS.panda.scale).toBeCloseTo(PANDA_SCALE, 12);
      expect(ASSETS.panda.quadruped?.landmarks).toBe(L);
   });

   it("every leg bone and the head own vertices; only paws touch the floor; standing is the bind pose", () => {
      const count = new Map<number, number>();
      for (const b of animal.dominant) count.set(b, (count.get(b) ?? 0) + 1);
      for (const leg of QUAD_LEGS) {
         expect(count.get(leg.paw) ?? 0, leg.name).toBeGreaterThanOrEqual(300);
         expect(count.get(leg.upper) ?? 0, leg.name).toBeGreaterThan(20);
         expect(count.get(leg.lower) ?? 0, leg.name).toBeGreaterThan(100);
      }
      expect(count.get(QBONE.head) ?? 0).toBeGreaterThan(2000);
      const c = animal.glb.cloud;
      for (let i = 0; i < animal.dominant.length; i++) {
         if (c[i * 3 + 1] > 0.02) continue;
         expect(QUAD_LEGS.some((leg) => leg.paw === animal.dominant[i] || leg.lower === animal.dominant[i]), `vertex ${i}`).toBe(true);
      }
      const world = animal.posed(quadrupedStand(L, createQuadrupedPose()));
      let worst = 0;
      for (let i = 0; i < world.length; i++) worst = Math.max(worst, Math.abs(world[i] - c[i]));
      expect(worst).toBeLessThan(0.02);
   });

   for (const [name, speed, sneaking] of [["sneak", PANDA.sneak, true], ["slow walk", 1.6, false], ["trot", PANDA.walk, false]] as const) {
      it(`${name}: paws never sink, stance paws stay put while the body travels the stride (no sliding)`, () => {
         const rest = pawLows(animal.posed(quadrupedStand(L, createQuadrupedPose())));
         const { speed01 } = pandaGait(speed, sneaking);
         const stride = quadrupedStride(speed01, L);
         const pose = createQuadrupedPose();
         const planted: Array<Array<{ k: number; z: number }>> = [[], [], [], []];
         const STEPS = 24;
         for (let k = 0; k < STEPS; k++) {
            quadrupedGait((k / STEPS) * Math.PI * 2, speed01, L, pose, 0, PANDA_GAIT_OPTIONS);
            if (sneaking) quadrupedCrouch(PANDA_GAIT.crouch, PANDA_GAIT.dip, L, pose);
            const world = animal.posed(pose);
            const lows = pawLows(world);
            const s = soles(world, rest);
            for (let l = 0; l < 4; l++) {
               expect(lows[l], `${QUAD_LEGS[l].name} at ${k}`).toBeGreaterThan(-0.025);
               if (lows[l] < rest[l] + 0.012) planted[l].push({ k, z: s[l] + (stride * k) / STEPS });
            }
         }
         for (let l = 0; l < 4; l++) {
            expect(planted[l].length, `${QUAD_LEGS[l].name} stance steps`).toBeGreaterThan(6);
            for (let i = 1; i < planted[l].length; i++) {
               if (planted[l][i].k !== planted[l][i - 1].k + 1) continue;
               expect(Math.abs(planted[l][i].z - planted[l][i - 1].z), `${QUAD_LEGS[l].name} slides at ${planted[l][i].k}`).toBeLessThan(0.03 * stride + 0.012);
            }
         }
      });
   }

   it("the crouch lowers the body while sneaking; idle breathes; the mesh stays whole", () => {
      const head = (w: Float32Array) => { let y = 0; for (let i = 0; i < w.length; i += 3) y = Math.max(y, w[i + 1]); return y; };
      const { speed01 } = pandaGait(PANDA.sneak, true);
      const up = animal.posed(quadrupedGait(1, speed01, L, createQuadrupedPose(), 0, PANDA_GAIT_OPTIONS));
      const low = animal.posed(quadrupedCrouch(PANDA_GAIT.crouch, PANDA_GAIT.dip, L, quadrupedGait(1, speed01, L, createQuadrupedPose(), 0, PANDA_GAIT_OPTIONS)));
      expect(head(low)).toBeLessThan(head(up) - 0.06);
      const a = animal.posed(quadrupedIdle(0.9, L, createQuadrupedPose()));
      const b = animal.posed(quadrupedIdle(2.6, L, createQuadrupedPose()));
      let moved = 0;
      for (let i = 0; i < a.length; i++) moved = Math.max(moved, Math.abs(a[i] - b[i]));
      expect(moved).toBeGreaterThan(0.005);
      const c = animal.glb.cloud;
      let reach = 0;
      for (let i = 0; i < c.length; i += 3) reach = Math.max(reach, Math.hypot(c[i], c[i + 1], c[i + 2]));
      for (let i = 0; i < low.length; i += 3) expect(Math.hypot(low[i], low[i + 1], low[i + 2])).toBeLessThan(reach * 1.2);
   });

   it("sneaks at a walk, walks at a trot, and the cadence stays under the cap at every speed (the stride matches the speed)", () => {
      const sneak = { ...pandaGait(PANDA.sneak, true) };
      const walk = { ...pandaGait(PANDA.walk, false) };
      expect(sneak.speed01).toBeLessThanOrEqual(0.3);
      expect(walk.speed01).toBeGreaterThanOrEqual(0.5);
      expect(walk.speed01).toBeLessThan(0.7);
      for (let v = 0.2; v <= PANDA.walk; v += 0.2) for (const s of [true, false]) expect(pandaGait(v, s).hz, `${v} ${s}`).toBeLessThan(PANDA_GAIT.maxHz);
   });
});
