"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Mesh,
   MeshBasicMaterial, MeshStandardMaterial, Plane, Quaternion, SphereGeometry, Vector3,
   type Group, type Material, type WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstancePart } from "@/arcade3d/core/render";
import type { RunnerGait } from "./runnerGait";

export const COLORS = {
   background: "#122536", slab: "#39cadd", moving: "#a890e5", ledge: "#36aead",
   spur: "#ffa862", cracked: "#ec725d", coin: "#ffd35d", tower: "#213c50",
} as const;

/**
 * The runner draws after every other opaque object (three's group order: the runner's groups carry
 * this renderOrder) and after a depth reset (`depthReset`), so it shows whole in front of the slab it
 * stands under or jumps up through. Collision is x/y only; the runner is never behind anything.
 */
export const RUNNER_ORDER = 1;

/** The stand-in's joints (m, feet at y = 0, facing +z), authored at RUNNER.height = 0.55 m. */
export const STAND_IN = { height: 0.55, hipY: 0.2, hipX: 0.063, shoulderY: 0.355, shoulderX: 0.135 } as const;

export interface TowerParts {
   slab: InstancePart[]; moving: InstancePart[]; ledge: InstancePart[];
   intact: InstancePart[]; cracked: InstancePart[]; coin: InstancePart[];
   flag: InstancePart[]; tower: InstancePart[];
   /** [0] clips below the danger line (viewBottomY), [1] above the column top; Scene moves them every frame */
   planes: Plane[];
   /** the stand-in's rigid pieces: trunk (torso, head, cap), one leg (pivot at the hip), one arm (pivot at the shoulder) */
   runnerTrunk: BufferGeometry; runnerLeg: BufferGeometry; runnerArm: BufferGeometry; runnerMaterial: Material;
   /** an empty draw whose onBeforeRender clears the depth buffer just before the runner (RUNNER_ORDER) */
   depthReset: Mesh;
   geometries: BufferGeometry[]; materials: Material[];
}

function local(x: number, y: number, z: number, sx: number, sy: number, sz: number): Matrix4 {
   return new Matrix4().compose(new Vector3(x, y, z), new Quaternion(), new Vector3(sx, sy, sz));
}

function tilted(x: number, y: number, z: number, sx: number, sy: number, sz: number, angle: number): Matrix4 {
   return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), angle), new Vector3(sx, sy, sz));
}

/** Vertex-coloured boxes/spheres merged into one geometry (one draw call per piece). */
function merged(build: (add: (geometry: BufferGeometry, x: number, y: number, z: number, color: string) => void) => void): BufferGeometry {
   const pieces: BufferGeometry[] = [];
   build((geometry, x, y, z, color) => {
      const shape = geometry.toNonIndexed(); geometry.dispose(); shape.translate(x, y, z);
      const tint = new Color(color), colors = new Float32Array(shape.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = tint.r; colors[i + 1] = tint.g; colors[i + 2] = tint.b; }
      shape.setAttribute("color", new Float32BufferAttribute(colors, 3)); pieces.push(shape);
   });
   const geometry = mergeGeometries(pieces)!;
   for (const piece of pieces) piece.dispose();
   return geometry;
}

const HOODIE = "#ef995c", SKIN = "#f3d5b6", VISOR = "#19364b", CAP = "#ffd35d", PANTS = "#283951", SHOE = "#ecf1ef";

/** The runner stand-in: a hoodie, head, cap and sneakers in three rigid pieces, 0.55 m tall. */
function runnerPieces(): { trunk: BufferGeometry; leg: BufferGeometry; arm: BufferGeometry } {
   const { hipY } = STAND_IN;
   const trunk = merged(add => {
      add(new BoxGeometry(0.22, 0.18, 0.12), 0, 0.28, 0, HOODIE);
      add(new SphereGeometry(1, 20, 14).scale(0.115, 0.083, 0.094), 0, 0.465, 0, SKIN);
      add(new BoxGeometry(0.154, 0.033, 0.014), 0, 0.47, 0.09, VISOR);
      add(new BoxGeometry(0.165, 0.025, 0.105), 0, 0.537, -0.008, CAP);
   });
   // pivot-local: the hip at the origin, the sole at y = -hipY
   const leg = merged(add => {
      add(new BoxGeometry(0.066, hipY - 0.045, 0.07), 0, -(hipY - 0.045) / 2, 0, PANTS);
      add(new BoxGeometry(0.094, 0.055, 0.12), 0, -hipY + 0.0275, 0.011, SHOE);
   });
   // pivot-local: the shoulder at the origin, the arm hanging down
   const arm = merged(add => {
      add(new BoxGeometry(0.05, 0.15, 0.055), 0, -0.075, 0, HOODIE);
      add(new BoxGeometry(0.055, 0.045, 0.055), 0, -0.172, 0, SKIN);
   });
   return { trunk, leg, arm };
}

function clearDepth(renderer: WebGLRenderer): void {
   renderer.state.buffers.depth.setMask(true);
   renderer.clearDepth();
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
   // Slabs and spurs are drawn while their top is in the column (visuals.ts): their bodies stop at the
   // danger line. Coins and flags are drawn only whole inside it, so clipping the shared gold/trim is moot.
   for (const clipped of [panelMat, ribMat, slabMat, movingMat, ledgeMat, intactMat, crackedMat, trimMat, goldMat, crackMat]) {
      clipped.clippingPlanes = planes;
   }
   const part = (mat: Material, locals: Matrix4[]): InstancePart => ({ geometry: box, material: mat, locals });
   const body = (width: number) => [local(0, -0.08, 0, width, 0.16, 0.6)];
   const runner = runnerPieces();
   const runnerMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
   const resetGeometry = new BufferGeometry();
   resetGeometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(9), 3));
   const resetMaterial = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false });
   const depthReset = new Mesh(resetGeometry, resetMaterial);
   depthReset.name = "runner-depth-reset";
   depthReset.frustumCulled = false;
   depthReset.renderOrder = -1;
   depthReset.onBeforeRender = clearDepth;
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
      planes,
      runnerTrunk: runner.trunk, runnerLeg: runner.leg, runnerArm: runner.arm, runnerMaterial, depthReset,
      geometries: [box, disc, pole, runner.trunk, runner.leg, runner.arm, resetGeometry],
      materials: [slabMat, trimMat, movingMat, ledgeMat, intactMat, crackedMat, crackMat, goldMat, poleMat, panelMat, ribMat,
         runnerMaterial, resetMaterial],
   };
}

export function disposeTowerParts(parts: TowerParts): void {
   for (const geometry of parts.geometries) geometry.dispose();
   for (const material of parts.materials) material.dispose();
}

export function useTowerParts(): TowerParts {
   const parts = useMemo(createTowerParts, []);
   useEffect(() => () => disposeTowerParts(parts), [parts]);
   return parts;
}

/** Limb angles of the rigid stand-in (rad, about each pivot's x: negative swings forward/up). Pure. */
export function standInLimbs(g: RunnerGait, out: { legL: number; legR: number; armL: number; armR: number; raise: number }) {
   const swing = Math.sin(g.phase) * g.amount;
   // the core walk's convention: the left leg is forward at phase pi/2; the arms swing against the legs
   const walkLegL = -0.75 * swing, walkLegR = 0.75 * swing, walkArmL = 0.6 * swing, walkArmR = -0.6 * swing;
   const tuckLeg = -1.1 * g.tuck, tuckArm = -0.5 - 0.7 * g.tuck;
   out.legL = walkLegL + (tuckLeg - walkLegL) * g.air;
   out.legR = walkLegR + (tuckLeg - walkLegR) * g.air;
   out.armL = walkArmL + (tuckArm - walkArmL) * g.air;
   out.armR = walkArmR + (tuckArm - walkArmR) * g.air;
   // arms out and up in a V (about z) for the cheer
   out.raise = 2.5 * g.cheer;
   return out;
}

/**
 * The stand-in drawn while runner.glb is missing or broken: rigid pieces whose legs and arms swing
 * from the same gait as the GLB's pose (walk by the runner's own ground motion, tuck in the air, arms
 * up on a checkpoint), never a gliding statue. Every group carries RUNNER_ORDER (a plain group would
 * reset three's group order to 0 and the slabs could hide it).
 */
export function RunnerPrimitive({ parts, gait }: { parts: TowerParts; gait: RunnerGait }) {
   const legL = useRef<Group>(null), legR = useRef<Group>(null), armL = useRef<Group>(null), armR = useRef<Group>(null);
   const limbs = useMemo(() => ({ legL: 0, legR: 0, armL: 0, armR: 0, raise: 0 }), []);
   useFrame(() => {
      if (!legL.current || !legR.current || !armL.current || !armR.current) return;
      standInLimbs(gait, limbs);
      legL.current.rotation.x = limbs.legL; legR.current.rotation.x = limbs.legR;
      armL.current.rotation.set(limbs.armL, 0, limbs.raise); armR.current.rotation.set(limbs.armR, 0, -limbs.raise);
   });
   const { hipY, hipX, shoulderY, shoulderX } = STAND_IN;
   return (
      <group renderOrder={RUNNER_ORDER}>
         <mesh geometry={parts.runnerTrunk} material={parts.runnerMaterial} />
         {/* L is the character's own left: +x while it faces +z */}
         <group ref={legL} position={[hipX, hipY, 0]} renderOrder={RUNNER_ORDER}>
            <mesh geometry={parts.runnerLeg} material={parts.runnerMaterial} />
         </group>
         <group ref={legR} position={[-hipX, hipY, 0]} renderOrder={RUNNER_ORDER}>
            <mesh geometry={parts.runnerLeg} material={parts.runnerMaterial} />
         </group>
         <group ref={armL} position={[shoulderX, shoulderY, 0]} renderOrder={RUNNER_ORDER}>
            <mesh geometry={parts.runnerArm} material={parts.runnerMaterial} />
         </group>
         <group ref={armR} position={[-shoulderX, shoulderY, 0]} renderOrder={RUNNER_ORDER}>
            <mesh geometry={parts.runnerArm} material={parts.runnerMaterial} />
         </group>
      </group>
   );
}
