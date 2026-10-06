// <HumanoidModel>, useHumanoidPose and <Model> of a humanoid asset, server-rendered with a mocked
// useGLTF / useFrame (node, no WebGL): fallbacks without fetching, the frame slots, and the pose
// reaching the bones.
import { createElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from "three";
import type { ModelAsset } from "../types";
import { FRAME_PRIORITY } from "../frameLoop";
import { Model, useHumanoidRig } from "../assets";
import { BONE, BONE_COUNT } from "./humanoid";
import { HumanoidModel, useHumanoidPose } from "./HumanoidModel";
import { armsDownPose, createPose, resolvePose, walkPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose, cloneHumanoid, type HumanoidRig } from "./skinning";
import { HUMAN_PARTS, buildShape } from "./testShapes";

const { useGLTF, useFrame, frames, LISTED, BROKEN, gltf } = vi.hoisted(() => {
   const gltf: { scene: unknown } = { scene: null };
   const load = vi.fn((url: string) => {
      if (url.endsWith("broken.glb")) throw new Error("404");
      return { scene: gltf.scene, animations: [] };
   });
   const frames: Array<{ callback: () => void; priority: number | undefined }> = [];
   return {
      useGLTF: Object.assign(load, { clear: vi.fn() }),
      useFrame: vi.fn((callback: () => void, priority?: number) => {
         frames.push({ callback, priority });
      }),
      frames,
      LISTED: "/models/3d/test/character.glb",
      BROKEN: "/models/3d/test/broken.glb",
      gltf,
   };
});
vi.mock("@react-three/drei", () => ({ useGLTF }));
vi.mock("@react-three/fiber", () => ({ useFrame, useThree: vi.fn() }));
vi.mock("../modelManifest", () => ({
   MODEL_MANIFEST: [LISTED, BROKEN],
   hasModel: (url: string) => url === LISTED || url === BROKEN,
}));
vi.mock("./skinning", async (importOriginal) => {
   const actual = await importOriginal<typeof import("./skinning")>();
   return { ...actual, applyHumanoidPose: vi.fn(actual.applyHumanoidPose), cloneHumanoid: vi.fn(actual.cloneHumanoid) };
});

const asset = (url: string, extra: Partial<ModelAsset> = {}): ModelAsset => ({
   id: "character",
   url,
   humanoid: {},
   fallback: "capsule",
   budget: { tris: 1, bytes: 1 },
   ...extra,
});
const MISSING = asset("/models/3d/test/missing.glb");

function characterScene(): Group {
   const root = new Group();
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(buildShape(HUMAN_PARTS), 3));
   root.add(new Mesh(geometry, new MeshBasicMaterial()));
   return root;
}

function markup(node: ReactNode): string {
   const error = vi.spyOn(console, "error").mockImplementation(() => {});
   try {
      return renderToString(node).toLowerCase();
   } finally {
      error.mockRestore();
   }
}

/** Runs a hook once inside a server render and returns its value. */
function run<T>(hook: () => T): T {
   let value: T | undefined;
   function Probe() {
      value = hook();
      return null;
   }
   markup(createElement(Probe));
   return value as T;
}

afterEach(() => {
   useGLTF.mockClear();
   frames.length = 0;
});

describe("a humanoid that is missing or broken", () => {
   it("<HumanoidModel> draws the fallback element (else the primitive) without fetching", () => {
      expect(markup(createElement(HumanoidModel, { asset: MISSING, fallback: createElement("span", null, "stand-in") }))).toContain("stand-in");
      expect(markup(createElement(HumanoidModel, { asset: MISSING }))).toContain("<capsulegeometry");
      expect(useGLTF).not.toHaveBeenCalled();
   });

   it("a listed GLB that fails to load falls back too", () => {
      expect(markup(createElement(HumanoidModel, { asset: asset(BROKEN), fallback: createElement("span", null, "stand-in") }))).toContain("stand-in");
      expect(run(() => useHumanoidRig(asset(BROKEN)))).toBeNull();
   });
});

describe("a listed humanoid GLB", () => {
   it("useHumanoidRig loads it (meshopt, no Draco) and returns a private skinned copy", () => {
      gltf.scene = characterScene();
      const a = run(() => useHumanoidRig(asset(LISTED)))!;
      const b = run(() => useHumanoidRig(asset(LISTED)))!;
      expect(useGLTF).toHaveBeenCalledWith(LISTED, false, true);
      expect(a.root.children.some((o) => (o as SkinnedMesh).isSkinnedMesh)).toBe(true);
      expect(a.bones).toHaveLength(17);
      expect(a.root).not.toBe(b.root);
   });

   it("<HumanoidModel> draws the rig, not the fallback, and copies the pose into the bones at FRAME_PRIORITY.visuals", () => {
      gltf.scene = characterScene();
      const pose = walkPose(Math.PI / 2, 1, createPose());
      const html = markup(createElement(HumanoidModel, { asset: asset(LISTED), pose, fallback: createElement("span", null, "stand-in") }));
      expect(html).toContain("<primitive");
      expect(html).not.toContain("stand-in");
      expect(frames.map((f) => f.priority)).toEqual([FRAME_PRIORITY.visuals]);
   });

   it("every frame writes the pose as it is now into the component's own bones (no new objects)", () => {
      gltf.scene = characterScene();
      const pose = walkPose(Math.PI / 2, 1, createPose());
      markup(createElement(HumanoidModel, { asset: asset(LISTED), pose, applyLift: false }));
      const apply = vi.mocked(applyHumanoidPose);
      apply.mockClear();
      frames[0].callback();
      expect(apply).toHaveBeenCalledTimes(1);
      const [rig, given, lift] = apply.mock.calls[0];
      expect(given).toBe(pose);
      expect(lift).toBe(false);
      const leg = rig.bones[BONE.upperLegL].quaternion;
      const q = Array.from(pose.q.subarray(BONE.upperLegL * 4, BONE.upperLegL * 4 + 4));
      expect(leg.toArray()).toEqual(q.map((v) => expect.closeTo(v, 6)));
      // the game changes the pose in place; the next frame shows it, on the same quaternion object
      walkPose((3 * Math.PI) / 2, 1, pose);
      frames[0].callback();
      expect(rig.bones[BONE.upperLegL].quaternion).toBe(leg);
      expect(leg.x).toBeCloseTo(pose.q[BONE.upperLegL * 4], 6);
      expect(leg.x).not.toBeCloseTo(q[0], 2);
   });

   it("<Model> of a humanoid asset stands it up with its arms down (auto-rigged, no frame callback)", () => {
      gltf.scene = characterScene();
      const clone = vi.mocked(cloneHumanoid);
      clone.mockClear();
      const html = markup(createElement(Model, { asset: asset(LISTED), fallback: createElement("span", null, "stand-in") }));
      expect(html).toContain("<primitive");
      expect(html).not.toContain("stand-in");
      expect(frames).toHaveLength(0);
      // what <Model> drew: a skinned copy of the character, its bones in the arms-down pose
      expect(clone).toHaveBeenCalledTimes(1);
      const rig = clone.mock.results[0].value as HumanoidRig;
      const skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
      expect(skin).toBeDefined();
      const down = resolvePose(armsDownPose(createPose()), rig.landmarks.armSpread, new Float32Array(BONE_COUNT * 4));
      for (const bone of [BONE.upperArmL, BONE.upperArmR, BONE.lowerArmL, BONE.clavicleL]) {
         const q = rig.bones[bone].quaternion;
         expect(Math.abs(q.x * down[bone * 4] + q.y * down[bone * 4 + 1] + q.z * down[bone * 4 + 2] + q.w * down[bone * 4 + 3])).toBeCloseTo(1, 6);
      }
      // so a hand tip (the T-pose's x = 0.84) hangs well below the shoulder, not out in a T
      rig.root.updateMatrixWorld(true);
      const tips = skin.geometry.getAttribute("position");
      const v = new Vector3();
      let checked = 0;
      for (let i = 0; i < tips.count; i++) {
         if (tips.getX(i) < 0.84) continue;
         checked++;
         skin.applyBoneTransform(i, v.fromBufferAttribute(tips, i));
         expect(v.y).toBeLessThan(rig.landmarks.shoulderY - 0.3);
      }
      expect(checked).toBeGreaterThan(5);
   });
});

describe("useHumanoidPose", () => {
   it("one pose object, arms down to start; the driver runs every frame at FRAME_PRIORITY.pose", () => {
      const seen: HumanoidPose[] = [];
      const pose = run(() =>
         useHumanoidPose((p) => {
            seen.push(p);
            walkPose(Math.PI / 2, 1, p);
         })
      );
      expect(pose.dropL).toBe(1);
      expect(pose.dropR).toBe(1);
      expect(frames.map((f) => f.priority)).toEqual([FRAME_PRIORITY.pose]);
      expect(FRAME_PRIORITY.camera).toBeLessThan(FRAME_PRIORITY.pose);
      expect(FRAME_PRIORITY.pose).toBeLessThan(FRAME_PRIORITY.visuals);
      frames[0].callback();
      expect(seen).toEqual([pose]);
      expect(pose).toEqual(walkPose(Math.PI / 2, 1, createPose()));
      // the leg has turned: the left upper leg's rotation is no longer the identity
      expect(pose.q[BONE.upperLegL * 4 + 3]).toBeLessThan(0.999);
   });
});
