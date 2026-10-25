"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CylinderGeometry,
   type BufferGeometry,
} from "three";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, GROUND, decorOf, type DecorSpot } from "./looks";

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
 * Modern warehouse surroundings outside the active play area:
 * Industrial corrugated walls, roller shutter doors, steel I-beam columns,
 * tall high-bay shelving with goods, staged pallets, parked forklifts in charging bays,
 * yellow safety bollards, and an expansive polished logistics floor.
 *
 * Every geometry is created once in useMemo and cleanly disposed on unmount.
 * No primitive with attach="geometry" carries dispose={null} (R3F v8 fix).
 */
export function Decor({ ground = COLORS.floor }: { ground?: string }) {
   const quality = useQuality();

   const geo = useMemo(() => {
      // 1. Wall panel (6m x 7m x 0.35m) with bevelled top trim
      const wall = new BoxGeometry(1, 1, 1);
      const wallTrim = new BoxGeometry(1.02, 0.08, 1.05);

      // 2. Structural I-beam column
      const column = new BoxGeometry(1, 1, 1);

      // 3. Roller shutter door with ribbed header
      const rollerDoor = new BoxGeometry(1, 1, 1);
      const rollerDoorHeader = new BoxGeometry(1.04, 0.08, 1.1);

      // 4. High-bay rack uprights and crossbeams
      const highRackUpright = new BoxGeometry(1, 1, 1);
      const highRackBeam = new BoxGeometry(1, 1, 1);
      const carton = new BoxGeometry(1, 1, 1);
      const shrinkWrap = new BoxGeometry(1, 1, 1);

      // 5. Pallet
      const pallet = new BoxGeometry(1, 1, 1);

      // 6. Parked forklift body, cab, and wheels
      const forkliftBody = new BoxGeometry(1.2, 0.35, 0.65).translate(0, 0.22, 0);
      const forkliftCab = new BoxGeometry(0.55, 0.45, 0.52).translate(-0.1, 0.58, 0);
      const forkliftWheel = new CylinderGeometry(0.14, 0.14, 0.12, 12).rotateZ(Math.PI / 2);

      // 7. Safety bollard
      const bollard = new CylinderGeometry(0.5, 0.5, 1, 12);

      // 8. Overhead steel truss
      const truss = new BoxGeometry(1, 1, 1);

      return {
         wall,
         wallTrim,
         column,
         rollerDoor,
         rollerDoorHeader,
         highRackUpright,
         highRackBeam,
         carton,
         shrinkWrap,
         pallet,
         forkliftBody,
         forkliftCab,
         forkliftWheel,
         bollard,
         truss,
      };
   }, []);

   // Clean disposal on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) {
         (geometry as BufferGeometry).dispose();
      }
   }, [geo]);

   // Decor spots scaled by quality tier
   const walls = useMemo(
      () => asSpots(decorOf("wall").slice(0, scaledCount(decorOf("wall").length, quality.decor))),
      [quality.decor]
   );
   const columns = useMemo(
      () => asSpots(decorOf("column").slice(0, scaledCount(decorOf("column").length, quality.decor))),
      [quality.decor]
   );
   const rollerDoors = useMemo(() => asSpots(decorOf("rollerDoor")), []);
   const rollerDoorHeaders = useMemo(
      () => rollerDoors.map((spot) => ({ ...spot, y: (spot.y ?? 0) + (spot.sy ?? 1) * 0.5 + 0.1, sy: 0.25 })),
      [rollerDoors]
   );

   const highRacks = useMemo(
      () => asSpots(decorOf("highRack").slice(0, scaledCount(decorOf("highRack").length, quality.decor))),
      [quality.decor]
   );
   const highRackBeams = useMemo(
      () => asSpots(decorOf("highRackBeam").slice(0, scaledCount(decorOf("highRackBeam").length, quality.decor))),
      [quality.decor]
   );
   const cartonsA = useMemo(
      () => asSpots(decorOf("highRackCarton", 0).slice(0, scaledCount(decorOf("highRackCarton", 0).length, quality.decor))),
      [quality.decor]
   );
   const cartonsB = useMemo(
      () => asSpots(decorOf("highRackCarton", 1).slice(0, scaledCount(decorOf("highRackCarton", 1).length, quality.decor))),
      [quality.decor]
   );
   const shrinkWrapPallets = useMemo(
      () => asSpots(decorOf("highRackCarton", 2).slice(0, scaledCount(decorOf("highRackCarton", 2).length, quality.decor))),
      [quality.decor]
   );

   const stagedPallets = useMemo(
      () => asSpots(decorOf("palletStack").slice(0, scaledCount(decorOf("palletStack").length, quality.decor))),
      [quality.decor]
   );

   const parkedForklifts = useMemo(() => asSpots(decorOf("parkedForklift")), []);
   const parkedForkliftWheels = useMemo(() => {
      const spots: InstanceSpot[] = [];
      for (const f of parkedForklifts) {
         const rot = f.rotY ?? 0;
         const c = Math.cos(rot);
         const s = Math.sin(rot);
         const offsets = [
            [-0.32, -0.28],
            [0.32, -0.28],
            [-0.32, 0.28],
            [0.32, 0.28],
         ];
         for (const [ox, oz] of offsets) {
            spots.push({
               x: (f.x ?? 0) + c * ox + s * oz,
               y: 0.14,
               z: (f.z ?? 0) - s * ox + c * oz,
               rotY: rot,
               sx: 1,
               sy: 1,
               sz: 1,
            });
         }
      }
      return spots;
   }, [parkedForklifts]);

   const bollards = useMemo(
      () => asSpots(decorOf("bollard").slice(0, scaledCount(decorOf("bollard").length, quality.decor))),
      [quality.decor]
   );

   const trusses = useMemo(
      () => asSpots(decorOf("truss").slice(0, scaledCount(decorOf("truss").length, quality.decor))),
      [quality.decor]
   );

   return (
      <group name="warehouse-decor">
         {/* Continuous logistics concrete floor covering full screen view at any camera angle */}
         <mesh
            position={[GROUND.x, GROUND.y, GROUND.z]}
            rotation-x={-Math.PI / 2}
            name="warehouse-ground"
         >
            <planeGeometry args={[GROUND.width, GROUND.depth]} />
            <meshStandardMaterial color={ground} roughness={0.88} />
         </mesh>

         {/* Warehouse Wall Panels */}
         {walls.length > 0 && (
            <Instanced spots={walls} name="warehouse-walls">
               <primitive object={geo.wall} attach="geometry" />
               <meshStandardMaterial color={COLORS.wall} roughness={0.72} />
            </Instanced>
         )}

         {/* Wall Base Trim */}
         {walls.length > 0 && (
            <Instanced
               spots={walls.map((s) => ({ ...s, y: (s.y ?? 0) - (s.sy ?? 1) * 0.48, sy: 0.25 }))}
               name="warehouse-wall-trim"
            >
               <primitive object={geo.wallTrim} attach="geometry" />
               <meshStandardMaterial color={COLORS.wallTrim} roughness={0.6} />
            </Instanced>
         )}

         {/* Steel Columns */}
         {columns.length > 0 && (
            <Instanced spots={columns} name="warehouse-columns">
               <primitive object={geo.column} attach="geometry" />
               <meshStandardMaterial color={COLORS.column} roughness={0.6} metalness={0.3} />
            </Instanced>
         )}

         {/* Roller Shutter Doors */}
         {rollerDoors.length > 0 && (
            <Instanced spots={rollerDoors} name="warehouse-roller-doors">
               <primitive object={geo.rollerDoor} attach="geometry" />
               <meshStandardMaterial color={COLORS.rollerDoor} roughness={0.45} metalness={0.35} />
            </Instanced>
         )}
         {rollerDoorHeaders.length > 0 && (
            <Instanced spots={rollerDoorHeaders} name="warehouse-door-headers">
               <primitive object={geo.rollerDoorHeader} attach="geometry" />
               <meshStandardMaterial color={COLORS.dockYellow} roughness={0.45} />
            </Instanced>
         )}

         {/* High-Bay Storage Racks */}
         {highRacks.length > 0 && (
            <Instanced spots={highRacks} name="warehouse-high-racks">
               <primitive object={geo.highRackUpright} attach="geometry" />
               <meshStandardMaterial color={COLORS.rackUpright} roughness={0.55} />
            </Instanced>
         )}
         {highRackBeams.length > 0 && (
            <Instanced spots={highRackBeams} name="warehouse-rack-beams">
               <primitive object={geo.highRackBeam} attach="geometry" />
               <meshStandardMaterial color={COLORS.rackBeam} roughness={0.5} metalness={0.25} />
            </Instanced>
         )}

         {/* Cartons on High Racks */}
         {cartonsA.length > 0 && (
            <Instanced spots={cartonsA} name="warehouse-cartons-a">
               <primitive object={geo.carton} attach="geometry" />
               <meshStandardMaterial color={COLORS.carton} roughness={0.85} />
            </Instanced>
         )}
         {cartonsB.length > 0 && (
            <Instanced spots={cartonsB} name="warehouse-cartons-b">
               <primitive object={geo.carton} attach="geometry" />
               <meshStandardMaterial color={COLORS.cartonDark} roughness={0.85} />
            </Instanced>
         )}
         {shrinkWrapPallets.length > 0 && (
            <Instanced spots={shrinkWrapPallets} name="warehouse-shrinkwrap">
               <primitive object={geo.shrinkWrap} attach="geometry" />
               <meshStandardMaterial color={COLORS.shrinkWrap} roughness={0.65} transparent opacity={0.92} />
            </Instanced>
         )}

         {/* Staged Pallets of Cargo Outside Play Area */}
         {stagedPallets.length > 0 && (
            <Instanced spots={stagedPallets} name="warehouse-staged-pallets">
               <primitive object={geo.pallet} attach="geometry" />
               <meshStandardMaterial color={COLORS.palletTop} roughness={0.8} />
            </Instanced>
         )}

         {/* Parked Forklifts in West Staging Bay */}
         {parkedForklifts.length > 0 && (
            <>
               <Instanced spots={parkedForklifts} name="warehouse-parked-forklift-bodies">
                  <primitive object={geo.forkliftBody} attach="geometry" />
                  <meshStandardMaterial color={COLORS.forkliftBody} roughness={0.42} />
               </Instanced>
               <Instanced spots={parkedForklifts} name="warehouse-parked-forklift-cabs">
                  <primitive object={geo.forkliftCab} attach="geometry" />
                  <meshStandardMaterial color={COLORS.forkliftCab} roughness={0.35} />
               </Instanced>
               <Instanced spots={parkedForkliftWheels} name="warehouse-parked-forklift-wheels">
                  <primitive object={geo.forkliftWheel} attach="geometry" />
                  <meshStandardMaterial color={COLORS.forkliftWheel} roughness={0.8} />
               </Instanced>
            </>
         )}

         {/* Safety Bollards */}
         {bollards.length > 0 && (
            <Instanced spots={bollards} name="warehouse-bollards">
               <primitive object={geo.bollard} attach="geometry" />
               <meshStandardMaterial color={COLORS.bollard} roughness={0.4} />
            </Instanced>
         )}

         {/* Overhead Steel Trusses */}
         {trusses.length > 0 && (
            <Instanced spots={trusses} name="warehouse-trusses">
               <primitive object={geo.truss} attach="geometry" />
               <meshStandardMaterial color={COLORS.column} roughness={0.65} metalness={0.3} />
            </Instanced>
         )}
      </group>
   );
}
