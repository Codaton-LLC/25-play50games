// Shared checks for a real animal GLB and its committed quadruped landmarks (vitest only; the app
// never imports this file). A game test calls describeQuadruped(): the GLB is read and
// meshopt-decoded without a loader (robotGlb.ts), rigged with the committed landmarks like
// <QuadrupedModel> does, and posed on the CPU like the vertex shader.
import { beforeAll, describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from "three";
import type { ModelAsset } from "../types";
import { QBONE, QUAD_LEGS, quadrupedJoints, type QuadrupedLandmarks } from "./quadruped";
import { createQuadrupedPose, quadrupedGait, quadrupedIdle, quadrupedLeap, quadrupedSit, quadrupedStand, quadrupedStride, type QuadrupedPose } from "./quadrupedPoses";
import { readCharacterGlb, type CharacterGlb } from "./robotGlb";
import { applyQuadrupedPose, buildQuadrupedTemplate, cloneQuadruped, type QuadrupedRig } from "./quadrupedSkinning";

export interface RiggedQuadruped {
   glb: CharacterGlb;
   rig: QuadrupedRig;
   skin: SkinnedMesh;
   /** every vertex in `pose`, skinned on the CPU (GLB root space, before the asset's scale) */
   posed(pose: QuadrupedPose): Float32Array;
   /** the dominant bone of each vertex */
   dominant: Uint16Array;
   /** each vertex's weight on the stash bone (folded-away stray parts) */
   stashed: Float32Array;
}

/** Reads `asset`'s GLB (from public/) and rigs it like <QuadrupedModel>. Call it in a beforeAll. */
export async function rigQuadruped(asset: ModelAsset): Promise<RiggedQuadruped> {
   const glb = await readCharacterGlb(asset.url);
   const root = new Group();
   const holder = new Group();
   holder.position.fromArray(glb.node);
   const geometry = new BufferGeometry();
   const position = new BufferAttribute(glb.local, 3);
   geometry.setAttribute("position", position);
   holder.add(new Mesh(geometry, new MeshBasicMaterial()));
   root.add(holder);
   const rig = cloneQuadruped(buildQuadrupedTemplate(root, asset.quadruped!.landmarks)!);
   const skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
   const weights = skin.geometry.getAttribute("skinWeight");
   const indices = skin.geometry.getAttribute("skinIndex");
   const dominant = new Uint16Array(position.count);
   const stashed = new Float32Array(position.count);
   for (let i = 0; i < position.count; i++) {
      for (let k = 0; k < 4; k++) if (indices.getComponent(i, k) === QBONE.stash) stashed[i] += weights.getComponent(i, k);
      let best = 0;
      for (let k = 1; k < 4; k++) if (weights.getComponent(i, k) > weights.getComponent(i, best)) best = k;
      dominant[i] = indices.getComponent(i, best);
   }
   const v = new Vector3();
   return {
      glb,
      rig,
      skin,
      dominant,
      stashed,
      posed(pose: QuadrupedPose): Float32Array {
         applyQuadrupedPose(rig, pose);
         rig.root.updateMatrixWorld(true);
         const world = new Float32Array(glb.cloud.length);
         for (let i = 0; i < position.count; i++) skin.applyBoneTransform(i, v.fromBufferAttribute(position, i)).applyMatrix4(skin.matrixWorld).toArray(world, i * 3);
         return world;
      },
   };
}

export interface QuadrupedSpec {
   asset: ModelAsset;
   landmarks: QuadrupedLandmarks;
   /** the GLB's bounds the landmarks were measured on */
   size: { width: number; height: number; depth: number };
   /** vertex count per leg's paw (dominant bone) at least this */
   minPawVertices: number;
}

const STEPS = 24;

/** Registers the checks of one animal on its real mesh (inside the caller's describe). */
export function describeQuadruped(name: string, spec: QuadrupedSpec): void {
   let animal: RiggedQuadruped;
   const L = spec.landmarks;
   beforeAll(async () => {
      animal = await rigQuadruped(spec.asset);
   });

   /** the lowest posed y of each paw (vertices whose dominant bone is that paw), QUAD_LEGS order */
   const pawLows = (world: Float32Array) =>
      QUAD_LEGS.map((leg) => {
         let low = Infinity;
         for (let i = 0; i < animal.dominant.length; i++) if (animal.dominant[i] === leg.paw) low = Math.min(low, world[i * 3 + 1]);
         return low;
      });
   /** the mean posed (x, z) of each paw's sole (rest y below 0.03) */
   const soles = (world: Float32Array) =>
      QUAD_LEGS.map((leg) => {
         let x = 0;
         let z = 0;
         let n = 0;
         for (let i = 0; i < animal.dominant.length; i++) {
            if (animal.dominant[i] !== leg.paw || animal.glb.cloud[i * 3 + 1] > 0.03) continue;
            x += world[i * 3];
            z += world[i * 3 + 2];
            n++;
         }
         return { x: x / n, z: z / n };
      });

   describe(name, () => {
      it("is the mesh the landmarks were measured on, and the asset carries them", () => {
         let w = 0;
         let h = 0;
         let d = 0;
         const c = animal.glb.cloud;
         for (let i = 0; i < c.length; i += 3) {
            w = Math.max(w, Math.abs(c[i]) * 2);
            h = Math.max(h, c[i + 1]);
            d = Math.max(d, Math.abs(c[i + 2]) * 2);
         }
         expect(w).toBeCloseTo(spec.size.width, 1);
         expect(h).toBeCloseTo(spec.size.height, 2);
         expect(d).toBeCloseTo(spec.size.depth, 1);
         expect(spec.asset.quadruped?.landmarks).toBe(L);
      });

      it("every paw, the head and the tail own vertices; the paws are the lowest part of the mesh", () => {
         const count = new Map<number, number>();
         for (const b of animal.dominant) count.set(b, (count.get(b) ?? 0) + 1);
         for (const leg of QUAD_LEGS) {
            expect(count.get(leg.paw) ?? 0, leg.name).toBeGreaterThanOrEqual(spec.minPawVertices);
            expect(count.get(leg.upper) ?? 0, leg.name).toBeGreaterThan(20);
            expect(count.get(leg.lower) ?? 0, leg.name).toBeGreaterThan(20);
         }
         expect(count.get(QBONE.head) ?? 0).toBeGreaterThan(500);
         for (const t of [QBONE.tail1, QBONE.tail2, QBONE.tail3]) expect(count.get(t) ?? 0).toBeGreaterThan(20);
         // nothing but paws (and the folded stray) touches the floor at rest
         const c = animal.glb.cloud;
         for (let i = 0; i < animal.dominant.length; i++) {
            if (c[i * 3 + 1] > 0.02) continue;
            const b = animal.dominant[i];
            const paw = QUAD_LEGS.some((leg) => leg.paw === b || leg.lower === b);
            expect(paw || b === QBONE.stash, `vertex ${i} on the floor belongs to bone ${b}`).toBe(true);
         }
      });

      it("standing: the bind pose, paws on the floor", () => {
         const world = animal.posed(quadrupedStand(L, createQuadrupedPose()));
         const c = animal.glb.cloud;
         let worst = 0;
         for (let i = 0; i < animal.dominant.length; i++) {
            if (animal.stashed[i] > 0) continue;
            for (let a = 0; a < 3; a++) worst = Math.max(worst, Math.abs(world[i * 3 + a] - c[i * 3 + a]));
         }
         expect(worst).toBeLessThan(0.02);
      });

      it("the stray parts fold away: their vertices shrink to the stash point inside the body", () => {
         const world = animal.posed(quadrupedStand(L, createQuadrupedPose()));
         const j = quadrupedJoints(L);
         const s = QBONE.stash * 3;
         for (let i = 0; i < animal.dominant.length; i++) {
            if (animal.stashed[i] < 0.999) continue;
            expect(Math.hypot(world[i * 3] - j[s], world[i * 3 + 1] - j[s + 1], world[i * 3 + 2] - j[s + 2])).toBeLessThan(0.01);
         }
      });

      for (const [gait, speed] of [
         ["walk", 0.2],
         ["trot", 0.6],
         ["gallop", 1],
      ] as const) {
         it(`${gait}: paws never sink below the floor, stance paws touch it and stay put while the body travels the stride`, () => {
            const pose = createQuadrupedPose();
            const stride = quadrupedStride(speed, L);
            const planted: Array<Array<{ k: number; z: number; x: number }>> = [[], [], [], []];
            for (let k = 0; k < STEPS; k++) {
               const phase = (k / STEPS) * Math.PI * 2;
               const world = animal.posed(quadrupedGait(phase, speed, L, pose));
               const lows = pawLows(world);
               const s = soles(world);
               // the body has travelled stride * k / STEPS: a paw's ground point = its model point + that
               const travelled = (stride * k) / STEPS;
               for (let l = 0; l < 4; l++) {
                  expect(lows[l], `${QUAD_LEGS[l].name} at step ${k}`).toBeGreaterThan(-0.025);
                  if (lows[l] < 0.012) planted[l].push({ k, z: s[l].z + travelled, x: s[l].x });
               }
            }
            for (let l = 0; l < 4; l++) {
               expect(planted[l].length, `${QUAD_LEGS[l].name} stance steps`).toBeGreaterThan(gait === "gallop" ? 3 : 6);
               // consecutive planted steps of one stance: the sole keeps its ground point
               for (let i = 1; i < planted[l].length; i++) {
                  if (planted[l][i].k !== planted[l][i - 1].k + 1) continue;
                  expect(Math.abs(planted[l][i].z - planted[l][i - 1].z), `${QUAD_LEGS[l].name} slides at step ${planted[l][i].k}`).toBeLessThan(0.03 * stride + 0.012);
                  expect(Math.abs(planted[l][i].x - planted[l][i - 1].x)).toBeLessThan(0.01);
               }
            }
         });
      }

      it("idle, sit and leap keep the mesh whole (no vertex flies off) and sit keeps the paws down", () => {
         const pose = createQuadrupedPose();
         const c = animal.glb.cloud;
         let reach = 0;
         for (let i = 0; i < c.length; i += 3) reach = Math.max(reach, Math.hypot(c[i], c[i + 1], c[i + 2]));
         for (const p of [quadrupedIdle(2.3, L, pose), quadrupedSit(1, 1, L, createQuadrupedPose()), quadrupedLeap(0.1, L, createQuadrupedPose()), quadrupedLeap(0.5, L, createQuadrupedPose()), quadrupedLeap(0.95, L, createQuadrupedPose())]) {
            const world = animal.posed(p);
            for (let i = 0; i < world.length; i += 3) expect(Math.hypot(world[i], world[i + 1], world[i + 2])).toBeLessThan(reach * 1.25);
         }
         const sit = animal.posed(quadrupedSit(1, 1, L, createQuadrupedPose()));
         for (const low of pawLows(sit)) expect(Math.abs(low)).toBeLessThan(0.03);
      });
   });
}
