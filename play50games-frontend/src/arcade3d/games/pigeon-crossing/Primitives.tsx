"use client";

import { useEffect, useState } from "react";
import { BoxGeometry, Color, CylinderGeometry, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry, type Material } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { InstancePart } from "@/arcade3d/core/render";
import { PIGEON_SHAPES } from "./camera";
import { PLAY_HALF_WIDTH, ROW_PITCH, VEHICLE_TYPES } from "./rules";

export const COLORS = {
   background: "#bfd6d5", road: "#526579", grass: "#85ae78", curb: "#cbd5c4",
   markings: "#f5e7b7", cover: "#a5bdb3",
} as const;

export interface StreetParts {
   vehicles: InstancePart[][];
   road: InstancePart[];
   grass: InstancePart[];
   curbs: InstancePart[];
   markings: InstancePart[];
   grassMarks: InstancePart[];
   geometries: BufferGeometry[];
   materials: Material[];
}

function boxAt(x: number, y: number, z: number, sx: number, sy: number, sz: number): Matrix4 {
   return new Matrix4().compose(new Vector3(x, y, z), new Quaternion(), new Vector3(sx, sy, sz));
}

/** Created once per Scene mount; each piece is instanced for every copy, with fixed colours. */
export function createStreetParts(): StreetParts {
   const rounded = new RoundedBoxGeometry(1, 1, 1, 2, 0.10);
   const wheel = new CylinderGeometry(0.22, 0.22, 0.14, 12);
   const box = new BoxGeometry(1, 1, 1);
   const bodyMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.58, metalness: 0.04 });
   const wheelMat = new MeshStandardMaterial({ color: "#253348", roughness: 0.85 });
   const roadMat = new MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 });
   const grassMat = new MeshStandardMaterial({ color: COLORS.grass, roughness: 1 });
   const curbMat = new MeshStandardMaterial({ color: COLORS.curb, roughness: 0.85 });
   const paintMat = new MeshStandardMaterial({ color: COLORS.markings, roughness: 0.85 });
   const grassMarkMat = new MeshStandardMaterial({ color: "#a5c38a", roughness: 1 });
   const vehicles: InstancePart[][] = [];
   for (let kind = 0; kind < VEHICLE_TYPES.length; kind++) {
      const type = VEHICLE_TYPES[kind], van = kind === 2;
      const lower = boxAt(0, van ? 0.68 : 0.43, 0, type.depth - 0.10, van ? 1.00 : 0.48, type.length - 0.16);
      const cabin = boxAt(0, van ? 1.08 : 0.88, van ? 0.32 : -0.08, type.depth * 0.78, van ? 0.42 : 0.50, type.length * (van ? 0.42 : 0.52));
      const windshield = boxAt(0, van ? 1.03 : 0.88, type.length * (van ? 0.335 : 0.255), type.depth * 0.65, van ? 0.28 : 0.30, 0.035);
      const bumper = boxAt(0, 0.38, type.length / 2 - 0.085, type.depth * 0.72, 0.11, 0.045);
      const locals = [lower, cabin, windshield, bumper];
      const color = kind === 0 ? "#f47967" : kind === 1 ? "#ffd15b" : "#e9edf3";
      const colors = [new Color(color), new Color(color), new Color("#354b60"), new Color("#eef2e1")];
      if (kind === 1) { locals.push(boxAt(0, 1.225, 0, 0.32, 0.14, 0.42)); colors.push(new Color("#fff1a8")); }
      const wheels: Matrix4[] = [];
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
         wheels.push(new Matrix4().makeRotationZ(Math.PI / 2).setPosition(x * (type.depth / 2 - 0.09), 0.22, z * type.length * 0.28));
      }
      vehicles.push([{ geometry: rounded, material: bodyMat, locals, colors }, { geometry: wheel, material: wheelMat, locals: wheels }]);
   }
   const row = [boxAt(0, -0.05, 0, 12, 0.10, ROW_PITCH)];
   const curbs = [boxAt(-PLAY_HALF_WIDTH - 0.18, 0.035, 0, 0.16, 0.07, ROW_PITCH), boxAt(PLAY_HALF_WIDTH + 0.18, 0.035, 0, 0.16, 0.07, ROW_PITCH)];
   const dashes: Matrix4[] = [], grassMarks: Matrix4[] = [];
   for (let col = 0; col < 7; col++) {
      const x = (col - 3) * 1.6;
      dashes.push(boxAt(x, 0.006, -ROW_PITCH / 2, 0.78, 0.012, 0.055));
      grassMarks.push(boxAt(x, 0.003, 0.30, 0.20, 0.006, 0.11));
   }
   return {
      vehicles,
      road: [{ geometry: box, material: roadMat, locals: row }],
      grass: [{ geometry: box, material: grassMat, locals: row }],
      curbs: [{ geometry: box, material: curbMat, locals: curbs }],
      markings: [{ geometry: box, material: paintMat, locals: dashes }],
      grassMarks: [{ geometry: box, material: grassMarkMat, locals: grassMarks }],
      geometries: [rounded, wheel, box],
      materials: [bodyMat, wheelMat, roadMat, grassMat, curbMat, paintMat, grassMarkMat],
   };
}

export function disposeStreetParts(parts: StreetParts): void {
   for (const geometry of parts.geometries) geometry.dispose();
   for (const material of parts.materials) material.dispose();
}

export function useStreetParts(): StreetParts {
   const [parts] = useState(createStreetParts);
   useEffect(() => () => disposeStreetParts(parts), [parts]);
   return parts;
}

/** Unrigged, folded wings. Whole-body hop/squash is driven by the parent visual group. */
export function PigeonPrimitive() {
   return (
      <group name="pigeon-primitive">
         {PIGEON_SHAPES.map((part) => (
            <mesh key={part.name} name={part.name} position={[...part.position]} scale={part.shape === "sphere" ? [...part.size] : undefined}>
               {part.shape === "sphere" ? <sphereGeometry args={[1, 32, 24]} /> : <boxGeometry args={[...part.size]} />}
               <meshStandardMaterial color={part.color} roughness={0.65} />
            </mesh>
         ))}
      </group>
   );
}
