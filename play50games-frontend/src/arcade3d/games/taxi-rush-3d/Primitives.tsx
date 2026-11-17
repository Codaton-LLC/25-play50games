"use client";

// Bevelled stand-ins, drawn only when a GLB is missing or broken. Two or three tones each. The cab and
// the rider at their size; the city pieces 1 m tall (like the fitted GLBs), so one spot scale serves both.
import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Material } from "three";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { FIT } from "./assets";
import { COLORS } from "./looks";

const mat = (color: string, roughness = 0.65) => new MeshStandardMaterial({ color, roughness });
const at = (g: BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z);

/** City stand-ins at 1 m tall, built once per mount and disposed on unmount. */
export function useCityParts() {
   const parts = useMemo(
      () => ({
         house: [
            { geometry: at(new BoxGeometry(0.8, 0.78, 0.86), 0, 0.39, 0), material: mat(COLORS.building) },
            { geometry: at(new BoxGeometry(0.86, 0.22, 0.92), 0, 0.89, 0), material: mat(COLORS.buildingTrim, 0.55) },
         ],
         shop: [
            { geometry: at(new BoxGeometry(1.45, 0.82, 1.45), 0, 0.41, 0), material: mat(COLORS.shop) },
            { geometry: at(new BoxGeometry(1.5, 0.14, 0.4), 0, 0.72, 0.62), material: mat(COLORS.shopAwning, 0.5) },
         ],
         bus: [
            { geometry: at(new BoxGeometry(1.5, 0.08, 0.8), 0, 0.96, 0), material: mat(COLORS.bus, 0.5) },
            { geometry: at(new BoxGeometry(1.4, 0.92, 0.06), 0, 0.46, -0.36), material: mat(COLORS.busTrim, 0.4) },
         ],
         light: [
            { geometry: at(new CylinderGeometry(0.03, 0.04, 1, 8), 0, 0.5, 0), material: mat(COLORS.pole, 0.45) },
            { geometry: at(new BoxGeometry(0.12, 0.24, 0.1), 0, 0.86, 0.05), material: mat(COLORS.pole, 0.4) },
         ],
         cone: [
            { geometry: at(new ConeGeometry(0.32, 0.9, 10), 0, 0.5, 0), material: mat(COLORS.cone, 0.55) },
            { geometry: at(new BoxGeometry(0.66, 0.08, 0.66), 0, 0.04, 0), material: mat(COLORS.coneBand, 0.55) },
         ],
         lamp: [
            { geometry: at(new CylinderGeometry(0.025, 0.035, 0.94, 8), 0, 0.47, 0), material: mat(COLORS.lamp, 0.4) },
            { geometry: at(new SphereGeometry(0.06, 10, 8), 0, 0.96, 0), material: new MeshStandardMaterial({ color: COLORS.lampHead, emissive: COLORS.lampHead, emissiveIntensity: 0.5 }) },
         ],
         tree: [
            { geometry: at(new CylinderGeometry(0.04, 0.06, 0.4, 8), 0, 0.2, 0), material: mat(COLORS.trunk, 0.8) },
            { geometry: at(new SphereGeometry(0.33, 12, 9), 0, 0.66, 0), material: mat(COLORS.leaves, 0.7) },
         ],
      }),
      []
   );
   useEffect(
      () => () => {
         for (const list of Object.values(parts)) {
            for (const part of list as InstancePart[]) {
               part.geometry.dispose();
               const m = part.material as Material | Material[];
               if (Array.isArray(m)) m.forEach((x) => x.dispose());
               else m.dispose();
            }
         }
      },
      [parts]
   );
   return parts;
}

/** One <Instanced> per stand-in part. */
export function PartsInstanced({ spots, parts, name }: { spots: readonly InstanceSpot[]; parts: readonly InstancePart[]; name: string }) {
   if (spots.length === 0) return null;
   return (
      <>
         {parts.map((part, i) => (
            <Instanced key={i} spots={spots} name={`${name}-${i}`}>
               <primitive object={part.geometry} attach="geometry" />
               <primitive object={part.material} attach="material" />
            </Instanced>
         ))}
      </>
   );
}

export function TaxiPrimitive() {
   return (
      <group scale={FIT.cabLength / 3.15}>
         <mesh position={[0, 0.42, 0.05]} castShadow={false}>
            <boxGeometry args={[1.55, 0.42, 3.15]} />
            <meshStandardMaterial color={COLORS.taxi} roughness={0.42} metalness={0.08} />
         </mesh>
         <mesh position={[0, 0.78, -0.15]}>
            <boxGeometry args={[1.38, 0.36, 1.55]} />
            <meshStandardMaterial color={COLORS.window} roughness={0.35} metalness={0.12} />
         </mesh>
         <mesh position={[0, 0.22, 0.05]}>
            <boxGeometry args={[1.62, 0.16, 2.4]} />
            <meshStandardMaterial color={COLORS.taxiDark} roughness={0.55} />
         </mesh>
         <mesh position={[0, 1.05, -0.15]}>
            <boxGeometry args={[0.46, 0.1, 0.46]} />
            <meshStandardMaterial color={COLORS.sign} roughness={0.4} />
         </mesh>
      </group>
   );
}

export function RiderPrimitive() {
   return (
      <group scale={FIT.riderHeight / 1.21}>
         <mesh position={[0, 0.55, 0]}>
            <capsuleGeometry args={[0.18, 0.42, 4, 8]} />
            <meshStandardMaterial color={COLORS.rider} roughness={0.6} />
         </mesh>
         <mesh position={[0, 1.05, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.55} />
         </mesh>
         <mesh position={[0, 0.72, 0.16]}>
            <boxGeometry args={[0.28, 0.22, 0.12]} />
            <meshStandardMaterial color={COLORS.riderTrim} roughness={0.5} />
         </mesh>
      </group>
   );
}
