import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { describeCharacter, rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { createPose, sitPose } from "@/arcade3d/core/rig";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, CARPET_STRETCH_Z, CARPET_TOP, CARPET_WIDTH, FLY_SIZE, GLB_SIZE, RIDER_HEIGHT, RIDER_LANDMARKS, RIDER_SCALE, SEAT_Y } from "./assets";

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

const UNIT_BOX = ["cloud", "tower", "roof", "mesa", "lantern", "palace", "pyramid", "islandCastle", "islandFalls", "islandMill", "palm"] as const;
const FLYING = ["ring", "coin", "gem", "boost", "gull", "bat", "hawk", "balloon", "hotAir", "blimp", "skyLantern", "rock"] as const;
const FLY_KEY: Record<(typeof FLYING)[number], keyof typeof FLY_SIZE> = {
   ring: "ring", coin: "coin", gem: "gem", boost: "boost", gull: "gull", bat: "bat", hawk: "hawk", balloon: "balloon", hotAir: "hotAir", blimp: "blimp", skyLantern: "skyLantern", rock: "rock",
};

describe("magic-carpet-ride models", () => {
   it("lists every GLB it uses; only the rider is a humanoid", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.rider.humanoid?.landmarks).toBe(RIDER_LANDMARKS);
      expect(Object.keys(RIDER_LANDMARKS)).toHaveLength(32);
      for (const key of Object.keys(ASSETS) as Array<keyof typeof ASSETS>) if (key !== "rider") expect((ASSETS[key] as ModelAsset).humanoid).toBeUndefined();
   });

   it("draws the rider at 1.72 m and the carpet 1.9 m wide, stretched long", async () => {
      expect((await drawnSize(ASSETS.rider)).y).toBeCloseTo(RIDER_HEIGHT, 2);
      const carpet = await drawnSize(ASSETS.carpet);
      expect(carpet.x).toBeCloseTo(CARPET_WIDTH, 2);
      expect(carpet.y).toBeCloseTo(CARPET_TOP, 2);
      expect(carpet.z / carpet.x).toBeCloseTo((GLB_SIZE.carpet.z / GLB_SIZE.carpet.x) * CARPET_STRETCH_Z, 2);
   });

   it("draws every flyer and pickup at its size in metres, centred on its middle (the rules place them by their centre)", async () => {
      for (const key of FLYING) {
         const box = await drawnBox(ASSETS[key]);
         const s = box.getSize(new Vector3());
         expect(Math.max(s.x, s.y, s.z), key).toBeCloseTo(FLY_SIZE[FLY_KEY[key]], 2);
         expect((box.min.y + box.max.y) / 2, key).toBeCloseTo(0, 2);
      }
   });

   it("draws the instanced decor as unit boxes standing on the origin: the spot's size is the box, never doubled", async () => {
      for (const key of UNIT_BOX) {
         const box = await drawnBox(ASSETS[key]);
         const s = box.getSize(new Vector3());
         expect([s.x, s.y, s.z].map((v) => Math.round(v * 100) / 100), key).toEqual([1, 1, 1]);
         expect(box.min.y, key).toBeCloseTo(0, 3);
      }
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         rider: ASSETS.rider, carpet: ASSETS.carpet, ring: ASSETS.ring, coin: ASSETS.coin, gem: ASSETS.gem, boost: ASSETS.boost, gull: ASSETS.gull, bat: ASSETS.bat, hawk: ASSETS.hawk,
         balloon: ASSETS.balloon, hotAir: ASSETS.hotAir, blimp: ASSETS.blimp, skyLantern: ASSETS.skyLantern, rock: ASSETS.rock, cloud: ASSETS.cloud, tower: ASSETS.tower, roof: ASSETS.roof,
         mesa: ASSETS.mesa, lantern: ASSETS.lantern, palace: ASSETS.palace, pyramid: ASSETS.pyramid, islandCastle: ASSETS.islandCastle, islandFalls: ASSETS.islandFalls, islandMill: ASSETS.islandMill,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined, yOffset: 0, rotationY: 0 });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });

   it("seats the rider cross-legged on the carpet (the core sitPose): nothing sinks below the carpet's top, the head well above it", async () => {
      const rider = await rigCharacter(ASSETS.rider);
      const world = rider.posed(sitPose(1, createPose(), 1), false);
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 1; i < world.length; i += 3) {
         minY = Math.min(minY, world[i]);
         maxY = Math.max(maxY, world[i]);
      }
      // drawn at the seat: the folded legs rest on the carpet (a few cm into the cloth at most), the head high above it
      expect(minY * RIDER_SCALE + SEAT_Y).toBeGreaterThan(CARPET_TOP - 0.06);
      expect(minY * RIDER_SCALE + SEAT_Y).toBeLessThan(CARPET_TOP + 0.12);
      expect(maxY * RIDER_SCALE + SEAT_Y).toBeGreaterThan(CARPET_TOP + 0.75);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("sitPose(1, p, 1)")).toBe(true);
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
