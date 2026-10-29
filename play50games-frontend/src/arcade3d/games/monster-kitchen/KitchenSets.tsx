"use client";

// The level's room dressing (sets.ts): one InstancedModel per reused GLB kind and the level's
// code-built extras (the café menu board, the feast bunting, the lanterns' warm light).
import { useMemo } from "react";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useCanvasTexture } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { SETS, SET_ASSETS, type SetKind } from "./sets";

/** The Monster Café's chalk menu on the back wall. */
function MenuBoard() {
   const tex = useCanvasTexture(512, 320, (ctx) => {
      ctx.fillStyle = "#1c1917";
      ctx.fillRect(0, 0, 512, 320);
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, 496, 304);
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 54px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("MONSTER CAFÉ", 256, 78);
      ctx.font = "34px sans-serif";
      ctx.fillStyle = "#f8fafc";
      ["Slime soup ..... 3", "Eyeball pie ..... 4", "Toad tea ..... 2"].forEach((line, i) => ctx.fillText(line, 256, 150 + i * 52));
   });
   return (
      <mesh position={[0.6, 2.35, -3.28]} name="cafe-menu">
         <planeGeometry args={[1.5, 0.94]} />
         <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
   );
}

const BUNTING = ["#f43f5e", "#facc15", "#22c55e", "#38bdf8", "#a855f7"];

/** Bunting across the back wall over the feast: one string of triangle flags. */
function Bunting() {
   const flags = useMemo(() => Array.from({ length: 14 }, (_v, i) => ({ x: -4.2 + i * 0.6, y: 2.75 - 0.18 * Math.sin((i / 13) * Math.PI), color: BUNTING[i % BUNTING.length] })), []);
   return (
      <group name="feast-bunting" position-z={-3.25}>
         {flags.map((f, i) => (
            <mesh key={i} position={[f.x, f.y, 0]} rotation-z={Math.PI}>
               <coneGeometry args={[0.16, 0.32, 3]} />
               <meshStandardMaterial color={f.color} roughness={0.7} />
            </mesh>
         ))}
      </group>
   );
}

export function KitchenSets({ levelId }: { levelId: LevelId }) {
   const set = SETS[levelId];
   const byKind = useMemo(() => {
      const map = new Map<SetKind, Array<{ x: number; y: number; z: number; rotY: number; sx: number; sy: number; sz: number }>>();
      for (const s of set.spots) {
         const list = map.get(s.kind) ?? [];
         list.push({ x: s.x, y: s.y, z: s.z, rotY: s.rotY ?? 0, sx: s.h * (s.wide ?? 1), sy: s.h, sz: s.h });
         map.set(s.kind, list);
      }
      return [...map.entries()];
   }, [set]);
   return (
      <group name={`kitchen-set-${levelId}`}>
         {byKind.map(([kind, spots]) => (
            <InstancedModel key={kind} asset={SET_ASSETS[kind]} spots={spots} fallback={null} />
         ))}
         {set.extras.menu && <MenuBoard />}
         {set.extras.bunting && <Bunting />}
         {set.extras.lanternLight && <pointLight position={[-0.7, 2.4, -2.6]} intensity={6} distance={9} decay={1.6} color="#fbbf24" />}
      </group>
   );
}
