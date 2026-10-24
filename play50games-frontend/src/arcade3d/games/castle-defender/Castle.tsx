"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { SkyDome } from "@/arcade3d/core/env";
import { Pedestal } from "@/arcade3d/core/kit";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";
import { CannonPrimitive, GatePrimitive } from "./Primitives";
import type { CastleRun } from "./rules";

const TOWERS = [{ x: -6.5, y: 0, z: 3 }, { x: 6.5, y: 0, z: 3 }];
const TREES = [{ x: -8, y: 0, z: -5 }, { x: 8, y: 0, z: -5 }, { x: -8, y: 0, z: -1 }, { x: 8, y: 0, z: -1 }];
const BATTLEMENTS = Array.from({ length: 13 }, (_, i) => ({ x: i - 6, y: 1.4, z: 3.1 }));
const TOWER_BASES = TOWERS.map((p) => ({ ...p, y: 2.4 }));
const TOWER_ROOFS = TOWERS.map((p) => ({ ...p, y: 5.4 }));

function TowerFallback() {
   return <group>
      <Instanced spots={TOWER_BASES}><cylinderGeometry args={[1.25, 1.4, 4.8, 10]} /><meshStandardMaterial color="#a8a29e" /></Instanced>
      <Instanced spots={TOWER_ROOFS}><coneGeometry args={[1.5, 1.2, 10]} /><meshStandardMaterial color="#3b82f6" /></Instanced>
   </group>;
}
function TreeFallback({ spots }: { spots: readonly InstanceSpot[] }) {
   const trunk = useMemo(() => spots.map((p) => ({ ...p, y: 0.9 })), [spots]);
   const crown = useMemo(() => spots.map((p) => ({ ...p, y: 2.35 })), [spots]);
   return <group>
      <Instanced spots={trunk}><cylinderGeometry args={[0.16, 0.22, 1.8, 7]} /><meshStandardMaterial color="#92400e" /></Instanced>
      <Instanced spots={crown}><icosahedronGeometry args={[1.15, 1]} /><meshStandardMaterial color="#4d7c0f" /></Instanced>
   </group>;
}

export function Castle({ run, reduced }: { run: CastleRun; reduced: boolean }) {
   const gate = useRef<Group>(null), banners = useRef<Group>(null), time = useGameTime();
   const endedAt = useRef(-1);
   const quality = useQuality();
   const trees = useMemo(() => TREES.slice(0, scaledCount(4, quality.decor)), [quality.decor]);
   useFrame(() => {
      if (run.end && endedAt.current < 0) endedAt.current = time.now;
      if (gate.current) gate.current.rotation.x = run.end === "lose" ? Math.min(1.2, (time.now - endedAt.current) * 0.8) : 0;
      if (banners.current) {
         // a win raises the wall banners and makes them wave (reduced motion: raised, still)
         const won = run.end === "win" ? Math.min(1, (time.now - endedAt.current) / 0.4) : 0;
         for (const flag of banners.current.children) flag.scale.setScalar(1 + 0.8 * won);
         banners.current.rotation.z = reduced && won ? 0 : Math.sin(time.now * (1.4 + 6 * won)) * (0.035 + 0.08 * won);
      }
   });
   return <group>
      <SkyDome top="#93c5fd" bottom="#dbeafe" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -1.5]}><planeGeometry args={[30, 28]} /><meshStandardMaterial color="#65a30d" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -2.5]}><planeGeometry args={[1.6, 10]} /><meshStandardMaterial color="#b6a47a" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-6.4, 0.016, -3]}><planeGeometry args={[0.6, 13]} /><meshStandardMaterial color="#38bdf8" /></mesh>
      <mesh position={[0, 0.6, 3.1]}><boxGeometry args={[12, 1.2, 1.2]} /><meshStandardMaterial color="#a8a29e" roughness={0.9} /></mesh>
      <Instanced spots={BATTLEMENTS}><boxGeometry args={[0.6, 0.4, 0.8]} /><meshStandardMaterial color="#a8a29e" /></Instanced>
      <InstancedModel asset={ASSETS.tower} spots={TOWERS} fallback={<TowerFallback />} />
      <InstancedModel asset={ASSETS.tree} spots={trees} fallback={<TreeFallback spots={trees} />} />
      <group ref={gate} position={[0, 0, 2.51]}><Model asset={ASSETS.gate} fallback={<GatePrimitive />} /></group>
      <Pedestal position={[0, 0, 3]} width={1.7} height={1.2} color="#78716c" trim="#94a3b8" />
      <Model asset={ASSETS.cannon} position={[0, 1.2, 3]} fallback={<CannonPrimitive />} />
      <group ref={banners} position={[0, 2, 3]}>
         <mesh position={[-4.4, 0.4, 0]}><boxGeometry args={[0.6, 0.9, 0.05]} /><meshStandardMaterial color="#3b82f6" /></mesh>
         <mesh position={[4.4, 0.4, 0]}><boxGeometry args={[0.6, 0.9, 0.05]} /><meshStandardMaterial color="#3b82f6" /></mesh>
      </group>
   </group>;
}
