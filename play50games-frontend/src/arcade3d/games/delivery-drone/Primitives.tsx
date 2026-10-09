"use client";
import { useEffect, useMemo } from "react";
import { BoxGeometry, Color, Float32BufferAttribute, Matrix4, MeshStandardMaterial, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstancePart } from "@/arcade3d/core/render";
import { ROTORS } from "./assets";

export function DronePrimitive() {
   return <group>
      <mesh position={[0, 0.23, -0.1]}><boxGeometry args={[0.48, 0.18, 0.32]} /><meshStandardMaterial color="#f8fafc" roughness={0.65} /></mesh>
      <mesh position={[0, 0.24, 0.075]}><boxGeometry args={[0.18, 0.10, 0.04]} /><meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.3} /></mesh>
      {ROTORS.map((p, i) => <mesh key={i} position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.025, 5, 12]} /><meshStandardMaterial color="#e2e8f0" /></mesh>)}
   </group>;
}

export function mergedBoxes(boxes: ReadonlyArray<readonly [number, number, number, number, number, number, string]>): BufferGeometry {
   const geometries = boxes.map(([x, y, z, w, h, d, tint]) => {
      const source = new BoxGeometry(w, h, d);
      const g = source.toNonIndexed(); source.dispose(); g.translate(x, y, z);
      const color = new Color(tint), colors = new Float32Array(g.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) { colors[i] = color.r; colors[i + 1] = color.g; colors[i + 2] = color.b; }
      // All pieces share one material after merging.
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return g;
   });
   const merged = mergeGeometries(geometries)!;
   for (const g of geometries) g.dispose();
   merged.computeBoundingBox(); merged.computeBoundingSphere(); return merged;
}
export function useBoxParts(width: number, height: number, depth: number, color: string): readonly InstancePart[] {
   const parts = useMemo(() => [{ geometry: new BoxGeometry(width, height, depth), material: new MeshStandardMaterial({ color, roughness: 0.8 }), locals: [new Matrix4().makeTranslation(0, height / 2, 0)] }], [width, height, depth, color]);
   useEffect(() => () => { parts[0].geometry.dispose(); parts[0].material.dispose(); }, [parts]);
   return parts;
}
