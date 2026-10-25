"use client";

import { useMemo, useEffect } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { MESH_HULL, SUPPORT, BELL } from "./assets";
import { COLORS } from "./looks";

export function RocketPrimitive() {
   const geometry = useMemo(() => {
      const vertices: number[] = [];
      // A shallow convex extrusion stays strictly within the exact XY hull, including its support edge.
      for (let i = 1; i < MESH_HULL.length - 1; i++) {
         for (const z of [-0.3, 0.3]) {
            const indices = z > 0 ? [0, i, i + 1] : [0, i + 1, i];
            for (const n of indices) vertices.push(MESH_HULL[n][0], MESH_HULL[n][1], z);
         }
      }
      for (let i = 0; i < MESH_HULL.length; i++) {
         const a = MESH_HULL[i], b = MESH_HULL[(i + 1) % MESH_HULL.length];
         vertices.push(
            a[0], a[1], -0.3,
            b[0], b[1], -0.3,
            b[0], b[1], 0.3,
            a[0], a[1], -0.3,
            b[0], b[1], 0.3,
            a[0], a[1], 0.3
         );
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(vertices, 3));
      g.computeVertexNormals();
      return g;
   }, []);

   useEffect(() => () => geometry.dispose(), [geometry]);

   return (
      <group name="fallback-rocket">
         {/* Main pearl-white hull */}
         <mesh geometry={geometry}>
            <meshStandardMaterial color={COLORS.rocketHull} roughness={0.4} />
         </mesh>

         {/* Porthole: metallic outer ring + glowing cyan glass */}
         <group position={[0, 1.05, 0.31]}>
            <mesh position={[0, 0, 0]}>
               <ringGeometry args={[0.2, 0.25, 20]} />
               <meshStandardMaterial color={COLORS.rocketGlassRim} roughness={0.3} metalness={0.6} />
            </mesh>
            <mesh position={[0, 0, 0.005]}>
               <circleGeometry args={[0.2, 20]} />
               <meshStandardMaterial color={COLORS.rocketGlass} emissive="#0c4a6e" emissiveIntensity={0.6} roughness={0.2} />
            </mesh>
         </group>

         {/* Red fuselage band with upper/lower trim */}
         <group position={[0, 0.72, 0.315]}>
            <mesh position={[0, 0, 0]}>
               <boxGeometry args={[0.74, 0.12, 0.02]} />
               <meshStandardMaterial color={COLORS.rocketRed} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.065, 0]}>
               <boxGeometry args={[0.74, 0.015, 0.022]} />
               <meshStandardMaterial color={COLORS.rocketRedDark} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.065, 0]}>
               <boxGeometry args={[0.74, 0.015, 0.022]} />
               <meshStandardMaterial color={COLORS.rocketRedDark} roughness={0.4} />
            </mesh>
         </group>

         {/* Engine bell nozzle at base */}
         <mesh position={[BELL.x, BELL.y + 0.05, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 0.12, 12]} />
            <meshStandardMaterial color={COLORS.rocketMetal} roughness={0.5} metalness={0.7} />
         </mesh>

         {/* 4 landing support struts and foot pads matching SUPPORT */}
         {SUPPORT.map((p, i) => (
            <group key={i} position={[p[0] * 0.85, 0.065, 0.31]}>
               <mesh position={[0, 0.04, 0]}>
                  <cylinderGeometry args={[0.025, 0.035, 0.08, 6]} />
                  <meshStandardMaterial color={COLORS.rocketMetal} roughness={0.6} />
               </mesh>
               <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.12, 0.03, 0.08]} />
                  <meshStandardMaterial color="#fb7185" roughness={0.5} />
               </mesh>
            </group>
         ))}
      </group>
   );
}
