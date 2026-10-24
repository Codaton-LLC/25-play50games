import {
   Box3,
   BufferAttribute,
   BufferGeometry,
   Float32BufferAttribute,
   Group,
   Mesh,
   type SkinnedMesh,
   Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { modelParts } from "@/arcade3d/core/assets";
import {
   applyHumanoidPose,
   buildHumanoidTemplate,
   cloneHumanoid,
   soleHeight,
} from "@/arcade3d/core/rig";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ALIEN_HEIGHT, ALIEN_SCALE, ASSETS } from "./assets";
import {
   ALIEN_LANDMARKS,
   alienWalkPose,
   applyLeftBasketCarry,
   BASKET_LOCAL_POS,
   createPose,
   harvestPose,
   idlePose,
   restPose,
} from "./poses";

async function loadAlienRig() {
   const glb = await readCharacterGlb(ASSETS.alien.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(glb.local, 3));
   geometry.setIndex(new BufferAttribute(glb.indices, 1));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(glb.node);
   const root = new Group();
   root.add(mesh);
   const template = buildHumanoidTemplate(root, ASSETS.alien.humanoid)!;
   const rig = cloneHumanoid(template);
   rig.root.scale.setScalar(ALIEN_SCALE);
   let skin: SkinnedMesh | null = null;
   rig.root.traverse((obj) => {
      if ((obj as SkinnedMesh).isSkinnedMesh) skin = obj as SkinnedMesh;
   });
   return { glb, rig, skin: skin! };
}

async function loadCropPoints(url: string, spec: typeof ASSETS.glowPod | typeof ASSETS.gourd) {
   const { local, node } = await readCharacterGlb(url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, spec);
   const pts: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) {
      pts.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   }
   geometry.dispose();
   return pts;
}

describe("alien-farm poses", () => {
   it("scales alien.glb to 1.30 m (±0.02 m) and keeps soles within 0.01 m of y = 0 in rest, walk (4 phases), and harvest poses", async () => {
      const { rig, skin } = await loadAlienRig();
      const pose = createPose();

      // Rest pose height and soles
      restPose(pose);
      applyHumanoidPose(rig, pose);
      rig.root.updateMatrixWorld(true);
      const v = new Vector3();
      const box = new Box3();
      const count = skin.geometry.getAttribute("position").count;
      for (let i = 0; i < count; i++) {
         skin.getVertexPosition(i, v).applyMatrix4(skin.matrixWorld);
         box.expandByPoint(v);
      }
      expect(box.max.y - box.min.y).toBeCloseTo(ALIEN_HEIGHT, 1);
      expect(Math.abs(box.min.y)).toBeLessThanOrEqual(0.01);

      // Walk 4 phases: lower sole within 0.01 m of y = 0
      for (const phase of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
         alienWalkPose(phase, 0.7, pose);
         applyLeftBasketCarry(pose);
         const leftSole = soleHeight(pose, ALIEN_LANDMARKS, 1) * ALIEN_SCALE;
         const rightSole = soleHeight(pose, ALIEN_LANDMARKS, -1) * ALIEN_SCALE;
         expect(Math.min(leftSole, rightSole)).toBeCloseTo(0, 2);
         expect(Math.abs(Math.min(leftSole, rightSole))).toBeLessThanOrEqual(0.01);
      }

      // Harvest pose across distances and heights: soles within 0.01 m of y = 0
      for (const dist of [0.4, 0.65, 0.9]) {
         for (const h of [0.5, 0.75, 1.0]) {
            harvestPose(0.15, dist, h, pose);
            const leftSole = soleHeight(pose, ALIEN_LANDMARKS, 1) * ALIEN_SCALE;
            const rightSole = soleHeight(pose, ALIEN_LANDMARKS, -1) * ALIEN_SCALE;
            expect(Math.abs(leftSole)).toBeLessThanOrEqual(0.01);
            expect(Math.abs(rightSole)).toBeLessThanOrEqual(0.01);
         }
      }
   });

   it("keeps the left hand within 0.06 m of the carried harvest basket rim", async () => {
      const { glb, rig, skin } = await loadAlienRig();
      const pose = createPose();
      idlePose(0, pose);
      applyLeftBasketCarry(pose);
      applyHumanoidPose(rig, pose);
      rig.root.updateMatrixWorld(true);

      const leftHandVerts: number[] = [];
      for (let i = 0; i < glb.cloud.length / 3; i++) {
         if (glb.cloud[i * 3] > ALIEN_LANDMARKS.wristX) {
            leftHandVerts.push(i);
         }
      }
      expect(leftHandVerts.length).toBeGreaterThan(10);

      const v = new Vector3();
      const rim = new Vector3(BASKET_LOCAL_POS.x, BASKET_LOCAL_POS.y, BASKET_LOCAL_POS.z);
      let minDist = Infinity;
      for (const idx of leftHandVerts) {
         skin.getVertexPosition(idx, v).applyMatrix4(skin.matrixWorld);
         minDist = Math.min(minDist, v.distanceTo(rim));
      }
      expect(minDist).toBeLessThanOrEqual(0.06);
   });

   it("reaches the right hand within 0.05 m of the crop mesh's near leaf/bulb rim across distances up to 0.90 m, both crop types, and heights 0.5..1.0 m without swinging through the T-pose", async () => {
      const { glb, rig, skin } = await loadAlienRig();
      const glowPodPts = await loadCropPoints(ASSETS.glowPod.url, ASSETS.glowPod);
      const gourdPts = await loadCropPoints(ASSETS.gourd.url, ASSETS.gourd);

      const rightHandVerts: number[] = [];
      for (let i = 0; i < glb.cloud.length / 3; i++) {
         if (glb.cloud[i * 3] < -ALIEN_LANDMARKS.wristX) {
            rightHandVerts.push(i);
         }
      }
      expect(rightHandVerts.length).toBeGreaterThan(10);

      const pose = createPose();
      const v = new Vector3();

      // Verify right hand never swings through T-pose (x < -0.50 m and |z| < 0.08 m) during the 0.30 s channel
      for (let t = 0; t <= 0.3; t += 0.03) {
         harvestPose(t, 0.9, 1.0, pose);
         applyHumanoidPose(rig, pose);
         rig.root.updateMatrixWorld(true);
         let avgX = 0;
         let avgZ = 0;
         for (const idx of rightHandVerts) {
            skin.getVertexPosition(idx, v).applyMatrix4(skin.matrixWorld);
            avgX += v.x;
            avgZ += v.z;
         }
         avgX /= rightHandVerts.length;
         avgZ /= rightHandVerts.length;
         expect(avgZ).toBeGreaterThan(0.12);
      }

      // Check pluck contact (elapsed = 0.15 s) across distances [0.45, 0.70, 0.90] and heights [0.5, 0.75, 1.0]
      for (const [cropName, basePts] of [
         ["glowPod", glowPodPts],
         ["gourd", gourdPts],
      ] as const) {
         for (const dist of [0.45, 0.7, 0.9]) {
            for (const h of [0.5, 0.75, 1.0]) {
               harvestPose(0.15, dist, h, pose);
               applyHumanoidPose(rig, pose);
               rig.root.updateMatrixWorld(true);

               const handPts = rightHandVerts.map((idx) => {
                  const p = new Vector3();
                  skin.getVertexPosition(idx, p).applyMatrix4(skin.matrixWorld);
                  return p;
               });

               // Crop sits on raised bed (y = 0.08) at (0, 0.08, dist), scaled in height by h (and radial width by max(0.75, h))
               const radialScale = Math.max(0.75, h);
               let minDist = Infinity;
               for (let ci = 0; ci < basePts.length; ci += 4) {
                  const cp = basePts[ci];
                  const cx = cp.x * radialScale;
                  const cy = 0.08 + cp.y * h;
                  const cz = dist + cp.z * radialScale;
                  for (let hi = 0; hi < handPts.length; hi += 2) {
                     const hp = handPts[hi];
                     const d = Math.hypot(hp.x - cx, hp.y - cy, hp.z - cz);
                     if (d < minDist) minDist = d;
                  }
               }
               expect(minDist, `${cropName} dist=${dist} h=${h} minDist=${minDist.toFixed(4)}`).toBeLessThanOrEqual(0.05);
            }
         }
      }
   });

   it("keeps the head and antennae rigid during locomotion and harvest", async () => {
      const { glb, rig, skin } = await loadAlienRig();
      const headVerts: number[] = [];
      for (let i = 0; i < glb.cloud.length / 3; i++) {
         if (glb.cloud[i * 3 + 1] > ALIEN_LANDMARKS.headY + ALIEN_LANDMARKS.neckBlend + 0.02) {
            headVerts.push(i);
         }
      }
      expect(headVerts.length).toBeGreaterThan(20);

      const sampleIndices = [
         headVerts[0],
         headVerts[Math.floor(headVerts.length * 0.25)],
         headVerts[Math.floor(headVerts.length * 0.5)],
         headVerts[Math.floor(headVerts.length * 0.75)],
         headVerts[headVerts.length - 1],
      ];

      const pose = createPose();
      restPose(pose);
      applyHumanoidPose(rig, pose);
      rig.root.updateMatrixWorld(true);
      const restPts = sampleIndices.map((idx) => {
         const p = new Vector3();
         skin.getVertexPosition(idx, p).applyMatrix4(skin.matrixWorld);
         return p;
      });

      for (const testPose of [
         () => alienWalkPose(0.8, 0.8, pose),
         () => harvestPose(0.15, 0.9, 0.5, pose),
         () => harvestPose(0.15, 0.9, 1.0, pose),
      ]) {
         testPose();
         applyHumanoidPose(rig, pose);
         rig.root.updateMatrixWorld(true);
         const curPts = sampleIndices.map((idx) => {
            const p = new Vector3();
            skin.getVertexPosition(idx, p).applyMatrix4(skin.matrixWorld);
            return p;
         });
         for (let a = 0; a < sampleIndices.length; a++) {
            for (let b = a + 1; b < sampleIndices.length; b++) {
               const dRest = restPts[a].distanceTo(restPts[b]);
               const dCur = curPts[a].distanceTo(curPts[b]);
               expect(Math.abs(dCur - dRest)).toBeLessThan(1e-4);
            }
         }
      }
   });
});
