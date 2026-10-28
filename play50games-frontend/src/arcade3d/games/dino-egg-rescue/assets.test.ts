import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import {
   ASSETS,
   DINO_BACK_TOP_ANCHOR,
   DINO_EGG_HEIGHT,
   DINO_NEST_DIAMETER,
   DINO_NEST_HEIGHT,
   FARM_FENCE_GLB,
   JUNGLE_GLB,
   GOLDEN_EGG_HEIGHT,
   LAVA_ROCK_DRAWN,
   LAVA_ROCK_GLB,
   LAVA_ROCK_SPOTS,
   LAVA_ROCK_WIDTH,
   TREE_TRUNK_RADIUS,
   VOLCANO_HEIGHT,
   VOLCANO_RADIUS,
} from "./assets";
import { inValley, nearMainVolcano } from "./looks";

describe("dino-egg-rescue model assets", () => {
   it("all shared models exist in the model manifest", () => {
      for (const [name, asset] of Object.entries(ASSETS)) {
         expect(hasModel(asset.url), `${name}: ${asset.url}`).toBe(true);
      }
   });

   it("leafy tree trunk radius is pinned to 0.256 m from GLB metrics", () => {
      expect(TREE_TRUNK_RADIUS).toBeCloseTo(0.256, 3);
   });

   it("egg stack anchor on dino back is accurately mapped from GLB units", () => {
      expect(DINO_BACK_TOP_ANCHOR.x).toBeCloseTo(0, 3);
      expect(DINO_BACK_TOP_ANCHOR.y).toBeCloseTo(0.41, 2);
      expect(DINO_BACK_TOP_ANCHOR.z).toBeCloseTo(-0.06, 2);
   });

   it("character and prop dimensions match README specifications", () => {
      // Dino: 1.1 m long, 0.85 m tall (GLB height 1.48 scaled by 1.1/1.8939 * 0.937)
      const dinoScale = ASSETS.dino.scale ?? 1;
      const dinoStretchY = ASSETS.dino.stretch?.[1] ?? 1;
      expect(EXPANSION_GLB_SIZE.dino.depth * dinoScale).toBeCloseTo(1.1, 1);
      expect(EXPANSION_GLB_SIZE.dino.height * dinoScale * dinoStretchY).toBeCloseTo(0.85, 1);

      // Rock: fits round 1.0 m boulder
      const rockStretch = ASSETS.rock.stretch!;
      expect(rockStretch[0] * EXPANSION_GLB_SIZE.rock.width).toBeCloseTo(1.0, 3);
      expect(rockStretch[1] * EXPANSION_GLB_SIZE.rock.height).toBeCloseTo(1.0, 3);
      expect(rockStretch[2] * EXPANSION_GLB_SIZE.rock.depth).toBeCloseTo(1.0, 3);

      // Leafy tree: 3.5 m height
      const treeScale = ASSETS.leafyTree.scale ?? 1;
      expect(EXPANSION_GLB_SIZE.leafyTree.height * treeScale).toBeCloseTo(3.5, 1);
   });

   it("fits the volcano GLB to the old cone: 8 m tall, 5.5 m footprint, base on y = 0", async () => {
      // decode the real meshopt-decoded mesh and draw it through core modelParts (what <Model> draws)
      const { local, node } = await readCharacterGlb(ASSETS.volcano.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      const mesh = new Mesh(geometry);
      mesh.position.fromArray(node);
      const root = new Group();
      root.add(mesh);
      const parts = modelParts(root, ASSETS.volcano);
      expect(parts).toHaveLength(1);
      const points: Vector3[] = [];
      for (let i = 0; i < local.length; i += 3)
         points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
      geometry.dispose();
      const box = new Box3().setFromPoints(points);
      // height and footprint within 3% of the replaced cone (5.5 radius, 8.0 tall)
      expect(box.max.y - box.min.y).toBeCloseTo(VOLCANO_HEIGHT, 1);
      let footprint = 0;
      for (const p of points) footprint = Math.max(footprint, Math.hypot(p.x, p.z));
      expect(footprint).toBeCloseTo(VOLCANO_RADIUS, 1);
      expect(box.min.y).toBeCloseTo(0, 3);
   });
});

describe("dino-egg-rescue lava rock decor (levels 4-5 only)", () => {
   it("is listed in the manifest and the GLB file exists", () => {
      expect(ASSETS.lavaRock.url).toBe("/models/3d/dino-egg-rescue/lavaRock.glb");
      expect(hasModel(ASSETS.lavaRock.url)).toBe(true);
      expect(existsSync(resolve("public", ASSETS.lavaRock.url.slice(1)))).toBe(true);
   });

   it("measures the lavaRock GLB and draws it 1.8 m across, sitting on the ground", async () => {
      // decode the real meshopt-decoded mesh and draw it through core modelParts (what <Model> draws)
      const { local, node } = await readCharacterGlb(ASSETS.lavaRock.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      const mesh = new Mesh(geometry);
      mesh.position.fromArray(node);
      const root = new Group();
      root.add(mesh);

      const raw = modelParts(root, {
         ...ASSETS.lavaRock,
         scale: 1,
         stretch: undefined,
         rotationY: 0,
         yOffset: 0,
      });
      expect(raw).toHaveLength(1);
      const rawBox = new Box3();
      const v = new Vector3();
      for (let i = 0; i < local.length; i += 3)
         rawBox.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(raw[0].matrix));
      expect(rawBox.min.y).toBeCloseTo(0, 3);
      expect(rawBox.max.x - rawBox.min.x).toBeCloseTo(LAVA_ROCK_GLB.width, 3);
      expect(rawBox.max.y - rawBox.min.y).toBeCloseTo(LAVA_ROCK_GLB.height, 3);
      expect(rawBox.max.z - rawBox.min.z).toBeCloseTo(LAVA_ROCK_GLB.depth, 3);

      const drawn = modelParts(root, ASSETS.lavaRock);
      expect(drawn).toHaveLength(1);
      const box = new Box3();
      for (let i = 0; i < local.length; i += 3)
         box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(drawn[0].matrix));
      geometry.dispose();
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(box.max.z - box.min.z).toBeCloseTo(LAVA_ROCK_WIDTH, 3);
      expect(box.max.x - box.min.x).toBeCloseTo(LAVA_ROCK_DRAWN.width, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(LAVA_ROCK_DRAWN.height, 2);
   });

   it("places every lava rock outside the play bounds, clear of the main volcano", () => {
      const radius = Math.max(LAVA_ROCK_DRAWN.width, LAVA_ROCK_DRAWN.depth) / 2;
      for (const spot of LAVA_ROCK_SPOTS) {
         expect(inValley(spot.x, spot.z, radius), `spot ${spot.x},${spot.z}`).toBe(false);
         expect(nearMainVolcano(spot.x, spot.z, radius), `spot ${spot.x},${spot.z}`).toBe(false);
      }
   });

   it("fits the Menu 1 egg, golden egg and nest on the floor at their README sizes", async () => {
      const box = async (asset: ModelAsset) => {
         const { local, node } = await readCharacterGlb(asset.url);
         const geometry = new BufferGeometry();
         geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
         const mesh = new Mesh(geometry);
         mesh.position.fromArray(node);
         const root = new Group();
         root.add(mesh);
         const parts = modelParts(root, asset);
         mesh.updateMatrixWorld(true);
         const b = new Box3();
         for (const p of parts) b.union(new Box3().setFromBufferAttribute(geometry.getAttribute("position") as never).applyMatrix4(p.matrix));
         geometry.dispose();
         return b;
      };
      for (const asset of [ASSETS.dinoEgg, ASSETS.goldenEgg, ASSETS.dinoNest]) {
         expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
         expect(hasModel(asset.url), asset.url).toBe(true);
      }
      const egg = await box(ASSETS.dinoEgg);
      expect(egg.min.y).toBeCloseTo(0, 2);
      expect(egg.getSize(new Vector3()).y).toBeCloseTo(DINO_EGG_HEIGHT, 2);
      expect((await box(ASSETS.goldenEgg)).getSize(new Vector3()).y).toBeCloseTo(GOLDEN_EGG_HEIGHT, 2);
      const nest = await box(ASSETS.dinoNest);
      expect(nest.min.y).toBeCloseTo(0, 2);
      expect(nest.getSize(new Vector3()).y).toBeCloseTo(DINO_NEST_HEIGHT, 2);
      expect(nest.getSize(new Vector3()).x).toBeCloseTo(DINO_NEST_DIAMETER, 2);
   });
});

describe("dino-egg-rescue level props (reused GLBs, maps.ts)", () => {
   it("every level prop GLB is in the manifest", () => {
      for (const asset of [ASSETS.pineTree, ASSETS.fern, ASSETS.log, ASSETS.reeds, ASSETS.bankRock, ASSETS.bridge, ASSETS.fence]) {
         expect(hasModel(asset.url), asset.url).toBe(true);
      }
   });

   it("the reused GLBs measure what the fits assume", async () => {
      const size = async (url: string) => {
         const { cloud } = await readCharacterGlb(url);
         const min = [Infinity, Infinity, Infinity];
         const max = [-Infinity, -Infinity, -Infinity];
         for (let i = 0; i < cloud.length; i += 3) for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], cloud[i + k]);
            max[k] = Math.max(max[k], cloud[i + k]);
         }
         return max.map((v, k) => v - min[k]);
      };
      for (const [url, s] of [
         [ASSETS.fern.url, JUNGLE_GLB.jungleFern],
         [ASSETS.log.url, JUNGLE_GLB.jungleLogSingle],
         [ASSETS.reeds.url, JUNGLE_GLB.junglePlant],
         [ASSETS.bridge.url, JUNGLE_GLB.woodenBridge],
      ] as const) {
         const [w, h, d] = await size(url);
         expect(w, url).toBeCloseTo(s.width, 1);
         expect(h, url).toBeCloseTo(s.height, 1);
         expect(d, url).toBeCloseTo(s.depth, 1);
      }
      const [fx, fy, fz] = await size(ASSETS.fence.url);
      expect(fx).toBeCloseTo(FARM_FENCE_GLB.x, 1);
      expect(fy).toBeCloseTo(FARM_FENCE_GLB.y, 1);
      expect(fz).toBeCloseTo(FARM_FENCE_GLB.z, 1);
   });
});
