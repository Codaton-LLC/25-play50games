// The explorer's shovel on the real meshes (shovel.glb through core modelParts, the runner through the
// CPU skinner of rig/characterChecks): drawn 0.95 m long on y = 0, held on the shaft in the right
// hand in the dig with the blade reaching the sand, carried clear of the body on the back.
import { beforeAll, describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { POSE_MASK, blendPoses, bodyLift, createAnchorGroup, createPose, idlePose, walkPose } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, EXPLORER_SCALE, SHOVEL_GLB, SHOVEL_GRASP, SHOVEL_LENGTH } from "./assets";
import { BACK_HOLD, DIG_HOLD, THRUST, digPlacement, thrustOf } from "./held";
import { DIG_RATE, explorerPose } from "./poses";

const TAU = Math.PI * 2;
const HAT_TOP = 1.556 + 0.05;

/** The shovel GLB's vertices as the asset's fit draws them (metres, model origin). */
async function drawnShovel(): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(ASSETS.shovel.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, ASSETS.shovel);
   expect(parts).toHaveLength(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return points;
}

describe("treasure-island shovel", () => {
   let shovel: Vector3[];
   let runner: RiggedCharacter;
   let hand: Group;
   let chest: Group;

   beforeAll(async () => {
      shovel = await drawnShovel();
      runner = await rigCharacter(ASSETS.explorer);
      const scale: [number, number, number] = [EXPLORER_SCALE, EXPLORER_SCALE, EXPLORER_SCALE];
      hand = createAnchorGroup(runner.rig, "handR", scale);
      chest = createAnchorGroup(runner.rig, "chest", scale);
      runner.rig.bones[runner.rig.anchors.handR.bone].add(hand);
      runner.rig.bones[runner.rig.anchors.chest.bone].add(chest);
   }, 30_000);

   /** The shovel's vertices in metres in the explorer's group (feet on y = 0), for an anchor group and a placement. */
   const placed = (anchor: Group, position: Vector3, quaternion: Group["quaternion"], lift: number): Vector3[] => {
      const holder = new Group();
      holder.position.copy(position);
      holder.quaternion.copy(quaternion);
      holder.updateMatrix();
      const m = new Matrix4().multiplyMatrices(anchor.matrixWorld, holder.matrix);
      return shovel.map((v) => v.clone().applyMatrix4(m).multiplyScalar(EXPLORER_SCALE).add(new Vector3(0, lift, 0)));
   };

   it("is in the manifest and drawn 0.95 m long on y = 0 (blade edge on the origin), centred on x and z", () => {
      expect(hasModel(ASSETS.shovel.url)).toBe(true);
      expect(ASSETS.shovel.url).toBe("/models/3d/treasure-island/shovel.glb");
      const box = new Box3().setFromPoints(shovel);
      const size = box.getSize(new Vector3());
      expect(Math.abs(size.y / SHOVEL_LENGTH - 1), "length within 3 %").toBeLessThan(0.03);
      expect(Math.abs(box.min.y)).toBeLessThan(0.01);
      // the measured GLB bounds in assets.ts (w x h x d)
      expect(size.x).toBeCloseTo(SHOVEL_GLB.width * (SHOVEL_LENGTH / SHOVEL_GLB.height), 2);
      expect(size.z).toBeCloseTo(SHOVEL_GLB.depth * (SHOVEL_LENGTH / SHOVEL_GLB.height), 2);
      const c = box.getCenter(new Vector3());
      expect(Math.abs(c.x)).toBeLessThan(0.02);
      expect(Math.abs(c.z)).toBeLessThan(0.02);
      // the hand's grasp is on the shaft, under the D-grip and above the blade
      const shaft = shovel.filter((v) => Math.abs(v.y - SHOVEL_GRASP) < 0.03);
      expect(shaft.length).toBeGreaterThan(5);
      const reach = Math.max(...shaft.map((v) => Math.hypot(v.x, v.z)));
      expect(reach, "shaft radius at the grasp").toBeLessThan(0.07);
      expect(SHOVEL_GRASP).toBeGreaterThan(SHOVEL_GLB.bladeTop * (SHOVEL_LENGTH / SHOVEL_GLB.height));
      expect(SHOVEL_GRASP).toBeLessThan(SHOVEL_LENGTH);
   });

   it("holds the shaft at the hand's centre in the dig, the blade reaching the sand ahead and the grip on the near side", () => {
      const p = createPose();
      const a = createPose();
      const b = createPose();
      const holder = new Group();
      for (const progress of [0, 0.5, 1]) {
         for (let step = 0; step < 16; step++) {
            const t = step / 16 / DIG_RATE;
            explorerPose({ amount: 0, phase: 0, dig: 1, cheer: 0 }, t, p, a, b);
            runner.posed(p, false);
            const lift = bodyLift(p, RUNNER_LANDMARKS) * EXPLORER_SCALE;
            const k = Math.sin(t * DIG_RATE * TAU);
            digPlacement(k, progress, 1, holder.position, holder.quaternion);
            const label = `progress ${progress}, t ${t.toFixed(2)}`;
            const w = placed(hand, holder.position, holder.quaternion, lift);
            // the hand closes on the shaft or the grip (the thrust slides the shovel up to 15 cm through it)
            const handAt = new Vector3().setFromMatrixPosition(hand.matrixWorld).multiplyScalar(EXPLORER_SCALE).add(new Vector3(0, lift, 0));
            const onShaft = w.filter((v, i) => shovel[i].y > 0.43 && shovel[i].y < 0.95);
            const nearest = Math.min(...onShaft.map((v) => v.distanceTo(handAt)));
            expect(nearest, `${label}: the hand on the shaft`).toBeLessThan(0.07);
            const tip = new Box3().setFromPoints(w.filter((_, i) => shovel[i].y < 0.03));
            const grip = new Box3().setFromPoints(w.filter((_, i) => shovel[i].y > SHOVEL_LENGTH - 0.1));
            // the blade's edge at the sand: never lifted more than 8 cm, never driven in more than 28 cm
            expect(tip.max.y, label).toBeLessThan(0.08);
            expect(tip.min.y, label).toBeGreaterThan(-0.28);
            // ahead of the explorer's hands, and well in front of the feet (the dig is in front of them)
            expect(tip.min.z, label).toBeGreaterThan(0.3);
            expect(tip.min.z, label).toBeGreaterThan(handAt.z + 0.1);
            // the grip is the near end and below the hat
            expect(grip.max.y, label).toBeLessThan(1.2);
            expect(grip.min.z, label).toBeLessThan(tip.min.z - 0.3);
         }
      }
   });

   it("keeps the shaft's lean (the wrist's scoop is undone) within 6 degrees of the dig's 36", () => {
      const p = createPose();
      const a = createPose();
      const b = createPose();
      const holder = new Group();
      const up = new Vector3(0, 1, 0);
      const axis = new Vector3();
      for (let step = 0; step < 16; step++) {
         const t = step / 16 / DIG_RATE;
         explorerPose({ amount: 0, phase: 0, dig: 1, cheer: 0 }, t, p, a, b);
         runner.posed(p, false);
         digPlacement(Math.sin(t * TAU * DIG_RATE), 0.5, 1, holder.position, holder.quaternion);
         holder.updateMatrix();
         const m = new Matrix4().multiplyMatrices(hand.matrixWorld, holder.matrix);
         // the shovel's +y (towards the grip) in the explorer's frame
         axis.set(0, 1, 0).transformDirection(m);
         const lean = (Math.acos(axis.dot(up)) * 180) / Math.PI;
         expect(Math.abs(lean - 36), `t ${t.toFixed(2)}: lean ${lean.toFixed(1)}`).toBeLessThan(6);
      }
   });

   it("slides the blade in and out with the scoop and deeper with the dig's progress, and not at all outside the dig", () => {
      expect(thrustOf(0, 0, 0)).toBeCloseTo(0, 12);
      expect(thrustOf(1, 1, 0)).toBeCloseTo(0, 12);
      for (const progress of [0, 0.5, 1]) {
         expect(thrustOf(-1, progress, 1)).toBeGreaterThan(thrustOf(1, progress, 1));
      }
      for (const k of [-1, 0, 1]) expect(thrustOf(k, 1, 1)).toBeGreaterThan(thrustOf(k, 0, 1));
      for (const k of [-1, 1]) for (const progress of [0, 1]) expect(Math.abs(thrustOf(k, progress, 1))).toBeLessThanOrEqual(THRUST.scoop + THRUST.bite / 2 + 1e-9);
      // the dig's hold is the same as the rest placement when nothing moves (k 0, mid progress)
      const position = new Vector3();
      const quaternion = new Group().quaternion;
      digPlacement(0, 0.5, 1, position, quaternion);
      expect(position.distanceTo(DIG_HOLD.position)).toBeLessThan(1e-9);
      expect(quaternion.angleTo(DIG_HOLD.quaternion)).toBeLessThan(1e-9);
   });

   it("rides the back clear of the body through the idle, a walk and a run, under the hat's height", () => {
      const p = createPose();
      const s = createPose();
      const body = runner.glb.cloud;
      // a sample of the shovel (every 4th vertex) against every body vertex of the torso and the head
      const sample = (list: Vector3[]) => list.filter((_, i) => i % 4 === 0);
      for (const [name, amount, phase] of [["idle", 0, 0], ["walk", 0.4, 0], ["walk", 0.4, 1.5], ["run", 1, 0], ["run", 1, 1.6], ["run", 1, 3.2], ["run", 1, 4.7]] as const) {
         walkPose(phase, amount, p);
         blendPoses(p, idlePose(0.5, s), 1 - Math.min(1, amount * 5), p, POSE_MASK.upper);
         const world = runner.posed(p, false);
         const lift = bodyLift(p, RUNNER_LANDMARKS) * EXPLORER_SCALE;
         const w = placed(chest, BACK_HOLD.position, BACK_HOLD.quaternion, lift);
         const box = new Box3().setFromPoints(w);
         const label = `${name} ${phase}`;
         expect(box.max.y, label).toBeLessThan(HAT_TOP);
         expect(box.min.y, label).toBeGreaterThan(0.3);
         // behind the back: the whole shovel is on the far side of the trunk's rear surface at its height
         let nearest = Infinity;
         let worst = "";
         const sampled = sample(w);
         for (let i = 0; i < world.length; i += 3) {
            // the trunk and the head (rest y from the crotch up, rest |x| inside the shoulders): the arms swing past it
            if (Math.abs(body[i]) > 0.3 || body[i + 1] < RUNNER_LANDMARKS.crotchY) continue;
            const bx = world[i] * EXPLORER_SCALE;
            const by = world[i + 1] * EXPLORER_SCALE + lift;
            const bz = world[i + 2] * EXPLORER_SCALE;
            for (const v of sampled) {
               const d = Math.hypot(v.x - bx, v.y - by, v.z - bz);
               if (d < nearest) {
                  nearest = d;
                  worst = `body rest ${body[i].toFixed(2)},${body[i + 1].toFixed(2)},${body[i + 2].toFixed(2)} at ${bx.toFixed(2)},${by.toFixed(2)},${bz.toFixed(2)} shovel ${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
               }
            }
         }
         expect(nearest, `${label}: clearance ${worst}`).toBeGreaterThan(0.02);
      }
   });
});
