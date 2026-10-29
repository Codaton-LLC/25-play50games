"use client";

// Alien Farm surroundings: strange rock spires, glowing alien plants, an alien silo,
// rocks and crates outside the play area. Instanced and quality-scaled.
import { useEffect, useMemo } from "react";
import {
   CylinderGeometry,
   ConeGeometry,
   SphereGeometry,
   TorusGeometry,
   Matrix4,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel } from "@/arcade3d/core/assets";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, METEORITE_SCALE, METEORITE_SPOTS } from "./assets";
import { COLORS, LOOKS, decorOf, hillHeight, type DecorSpot, type FarmLook } from "./looks";
import { CratePrimitives, RockPrimitives } from "./Primitives";

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

export function Decor({ look = LOOKS.starter }: { look?: FarmLook }) {
   const quality = useQuality();

   const geo = useMemo(() => {
      // 1. Spire: tapering hexagonal column with faceted crystal tip
      const shaft = new CylinderGeometry(0.2, 0.52, 2.8, 6).translate(0, 1.4, 0);
      const cap = new ConeGeometry(0.32, 0.9, 6).translate(0, 3.15, 0);
      const spire = mergeGeometries([shaft, cap]);
      shaft.dispose();
      cap.dispose();
      if (!spire) throw new Error("alien-farm look: spire");

      // 2. Alien plant: curved stalk + bulbous glowing cap
      const stalk = new CylinderGeometry(0.045, 0.09, 0.75, 6).translate(0, 0.375, 0);
      const plantCap = new SphereGeometry(0.28, 8, 6).scale(1, 0.65, 1).translate(0, 0.78, 0);

      // 3. Silo: cylindrical body, dome roof, hopper ring and conduit pipe
      const body = new CylinderGeometry(1.2, 1.25, 3.8, 12).translate(0, 1.9, 0);
      const roof = new SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 3.8, 0);
      const ring = new TorusGeometry(1.32, 0.06, 6, 16)
         .applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2))
         .translate(0, 2.2, 0);
      const siloBody = mergeGeometries([body, roof, ring]);
      body.dispose();
      roof.dispose();
      ring.dispose();
      if (!siloBody) throw new Error("alien-farm look: siloBody");

      const conduit = new CylinderGeometry(0.09, 0.09, 3.6, 6).translate(1.28, 1.8, 0);

      return {
         spire,
         stalk,
         plantCap,
         siloBody,
         conduit,
      };
   }, []);

   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const spires = useMemo(() => {
      const list = decorOf("spire");
      return asSpots(list.slice(0, scaledCount(list.length, quality.decor)));
   }, [quality.decor]);

   const plants = useMemo(() => {
      const list = decorOf("plant");
      return asSpots(list.slice(0, scaledCount(list.length, quality.decor)));
   }, [quality.decor]);

   const silos = useMemo(() => asSpots(decorOf("silo")), []);
   const rocks = useMemo(() => asSpots(decorOf("rock")), []);
   const meteorites = useMemo<InstanceSpot[]>(() => METEORITE_SPOTS.map((s) => ({ x: s.x, y: hillHeight(s.x, s.z) - 0.05, z: s.z, rotY: s.rotY })), []);
   const crates = useMemo(() => asSpots(decorOf("crate")), []);

   return (
      <group name="alien-decor">
         {/* Strange rock spires */}
         {spires.length > 0 && (
            <Instanced spots={spires} name="rock-spires">
               <primitive object={geo.spire} attach="geometry" />
               <meshStandardMaterial color={look.spire} roughness={0.8} flatShading />
            </Instanced>
         )}

         {/* Glowing alien plants */}
         {plants.length > 0 && (
            <group name="alien-plants">
               <Instanced spots={plants} name="plant-stalks">
                  <primitive object={geo.stalk} attach="geometry" />
                  <meshStandardMaterial color={COLORS.plantStalk} roughness={0.7} />
               </Instanced>
               <Instanced spots={plants} name="plant-caps">
                  <primitive object={geo.plantCap} attach="geometry" />
                  <meshStandardMaterial
                     color={look.plantCap}
                     roughness={0.4}
                     emissive={look.plantGlow}
                     emissiveIntensity={0.55}
                  />
               </Instanced>
            </group>
         )}

         {/* Silo outside the play area */}
         {silos.length > 0 && (
            <group name="alien-silo">
               <Instanced spots={silos} name="silo-structure">
                  <primitive object={geo.siloBody} attach="geometry" />
                  <meshStandardMaterial color={COLORS.siloBody} roughness={0.45} metalness={0.3} />
               </Instanced>
               <Instanced spots={silos} name="silo-conduit">
                  <primitive object={geo.conduit} attach="geometry" />
                  <meshStandardMaterial
                     color={COLORS.siloGlow}
                     emissive={COLORS.siloGlow}
                     emissiveIntensity={0.7}
                     roughness={0.3}
                  />
               </Instanced>
            </group>
         )}

         {/* Rocks & crates outside the play area */}
         <InstancedModel asset={ASSETS.rock} spots={rocks} fallback={<RockPrimitives spots={rocks} />} />
         <InstancedModel
            asset={ASSETS.meteorite}
            spots={meteorites}
            fallback={
               <Instanced spots={meteorites.map((m) => ({ ...m, y: m.y + 0.4, sx: 0.6, sy: 0.45, sz: 1.2 }))} name="meteorite-fallback">
                  <icosahedronGeometry args={[1, 0]} />
                  <meshStandardMaterial color="#3f3f46" roughness={0.9} flatShading />
               </Instanced>
            }
         />
         <InstancedModel asset={ASSETS.crate} spots={crates} fallback={<CratePrimitives spots={crates} />} />
      </group>
   );
}
