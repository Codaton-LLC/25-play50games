"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { Water } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, OUTER_BUILDING_SPOTS, OUTER_CLOUDS, OUTER_TREE_SPOTS, RIVER, THEMES, type DecorSpot, type Theme } from "./looks";

function buildingSpotsForTone(spots: readonly DecorSpot[], tone: number): InstanceSpot[] {
   return spots
      .filter((s) => s.tone === tone)
      .map((s) => ({
         x: s.x,
         y: 0,
         z: s.z,
         sx: s.w,
         sy: s.h,
         sz: s.d,
         rotY: s.rotY ?? 0,
      }));
}

function treeSpots(spots: readonly DecorSpot[], tone: number): InstanceSpot[] {
   return spots
      .filter((s) => s.tone === tone)
      .map((s) => ({
         x: s.x,
         y: s.y,
         z: s.z,
         sx: s.w,
         sy: s.h,
         sz: s.d,
      }));
}

/**
 * Surroundings outside the play area:
 * Distant skyline, river with core Water, quayside, avenue trees, and distant drifting clouds.
 * All meshes are placed strictly outside the 60m x 60m play area so they never occlude gameplay.
 */
export function Decor({ reduced, theme = THEMES.training }: { reduced: boolean; theme?: Theme }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // Unit building block with base pivot at y = 0
      const building = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

      // Low-poly tree trunk & crown
      const trunk = new CylinderGeometry(0.12, 0.16, 1, 6).translate(0, 0.5, 0);
      const crown = new ConeGeometry(0.85, 1.8, 6).translate(0, 1.8, 0);

      // Low-poly cloud sphere
      const cloud = new IcosahedronGeometry(1, 0);

      return {
         building,
         trunk,
         crown,
         cloud,
      };
   }, []);

   // Clean up geometries on unmount (never put dispose={null} on primitive attach="geometry")
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Scaled building and tree spots based on quality tier
   const buildingsTone0 = useMemo(() => buildingSpotsForTone(OUTER_BUILDING_SPOTS, 0), []);
   const buildingsTone1 = useMemo(() => buildingSpotsForTone(OUTER_BUILDING_SPOTS, 1), []);
   const buildingsTone2 = useMemo(() => buildingSpotsForTone(OUTER_BUILDING_SPOTS, 2), []);

   const treeTone0 = useMemo(
      () => treeSpots(OUTER_TREE_SPOTS.slice(0, scaledCount(OUTER_TREE_SPOTS.length, quality.decor)), 0),
      [quality.decor]
   );
   const treeTone1 = useMemo(
      () => treeSpots(OUTER_TREE_SPOTS.slice(0, scaledCount(OUTER_TREE_SPOTS.length, quality.decor)), 1),
      [quality.decor]
   );
   const allTrunks = useMemo(() => [...treeTone0, ...treeTone1], [treeTone0, treeTone1]);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
   }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const c = OUTER_CLOUDS[i];
      const drift = reduced ? 0 : Math.sin(time.now * c.speed + i * 1.5) * c.drift;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx, c.sy, c.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="city-surroundings">
         {/* River on the west side outside play area */}
         <Water
            size={[RIVER.width, RIVER.depth]}
            position={[RIVER.x, RIVER.y, RIVER.z]}
            color={theme.windowsGlow ? "#1e3a8a" : COLORS.water}
            deep={theme.windowsGlow ? "#0f172a" : COLORS.waterDeep}
            foam={COLORS.foam}
            amplitude={reduced ? 0 : 0.04}
            wavelength={5}
            speed={reduced ? 0 : 0.45}
            foamEdge={0.06}
         />

         {/* Stone river embankment promenade */}
         <mesh position={[-35.5, 0.15, RIVER.z]} name="river-quayside">
            <boxGeometry args={[1.5, 0.35, RIVER.depth]} />
            <meshStandardMaterial color={COLORS.quayStone} roughness={0.85} />
         </mesh>

         {/* Distant skyline towers - Tone 0 */}
         {buildingsTone0.length > 0 && (
            <Instanced spots={buildingsTone0} name="skyline-tone-0">
               <primitive object={geo.building} attach="geometry" />
               <meshStandardMaterial color={theme.skyline[0]} roughness={0.8} />
            </Instanced>
         )}

         {/* Distant skyline towers - Tone 1 */}
         {buildingsTone1.length > 0 && (
            <Instanced spots={buildingsTone1} name="skyline-tone-1">
               <primitive object={geo.building} attach="geometry" />
               <meshStandardMaterial color={theme.skyline[1]} roughness={0.8} />
            </Instanced>
         )}

         {/* Distant skyline towers - Tone 2 */}
         {buildingsTone2.length > 0 && (
            <Instanced spots={buildingsTone2} name="skyline-tone-2">
               <primitive object={geo.building} attach="geometry" />
               <meshStandardMaterial color={theme.skyline[2]} roughness={0.8} />
            </Instanced>
         )}

         {/* Outer promenade and boulevard tree trunks */}
         {allTrunks.length > 0 && (
            <Instanced spots={allTrunks} name="outer-trees-trunk">
               <primitive object={geo.trunk} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeTrunk} roughness={1} />
            </Instanced>
         )}

         {/* Outer trees foliage A */}
         {treeTone0.length > 0 && (
            <Instanced spots={treeTone0} name="outer-trees-crown-a">
               <primitive object={geo.crown} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeFoliageA} flatShading roughness={0.9} />
            </Instanced>
         )}

         {/* Outer trees foliage B */}
         {treeTone1.length > 0 && (
            <Instanced spots={treeTone1} name="outer-trees-crown-b">
               <primitive object={geo.crown} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeFoliageB} flatShading roughness={0.9} />
            </Instanced>
         )}

         {/* Distant low-poly drifting clouds (far behind / to the sides of play area) */}
         {theme.clouds && (
            <DynamicInstanced count={OUTER_CLOUDS.length} update={placeCloud} name="outer-clouds">
               <primitive object={geo.cloud} attach="geometry" />
               <meshStandardMaterial color={theme.lighting === "sunset" ? "#fed7aa" : COLORS.cloud} flatShading roughness={1} />
            </DynamicInstanced>
         )}
      </group>
   );
}
