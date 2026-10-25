"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   type BufferGeometry,
   ConeGeometry,
   CylinderGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   CLOUD_SPOTS,
   COLORS,
   CROWD_SPOTS,
   FLAG_SPOTS,
   STAND_SPOTS,
   TREE_SPOTS,
   type DecorSpot,
} from "./looks";

/**
 * Review fix: the stand, crowd, flag and cloud geometries are built at their real size and the spots
 * scale them again by sx/sy/sz (the decor's size), so a stand came out ~47 x 14 x 144 m and covered
 * the whole 390x844 view in grey. Scale those geometries to a unit box (placement kept) so the spot's
 * scale is the drawn size.
 */
function unitScale<T extends BufferGeometry>(g: T): T {
   g.computeBoundingBox();
   const size = g.boundingBox!.getSize(new Vector3());
   g.scale(1 / (size.x || 1), 1 / (size.y || 1), 1 / (size.z || 1));
   g.computeBoundingBox();
   return g;
}

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
 * Stadium surroundings outside the play area:
 * Tiered spectator stands, crowd, stadium flags, trees on perimeter hills, and drifting clouds.
 */
export function Decor({ reduced = false }: { reduced?: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 3-tier stepped bleachers stand
      const t1 = new BoxGeometry(2.2, 1.0, 12).translate(-2.0, 0.5, 0);
      const t2 = new BoxGeometry(2.2, 2.0, 12).translate(0.0, 1.0, 0);
      const t3 = new BoxGeometry(2.2, 3.0, 12).translate(2.0, 1.5, 0);
      const backWall = new BoxGeometry(0.5, 3.8, 12).translate(3.35, 1.9, 0);
      const stand = mergeGeometries([t1, t2, t3, backWall]);
      t1.dispose();
      t2.dispose();
      t3.dispose();
      backWall.dispose();
      if (!stand) throw new Error("obstacle-race decor: stand geometry");

      // Crowd spectator (low-poly rounded figure)
      const crowdBody = new BoxGeometry(0.42, 0.52, 0.42);

      // Flag pole and pennant
      const flagPole = new CylinderGeometry(0.04, 0.04, 2.4, 8).translate(0, 1.2, 0);
      const flagPennant = new BoxGeometry(0.85, 0.45, 0.03).translate(0.425, 0, 0);

      // Trees
      const trunk = new CylinderGeometry(0.18, 0.28, 1.4, 6).translate(0, 0.7, 0);
      const coneLow = new ConeGeometry(1.4, 2.1, 7).translate(0, 2.2, 0);
      const coneHigh = new ConeGeometry(1.0, 1.6, 7).translate(0, 3.3, 0);
      const pineCrown = mergeGeometries([coneLow, coneHigh]);
      coneLow.dispose();
      coneHigh.dispose();
      if (!pineCrown) throw new Error("obstacle-race decor: pine geometry");

      const roundCrown = new IcosahedronGeometry(1.3, 1).translate(0, 2.3, 0);

      // Clouds
      const cloudPuff = new IcosahedronGeometry(1.0, 1);

      return {
         stand: unitScale(stand),
         crowdBody: unitScale(crowdBody),
         flagPole: unitScale(flagPole),
         flagPennant: unitScale(flagPennant),
         trunk,
         pineCrown,
         roundCrown,
         cloudPuff: unitScale(cloudPuff),
      };
   }, []);

   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const stands = useMemo(() => asSpots(STAND_SPOTS), []);

   const crowdCount = scaledCount(CROWD_SPOTS.length, quality.decor);
   const crowd0 = useMemo(() => asSpots(CROWD_SPOTS.slice(0, crowdCount).filter((s) => s.variant === 0)), [crowdCount]);
   const crowd1 = useMemo(() => asSpots(CROWD_SPOTS.slice(0, crowdCount).filter((s) => s.variant === 1)), [crowdCount]);
   const crowd2 = useMemo(() => asSpots(CROWD_SPOTS.slice(0, crowdCount).filter((s) => s.variant === 2)), [crowdCount]);
   const crowd3 = useMemo(() => asSpots(CROWD_SPOTS.slice(0, crowdCount).filter((s) => s.variant === 3)), [crowdCount]);

   const flagPoles = useMemo(() => asSpots(FLAG_SPOTS.poles), []);
   const flagPennants = useMemo(() => asSpots(FLAG_SPOTS.pennants), []);

   const treeCount = scaledCount(TREE_SPOTS.length, quality.decor);
   const pines = useMemo(() => asSpots(TREE_SPOTS.slice(0, treeCount).filter((s) => s.variant === 0)), [treeCount]);
   const rounds = useMemo(() => asSpots(TREE_SPOTS.slice(0, treeCount).filter((s) => s.variant === 1)), [treeCount]);
   const trunks = useMemo(() => [...pines, ...rounds], [pines, rounds]);

   const clouds = CLOUD_SPOTS;
   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
   }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const c = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.08 + i * 1.5) * 2.5;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx ?? 1, c.sy ?? 1, c.sz ?? 1);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="obstacle-decor">
         {/* Stadium stands */}
         {stands.length > 0 && (
            <Instanced spots={stands} name="stadium-stands">
               <primitive object={geo.stand} attach="geometry" />
               <meshStandardMaterial color={COLORS.standStructure} roughness={0.7} />
            </Instanced>
         )}

         {/* Spectator crowd */}
         {crowd0.length > 0 && (
            <Instanced spots={crowd0} name="crowd-blue">
               <primitive object={geo.crowdBody} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdBlue} roughness={0.5} />
            </Instanced>
         )}
         {crowd1.length > 0 && (
            <Instanced spots={crowd1} name="crowd-red">
               <primitive object={geo.crowdBody} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdRed} roughness={0.5} />
            </Instanced>
         )}
         {crowd2.length > 0 && (
            <Instanced spots={crowd2} name="crowd-yellow">
               <primitive object={geo.crowdBody} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdYellow} roughness={0.5} />
            </Instanced>
         )}
         {crowd3.length > 0 && (
            <Instanced spots={crowd3} name="crowd-green">
               <primitive object={geo.crowdBody} attach="geometry" />
               <meshStandardMaterial color={COLORS.crowdGreen} roughness={0.5} />
            </Instanced>
         )}

         {/* Flags */}
         {flagPoles.length > 0 && (
            <Instanced spots={flagPoles} name="flag-poles">
               <primitive object={geo.flagPole} attach="geometry" />
               <meshStandardMaterial color={COLORS.flagPole} roughness={0.4} metalness={0.4} />
            </Instanced>
         )}
         {flagPennants.length > 0 && (
            <Instanced spots={flagPennants} name="flag-pennants">
               <primitive object={geo.flagPennant} attach="geometry" />
               <meshStandardMaterial color={COLORS.flagA} roughness={0.5} />
            </Instanced>
         )}

         {/* Perimeter trees */}
         {trunks.length > 0 && (
            <Instanced spots={trunks} name="tree-trunks">
               <primitive object={geo.trunk} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeTrunk} roughness={0.9} />
            </Instanced>
         )}
         {pines.length > 0 && (
            <Instanced spots={pines} name="tree-pines">
               <primitive object={geo.pineCrown} attach="geometry" />
               <meshStandardMaterial color={COLORS.treePine} flatShading roughness={0.8} />
            </Instanced>
         )}
         {rounds.length > 0 && (
            <Instanced spots={rounds} name="tree-rounds">
               <primitive object={geo.roundCrown} attach="geometry" />
               <meshStandardMaterial color={COLORS.treeRound} flatShading roughness={0.8} />
            </Instanced>
         )}

         {/* Sky clouds */}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="sky-clouds">
            <primitive object={geo.cloudPuff} attach="geometry" />
            <meshStandardMaterial color={COLORS.cloud} flatShading roughness={1} />
         </DynamicInstanced>
      </group>
   );
}
