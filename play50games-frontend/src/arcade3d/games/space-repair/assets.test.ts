import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASTRONAUT_LANDMARKS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, DISH_DRAWN, DISH_GLB, DISH_HEIGHT, DISH_LEVELS, DISH_SCALE, DISH_SPOTS, fitStationScene, SUIT_HEIGHT, SUIT_SCALE } from "./assets";
import { PLAY_BOUNDS } from "./looks";

async function meshFixture(url: string) {
   const glb = await readCharacterGlb(url), geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(glb.local, 3));
   const root = new Group(), mesh = new Mesh(geometry); mesh.position.fromArray(glb.node); root.add(mesh);
   return { root, geometry, glb };
}
function fittedBounds(root: Group, asset: typeof ASSETS.station) {
   const box = new Box3(), p = new Vector3(); let radius = 0;
   for (const part of modelParts(root, asset)) {
      const positions = part.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
         p.fromBufferAttribute(positions, i).applyMatrix4(part.matrix); box.expandByPoint(p);
         radius = Math.max(radius, Math.hypot(p.x, p.z));
      }
   }
   return { box, radius };
}
describe("real mesh fitting", () => {
   it("keeps the manifested astronaut at 1.75 m and uses its measured landmarks", async () => {
      const { root, geometry } = await meshFixture(ASSETS.astronaut.url);
      try {
         const { box } = fittedBounds(root, ASSETS.astronaut);
         expect(hasModel(ASSETS.astronaut.url)).toBe(true);
         expect(SUIT_HEIGHT).toBe(1.75); expect(SUIT_SCALE).toBeCloseTo(0.95990346, 6);
         expect(box.max.y - box.min.y).toBeCloseTo(1.75, 3); expect(box.min.y).toBeCloseTo(0, 3);
         expect(ASSETS.astronaut.humanoid?.landmarks).toEqual(ASTRONAUT_LANDMARKS);
      } finally { geometry.dispose(); }
   });
   it("fits the real battery to a camera-up metre using the core measured size", async () => {
      const { root, geometry } = await meshFixture(ASSETS.battery.url);
      try {
         const raw = fittedBounds(root, { ...ASSETS.battery, scale: 1 }).box;
         expect(raw.max.x - raw.min.x).toBeCloseTo(1.0231, 3);
         expect(raw.max.y - raw.min.y).toBeCloseTo(1.8954, 3);
         expect(raw.max.z - raw.min.z).toBeCloseTo(1.0102, 3);
         expect(SHARED_GLB_SIZE.battery.height).toBe(1.8954);
         const fitted = fittedBounds(root, ASSETS.battery).box;
         expect(fitted.max.y - fitted.min.y).toBeCloseTo(1, 3);
         const axis = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(1, 0, 0), -50 * Math.PI / 180);
         const cameraUp = new Vector3(0, Math.cos(50 * Math.PI / 180), -Math.sin(50 * Math.PI / 180));
         expect(axis.dot(cameraUp)).toBeCloseTo(1, 10);
      } finally { geometry.dispose(); }
   });
   it("measures the new station mesh, fits its entire footprint and pins the overlay separation", async () => {
      const { root, geometry, glb } = await meshFixture(ASSETS.station.url);
      try {
         expect(hasModel(ASSETS.station.url)).toBe(true);
         expect(glb.indices.length / 3).toBeLessThanOrEqual(3000);
         const fitted = fitStationScene(root), { box, radius } = fittedBounds(root, fitted);
         expect(radius).toBeLessThanOrEqual(0.650001);
         expect(box.max.y).toBeLessThanOrEqual(1.200001); expect(box.min.y).toBeCloseTo(0, 6);
         expect(Math.max(radius / 0.65, box.max.y / 1.2)).toBeCloseTo(1, 5);
         expect(1.24 - box.max.y).toBeGreaterThanOrEqual(0.039999);
         const raw = fittedBounds(root, ASSETS.station).box;
         console.info("Space Repair station raw bounds for shared constants", { min: raw.min.toArray(), max: raw.max.toArray(), scale: fitted.scale });
      } finally { geometry.dispose(); }
   });
});

describe("adopted satelliteDish decor (levels 4-5 only)", () => {
   it("is in the manifest and the GLB file exists", () => {
      expect(hasModel(ASSETS.dish.url)).toBe(true);
      expect(ASSETS.dish.url).toBe("/models/3d/space-repair/satelliteDish.glb");
      expect(existsSync(resolve("public", ASSETS.dish.url.slice(1)))).toBe(true);
   });

   it("measures the dish GLB and draws it 2.2 m tall with its feet on the deck", async () => {
      const { root, geometry } = await meshFixture(ASSETS.dish.url);
      try {
         const raw = fittedBounds(root, { ...ASSETS.dish, scale: 1 }).box;
         expect(raw.min.y).toBeCloseTo(0, 2);
         expect(raw.max.x - raw.min.x).toBeCloseTo(DISH_GLB.width, 2);
         expect(raw.max.y - raw.min.y).toBeCloseTo(DISH_GLB.height, 2);
         expect(raw.max.z - raw.min.z).toBeCloseTo(DISH_GLB.depth, 2);
         const drawn = fittedBounds(root, ASSETS.dish).box;
         expect(drawn.min.y).toBeCloseTo(0, 3);
         expect(drawn.max.y - drawn.min.y).toBeCloseTo(DISH_HEIGHT, 3);
         expect(drawn.max.x - drawn.min.x).toBeCloseTo(DISH_DRAWN.width, 3);
         expect(drawn.max.z - drawn.min.z).toBeCloseTo(DISH_DRAWN.depth, 3);
         expect(ASSETS.dish.scale).toBeCloseTo(DISH_SCALE, 6);
      } finally { geometry.dispose(); }
   });

   it("gates the dishes to levels 4 and 5 and keeps every spot outside the play bounds", () => {
      expect([...DISH_LEVELS]).toEqual([4, 5]);
      expect(DISH_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(DISH_SPOTS.length).toBeLessThanOrEqual(4);
      const radius = Math.max(DISH_DRAWN.width, DISH_DRAWN.depth) / 2;
      for (const spot of DISH_SPOTS) {
         // The spot's footprint circle must clear the ±STATION.edge arena square.
         const dx = Math.max(PLAY_BOUNDS.minX - spot.x, 0, spot.x - PLAY_BOUNDS.maxX);
         const dz = Math.max(PLAY_BOUNDS.minZ - spot.z, 0, spot.z - PLAY_BOUNDS.maxZ);
         expect(Math.hypot(dx, dz), `dish spot (${spot.x}, ${spot.z})`).toBeGreaterThan(radius);
         // Grounded on the deck, feet at y = 0.
         expect(spot.y).toBe(0);
      }
   });
});
