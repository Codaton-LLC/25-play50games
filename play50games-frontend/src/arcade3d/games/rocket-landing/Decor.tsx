"use client";

import { useEffect, useMemo } from "react";
import {
   ConeGeometry,
   CylinderGeometry,
   DoubleSide,
   IcosahedronGeometry,
   Matrix4,
   OctahedronGeometry,
   Quaternion,
   RingGeometry,
   SphereGeometry,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, Instanced } from "@/arcade3d/core/render";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS, HABITAT_DOME_LEVELS, HABITAT_DOME_SPOTS } from "./assets";
import { PLANET_DECOR, PLANET_LOOKS } from "./looks";

interface DecorProps {
   planet: number;
   level?: number;
   reducedMotion?: boolean;
}

export function Decor({ planet, level = 1, reducedMotion = false }: DecorProps) {
   const time = useGameTime();
   const look = PLANET_LOOKS[planet] ?? PLANET_LOOKS[0];
   const spots = PLANET_DECOR[planet] ?? PLANET_DECOR[0];

   const geo = useMemo(() => {
      // 1. Mountain peak / crater ridge
      const peak = new ConeGeometry(1.6, 1, 6).translate(0, 0.5, 0);

      // 2. Surface rock
      const rock = new IcosahedronGeometry(0.5, 0).translate(0, 0.35, 0);

      // 3. Planet-specific thematic props
      // Moon: crater mound / monolith
      const moonProp = new IcosahedronGeometry(0.55, 0).translate(0, 0.35, 0);

      // Desert: sandstone spire
      const desertProp = new ConeGeometry(0.4, 1.8, 5).translate(0, 0.9, 0);

      // Ice: ice crystal cluster
      const crystalA = new OctahedronGeometry(0.5, 0).translate(0, 0.5, 0);
      const crystalB = new OctahedronGeometry(0.35, 0).translate(0.25, 0.35, 0.15);
      const iceProp = mergeGeometries([crystalA, crystalB]) ?? crystalA;
      crystalA.dispose();
      crystalB.dispose();

      // Jungle: alien mushroom / spore bulb
      const stem = new CylinderGeometry(0.1, 0.18, 0.9, 5).translate(0, 0.45, 0);
      const cap = new SphereGeometry(0.35, 6, 5).translate(0, 1.0, 0);
      const jungleProp = mergeGeometries([stem, cap]) ?? stem;
      stem.dispose();
      cap.dispose();

      // Lava: basalt hexagonal column
      const lavaProp = new CylinderGeometry(0.32, 0.38, 1.5, 6).translate(0, 0.75, 0);

      // 4. Celestial bodies
      const celestialSphere = new SphereGeometry(1, 16, 12);
      const celestialRing = new RingGeometry(1.3, 2.1, 32);

      // 5. Drifting orbital satellites / asteroids
      const drifter = new IcosahedronGeometry(0.3, 0);

      return {
         peak,
         rock,
         moonProp,
         desertProp,
         iceProp,
         jungleProp,
         lavaProp,
         celestialSphere,
         celestialRing,
         drifter,
      };
   }, []);

   // Clean up all geometries on unmount.
   // Notice: Never attach dispose={null} to primitive object={geo...} attach="geometry".
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const propGeo = useMemo(() => {
      switch (planet) {
         case 0: return geo.moonProp;
         case 1: return geo.desertProp;
         case 2: return geo.iceProp;
         case 3: return geo.jungleProp;
         case 4: return geo.lavaProp;
         default: return geo.moonProp;
      }
   }, [planet, geo]);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
   }), []);

   // 3 drifting micro-satellites / asteroid fragments high in the background sky
   const DRIFTER_COUNT = 3;
   const placeDrifter = (i: number, m: Matrix4) => {
      const t = reducedMotion ? i * 2.1 : time.now * 0.08 + i * 2.1;
      const angle = t + (i * Math.PI * 2) / DRIFTER_COUNT;
      const radius = 18 + i * 2.5;
      scratch.p.set(
         Math.cos(angle) * radius,
         14 + Math.sin(angle * 1.5) * 2.5,
         -22 + (i - 1) * 2.0
      );
      scratch.q.identity();
      const s = 0.5 + i * 0.2;
      scratch.s.set(s, s, s);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   const isEmissive = planet === 2 || planet === 4;

   // Habitat dome outposts only on the cavern / precision-themed levels (levels 4-5)
   const showDomes = (HABITAT_DOME_LEVELS as readonly number[]).includes(level);

   return (
      <group name="rocket-decor">
         {showDomes && HABITAT_DOME_SPOTS.map((spot, i) => (
            <group
               key={i}
               position={[spot.x, spot.y, spot.z]}
               rotation={[0, spot.rotY, 0]}
               scale={spot.scale}
               name={`habitat-dome-${i}`}
            >
               <Model asset={ASSETS.habitatDome} />
            </group>
         ))}
         {/* Distant mountain peaks / crater ridges */}
         <Instanced spots={spots.peaks} name="decor-peaks">
            <primitive object={geo.peak} attach="geometry" />
            <meshStandardMaterial color={look.rockColor} flatShading roughness={1} />
         </Instanced>

         {/* Surface boulders / rocks */}
         <Instanced spots={spots.rocks} name="decor-rocks">
            <primitive object={geo.rock} attach="geometry" />
            <meshStandardMaterial color={look.rockAltColor} flatShading roughness={1} />
         </Instanced>

         {/* Planet-specific thematic props (crystals, alien spires, flora, basalt) */}
         <Instanced spots={spots.props} name="decor-props">
            <primitive object={propGeo} attach="geometry" />
            <meshStandardMaterial
               color={look.propColor}
               emissive={isEmissive ? look.propColor : undefined}
               emissiveIntensity={isEmissive ? 0.35 : 0}
               flatShading
               roughness={planet === 2 ? 0.3 : 0.8}
            />
         </Instanced>

         {/* Dynamic orbiting satellites / asteroid fragments in sky */}
         <DynamicInstanced count={DRIFTER_COUNT} update={placeDrifter} name="decor-drifters">
            <primitive object={geo.drifter} attach="geometry" />
            <meshStandardMaterial color={look.rockAltColor} flatShading roughness={1} />
         </DynamicInstanced>

         {/* Themed celestial planet / moon in distant sky */}
         <group position={[look.moon.x, look.moon.y, look.moon.z]} name="celestial-body">
            <mesh scale={look.moon.radius} geometry={geo.celestialSphere}>
               <meshStandardMaterial color={look.moon.color} roughness={0.9} />
            </mesh>
            {look.moon.hasRing && (
               <mesh
                  geometry={geo.celestialRing}
                  scale={look.moon.radius}
                  rotation={[Math.PI / 3, 0.25, 0]}
               >
                  <meshBasicMaterial
                     color={look.moon.ringColor ?? "#ffffff"}
                     transparent
                     opacity={0.65}
                     side={DoubleSide}
                  />
               </mesh>
            )}
         </group>
      </group>
   );
}
