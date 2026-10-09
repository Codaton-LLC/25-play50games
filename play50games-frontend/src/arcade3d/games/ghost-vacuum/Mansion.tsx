"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { ROOMS, WALLS, type Run } from "./rules";

const desks = ROOMS.map((r) => ({ x: r.x, y: 0, z: r.z }));
const chairs = ROOMS.map((r) => ({ x: r.x, y: 0, z: r.north * 5.5 }));
function FurnitureFallback({ chair = false }: { chair?: boolean }) {
   return <DynamicInstanced count={4} update={(i, m) => { const p = chair ? chairs[i] : desks[i]; m.makeTranslation(p.x, chair ? 0.3 : 0.65, p.z); }}>
      <boxGeometry args={chair ? [0.6, 0.6, 0.6] : [1.6, 0.8, 0.8]} /><meshStandardMaterial color={chair ? "#a78bfa" : "#92400e"} />
   </DynamicInstanced>;
}
export default function Mansion({ run }: { run: Run }) {
   const icons = useRef<Array<Group | null>>([]);
   useFrame(() => {
      for (let i = 0; i < 4; i++) {
         let hidden = false;
         for (const g of run.ghosts) if (g.room === i && g.mode === "hidden") hidden = true;
         if (icons.current[i]) icons.current[i]!.visible = hidden;
      }
   });
   return <group name="mansion">
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[28, 20]} /><meshStandardMaterial color="#78350f" roughness={0.95} /></mesh>
      <DynamicInstanced count={WALLS.length * 2} update={(i, m) => {
         const b = WALLS[Math.floor(i / 2)], x = (b.min.x + b.max.x) / 2;
         const lo = i % 2 ? Math.max(b.min.z, run.hunter.z) : b.min.z;
         const hi = i % 2 ? b.max.z : Math.min(b.max.z, run.hunter.z);
         if (hi <= lo) return false;
         const h = i % 2 ? 0.35 : 2.4;
         m.makeScale(b.max.x - b.min.x, h, hi - lo).setPosition(x, h / 2, (lo + hi) / 2);
      }}><boxGeometry /><meshStandardMaterial color="#4c1d95" roughness={0.85} /></DynamicInstanced>
      <InstancedModel asset={ASSETS.desk} spots={desks} fallback={<FurnitureFallback />} />
      <InstancedModel asset={ASSETS.chair} spots={chairs} fallback={<FurnitureFallback chair />} />
      {ROOMS.map((r, i) => <group key={i} position={[r.x, 1.6, r.z]} ref={(node) => { icons.current[i] = node; }}>
         <mesh><octahedronGeometry args={[0.15]} /><meshBasicMaterial color="#fde047" depthWrite={false} /></mesh>
      </group>)}
   </group>;
}
