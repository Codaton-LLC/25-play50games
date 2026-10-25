"use client";

// Instanced kitchen surroundings outside the active play area.
// Shelves with jars and bottles, hanging utensils, a window with outdoor street view,
// overhead commercial exhaust and hanging cookware.
// All geometries and materials are allocated once and disposed on unmount.
// Never puts dispose={null} on primitive geometries (R3F v8 compatibility).
import { memo, useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   Matrix4,
   Quaternion,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   BOTTLE_SPOTS,
   CANISTER_SPOTS,
   CERAMIC_SPOTS,
   COLORS,
   DecorSpot,
   EXHAUST_HOOD_SPOT,
   JAR_SPOTS,
   OVERHEAD_PAN_SPOTS,
   PENDANT_LAMP_SPOTS,
   SHELF_PLANK_SPOTS,
   SHELF_POST_SPOTS,
   STREET_BUILDING_SPOTS,
   UTENSIL_RAIL_SPOT,
   UTENSIL_SPOTS,
   WINDOW_SPOT,
} from "./looks";

function toSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      rotY: s.rotY,
      rotZ: s.rotZ,
      sx: s.sx,
      sy: s.sy,
      sz: s.sz,
   }));
}

export const Decor = memo(function Decor({ reduced = false }: { reduced?: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Shelving metal posts & wood planks
      const post = new BoxGeometry(1, 1, 1);
      const plank = new BoxGeometry(1, 1, 1);

      // 2. Glass jar with cork stopper
      const jarBody = new CylinderGeometry(0.1, 0.1, 0.24, 14);
      const jarCork = new CylinderGeometry(0.065, 0.08, 0.06, 12).translate(0, 0.14, 0);
      const jar = mergeGeometries([jarBody, jarCork]) ?? new CylinderGeometry(0.1, 0.1, 0.28, 12);
      jarBody.dispose();
      jarCork.dispose();

      // 3. Oil & vinegar bottle with slender neck
      const bottleBase = new CylinderGeometry(0.07, 0.085, 0.38, 12);
      const bottleNeck = new CylinderGeometry(0.025, 0.04, 0.18, 10).translate(0, 0.26, 0);
      const bottleSpout = new CylinderGeometry(0.012, 0.015, 0.06, 8).translate(0, 0.36, 0);
      const bottle = mergeGeometries([bottleBase, bottleNeck, bottleSpout]) ?? new CylinderGeometry(0.08, 0.08, 0.5, 10);
      bottleBase.dispose();
      bottleNeck.dispose();
      bottleSpout.dispose();

      // 4. Ceramic mixing bowl & plates
      const bowl = new CylinderGeometry(0.18, 0.1, 0.16, 14);

      // 5. Ceramic storage canister with wooden lid
      const canisterBody = new CylinderGeometry(0.13, 0.13, 0.32, 14);
      const canisterLid = new CylinderGeometry(0.14, 0.14, 0.04, 14).translate(0, 0.17, 0);
      const canister = mergeGeometries([canisterBody, canisterLid]) ?? new CylinderGeometry(0.13, 0.13, 0.34, 12);
      canisterBody.dispose();
      canisterLid.dispose();

      // 6. Utensil rail & hanging ladles/spatulas
      const rail = new BoxGeometry(1, 1, 1);
      const ladleHandle = new CylinderGeometry(0.015, 0.015, 0.5, 8);
      const ladleCup = new CylinderGeometry(0.07, 0.03, 0.08, 10).translate(0, -0.26, 0.04);
      const utensil = mergeGeometries([ladleHandle, ladleCup]) ?? new CylinderGeometry(0.02, 0.02, 0.55, 8);
      ladleHandle.dispose();
      ladleCup.dispose();

      // 7. Kitchen window frame with outer bevel and mullions
      const winOuter = new BoxGeometry(2.6, 3.2, 0.08);
      const winHorizMullion = new BoxGeometry(2.5, 0.06, 0.1).translate(0, 0, 0.02);
      const winVertMullion = new BoxGeometry(0.06, 3.1, 0.1).translate(0, 0, 0.02);
      const windowFrame = mergeGeometries([winOuter, winHorizMullion, winVertMullion]) ?? new BoxGeometry(2.6, 3.2, 0.1);
      winOuter.dispose();
      winHorizMullion.dispose();
      winVertMullion.dispose();

      // 8. Distant street buildings & street lamp
      const building = new BoxGeometry(1, 1, 1);
      const lampPost = new CylinderGeometry(0.03, 0.045, 1.8, 8);
      const lampHead = new ConeGeometry(0.16, 0.22, 8).translate(0, 0.95, 0);
      const streetLamp = mergeGeometries([lampPost, lampHead]) ?? new CylinderGeometry(0.05, 0.05, 2, 8);
      lampPost.dispose();
      lampHead.dispose();

      // 9. Commercial stainless exhaust hood
      const hoodUpper = new BoxGeometry(18, 0.8, 2.2);
      const hoodChamber = new BoxGeometry(17.8, 0.9, 2.0).translate(0, -0.7, 0);
      const exhaustHood = mergeGeometries([hoodUpper, hoodChamber]) ?? new BoxGeometry(18, 1.6, 2.2);
      hoodUpper.dispose();
      hoodChamber.dispose();

      // 10. Overhead hanging cookware (copper/steel sauté pan)
      const panBody = new CylinderGeometry(0.2, 0.18, 0.08, 14);
      const panHandle = new BoxGeometry(0.03, 0.03, 0.3).translate(0, 0.02, 0.22);
      const pan = mergeGeometries([panBody, panHandle]) ?? new CylinderGeometry(0.2, 0.2, 0.1, 12);
      panBody.dispose();
      panHandle.dispose();

      // 11. Warm brass pendant lamp
      const shade = new ConeGeometry(0.24, 0.18, 14);
      shade.rotateX(Math.PI);
      const cord = new CylinderGeometry(0.008, 0.008, 0.8, 6).translate(0, 0.48, 0);
      const bulb = new CylinderGeometry(0.06, 0.06, 0.08, 10).translate(0, -0.06, 0);
      const lamp = mergeGeometries([shade, cord, bulb]) ?? new ConeGeometry(0.24, 0.2, 10);
      shade.dispose();
      cord.dispose();
      bulb.dispose();

      return {
         post,
         plank,
         jar,
         bottle,
         bowl,
         canister,
         rail,
         utensil,
         windowFrame,
         building,
         streetLamp,
         exhaustHood,
         pan,
         lamp,
      };
   }, []);

   // Geometry disposal on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) {
         geometry.dispose();
      }
   }, [geo]);

   // Quality-scaled spot lists
   const postSpots = useMemo(() => toSpots(SHELF_POST_SPOTS), []);
   const plankSpots = useMemo(() => toSpots(SHELF_PLANK_SPOTS), []);
   const jarSpots = useMemo(
      () => toSpots(JAR_SPOTS.slice(0, scaledCount(JAR_SPOTS.length, quality.decor))),
      [quality.decor]
   );
   const bottleSpots = useMemo(
      () => toSpots(BOTTLE_SPOTS.slice(0, scaledCount(BOTTLE_SPOTS.length, quality.decor))),
      [quality.decor]
   );
   const ceramicSpots = useMemo(
      () => toSpots(CERAMIC_SPOTS.slice(0, scaledCount(CERAMIC_SPOTS.length, quality.decor))),
      [quality.decor]
   );
   const canisterSpots = useMemo(
      () => toSpots(CANISTER_SPOTS.slice(0, scaledCount(CANISTER_SPOTS.length, quality.decor))),
      [quality.decor]
   );
   const railSpots = useMemo(() => toSpots([UTENSIL_RAIL_SPOT]), []);
   const utensilSpots = useMemo(
      () => toSpots(UTENSIL_SPOTS.slice(0, scaledCount(UTENSIL_SPOTS.length, quality.decor))),
      [quality.decor]
   );
   const windowSpots = useMemo(() => toSpots([WINDOW_SPOT]), []);
   const buildingSpots = useMemo(
      () => toSpots(STREET_BUILDING_SPOTS.filter((s) => s.kind === "building")),
      []
   );
   const streetLampSpots = useMemo(
      () => toSpots(STREET_BUILDING_SPOTS.filter((s) => s.kind === "streetLamp")),
      []
   );
   const hoodSpots = useMemo(() => toSpots([EXHAUST_HOOD_SPOT]), []);

   // Dynamic sway for hanging overhead pans and pendant lamps
   const scratch = useMemo(
      () => ({
         p: new Vector3(),
         q: new Quaternion(),
         s: new Vector3(),
         euler: new Vector3(),
      }),
      []
   );

   const placePan = (i: number, m: Matrix4) => {
      const spot = OVERHEAD_PAN_SPOTS[i];
      if (!spot) return;
      const sway = reduced ? 0 : Math.sin(time.now * 1.8 + i * 1.2) * 0.05;
      scratch.p.set(spot.x, spot.y, spot.z);
      scratch.q.setFromAxisAngle(new Vector3(0, 0, 1), (spot.rotZ ?? 0) + sway);
      scratch.s.set(spot.sx, spot.sy, spot.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   const placeLamp = (i: number, m: Matrix4) => {
      const spot = PENDANT_LAMP_SPOTS[i];
      if (!spot) return;
      const sway = reduced ? 0 : Math.sin(time.now * 1.2 + i * 1.5) * 0.03;
      scratch.p.set(spot.x, spot.y, spot.z);
      scratch.q.setFromAxisAngle(new Vector3(0, 0, 1), sway);
      scratch.s.set(spot.sx, spot.sy, spot.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="kitchen-decor">
         {/* Left shelving unit */}
         {postSpots.length > 0 && (
            <Instanced spots={postSpots} name="decor-posts">
               <primitive object={geo.post} attach="geometry" />
               <meshStandardMaterial color={COLORS.shelfMetal} roughness={0.5} metalness={0.4} />
            </Instanced>
         )}
         {plankSpots.length > 0 && (
            <Instanced spots={plankSpots} name="decor-planks">
               <primitive object={geo.plank} attach="geometry" />
               <meshStandardMaterial color={COLORS.shelfPlank} roughness={0.75} />
            </Instanced>
         )}

         {/* Jars, bottles, bowls & canisters */}
         {jarSpots.length > 0 && (
            <Instanced spots={jarSpots} name="decor-jars">
               <primitive object={geo.jar} attach="geometry" />
               <meshStandardMaterial color={COLORS.jarGlass} roughness={0.2} metalness={0.1} />
            </Instanced>
         )}
         {bottleSpots.length > 0 && (
            <Instanced spots={bottleSpots} name="decor-bottles">
               <primitive object={geo.bottle} attach="geometry" />
               <meshStandardMaterial color={COLORS.bottleOil} roughness={0.25} metalness={0.1} />
            </Instanced>
         )}
         {ceramicSpots.length > 0 && (
            <Instanced spots={ceramicSpots} name="decor-ceramics">
               <primitive object={geo.bowl} attach="geometry" />
               <meshStandardMaterial color={COLORS.plateCeramic} roughness={0.35} />
            </Instanced>
         )}
         {canisterSpots.length > 0 && (
            <Instanced spots={canisterSpots} name="decor-canisters">
               <primitive object={geo.canister} attach="geometry" />
               <meshStandardMaterial color={COLORS.canisterCeramic} roughness={0.45} />
            </Instanced>
         )}

         {/* Right prep station: utensil rail & hanging utensils */}
         {railSpots.length > 0 && (
            <Instanced spots={railSpots} name="decor-rail">
               <primitive object={geo.rail} attach="geometry" />
               <meshStandardMaterial color={COLORS.utensilRail} roughness={0.4} metalness={0.6} />
            </Instanced>
         )}
         {utensilSpots.length > 0 && (
            <Instanced spots={utensilSpots} name="decor-utensils">
               <primitive object={geo.utensil} attach="geometry" />
               <meshStandardMaterial color={COLORS.utensilSteel} roughness={0.35} metalness={0.5} />
            </Instanced>
         )}

         {/* Street window & outdoor city view */}
         {windowSpots.length > 0 && (
            <Instanced spots={windowSpots} name="decor-window">
               <primitive object={geo.windowFrame} attach="geometry" />
               <meshStandardMaterial color={COLORS.windowFrame} roughness={0.6} metalness={0.3} />
            </Instanced>
         )}
         {buildingSpots.length > 0 && (
            <Instanced spots={buildingSpots} name="decor-buildings">
               <primitive object={geo.building} attach="geometry" />
               <meshStandardMaterial color={COLORS.buildingA} roughness={0.9} />
            </Instanced>
         )}
         {streetLampSpots.length > 0 && (
            <Instanced spots={streetLampSpots} name="decor-street-lamp">
               <primitive object={geo.streetLamp} attach="geometry" />
               <meshStandardMaterial color={COLORS.streetWarmth} emissive={COLORS.streetWarmth} emissiveIntensity={0.6} roughness={0.4} />
            </Instanced>
         )}

         {/* Overhead commercial exhaust hood */}
         {hoodSpots.length > 0 && (
            <Instanced spots={hoodSpots} name="decor-exhaust-hood">
               <primitive object={geo.exhaustHood} attach="geometry" />
               <meshStandardMaterial color={COLORS.exhaustHood} roughness={0.38} metalness={0.65} />
            </Instanced>
         )}

         {/* Overhead hanging sauté pans (swaying gently) */}
         <DynamicInstanced count={OVERHEAD_PAN_SPOTS.length} update={placePan} name="decor-pans">
            <primitive object={geo.pan} attach="geometry" />
            <meshStandardMaterial color={COLORS.copperPot} roughness={0.32} metalness={0.4} />
         </DynamicInstanced>

         {/* Pendant lamps with warm glowing shades */}
         <DynamicInstanced count={PENDANT_LAMP_SPOTS.length} update={placeLamp} name="decor-lamps">
            <primitive object={geo.lamp} attach="geometry" />
            <meshStandardMaterial color={COLORS.lampBrass} roughness={0.3} metalness={0.7} />
         </DynamicInstanced>
      </group>
   );
});
