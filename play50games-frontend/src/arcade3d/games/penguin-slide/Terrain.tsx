"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { COLORS } from "./looks";

interface TerrainMesh {
   positions: Float32Array;
   colors: Float32Array;
   triangles: number;
}

function hexToRgb(hex: string): [number, number, number] {
   const n = Number.parseInt(hex.slice(1), 16);
   return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const TONES = [
   hexToRgb(COLORS.snowSun),
   hexToRgb(COLORS.terrainSnow),
   hexToRgb(COLORS.terrainShade),
   hexToRgb(COLORS.terrainIce),
];

/**
 * Builds a low-poly rolling arctic terrain surrounding the track.
 * Corridor (|x| <= 5.0) remains smooth and beneath the track surface (y = -0.45).
 * Outside the corridor (|x| > 5.5), gentle rolling snowbanks and icy ridges rise.
 * Slopes downhill along -z at grade 0.08 to match the glacier slope.
 */
function buildTerrainData(): TerrainMesh {
   const pos: number[] = [];
   const col: number[] = [];

   const xMin = -140;
   const xMax = 140;
   const zMin = -240;
   const zMax = 80;
   const step = 8;
   const grade = 0.08;

   const heightAt = (x: number, z: number): number => {
      // Slope baseline
      const base = -grade * z - 0.45;
      const absX = Math.abs(x);
      if (absX <= 5.2) return base;

      // Gentle roll outside the track
      const dist = absX - 5.2;
      const roll = Math.sin(x * 0.12) * Math.cos(z * 0.08) * 0.8 + Math.sin(z * 0.05 + x * 0.03) * 0.5;
      const rise = Math.min(4.5, (dist / 14) * 2.2 + Math.max(0, roll));
      return base + rise;
   };

   const colorAt = (x: number, z: number, y: number): [number, number, number] => {
      const absX = Math.abs(x);
      if (absX <= 5.2) return TONES[1]; // soft snow under track
      const base = -grade * z - 0.45;
      const elevation = y - base;
      if (elevation > 2.5) return TONES[0]; // crisp sunlit ridge crest
      if (elevation > 1.2) return TONES[1]; // soft arctic snow
      if (elevation > 0.4) return TONES[2]; // shaded snow
      return TONES[3]; // icy hollow
   };

   const pushTri = (
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      cx: number, cy: number, cz: number
   ) => {
      pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
      const midX = (ax + bx + cx) / 3;
      const midY = (ay + by + cy) / 3;
      const midZ = (az + bz + cz) / 3;
      const tone = colorAt(midX, midZ, midY);
      for (let k = 0; k < 3; k++) col.push(tone[0], tone[1], tone[2]);
   };

   for (let z = zMin; z < zMax; z += step) {
      for (let x = xMin; x < xMax; x += step) {
         const x2 = Math.min(xMax, x + step);
         const z2 = Math.min(zMax, z + step);

         const h00 = heightAt(x, z);
         const h10 = heightAt(x2, z);
         const h01 = heightAt(x, z2);
         const h11 = heightAt(x2, z2);

         // CCW winding so normal points up
         pushTri(x, h00, z, x, h01, z2, x2, h10, z);
         pushTri(x2, h10, z, x, h01, z2, x2, h11, z2);
      }
   }

   return {
      positions: Float32Array.from(pos),
      colors: Float32Array.from(col),
      triangles: pos.length / 9,
   };
}

function coloredGeometry(data: TerrainMesh): BufferGeometry {
   const geom = new BufferGeometry();
   geom.setAttribute("position", new BufferAttribute(data.positions, 3));
   geom.setAttribute("color", new BufferAttribute(data.colors, 3));
   geom.computeVertexNormals();
   return geom;
}

export function Terrain({ reduced: _reduced }: { reduced: boolean }) {
   const terrainGeo = useMemo(() => coloredGeometry(buildTerrainData()), []);

   useEffect(() => () => {
      terrainGeo.dispose();
   }, [terrainGeo]);

   return (
      <group name="arctic-terrain">
         {/* Expansive rolling low-poly terrain with vertex-colored snow shading */}
         <mesh geometry={terrainGeo} name="rolling-snow-terrain">
            <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0.02} />
         </mesh>

         {/* Deep continuous backing ground plane ensuring no sky/void shows at any camera angle or ratio */}
         <mesh
            name="arctic-ground-base"
            rotation={[-Math.PI / 2 - Math.atan(0.08), 0, 0]}
            position={[0, -1.2, -60]}
         >
            <planeGeometry args={[600, 600]} />
            <meshStandardMaterial color={COLORS.fog} roughness={1.0} />
         </mesh>
      </group>
   );
}
