// The baby dino on the core quadruped rig (dinoGait.ts), checked on the real mesh: its committed
// landmarks, every part's bones, planted feet at the walk, the trot and the gallop, idle / sit / leap
// (core/rig/quadrupedChecks.ts rigQuadruped), plus the dino's own speed -> gait mapping and stride math.
import { beforeAll, describe, expect, it } from "vitest";
import { rigQuadruped, type RiggedQuadruped } from "@/arcade3d/core/rig/quadrupedChecks";
import { QBONE, QUAD_LEGS } from "@/arcade3d/core/rig/quadruped";
import { DIAGONAL_WALK, createQuadrupedPose, quadrupedGait, quadrupedGaitMix, quadrupedIdle, quadrupedPhaseStep, quadrupedStand, quadrupedStride } from "@/arcade3d/core/rig/quadrupedPoses";
import { ASSETS } from "./assets";
import { DINO, EGGS } from "./rules";
import { DINO_GAIT, DINO_GAIT_OPTIONS, DINO_GLB, DINO_LANDMARKS as L, DINO_SCALE, dinoGait } from "./dinoGait";

let animal: RiggedQuadruped;
beforeAll(async () => {
   animal = await rigQuadruped(ASSETS.dino);
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

// The panda's checks (zoo-escape panda.test.ts), with one mesh fact allowed for: Rodin left the two
// front feet 1.3 cm (left) and 2.0 cm (right) GLB units above the floor, so "planted" is measured
// against each foot's own rest height.
describe("dino-egg-rescue dino (quadruped rig, real mesh)", () => {
   it("is dino.glb, 1.1 m long, carrying its landmarks", () => {
      let h = 0, d = 0;
      const c = animal.glb.cloud;
      for (let i = 0; i < c.length; i += 3) { h = Math.max(h, c[i + 1]); d = Math.max(d, Math.abs(c[i + 2]) * 2); }
      expect(h).toBeCloseTo(DINO_GLB.height, 2);
      expect(d).toBeCloseTo(DINO_GLB.depth, 1);
      expect(DINO_SCALE * DINO_GLB.depth).toBeCloseTo(1.1, 9);
      expect(ASSETS.dino.quadruped?.landmarks).toBe(L);
   });

   it("every leg bone, the head and the tail own vertices; only feet touch the floor; standing is the bind pose", () => {
      const count = new Map<number, number>();
      for (const b of animal.dominant) count.set(b, (count.get(b) ?? 0) + 1);
      for (const leg of QUAD_LEGS) {
         expect(count.get(leg.paw) ?? 0, leg.name).toBeGreaterThanOrEqual(100);
         expect(count.get(leg.upper) ?? 0, leg.name).toBeGreaterThan(20);
         expect(count.get(leg.lower) ?? 0, leg.name).toBeGreaterThan(20);
      }
      expect(count.get(QBONE.head) ?? 0).toBeGreaterThan(1000);
      for (const t of [QBONE.tail1, QBONE.tail2, QBONE.tail3]) expect(count.get(t) ?? 0).toBeGreaterThan(20);
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

   // mud walk with a full level-5 stack, a jog through mud, a 3-egg walk, the empty-handed run
   for (const [name, speed, minStance] of [["walk", 1.25, 6], ["trot", 2.0, 6], ["3-egg gallop", 3.0, 3], ["gallop", 5.0, 3]] as const) {
      it(`${name} at ${speed} m/s: feet never sink, stance feet stay put while the body travels the stride`, () => {
         const rest = pawLows(animal.posed(quadrupedStand(L, createQuadrupedPose())));
         const { speed01 } = dinoGait(speed);
         const stride = quadrupedStride(speed01, L);
         const pose = createQuadrupedPose();
         const planted: Array<Array<{ k: number; z: number }>> = [[], [], [], []];
         const STEPS = 24;
         for (let k = 0; k < STEPS; k++) {
            quadrupedGait((k / STEPS) * Math.PI * 2, speed01, L, pose, 0, DINO_GAIT_OPTIONS);
            const world = animal.posed(pose);
            const lows = pawLows(world);
            const s = soles(world, rest);
            for (let l = 0; l < 4; l++) {
               expect(lows[l], `${QUAD_LEGS[l].name} at ${k}`).toBeGreaterThan(-0.025);
               if (lows[l] < rest[l] + 0.012) planted[l].push({ k, z: s[l] + (stride * k) / STEPS });
            }
         }
         for (let l = 0; l < 4; l++) {
            expect(planted[l].length, `${QUAD_LEGS[l].name} stance steps`).toBeGreaterThan(minStance);
            for (let i = 1; i < planted[l].length; i++) {
               if (planted[l][i].k !== planted[l][i - 1].k + 1) continue;
               expect(Math.abs(planted[l][i].z - planted[l][i - 1].z), `${QUAD_LEGS[l].name} slides at ${planted[l][i].k}`).toBeLessThan(0.03 * stride + 0.012);
            }
         }
      });
   }

   it("idle breathes and sways the head and tail; the mesh stays whole in every pose", () => {
      const a = animal.posed(quadrupedIdle(0.9, L, createQuadrupedPose()));
      const b = animal.posed(quadrupedIdle(2.6, L, createQuadrupedPose()));
      let moved = 0;
      for (let i = 0; i < a.length; i++) moved = Math.max(moved, Math.abs(a[i] - b[i]));
      expect(moved).toBeGreaterThan(0.005);
      const c = animal.glb.cloud;
      let reach = 0;
      for (let i = 0; i < c.length; i += 3) reach = Math.max(reach, Math.hypot(c[i], c[i + 1], c[i + 2]));
      for (const v of [1.25, 2, 5, 8]) {
         const w = animal.posed(quadrupedGait(1.3, dinoGait(v).speed01, L, createQuadrupedPose(), 0.5, DINO_GAIT_OPTIONS));
         for (let i = 0; i < w.length; i += 3) expect(Math.hypot(w[i], w[i + 1], w[i + 2])).toBeLessThan(reach * 1.2);
      }
   });
});

describe("dino-egg-rescue dino gait math", () => {
   it("is a four-legged walker: the asset carries the landmarks, the walk is the diagonal sequence", () => {
      expect(ASSETS.dino.quadruped?.landmarks).toBe(L);
      expect(DINO_GAIT_OPTIONS.walkOffsets).toBe(DIAGONAL_WALK);
      expect(DINO_SCALE).toBeCloseTo(1.1 / DINO_GLB.depth, 6);
   });

   it("speed01 rises with speed: a walk in deep mud, a trot at a jog, the gallop at the game's walking speeds", () => {
      let last = -1;
      for (let v = 0; v <= 8; v += 0.1) {
         const s = dinoGait(v).speed01;
         expect(s).toBeGreaterThanOrEqual(last - 1e-9);
         last = s;
      }
      expect(dinoGait(0).speed01).toBe(0);
      // 3 eggs in mud at level 5: 5 x 0.5 x 0.5 = 1.25 m/s -> a walk (the core walk ends at 0.3)
      expect(dinoGait(DINO.baseSpeed * 0.5 * 0.5).speed01).toBeLessThan(0.4);
      const mix = quadrupedGaitMix(dinoGait(1.8).speed01, L);
      expect(mix.trot).toBeGreaterThan(0.9);
      // an empty-handed dino at 5 m/s gallops (bounds), a dash too
      expect(quadrupedGaitMix(dinoGait(DINO.baseSpeed).speed01, L).gallop).toBeGreaterThan(0.9);
      expect(dinoGait(DINO.dashSpeed).speed01).toBe(1);
   });

   it("the cadence matches the ground speed below the cap at every walking speed (feet never slide)", () => {
      // walking speeds: every stack x mud combination, levels 1-5
      for (const stack of [...EGGS.stackMultipliers, 0.5]) {
         for (const mud of [1, 0.5]) {
            const v = DINO.baseSpeed * stack * mud;
            const { speed01, hz } = dinoGait(v);
            expect(hz, `v ${v}`).toBeLessThanOrEqual(DINO_GAIT.maxHz);
            // one cycle covers exactly the stride the stance feet sweep: hz x stride = v
            expect(hz * quadrupedStride(speed01, L) * DINO_SCALE).toBeCloseTo(v, 6);
         }
      }
   });

   it("the phase advances by distance / stride (core quadrupedPhaseStep), capped only on a dash", () => {
      const dt = 1 / 60;
      for (const v of [1.25, 2.5, 3, 4.25, 5]) {
         const { speed01 } = dinoGait(v);
         const step = quadrupedPhaseStep(0, v * dt, speed01, L, DINO_SCALE, dt, DINO_GAIT.maxHz);
         expect(step).toBeCloseTo((2 * Math.PI * v * dt) / (quadrupedStride(speed01, L) * DINO_SCALE), 6);
      }
      const dash = dinoGait(DINO.dashSpeed);
      const capped = quadrupedPhaseStep(0, DINO.dashSpeed * dt, dash.speed01, L, DINO_SCALE, dt, DINO_GAIT.maxHz);
      expect(capped).toBeCloseTo(2 * Math.PI * DINO_GAIT.maxHz * dt, 6);
   });

   it("never moves all four legs together: at a walk and a trot two feet are planted at every phase", () => {
      const pose = createQuadrupedPose();
      for (const v of [1.0, 2.0]) {
         const s = dinoGait(v).speed01;
         const mix = quadrupedGaitMix(s, L, DINO_GAIT_OPTIONS.walkOffsets);
         for (let i = 0; i < 48; i++) {
            const f = i / 48;
            quadrupedGait(f * 2 * Math.PI, s, L, pose, 0, DINO_GAIT_OPTIONS);
            let planted = 0;
            for (let l = 0; l < QUAD_LEGS.length; l++) {
               const c = (((f - mix.offsets[l]) % 1) + 1) % 1;
               if (c < mix.duty) planted++;
            }
            expect(planted, `v ${v} f ${f}`).toBeGreaterThanOrEqual(2);
            expect(planted).toBeLessThan(4 + 1);
         }
         // diagonal pairs: front-left lands with (or just after) hind-right, never with front-right
         const [fl, fr, hl, hr] = mix.offsets;
         const gap = (a: number, b: number) => Math.min(Math.abs(a - b) % 1, 1 - (Math.abs(a - b) % 1));
         expect(gap(fl, fr)).toBeGreaterThan(0.3);
         expect(gap(hl, hr)).toBeGreaterThan(0.3);
      }
   });
});
