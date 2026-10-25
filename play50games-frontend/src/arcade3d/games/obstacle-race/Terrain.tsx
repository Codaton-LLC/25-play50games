"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { stadiumTerrainMesh, type ColoredMesh } from "./looks";

function coloredGeometry(data: ColoredMesh): BufferGeometry {
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
   geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
   geometry.computeVertexNormals();
   return geometry;
}

/**
 * Green turf stadium terrain and perimeter hills surrounding the obstacle pool.
 * The pool cutout is left open so the recessed water plane and floating course sit inside.
 */
export function Terrain() {
   const terrainGeo = useMemo(() => coloredGeometry(stadiumTerrainMesh()), []);

   useEffect(() => () => {
      terrainGeo.dispose();
   }, [terrainGeo]);

   return (
      <group name="obstacle-terrain">
         <mesh geometry={terrainGeo} name="stadium-turf-and-hills">
            <meshStandardMaterial vertexColors roughness={0.85} flatShading />
         </mesh>
      </group>
   );
}
