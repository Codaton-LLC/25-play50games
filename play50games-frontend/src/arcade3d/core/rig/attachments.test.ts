// Attachment anchors on the real shared runner (public/models/3d/shared/runner.glb, RUNNER_LANDMARKS):
// a hat on the head anchor, a tool in each hand and a pack on the back stay where they were put on
// the skinned mesh through walk, run, carry, cheer and reach poses (CPU skinning like the vertex
// shader, characterChecks.ts rigCharacter). Tolerance: 1 cm at office-escape's scale (0.825).
import { beforeAll, describe, expect, it } from "vitest";
import { Vector3, type Group } from "three";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "../sharedAssets";
import { rigCharacter, type RiggedCharacter } from "./characterChecks";
import { ANCHOR_NAMES, anchorOffset, measureAnchors, type AnchorName } from "./attachments";
import { BONE, humanoidJoints } from "./humanoid";
import { carryPose, cheerPose, createPose, idlePose, reachPose, walkPose, type HumanoidPose } from "./poses";
import { createAnchorGroup } from "./skinning";

const SCALE = 0.825;
/** 1 cm in GLB units at SCALE */
const CM = 0.01 / SCALE;

const RUNNER = { ...SHARED_ASSETS.runner, scale: SCALE };

function poses(): Array<[string, HumanoidPose]> {
   const list: Array<[string, HumanoidPose]> = [];
   for (let k = 0; k < 8; k++) {
      list.push([`walk ${k}`, walkPose((k / 8) * Math.PI * 2, 0.5, createPose())]);
      list.push([`run ${k}`, walkPose((k / 8) * Math.PI * 2, 1, createPose())]);
   }
   list.push(["carry low", carryPose(0, createPose())], ["carry high", carryPose(1, createPose())], ["carry mid", carryPose(0.5, createPose())]);
   for (const t of [0, 0.2, 0.4, 0.9]) list.push([`cheer ${t}`, cheerPose(t, createPose())]);
   list.push(["reach L", reachPose(1, 1, createPose())], ["reach R", reachPose(-1, 0.5, createPose())], ["idle", idlePose(2, createPose())]);
   return list;
}

describe("attachment anchors on the shared runner", () => {
   let character: RiggedCharacter;
   const groups = {} as Record<AnchorName, Group>;
   /** the vertices each anchor is checked against: the nearest ones on its rigid part */
   const near = new Map<AnchorName, number[]>();

   beforeAll(async () => {
      character = await rigCharacter(RUNNER);
      for (const name of ANCHOR_NAMES) groups[name] = createAnchorGroup(character.rig, name, [SCALE, SCALE, SCALE]);
      const cloud = character.glb.cloud;
      const a = character.rig.anchors;
      for (const name of ANCHOR_NAMES) {
         const p = a[name];
         const order = Array.from({ length: cloud.length / 3 }, (_, i) => i).sort(
            (i, j) => Math.hypot(cloud[i * 3] - p.x, cloud[i * 3 + 1] - p.y, cloud[i * 3 + 2] - p.z) - Math.hypot(cloud[j * 3] - p.x, cloud[j * 3 + 1] - p.y, cloud[j * 3 + 2] - p.z)
         );
         near.set(name, order.slice(0, 12));
      }
   }, 30_000);

   it("measures the anchors on the committed landmarks, on the right bones", () => {
      const a = character.rig.anchors;
      expect(a).toEqual(measureAnchors(character.glb.cloud, RUNNER_LANDMARKS));
      expect(a.head.bone).toBe(BONE.head);
      expect(a.chest.bone).toBe(BONE.chest);
      expect(a.handL.bone).toBe(BONE.lowerArmL);
      expect(a.handR.bone).toBe(BONE.lowerArmR);
      // the top of the head: the mesh is 1.886 tall; the hands are beyond the wrists, mirrored
      expect(a.head.y).toBeCloseTo(1.886, 2);
      expect(a.handL.x).toBeGreaterThan(RUNNER_LANDMARKS.wristX);
      expect(a.handR.x).toBeLessThan(-RUNNER_LANDMARKS.wristX);
      expect(Math.abs(a.handL.x + a.handR.x)).toBeLessThan(2 * CM);
      // the back anchor is behind the spine
      expect(a.chest.z).toBeLessThan(RUNNER_LANDMARKS.spineZ);
   });

   it("sits on the surface: each anchor is within 1 cm of the mesh at rest (head, back) or inside the hand", () => {
      const cloud = character.glb.cloud;
      for (const name of ["head", "chest"] as const) {
         const p = character.rig.anchors[name];
         const i = near.get(name)![0];
         expect(Math.hypot(cloud[i * 3] - p.x, cloud[i * 3 + 1] - p.y, cloud[i * 3 + 2] - p.z), name).toBeLessThan(CM);
      }
   });

   it("puts the anchor group on its bone at the anchor's bind position (scale undone)", () => {
      const joints = humanoidJoints(RUNNER_LANDMARKS);
      for (const name of ANCHOR_NAMES) {
         const g = groups[name];
         const o = anchorOffset(character.rig.anchors[name], RUNNER_LANDMARKS, undefined, joints);
         expect(g.parent).toBe(character.rig.bones[character.rig.anchors[name].bone]);
         expect(g.position.toArray()).toEqual([o.x, o.y, o.z]);
         expect(g.scale.x).toBeCloseTo(1 / SCALE);
      }
   });

   it("a hat on the head anchor stays on the head within 1 cm through walk, run, carry, cheer and reach", () => {
      expectAnchorFollows("head", 1);
   });

   it("a tool in each hand stays in the hand within 1 cm", () => {
      expectAnchorFollows("handL", 1);
      expectAnchorFollows("handR", 1);
   });

   it("a pack on the back stays on the back within 1 cm", () => {
      expectAnchorFollows("chest", 1);
   });

   /** For every pose: the anchor's distance to each of its nearest vertices changes by less than `cm`. */
   function expectAnchorFollows(name: AnchorName, cm: number): void {
      const cloud = character.glb.cloud;
      const p = character.rig.anchors[name];
      const ids = near.get(name)!;
      const restDist = ids.map((i) => Math.hypot(cloud[i * 3] - p.x, cloud[i * 3 + 1] - p.y, cloud[i * 3 + 2] - p.z));
      const at = new Vector3();
      let worst = 0;
      let worstPose = "";
      for (const [label, pose] of poses()) {
         const world = character.posed(pose);
         groups[name].getWorldPosition(at);
         ids.forEach((i, k) => {
            const d = Math.hypot(world[i * 3] - at.x, world[i * 3 + 1] - at.y, world[i * 3 + 2] - at.z);
            const drift = Math.abs(d - restDist[k]);
            if (drift > worst) {
               worst = drift;
               worstPose = label;
            }
         });
      }
      expect(worst, `${name}: worst in ${worstPose}`).toBeLessThan(cm * CM);
   }
});
