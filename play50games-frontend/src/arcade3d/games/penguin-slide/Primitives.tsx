"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, Matrix4, MeshStandardMaterial, SphereGeometry } from "three";
import type { InstancePart } from "@/arcade3d/core/render";

export function PenguinPrimitive() {
   return (
      <group>
         <mesh position={[0, 0.39, 0]} scale={[0.29, 0.4, 0.27]}>
            <sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color="#172f43" roughness={0.65} />
         </mesh>
         <mesh position={[0, 0.39, 0.14]} scale={[0.23, 0.32, 0.17]}>
            <sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#fffaf0" roughness={0.75} />
         </mesh>
         <mesh position={[0, 0.65, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.09, 0.2, 6]} /><meshStandardMaterial color="#fb923c" />
         </mesh>
         {[-1, 1].map((side) => <mesh key={side} position={[side * 0.29, 0.42, 0]} scale={[0.12, 0.24, 0.07]} rotation={[0, 0, side * 0.5]}>
            <sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#172f43" />
         </mesh>)}
      </group>
   );
}

export function usePropParts(kind: "fish" | "pine" | "flag" | "ice" | "snowman" | "crack" | "ramp"): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const at = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => new Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z);
      if (kind === "fish") return [
         { geometry: new SphereGeometry(1, 10, 6), material: new MeshStandardMaterial({ color: "#fb923c", roughness: 0.5 }), locals: [at(0, 0, 0, 0.1, 0.12, 0.19), at(0, 0, -0.18, 0.12, 0.04, 0.08)] },
      ];
      if (kind === "pine") return [
         { geometry: new ConeGeometry(1, 1, 7), material: new MeshStandardMaterial({ color: "#286756", roughness: 1 }), locals: [at(0, 1.35, 0, 0.95, 1.8, 0.95), at(0, 2.4, 0, 0.7, 1.7, 0.7), at(0, 3.3, 0, 0.4, 1.4, 0.4)] },
         { geometry: new CylinderGeometry(0.13, 0.18, 1, 6), material: new MeshStandardMaterial({ color: "#8c674e" }), locals: [at(0, 0.5, 0)] },
      ];
      if (kind === "flag") return [
         { geometry: new CylinderGeometry(0.045, 0.045, 1.5, 6), material: new MeshStandardMaterial({ color: "#e0f2fe" }), locals: [at(0, 0.75, 0)] },
         { geometry: new BoxGeometry(0.5, 0.3, 0.03), material: new MeshStandardMaterial({ color: "#38bdf8" }), locals: [at(0.25, 1.25, 0)] },
      ];
      if (kind === "snowman") return [
         { geometry: new SphereGeometry(1, 10, 8), material: new MeshStandardMaterial({ color: "#fff5ed", roughness: 0.9 }), locals: [at(0, 0.45, 0, 0.5, 0.5, 0.5), at(0, 1.03, 0, 0.32, 0.32, 0.32)] },
         { geometry: new ConeGeometry(0.07, 0.24, 5), material: new MeshStandardMaterial({ color: "#fb7185" }), locals: [new Matrix4().makeRotationX(Math.PI / 2).setPosition(0, 1.06, 0.34)] },
      ];
      if (kind === "crack") return [
         { geometry: new CylinderGeometry(0.6, 0.6, 0.035, 7), material: new MeshStandardMaterial({ color: "#203b54" }), locals: [at(0, 0.025, 0)] },
         { geometry: new CylinderGeometry(0.67, 0.67, 0.015, 7), material: new MeshStandardMaterial({ color: "#fb7185" }), locals: [at(0, 0.01, 0)] },
      ];
      if (kind === "ramp") return [
         { geometry: new BoxGeometry(1, 1, 1), material: new MeshStandardMaterial({ color: "#a5f3fc", roughness: 0.45 }), locals: [at(0, -0.01, 0, 1.6, 0.02, 3), new Matrix4().makeRotationX(-0.2).multiply(at(0, 0, 0, 0.1, 0.2, 3)).setPosition(-0.85, 0.3, 0), new Matrix4().makeRotationX(-0.2).multiply(at(0, 0, 0, 0.1, 0.2, 3)).setPosition(0.85, 0.3, 0)] },
      ];
      return [{ geometry: new BoxGeometry(1.05, 1, 1.05), material: new MeshStandardMaterial({ color: "#fb8c9a", roughness: 0.5 }), locals: [at(0, 0.5, 0)] }];
   }, [kind]);
   useEffect(() => () => { for (const p of parts) { p.geometry.dispose(); const materials = Array.isArray(p.material) ? p.material : [p.material]; for (const m of materials) m.dispose(); } }, [parts]);
   return parts;
}
