"use client";

import type { LevelId } from "@/arcade3d/types";
import { Model } from "@/arcade3d/core/assets";
import { RoundedBox } from "@react-three/drei";
import { ASSETS } from "./assets";
import { GatePrimitive, TowerPrimitive } from "./Primitives";
import { sceneryFor } from "./scenery";

/** Small fixed set pieces, never in the aiming field. No extra shadow-casting lights. */
export function LevelScenery({ id }: { id: LevelId }) {
   const scene = sceneryFor(id);
   return <group name={`castle-level-${id}-scenery`}>
      {scene.props.map((p, i) => <group key={i} position={[p.x, 0, p.z]} scale={p.scale}>
         {p.kind === "tower" && <Model asset={ASSETS.tower} fallback={<TowerPrimitive />} />}
         {p.kind === "gate" && <>
            <Model asset={ASSETS.gate} fallback={<GatePrimitive />} />
            <RoundedBox args={[2.2, 0.35, 0.7]} radius={0.08} position={[0, 3.1, 0]}><meshStandardMaterial color={scene.stone} /></RoundedBox>
         </>}
         {p.kind === "barricade" && <>
            <RoundedBox args={[0.7, 0.65, 1.4]} radius={0.09} position={[0, 0.325, 0]}><meshStandardMaterial color={scene.stone} roughness={0.95} /></RoundedBox>
            {[-0.45, 0, 0.45].map((z) => <RoundedBox key={z} args={[0.8, 0.25, 0.23]} radius={0.04} position={[0, 0.76, z]}><meshStandardMaterial color={scene.stone} /></RoundedBox>)}
         </>}
         {p.kind === "standard" && <>
            <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.035, 0.05, 2.3, 6]} /><meshStandardMaterial color="#cda85c" metalness={0.3} roughness={0.6} /></mesh>
            <RoundedBox args={[0.65, 1, 0.06]} radius={0.025} position={[0, 1.65, 0]}><meshStandardMaterial color={scene.accent} /></RoundedBox>
            <mesh position={[0, 1.65, 0.04]}><boxGeometry args={[0.09, 0.9, 0.025]} /><meshStandardMaterial color="#e8b84a" /></mesh>
         </>}
         {p.kind === "brazier" && <>
            <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.17, 0.28, 0.8, 8]} /><meshStandardMaterial color={scene.stone} /></mesh>
            <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.42, 0.2, 0.25, 8]} /><meshStandardMaterial color="#413b44" metalness={0.4} roughness={0.7} /></mesh>
            <mesh position={[0, 1.15, 0]}><icosahedronGeometry args={[0.28, 1]} /><meshStandardMaterial color="#ffe0a2" emissive="#ff9c39" emissiveIntensity={2} /></mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}><circleGeometry args={[0.48, 16]} /><meshBasicMaterial color="#ffad55" transparent opacity={0.3} depthWrite={false} /></mesh>
         </>}
      </group>)}
   </group>;
}
