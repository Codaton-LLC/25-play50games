// Tower Climb's fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <DynamicInstancedModel> draws): the checkpoint ledge, the spring pad and the rocket pickup,
// each fitted to the primitive it replaces (same footprint, top height and stand-on surface).
// The urls double as the file-existence check: readCharacterGlb throws on a missing GLB.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, LEDGE_GLB, LEDGE_Y_OFFSET, ROCKET_DRAWN, ROCKET_GLB, SPRING_DRAWN, SPRING_GLB } from "./assets";

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

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, yOffset: 0 });

describe("tower-climb models", () => {
   it("lists every GLB url in the manifest; the unfetched platforms stay out", () => {
      for (const key of ["runner", "ledge", "coin", "flag", "spring", "rocket"] as const) {
         expect(hasModel(ASSETS[key].url), ASSETS[key].url).toBe(true);
      }
      expect(ASSETS.ledge.url).toBe("/models/3d/tower-climb/towerLedge.glb");
      expect(ASSETS.spring.url).toBe("/models/3d/tower-climb/springPad.glb");
      expect(ASSETS.rocket.url).toBe("/models/3d/tower-climb/rocketBooster.glb");
      // slab / movingSlab / spur keep their box stand-ins: urls absent from the manifest, never fetched
      for (const key of ["slab", "movingSlab", "spur"] as const) {
         expect(hasModel(ASSETS[key].url), ASSETS[key].url).toBe(false);
      }
   });

   it("measures the towerLedge GLB as committed", async () => {
      const raw = await rawBox(ASSETS.ledge);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(LEDGE_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(LEDGE_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(LEDGE_GLB.depth, 3);
   });

   it("draws the ledge at the checkpoint slab's 4.4 x 0.6 footprint, its top exactly on the slab top", async () => {
      const drawn = await drawnBox(ASSETS.ledge);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(4.4, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(0.6, 3);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(0.16, 3);
      // writeSlab's matrix is the slab top: the stand-on surface, the body below it like the box
      expect(drawn.max.y).toBeCloseTo(0, 3);
      expect(drawn.min.y).toBeCloseTo(LEDGE_Y_OFFSET, 3);
   });

   it("measures the springPad GLB as committed", async () => {
      const raw = await rawBox(ASSETS.spring);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(SPRING_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(SPRING_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(SPRING_GLB.depth, 3);
   });

   it("draws the spring pad on the slab top at the disc's footprint and the arrows' top", async () => {
      const drawn = await drawnBox(ASSETS.spring);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.y).toBeCloseTo(SPRING_DRAWN.height, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(SPRING_DRAWN.diameter, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(SPRING_DRAWN.diameter, 3);
   });

   it("measures the rocketBooster GLB as committed", async () => {
      const raw = await rawBox(ASSETS.rocket);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(ROCKET_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(ROCKET_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(ROCKET_GLB.depth, 3);
   });

   it("draws the rocket pickup at the primitive's size before writeRocket's x1.8 spin", async () => {
      const drawn = await drawnBox(ASSETS.rocket);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.y).toBeCloseTo(ROCKET_DRAWN.height, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(ROCKET_DRAWN.width, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(ROCKET_DRAWN.depth, 3);
   });
});
