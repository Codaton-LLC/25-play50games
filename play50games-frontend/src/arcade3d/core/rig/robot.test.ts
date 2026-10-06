// The auto-rig on the real shared robot (public/models/3d/shared/robot.glb, read and meshopt-decoded
// here without a loader): the measured ROBOT_LANDMARKS match what the heuristics find, and its
// arms-down and carry poses keep the hands clear of the body. A new robot.glb must be re-measured.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { ROBOT_LANDMARKS, SHARED_ASSETS } from "../sharedAssets";
import { estimateHumanoidLandmarks, type HumanoidLandmarks } from "./humanoid";
import { armsDownPose, carryPose, createPose, restPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose, buildHumanoidTemplate, cloneHumanoid } from "./skinning";

interface GltfJson {
   nodes: Array<{ mesh?: number; translation?: number[] }>;
   meshes: Array<{ primitives: Array<{ attributes: Record<string, number> }> }>;
   accessors: Array<{ bufferView: number; byteOffset?: number; count: number; componentType: number }>;
   bufferViews: Array<{
      byteOffset?: number;
      byteLength: number;
      byteStride?: number;
      extensions?: { EXT_meshopt_compression?: { byteOffset?: number; byteLength: number; byteStride: number; count: number; mode: string; filter?: string } };
   }>;
}

/** The robot's POSITION accessor (float, GLB root space after its node translation) and that translation. */
async function readRobot(): Promise<{ positions: Float32Array; node: number[] }> {
   const glb = readFileSync(path.join(process.cwd(), "public/models/3d/shared/robot.glb"));
   const jsonLength = glb.readUInt32LE(12);
   const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as GltfJson;
   const binStart = 20 + jsonLength + 8;
   const node = json.nodes.find((n) => n.mesh === 0)!;
   const accessor = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
   expect(accessor.componentType).toBe(5126); // float positions (optimize keeps them unquantized)
   const view = json.bufferViews[accessor.bufferView];
   const meshopt = view.extensions?.EXT_meshopt_compression;
   let data: Uint8Array;
   if (meshopt) {
      await MeshoptDecoder.ready;
      data = new Uint8Array(meshopt.count * meshopt.byteStride);
      const source = new Uint8Array(glb.buffer, glb.byteOffset + binStart + (meshopt.byteOffset ?? 0), meshopt.byteLength);
      MeshoptDecoder.decodeGltfBuffer(data, meshopt.count, meshopt.byteStride, source, meshopt.mode, meshopt.filter ?? "NONE");
   } else {
      data = new Uint8Array(glb.buffer, glb.byteOffset + binStart + (view.byteOffset ?? 0), view.byteLength).slice();
   }
   const stride = (view.byteStride ?? meshopt?.byteStride ?? 12) / 4;
   const floats = new Float32Array(data.buffer, data.byteOffset + (accessor.byteOffset ?? 0), (accessor.count - 1) * stride + 3);
   const t = node.translation ?? [0, 0, 0];
   const positions = new Float32Array(accessor.count * 3);
   for (let i = 0; i < accessor.count; i++) for (let a = 0; a < 3; a++) positions[i * 3 + a] = floats[i * stride + a];
   return { positions, node: t };
}

let local: Float32Array;
let node: number[];
let cloud: Float32Array;

beforeAll(async () => {
   ({ positions: local, node } = await readRobot());
   cloud = Float32Array.from(local, (v, i) => v + node[i % 3]);
});

/** The robot as a GLB scene (mesh under its translated node), auto-rigged with its committed landmarks, in `pose`. */
function skinnedRobot(pose: HumanoidPose): { rest: Float32Array; world: Float32Array } {
   const root = new Group();
   const holder = new Group();
   holder.position.fromArray(node);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(local, 3));
   holder.add(new Mesh(geometry, new MeshBasicMaterial()));
   root.add(holder);
   const rig = cloneHumanoid(buildHumanoidTemplate(root, SHARED_ASSETS.robot.humanoid)!);
   applyHumanoidPose(rig, pose);
   rig.root.updateMatrixWorld(true);
   const skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
   const world = new Float32Array(cloud.length);
   const v = new Vector3();
   for (let i = 0; i < cloud.length / 3; i++) {
      v.fromBufferAttribute(geometry.getAttribute("position"), i);
      skin.applyBoneTransform(i, v).applyMatrix4(skin.matrixWorld).toArray(world, i * 3);
   }
   return { rest: cloud, world };
}

describe("shared robot.glb", () => {
   it("is the 1.90 x 1.72 x 0.60 T-pose the landmarks were measured on", () => {
      let maxY = 0;
      let reach = 0;
      for (let i = 0; i < cloud.length; i += 3) {
         maxY = Math.max(maxY, cloud[i + 1]);
         reach = Math.max(reach, Math.abs(cloud[i]));
      }
      expect(maxY).toBeCloseTo(1.715, 2);
      expect(reach).toBeCloseTo(0.95, 2);
   });

   it("the committed landmarks are close to the estimate (positions within 6 cm, shoulders 3 cm, blends 2 cm)", () => {
      const estimate = estimateHumanoidLandmarks(cloud);
      const blends: Array<keyof HumanoidLandmarks> = ["shoulderBlend", "elbowBlend", "hipBlend", "kneeBlend", "crotchBlend", "spineBlend", "neckBlend"];
      for (const key of Object.keys(ROBOT_LANDMARKS) as Array<keyof HumanoidLandmarks>) {
         const tolerance = key === "armSpread" ? 0.15 : key === "shoulderX" || key === "shoulderY" ? 0.03 : blends.includes(key) ? 0.02 : 0.06;
         expect(Math.abs(estimate[key] - ROBOT_LANDMARKS[key]), key).toBeLessThan(tolerance);
      }
   });

   it("bind pose: every vertex where the static GLB draws it", () => {
      const { rest, world } = skinnedRobot(restPose(createPose()));
      let worst = 0;
      for (let i = 0; i < rest.length; i++) worst = Math.max(worst, Math.abs(rest[i] - world[i]));
      expect(worst).toBeLessThan(1e-5);
   });

   it("arms down: hands below the shoulders and clear of the hips, the head and the legs still", () => {
      const { rest, world } = skinnedRobot(armsDownPose(createPose()));
      const l = ROBOT_LANDMARKS;
      let hands = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         const x = rest[i * 3];
         const y = rest[i * 3 + 1];
         const moved = Math.hypot(world[i * 3] - x, world[i * 3 + 1] - y, world[i * 3 + 2] - rest[i * 3 + 2]);
         if (y > 1.2 || y < l.crotchY) expect(moved).toBeLessThan(1e-5);
         if (Math.abs(x) < l.wristX) continue;
         hands++;
         expect(world[i * 3 + 1]).toBeLessThan(l.shoulderY - 0.3);
         // the hips are 0.27 wide at most
         expect(Math.abs(world[i * 3])).toBeGreaterThan(0.3);
         expect(Math.sign(world[i * 3])).toBe(Math.sign(x));
      }
      expect(hands).toBeGreaterThan(1000);
   });

   it("carry overhead: the hands rise beside the head, up to its top (under a carried box)", () => {
      const { rest, world } = skinnedRobot(carryPose(1, createPose()));
      let top = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         if (Math.abs(rest[i * 3]) < ROBOT_LANDMARKS.wristX) continue;
         top = Math.max(top, world[i * 3 + 1]);
         // the forearms and hands stay outside the head (0.35 wide) while they pass it
         if (world[i * 3 + 1] > 1.25 && world[i * 3 + 1] < 1.55) expect(Math.abs(world[i * 3])).toBeGreaterThan(0.3);
      }
      expect(top).toBeGreaterThan(1.6);
   });
});
