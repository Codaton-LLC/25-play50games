// Expansion GLBs (sharedAssets EXPANSION_ASSETS, batches 1-3 and tier 3): listed in the manifest, within the
// catalog's budgets, and drawn at the catalog's target size by their default fit, measured on the
// real, meshopt-decoded meshes through core modelParts (what <Model> / <InstancedModel> draw).
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { modelParts } from "./assets";
import { hasModel } from "./modelManifest";
import { readCharacterGlb } from "./rig/robotGlb";
import {
   CAULDRON_INNER_RADIUS_GLB,
   CHARACTER_BUDGET,
   DRONE_ROTORS_GLB,
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   EXPANSION_GLB_SIZE,
   expansionPoint,
   LEAFY_TREE_TRUNK_RADIUS_GLB,
   PROP_BUDGET,
   ROCKET_FEET_GLB,
   WINDMILL_TUNNEL_GLB,
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
   // batch 2-3
   dino: { y: 0.8, z: 1.1 },
   drone: { x: 0.9 },
   rocket: { y: 2.2 },
   windmill: { y: 2.2 },
   leafyTree: { y: 3.5 },
   vacuum: { y: 0.55 },
   dummy: { y: 1.5 },
   goblin: { y: 0.9 },
   castleTower: { y: 6 },
   glowPod: { y: 1 },
   panda: { z: 1 },
   // tier 3
   bust: { y: 0.6 },
   mushroom: { y: 0.5 },
   plane: { z: 8 },
   crab: { x: 0.35 },
   gourd: { y: 0.6 },
};

/** Solid creatures optimized with the character profile (1024 px textures, up to 1.5 MB). */
const CREATURES: readonly ExpansionAssetId[] = ["dino", "panda"];

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

/** The first point where a ray (metres, model origin) meets the GLB as the asset's fit draws it, or null. */
async function rayHit(asset: Pick<ModelAsset, "url" | "scale" | "stretch" | "rotationY" | "yOffset">, origin: Vector3, direction: Vector3): Promise<Vector3 | null> {
   const { local, indices, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   geometry.setIndex(Array.from(indices));
   const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   mesh.position.set(0, 0, 0);
   mesh.matrixAutoUpdate = false;
   mesh.matrix.copy(parts[0].matrix);
   mesh.matrixWorld.copy(parts[0].matrix);
   const hits = new Raycaster(origin, direction.clone().normalize()).intersectObject(mesh, false);
   geometry.dispose();
   return hits.length ? hits[0].point.clone() : null;
}

/** File size and mesh / primitive counts, read from the GLB's JSON chunk. */
function glbInfo(url: string): { bytes: number; meshes: number; primitives: number } {
   const file = path.join(PUBLIC, url);
   const glb = readFileSync(file);
   const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as { meshes: Array<{ primitives: unknown[] }> };
   return { bytes: statSync(file).size, meshes: json.meshes.length, primitives: json.meshes.reduce((n, m) => n + m.primitives.length, 0) };
}

describe("expansion GLBs", () => {
   it("every url is in the manifest, a plain prop (no rig, no humanoid)", () => {
      expect(IDS).toHaveLength(27);
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
         expect(asset.budget.bytes, id).toBe(CREATURES.includes(id) ? CHARACTER_BUDGET.bytes : PROP_BUDGET.bytes);
         expect(info.meshes, id).toBe(1);
         expect(info.primitives, id).toBe(1);
         const { indices } = await readCharacterGlb(asset.url);
         expect(indices.length / 3, `${id} tris`).toBeLessThanOrEqual(asset.budget.tris);
      }
      // the catalog's caps (§E.4)
      const caps: Record<ExpansionAssetId, number> = {
         chest: 4000, cannon: 4000, rock: 3000, fish: 1500, pineTree: 3000, penguin: 8000, ship: 5000, cart: 4000, suitcase: 2500, monster: 8000, cauldron: 3000,
         dino: 12000, drone: 3000, rocket: 3000, windmill: 4000, leafyTree: 3000, vacuum: 2500, dummy: 3000, goblin: 4500, castleTower: 4000, glowPod: 2000, panda: 10000,
         bust: 3000, mushroom: 2000, plane: 4000, crab: 2000, gourd: 3000,
      };
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
   it("batch 2-3: the measured points lie on the meshes", async () => {
      const near = (points: Vector3[], p: { x: number; y: number; z: number }) => Math.min(...points.map((q) => q.distanceTo(new Vector3(p.x, p.y, p.z))));
      const at = (id: ExpansionAssetId, p: { x: number; y: number; z: number }) => expansionPoint(EXPANSION_ASSETS[id], p);
      const P = EXPANSION_GLB_POINTS;

      // dino: the back's top at mid-body, the topmost point of the body there (1 cm), about 0.41 m up
      const dino = await drawn(EXPANSION_ASSETS.dino);
      const back = at("dino", P.dinoBackTop);
      expect(near(dino, back)).toBeLessThan(0.03);
      expect(Math.max(...dino.filter((p) => Math.abs(p.x) < 0.03 && Math.abs(p.z - back.z) < 0.03).map((p) => p.y))).toBeLessThan(back.y + 0.01);
      expect(back.y).toBeGreaterThan(0.38);
      expect(back.y).toBeLessThan(0.44);

      // drone: the claw is its lowest part, under the nose (+z); the rotor rings sit above it, two each side
      const drone = await drawn(EXPANSION_ASSETS.drone);
      const hook = at("drone", P.droneHook);
      expect(near(drone, hook)).toBeLessThan(0.03);
      expect(hook.z).toBeGreaterThan(0.1);
      expect(hook.y).toBeLessThan(0.03);
      for (const r of DRONE_ROTORS_GLB) {
         const c = at("drone", r);
         expect(c.y, "rotor above the claw").toBeGreaterThan(hook.y + 0.25);
         expect(Math.abs(c.x)).toBeGreaterThan(0.2);
      }
      expect(DRONE_ROTORS_GLB.filter((r) => r.x < 0)).toHaveLength(2);

      // rocket: the bell's rim is above the feet, hollow inside; the four feet stand on the floor around it
      const rocket = await drawn(EXPANSION_ASSETS.rocket);
      const bell = at("rocket", P.rocketBell);
      expect(bell.y).toBeGreaterThan(0.1);
      expect(bell.y).toBeLessThan(0.2);
      expect(rocket.filter((p) => Math.hypot(p.x, p.z) < 0.15 && p.y < bell.y - 0.01)).toHaveLength(0);
      for (const f of ROCKET_FEET_GLB) {
         const c = at("rocket", f);
         expect(rocket.some((p) => p.y < 0.03 && Math.hypot(p.x - c.x, p.z - c.z) < 0.15), "a foot pad on the floor").toBe(true);
         expect(Math.hypot(c.x, c.z)).toBeGreaterThan(0.45);
      }

      // windmill: the hub on its front face; the tunnel is open straight through along z, a 0.25 m ball fits
      const mill = await drawn(EXPANSION_ASSETS.windmill);
      const hub = at("windmill", P.windmillHub);
      expect(near(mill, hub)).toBeLessThan(0.08);
      expect(hub.z).toBeGreaterThan(0.6);
      expect(hub.y).toBeGreaterThan(1.05);
      const s = EXPANSION_ASSETS.windmill.scale ?? 1;
      const clearX = (WINDMILL_TUNNEL_GLB.clearWidth / 2) * s, clearY = WINDMILL_TUNNEL_GLB.clearHeight * s;
      expect(mill.filter((p) => Math.abs(p.x) < clearX && p.y > 0.005 && p.y < clearY)).toHaveLength(0);
      expect(WINDMILL_TUNNEL_GLB.width * s).toBeGreaterThan(0.25);
      expect(WINDMILL_TUNNEL_GLB.height * s).toBeGreaterThan(0.25);

      // castle tower: the walkway inside the battlements, below its top
      const tower = await drawn(EXPANSION_ASSETS.castleTower);
      const walk = at("castleTower", P.castleTowerPlatform);
      const ring = tower.filter((p) => Math.abs(Math.hypot(p.x, p.z) - 0.55 * (EXPANSION_ASSETS.castleTower.scale ?? 1)) < 0.1 && Math.abs(p.y - walk.y) < 0.05);
      expect(ring.length).toBeGreaterThan(0);
      expect(walk.y).toBeGreaterThan(4);
      expect(walk.y).toBeLessThan(5);

      // vacuum: the connector on top; the dummy's pivot at the base; the trunk circle covers the trunk
      const vacuum = await drawn(EXPANSION_ASSETS.vacuum);
      expect(near(vacuum, at("vacuum", P.vacuumHose))).toBeLessThan(0.02);
      // (2026-10-09) the straps are gone: nothing lies more than 2 cm behind the pack's back, and the back
      // point is where a ray from behind first meets the mesh, halfway up the body
      const packBack = at("vacuum", P.vacuumBack);
      expect(Math.min(...vacuum.map((p) => p.z)), "no strap behind the back").toBeGreaterThan(packBack.z - 0.02);
      expect(near(vacuum, packBack)).toBeLessThan(0.025);
      const hit = await rayHit(EXPANSION_ASSETS.vacuum, new Vector3(packBack.x, packBack.y, -2), new Vector3(0, 0, 1));
      expect(hit, "a ray from behind meets the back").not.toBeNull();
      expect(hit!.distanceTo(new Vector3(packBack.x, packBack.y, packBack.z))).toBeLessThan(0.005);
      const packBox = new Box3().setFromPoints(vacuum);
      expect(packBack.y / packBox.max.y).toBeGreaterThan(0.4);
      expect(packBack.y / packBox.max.y).toBeLessThan(0.55);
      expect(at("dummy", P.dummyPivot).y).toBe(0);
      const tree = await drawn(EXPANSION_ASSETS.leafyTree);
      const r = LEAFY_TREE_TRUNK_RADIUS_GLB * (EXPANSION_ASSETS.leafyTree.scale ?? 1);
      const trunk = tree.filter((p) => p.y > 0.2 && p.y < 0.6 && Math.hypot(p.x, p.z) < 0.6);
      expect(trunk.length).toBeGreaterThan(0);
      expect(Math.max(...trunk.map((p) => Math.hypot(p.x, p.z)))).toBeLessThan(r + 0.01);
   });
   it("v2 suitcase: only the trolley handle rises above the shell; tier 3 fronts face +z", async () => {
      const suitcase = await drawn(EXPANSION_ASSETS.suitcase);
      const shellTop = expansionPoint(EXPANSION_ASSETS.suitcase, EXPANSION_GLB_POINTS.suitcaseShellTop).y;
      const above = suitcase.filter((p) => p.y > shellTop + 0.05);
      expect(above.length).toBeGreaterThan(0);
      expect(Math.max(...above.map((p) => Math.abs(p.x))), "the handle is narrower than the shell").toBeLessThan(0.15);
      expect(Math.max(...above.map((p) => p.z)), "the handle stands at the back").toBeLessThan(0);

      // the plane's nose (propeller) is the +z end, on the centre line; the wings spread along x
      const plane = await drawn(EXPANSION_ASSETS.plane);
      const nose = Math.max(...plane.map((p) => p.z));
      for (const p of plane.filter((q) => q.z > nose - 0.3)) expect(Math.abs(p.x)).toBeLessThan(0.6);
      const span = new Box3().setFromPoints(plane).getSize(new Vector3());
      expect(span.x).toBeGreaterThan(span.z);

      // the crab's eyes sit on the front of its shell: the upper part of the model leans to +z
      const crab = await drawn(EXPANSION_ASSETS.crab);
      const top = Math.max(...crab.map((p) => p.y));
      const upper = crab.filter((q) => q.y > top * 0.7);
      expect(upper.reduce((sum, p) => sum + p.z, 0) / upper.length).toBeGreaterThan(0.01);
   });
});
