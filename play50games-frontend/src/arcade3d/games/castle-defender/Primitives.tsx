"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, CapsuleGeometry, Color, Matrix4, MeshStandardMaterial } from "three";
import type { InstancePart } from "@/arcade3d/core/render";
import { MUZZLE } from "./assets";

export function useGoblinParts(): InstancePart[] {
   const parts = useMemo(() => {
      const body = new CapsuleGeometry(0.29, 0.6, 4, 8);
      const box = new BoxGeometry(1, 1, 1);
      const material = new MeshStandardMaterial({ color: "#b3ce86", roughness: 0.85 });
      return [
         { geometry: body, material, locals: [new Matrix4().makeTranslation(0, 0.72, 0)] },
         { geometry: box, material, locals: [
            new Matrix4().makeScale(0.65, 0.5, 0.45).setPosition(0, 1.35, 0),
            new Matrix4().makeScale(0.24, 0.17, 0.16).setPosition(-0.43, 1.4, 0),
            new Matrix4().makeScale(0.24, 0.17, 0.16).setPosition(0.43, 1.4, 0),
            new Matrix4().makeScale(0.18, 0.34, 0.24).setPosition(-0.17, 0.17, 0.06),
            new Matrix4().makeScale(0.18, 0.34, 0.24).setPosition(0.17, 0.17, 0.06),
         ] },
      ];
   }, []);
   useEffect(() => () => { for (const p of parts) p.geometry.dispose(); parts[0].material instanceof MeshStandardMaterial && parts[0].material.dispose(); }, [parts]);
   return parts;
}

export function TowerPrimitive() {
   return <group>
      <mesh position={[0, 2.4, 0]}><cylinderGeometry args={[1.25, 1.4, 4.8, 10]} /><meshStandardMaterial color="#a8a29e" /></mesh>
      <mesh position={[0, 5.4, 0]}><coneGeometry args={[1.5, 1.2, 10]} /><meshStandardMaterial color="#3b82f6" /></mesh>
   </group>;
}
export function GatePrimitive() {
   return <mesh position={[0, 1.5, 0]}><boxGeometry args={[1.88, 3, 0.42]} /><meshStandardMaterial color="#78350f" /></mesh>;
}
export function CannonPrimitive() {
   return <group>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.15, 0.6, 1.1]} /><meshStandardMaterial color="#92400e" /></mesh>
      <mesh position={[0, MUZZLE.y - 1.2, -0.22]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.24, 0.33, 2 * (3 - MUZZLE.z - 0.22), 12]} /><meshStandardMaterial color="#334155" /></mesh>
   </group>;
}
export function TreePrimitive() {
   return <group>
      <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.16, 0.22, 1.8, 7]} /><meshStandardMaterial color="#92400e" /></mesh>
      <mesh position={[0, 2.35, 0]}><icosahedronGeometry args={[1.15, 1]} /><meshStandardMaterial color="#4d7c0f" /></mesh>
   </group>;
}
export const GOBLIN_TINTS = {
   walker: new Color("#ffffff"), shield: new Color("#d9e5ff"), runner: new Color("#ffd5ab"), crew: new Color("#ead7ff"),
};
