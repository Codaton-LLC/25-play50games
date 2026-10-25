"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CylinderGeometry,
   Matrix4,
   Quaternion,
   SphereGeometry,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   COLORS,
   DYNAMIC_FLAGS,
   decorOf,
   type DecorSpot,
} from "./looks";

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
 * Modern tournament stadium decor outside the play area:
 * - Instanced digital LED advertising boards (no text)
 * - Instanced multi-tier concrete stands
 * - Instanced multi-tone crowd spectators
 * - Dynamic waving supporter flags
 * - Instanced 4 corner floodlight towers
 */
export function Decor() {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Advertising boards: bevelled base enclosure + LED screen
      const boardBox = new BoxGeometry(1, 1, 1);
      const boardScreen = new BoxGeometry(1, 0.7, 0.05).translate(0, 0, 0.06);

      // 2. Concrete stadium stand tier block
      const standTier = new BoxGeometry(1, 1, 1);

      // 3. Low-poly spectator (torso + head)
      const torso = new CylinderGeometry(0.18, 0.22, 0.45, 6).translate(0, 0.225, 0);
      const head = new SphereGeometry(0.14, 6, 5).translate(0, 0.54, 0);
      const fan = mergeGeometries([torso, head]);
      torso.dispose();
      head.dispose();
      if (!fan) throw new Error("penalty look: fan geometry");

      // 4. Floodlight tower mast and lamp fixtures
      const mastLower = new CylinderGeometry(0.28, 0.48, 17, 8).translate(0, 8.5, 0);
      const mastArm = new BoxGeometry(3.6, 0.25, 0.5).translate(0, 16.6, 0.2);
      const towerMast = mergeGeometries([mastLower, mastArm]);
      mastLower.dispose();
      mastArm.dispose();
      if (!towerMast) throw new Error("penalty look: tower mast geometry");

      const towerHead = new BoxGeometry(3.8, 1.8, 0.35);
      const towerLamps = new BoxGeometry(3.5, 1.5, 0.08).translate(0, 0, 0.16);

      // 5. Dynamic flag
      const flagPole = new CylinderGeometry(0.025, 0.03, 1.5, 5).translate(0, 0.75, 0);
      const flagCloth = new BoxGeometry(0.7, 0.45, 0.02).translate(0.35, 1.2, 0);
      const flag = mergeGeometries([flagPole, flagCloth]);
      flagPole.dispose();
      flagCloth.dispose();
      if (!flag) throw new Error("penalty look: flag geometry");

      return {
         boardBox,
         boardScreen,
         standTier,
         fan,
         towerMast,
         towerHead,
         towerLamps,
         flag,
      };
   }, []);

   // Clean disposal of geometries on unmount
   // IMPORTANT: never put dispose={null} on primitive attach="geometry"
   useEffect(() => () => {
      for (const g of Object.values(geo)) g.dispose();
   }, [geo]);

   // Boards
   const boardsBlue = useMemo(() => asSpots(decorOf("board", 0)), []);
   const boardsAmber = useMemo(() => asSpots(decorOf("board", 1)), []);

   // Stands
   const stands = useMemo(() => asSpots(decorOf("stand")), []);

   // Crowd divided into 5 jersey tones, scaled by quality tier
   const crowd0 = useMemo(() => asSpots(decorOf("crowd", 0).slice(0, scaledCount(decorOf("crowd", 0).length, quality.decor))), [quality.decor]);
   const crowd1 = useMemo(() => asSpots(decorOf("crowd", 1).slice(0, scaledCount(decorOf("crowd", 1).length, quality.decor))), [quality.decor]);
   const crowd2 = useMemo(() => asSpots(decorOf("crowd", 2).slice(0, scaledCount(decorOf("crowd", 2).length, quality.decor))), [quality.decor]);
   const crowd3 = useMemo(() => asSpots(decorOf("crowd", 3).slice(0, scaledCount(decorOf("crowd", 3).length, quality.decor))), [quality.decor]);
   const crowd4 = useMemo(() => asSpots(decorOf("crowd", 4).slice(0, scaledCount(decorOf("crowd", 4).length, quality.decor))), [quality.decor]);

   // Floodlight towers
   const floodlights = useMemo(() => asSpots(decorOf("floodlight")), []);

   // Dynamic flag animation scratch
   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(1, 1, 1),
      euler: new Vector3(),
   }), []);

   const placeFlag = (i: number, m: Matrix4) => {
      const f = DYNAMIC_FLAGS[i];
      const wave = Math.sin(time.now * f.speed + f.phase) * 0.18;
      scratch.p.set(f.x, f.y, f.z);
      scratch.q.setFromAxisAngle(new Vector3(0, 1, 0), wave);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="penalty-decor">
         {/* 1. Advertising boards: modern digital LED perimeter */}
         {boardsBlue.length > 0 && (
            <Instanced spots={boardsBlue} name="boards-blue-body">
               <primitive object={geo.boardBox} attach="geometry" />
               <meshStandardMaterial color={COLORS.boardBody} roughness={0.8} />
            </Instanced>
         )}
         {boardsBlue.length > 0 && (
            <Instanced spots={boardsBlue} name="boards-blue-screen">
               <primitive object={geo.boardScreen} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.boardTrimBlue}
                  emissive={COLORS.boardGlowBlue}
                  emissiveIntensity={0.4}
                  roughness={0.4}
               />
            </Instanced>
         )}
         {boardsAmber.length > 0 && (
            <Instanced spots={boardsAmber} name="boards-amber-body">
               <primitive object={geo.boardBox} attach="geometry" />
               <meshStandardMaterial color={COLORS.boardBody} roughness={0.8} />
            </Instanced>
         )}
         {boardsAmber.length > 0 && (
            <Instanced spots={boardsAmber} name="boards-amber-screen">
               <primitive object={geo.boardScreen} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.boardTrimAmber}
                  emissive={COLORS.boardGlowAmber}
                  emissiveIntensity={0.35}
                  roughness={0.4}
               />
            </Instanced>
         )}

         {/* 2. Stadium stands: tiered concrete bleachers */}
         {stands.length > 0 && (
            <Instanced spots={stands} name="stadium-stands">
               <primitive object={geo.standTier} attach="geometry" />
               <meshStandardMaterial color={COLORS.standConcrete} roughness={0.9} />
            </Instanced>
         )}

         {/* 3. Packed crowd spectators across 5 team tones */}
         {crowd0.length > 0 && (
            <Instanced spots={crowd0} name="crowd-blue">
               <primitive object={geo.fan} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdBlue} roughness={0.7} />
            </Instanced>
         )}
         {crowd1.length > 0 && (
            <Instanced spots={crowd1} name="crowd-green">
               <primitive object={geo.fan} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdGreen} roughness={0.7} />
            </Instanced>
         )}
         {crowd2.length > 0 && (
            <Instanced spots={crowd2} name="crowd-yellow">
               <primitive object={geo.fan} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdYellow} roughness={0.7} />
            </Instanced>
         )}
         {crowd3.length > 0 && (
            <Instanced spots={crowd3} name="crowd-orange">
               <primitive object={geo.fan} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdOrange} roughness={0.7} />
            </Instanced>
         )}
         {crowd4.length > 0 && (
            <Instanced spots={crowd4} name="crowd-white">
               <primitive object={geo.fan} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdWhite} roughness={0.6} />
            </Instanced>
         )}

         {/* 4. Dynamic cheering flags along the front stand */}
         <DynamicInstanced count={DYNAMIC_FLAGS.length} update={placeFlag} name="cheering-flags">
            <primitive object={geo.flag} attach="geometry" />
            <meshStandardMaterial color={COLORS.crowdYellow} roughness={0.6} />
         </DynamicInstanced>

         {/* 5. 4 Corner floodlight towers */}
         {floodlights.length > 0 && (
            <Instanced spots={floodlights} name="floodlight-masts">
               <primitive object={geo.towerMast} attach="geometry" />
               <meshStandardMaterial color={COLORS.floodlightMast} roughness={0.6} metalness={0.2} />
            </Instanced>
         )}
         {floodlights.length > 0 && (
            <Instanced spots={floodlights} name="floodlight-heads">
               <primitive object={geo.towerHead} attach="geometry" />
               <meshStandardMaterial color={COLORS.floodlightHead} roughness={0.8} />
            </Instanced>
         )}
         {floodlights.length > 0 && (
            <Instanced spots={floodlights} name="floodlight-lamps">
               <primitive object={geo.towerLamps} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.floodlightLamp}
                  emissive={COLORS.floodlightGlow}
                  emissiveIntensity={1.2}
                  roughness={0.2}
               />
            </Instanced>
         )}
      </group>
   );
}
