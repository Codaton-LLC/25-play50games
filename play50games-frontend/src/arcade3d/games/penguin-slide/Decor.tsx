"use client";

import { useEffect, useMemo } from "react";
import {
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   SphereGeometry,
   Vector3,
} from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { CLOUD_DRIFT, COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

/**
 * Instanced arctic decor surrounding the play area:
 * Faceted ice spires, soft snow drifts, snow-capped arctic rocks,
 * distant glacier cliffs, horizon mountain peaks, and drifting arctic clouds.
 * All positioned strictly outside the active play bounds.
 */
export function Decor({ reduced }: { reduced: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Ice spire: faceted crystalline obelisk
      const spire = new CylinderGeometry(0.12, 0.75, 3.2, 5).translate(0, 1.6, 0);

      // 2. Snow drift: low-poly soft mound
      const drift = new SphereGeometry(1, 8, 6).scale(1.4, 0.45, 1).translate(0, 0.45, 0);

      // 3. Rock: low-poly slate boulder + snow cap
      const rock = new DodecahedronGeometry(0.55, 0).translate(0, 0.35, 0);
      const rockSnow = new SphereGeometry(0.38, 7, 5).scale(1.1, 0.45, 1.1).translate(0, 0.68, 0);

      // 4. Distant glacier: towering crystalline ice ridge
      const glacier = new CylinderGeometry(0.55, 1.25, 1.5, 5).translate(0, 0.75, 0);

      // 5. Mountain: dark rock peak + snow top
      const mountain = new ConeGeometry(1.2, 2.2, 4).translate(0, 1.1, 0);
      const mountainSnow = new ConeGeometry(0.65, 1.1, 4).translate(0, 1.65, 0);

      // 6. Cloud: low-poly puffy cloud
      const cloud = new IcosahedronGeometry(1, 0).scale(1.8, 0.7, 1.2);

      return {
         spire,
         drift,
         rock,
         rockSnow,
         glacier,
         mountain,
         mountainSnow,
         cloud,
      };
   }, []);

   // Clean disposal on unmount.
   // Never put dispose={null} on <primitive attach="geometry"> (R3F v8 bug).
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const spires = useMemo(
      () => asSpots(decorOf("spire").slice(0, scaledCount(decorOf("spire").length, quality.decor))),
      [quality.decor]
   );
   const drifts = useMemo(
      () => asSpots(decorOf("drift").slice(0, scaledCount(decorOf("drift").length, quality.decor))),
      [quality.decor]
   );
   const rocks = useMemo(
      () => asSpots(decorOf("rock").slice(0, scaledCount(decorOf("rock").length, quality.decor))),
      [quality.decor]
   );
   const glaciers = useMemo(
      () => asSpots(decorOf("glacier").slice(0, scaledCount(decorOf("glacier").length, quality.decor))),
      [quality.decor]
   );
   const mountains = useMemo(
      () => asSpots(decorOf("mountain").slice(0, scaledCount(decorOf("mountain").length, quality.decor))),
      [quality.decor]
   );
   const clouds = useMemo(() => decorOf("cloud"), []);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
   }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const c = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.5) * CLOUD_DRIFT;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx, c.sy, c.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="arctic-decor">
         {/* Ice spires flanking track */}
         {spires.length > 0 && (
            <Instanced spots={spires} name="ice-spires">
               <primitive object={geo.spire} attach="geometry" />
               <meshStandardMaterial color={COLORS.spireBody} flatShading roughness={0.24} metalness={0.08} />
            </Instanced>
         )}

         {/* Snow drifts outside play bounds */}
         {drifts.length > 0 && (
            <Instanced spots={drifts} name="snow-drifts">
               <primitive object={geo.drift} attach="geometry" />
               <meshStandardMaterial color={COLORS.snowSoft} flatShading roughness={0.9} />
            </Instanced>
         )}

         {/* Arctic rocks: slate base + snow cap */}
         {rocks.length > 0 && (
            <>
               <Instanced spots={rocks} name="arctic-rocks-base">
                  <primitive object={geo.rock} attach="geometry" />
                  <meshStandardMaterial color={COLORS.rockFace} flatShading roughness={0.85} />
               </Instanced>
               <Instanced spots={rocks} name="arctic-rocks-snow">
                  <primitive object={geo.rockSnow} attach="geometry" />
                  <meshStandardMaterial color={COLORS.rockSnow} flatShading roughness={0.92} />
               </Instanced>
            </>
         )}

         {/* Distant glacier ridges */}
         {glaciers.length > 0 && (
            <Instanced spots={glaciers} name="distant-glaciers">
               <primitive object={geo.glacier} attach="geometry" />
               <meshStandardMaterial color={COLORS.glacierIce} flatShading roughness={0.32} metalness={0.06} />
            </Instanced>
         )}

         {/* Horizon mountains: rock face + snow peak */}
         {mountains.length > 0 && (
            <>
               <Instanced spots={mountains} name="horizon-mountains-rock">
                  <primitive object={geo.mountain} attach="geometry" />
                  <meshStandardMaterial color={COLORS.mountainRock} flatShading roughness={0.95} />
               </Instanced>
               <Instanced spots={mountains} name="horizon-mountains-snow">
                  <primitive object={geo.mountainSnow} attach="geometry" />
                  <meshStandardMaterial color={COLORS.mountainPeak} flatShading roughness={0.9} />
               </Instanced>
            </>
         )}

         {/* Drifting high arctic clouds */}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="arctic-clouds">
            <primitive object={geo.cloud} attach="geometry" />
            <meshStandardMaterial color={COLORS.cloud} flatShading roughness={0.95} />
         </DynamicInstanced>
      </group>
   );
}
