"use client";
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Matrix4 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { useQuality } from "@/arcade3d/core/quality";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { active, ROOMS, WALLS, type Run } from "./rules";

const chairs = ROOMS.map((r) => ({ x: r.x, y: 0, z: r.north * 5.5 }));
function FurnitureFallback() {
   return <DynamicInstanced count={4} update={(i, m) => { const p = chairs[i]; m.makeTranslation(p.x, 0.3, p.z); }}>
      <boxGeometry args={[0.6, 0.6, 0.6]} /><meshStandardMaterial color="#a78bfa" />
   </DynamicInstanced>;
}
export default function Mansion({ run }: { run: Run }) {
   const quality = useQuality(), time = useGameTime(), icons = useRef<Array<Group | null>>([]);
   const [reduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
   const hidden = (i: number) => run.ghosts.some((g) => g.room === i && g.mode === "hidden");
   useFrame(() => {
      for (let i = 0; i < 4; i++) {
         const icon = icons.current[i]; if (!icon) continue;
         icon.visible = hidden(i);
         icon.rotation.y = reduced || quality.tier === "low" ? 0 : time.now * 1.5;
         icon.scale.setScalar(reduced || quality.tier === "low" ? 1 : 1 + Math.sin(time.now * 5) * 0.2);
      }
   });
   const faded = (i: number) => {
      if (!(i % 2)) return false;
      const b = WALLS[Math.floor(i / 2)];
      const occludes = (x: number, z: number) => x >= b.min.x - 0.5 && x <= b.max.x + 0.5 && b.max.z >= z && b.min.z < z + 3;
      return occludes(run.hunter.x, run.hunter.z) || run.ghosts.some((g) => active(g) && g.mode !== "hidden" && occludes(g.x, g.z));
   };
   const wall = (i: number, m: Matrix4, fade: boolean) => {
      if (faded(i) !== fade) return false;
      const b = WALLS[Math.floor(i / 2)], x = (b.min.x + b.max.x) / 2;
      const lo = i % 2 ? Math.max(b.min.z, run.hunter.z) : b.min.z;
      const hi = i % 2 ? b.max.z : Math.min(b.max.z, run.hunter.z);
      if (hi <= lo) return false;
      const h = i % 2 ? 0.35 : 2.4;
      m.makeScale(b.max.x - b.min.x, h, hi - lo).setPosition(x, h / 2, (lo + hi) / 2);
   };
   return <group name="mansion">
      <ambientLight intensity={0.65} color="#c7d2fe" />
      <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[28, 20]} /><meshStandardMaterial color="#ad825d" roughness={0.95} /></mesh>
      <DynamicInstanced count={WALLS.length * 2} update={(i, m) => wall(i, m, false)}>
         <boxGeometry /><meshStandardMaterial color="#9683b0" roughness={0.85} />
      </DynamicInstanced>
      <DynamicInstanced count={WALLS.length * 2} update={(i, m) => wall(i, m, true)}>
         <boxGeometry /><meshStandardMaterial color="#9683b0" roughness={0.85} transparent opacity={0.15} depthWrite={false} />
      </DynamicInstanced>
      <DynamicInstancedModel asset={ASSETS.desk} count={4} update={(i, m) => {
         const r = ROOMS[i], shake = hidden(i) && !reduced && quality.tier !== "low" ? Math.sin(time.now * 18 + i) * 0.025 : 0;
         m.makeTranslation(r.x + shake, 0, r.z);
      }} />
      <InstancedModel asset={ASSETS.chair} spots={chairs} fallback={<FurnitureFallback />} />
      {[0, 1, 2, 3].map((i) => <Model key={i} asset={ASSETS.book} position={[-10 + (i - 1.5) * 0.3, 0.52, -7]} rotation={[Math.PI / 2, 0, 0]} fallback={<mesh><boxGeometry args={[0.2, 0.05, 0.25]} /><meshStandardMaterial color="#b45369" /></mesh>} />)}
      {ROOMS.map((r, i) => <group key={i}>
         <Model asset={ASSETS.door} position={[r.doorX + r.side * 0.3, 0, r.doorZ - r.north * 1.8]} rotation={[0, Math.PI / 2, 0]} fallback={<mesh position={[0, 1.1, 0]}><boxGeometry args={[0.12, 2.2, 1.3]} /><meshStandardMaterial color="#765038" /></mesh>} />
         <group position={[r.x, 1.6, r.z]} ref={(node) => { icons.current[i] = node; }}>
            <mesh><octahedronGeometry args={[0.15]} /><meshBasicMaterial color="#fde047" depthWrite={false} /></mesh>
         </group>
      </group>)}
      <DynamicInstanced count={4} update={(i, m) => { const r = ROOMS[i]; m.makeScale(0.34, 0.04, 0.04).setPosition(r.x, 0.6, r.z + 0.3); }}>
         <boxGeometry /><meshStandardMaterial color="#d6ae63" />
      </DynamicInstanced>
      <DynamicInstanced count={12} update={(i, m) => {
         const r = ROOMS[Math.floor(i / 3)];
         m.makeScale(0.04, 0.45, 0.04).setPosition(r.x + (i % 3 - 1) * 0.13, 0.7 + (i % 3 === 1 ? 0.1 : 0), r.z + 0.3);
      }}><cylinderGeometry args={[1, 1, 1, 6]} /><meshStandardMaterial color="#d6ae63" /></DynamicInstanced>
      <DynamicInstanced count={12} update={(i, m) => {
         const r = ROOMS[Math.floor(i / 3)];
         m.makeScale(0.045, 0.08, 0.045).setPosition(r.x + (i % 3 - 1) * 0.13, 0.96 + (i % 3 === 1 ? 0.1 : 0), r.z + 0.3);
      }}><sphereGeometry args={[1, 6, 4]} /><meshBasicMaterial color="#fde68a" /></DynamicInstanced>
      <mesh position={[0, 1.5, -9.75]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.2, 0.2, 0.08, 20]} /><meshStandardMaterial color="#d6ae63" /></mesh>
      <mesh position={[0, 1.53, -9.69]}><boxGeometry args={[0.025, 0.15, 0.025]} /><meshBasicMaterial color="#302348" /></mesh>
      <mesh position={[-13.75, 1.5, -7]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.8, 0.6, 0.08]} /><meshStandardMaterial color="#d6ae63" /></mesh>
      <mesh position={[-13.69, 1.5, -7]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.66, 0.46]} /><meshStandardMaterial color="#798baa" /></mesh>
   </group>;
}
