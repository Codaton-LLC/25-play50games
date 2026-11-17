"use client";

// Stand-ins until the GLBs are in the manifest. Built at their play size; parents only move and turn them.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import type { Run } from "./rules";

export function SubPrimitive({ run }: { run: Run }) {
   const prop = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const fins = prop.current;
      if (!fins) return;
      const speed = Math.hypot(run.sub.vx, run.sub.vz);
      fins.rotation.z += time.delta * (6 + speed * 5);
   }, FRAME_PRIORITY.visuals);
   return (
      <group>
         <mesh scale={[0.62, 0.36, 0.88]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color={COLORS.hull} roughness={0.32} metalness={0.18} />
         </mesh>
         <mesh position={[0, 0.22, 0.12]} scale={[0.34, 0.22, 0.4]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial color={COLORS.glass} emissive={COLORS.accent} emissiveIntensity={0.45} roughness={0.15} />
         </mesh>
         <mesh position={[0, -0.02, 0.72]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.16, 0.28, 8]} />
            <meshStandardMaterial color={COLORS.accent} emissive={COLORS.accent} emissiveIntensity={0.8} roughness={0.3} />
         </mesh>
         <mesh position={[0, 0.08, -0.78]}>
            <boxGeometry args={[0.5, 0.08, 0.22]} />
            <meshStandardMaterial color={COLORS.hullDark} roughness={0.45} />
         </mesh>
         <group ref={prop} position={[0, 0, -0.92]}>
            <mesh>
               <boxGeometry args={[0.46, 0.06, 0.08]} />
               <meshStandardMaterial color={COLORS.prop} roughness={0.4} metalness={0.3} />
            </mesh>
         </group>
      </group>
   );
}

export function DockPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[2, 2.15, 0.16, 20]} />
            <meshStandardMaterial color={COLORS.dock} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.17, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.55, 1.85, 24]} />
            <meshStandardMaterial color={COLORS.dockTrim} emissive={COLORS.accent} emissiveIntensity={0.35} roughness={0.4} />
         </mesh>
      </group>
   );
}

/** Upright column. The scene lays the whole group on its side; this mesh stays unit-free of a second turn. */
export function ColumnPrimitive() {
   return (
      <group>
         <mesh>
            <cylinderGeometry args={[0.42, 0.46, 2.4, 8]} />
            <meshStandardMaterial color={COLORS.column} roughness={0.72} />
         </mesh>
         <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.48, 0.48, 0.12, 8]} />
            <meshStandardMaterial color={COLORS.columnBand} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function SubModel({ run }: { run: Run }) {
   return <Model asset={ASSETS.miniSubmarine} fallback={<SubPrimitive run={run} />} />;
}
