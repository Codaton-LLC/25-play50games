"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CircleGeometry,
   CylinderGeometry,
   DoubleSide,
   IcosahedronGeometry,
   SphereGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, TRUNK_DRAWN, TRUNK_SPOTS } from "./assets";
import { COLORS, decorOf, type DecorSpot } from "./looks";
import { useGhostLevel } from "./useGhostLevel";

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
 * Surroundings strictly OUTSIDE the mansion play area:
 * garden hedges, gravestones, bare trees, distant hills, and the moon.
 * The south band towards the camera is filled with visible lawn, path and low decor.
 */
export default function Decor() {
   const quality = useQuality();
   const { id } = useGhostLevel();
   // The attic trunk is the Attic (4) and Whole Mansion (5) grounds decor; other levels keep the old look.
   const atticTrunks = id === 4 || id === 5;

   const trunkFallbackSpots = useMemo<InstanceSpot[]>(
      () =>
         TRUNK_SPOTS.map((s) => ({
            // The unit fallback box is centred; lift it so it sits on the ground like the GLB (base at y = 0).
            x: s.x,
            y: s.y + TRUNK_DRAWN.height / 2,
            z: s.z,
            rotY: s.rotY,
            sx: TRUNK_DRAWN.width,
            sy: TRUNK_DRAWN.height,
            sz: TRUNK_DRAWN.depth,
         })),
      []
   );

   const geo = useMemo(() => {
      // 1. Spooky bare tree with twisted trunk and crooked branches
      const trunk = new CylinderGeometry(0.18, 0.34, 3.2, 6).translate(0, 1.6, 0);
      const b1 = new CylinderGeometry(0.08, 0.16, 1.8, 5).rotateZ(0.55).translate(0.5, 2.5, 0.15);
      const b2 = new CylinderGeometry(0.07, 0.14, 1.6, 5).rotateZ(-0.6).translate(-0.45, 2.7, -0.15);
      const b3 = new CylinderGeometry(0.05, 0.1, 1.2, 4).rotateX(0.5).translate(0.1, 3.1, 0.35);
      const tree = mergeGeometries([trunk, b1, b2, b3]);
      trunk.dispose();
      b1.dispose();
      b2.dispose();
      b3.dispose();

      // 2. Gothic arched gravestone with plinth
      const slab = new BoxGeometry(0.65, 0.65, 0.18).translate(0, 0.38, 0);
      const arch = new CylinderGeometry(0.325, 0.325, 0.18, 10).rotateZ(Math.PI / 2).translate(0, 0.7, 0);
      const base = new BoxGeometry(0.82, 0.1, 0.3).translate(0, 0.05, 0);
      const gravestone = mergeGeometries([slab, arch, base]);
      slab.dispose();
      arch.dispose();
      base.dispose();

      // 3. Rounded top garden hedge block
      const hedgeBody = new BoxGeometry(0.85, 0.58, 2.2).translate(0, 0.29, 0);
      const hedgeCap = new CylinderGeometry(0.425, 0.425, 2.2, 8).rotateX(Math.PI / 2).translate(0, 0.58, 0);
      const hedge = mergeGeometries([hedgeBody, hedgeCap]);
      hedgeBody.dispose();
      hedgeCap.dispose();

      // 4. Distant rolling hill dome
      const hill = new IcosahedronGeometry(1, 1).scale(1, 0.6, 1);

      // 5. Low-poly moon + halo
      const moon = new SphereGeometry(1, 14, 10);
      const halo = new CircleGeometry(1.65, 20);

      return {
         tree: tree!,
         gravestone: gravestone!,
         hedge: hedge!,
         hill,
         moon,
         halo,
      };
   }, []);

   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Scaled instance counts for performance tiers
   const hedges0 = useMemo(() => asSpots(decorOf("hedge", 0).slice(0, scaledCount(decorOf("hedge", 0).length, quality.decor))), [quality.decor]);
   const hedges1 = useMemo(() => asSpots(decorOf("hedge", 1).slice(0, scaledCount(decorOf("hedge", 1).length, quality.decor))), [quality.decor]);
   const gravestones0 = useMemo(() => asSpots(decorOf("gravestone", 0).slice(0, scaledCount(decorOf("gravestone", 0).length, quality.decor))), [quality.decor]);
   const gravestones1 = useMemo(() => asSpots(decorOf("gravestone", 1).slice(0, scaledCount(decorOf("gravestone", 1).length, quality.decor))), [quality.decor]);
   const trees0 = useMemo(() => asSpots(decorOf("tree", 0).slice(0, scaledCount(decorOf("tree", 0).length, quality.decor))), [quality.decor]);
   const trees1 = useMemo(() => asSpots(decorOf("tree", 1).slice(0, scaledCount(decorOf("tree", 1).length, quality.decor))), [quality.decor]);
   const hills0 = useMemo(() => asSpots(decorOf("hill", 0).slice(0, scaledCount(decorOf("hill", 0).length, quality.decor))), [quality.decor]);
   const hills1 = useMemo(() => asSpots(decorOf("hill", 1).slice(0, scaledCount(decorOf("hill", 1).length, quality.decor))), [quality.decor]);
   const moonSpot = useMemo(() => decorOf("moon")[0], []);

   return (
      <group name="ghost-decor">
         {/* Exterior estate grounds (lawn, front terrace border and approach path outside the mansion) */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} name="estate-lawn">
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial color={COLORS.lawn} roughness={0.95} />
         </mesh>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.013, 10.6]} name="estate-terrace">
            <planeGeometry args={[28.4, 1.2]} />
            <meshStandardMaterial color={COLORS.pathBorder} roughness={0.9} />
         </mesh>
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.011, 17]} name="estate-path">
            <planeGeometry args={[5, 14]} />
            <meshStandardMaterial color={COLORS.path} roughness={0.88} />
         </mesh>

         {/* Garden Hedges */}
         {hedges0.length > 0 && (
            <Instanced spots={hedges0} name="garden-hedges-a">
               <primitive object={geo.hedge} attach="geometry" />
               <meshStandardMaterial color={COLORS.hedge} roughness={0.9} flatShading />
            </Instanced>
         )}
         {hedges1.length > 0 && (
            <Instanced spots={hedges1} name="garden-hedges-b">
               <primitive object={geo.hedge} attach="geometry" />
               <meshStandardMaterial color={COLORS.hedgeTop} roughness={0.9} flatShading />
            </Instanced>
         )}

         {/* Spooky Gravestones */}
         {gravestones0.length > 0 && (
            <Instanced spots={gravestones0} name="gravestones-a">
               <primitive object={geo.gravestone} attach="geometry" />
               <meshStandardMaterial color={COLORS.gravestone} roughness={0.85} flatShading />
            </Instanced>
         )}
         {gravestones1.length > 0 && (
            <Instanced spots={gravestones1} name="gravestones-b">
               <primitive object={geo.gravestone} attach="geometry" />
               <meshStandardMaterial color={COLORS.gravestoneDark} roughness={0.85} flatShading />
            </Instanced>
         )}

         {/* Bare Spooky Trees */}
         {trees0.length > 0 && (
            <Instanced spots={trees0} name="bare-trees-a">
               <primitive object={geo.tree} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeTrunk} roughness={1} flatShading />
            </Instanced>
         )}
         {trees1.length > 0 && (
            <Instanced spots={trees1} name="bare-trees-b">
               <primitive object={geo.tree} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeBranch} roughness={1} flatShading />
            </Instanced>
         )}

         {/* Distant Hills */}
         {hills0.length > 0 && (
            <Instanced spots={hills0} name="distant-hills-a">
               <primitive object={geo.hill} attach="geometry" />
               <meshStandardMaterial color={COLORS.hillFar} roughness={1} flatShading />
            </Instanced>
         )}
         {hills1.length > 0 && (
            <Instanced spots={hills1} name="distant-hills-b">
               <primitive object={geo.hill} attach="geometry" />
               <meshStandardMaterial color={COLORS.hillNear} roughness={1} flatShading />
            </Instanced>
         )}

         {/* Attic trunks on the grounds, levels 4-5 only (Attic / Whole Mansion) */}
         {atticTrunks && (
            <InstancedModel
               asset={ASSETS.trunk}
               spots={TRUNK_SPOTS}
               fallback={
                  <Instanced spots={trunkFallbackSpots} name="attic-trunks">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.woodDesk} roughness={0.85} />
                  </Instanced>
               }
            />
         )}

         {/* The Moon */}
         {moonSpot && (
            <group position={[moonSpot.x, moonSpot.y, moonSpot.z]} name="spooky-moon">
               <mesh scale={[moonSpot.sx, moonSpot.sy, moonSpot.sz]}>
                  <primitive object={geo.moon} attach="geometry" />
                  <meshBasicMaterial color={COLORS.moon} />
               </mesh>
               <mesh scale={[moonSpot.sx, moonSpot.sy, moonSpot.sz]} rotation={[0.45, 0, 0]}>
                  <primitive object={geo.halo} attach="geometry" />
                  <meshBasicMaterial
                     color={COLORS.moonHalo}
                     transparent
                     opacity={0.28}
                     side={DoubleSide}
                     depthWrite={false}
                  />
               </mesh>
            </group>
         )}
      </group>
   );
}
