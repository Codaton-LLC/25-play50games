"use client";

// Treasure Island surroundings decor outside the play area:
// Instanced outer palms on distant atolls, rocks with breaking surf rings,
// a dramatic pirate shipwreck silhouette on the horizon, and circling gulls.
// Kept strictly outside the play area, guaranteed never to occlude the play area from any fitted camera.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   RingGeometry,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useQuality, scaledCount } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, OUTER_BIRDS, OUTER_PALMS, OUTER_ROCKS, SHIPWRECK } from "./looks";
import { ASSETS } from "./assets";

export function Decor({ reduced = false }: { reduced?: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   // Geometries created once
   const geo = useMemo(() => {
      // 1. Palm trunk (segmented low-poly)
      const trunkLower = new CylinderGeometry(0.18, 0.28, 1.3, 7).translate(0, 0.65, 0);
      const trunkUpper = new CylinderGeometry(0.12, 0.18, 1.4, 7).translate(0.08, 1.95, 0);
      trunkUpper.rotateZ(-0.06);
      const palmTrunk = mergeGeometries([trunkLower, trunkUpper]);
      trunkLower.dispose();
      trunkUpper.dispose();

      // 2. Palm crown (multi-tiered tropical fronds)
      const frondLow = new ConeGeometry(1.4, 0.6, 7).translate(0.12, 2.5, 0);
      const frondMid = new ConeGeometry(1.15, 0.55, 7).translate(0.15, 2.8, 0);
      const frondHigh = new ConeGeometry(0.85, 0.5, 6).translate(0.16, 3.05, 0);
      const palmCrown = mergeGeometries([frondLow, frondMid, frondHigh]);
      frondLow.dispose();
      frondMid.dispose();
      frondHigh.dispose();

      // 3. Faceted low-poly ocean rock
      const rock = new IcosahedronGeometry(0.7, 0).translate(0, 0.45, 0);

      // 4. Surf foam ring at rock base
      const surfRing = new RingGeometry(0.65, 1.25, 24);
      surfRing.rotateX(-Math.PI / 2);

      // 5. Gull (low-poly seabird)
      const body = new ConeGeometry(0.11, 0.45, 4);
      body.rotateX(-Math.PI / 2);
      const wings = new BoxGeometry(0.75, 0.025, 0.16);
      const bird = mergeGeometries([body, wings]);
      body.dispose();
      wings.dispose();

      // 6. Shipwreck pieces
      const hullLower = new BoxGeometry(2.4, 1.6, 6.5).translate(0, 0.8, 0);
      const hullStern = new BoxGeometry(2.2, 2.2, 2.5).translate(0, 1.8, -2.4);
      const bowsprit = new CylinderGeometry(0.07, 0.12, 3.2, 5).translate(0, 2.4, 3.6);
      bowsprit.rotateX(-0.4);
      const mastMain = new CylinderGeometry(0.1, 0.16, 6.2, 6).translate(0, 3.2, 0.2);
      const yardarm = new CylinderGeometry(0.06, 0.06, 3.6, 5).translate(0, 4.6, 0.2);
      yardarm.rotateZ(Math.PI / 2);
      const mastFore = new CylinderGeometry(0.08, 0.13, 4.8, 5).translate(0, 2.6, 2.2);
      mastFore.rotateX(0.12);
      const wreck = mergeGeometries([hullLower, hullStern, bowsprit, mastMain, yardarm, mastFore]);
      hullLower.dispose();
      hullStern.dispose();
      bowsprit.dispose();
      mastMain.dispose();
      yardarm.dispose();
      mastFore.dispose();

      const wreckSurf = new RingGeometry(1.8, 4.2, 28);
      wreckSurf.rotateX(-Math.PI / 2);

      return {
         palmTrunk: palmTrunk ?? new CylinderGeometry(0.16, 0.26, 2.6, 6),
         palmCrown: palmCrown ?? new ConeGeometry(1.2, 0.8, 6),
         rock,
         surfRing,
         bird: bird ?? new BoxGeometry(0.5, 0.1, 0.3),
         wreck: wreck ?? new BoxGeometry(2.5, 2.0, 7.0),
         wreckSurf,
      };
   }, []);

   // Disposal on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Spots scaled by quality tier
   const rocks = useMemo(() => {
      const count = scaledCount(OUTER_ROCKS.length, quality.decor);
      return OUTER_ROCKS.slice(0, count);
   }, [quality.decor]);

   const rockSpots = useMemo<InstanceSpot[]>(() => {
      return rocks.map((r) => ({
         x: r.x,
         y: r.y,
         z: r.z,
         rotY: r.rotY,
         scale: r.scale,
      }));
   }, [rocks]);

   const surfSpots = useMemo<InstanceSpot[]>(() => {
      return rocks.map((r) => ({
         x: r.x,
         y: 0.02,
         z: r.z,
         rotY: r.rotY,
         scale: r.surfRadius,
      }));
   }, [rocks]);

   const palms = useMemo(() => {
      const count = scaledCount(OUTER_PALMS.length, quality.decor);
      return OUTER_PALMS.slice(0, count);
   }, [quality.decor]);

   const palmSpots = useMemo<InstanceSpot[]>(() => {
      return palms.map((p) => ({
         x: p.x,
         y: p.y,
         z: p.z,
         rotY: p.rotY,
         scale: p.scale,
      }));
   }, [palms]);

   // Scratch objects for bird flock updates (zero per-frame allocations)
   const scratch = useMemo(
      () => ({
         p: new Vector3(),
         q: new Quaternion(),
         s: new Vector3(1, 1, 1),
         axis: new Vector3(0, 1, 0),
         m: new Matrix4(),
      }),
      []
   );

   const placeBird = (i: number, m: Matrix4) => {
      const spin = (reduced ? i * 0.45 : time.now * 0.38) + i * ((Math.PI * 2) / OUTER_BIRDS.count);
      const wave = reduced ? 0 : Math.sin(time.now * 1.5 + i * 1.2) * 0.28;
      scratch.p.set(
         OUTER_BIRDS.centerX + Math.cos(spin) * OUTER_BIRDS.radiusX,
         OUTER_BIRDS.y + wave,
         OUTER_BIRDS.centerZ + Math.sin(spin) * OUTER_BIRDS.radiusZ
      );
      // Bank into the turn
      scratch.q.setFromAxisAngle(scratch.axis, -spin + Math.PI / 2);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="island-decor">
         {/* Outer Rocks & Breaking Surf */}
         {rockSpots.length > 0 && (
            <InstancedModel
               asset={ASSETS.beachRocks}
               spots={rockSpots}
               fallback={
                  <Instanced spots={rockSpots} name="outer-rocks">
                     <primitive object={geo.rock} attach="geometry" />
                     <meshStandardMaterial color={COLORS.rock} roughness={0.9} flatShading />
                  </Instanced>
               }
            />
         )}
         {surfSpots.length > 0 && (
            <Instanced spots={surfSpots} name="outer-surf-rings">
               <primitive object={geo.surfRing} attach="geometry" />
               <meshBasicMaterial color={COLORS.surfFoam} transparent opacity={0.65} depthWrite={false} />
            </Instanced>
         )}

         {/* Outer Palms on Distant Atolls */}
         {palmSpots.length > 0 && (
            <>
               <Instanced spots={palmSpots} name="outer-palm-trunks">
                  <primitive object={geo.palmTrunk} attach="geometry" />
                  <meshStandardMaterial color={COLORS.palmTrunk} roughness={0.9} />
               </Instanced>
               <Instanced spots={palmSpots} name="outer-palm-crowns">
                  <primitive object={geo.palmCrown} attach="geometry" />
                  <meshStandardMaterial color={COLORS.palm} roughness={0.8} flatShading />
               </Instanced>
            </>
         )}

         {/* Pirate Shipwreck Silhouette on the Far Reef */}
         <group
            position={[SHIPWRECK.x, SHIPWRECK.y, SHIPWRECK.z]}
            rotation={[SHIPWRECK.pitch, SHIPWRECK.rotY, SHIPWRECK.roll]}
            scale={SHIPWRECK.scale}
            name="shipwreck"
         >
            <mesh>
               <primitive object={geo.wreck} attach="geometry" />
               <meshStandardMaterial color={COLORS.wreckWood} roughness={0.92} flatShading />
            </mesh>
            <mesh position-y={0.25}>
               <primitive object={geo.wreckSurf} attach="geometry" />
               <meshBasicMaterial color={COLORS.surfFoam} transparent opacity={0.55} depthWrite={false} />
            </mesh>
         </group>

         {/* Circling Seabird Flock over Open Water */}
         <DynamicInstanced count={OUTER_BIRDS.count} update={placeBird} name="outer-gulls">
            <primitive object={geo.bird} attach="geometry" />
            <meshStandardMaterial color={COLORS.gull} roughness={0.75} />
         </DynamicInstanced>
      </group>
   );
}
