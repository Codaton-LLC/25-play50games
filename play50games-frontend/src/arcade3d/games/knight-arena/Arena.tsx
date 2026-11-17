"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import { InstancedModel } from "../../core/assets";
import { SkyDome } from "../../core/env";
import { Fence } from "../../core/kit/Fence";
import { useLevel } from "../../core/level";
import { createPath } from "../../core/path";
import type { InstanceSpot } from "../../core/render";
import { ASSETS } from "./assets";
import { Decor } from "./Decor";
import { LEVEL_LOOKS } from "./looks";
import { TowerPrimitive, TreePrimitive } from "./Primitives";
import type { KnightLevel } from "./levels";
import { ARENA, COLORS, TARGETS } from "./rules";

const RING_VERTICES: ReadonlyArray<readonly [number, number]> = Array.from({ length: ARENA.SIDES }, (_, i) => {
   const angle = (i / ARENA.SIDES) * Math.PI * 2 + Math.PI / 8;
   return [
      Math.cos(angle) * ARENA.RADIUS_M,
      Math.sin(angle) * ARENA.RADIUS_M,
   ] as const;
});

const RING_PATH = createPath(
   RING_VERTICES.map(([x, z]) => ({ x, y: 0, z })),
   { closed: true },
);

const toSpots = (points: readonly (readonly [number, number])[]): readonly InstanceSpot[] =>
   points.map(([x, z]) => ({ x, y: 0, z, rotY: Math.atan2(-x, -z) }));

const scratchMatrix = new Matrix4();
const scratchPos = new Vector3();
const scratchQuat = new Quaternion();
const scratchScale = new Vector3(1, 1, 1);
const UP = new Vector3(0, 1, 0);

function ArenaBanners({ cloth }: { cloth: string }): React.ReactElement {
   const clothRef = useRef<InstancedMesh>(null);
   const goldRef = useRef<InstancedMesh>(null);

   useLayoutEffect(() => {
      const clothMesh = clothRef.current;
      const gold = goldRef.current;
      if (!clothMesh || !gold) return;

      for (let i = 0; i < RING_VERTICES.length; i++) {
         const [vx, vz] = RING_VERTICES[i];
         const yaw = Math.atan2(-vx, -vz);
         scratchQuat.setFromAxisAngle(UP, yaw);

         // Banner cloth hanging on the post facing inward
         scratchPos.set(vx * 0.985, ARENA.FENCE_HEIGHT_M * 0.58, vz * 0.985);
         scratchScale.set(0.32, 0.52, 0.04);
         scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
         clothMesh.setMatrixAt(i, scratchMatrix);

         // Gold finial cap on top of each fence post
         scratchPos.set(vx, ARENA.FENCE_HEIGHT_M + 0.08, vz);
         scratchScale.set(0.11, 0.14, 0.11);
         scratchMatrix.compose(scratchPos, scratchQuat, scratchScale);
         gold.setMatrixAt(i, scratchMatrix);
      }
      clothMesh.instanceMatrix.needsUpdate = true;
      gold.instanceMatrix.needsUpdate = true;
   }, []);

   return (
      <group>
         <instancedMesh ref={clothRef} args={[undefined, undefined, RING_VERTICES.length]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={cloth} roughness={0.65} />
         </instancedMesh>
         <instancedMesh ref={goldRef} args={[undefined, undefined, RING_VERTICES.length]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color={COLORS.gold} roughness={0.35} metalness={0.55} />
         </instancedMesh>
      </group>
   );
}

export function Arena(): React.ReactElement {
   const { id } = useLevel<KnightLevel>();
   const look = LEVEL_LOOKS[id];
   const towerSpots = useMemo(() => toSpots(look.towers), [look]);
   const treeSpots = useMemo(
      () =>
         look.trees.map(([x, z], i) => ({
            x,
            y: 0,
            z,
            rotY: (i * 1.37) % (Math.PI * 2),
            scale: i % 2 === 0 ? 1.0 : 0.92,
         })),
      [look],
   );

   return (
      <group>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} radius={42} />

         {/* Outer meadow ground */}
         <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[32, 32]} />
            <meshStandardMaterial color={look.grass} roughness={0.95} />
         </mesh>

         {/* Octagonal stone curb */}
         <mesh position={[0, -0.015, 0]} rotation={[0, Math.PI / 8, 0]} receiveShadow>
            <cylinderGeometry args={[ARENA.RADIUS_M + 0.18, ARENA.RADIUS_M + 0.24, 0.03, ARENA.SIDES]} />
            <meshStandardMaterial color={look.curb} roughness={0.85} />
         </mesh>

         {/* Compacted sand arena floor */}
         <mesh position={[0, -0.005, 0]} rotation={[0, Math.PI / 8, 0]} receiveShadow>
            <cylinderGeometry args={[ARENA.RADIUS_M, ARENA.RADIUS_M, 0.01, ARENA.SIDES]} />
            <meshStandardMaterial color={look.floor} roughness={0.9} />
         </mesh>

         {/* Subtle inner ring markers at Near (1.60 m) and Far (2.60 m) radii */}
         <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[TARGETS.NEAR_RADIUS_M - 0.03, TARGETS.NEAR_RADIUS_M + 0.03, 48]} />
            <meshBasicMaterial color={COLORS.arenaRing} transparent opacity={0.35} />
         </mesh>
         <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[TARGETS.FAR_RADIUS_M - 0.03, TARGETS.FAR_RADIUS_M + 0.03, 64]} />
            <meshBasicMaterial color={COLORS.arenaRing} transparent opacity={0.28} />
         </mesh>

         {/* Octagonal timber & stone perimeter fence + level-coloured banners */}
         <Fence
            path={RING_PATH}
            height={ARENA.FENCE_HEIGHT_M}
            color={COLORS.stoneDark}
            railColor={COLORS.wood}
         />
         <ArenaBanners cloth={look.banner} />

         {/* Level scenery outside the fence (set pieces, torch flames) */}
         <Decor look={look} />

         {/* Background Castle Towers */}
         <InstancedModel
            asset={ASSETS.castleTower}
            spots={towerSpots}
            fallback={
               <group>
                  {towerSpots.map((s, i) => (
                     <group key={i} position={[s.x, s.y, s.z]} rotation={[0, s.rotY ?? 0, 0]}>
                        <TowerPrimitive />
                     </group>
                  ))}
               </group>
            }
         />

         {/* Background Leafy Trees */}
         <InstancedModel
            asset={ASSETS.leafyTree}
            spots={treeSpots}
            fallback={
               <group>
                  {treeSpots.map((s, i) => (
                     <group key={i} position={[s.x, s.y, s.z]} rotation={[0, s.rotY ?? 0, 0]} scale={s.scale ?? 1}>
                        <TreePrimitive />
                     </group>
                  ))}
               </group>
            }
         />
      </group>
   );
}
