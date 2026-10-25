"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   SphereGeometry,
   TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { COLORS, SLIME_CAKE_SPOTS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      rotY: s.rotY,
      sx: s.sx,
      sy: s.sy,
      sz: s.sz,
   }));
}

/**
 * Instanced kitchen surroundings strictly outside the play area:
 * wooden crates, hanging copper pans, copper cooking pots, potion jars,
 * cellar barrels, monster pumpkins, and braided garlic. On levels 4 and 5
 * (Dinner Rush / Grand Feast) the slime-cake GLB joins the floor decor.
 */
export function Decor({ levelId }: { levelId: LevelId }) {
   const quality = useQuality();
   const feast = levelId === 4 || levelId === 5;

   const geo = useMemo(() => {
      // --- Crate: body + top/bottom edge slats ---
      const crateBody = new BoxGeometry(0.48, 0.44, 0.48);
      const rimTop = new BoxGeometry(0.51, 0.05, 0.51).translate(0, 0.19, 0);
      const rimBottom = new BoxGeometry(0.51, 0.05, 0.51).translate(0, -0.19, 0);
      const crate = mergeGeometries([crateBody, rimTop, rimBottom]);
      crateBody.dispose();
      rimTop.dispose();
      rimBottom.dispose();
      if (!crate) throw new Error("kitchen look: crate");

      // --- Hanging copper pan: vertical bowl + hanging handle ---
      const panBowl = new CylinderGeometry(0.18, 0.16, 0.07, 14);
      panBowl.rotateX(Math.PI / 2);
      const panHandle = new CylinderGeometry(0.015, 0.015, 0.26, 6).translate(0, 0.21, 0);
      const panHole = new TorusGeometry(0.02, 0.007, 6, 8).translate(0, 0.33, 0);
      const pan = mergeGeometries([panBowl, panHandle, panHole]);
      panBowl.dispose();
      panHandle.dispose();
      panHole.dispose();
      if (!pan) throw new Error("kitchen look: pan");

      // --- Copper pot with lid and knob ---
      const potBody = new CylinderGeometry(0.18, 0.17, 0.24, 14).translate(0, 0.12, 0);
      const potLid = new ConeGeometry(0.19, 0.07, 14).translate(0, 0.27, 0);
      const potKnob = new SphereGeometry(0.028, 8, 8).translate(0, 0.32, 0);
      const pot = mergeGeometries([potBody, potLid, potKnob]);
      potBody.dispose();
      potLid.dispose();
      potKnob.dispose();
      if (!pot) throw new Error("kitchen look: pot");

      // --- Glass potion jar with neck and cork ---
      const jarBody = new CylinderGeometry(0.075, 0.08, 0.18, 10).translate(0, 0.09, 0);
      const jarNeck = new CylinderGeometry(0.04, 0.04, 0.05, 10).translate(0, 0.2, 0);
      const jarCork = new CylinderGeometry(0.042, 0.038, 0.04, 8).translate(0, 0.24, 0);
      const jar = mergeGeometries([jarBody, jarNeck, jarCork]);
      jarBody.dispose();
      jarNeck.dispose();
      jarCork.dispose();
      if (!jar) throw new Error("kitchen look: jar");

      // --- Cellar barrel with bulged staves ---
      const barrelBody = new CylinderGeometry(0.26, 0.22, 0.58, 12).translate(0, 0.29, 0);
      const barrelHoopTop = new TorusGeometry(0.245, 0.018, 6, 12)
         .rotateX(Math.PI / 2)
         .translate(0, 0.44, 0);
      const barrelHoopBottom = new TorusGeometry(0.245, 0.018, 6, 12)
         .rotateX(Math.PI / 2)
         .translate(0, 0.14, 0);
      const barrel = mergeGeometries([barrelBody, barrelHoopTop, barrelHoopBottom]);
      barrelBody.dispose();
      barrelHoopTop.dispose();
      barrelHoopBottom.dispose();
      if (!barrel) throw new Error("kitchen look: barrel");

      // --- Pumpkin: squashed ribbed sphere + curved stem ---
      const pumpkinBody = new SphereGeometry(0.22, 12, 10);
      pumpkinBody.scale(1.2, 0.85, 1.2);
      pumpkinBody.translate(0, 0.18, 0);
      const pumpkinStem = new CylinderGeometry(0.025, 0.035, 0.09, 6)
         .rotateZ(0.25)
         .translate(0, 0.38, 0);
      const pumpkin = mergeGeometries([pumpkinBody, pumpkinStem]);
      pumpkinBody.dispose();
      pumpkinStem.dispose();
      if (!pumpkin) throw new Error("kitchen look: pumpkin");

      // --- Braided hanging garlic cluster ---
      const g1 = new SphereGeometry(0.065, 8, 8).translate(0, -0.06, 0);
      const g2 = new SphereGeometry(0.058, 8, 8).translate(0.04, -0.16, 0.02);
      const g3 = new SphereGeometry(0.058, 8, 8).translate(-0.04, -0.16, -0.02);
      const g4 = new SphereGeometry(0.052, 8, 8).translate(0, -0.25, 0);
      const gStem = new CylinderGeometry(0.018, 0.026, 0.16, 6).translate(0, 0.04, 0);
      const garlic = mergeGeometries([g1, g2, g3, g4, gStem]);
      g1.dispose();
      g2.dispose();
      g3.dispose();
      g4.dispose();
      gStem.dispose();
      if (!garlic) throw new Error("kitchen look: garlic");

      return { crate, pan, pot, jar, barrel, pumpkin, garlic };
   }, []);

   // Clean up all merged geometries on unmount.
   // Notice: no primitive below carries dispose={null}, which would overwrite geometry.dispose.
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const crateSpots = useMemo(
      () => asSpots(decorOf("crate").slice(0, scaledCount(decorOf("crate").length, quality.decor))),
      [quality.decor],
   );
   const panSpots = useMemo(
      () => asSpots(decorOf("pan").slice(0, scaledCount(decorOf("pan").length, quality.decor))),
      [quality.decor],
   );
   const potSpots = useMemo(
      () => asSpots(decorOf("pot").slice(0, scaledCount(decorOf("pot").length, quality.decor))),
      [quality.decor],
   );
   const jarSpots = useMemo(
      () => asSpots(decorOf("jar").slice(0, scaledCount(decorOf("jar").length, quality.decor))),
      [quality.decor],
   );
   const barrelSpots = useMemo(
      () => asSpots(decorOf("barrel").slice(0, scaledCount(decorOf("barrel").length, quality.decor))),
      [quality.decor],
   );
   const pumpkinSpots = useMemo(
      () => asSpots(decorOf("pumpkin").slice(0, scaledCount(decorOf("pumpkin").length, quality.decor))),
      [quality.decor],
   );
   const garlicSpots = useMemo(
      () => asSpots(decorOf("garlic").slice(0, scaledCount(decorOf("garlic").length, quality.decor))),
      [quality.decor],
   );

   return (
      <group name="kitchen-surroundings-decor">
         {crateSpots.length > 0 && (
            <Instanced spots={crateSpots} name="decor-crates">
               <primitive object={geo.crate} attach="geometry" />
               <meshStandardMaterial color={COLORS.crateWood} roughness={0.7} />
            </Instanced>
         )}
         {barrelSpots.length > 0 && (
            <Instanced spots={barrelSpots} name="decor-barrels">
               <primitive object={geo.barrel} attach="geometry" />
               <meshStandardMaterial color={COLORS.barrelWood} roughness={0.75} />
            </Instanced>
         )}
         {panSpots.length > 0 && (
            <Instanced spots={panSpots} name="decor-pans">
               <primitive object={geo.pan} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.copper}
                  metalness={0.82}
                  roughness={0.28}
               />
            </Instanced>
         )}
         {potSpots.length > 0 && (
            <Instanced spots={potSpots} name="decor-pots">
               <primitive object={geo.pot} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.copperHighlight}
                  metalness={0.78}
                  roughness={0.32}
               />
            </Instanced>
         )}
         {jarSpots.length > 0 && (
            <Instanced spots={jarSpots} name="decor-jars">
               <primitive object={geo.jar} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.jarGlass}
                  roughness={0.2}
                  transparent
                  opacity={0.88}
               />
            </Instanced>
         )}
         {pumpkinSpots.length > 0 && (
            <Instanced spots={pumpkinSpots} name="decor-pumpkins">
               <primitive object={geo.pumpkin} attach="geometry" />
               <meshStandardMaterial color={COLORS.pumpkin} roughness={0.65} />
            </Instanced>
         )}
         {garlicSpots.length > 0 && (
            <Instanced spots={garlicSpots} name="decor-garlic">
               <primitive object={geo.garlic} attach="geometry" />
               <meshStandardMaterial color={COLORS.garlic} roughness={0.6} />
            </Instanced>
         )}
         {feast &&
            SLIME_CAKE_SPOTS.map((s, i) => (
               <Model
                  key={i}
                  asset={ASSETS.slimeCake}
                  position={[s.x, 0, s.z]}
                  rotation-y={s.rotY}
                  name={`decor-slime-cake-${i}`}
               />
            ))}
      </group>
   );
}
