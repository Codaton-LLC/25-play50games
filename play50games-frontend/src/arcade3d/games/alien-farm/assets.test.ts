import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/types";
import {
   ALIEN_HEIGHT,
   ASSETS,
   CRATE_WIDTH,
   GLOW_POD_HEIGHT,
   GLOW_POD_WIDTH,
   GOURD_HEIGHT,
   GOURD_WIDTH,
   ROCK_WIDTH,
   UFO_DIAMETER,
} from "./assets";

const PUBLIC_DIR = path.resolve(__dirname, "../../../../public");

async function measureAsset(asset: ModelAsset) {
   const { local, node, indices } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts.length).toBeGreaterThanOrEqual(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) {
      points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   }
   geometry.dispose();
   const box = new Box3().setFromPoints(points);
   const size = box.getSize(new Vector3());
   return { box, size, tris: indices.length / 3 };
}

describe("alien-farm assets", () => {
   it("keeps every asset in the manifest and within its file-size and triangle budget", () => {
      for (const [name, spec] of Object.entries(ASSETS)) {
         expect(hasModel(spec.url), `${name}: ${spec.url}`).toBe(true);
         const filePath = path.join(PUBLIC_DIR, spec.url.replace(/^\//, ""));
         expect(existsSync(filePath), `missing ${spec.url}`).toBe(true);
         const size = statSync(filePath).size;
         expect(size).toBeGreaterThan(100);
         if (spec.budget?.bytes) {
            expect(size).toBeLessThanOrEqual(spec.budget.bytes);
         }
      }
   });

   it("scales the alien farmer to 1.30 m tall on the floor", async () => {
      const { box, size, tris } = await measureAsset(ASSETS.alien);
      expect(tris).toBeLessThanOrEqual(ASSETS.alien.budget!.tris);
      expect(size.y).toBeCloseTo(ALIEN_HEIGHT, 2);
      expect(box.min.y).toBeCloseTo(0, 2);
   });

   it("fits glowPod and gourd crops inside 1.1 m width and 1.0 m mature height with emissive tints", async () => {
      for (const [spec, maxW, maxH, emissive] of [
         [ASSETS.glowPod, GLOW_POD_WIDTH, GLOW_POD_HEIGHT, "#052e16"],
         [ASSETS.gourd, GOURD_WIDTH, GOURD_HEIGHT, "#083344"],
      ] as const) {
         const { box, size, tris } = await measureAsset(spec);
         expect(tris).toBeLessThanOrEqual(spec.budget!.tris);
         expect(size.x).toBeLessThanOrEqual(maxW + 1e-3);
         expect(size.z).toBeLessThanOrEqual(maxW + 1e-3);
         expect(size.y).toBeCloseTo(maxH, 2);
         expect(box.min.y).toBeCloseTo(0, 2);
         expect(spec.material?.emissive).toBe(emissive);
      }
   });

   it("scales rock, crate, and ufo to their expected world dimensions", async () => {
      const rock = await measureAsset(ASSETS.rock);
      expect(rock.size.x).toBeCloseTo(ROCK_WIDTH, 2);
      expect(ASSETS.rock.material?.color).toBe("#7c3aed");

      const crate = await measureAsset(ASSETS.crate);
      expect(crate.size.x).toBeCloseTo(CRATE_WIDTH, 2);

      const ufo = await measureAsset(ASSETS.ufo);
      expect(ufo.tris).toBeLessThanOrEqual(ASSETS.ufo.budget!.tris);
      expect(Math.max(ufo.size.x, ufo.size.z)).toBeCloseTo(UFO_DIAMETER, 2);
      expect(ufo.box.min.y).toBeCloseTo(0, 2);
   });
});
