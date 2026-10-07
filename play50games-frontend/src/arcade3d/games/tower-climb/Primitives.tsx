"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, Matrix4, Mesh,
   MeshStandardMaterial, Plane, Quaternion, SphereGeometry, Vector3,
   type BufferGeometry, type Material, type SkinnedMesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstancePart } from "@/arcade3d/core/render";
import { applyHumanoidPose, buildHumanoidTemplate, cloneHumanoid, disposeHumanoid, type HumanoidPose, type HumanoidRig } from "@/arcade3d/core/rig";

export const COLORS = {
   background: "#122536", slab: "#39cadd", moving: "#a890e5", ledge: "#36aead",
   spur: "#ffa862", cracked: "#ec725d", coin: "#ffd35d", tower: "#213c50",
} as const;

export interface TowerParts {
   slab: InstancePart[]; moving: InstancePart[]; ledge: InstancePart[];
   intact: InstancePart[]; cracked: InstancePart[]; coin: InstancePart[];
   flag: InstancePart[]; tower: InstancePart[];
   planes: Plane[];
   runner: HumanoidRig; runnerHeight: number;
   geometries: BufferGeometry[]; materials: Material[];
}

function local(x: number, y: number, z: number, sx: number, sy: number, sz: number): Matrix4 {
   return new Matrix4().compose(new Vector3(x, y, z), new Quaternion(), new Vector3(sx, sy, sz));
}

function tilted(x: number, y: number, z: number, sx: number, sy: number, sz: number, angle: number): Matrix4 {
   return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle), new Vector3(sx, sy, sz));
}

/** A single vertex-coloured T-pose mesh; the existing core rigs its limbs, just like the GLB. */
function runnerPrimitive(): { rig: HumanoidRig; geometry: BufferGeometry; skin: BufferGeometry; material: Material } {
   const pieces: BufferGeometry[] = [];
   const add = (geometry: BufferGeometry, x: number, y: number, z: number, color: string) => {
      const shape = geometry.toNonIndexed(); geometry.dispose(); shape.translate(x, y, z);
      const tint = new Color(color), colors = new Float32Array(shape.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = tint.r; colors[i + 1] = tint.g; colors[i + 2] = tint.b; }
      shape.setAttribute("color", new Float32BufferAttribute(colors, 3)); pieces.push(shape);
   };
   add(new BoxGeometry(0.4, 0.32, 0.22), 0, 0.51, 0, "#ef995c");
   add(new SphereGeometry(1, 20, 14).scale(0.21, 0.15, 0.17), 0, 0.85, 0, "#f3d5b6");
   add(new BoxGeometry(0.28, 0.06, 0.025), 0, 0.86, 0.166, "#19364b");
   add(new BoxGeometry(0.3, 0.045, 0.19), 0, 0.975, -0.015, "#ffd35d");
   for (const side of [-1, 1]) {
      add(new BoxGeometry(0.12, 0.25, 0.13), side * 0.115, 0.225, 0, "#283951");
      add(new BoxGeometry(0.17, 0.1, 0.22), side * 0.115, 0.05, 0.02, "#ecf1ef");
      add(new BoxGeometry(0.14, 0.09, 0.11), side * 0.29, 0.64, 0, "#ef995c");
      add(new BoxGeometry(0.12, 0.08, 0.10), side * 0.42, 0.64, 0, "#f3d5b6");
   }
   const geometry = mergeGeometries(pieces)!;
   for (const piece of pieces) piece.dispose();
   const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
   const source = new Group(); source.add(new Mesh(geometry, material));
   const template = buildHumanoidTemplate(source, { landmarks: {
      shoulderY: 0.64, shoulderX: 0.22, shoulderZ: 0, clavicleX: 0.11,
      elbowX: 0.36, wristX: 0.48, armRadius: 0.05, armSpread: 0.24,
      crotchY: 0.35, hipY: 0.36, hipX: 0.115, hipZ: 0, kneeY: 0.2,
      ankleY: 0.11, toeZ: 0.13, heelZ: -0.09, legDepth: 0.065, legOuterX: 0.175,
      hemY: 0.35, spineY: 0.42, chestY: 0.55, neckY: 0.68, headY: 0.71, spineZ: 0,
      shoulderBlend: 0.025, elbowBlend: 0.02, hipBlend: 0.025, kneeBlend: 0.02,
      ankleBlend: 0.01, crotchBlend: 0.025, spineBlend: 0.02, neckBlend: 0.01,
   } })!;
   const skin = (template.root.children.find(o => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh).geometry;
   return { rig: cloneHumanoid(template), geometry, skin, material };
}

export function createTowerParts(): TowerParts {
   const box = new BoxGeometry(1, 1, 1), disc = new CylinderGeometry(0.3, 0.3, 0.08, 20);
   const pole = new CylinderGeometry(0.025, 0.025, 0.8, 8);
   const material = (color: string) => new MeshStandardMaterial({ color, roughness: 0.82 });
   const slabMat = material(COLORS.slab), trimMat = material("#e6f1ed"), movingMat = material(COLORS.moving);
   const ledgeMat = material(COLORS.ledge), intactMat = material(COLORS.spur), crackedMat = material(COLORS.cracked);
   const crackMat = material("#542a32"), goldMat = material(COLORS.coin), poleMat = material("#c6d6df");
   const panelMat = material(COLORS.tower), ribMat = material("#41677a");
   const planes = [new Plane(new Vector3(0, 1, 0), 2), new Plane(new Vector3(0, -1, 0), 4)];
   panelMat.clippingPlanes = planes; ribMat.clippingPlanes = planes;
   const part = (mat: Material, locals: Matrix4[]): InstancePart => ({ geometry: box, material: mat, locals });
   const body = (width: number) => [local(0, -0.08, 0, width, 0.16, 0.6)];
   const runner = runnerPrimitive();
   runner.geometry.computeBoundingBox();
   const runnerHeight = runner.geometry.boundingBox!.getSize(new Vector3()).y;
   const coinLocal = new Matrix4().makeRotationX(Math.PI / 2);
   return {
      slab: [part(slabMat, body(1.4)), part(trimMat, [local(0, -0.018, 0.305, 1.25, 0.028, 0.012)])],
      moving: [part(movingMat, body(1.4)), part(trimMat, [
         tilted(-0.18, -0.08, 0.306, 0.16, 0.028, 0.015, -0.4),
         tilted(0.18, -0.08, 0.306, 0.16, 0.028, 0.015, 0.4),
      ])],
      ledge: [part(ledgeMat, body(4.4)), part(goldMat, [local(0, -0.02, 0.306, 4.2, 0.028, 0.012)])],
      intact: [part(intactMat, body(0.8)), part(trimMat, [local(0, -0.022, 0.306, 0.7, 0.022, 0.012)])],
      cracked: [part(crackedMat, body(0.8)), part(crackMat, [
         tilted(-0.16, -0.08, 0.306, 0.045, 0.14, 0.012, 0.35),
         tilted(0.13, -0.08, 0.306, 0.045, 0.14, 0.012, -0.3),
      ])],
      coin: [{ geometry: disc, material: goldMat, locals: [coinLocal] }],
      flag: [{ geometry: pole, material: poleMat, locals: [new Matrix4().makeTranslation(0, 0.4, 0)] },
         part(goldMat, [local(0.04, 0.66, 0, 0.3, 0.24, 0.045)])],
      tower: [part(panelMat, [local(0, 4, 0, 4.6, 8, 0.08)]),
         part(ribMat, [local(-2.24, 4, 0.065, 0.1, 8, 0.05), local(2.24, 4, 0.065, 0.1, 8, 0.05),
            local(0, 2, 0.065, 4.5, 0.045, 0.05), local(0, 6, 0.065, 4.5, 0.045, 0.05)])],
      planes, runner: runner.rig, runnerHeight,
      geometries: [box, disc, pole, runner.geometry, runner.skin],
      materials: [slabMat, trimMat, movingMat, ledgeMat, intactMat, crackedMat, crackMat, goldMat, poleMat, panelMat, ribMat, runner.material],
   };
}

export function disposeTowerParts(parts: TowerParts): void {
   disposeHumanoid(parts.runner);
   for (const geometry of parts.geometries) geometry.dispose();
   for (const material of parts.materials) material.dispose();
}

export function useTowerParts(): TowerParts {
   const parts = useMemo(createTowerParts, []);
   useEffect(() => () => disposeTowerParts(parts), [parts]);
   return parts;
}

/** Same pose data and core skinning as <HumanoidModel>; no independent walk animation. */
export function RunnerPrimitive({ parts, pose }: { parts: TowerParts; pose: HumanoidPose }) {
   useFrame(() => applyHumanoidPose(parts.runner, pose, false));
   return <primitive object={parts.runner.root} dispose={null} />;
}
