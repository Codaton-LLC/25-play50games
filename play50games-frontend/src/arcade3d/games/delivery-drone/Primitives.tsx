"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, Color, Float32BufferAttribute, Matrix4, MeshStandardMaterial, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstancePart } from "@/arcade3d/core/render";
import { ROTORS } from "./assets";
import { COLORS } from "./looks";

/**
 * Deliberate modern quadcopter stand-in:
 * Bevelled aerodynamic hull, cyan sensor visor, 4 diagonal carbon arms,
 * rotor cowlings, and landing skids in 3 tones from COLORS.
 */
export function DronePrimitive() {
   return (
      <group name="drone-primitive">
         {/* Main aerodynamic fuselage */}
         <mesh position={[0, 0.23, -0.06]}>
            <boxGeometry args={[0.38, 0.16, 0.36]} />
            <meshStandardMaterial color={COLORS.droneBody} roughness={0.5} />
         </mesh>

         {/* Upper streamlined canopy */}
         <mesh position={[0, 0.32, -0.08]}>
            <boxGeometry args={[0.22, 0.08, 0.24]} />
            <meshStandardMaterial color={COLORS.droneBody} roughness={0.4} />
         </mesh>

         {/* Forward sensor visor dome */}
         <mesh position={[0, 0.25, 0.11]}>
            <boxGeometry args={[0.18, 0.09, 0.06]} />
            <meshStandardMaterial color={COLORS.droneBlue} emissive={COLORS.droneBlue} emissiveIntensity={0.6} />
         </mesh>

         {/* Underside battery pack & hook mount */}
         <mesh position={[0, 0.12, -0.06]}>
            <boxGeometry args={[0.2, 0.08, 0.24]} />
            <meshStandardMaterial color={COLORS.droneDark} roughness={0.8} />
         </mesh>

         {/* Landing skids (left & right) */}
         <mesh position={[-0.14, 0.05, -0.06]}>
            <boxGeometry args={[0.03, 0.07, 0.38]} />
            <meshStandardMaterial color={COLORS.droneDark} roughness={0.7} />
         </mesh>
         <mesh position={[0.14, 0.05, -0.06]}>
            <boxGeometry args={[0.03, 0.07, 0.38]} />
            <meshStandardMaterial color={COLORS.droneDark} roughness={0.7} />
         </mesh>

         {/* Diagonal motor arms and rotor ring cowlings */}
         {ROTORS.map((p, i) => (
            <group key={i}>
               {/* Arm beam from fuselage to motor */}
               <mesh position={[p.x * 0.5, 0.21, p.z * 0.5]}>
                  <boxGeometry args={[0.04, 0.03, Math.hypot(p.x, p.z) * 0.9]} />
                  <meshStandardMaterial color={COLORS.droneDark} roughness={0.8} />
               </mesh>
               {/* Motor pod hub */}
               <mesh position={[p.x, p.y - 0.02, p.z]}>
                  <cylinderGeometry args={[0.04, 0.045, 0.07, 8]} />
                  <meshStandardMaterial color={COLORS.droneDark} roughness={0.6} />
               </mesh>
               {/* Rotor ring guard */}
               <mesh position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.13, 0.015, 6, 16]} />
                  <meshStandardMaterial color={COLORS.droneBody} roughness={0.5} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

/** Merges an array of colored boxes into a single BufferGeometry with vertex colors. */
export function mergedBoxes(
   boxes: ReadonlyArray<readonly [number, number, number, number, number, number, string]>
): BufferGeometry {
   const geometries = boxes.map(([x, y, z, w, h, d, tint]) => {
      const source = new BoxGeometry(w, h, d);
      const g = source.toNonIndexed();
      source.dispose();
      g.translate(x, y, z);
      const color = new Color(tint);
      const count = g.getAttribute("position").count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < colors.length; i += 3) {
         colors[i] = color.r;
         colors[i + 1] = color.g;
         colors[i + 2] = color.b;
      }
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return g;
   });

   const merged = mergeGeometries(geometries)!;
   for (const g of geometries) g.dispose();
   merged.computeBoundingBox();
   merged.computeBoundingSphere();
   return merged;
}

/** Merged multi-part instance fallback sharing 1 draw call. */
export function useMergedPart(
   boxes: ReadonlyArray<readonly [number, number, number, number, number, number, string]>
): readonly InstancePart[] {
   const parts = useMemo(() => {
      const geometry = mergedBoxes(boxes);
      const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
      return [{ geometry, material, locals: [new Matrix4().identity()] }];
   }, [boxes]);

   useEffect(() => () => {
      parts[0].geometry.dispose();
      parts[0].material.dispose();
   }, [parts]);

   return parts;
}

/** Single box parts helper kept for simple stand-in backwards compatibility. */
export function useBoxParts(width: number, height: number, depth: number, color: string): readonly InstancePart[] {
   const parts = useMemo(
      () => [
         {
            geometry: new BoxGeometry(width, height, depth),
            material: new MeshStandardMaterial({ color, roughness: 0.8 }),
            locals: [new Matrix4().makeTranslation(0, height / 2, 0)],
         },
      ],
      [width, height, depth, color]
   );

   useEffect(() => () => {
      parts[0].geometry.dispose();
      parts[0].material.dispose();
   }, [parts]);

   return parts;
}
