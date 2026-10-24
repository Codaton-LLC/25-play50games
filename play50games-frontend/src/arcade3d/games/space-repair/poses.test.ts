import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from "three";
import { ASTRONAUT_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { applyHumanoidPose, BONE, buildHumanoidTemplate, cloneHumanoid, createAnchorGroup, createPose, disposeHumanoid } from "@/arcade3d/core/rig";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { fitView, setLensShift } from "@/arcade3d/core/view";
import { ASSETS, SUIT_SCALE } from "./assets";
import { FIT } from "./camera";
import { floatPose } from "./poses";

describe("floating suit on the real rig", () => {
   it("keeps helmet rigid, hands off the torso and anchor attachments on their bones through every blend", async () => {
      const glb = await readCharacterGlb(ASSETS.astronaut.url), geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(glb.local, 3));
      const root = new Group(), mesh = new Mesh(geometry); mesh.position.fromArray(glb.node); root.add(mesh);
      const template = buildHumanoidTemplate(root, { landmarks: ASTRONAUT_LANDMARKS })!;
      const rig = cloneHumanoid(template), pose = createPose(), scratch = createPose(), point = new Vector3();
      const hand = createAnchorGroup(rig, "handR", [SUIT_SCALE, SUIT_SCALE, SUIT_SCALE]);
      const chest = createAnchorGroup(rig, "chest", [SUIT_SCALE, SUIT_SCALE, SUIT_SCALE]);
      rig.bones[rig.anchors.handR.bone].add(hand); rig.bones[rig.anchors.chest.bone].add(chest);
      const toolGrip = new Group(); hand.add(toolGrip);
      const nozzle = new Group(); nozzle.position.set(0.125, -0.2, -0.13); chest.add(nozzle);
      const skin = rig.root.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
      const pos = skin.geometry.getAttribute("position"), index = skin.geometry.getAttribute("skinIndex"), weight = skin.geometry.getAttribute("skinWeight");
      let smallestHeight = Infinity, largestHandSpan = 0, worstHelmetDistance = 0;
      try {
         for (let i = 0; i <= 30; i++) {
            const k = i / 30;
            for (const [thrust, reach, wobble, won] of [[k, 0, 0, false], [0, k, 0, false], [0, 0, k, false], [0, 0, 0, true]] as const) {
               floatPose(i * 0.07, thrust, reach, wobble, won, false, pose, scratch);
               expect(pose.ground).toBe(0); expect(pose.lift).toBe(0);
               applyHumanoidPose(rig, pose, false); rig.root.updateMatrixWorld(true); skin.skeleton.update();
               const bounds = new Box3();
               for (let v = 0; v < pos.count; v++) {
                  point.fromBufferAttribute(pos, v); skin.applyBoneTransform(v, point); point.applyMatrix4(skin.matrixWorld).multiplyScalar(SUIT_SCALE); bounds.expandByPoint(point);
                  if (index.getX(v) === BONE.head && weight.getX(v) > 0.999) {
                     const source = new Vector3().fromBufferAttribute(pos, v);
                     const expected = source.clone().applyMatrix4(skin.bindMatrix).applyMatrix4(skin.skeleton.boneInverses[BONE.head]).applyMatrix4(skin.skeleton.bones[BONE.head].matrixWorld).applyMatrix4(skin.bindMatrixInverse);
                     // Compare local skinning to the rigid head transform, before the asset scale.
                     const actual = source.clone(); skin.applyBoneTransform(v, actual);
                     worstHelmetDistance = Math.max(worstHelmetDistance, actual.distanceTo(expected));
                  }
               }
               smallestHeight = Math.min(smallestHeight, bounds.max.y - bounds.min.y);
               const handAt = hand.getWorldPosition(new Vector3()).multiplyScalar(SUIT_SCALE);
               largestHandSpan = Math.max(largestHandSpan, Math.abs(handAt.x));
               const gripAt = toolGrip.getWorldPosition(new Vector3()).multiplyScalar(SUIT_SCALE);
               expect(gripAt.distanceTo(handAt)).toBeLessThan(0.01);
               expect(nozzle.position.z + 0.05).toBeLessThanOrEqual(-0.03);
               expect(Math.hypot(handAt.x, handAt.z)).toBeGreaterThan(0.24);
            }
         }
         expect(worstHelmetDistance).toBeLessThan(0.01);
         expect(smallestHeight).toBeGreaterThanOrEqual(1.6);
         expect(largestHandSpan).toBeLessThan(0.68);
      } finally {
         disposeHumanoid(rig); geometry.dispose();
         template.root.traverse((o) => { if ((o as Mesh).isMesh) (o as Mesh).geometry.dispose(); });
      }
   }, 30000);
   it("uses the actual fitted projection in portrait and landscape with the banner open", () => {
      for (const [width, height, banner, controls] of [
         [390, 844, 100, [{ left: 24, right: 152, top: 596, bottom: 724 }, { left: 298, right: 370, top: 652, bottom: 724 }]],
         [844, 390, 85, [{ left: 24, right: 152, top: 157, bottom: 285 }, { left: 752, right: 824, top: 213, bottom: 285 }]],
      ] as const) {
         const avoid = [
            { left: 0, right: width, top: 0, bottom: 54 },
            { left: 12, right: width === 390 ? 378 : 350, top: 58, bottom: 108 },
            { left: 0, right: width, top: height - banner, bottom: height }, ...controls,
            width === 390 ? { left: 169, right: 281, top: 604, bottom: 716 } : { left: 730, right: 826, top: 109, bottom: 205 },
         ];
         const view = fitView({ ...FIT, width, height, avoid }), camera = new PerspectiveCamera(45, width / height, 0.1, 500);
         camera.position.set(view.offset[0], view.offset[1] + 1.1, view.offset[2]); camera.lookAt(0, 1.1, 0); camera.updateMatrixWorld(true);
         setLensShift(camera, view.shift[0], view.shift[1], width, height);
         let smallest = Infinity, overlap = false;
         for (const lag of [-1.4, 0, 1.4]) for (const z of [-0.1, 0, 0.1]) {
            const a = new Vector3(lag, 0.25, z).project(camera), b = new Vector3(lag, 1.85, z).project(camera);
            smallest = Math.min(smallest, Math.hypot((b.x - a.x) * width / 2, (b.y - a.y) * height / 2));
            for (const p of [a, b]) {
               const x = (p.x + 1) * width / 2, y = (1 - p.y) * height / 2;
               if (avoid.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) overlap = true;
            }
         }
         expect(overlap).toBe(false); expect(smallest, `${width}×${height} suit reference`).toBeGreaterThanOrEqual(24);
      }
   });
});
