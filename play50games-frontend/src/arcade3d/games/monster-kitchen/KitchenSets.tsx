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
      <mesh position={[2.6, 2.05, -3.3]} name="cafe-menu">
         <planeGeometry args={[0.66, 0.42]} />
         <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
   );
}

/** Over the right hatch, on the hatch wall's face (seen on every screen, phones included). */
const SIGN = { x: 0.8, y: 2.68, z: -1.62, w: 1.3, h: 0.36 } as const;

/** The level's sign over the right hatch: café name, the order-ticket rail, or the feast banner. */
function WallSign({ levelId }: { levelId: LevelId }) {
   const tex = useCanvasTexture(512, 144, (ctx) => {
      if (levelId === 3) {
         // the order-ticket rail: a steel bar with paper tickets
         ctx.fillStyle = "#57534e";
         ctx.fillRect(0, 10, 512, 14);
         for (let i = 0; i < 6; i++) {
            ctx.fillStyle = i % 2 ? "#fef9c3" : "#f8fafc";
            ctx.fillRect(14 + i * 82, 20, 66, 112);
            ctx.fillStyle = "#7f1d1d";
            for (let k = 0; k < 4; k++) ctx.fillRect(22 + i * 82, 40 + k * 22, 30 + ((i + k) % 3) * 8, 6);
         }
         return;
      }
      const feast = levelId === 5;
      ctx.fillStyle = feast ? "#7c2d12" : "#1c1917";
      ctx.fillRect(0, 0, 512, 144);
      ctx.strokeStyle = feast ? "#fbbf24" : "#f472b6";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, 500, 132);
      ctx.fillStyle = feast ? "#fde68a" : "#fdf2f8";
      ctx.font = "bold 56px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(feast ? "GRAND FEAST" : "MONSTER CAFÉ", 256, 76);
   });
   return (
      <mesh position={[SIGN.x, SIGN.y, SIGN.z]} name="wall-sign">
         <planeGeometry args={[SIGN.w, SIGN.h]} />
         <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={levelId === 3 ? 0.15 : 0.55} roughness={0.8} />
      </mesh>
   );
}

/** The Dinner Rush's string of warm bulbs across the hatch wall over the lintel. */
function BulbString() {
   // from the shelf's end to the wall's right edge (the jars stand on the shelf to the left)
   const bulbs = useMemo(() => Array.from({ length: 8 }, (_v, i) => ({ x: -1.4 + i * 0.42, y: 2.66 - 0.08 * Math.sin((i / 7) * Math.PI) })), []);
   return (
      <group name="bulb-string" position-z={-1.6}>
         {bulbs.map((b, i) => (
            <mesh key={i} position={[b.x, b.y, 0]}>
               <sphereGeometry args={[0.05, 10, 8]} />
               <meshBasicMaterial color="#fde68a" toneMapped={false} />
            </mesh>
         ))}
      </group>
   );
}

const BUNTING = ["#f43f5e", "#facc15", "#22c55e", "#38bdf8", "#a855f7"];

/** Bunting across the back wall over the feast: one string of triangle flags. */
function Bunting() {
   // two strings over the side strips (the hatch wall hides the middle)
   const flags = useMemo(
      () => [...Array.from({ length: 5 }, (_v, i) => -4.9 + i * 0.4), ...Array.from({ length: 5 }, (_v, i) => 2.1 + i * 0.4)].map((x, i) => ({ x, y: 2.75 - 0.12 * Math.sin(((i % 5) / 4) * Math.PI), color: BUNTING[i % BUNTING.length] })),
      [],
   );
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
         {(levelId === 2 || levelId === 3 || levelId === 5) && <WallSign levelId={levelId} />}
         {levelId === 4 && <BulbString />}
         {set.extras.bunting && <Bunting />}
         {set.extras.lanternLight && <pointLight position={[-0.7, 2.6, -0.4]} intensity={5} distance={9} decay={1.6} color="#fbbf24" />}
      </group>
   );
}
