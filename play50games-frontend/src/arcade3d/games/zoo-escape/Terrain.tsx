"use client";

// Zoo Escape's terrain: organic lawn with canvas texture, paved visitor plaza,
// asphalt parking with curbs and crosswalks, moat water and stone banks.
// The outer terrain extends far beyond the camera frustum so no void is ever seen.
import { useEffect, useMemo } from "react";
import { BoxGeometry, RepeatWrapping, type BufferGeometry } from "three";
import { Water } from "@/arcade3d/core/env";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import { BRIDGE, MOAT, PROPS } from "./level";
import { bridgePieces, useMerged } from "./Primitives";

export const MEADOW_BLOTCH_ALPHA = 0.08;

export const TERRAIN_LAYERS = {
   outerGround: { y: -0.08, offsetFactor: 0, offsetUnits: 0 },
   meadow: { y: 0, offsetFactor: -1, offsetUnits: -1 },
   plaza: { y: 0.002, offsetFactor: -1, offsetUnits: -1 },
   asphalt: { y: 0.003, offsetFactor: -1, offsetUnits: -1 },
   paths: { y: 0.007, offsetFactor: -2, offsetUnits: -2 },
   crosswalk: { y: 0.008, offsetFactor: -3, offsetUnits: -3 },
   parkingLines: { y: 0.009, offsetFactor: -3, offsetUnits: -3 },
} as const;
const drawMeadow: CanvasDraw = (ctx, width, height) => {
   // Warm rich zoo lawn base
   ctx.fillStyle = COLORS.grass;
   ctx.fillRect(0, 0, width, height);

   // Natural organic grass patches: sunlit, shade, and earth mulch
   const tones = [COLORS.grassSun, COLORS.grassShade, COLORS.grassDeep, COLORS.earth];
   for (let i = 0; i < 48; i++) {
      ctx.fillStyle = tones[i % tones.length];
      ctx.globalAlpha = MEADOW_BLOTCH_ALPHA;
      ctx.beginPath();
      const cx = (i * 103) % width;
      const cy = (i * 67) % height;
      const rx = 24 + (i * 19) % 55;
      const ry = 16 + (i * 13) % 40;
      const rot = ((i * 23) % 60) * 0.03;
      ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
   }
   ctx.globalAlpha = 1;
};

const drawPlaza: CanvasDraw = (ctx, width, height) => {
   // Sandstone pavers with decorative pattern
   ctx.fillStyle = COLORS.paving;
   ctx.fillRect(0, 0, width, height);
   ctx.fillStyle = COLORS.path;
   ctx.globalAlpha = 0.35;
   const step = 32;
   for (let x = 0; x < width; x += step) {
      for (let y = 0; y < height; y += step) {
         if ((x + y) % (step * 2) === 0) {
            ctx.fillRect(x + 2, y + 2, step - 4, step - 4);
         }
      }
   }
   ctx.globalAlpha = 1;
};

const centre = (p: (typeof PROPS)[number]) => ({
   x: (p.box.min.x + p.box.max.x) / 2,
   y: 0,
   z: (p.box.min.z + p.box.max.z) / 2,
});

const TERRAIN_SPOTS = {
   banks: MOAT.flatMap((m) =>
      [m.min.z, m.max.z].map((z) => ({
         x: (m.min.x + m.max.x) / 2,
         y: 0.04,
         z,
         sx: m.max.x - m.min.x,
         sy: 0.14,
         sz: 0.35,
      }))
   ),
   paths: [
      { x: 4, y: 0.007, z: -3.5, sx: 2.4, sy: 1, sz: 7.2 },
      { x: -0.5, y: 0.007, z: -8, sx: 11.2, sy: 1, sz: 2.4 },
      { x: -0.5, y: 0.007, z: -12.5, sx: 2.4, sy: 1, sz: 9.2 },
      { x: -2.8, y: 0.007, z: -17.5, sx: 7.2, sy: 1, sz: 2.4 },
      { x: -5, y: 0.007, z: -19, sx: 2.4, sy: 1, sz: 3.2 },
      { x: 0, y: 0.007, z: 0.35, sx: 9.2, sy: 1, sz: 0.6 },
   ] as InstanceSpot[],
   curbs: [
      // Enclosure & plaza perimeter stone curbs
      { x: -7.05, y: 0.03, z: 9, sx: 0.22, sy: 0.08, sz: 18.2 },
      { x: 7.05, y: 0.03, z: 9, sx: 0.22, sy: 0.08, sz: 18.2 },
      { x: 0, y: 0.03, z: 18.05, sx: 14.3, sy: 0.08, sz: 0.22 },
      // Parking curbs
      { x: -10.05, y: 0.03, z: -31, sx: 0.22, sy: 0.08, sz: 22.2 },
      { x: 10.05, y: 0.03, z: -31, sx: 0.22, sy: 0.08, sz: 22.2 },
      { x: 0, y: 0.03, z: -42.05, sx: 20.3, sy: 0.08, sz: 0.22 },
   ] as InstanceSpot[],
   parkingLines: [
      ...PROPS.filter((p) => p.kind === "car").flatMap((p) =>
         [-1.25, 1.25].map((dx) => ({
            x: centre(p).x + dx,
            y: 0.009,
            z: centre(p).z,
            sx: 0.12,
            sy: 1,
            sz: 4.8,
         }))
      ),
      ...Array.from({ length: 8 }, (_, i) => ({
         x: -8.5 + i * 2.4,
         y: 0.009,
         z: -31.5,
         sx: 1.2,
         sy: 1,
         sz: 0.14,
      })),
   ] as InstanceSpot[],
   crosswalk: [
      // Amber pedestrian zebra crosswalk strip towards gate 3
      ...Array.from({ length: 6 }, (_, i) => ({
         x: 4.8 + i * 0.6,
         y: 0.008,
         z: -39.2,
         sx: 0.35,
         sy: 1,
         sz: 2.2,
      })),
   ] as InstanceSpot[],
};

export function Terrain({ reduced }: { reduced: boolean }) {
   const meadowTexture = useCanvasTexture(512, 512, drawMeadow);
   const plazaTexture = useCanvasTexture(256, 256, drawPlaza);
   const bridge = useMerged(bridgePieces);

   useEffect(() => {
      meadowTexture.wrapS = meadowTexture.wrapT = RepeatWrapping;
      meadowTexture.repeat.set(10, 14);
      meadowTexture.needsUpdate = true;

      plazaTexture.wrapS = plazaTexture.wrapT = RepeatWrapping;
      plazaTexture.repeat.set(4, 4);
      plazaTexture.needsUpdate = true;
   }, [meadowTexture, plazaTexture]);

   return (
      <group name="zoo-terrain">
         {/* Vast outer zoo grounds: covers the entire viewport on all 3 screen sizes */}
         <mesh rotation-x={-Math.PI / 2} position={[0, TERRAIN_LAYERS.outerGround.y, -13]} name="outer-ground">
            <planeGeometry args={[160, 200]} />
            <meshStandardMaterial map={meadowTexture} roughness={0.95} />
         </mesh>

         {/* Stage 0: Panda Enclosure lush lawn */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 9]} name="enclosure-meadow">
            <planeGeometry args={[14.4, 18.4]} />
            <meshStandardMaterial map={meadowTexture} color="#ffffff" roughness={0.9} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.meadow.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.meadow.offsetUnits} />
         </mesh>

         {/* Stage 1: Visitor Plaza decorative stone paving */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, -10]} name="visitor-plaza">
            <planeGeometry args={[18.4, 20.4]} />
            <meshStandardMaterial map={plazaTexture} roughness={0.85} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.plaza.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.plaza.offsetUnits} />
         </mesh>

         {/* Stage 2: Parking Lot rich dark asphalt */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, -31]} name="parking-asphalt">
            <planeGeometry args={[20.4, 22.4]} />
            <meshStandardMaterial color={COLORS.asphalt} roughness={0.88} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.asphalt.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.asphalt.offsetUnits} />
         </mesh>

         {/* Pedestrian path network */}
         <Instanced spots={TERRAIN_SPOTS.paths} name="zoo-paths">
            <boxGeometry args={[1, 0.01, 1]} />
            <meshStandardMaterial color={COLORS.path} roughness={0.8} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.paths.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.paths.offsetUnits} />
         </Instanced>

         {/* Concrete curbs separating zones */}
         <Instanced spots={TERRAIN_SPOTS.curbs} name="zoo-curbs">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.curb} roughness={0.85} />
         </Instanced>

         {/* Parking lines */}
         <Instanced spots={TERRAIN_SPOTS.parkingLines} name="parking-lines">
            <boxGeometry args={[1, 0.01, 1]} />
            <meshStandardMaterial color={COLORS.lines} roughness={0.7} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.parkingLines.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.parkingLines.offsetUnits} />
         </Instanced>

         {/* Pedestrian zebra crosswalk */}
         <Instanced spots={TERRAIN_SPOTS.crosswalk} name="crosswalk">
            <boxGeometry args={[1, 0.01, 1]} />
            <meshStandardMaterial color={COLORS.crosswalk} roughness={0.75} polygonOffset polygonOffsetFactor={TERRAIN_LAYERS.crosswalk.offsetFactor} polygonOffsetUnits={TERRAIN_LAYERS.crosswalk.offsetUnits} />
         </Instanced>

         {/* Moat water */}
         <Water
            size={[14, 2]}
            position={[0, 0.02, 4]}
            color={COLORS.water}
            deep={COLORS.deep}
            foam={COLORS.foam}
            amplitude={reduced ? 0 : 0.05}
            wavelength={2.5}
            speed={reduced ? 0 : 0.6}
            foamEdge={0.12}
         />

         {/* Moat limestone boulder banks */}
         <Instanced spots={TERRAIN_SPOTS.banks} name="moat-banks">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.rock} roughness={0.9} />
         </Instanced>

         {/* Wooden bridge crossing the moat */}
         <mesh geometry={bridge} position={[(BRIDGE.x0 + BRIDGE.x1) / 2, 0, (BRIDGE.z0 + BRIDGE.z1) / 2]} name="bridge">
            <meshStandardMaterial vertexColors roughness={0.75} />
         </mesh>
      </group>
   );
}
