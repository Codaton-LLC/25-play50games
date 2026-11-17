import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, BIN_PLUSH_WIDTH, BIN_WIDTH, CRATE_WIDTH, GLB_SIZE, HERO_HEIGHT, TOY_ASSETS, TOY_SIZE, WINDUP_SIZE } from "./assets";
import { HERO_CLIPS, ROOT_BONE } from "./heroAnim";
import { CATEGORIES } from "./levels";
import { SHELF_DEPTH, SHELF_H, SHELF_LEN } from "./rules";

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

describe("toy-store-night-shift models", () => {
   it("lists every GLB it uses; the hero is the rigged toy robot (a real skeleton, no auto-rig); no guard", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      for (const cat of CATEGORIES) expect(TOY_ASSETS[cat]).toBeTruthy();
      expect(ASSETS.hero.url).toBe("/models/3d/toy-store-night-shift/toyRobotHero.glb");
      expect(ASSETS.hero.rigged).toBe(true);
      for (const asset of Object.values(ASSETS) as ModelAsset[]) expect(asset.humanoid, asset.url).toBeUndefined();
      for (const asset of Object.values(ASSETS) as ModelAsset[]) if (asset !== ASSETS.hero) expect(asset.rigged, asset.url).toBeFalsy();
      expect(hasModel("/models/3d/toy-store-night-shift/charNightGuard.glb")).toBe(false);
      const scene = readFileSync(new URL("./Scene.tsx", import.meta.url), "utf8");
      expect(scene.includes("<HeroRobot")).toBe(true);
      expect(scene.includes("<HumanoidModel")).toBe(false);
      expect(scene.includes("<Flashlight")).toBe(true);
      expect(scene.includes("light={false}")).toBe(true);
   });

   it("draws the robot at 1.20 m, the shelf 4 x 1.6 x 0.8 m, every toy at its size and the wind-ups at 0.95 m", async () => {
      expect((await drawnSize(ASSETS.hero)).y).toBeCloseTo(HERO_HEIGHT, 2);
      const shelf = await drawnSize(ASSETS.shelf);
      expect(shelf.x).toBeCloseTo(SHELF_LEN, 2);
      expect(shelf.y).toBeCloseTo(SHELF_H, 2);
      expect(shelf.z).toBeCloseTo(SHELF_DEPTH, 2);
      for (const cat of CATEGORIES) {
         const s = await drawnSize(TOY_ASSETS[cat]);
         expect(Math.max(s.x, s.y, s.z), cat).toBeCloseTo(TOY_SIZE[cat], 2);
      }
      expect((await drawnSize(ASSETS.windupRobot)).y).toBeCloseTo(WINDUP_SIZE, 2);
      expect((await drawnSize(ASSETS.windupCar)).z).toBeCloseTo(WINDUP_SIZE, 2);
      expect((await drawnSize(ASSETS.bin)).x).toBeCloseTo(BIN_WIDTH, 2);
      expect((await drawnSize(ASSETS.binPlush)).x).toBeCloseTo(BIN_PLUSH_WIDTH, 2);
      expect((await drawnSize(ASSETS.crate)).x).toBeCloseTo(CRATE_WIDTH, 2);
   });

   it("the constants match the real GLB bounds", async () => {
      const ids: Record<keyof typeof GLB_SIZE, ModelAsset> = {
         hero: ASSETS.hero, teddy: ASSETS.teddy, car: ASSETS.car, airplane: ASSETS.airplane, ball: ASSETS.ball, blocks: ASSETS.blocks, train: ASSETS.train,
         robot: ASSETS.robot, windupRobot: ASSETS.windupRobot, windupCar: ASSETS.windupCar, shelf: ASSETS.shelf, bin: ASSETS.bin, binPlush: ASSETS.binPlush,
      };
      for (const [key, size] of Object.entries(GLB_SIZE) as Array<[keyof typeof GLB_SIZE, { x: number; y: number; z: number }]>) {
         const real = await drawnSize({ ...ids[key], scale: 1, stretch: undefined });
         expect(real.x, `${key}.x`).toBeCloseTo(size.x, 2);
         expect(real.y, `${key}.y`).toBeCloseTo(size.y, 2);
         expect(real.z, `${key}.z`).toBeCloseTo(size.z, 2);
      }
   });
});

describe("tidy-up robot GLB (toyRobotHero)", () => {
   const glb = readFileSync(new URL("../../../../public/models/3d/toy-store-night-shift/toyRobotHero.glb", import.meta.url));
   const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString("utf8")) as {
      skins?: Array<{ joints: number[] }>;
      nodes: Array<{ name?: string }>;
      animations?: Array<{ name?: string; channels: Array<{ target: { node: number; path: string } }> }>;
      meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
      images?: Array<{ mimeType?: string }>;
   };

   it("keeps the Hyper3D skeleton and all six baked clips, within the character budget", () => {
      expect(glb.length).toBeLessThanOrEqual(1_500_000);
      expect(json.skins).toHaveLength(1);
      const joints = json.skins![0].joints.map((j) => json.nodes[j].name);
      for (const name of ["Hips", "Spine", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "RightArm", "RightForeArm", "LeftUpLeg", "RightFoot"]) expect(joints, name).toContain(name);
      const names = (json.animations ?? []).map((a) => a.name);
      for (const clip of Object.values(HERO_CLIPS)) expect(names, clip).toContain(clip);
      // root motion rides on the hips (heroAnim.inPlace strips it)
      const walk = json.animations!.find((a) => a.name === HERO_CLIPS.walk)!;
      expect(walk.channels.some((c) => json.nodes[c.target.node].name === ROOT_BONE && c.target.path === "translation")).toBe(true);
      // one set of four influences: three.js reads JOINTS_0 / WEIGHTS_0 only
      const attrs = json.meshes[0].primitives[0].attributes;
      expect(attrs.JOINTS_0).toBeDefined();
      expect(attrs.JOINTS_1).toBeUndefined();
      for (const image of json.images ?? []) expect(image.mimeType).toBe("image/webp");
   });
});
