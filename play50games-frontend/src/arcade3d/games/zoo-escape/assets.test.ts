// Zoo Escape's fits on the real, meshopt-decoded GLBs (through core modelParts, what <Model> /
// <InstancedModel> draw): every model is in the manifest and drawn at the README's size.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BAMBOO_GLB, BRIDGE_GLB, BRIDGE_Y_OFFSET, BUSH_GLB, KEEPER_SCALE, KIOSK_GLB, PANDA_LENGTH, PROP_SIZE, SNACK_GLB, TOWER_GLB, ZOO_ROCK_SPOTS, ZOO_ROCKS_DRAWN, ZOO_ROCKS_GLB, ZOO_ROCKS_WIDTH } from "./assets";
import { DECOR, inPlayArea } from "./looks";

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

async function drawnSize(asset: ModelAsset): Promise<Vector3> {
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
   expect(box.min.y).toBeCloseTo(0, 2);
   return box.getSize(new Vector3());
}

describe("zoo-escape models", () => {
   it("are all in the manifest", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.bamboo.url).toBe("/models/3d/zoo-escape/bamboo.glb");
   });

   it("measures the new bamboo GLB as committed", async () => {
      const raw = await drawnSize({ ...ASSETS.bamboo, scale: 1 });
      expect(raw.x).toBeCloseTo(BAMBOO_GLB.width, 3);
      expect(raw.y).toBeCloseTo(BAMBOO_GLB.height, 3);
      expect(raw.z).toBeCloseTo(BAMBOO_GLB.depth, 3);
   });

   it("draws every model at the README's size", async () => {
      const panda = await drawnSize(ASSETS.panda);
      expect(panda.z).toBeCloseTo(PANDA_LENGTH, 2);
      expect(panda.y).toBeCloseTo(1.0, 1);
      expect((await drawnSize(ASSETS.keeper)).y).toBeCloseTo(1.75, 2);
      expect(KEEPER_SCALE).toBeCloseTo(1.75 / 1.8921, 6);
      expect((await drawnSize(ASSETS.bamboo)).x).toBeCloseTo(1, 3);
      expect((await drawnSize(ASSETS.rock)).x).toBeCloseTo(1, 2);
      expect((await drawnSize(ASSETS.leafyTree)).y).toBeCloseTo(3.5, 2);
      expect((await drawnSize(ASSETS.bench)).x).toBeCloseTo(PROP_SIZE.benchLength, 2);
      expect((await drawnSize(ASSETS.bin)).y).toBeCloseTo(PROP_SIZE.binHeight, 2);
      expect((await drawnSize(ASSETS.lamp)).y).toBeCloseTo(PROP_SIZE.lampHeight, 2);
      expect((await drawnSize(ASSETS.palm)).y).toBeCloseTo(PROP_SIZE.palmHeight, 2);
      const car = await drawnSize(ASSETS.car);
      expect(car.z).toBeCloseTo(PROP_SIZE.carLength, 2);
      // inside its 2.0 x 4.2 rules box
      expect(car.x).toBeLessThanOrEqual(2.01);
   });
});

describe("adopted batch-5 prop GLBs", () => {
   it("measures the zooKiosk GLB and draws it as a 1 m unit (2.6 m at the kiosk spots)", async () => {
      const raw = await rawBox(ASSETS.kiosk);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(KIOSK_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(KIOSK_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(KIOSK_GLB.depth, 3);
      const unit = await drawnBox(ASSETS.kiosk);
      expect(unit.max.y - unit.min.y).toBeCloseTo(1, 3);
      // the kiosk spots stretch it to 2.6 m high and to each collision footprint
      expect((unit.max.y - unit.min.y) * 2.6).toBeCloseTo(2.6, 3);
   });

   it("measures the leafyBush GLB and draws it at the 1 x 0.9 x 1 bush unit", async () => {
      const raw = await rawBox(ASSETS.bush);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(BUSH_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(BUSH_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(BUSH_GLB.depth, 3);
      const unit = await drawnBox(ASSETS.bush);
      expect(unit.max.x - unit.min.x).toBeCloseTo(1, 3);
      expect(unit.max.y - unit.min.y).toBeCloseTo(0.9, 3);
      expect(unit.max.z - unit.min.z).toBeCloseTo(1, 3);
   });

   it("measures the woodenFootbridge GLB and draws it 2.6 long with the deck top at 0.165", async () => {
      const raw = await rawBox(ASSETS.bridge);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(BRIDGE_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(BRIDGE_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(BRIDGE_GLB.depth, 3);
      const drawn = await drawnBox(ASSETS.bridge);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(2.6, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(BRIDGE_GLB.width * (2.6 / BRIDGE_GLB.depth), 3);
      // sunk: the under-structure buries below ground, the rail tops land at ~0.88
      expect(drawn.min.y).toBeCloseTo(BRIDGE_Y_OFFSET, 3);
      expect(drawn.max.y).toBeCloseTo(0.88, 2);
   });

   it("measures the searchlightTower GLB and draws it 4.4 tall on a 1.6 footprint", async () => {
      const raw = await rawBox(ASSETS.tower);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(TOWER_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(TOWER_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(TOWER_GLB.depth, 3);
      const drawn = await drawnBox(ASSETS.tower);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(1.6, 3);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(4.4, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(1.6, 3);
      // the searchlight beam apex (LIGHT_HEIGHT = 4.5) starts just above the railing top
      expect(drawn.max.y).toBeLessThan(4.5);
      expect(drawn.max.y).toBeGreaterThan(4.3);
   });

   it("measures the bambooSnack GLB and draws it 1.0 m across at the pool's x1.6", async () => {
      const raw = await rawBox(ASSETS.snack);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(SNACK_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(SNACK_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(SNACK_GLB.depth, 3);
      const unit = await drawnBox(ASSETS.snack);
      expect((unit.max.x - unit.min.x) * 1.6).toBeCloseTo(1.0, 3);
      expect((unit.max.z - unit.min.z) * 1.6).toBeLessThan(1.0);
      expect((unit.max.y - unit.min.y) * 1.6).toBeCloseTo(0.29, 2);
   });

   it("fits the boulder cluster outside the stages and clear of the park trees", async () => {
      expect(existsSync(resolve("public", ASSETS.zooRocks.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.zooRocks.url)).toBe(true);
      const raw = await rawBox(ASSETS.zooRocks);
      expect(raw.min.y).toBeCloseTo(0, 2);
      expect(raw.max.x - raw.min.x).toBeCloseTo(ZOO_ROCKS_GLB.width, 2);
      expect(raw.max.y - raw.min.y).toBeCloseTo(ZOO_ROCKS_GLB.height, 2);
      const drawn = await drawnBox(ASSETS.zooRocks);
      expect(drawn.min.y).toBeCloseTo(0, 2);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(ZOO_ROCKS_WIDTH, 2);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(ZOO_ROCKS_DRAWN.depth, 2);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(ZOO_ROCKS_DRAWN.height, 2);
      const rockR = Math.max(ZOO_ROCKS_DRAWN.width, ZOO_ROCKS_DRAWN.depth) / 2;
      for (const spot of ZOO_ROCK_SPOTS) {
         expect(inPlayArea(spot.x, spot.z, rockR)).toBe(false);
         for (const decor of DECOR) {
            const reach = decor.kind === "pine" ? 1.25 * decor.sx : decor.kind === "tree" ? 1.4 * decor.sx : Math.hypot(decor.sx, decor.sz) / 2;
            if (decor.kind !== "tree" && decor.kind !== "pine" && decor.kind !== "hedge") continue;
            expect(Math.hypot(spot.x - decor.x, spot.z - decor.z)).toBeGreaterThan(rockR + reach);
         }
      }
   });
});
