"use client";

// Robot Collector surroundings decor: instanced lab walls, diagnostic screens,
// overhead conduit pipes, idle service droids, stacked cargo crates and charging stations.
// Everything is strictly OUTSIDE the play area and never occludes playfield elements.
// R3F v8: geometries and materials are disposed on unmount, never dispose={null} on primitives.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CapsuleGeometry,
   CylinderGeometry,
   MeshBasicMaterial,
   MeshStandardMaterial,
   SphereGeometry,
} from "three";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   CABLE_DUCT_SPOTS,
   CHARGING_STATION_SPOTS,
   COLORS,
   CONDUIT_PIPE_SPOTS,
   DECOR_CRATE_SPOTS,
   IDLE_ROBOT_SPOTS,
   LAB_WALL_SPOTS,
   WALL_SCREEN_SPOTS,
   type DecorSpot,
} from "./looks";

function toInstanceSpots(spots: readonly DecorSpot[], defaultSize: [number, number, number]): InstanceSpot[] {
   return spots.map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      rotY: s.rotY,
      sx: s.sx ?? defaultSize[0],
      sy: s.sy ?? defaultSize[1],
      sz: s.sz ?? defaultSize[2],
   }));
}

export function Decor() {
   // Geometries created once, disposed on unmount
   const geo = useMemo(() => {
      return {
         wallPanel: new BoxGeometry(1, 1, 1),
         screen: new BoxGeometry(1, 1, 1),
         pipe: new CylinderGeometry(1, 1, 1, 16),
         idleBody: new CapsuleGeometry(0.32, 0.28, 4, 12),
         idleHead: new SphereGeometry(0.24, 16, 12),
         station: new BoxGeometry(1, 1, 1),
         stationPylon: new CylinderGeometry(0.08, 0.08, 1, 8),
         crate: new BoxGeometry(1, 1, 1),
         cableDuct: new BoxGeometry(1, 1, 1),
      };
   }, []);

   // Materials created once, disposed on unmount
   const mats = useMemo(() => {
      return {
         wall: new MeshStandardMaterial({
            color: COLORS.decorWall,
            roughness: 0.85,
            metalness: 0.2,
         }),
         screenCyan: new MeshStandardMaterial({
            color: COLORS.screenCyan,
            emissive: COLORS.screenCyan,
            emissiveIntensity: 1.6,
            roughness: 0.2,
         }),
         pipe: new MeshStandardMaterial({
            color: COLORS.pipe,
            roughness: 0.45,
            metalness: 0.55,
         }),
         idleRobot: new MeshStandardMaterial({
            color: COLORS.robotChassis,
            roughness: 0.5,
            metalness: 0.3,
         }),
         idleHead: new MeshStandardMaterial({
            color: COLORS.robotHead,
            roughness: 0.4,
         }),
         station: new MeshStandardMaterial({
            color: COLORS.chargingBase,
            roughness: 0.7,
            metalness: 0.3,
         }),
         stationGlow: new MeshBasicMaterial({
            color: COLORS.chargingAccent,
         }),
         crate: new MeshStandardMaterial({
            color: COLORS.crate,
            roughness: 0.8,
            metalness: 0.15,
         }),
         duct: new MeshStandardMaterial({
            color: COLORS.duct,
            roughness: 0.75,
            metalness: 0.35,
         }),
      };
   }, []);

   // Disposal cleanup: never put dispose={null} on primitives!
   useEffect(() => {
      return () => {
         for (const g of Object.values(geo)) g.dispose();
         for (const m of Object.values(mats)) m.dispose();
      };
   }, [geo, mats]);

   // Prepared instance spot arrays
   const wallSpots = useMemo(() => toInstanceSpots(LAB_WALL_SPOTS, [3.8, 4.4, 0.8]), []);
   const screenSpots = useMemo(() => toInstanceSpots(WALL_SCREEN_SPOTS, [1.8, 1.1, 0.15]), []);
   const pipeSpots = useMemo(() => toInstanceSpots(CONDUIT_PIPE_SPOTS, [0.22, 7.6, 0.22]), []);
   const crateSpots = useMemo(() => toInstanceSpots(DECOR_CRATE_SPOTS, [1.2, 1.2, 1.2]), []);
   const stationSpots = useMemo(() => toInstanceSpots(CHARGING_STATION_SPOTS, [0.6, 1.4, 0.9]), []);
   const ductSpots = useMemo(() => toInstanceSpots(CABLE_DUCT_SPOTS, [1, 0.06, 1]), []);

   // Idle robot multi-mesh spots
   const idleBodies = useMemo(() => {
      return IDLE_ROBOT_SPOTS.map((s) => ({
         x: s.x,
         y: 0.34,
         z: s.z,
         rotY: s.rotY,
         sx: 1,
         sy: 1,
         sz: 1,
      }));
   }, []);

   const idleHeads = useMemo(() => {
      return IDLE_ROBOT_SPOTS.map((s) => ({
         x: s.x,
         y: 0.76,
         z: s.z,
         rotY: s.rotY,
         sx: 1,
         sy: 0.85,
         sz: 0.95,
      }));
   }, []);

   return (
      <group name="robot-collector-decor">
         {/* Lab background perimeter walls */}
         <Instanced spots={wallSpots} name="lab-walls">
            <primitive object={geo.wallPanel} attach="geometry" />
            <primitive object={mats.wall} attach="material" />
         </Instanced>

         {/* Diagnostic monitors with emissive data screens */}
         <Instanced spots={screenSpots} name="wall-screens">
            <primitive object={geo.screen} attach="geometry" />
            <primitive object={mats.screenCyan} attach="material" />
         </Instanced>

         {/* Overhead utility conduit pipes */}
         <Instanced spots={pipeSpots} name="conduit-pipes">
            <primitive object={geo.pipe} attach="geometry" />
            <primitive object={mats.pipe} attach="material" />
         </Instanced>

         {/* Docked maintenance robots */}
         <Instanced spots={idleBodies} name="idle-robot-bodies">
            <primitive object={geo.idleBody} attach="geometry" />
            <primitive object={mats.idleRobot} attach="material" />
         </Instanced>
         <Instanced spots={idleHeads} name="idle-robot-heads">
            <primitive object={geo.idleHead} attach="geometry" />
            <primitive object={mats.idleHead} attach="material" />
         </Instanced>

         {/* Wall charging stations */}
         <Instanced spots={stationSpots} name="charging-stations">
            <primitive object={geo.station} attach="geometry" />
            <primitive object={mats.station} attach="material" />
         </Instanced>

         {/* Heavy shipping containers / stacked crates in outer yard */}
         <Instanced spots={crateSpots} name="decor-crates">
            <primitive object={geo.crate} attach="geometry" />
            <primitive object={mats.crate} attach="material" />
         </Instanced>

         {/* Ground cable conduits flush with outer floor */}
         <Instanced spots={ductSpots} name="cable-ducts">
            <primitive object={geo.cableDuct} attach="geometry" />
            <primitive object={mats.duct} attach="material" />
         </Instanced>
      </group>
   );
}
