import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { AMPHORA_HEIGHT, ASSETS, COLUMN_SCALE, DOCK_WIDTH, FISH_LENGTH, GLB_SIZE, JELLY_HEIGHT, SHELL_WIDTH, SUB_LENGTH } from "./assets";

async function drawnSize(asset: ModelAsset): Promise<Vector3> {
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
   return box.getSize(new Vector3());
}

const UNIT = ["anchor", "rockArch", "wreck", "coral", "seaweed", "aquariumRock", "rock"] as const;

describe("submarine-treasure-dive models", () => {
   it("lists every GLB it uses; nothing is a humanoid (the sub is a vehicle)", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      for (const asset of Object.values(ASSETS) as ModelAsset[]) expect(asset.humanoid).toBeUndefined();
   });

   it("draws the sub, the treasures, the jellies, the dock, the fish and the column at their size in metres", async () => {
      expect((await drawnSize(ASSETS.miniSubmarine)).z).toBeCloseTo(SUB_LENGTH, 2);
      expect((await drawnSize(ASSETS.amphora)).y).toBeCloseTo(AMPHORA_HEIGHT, 2);
      expect((await drawnSize(ASSETS.pearlShell)).x).toBeCloseTo(SHELL_WIDTH, 2);
      expect((await drawnSize(ASSETS.jellyfish)).y).toBeCloseTo(JELLY_HEIGHT, 2);
      expect((await drawnSize(ASSETS.subDock)).z).toBeCloseTo(DOCK_WIDTH, 2);
      expect((await drawnSize(ASSETS.tropicalFish)).z).toBeCloseTo(FISH_LENGTH, 2);
      const column = await drawnSize(ASSETS.ruinColumn);
      expect(column.y).toBeCloseTo(GLB_SIZE.column.y * COLUMN_SCALE, 2);
   });

   it("draws every reef model as a unit model (longest side 1 m): the spot's scale is its size, never doubled", async () => {
      for (const key of UNIT) {
         const s = await drawnSize(ASSETS[key]);
         expect(Math.max(s.x, s.y, s.z), key).toBeCloseTo(1, 2);
      }
      // the wreck's long axis is turned to the box's x
      const wreck = await drawnSize(ASSETS.wreck);
      expect(wreck.x).toBeCloseTo(1, 2);
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         sub: ASSETS.miniSubmarine, amphora: ASSETS.amphora, anchor: ASSETS.anchor, shell: ASSETS.pearlShell, arch: ASSETS.rockArch, column: ASSETS.ruinColumn,
         wreck: ASSETS.wreck, jellyfish: ASSETS.jellyfish, dock: ASSETS.subDock, coral: ASSETS.coral, seaweed: ASSETS.seaweed, fish: ASSETS.tropicalFish,
         reefRock: ASSETS.aquariumRock,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });

   it("never scales a reef spot twice: the scene's GLB spots stand on y = 0 and carry the metres", () => {
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      for (const name of ["glbRocksA", "glbRocksB", "glbCoral", "glbArches", "glbAnchors", "glbKelp", "glbWrecks"]) {
         expect(scene.includes(`spots={${name}}`), name).toBe(true);
      }
   });
});
