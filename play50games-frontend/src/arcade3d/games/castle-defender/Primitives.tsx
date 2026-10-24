"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, CapsuleGeometry, Matrix4, MeshStandardMaterial } from "three";
import { Instanced, type InstancePart } from "@/arcade3d/core/render";
import { MUZZLE } from "./assets";
import { COLORS, TOWERS } from "./looks";

export function useGoblinParts(): InstancePart[] {
   const parts = useMemo(() => {
      const body = new CapsuleGeometry(0.29, 0.6, 4, 8);
      const box = new BoxGeometry(1, 1, 1);
      // white, so a per-copy tint (Goblins) is the colour the stand-in actually shows
      const material = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });
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

/** One tower: stone shaft and a pointed roof. The rings, balcony and flag are drawn with it. */
export function TowerPrimitive() {
   return <group>
      <mesh position={[0, 2.25, 0]}><cylinderGeometry args={[2, 2.22, 4.5, 10]} /><meshStandardMaterial color={COLORS.stone} roughness={0.95} /></mesh>
      <mesh position={[0, 5.25, 0]}><coneGeometry args={[2.3, 1.55, 10]} /><meshStandardMaterial color={COLORS.banner} roughness={0.75} /></mesh>
   </group>;
}
/** Both towers, when the tower GLB is missing. Shafts sit on y 0 and reach 6 m, matching the fitted GLB. */
export function TowerFallback() {
   const shafts = useMemo(() => TOWERS.map((tower) => ({ x: tower.x, y: 2.25, z: tower.z })), []);
   const roofs = useMemo(() => TOWERS.map((tower) => ({ x: tower.x, y: 5.25, z: tower.z })), []);
   return <group>
      <Instanced spots={shafts}><cylinderGeometry args={[2, 2.22, 4.5, 10]} /><meshStandardMaterial color={COLORS.stone} roughness={0.95} /></Instanced>
      <Instanced spots={roofs}><coneGeometry args={[2.3, 1.55, 10]} /><meshStandardMaterial color={COLORS.banner} roughness={0.75} /></Instanced>
   </group>;
}
export function GatePrimitive() {
   return <mesh position={[0, 1.5, 0]}><boxGeometry args={[1.88, 3, 0.42]} /><meshStandardMaterial color={COLORS.wood} /></mesh>;
}
export function CannonPrimitive() {
   return <group>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[1.15, 0.6, 1.1]} /><meshStandardMaterial color="#92400e" /></mesh>
      <mesh position={[0, MUZZLE.y - 1.2, -0.22]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.24, 0.33, 2 * (3 - MUZZLE.z - 0.22), 12]} /><meshStandardMaterial color="#334155" /></mesh>
   </group>;
}
export function TreePrimitive() {
   return <group>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.12, 0.2, 1.1, 6]} /><meshStandardMaterial color={COLORS.trunk} /></mesh>
      <mesh position={[0, 1.7, 0]}><coneGeometry args={[0.85, 1.8, 7]} /><meshStandardMaterial color={COLORS.pineA} flatShading /></mesh>
   </group>;
}
