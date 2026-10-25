"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY,
      rotX: spot.rotX ?? 0,
      rotZ: spot.rotZ ?? 0,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

/**
 * Procedural sci-fi decor strictly outside the play arena:
 * Distant asteroid field, orbital modules, solar wings, satellites and deep nebula clouds.
 */
export function Decor({ reduced }: { reduced: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Faceted low-poly space asteroid
      const asteroid = new IcosahedronGeometry(1, 0);

      // 2. Bevelled distant station module pod (main body + docking collars)
      const podCore = new CylinderGeometry(0.65, 0.65, 1.3, 8);
      const podCapTop = new ConeGeometry(0.65, 0.4, 8).translate(0, 0.85, 0);
      const podCapBottom = new ConeGeometry(0.65, 0.4, 8).rotateX(Math.PI).translate(0, -0.85, 0);
      const distantModule = mergeGeometries([podCore, podCapTop, podCapBottom]);
      podCore.dispose();
      podCapTop.dispose();
      podCapBottom.dispose();
      if (!distantModule) throw new Error("space look: distantModule");

      // 3. Distant solar array wing
      const wing = new BoxGeometry(1.2, 0.06, 2.4);

      // 4. Communication relay satellite (chassis + solar wings + dish antenna)
      const satBox = new BoxGeometry(0.45, 0.5, 0.45);
      const satWingL = new BoxGeometry(0.8, 0.03, 0.35).translate(-0.65, 0, 0);
      const satWingR = new BoxGeometry(0.8, 0.03, 0.35).translate(0.65, 0, 0);
      const satDish = new ConeGeometry(0.28, 0.22, 8).rotateX(-Math.PI / 2).translate(0, 0.32, 0.28);
      const satellite = mergeGeometries([satBox, satWingL, satWingR, satDish]);
      satBox.dispose();
      satWingL.dispose();
      satWingR.dispose();
      satDish.dispose();
      if (!satellite) throw new Error("space look: satellite");

      // 5. Deep space nebula cosmic dust cloud
      const nebula = new IcosahedronGeometry(1, 1);

      return {
         asteroid,
         distantModule,
         wing,
         satellite,
         nebula,
      };
   }, []);

   // Clean up all allocated geometries on unmount.
   // Notice: No dispose={null} on <primitive attach="geometry">, so R3F v8 never overwrites geometry.dispose.
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Filter decor by quality tier
   const asteroidsA = useMemo(() => {
      const list = decorOf("asteroid", 0);
      return asSpots(list.slice(0, scaledCount(list.length, quality.decor)));
   }, [quality.decor]);

   const asteroidsB = useMemo(() => {
      const list = decorOf("asteroid", 1);
      return asSpots(list.slice(0, scaledCount(list.length, quality.decor)));
   }, [quality.decor]);

   const distantModules = useMemo(() => asSpots(decorOf("distantModule")), []);
   const distantWings = useMemo(() => asSpots(decorOf("distantSolarWing")), []);
   const satellites = useMemo(() => asSpots(decorOf("satellite")), []);
   const nebulaClouds = useMemo(() => decorOf("nebula"), []);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
      rotAxis: new Vector3(0.2, 1, 0.1).normalize(),
   }), []);

   const placeNebula = (i: number, m: Matrix4) => {
      const c = nebulaClouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.03 + i * 1.5) * 0.8;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx, c.sy, c.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="space-decor">
         {asteroidsA.length > 0 && (
            <Instanced spots={asteroidsA} name="space-asteroids-a">
               <primitive object={geo.asteroid} attach="geometry" />
               <meshStandardMaterial color={COLORS.asteroidA} flatShading roughness={0.85} metalness={0.2} />
            </Instanced>
         )}
         {asteroidsB.length > 0 && (
            <Instanced spots={asteroidsB} name="space-asteroids-b">
               <primitive object={geo.asteroid} attach="geometry" />
               <meshStandardMaterial color={COLORS.asteroidB} flatShading roughness={0.9} metalness={0.3} />
            </Instanced>
         )}
         {distantModules.length > 0 && (
            <Instanced spots={distantModules} name="space-distant-modules">
               <primitive object={geo.distantModule} attach="geometry" />
               <meshStandardMaterial color={COLORS.hull} roughness={0.4} metalness={0.4} />
            </Instanced>
         )}
         {distantWings.length > 0 && (
            <Instanced spots={distantWings} name="space-distant-wings">
               <primitive object={geo.wing} attach="geometry" />
               <meshStandardMaterial color={COLORS.panel} roughness={0.35} metalness={0.5} emissive={COLORS.panel} emissiveIntensity={0.25} />
            </Instanced>
         )}
         {satellites.length > 0 && (
            <Instanced spots={satellites} name="space-satellites">
               <primitive object={geo.satellite} attach="geometry" />
               <meshStandardMaterial color={COLORS.hullBright} roughness={0.3} metalness={0.6} />
            </Instanced>
         )}
         <DynamicInstanced count={nebulaClouds.length} update={placeNebula} name="space-nebula-clouds">
            <primitive object={geo.nebula} attach="geometry" />
            <meshBasicMaterial color={COLORS.nebulaGlow} transparent opacity={0.14} depthWrite={false} />
         </DynamicInstanced>
      </group>
   );
}
