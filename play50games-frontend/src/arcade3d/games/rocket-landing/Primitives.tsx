"use client";
import { useMemo, useEffect } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { MESH_HULL, SUPPORT } from "./assets";

export function RocketPrimitive() {
   const geometry = useMemo(() => {
      const vertices: number[] = [];
      // A shallow convex extrusion stays within the exact XY hull, including its support edge.
      for (let i = 1; i < MESH_HULL.length - 1; i++) for (const z of [-0.3, 0.3]) {
         const indices = z > 0 ? [0, i, i + 1] : [0, i + 1, i];
         for (const n of indices) vertices.push(MESH_HULL[n][0], MESH_HULL[n][1], z);
      }
      for (let i = 0; i < MESH_HULL.length; i++) {
         const a = MESH_HULL[i], b = MESH_HULL[(i + 1) % MESH_HULL.length];
         vertices.push(a[0], a[1], -0.3, b[0], b[1], -0.3, b[0], b[1], 0.3, a[0], a[1], -0.3, b[0], b[1], 0.3, a[0], a[1], 0.3);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
      return g;
   }, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return <group>
      <mesh geometry={geometry}><meshStandardMaterial color="#f8fafc" roughness={0.7} /></mesh>
      <mesh position={[0, 1.05, 0.315]}><circleGeometry args={[0.23, 16]} /><meshStandardMaterial color="#38bdf8" emissive="#0c4a6e" /></mesh>
      <mesh position={[0, 0.72, 0.32]}><boxGeometry args={[0.75, 0.13, 0.02]} /><meshStandardMaterial color="#f43f5e" /></mesh>
      {SUPPORT.map((p, i) => <mesh key={i} position={[p[0] * 0.85, 0.065, 0.31]}><boxGeometry args={[0.12, 0.1, 0.08]} /><meshStandardMaterial color="#fb7185" /></mesh>)}
   </group>;
}
