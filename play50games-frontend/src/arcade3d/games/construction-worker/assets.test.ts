// The worker on the reused cleaner.glb (orange hi-vis vest): 1.556 m, soles on the floor within 1 cm,
// and the yellow hard hat on his head: on the head bone through every pose, its dome over the crown.
// The rig here is in GLB units (rigCharacter draws no scale), so metres are / WORKER_SCALE.
import { beforeAll, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { bodyLift, createAnchorGroup, createPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CLEANER_LANDMARKS, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, MIXER_GLB, MIXER_HEIGHT, MIXER_SPOTS, WORKER_GLB_HEIGHT, WORKER_HAT, WORKER_HEIGHT, WORKER_LANDMARKS, WORKER_SCALE } from "./assets";
import { inWorkArea } from "./looks";
import { workerPose } from "./poses";
import { PILE_A, PILE_R, SLOT_A, SLOT_R } from "./rules";

const CM = 0.01 / WORKER_SCALE;
/** Primitives' hard hat (createHardHat, metres at scale 1): the dome's centre height and radius. */
const DOME_Y = 0.02;
const DOME_R = 0.12;

describe("construction-worker character", () => {
   let worker: RiggedCharacter;
   let hat: Group;
   let domeCentre: Group;

   beforeAll(async () => {
      worker = await rigCharacter(ASSETS.worker);
      hat = createAnchorGroup(worker.rig, "head", [WORKER_SCALE, WORKER_SCALE, WORKER_SCALE]);
      worker.rig.bones[worker.rig.anchors.head.bone].add(hat);
      // the hat mesh's transform as Site.tsx mounts it, and its dome's centre inside it
      const mesh = new Group();
      mesh.position.set(0, WORKER_HAT.y, WORKER_HAT.z);
      mesh.scale.setScalar(WORKER_HAT.scale);
      hat.add(mesh);
      domeCentre = new Group();
      domeCentre.position.set(0, DOME_Y, 0);
      mesh.add(domeCentre);
   }, 30_000);

   const poses = () => [
      ["idle", workerPose(false, 0, false, 0.4, createPose())],
      ["point", workerPose(true, 0, false, 0.4, createPose())],
      ["cheer", workerPose(false, 1, false, 0.6, createPose())],
   ] as const;

   it("is clean-city's cleaner GLB with its measured landmarks, drawn 1.556 m tall like the runner before", () => {
      expect(ASSETS.worker.url).toBe(REUSED_ASSETS.cleaner.url);
      expect(ASSETS.worker.url).toBe("/models/3d/clean-city/cleaner.glb");
      expect(ASSETS.worker.humanoid?.landmarks).toBe(CLEANER_LANDMARKS);
      expect(WORKER_LANDMARKS).toBe(CLEANER_LANDMARKS);
      expect(worker.rig.anchors.head.y).toBeCloseTo(WORKER_GLB_HEIGHT, 3);
      expect(worker.rig.anchors.head.y * WORKER_SCALE).toBeCloseTo(WORKER_HEIGHT, 3);
      expect(WORKER_HEIGHT).toBe(1.556);
   });

   it("keeps the lower sole on the floor within 1 cm (bodyLift on the cleaner's landmarks)", () => {
      for (const [name, pose] of poses()) {
         // Site.tsx lifts the group by bodyLift x scale (applyLift false); posed(pose, true) is the same
         const world = worker.posed(pose, true);
         let low = Infinity;
         for (let i = 0; i < world.length; i += 3) low = Math.min(low, world[i + 1]);
         expect(low, name).toBeGreaterThan(-CM);
         expect(low, name).toBeLessThan(CM);
         expect(bodyLift(pose, WORKER_LANDMARKS), name).toBeGreaterThan(-0.02);
      }
   });

   it("never a T-pose: the hands hang well below the shoulders standing and pointing", () => {
      for (const [name, pose] of poses().slice(0, 2)) {
         const world = worker.posed(pose, true);
         let wide = 0;
         for (let i = 0; i < world.length; i += 3) wide = Math.max(wide, Math.abs(world[i]));
         // the T-pose span is 0.95 a side; arms down (or one aimed at the crane) stay far inside it
         expect(wide, name).toBeLessThan(0.8 * CLEANER_LANDMARKS.wristX);
      }
   });

   it("keeps the hat on the head bone within 1 cm across poses", () => {
      const at = new Vector3();
      const boneAt = new Vector3();
      const bone = worker.rig.bones[worker.rig.anchors.head.bone];
      const distances: number[] = [];
      for (const [, pose] of poses()) {
         worker.posed(pose, true);
         bone.getWorldPosition(boneAt);
         hat.getWorldPosition(at);
         distances.push(at.distanceTo(boneAt));
      }
      const span = Math.max(...distances) - Math.min(...distances);
      expect(span).toBeLessThan(CM);
   });

   it("the hat sits on the head: the dome covers every head vertex above its rim, 2-6 cm over the crown", () => {
      const c = new Vector3();
      const radius = (DOME_R * WORKER_HAT.scale) / WORKER_SCALE;
      for (const [name, pose] of poses().slice(0, 2)) {
         const world = worker.posed(pose, true);
         domeCentre.getWorldPosition(c);
         let top = -Infinity;
         let above = 0;
         let worst = 0;
         for (let i = 0; i < world.length; i += 3) {
            const y = world[i + 1];
            top = Math.max(top, y);
            // the head column (a pointing arm reaches above the rim, well off to the side)
            if (y < c.y || Math.hypot(world[i] - c.x, world[i + 2] - c.z) > 1.5 * radius) continue;
            above++;
            worst = Math.max(worst, Math.hypot(world[i] - c.x, y - c.y, world[i + 2] - c.z));
         }
         // the crown pokes above the rim (the hat is on the head, not floating over it) and stays inside
         expect(above, name).toBeGreaterThan(50);
         expect(worst, name).toBeLessThan(radius);
         const clearance = (c.y + radius - top) * WORKER_SCALE;
         expect(clearance, name).toBeGreaterThan(0.02);
         expect(clearance, name).toBeLessThan(0.06);
         // centred on the head, not hanging off the front or the back
         expect(Math.abs(c.z - worker.rig.anchors.head.z) * WORKER_SCALE, name).toBeLessThan(0.03);
      }
   });
});

async function drawnBox(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

describe("construction-worker models", () => {
   it("are all in the manifest", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.cementMixer.url).toBe("/models/3d/construction-worker/cementMixer.glb");
   });

   it("each asset file exists on disk", () => {
      for (const asset of Object.values(ASSETS)) {
         expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
      }
   });

   it("fits the cement mixer to a 1.25 m unit sitting flat on the ground", async () => {
      expect(existsSync(resolve("public", ASSETS.cementMixer.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.cementMixer.url)).toBe(true);
      const raw = await rawBox(ASSETS.cementMixer);
      expect(raw.min.y).toBeCloseTo(0, 2);
      expect(raw.max.x - raw.min.x).toBeCloseTo(MIXER_GLB.width, 2);
      expect(raw.max.y - raw.min.y).toBeCloseTo(MIXER_GLB.height, 2);
      expect(raw.max.z - raw.min.z).toBeCloseTo(MIXER_GLB.depth, 2);
      const drawn = await drawnBox(ASSETS.cementMixer);
      expect(drawn.min.y).toBeCloseTo(0, 2);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(MIXER_HEIGHT, 2);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(MIXER_GLB.width * (MIXER_HEIGHT / MIXER_GLB.height), 2);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(MIXER_GLB.depth * (MIXER_HEIGHT / MIXER_GLB.height), 2);
   });

   it("places cement mixer decor spots strictly outside the play bounds", () => {
      expect(MIXER_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(MIXER_SPOTS.length).toBeLessThanOrEqual(4);
      for (const spot of MIXER_SPOTS) {
         expect(inWorkArea(spot.x, spot.z, 0.5), `mixer at (${spot.x}, ${spot.z}) must be outside play area`).toBe(false);
         expect(Math.hypot(spot.x, spot.z), "clear of crane mast").toBeGreaterThan(4);
         for (const a of PILE_A) {
            expect(Math.hypot(spot.x - PILE_R * Math.sin(a), spot.z - PILE_R * Math.cos(a)), "clear of pile").toBeGreaterThan(1);
         }
         for (const a of SLOT_A) {
            expect(Math.hypot(spot.x - SLOT_R * Math.sin(a), spot.z - SLOT_R * Math.cos(a)), "clear of slot").toBeGreaterThan(1.5);
         }
         expect(Math.hypot(spot.x - 2.6, spot.z - 5.35), "clear of worker").toBeGreaterThan(1);
      }
   });
});
