"use client";

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, RepeatWrapping } from "three";
import { Water } from "@/arcade3d/core/env";
import { useCanvasTexture, type CanvasDraw } from "@/arcade3d/core/render";
import { COLORS, WATER, hillMesh, roadMesh, type ColoredMesh } from "./looks";

const drawMeadow: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = COLORS.grass;
   ctx.fillRect(0, 0, width, height);
   const blobs = [COLORS.grassSun, COLORS.grassShade, COLORS.grassDeep];
   for (let i = 0; i < 42; i++) {
      ctx.fillStyle = blobs[i % blobs.length];
      ctx.globalAlpha = 0.28 + (i % 4) * 0.08;
      ctx.beginPath();
      ctx.ellipse((i * 97) % width, (i * 53) % height, 28 + (i * 17) % 70, 16 + (i * 13) % 36, ((i * 19) % 50) * 0.02, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.globalAlpha = 1;
};

function coloredGeometry(data: ColoredMesh): BufferGeometry {
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
   geometry.setAttribute("color", new BufferAttribute(data.colors, 3));
   geometry.computeVertexNormals();
   return geometry;
}

/** Flat meadow at y 0, low hills beyond it, a cobbled strip on each lane, and the far-left river. */
export function Terrain({ reduced, ground = "#ffffff" }: { reduced: boolean; ground?: string }) {
   const hills = useMemo(() => coloredGeometry(hillMesh()), []);
   const roads = useMemo(() => coloredGeometry(roadMesh()), []);
   const meadow = useCanvasTexture(512, 512, drawMeadow);
   useEffect(() => {
      meadow.wrapS = meadow.wrapT = RepeatWrapping;
      meadow.repeat.set(3, 3);
      meadow.needsUpdate = true;
   }, [meadow]);
   useEffect(() => () => {
      hills.dispose();
      roads.dispose();
   }, [hills, roads]);
   return (
      <group name="castle-terrain">
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.6]} name="castle-meadow">
            <planeGeometry args={[16, 15]} />
            <meshStandardMaterial map={meadow} color={ground} roughness={1} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
         </mesh>
         <mesh geometry={hills} dispose={null} name="castle-hills">
            <meshStandardMaterial vertexColors color={ground} flatShading roughness={1} />
         </mesh>
         <mesh geometry={roads} dispose={null} name="castle-roads">
            <meshStandardMaterial vertexColors color={ground} roughness={1} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
         </mesh>
         <Water
            size={[WATER.width, WATER.depth]}
            position={[WATER.x, WATER.y, WATER.z]}
            color={COLORS.water}
            deep={COLORS.waterDeep}
            foam={COLORS.foam}
            amplitude={reduced ? 0 : 0.05}
            wavelength={4.5}
            speed={reduced ? 0 : 0.55}
            foamEdge={0.07}
         />
      </group>
   );
}
