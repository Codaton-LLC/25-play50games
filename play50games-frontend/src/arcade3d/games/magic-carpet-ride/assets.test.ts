import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter, rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { createPose, sitPose } from "@/arcade3d/core/rig";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, CARPET_WIDTH, CLOUD_WIDTH, GLB_SIZE, RIDER_HEIGHT, RIDER_LANDMARKS, RIDER_SCALE, RING_DIAMETER, ROCK_WIDTH, SEAT_Y, STAR_SIZE, TOWER_HEIGHT } from "./assets";

async function drawnBox(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const box = new Box3();
   const v = new Vector3();
   for (const part of modelParts(root, asset)) {
      const position = part.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i += 1) box.expandByPoint(v.fromBufferAttribute(position, i).applyMatrix4(part.matrix));
   }
   geometry.dispose();
   return box;
}
const drawnSize = async (asset: ModelAsset) => (await drawnBox(asset)).getSize(new Vector3());

const UNIT_BOX = ["roof", "mesa", "lantern", "palace"] as const;

describe("magic-carpet-ride models", () => {
   it("lists every GLB it uses; only the rider is a humanoid", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.rider.humanoid?.landmarks).toBe(RIDER_LANDMARKS);
      expect(Object.keys(RIDER_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "rider") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
   });

   it("draws the rider at 1.72 m, the carpet, rings, stars, rocks, clouds and towers at their size, centred where the scene places them", async () => {
      expect((await drawnSize(ASSETS.rider)).y).toBeCloseTo(RIDER_HEIGHT, 2);
      expect((await drawnSize(ASSETS.carpet)).x).toBeCloseTo(CARPET_WIDTH, 2);
      const ring = await drawnBox(ASSETS.ring);
      expect(ring.getSize(new Vector3()).x).toBeCloseTo(RING_DIAMETER, 2);
      expect((ring.min.y + ring.max.y) / 2).toBeCloseTo(0, 3);
      const star = await drawnBox(ASSETS.star);
      expect(Math.max(...star.getSize(new Vector3()).toArray())).toBeCloseTo(STAR_SIZE, 2);
      expect((star.min.y + star.max.y) / 2).toBeCloseTo(0, 3);
      const rock = await drawnBox(ASSETS.rock);
      expect(Math.max(...rock.getSize(new Vector3()).toArray())).toBeCloseTo(ROCK_WIDTH, 2);
      expect((rock.min.y + rock.max.y) / 2).toBeCloseTo(0, 3);
      const cloud = await drawnBox(ASSETS.cloud);
      expect(Math.max(...cloud.getSize(new Vector3()).toArray())).toBeCloseTo(CLOUD_WIDTH, 2);
      const tower = await drawnBox(ASSETS.tower);
      expect(tower.getSize(new Vector3()).y).toBeCloseTo(TOWER_HEIGHT, 2);
      expect((tower.min.y + tower.max.y) / 2).toBeCloseTo(0, 3);
   });

   it("draws the instanced decor as unit boxes centred on the origin: the spot's size is the box, never doubled", async () => {
      for (const key of UNIT_BOX) {
         const box = await drawnBox(ASSETS[key]);
         const s = box.getSize(new Vector3());
         expect([s.x, s.y, s.z].map((v) => Math.round(v * 100) / 100), key).toEqual([1, 1, 1]);
         expect((box.min.y + box.max.y) / 2, key).toBeCloseTo(0, 3);
      }
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         rider: ASSETS.rider, carpet: ASSETS.carpet, ring: ASSETS.ring, star: ASSETS.star, rock: ASSETS.rock, cloud: ASSETS.cloud, tower: ASSETS.tower,
         roof: ASSETS.roof, mesa: ASSETS.mesa, lantern: ASSETS.lantern, palace: ASSETS.palace,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined, yOffset: 0, rotationY: 0 });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });

   it("seats the rider on the carpet: the core sitPose with the hips at the carpet's top, the knees forward, nothing below the carpet but the feet", async () => {
      const rider = await rigCharacter(ASSETS.rider);
      const world = rider.posed(sitPose(1, createPose()), false);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < world.length; i += 3) {
         minY = Math.min(minY, world[i]);
         maxY = Math.max(maxY, world[i]);
      }
      // drawn at the seat: the feet hang about knee height under the carpet's top, the head stays over it
      const top = 0.2;
      expect(minY * RIDER_SCALE + SEAT_Y).toBeGreaterThan(top - 0.6);
      expect(minY * RIDER_SCALE + SEAT_Y).toBeLessThan(top);
      expect(maxY * RIDER_SCALE + SEAT_Y).toBeGreaterThan(top + 0.6);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("sitPose(1, pose)")).toBe(true);
   });
});

describe("carpet rider GLB", () => {
   describeCharacter("rider", {
      asset: ASSETS.rider,
      landmarks: RIDER_LANDMARKS,
      height: GLB_SIZE.rider.y,
      reach: 0.951,
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: RIDER_LANDMARKS.headY + RIDER_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.25,
   });
});
