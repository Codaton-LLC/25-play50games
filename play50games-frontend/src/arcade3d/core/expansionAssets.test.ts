// Expansion batch 1 GLBs (sharedAssets EXPANSION_ASSETS): listed in the manifest, within the
// catalog's budgets, and drawn at the catalog's target size by their default fit, measured on the
// real, meshopt-decoded meshes through core modelParts (what <Model> / <InstancedModel> draw).
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "./assets";
import { hasModel } from "./modelManifest";
import { readCharacterGlb } from "./rig/robotGlb";
import {
   CAULDRON_INNER_RADIUS_GLB,
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   EXPANSION_GLB_SIZE,
   expansionPoint,
   type ExpansionAssetId,
} from "./sharedAssets";
import type { ModelAsset } from "./types";

const PUBLIC = path.join(process.cwd(), "public");
const IDS = Object.keys(EXPANSION_ASSETS) as ExpansionAssetId[];

/** The catalog's target box in metres (x = width, y = height, z = length along the front); omitted = free. */
const TARGETS: Record<ExpansionAssetId, { x?: number; y?: number; z?: number }> = {
   chest: { x: 0.9, y: 0.6, z: 0.6 },
   cannon: { z: 1.6 },
   rock: { x: 1 },
   fish: { z: 0.35 },
   pineTree: { y: 4 },
   penguin: { y: 0.8 },
   ship: { z: 6 },
   cart: { x: 0.6, y: 1, z: 1 },
   // the shell's height is checked on its own: the trolley handle rises above it
   suitcase: { x: 0.5, z: 0.25 },
   monster: { y: 1.4 },
   cauldron: { x: 0.9 },
};

/** The GLB's vertices as the asset's fit draws them (metres, model origin), via core modelParts. */
async function drawn(asset: Pick<ModelAsset, "url" | "scale" | "stretch" | "rotationY" | "yOffset">): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return points;
}

/** File size and mesh / primitive counts, read from the GLB's JSON chunk. */
function glbInfo(url: string): { bytes: number; meshes: number; primitives: number } {
   const file = path.join(PUBLIC, url);
   const glb = readFileSync(file);
   const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as { meshes: Array<{ primitives: unknown[] }> };
   return { bytes: statSync(file).size, meshes: json.meshes.length, primitives: json.meshes.reduce((n, m) => n + m.primitives.length, 0) };
}

describe("expansion batch 1 GLBs", () => {
   it("every url is in the manifest, a plain prop (no rig, no humanoid)", () => {
      expect(IDS).toHaveLength(11);
      for (const id of IDS) {
         const asset = EXPANSION_ASSETS[id];
         expect(asset.id).toBe(id);
         expect(asset.url).toMatch(new RegExp(`^/models/3d/[a-z-]+/${id}\\.glb$`));
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(asset.rigged).toBeFalsy();
         expect(asset.humanoid).toBeUndefined();
      }
   });

   it("is within its budget: the file size, one mesh of one primitive, the triangle cap", async () => {
      for (const id of IDS) {
         const asset = EXPANSION_ASSETS[id];
         const info = glbInfo(asset.url);
         expect(info.bytes, `${id} bytes`).toBeLessThanOrEqual(asset.budget.bytes);
         expect(info.bytes, `${id} bytes`).toBeLessThanOrEqual(300_000);
         expect(info.meshes, id).toBe(1);
         expect(info.primitives, id).toBe(1);
         const { indices } = await readCharacterGlb(asset.url);
         expect(indices.length / 3, `${id} tris`).toBeLessThanOrEqual(asset.budget.tris);
      }
      // the catalog's caps (§E.4)
      const caps: Record<ExpansionAssetId, number> = { chest: 4000, cannon: 4000, rock: 3000, fish: 1500, pineTree: 3000, penguin: 8000, ship: 5000, cart: 4000, suitcase: 2500, monster: 8000, cauldron: 3000 };
      for (const id of IDS) expect(EXPANSION_ASSETS[id].budget.tris, id).toBeLessThanOrEqual(caps[id]);
   });

   it("EXPANSION_GLB_SIZE is the real meshes' bounds, centred on x / z, standing on y = 0", async () => {
      for (const id of IDS) {
         const box = new Box3().setFromPoints(await drawn({ url: EXPANSION_ASSETS[id].url }));
         const size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
         const glb = EXPANSION_GLB_SIZE[id];
         expect(Math.abs(size.x - glb.width), `${id} width ${size.x}`).toBeLessThan(0.002);
         expect(Math.abs(size.y - glb.height), `${id} height ${size.y}`).toBeLessThan(0.002);
         expect(Math.abs(size.z - glb.depth), `${id} depth ${size.z}`).toBeLessThan(0.002);
         expect(Math.abs(box.min.y), `${id} foot`).toBeLessThan(0.002);
         expect(Math.abs(centre.x) + Math.abs(centre.z), `${id} centre`).toBeLessThan(0.002);
      }
   });

   it("the default fit draws each model at the catalog's target size (within 2 %), on the floor", async () => {
      for (const id of IDS) {
         const asset = EXPANSION_ASSETS[id];
         const box = new Box3().setFromPoints(await drawn(asset));
         const size = box.getSize(new Vector3());
         expect(Math.abs(box.min.y), `${id} foot`).toBeLessThan(0.002);
         const target = TARGETS[id];
         for (const axis of ["x", "y", "z"] as const) {
            const want = target[axis];
            if (want === undefined) continue;
            expect(Math.abs(size[axis] / want - 1), `${id} ${axis} ${size[axis].toFixed(3)} vs ${want}`).toBeLessThan(0.02);
         }
         // stretch fixes proportions only: keep it within a third of 1
         for (const k of asset.stretch ?? [1, 1, 1]) expect(Math.abs(k - 1), `${id} stretch`).toBeLessThan(0.3);
      }
   });

   it("the rock's longest side is its 1 m unit; the suitcase's shell is 0.7 m tall", async () => {
      const rock = new Box3().setFromPoints(await drawn(EXPANSION_ASSETS.rock)).getSize(new Vector3());
      expect(Math.max(rock.x, rock.y, rock.z)).toBeCloseTo(1, 2);
      const shell = expansionPoint(EXPANSION_ASSETS.suitcase, EXPANSION_GLB_POINTS.suitcaseShellTop);
      expect(Math.abs(shell.y / 0.7 - 1)).toBeLessThan(0.02);
   });

   it("the measured points lie on the meshes, and the fronts face +z", async () => {
      const near = (points: Vector3[], p: { x: number; y: number; z: number }) => Math.min(...points.map((q) => q.distanceTo(new Vector3(p.x, p.y, p.z))));

      // cannon: the muzzle centre on the barrel's front face, at +z, the ring around it within 0.2 m
      const cannon = await drawn(EXPANSION_ASSETS.cannon);
      const muzzle = expansionPoint(EXPANSION_ASSETS.cannon, EXPANSION_GLB_POINTS.cannonMuzzle);
      expect(muzzle.z).toBeCloseTo(0.8, 2);
      expect(near(cannon, muzzle)).toBeLessThan(0.2);
      expect(muzzle.y).toBeGreaterThan(0.75);

      // cart: the push bar is at +z, about 0.94 m up, its top the cart's top
      const cartAsset = EXPANSION_ASSETS.cart;
      const cart = await drawn(cartAsset);
      const handle = expansionPoint(cartAsset, EXPANSION_GLB_POINTS.cartHandle);
      expect(handle.z).toBeGreaterThan(0.3);
      expect(handle.y).toBeGreaterThan(0.9);
      expect(near(cart, handle)).toBeLessThan(0.05);
      const top = cart.filter((p) => p.y > 0.95);
      expect(Math.min(...top.map((p) => p.z)), "only the handle is that high").toBeGreaterThan(0.25);

      // ship: the deck edge and waterline between the keel and the sail
      const ship = expansionPoint(EXPANSION_ASSETS.ship, EXPANSION_GLB_POINTS.shipDeck);
      const water = expansionPoint(EXPANSION_ASSETS.ship, EXPANSION_GLB_POINTS.shipWaterline);
      expect(water.y).toBeGreaterThan(0.4);
      expect(water.y).toBeLessThan(ship.y);

      // cauldron: inner rim above its floor, below the outer rim, inside the outer radius
      const pot = await drawn(EXPANSION_ASSETS.cauldron);
      const rim = expansionPoint(EXPANSION_ASSETS.cauldron, EXPANSION_GLB_POINTS.cauldronInnerRim);
      const floor = expansionPoint(EXPANSION_ASSETS.cauldron, EXPANSION_GLB_POINTS.cauldronInnerFloor);
      const potTop = Math.max(...pot.map((p) => p.y));
      expect(rim.y).toBeLessThan(potTop);
      expect(rim.y).toBeGreaterThan(potTop - 0.02);
      expect(floor.y).toBeLessThan(rim.y);
      const innerRadius = CAULDRON_INNER_RADIUS_GLB * (EXPANSION_ASSETS.cauldron.scale ?? 1);
      // the opening: nothing of the pot inside the inner radius in the top 10 cm below the rim
      const inside = pot.filter((p) => p.y > rim.y - 0.1 && p.y < rim.y - 0.01 && Math.hypot(p.x, p.z) < innerRadius - 0.01);
      expect(inside.length).toBe(0);
   });
});
