import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { modelParts } from "@/arcade3d/core/assets";
import { MODEL_MANIFEST } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, AURORA_CRYSTAL_GLB, AURORA_CRYSTAL_HEIGHT, AURORA_CRYSTAL_LATERAL, BELLY_LIFT, BELLY_ROTATION_Y, FLAG_BOUNDS, GLACIER_CHUNK_GLB, GLACIER_CHUNK_LATERAL, GLACIER_CHUNK_WIDTH, ICE_ARCH_GLB, ICE_ARCH_LATERAL, ICE_ARCH_WIDTH, PENGUIN_SCALE, SNOWMAN_GLB, SNOWMAN_SCALE, bellyClearance } from "./assets";
import { PLAY_BOUNDS } from "./looks";
import { COURSE } from "./rules";

interface Glb {
   accessors: Array<{ min: number[]; max: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: { POSITION: number } }> }>;
   nodes: Array<{ mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }>;
   scenes: Array<{ nodes: number[] }>; scene?: number;
}

function bounds(url: string): Box3 {
   const bytes = readFileSync(resolve("public", url.slice(1)));
   expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
   const glb: Glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString("utf8"));
   const result = new Box3();
   function visit(index: number, parent: Matrix4) {
      const node = glb.nodes[index];
      const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3().fromArray(node.translation ?? [0, 0, 0]), new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]), new Vector3().fromArray(node.scale ?? [1, 1, 1]));
      const world = new Matrix4().multiplyMatrices(parent, local);
      if (node.mesh !== undefined) for (const primitive of glb.meshes[node.mesh].primitives) {
         const accessor = glb.accessors[primitive.attributes.POSITION];
         result.union(new Box3(new Vector3().fromArray(accessor.min), new Vector3().fromArray(accessor.max)).applyMatrix4(world));
      }
      for (const child of node.children ?? []) visit(child, world);
   }
   for (const node of glb.scenes[glb.scene ?? 0].nodes) visit(node, new Matrix4());
   return result;
}

/** Decode a prop GLB and draw it through core modelParts (what the instanced pool draws). */
async function fittedBox(url: string, asset: Parameters<typeof modelParts>[1]): Promise<Box3> {
   expect(existsSync(resolve("public", url.slice(1)))).toBe(true);
   const { local, node } = await readCharacterGlb(url);
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

describe("penguin-slide real GLB fits", () => {
   it("fits the solid penguin to 1 m standing and its resting belly clears by 1 cm", () => {
      const box = bounds(ASSETS.penguin.url);
      const size = box.getSize(new Vector3());
      expect(size.x).toBeCloseTo(EXPANSION_GLB_SIZE.penguin.width, 3);
      expect(size.y * PENGUIN_SCALE).toBeCloseTo(1, 3);
      expect(size.z).toBeCloseTo(EXPANSION_GLB_SIZE.penguin.depth, 3);
      const belly = box.clone().applyMatrix4(new Matrix4().makeScale(PENGUIN_SCALE, PENGUIN_SCALE, PENGUIN_SCALE)).applyMatrix4(new Matrix4().makeRotationY(BELLY_ROTATION_Y)).applyMatrix4(new Matrix4().makeRotationX(-Math.PI / 2));
      expect(belly.min.y + BELLY_LIFT).toBeCloseTo(0.01, 3);
      expect(ASSETS.penguin.humanoid).toBeUndefined();
   });

   it("points the real fitted GLB belly down and head down-track", () => {
      const box = bounds(ASSETS.penguin.url);
      expect(box.getSize(new Vector3()).y * PENGUIN_SCALE).toBeCloseTo(1, 3);
      const fit = new Matrix4().makeRotationX(-Math.PI / 2).multiply(new Matrix4().makeRotationY(BELLY_ROTATION_Y));
      expect(new Vector3(0, 0, 1).transformDirection(fit).y).toBeCloseTo(-1, 8);
      const head = new Vector3(0, box.max.y, 0).sub(new Vector3(0, box.min.y, 0)).transformDirection(fit);
      expect(head.z).toBeCloseTo(-1, 8);
   });

   it("fits fish and trees from shared measured bounds", () => {
      const fish = bounds(ASSETS.fish.url).getSize(new Vector3());
      const pine = bounds(ASSETS.pine.url).getSize(new Vector3());
      expect(fish.z * ASSETS.fish.scale).toBeCloseTo(0.6, 3);
      expect(pine.y * ASSETS.pine.scale).toBeCloseTo(4, 3);
   });

   it("keeps the belly within 1 cm of the slope through all cosmetic banks", () => {
      const box = bounds(ASSETS.penguin.url);
      for (const grade of [0.03, 0.055, 0.08]) for (const degrees of [-12, -6, 0, 6, 12]) {
         const roll = degrees * Math.PI / 180;
         const transform = new Matrix4().makeRotationZ(roll).multiply(new Matrix4().makeTranslation(0, BELLY_LIFT, 0)).multiply(new Matrix4().makeRotationX(-Math.PI / 2 - Math.atan(grade))).multiply(new Matrix4().makeTranslation(0, -0.5, 0)).multiply(new Matrix4().makeRotationY(BELLY_ROTATION_Y)).multiply(new Matrix4().makeScale(PENGUIN_SCALE, PENGUIN_SCALE, PENGUIN_SCALE));
         let lowest = Infinity;
         for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
            const point = new Vector3(x, y, z).applyMatrix4(transform);
            lowest = Math.min(lowest, point.y - grade * point.z + bellyClearance(grade, roll));
         }
         expect(lowest).toBeCloseTo(0.01, 3);
      }
   });

   it("keeps the floor-normalized checkpoint flag's pole on the surface and fits 1.5 m", () => {
      const box = bounds(ASSETS.flag.url);
      expect(box.min.y).toBeCloseTo(FLAG_BOUNDS.minY, 5);
      expect(box.getSize(new Vector3()).y * ASSETS.flag.scale).toBeCloseTo(1.5, 5);
      expect(box.min.y * ASSETS.flag.scale + ASSETS.flag.yOffset).toBeCloseTo(0, 5);
   });

   it("fits the snowman GLB to the old obstacle: 1.4 m tall, 0.5 m base, base on y = 0, face +z", async () => {
      // decode the real meshopt-decoded mesh and draw it through core modelParts (what the pool draws)
      const { local, node } = await readCharacterGlb(ASSETS.snowman.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      const mesh = new Mesh(geometry);
      mesh.position.fromArray(node);
      const root = new Group();
      root.add(mesh);
      const parts = modelParts(root, ASSETS.snowman);
      expect(parts).toHaveLength(1);
      const points: Vector3[] = [];
      for (let i = 0; i < local.length; i += 3)
         points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
      geometry.dispose();
      const box = new Box3().setFromPoints(points);
      // within 3 % of the replaced primitive (README: diameter 1 / height 1.4; old head top 1.35)
      const height = box.max.y - box.min.y;
      expect(height).toBeCloseTo(SNOWMAN_GLB.height * SNOWMAN_SCALE, 3);
      expect(height).toBeGreaterThan(1.4 * 0.97);
      expect(height).toBeLessThan(1.4 * 1.03);
      // the base ball stays on the rules' 0.5 m collision circle
      let base = 0;
      for (const p of points) if (p.y < 0.45) base = Math.max(base, Math.hypot(p.x, p.z));
      expect(base).toBeGreaterThan(0.5 * 0.97);
      expect(base).toBeLessThan(0.5 * 1.03);
      expect(box.min.y).toBeCloseTo(0, 3);
      // no rotationY: the carrot nose stays at +z, facing up the track toward the camera like before
      let nose: Vector3 | null = null;
      for (const p of points) if (p.y > 0.9 && (!nose || p.z > nose.z)) nose = p;
      expect(nose!.z).toBeGreaterThan(0.4);
   });

   it("fits the ice arch beside the course, clear of the widest half-width", async () => {
      expect(existsSync(resolve("public", ASSETS.iceArch.url.slice(1)))).toBe(true);
      const { local, node } = await readCharacterGlb(ASSETS.iceArch.url);
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
      const mesh = new Mesh(geometry);
      mesh.position.fromArray(node);
      const root = new Group();
      root.add(mesh);
      const parts = modelParts(root, ASSETS.iceArch);
      expect(parts).toHaveLength(1);
      const box = new Box3();
      const v = new Vector3();
      for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
      geometry.dispose();
      expect(box.min.y).toBeCloseTo(0, 2);
      expect(box.max.x - box.min.x).toBeCloseTo(ICE_ARCH_WIDTH, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(ICE_ARCH_GLB.height * (ICE_ARCH_WIDTH / ICE_ARCH_GLB.width), 2);
      expect(ICE_ARCH_LATERAL - ICE_ARCH_WIDTH / 2).toBeGreaterThan(COURSE.width + 1);
   });

   it("lists the level 4-5 decor GLBs in the manifest and on disk", () => {
      expect(MODEL_MANIFEST).toContain(ASSETS.auroraCrystal.url);
      expect(MODEL_MANIFEST).toContain(ASSETS.glacierChunk.url);
      expect(existsSync(resolve("public", ASSETS.auroraCrystal.url.slice(1)))).toBe(true);
      expect(existsSync(resolve("public", ASSETS.glacierChunk.url.slice(1)))).toBe(true);
   });

   it("fits the aurora crystal to a 2.4 m spire and the glacier chunk to 2.8 m, both sitting on the snow", async () => {
      const crystal = await fittedBox(ASSETS.auroraCrystal.url, ASSETS.auroraCrystal);
      expect(crystal.min.y).toBeCloseTo(0, 2);
      expect(crystal.max.y - crystal.min.y).toBeCloseTo(AURORA_CRYSTAL_HEIGHT, 2);
      expect(crystal.max.x - crystal.min.x).toBeCloseTo(AURORA_CRYSTAL_GLB.width * ASSETS.auroraCrystal.scale!, 2);
      const glacier = await fittedBox(ASSETS.glacierChunk.url, ASSETS.glacierChunk);
      expect(glacier.min.y).toBeCloseTo(0, 2);
      expect(glacier.max.x - glacier.min.x).toBeCloseTo(GLACIER_CHUNK_WIDTH, 2);
   });

   it("keeps the level 4-5 decor spots outside the play bounds", () => {
      const crystalInner = AURORA_CRYSTAL_LATERAL - (AURORA_CRYSTAL_GLB.width * ASSETS.auroraCrystal.scale!) / 2;
      const glacierInner = GLACIER_CHUNK_LATERAL - (GLACIER_CHUNK_GLB.width * ASSETS.glacierChunk.scale!) / 2;
      // strictly outside the play bounds' widest lateral reach
      expect(crystalInner).toBeGreaterThan(PLAY_BOUNDS.x1);
      expect(glacierInner).toBeGreaterThan(PLAY_BOUNDS.x1);
      // same margin proof as the ice arch: fully outside the widest corridor half-width
      expect(crystalInner).toBeGreaterThan(COURSE.width + 1);
      expect(glacierInner).toBeGreaterThan(COURSE.width + 1);
   });
});
