"use client";

// The Pinball Hall round the table (no collision): a carpeted floor, the hall walls with neon tubes in
// the level's colour, rows of arcade cabinets and toy tables along the sides, the stadium stands of the
// crowd at the back, and two lamps over the table. The table itself is TableView.tsx.
import { useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { levelLook } from "./look";

/** The hall floor's height under the table's drain edge (m). */
export const FLOOR_Y = -3.4;

function carpet(a: string, b: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 128;
   const g = c.getContext("2d")!;
   g.fillStyle = a;
   g.fillRect(0, 0, 128, 128);
   g.fillStyle = b;
   for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.arc(20 + ((i * 41) % 110), 18 + ((i * 67) % 100), 9 + (i % 3) * 3, 0, Math.PI * 2);
      g.fill();
   }
   g.strokeStyle = b;
   g.lineWidth = 3;
   g.beginPath();
   g.moveTo(0, 64);
   g.bezierCurveTo(40, 30, 88, 98, 128, 64);
   g.stroke();
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.repeat.set(18, 18);
   t.colorSpace = SRGBColorSpace;
   return t;
}

const CABINETS: InstanceSpot[] = (() => {
   const out: InstanceSpot[] = [];
   const s = fit(GLB_SIZE.cabinet.y, 3.4);
   for (let i = 0; i < 6; i++) {
      out.push({ x: -17, y: FLOOR_Y, z: 4 - i * 5.2, rotY: Math.PI / 2, scale: s });
      out.push({ x: 17, y: FLOOR_Y, z: 4 - i * 5.2, rotY: -Math.PI / 2, scale: s });
   }
   return out;
})();

const TOY_TABLES: InstanceSpot[] = [
   { x: -11.5, y: FLOOR_Y, z: 9, rotY: 0.3, scale: fit(GLB_SIZE.toyTable.z, 4) },
   { x: 11.5, y: FLOOR_Y, z: 9, rotY: -0.3, scale: fit(GLB_SIZE.toyTable.z, 4) },
   { x: -12, y: FLOOR_Y, z: -30, rotY: 0.1, scale: fit(GLB_SIZE.toyTable.z, 4) },
   { x: 12, y: FLOOR_Y, z: -30, rotY: -0.1, scale: fit(GLB_SIZE.toyTable.z, 4) },
];

const STANDS: InstanceSpot[] = [
   { x: -13, y: FLOOR_Y, z: -42, rotY: 0.25, scale: fit(GLB_SIZE.stand.x, 14) },
   { x: 13, y: FLOOR_Y, z: -42, rotY: -0.25, scale: fit(GLB_SIZE.stand.x, 14) },
   { x: -28, y: FLOOR_Y, z: -14, rotY: Math.PI / 2, scale: fit(GLB_SIZE.stand.x, 14) },
   { x: 28, y: FLOOR_Y, z: -14, rotY: -Math.PI / 2, scale: fit(GLB_SIZE.stand.x, 14) },
];

const LEGS: InstanceSpot[] = [
   { x: -6.8, y: FLOOR_Y / 2 - 0.4, z: -1.2 },
   { x: 6.8, y: FLOOR_Y / 2 - 0.4, z: -1.2 },
   { x: -6.8, y: FLOOR_Y / 2 + 1.4, z: -28 },
   { x: 6.8, y: FLOOR_Y / 2 + 1.4, z: -28 },
];

export default function World({ level }: { level: LevelId }) {
   const look = levelLook(level);
   const floor = useMemo(() => carpet(look.hall, look.neon), [look]);
   return (
      <group>
         <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, -12]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial map={floor} roughness={0.95} />
         </mesh>
         {/* the table's legs */}
         <Instanced spots={LEGS}>
            <boxGeometry args={[0.5, 4.2, 0.5]} />
            <meshStandardMaterial color="#2a1f4d" roughness={0.5} metalness={0.3} />
         </Instanced>
         {/* hall walls with neon tubes */}
         <mesh position={[0, FLOOR_Y + 7, -52]}>
            <planeGeometry args={[90, 14]} />
            <meshStandardMaterial color={look.hall} roughness={0.9} />
         </mesh>
         <mesh position={[0, FLOOR_Y + 9, -51.8]}>
            <boxGeometry args={[60, 0.3, 0.2]} />
            <meshBasicMaterial color={look.neon} toneMapped={false} />
         </mesh>
         <mesh position={[0, FLOOR_Y + 10.4, -51.8]}>
            <boxGeometry args={[50, 0.2, 0.2]} />
            <meshBasicMaterial color={look.accent} toneMapped={false} />
         </mesh>
         <InstancedModel asset={ASSETS.cabinet} spots={CABINETS} fallback={<Instanced spots={CABINETS}><boxGeometry args={[1.2, 1.9, 1.4]} /><meshStandardMaterial color="#334155" /></Instanced>} />
         <InstancedModel asset={ASSETS.toyTable} spots={TOY_TABLES} fallback={<Instanced spots={TOY_TABLES}><boxGeometry args={[0.9, 1.2, 1.9]} /><meshStandardMaterial color="#d4a24c" /></Instanced>} />
         <InstancedModel asset={ASSETS.stand} spots={STANDS} fallback={<Instanced spots={STANDS}><boxGeometry args={[1.9, 1.1, 0.9]} /><meshStandardMaterial color="#94a3b8" /></Instanced>} />
         {/* lamps over the table */}
         <pointLight position={[0, 9, -6]} intensity={look.lampIntensity * 40} distance={40} decay={1.6} color={look.lamp} />
         <pointLight position={[0, 11, -22]} intensity={look.lampIntensity * 40} distance={40} decay={1.6} color={look.lamp} />
      </group>
   );
}
