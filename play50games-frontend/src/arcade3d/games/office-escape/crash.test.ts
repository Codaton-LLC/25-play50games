// Office Escape's crash on the real runner.glb (crash.ts, as Scene.tsx draws it): knocked onto its
// back, it flails with its legs up, and no part of it goes through the floor during the end
// animation; the group's motion is the one the README describes, and the result delay (index.tsx)
// keeps it on screen until the fall and the bounce are over.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { resultDelayFor } from "@/arcade3d/core/frameLoop";
import { BONE, blendPoses, createPose, flailPose, turnBone, walkPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS } from "./assets";
import { CRASH, crashPlacement, crashPose, type CrashPlacement } from "./crash";

describe("office-escape crash on runner.glb", () => {
   let runner: RiggedCharacter;
   beforeAll(async () => {
      runner = await rigCharacter(ASSETS.runner);
   });

   const place: CrashPlacement = { e: 0, y: 0, z: 0, tilt: 0, yaw: 0 };
   const group = new Matrix4();
   const model = new Matrix4();
   const v = new Vector3();

   /** The lowest world y of the runner `k` s after the crash, drawn as Scene.tsx draws it (the pose and the group). */
   function lowestAt(k: number, crashAt: number, phase: number, poseOf: (t: number, out: ReturnType<typeof createPose>) => void): number {
      const t = crashAt + k;
      // the run cycle it was in (a run at the start speed, the spine leaning in), then the crash pose takes over
      const p = walkPose(phase, 0.9, createPose());
      turnBone(p, BONE.spine, 0.1, 0, 0);
      const target = createPose();
      poseOf(t, target);
      blendPoses(p, target, Math.min(1, k / CRASH.poseS), p);
      const world = runner.posed(p, false);
      crashPlacement(k, 0, 1, place);
      // the runner group (Euler "YXZ"), then the asset's turn and scale (<HumanoidModel>'s primitive)
      group.compose(new Vector3(0, place.y, place.z), new Quaternion().setFromEuler(new Euler(place.tilt, place.yaw, 0, "YXZ")), new Vector3(1, 1, 1));
      const s = ASSETS.runner.scale ?? 1;
      model.compose(new Vector3(), new Quaternion().setFromEuler(new Euler(0, ASSETS.runner.rotationY ?? 0, 0)), new Vector3(s, s, s));
      group.multiply(model);
      let low = Infinity;
      for (let i = 0; i < world.length; i += 3) low = Math.min(low, v.fromArray(world, i).applyMatrix4(group).y);
      return low;
   }

   it("the group: up in an arc and onto its back over CRASH.fallS, then a decaying bounce; turned towards the middle", () => {
      expect(crashPlacement(0, 0.5, 1, place)).toMatchObject({ e: 0, y: 0.5, z: 0, tilt: 0, yaw: 0 });
      crashPlacement(CRASH.fallS, 0, -1, place);
      expect(place.e).toBe(1);
      expect(place.y).toBeCloseTo(CRASH.lift, 9);
      expect(place.tilt).toBeCloseTo(CRASH.tilt, 9);
      expect(place.yaw).toBeCloseTo(-CRASH.yaw, 9);
      expect(place.z).toBeCloseTo(CRASH.back, 9);
      crashPlacement(3, 0, 1, place);
      expect(Math.abs(place.tilt - CRASH.tilt)).toBeLessThan(1e-4);
   });

   it("lying on its back and flailing, no part of it goes through the floor (k 0 .. 1.6 s, from any point of the stride)", () => {
      let worst = Infinity;
      for (const phase of [0, Math.PI / 2, Math.PI, 4.7]) {
         for (let i = 0; i <= 64; i++) {
            const k = (i / 64) * 1.6;
            const low = lowestAt(k, 2.37, phase, crashPose);
            worst = Math.min(worst, low);
            expect(low, `phase ${phase} k ${k.toFixed(3)}`).toBeGreaterThan(-0.01);
         }
      }
      expect(worst).toBeLessThan(0.15);
   });

   it("(why crash.ts has its own legs: core flailPose's knees fold the shins down through the floor once the body lies on its back)", () => {
      let worst = Infinity;
      for (let i = 0; i <= 64; i++) worst = Math.min(worst, lowestAt(0.45 + (i / 64) * 1.15, 2.37, 0, flailPose));
      expect(worst).toBeLessThan(-0.05);
   });

   it("the crash pose keeps flailPose's arms and head and lifts both thighs well forward (up, on its back)", () => {
      const a = crashPose(1.1, createPose());
      const b = flailPose(1.1, createPose());
      for (const bone of [BONE.upperArmL, BONE.lowerArmL, BONE.upperArmR, BONE.lowerArmR, BONE.head, BONE.spine]) {
         for (let c = 0; c < 4; c++) expect(a.q[bone * 4 + c]).toBe(b.q[bone * 4 + c]);
      }
      for (const thigh of [BONE.upperLegL, BONE.upperLegR]) {
         const q = new Quaternion(a.q[thigh * 4], a.q[thigh * 4 + 1], a.q[thigh * 4 + 2], a.q[thigh * 4 + 3]);
         // the leg's down direction swung towards the front (+z) by about a radian
         expect(new Vector3(0, -1, 0).applyQuaternion(q).z).toBeGreaterThan(0.6);
      }
   });
});

describe("office-escape result delay", () => {
   // index.tsx imports the Scene (R3F), so its resultDelayMs is read from the source
   const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
   const delayMs = Number(/resultDelayMs:\s*(\d+)/.exec(source)?.[1]);

   it("keeps the scene up until the fall is over and the bounce has died down, then shows the panel", () => {
      expect(delayMs).toBeGreaterThan(0);
      // the core uses it as set (not clamped to its 5 s cap)
      expect(resultDelayFor({ resultDelayMs: delayMs })).toBe(delayMs);
      const p: CrashPlacement = { e: 0, y: 0, z: 0, tilt: 0, yaw: 0 };
      expect(crashPlacement(delayMs / 1000, 0, 1, p).e).toBe(1);
      // the largest swing of the bounce left once the panel covers the runner, against its first one
      let peak = 0;
      let rest = 0;
      for (let k = CRASH.fallS; k <= 2.5; k += 0.005) {
         const swing = Math.abs(crashPlacement(k, 0, 1, p).tilt - CRASH.tilt);
         peak = Math.max(peak, swing);
         if (k >= delayMs / 1000) rest = Math.max(rest, swing);
      }
      expect(rest).toBeLessThan(peak * 0.2);
   });
});
