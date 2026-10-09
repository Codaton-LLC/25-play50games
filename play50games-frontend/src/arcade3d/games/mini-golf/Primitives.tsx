"use client";

// Stand-ins drawn while a GLB is missing (never fetched until it is in the manifest): the windmill,
// the flag, trees and rocks. Same footprint and height as the fitted GLBs.
import { useMemo } from "react";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { CUP } from "./physics";

/** The windmill: a 2.2 m cream tower with a red cone roof (the tunnel is drawn by the dark arch). */
export function WindmillPrimitive() {
   return (
      <group name="windmill-standin">
         <mesh position-y={0.7}>
            <cylinderGeometry args={[0.62, 0.76, 1.4, 16]} />
            <meshStandardMaterial color="#fde68a" roughness={0.8} />
         </mesh>
         <mesh position-y={1.8}>
            <coneGeometry args={[0.72, 0.8, 16]} />
            <meshStandardMaterial color="#dc2626" roughness={0.7} />
         </mesh>
         <mesh position={[0, 0.12, 0.62]}>
            <boxGeometry args={[0.24, 0.24, 0.3]} />
            <meshStandardMaterial color="#1f2937" />
         </mesh>
      </group>
   );
}

/** The flag: a pole and a red pennant, 0.8 m. */
export function FlagPrimitive() {
   return (
      <group name="flag-standin">
         <mesh position-y={CUP.flagHeight / 2}>
            <cylinderGeometry args={[0.015, 0.015, CUP.flagHeight, 6]} />
            <meshStandardMaterial color="#f8fafc" />
         </mesh>
         <mesh position={[0.13, CUP.flagHeight - 0.1, 0]}>
            <boxGeometry args={[0.24, 0.16, 0.01]} />
            <meshStandardMaterial color={COLORS.flag} />
         </mesh>
      </group>
   );
}

export function TreePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const crowns = useMemo(() => spots.map((s) => ({ ...s, y: s.y + 1.5 * (s.scale ?? 1) })), [spots]);
   return (
      <group>
         <Instanced spots={spots}>
            <cylinderGeometry args={[0.08, 0.12, 1.2, 6]} />
            <meshStandardMaterial color="#92400e" />
         </Instanced>
         <Instanced spots={crowns}>
            <icosahedronGeometry args={[0.8, 0]} />
            <meshStandardMaterial color="#65a30d" flatShading />
         </Instanced>
      </group>
   );
}

export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   return (
      <Instanced spots={spots}>
         <dodecahedronGeometry args={[0.45, 0]} />
         <meshStandardMaterial color={COLORS.rockDark} flatShading />
      </Instanced>
   );
}
