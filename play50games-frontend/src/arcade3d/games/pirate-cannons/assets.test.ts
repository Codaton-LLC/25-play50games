// Pirate Cannon Battle's fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <Model> / <InstancedModel> / <DynamicInstancedModel> draw): every model is in the manifest and
// drawn at the README's size; the ship's waterline sits on the water; the drawn muzzle is the rules'
// muzzle at every aim; the parapet stays under the lowest shot.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_POINTS } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { AIM } from "./aim";
import { ASSETS, BARREL_HEIGHT, CRATE_SIZE, PALM_SIZE, SHIP_WATERLINE } from "./assets";
import { cannonMatrix } from "./cannonPose";
import { FORT } from "./looks";
import { CANNON, SHIPS, SHIP_TYPES, WORLD, ballAt, launchState, muzzleAt } from "./rules";

/** The GLB's vertices as the asset's fit draws them (metres, model origin), optionally placed by `spot`. */
async function drawn(asset: ModelAsset, spot = new Matrix4()): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const m = spot.clone().multiply(parts[0].matrix);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(m));
   geometry.dispose();
   return points;
}
const sizeOf = (points: Vector3[]) => new Box3().setFromPoints(points).getSize(new Vector3());
const DEG = Math.PI / 180;

describe("pirate-cannons models", () => {
   it("are all in the manifest (the ship is this game's own GLB)", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.ship.url).toBe("/models/3d/pirate-cannons/ship.glb");
   });

   it("draw the dinghy, sloop and galleon 3 / 6 / 9 m long with the waterline on the water", async () => {
      for (const type of SHIP_TYPES) {
         const k = SHIPS[type].scale;
         const points = await drawn(ASSETS.ship, new Matrix4().makeScale(k, k, k));
         expect(sizeOf(points).z).toBeCloseTo(SHIPS[type].length, 2);
         expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(-SHIP_WATERLINE * k, 2);
      }
      // the waterline is the hull's widest band: the keel is under the water, the deck above it
      expect(SHIP_WATERLINE).toBeCloseTo(EXPANSION_GLB_POINTS.shipWaterline.y * (6 / 1.8944), 3);
   });

   it("draw the props at the README's sizes", async () => {
      const barrel = await drawn(ASSETS.barrel);
      expect(sizeOf(barrel).y).toBeCloseTo(BARREL_HEIGHT, 2);
      expect(Math.min(...barrel.map((p) => p.y))).toBeCloseTo(-BARREL_HEIGHT / 2, 2);
      const palm = sizeOf(await drawn(ASSETS.palm));
      expect(palm.y).toBeCloseTo(PALM_SIZE.height, 2);
      expect(palm.x).toBeCloseTo(PALM_SIZE.crown, 2);
      expect(sizeOf(await drawn(ASSETS.crate)).x).toBeCloseTo(CRATE_SIZE, 2);
      const chest = sizeOf(await drawn(ASSETS.chest));
      expect([chest.x, chest.y, chest.z].map((v) => +v.toFixed(2))).toEqual([0.9, 0.6, 0.6]);
      expect(sizeOf(await drawn(ASSETS.cannon)).z).toBeCloseTo(1.6, 2);
   });

   it("tips the cannon about its wheel centre, and the drawn muzzle ring is the rules' muzzle within 5 cm", async () => {
      const glb = await readCharacterGlb(ASSETS.cannon.url);
      const c = glb.cloud;
      // the wheels (|x| > 0.5): their centre is the axle
      // the muzzle ring: the box of the barrel's last 10 cm (its face is slanted with the barrel)
      const wheel = new Box3();
      const mouth = new Box3();
      for (let i = 0; i < c.length; i += 3) {
         if (Math.abs(c[i]) > 0.5) wheel.expandByPoint(new Vector3(c[i], c[i + 1], c[i + 2]));
         if (c[i + 2] > EXPANSION_GLB_POINTS.cannonMuzzle.z - 0.1) mouth.expandByPoint(new Vector3(c[i], c[i + 1], c[i + 2]));
      }
      const ring = mouth.getCenter(new Vector3());
      const axle = wheel.getCenter(new Vector3());
      expect(Math.abs(axle.y - CANNON.axleGlb.y)).toBeLessThan(0.02);
      expect(Math.abs(axle.z - CANNON.axleGlb.z)).toBeLessThan(0.03);
      ring.multiplyScalar(CANNON.scale);
      for (const yaw of [-AIM.yawMax, 0, AIM.yawMax])
         for (const el of [0, AIM.elMax]) {
            const at = ring.clone().applyMatrix4(cannonMatrix(yaw, el, 0, new Matrix4()));
            const rules = muzzleAt(yaw, el, { x: 0, y: 0, z: 0 });
            expect(at.distanceTo(new Vector3(rules.x, rules.y, rules.z)), `yaw ${yaw} el ${el}`).toBeLessThan(0.05);
         }
   });

   it("keeps the parapet under the lowest shot (elevation 0) at every yaw", () => {
      const scratch = new Float32Array(6);
      const p = { x: 0, y: 0, z: 0 };
      for (let yaw = -AIM.yawMax; yaw <= AIM.yawMax + 1e-9; yaw += 5 * DEG) {
         const ball = { launch: launchState(yaw, 0, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), params: { gravity: WORLD.gravity, wind: { x: 0, z: 0 } } };
         for (let t = 0.005; t < 0.5; t += 0.005) {
            ballAt(ball, t, scratch, p);
            const overWall = p.z <= FORT.front && p.z >= FORT.front - FORT.parapetDepth && Math.abs(p.x) <= FORT.halfX;
            if (overWall) expect(p.y - WORLD.ballRadius).toBeGreaterThan(FORT.parapetTop);
         }
      }
   });
});
