"use client";

import { useEffect, useMemo } from "react";
import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { BIRDS, CLOUD_DRIFT, COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({ x: spot.x, y: spot.y, z: spot.z, rotY: spot.rotY, sx: spot.sx, sy: spot.sy, sz: spot.sz }));
}

/** Low-poly forest, rocks and flowers outside the field, plus a far flock and a few clouds. */
export function Decor({ reduced }: { reduced: boolean }) {
   const quality = useQuality();
   const time = useGameTime();
   const geo = useMemo(() => {
      const trunk = new CylinderGeometry(0.11, 0.18, 1.05, 6).translate(0, 0.525, 0);
      const low = new ConeGeometry(0.95, 1.45, 7).translate(0, 1.55, 0);
      const high = new ConeGeometry(0.7, 1.1, 7).translate(0, 2.35, 0);
      const pine = mergeGeometries([low, high]);
      low.dispose();
      high.dispose();
      if (!pine) throw new Error("castle look: pine crown");
      const body = new ConeGeometry(0.12, 0.5, 4);
      body.rotateX(-Math.PI / 2);
      const wings = new BoxGeometry(0.72, 0.035, 0.18);
      const bird = mergeGeometries([body, wings]);
      body.dispose();
      wings.dispose();
      if (!bird) throw new Error("castle look: bird");
      return {
         trunk,
         pine,
         round: new IcosahedronGeometry(0.88, 1).translate(0, 1.6, 0),
         rock: new IcosahedronGeometry(0.42, 0).translate(0, 0.3, 0),
         flower: new ConeGeometry(0.16, 0.38, 5).translate(0, 0.26, 0),
         tuft: new ConeGeometry(0.22, 0.48, 5).translate(0, 0.24, 0),
         cloud: new IcosahedronGeometry(1, 0),
         bird,
      };
   }, []);
   // the primitives below carry no dispose={null}: R3F v8 applies a primitive's props to its object, so
   // dispose={null} would overwrite geometry.dispose with null and this cleanup would throw on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const pinesA = useMemo(() => asSpots(decorOf("pine", 0).slice(0, scaledCount(decorOf("pine", 0).length, quality.decor))), [quality.decor]);
   const pinesB = useMemo(() => asSpots(decorOf("pine", 1).slice(0, scaledCount(decorOf("pine", 1).length, quality.decor))), [quality.decor]);
   const rounds = useMemo(() => asSpots(decorOf("round").slice(0, scaledCount(decorOf("round").length, quality.decor))), [quality.decor]);
   const trunks = useMemo(() => [...pinesA, ...pinesB, ...rounds], [pinesA, pinesB, rounds]);
   const rocks = useMemo(() => asSpots(decorOf("rock").slice(0, scaledCount(decorOf("rock").length, quality.decor))), [quality.decor]);
   const flowersA = useMemo(() => asSpots(decorOf("flower", 0).slice(0, scaledCount(decorOf("flower", 0).length, quality.decor))), [quality.decor]);
   const flowersB = useMemo(() => asSpots(decorOf("flower", 1).slice(0, scaledCount(decorOf("flower", 1).length, quality.decor))), [quality.decor]);
   const tufts = useMemo(() => asSpots(decorOf("tuft").slice(0, scaledCount(decorOf("tuft").length, quality.decor))), [quality.decor]);
   const clouds = useMemo(() => decorOf("cloud"), []);
   const scratch = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3(), axis: new Vector3(0, 1, 0) }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const cloud = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.15 + i * 1.3) * CLOUD_DRIFT;
      scratch.p.set(cloud.x + drift, cloud.y, cloud.z);
      scratch.q.identity();
      scratch.s.set(cloud.sx, cloud.sy, cloud.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };
   const placeBird = (i: number, m: Matrix4) => {
      const spin = (reduced ? i * 0.4 : time.now * 0.45) + i * ((Math.PI * 2) / BIRDS.count);
      scratch.p.set(
         BIRDS.centerX + Math.cos(spin) * BIRDS.radiusX,
         BIRDS.y + (reduced ? 0 : Math.sin(time.now * 1.6 + i) * 0.28),
         BIRDS.centerZ + Math.sin(spin) * BIRDS.radiusZ,
      );
      scratch.q.setFromAxisAngle(scratch.axis, -spin);
      scratch.s.set(1, 1, 1);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="castle-decor">
         {trunks.length > 0 && (
            <Instanced spots={trunks} name="castle-trunks">
               <primitive object={geo.trunk} attach="geometry" />
               <meshStandardMaterial color={COLORS.trunk} flatShading roughness={1} />
            </Instanced>
         )}
         {pinesA.length > 0 && (
            <Instanced spots={pinesA} name="castle-pine-a">
               <primitive object={geo.pine} attach="geometry" />
               <meshStandardMaterial color={COLORS.pineA} flatShading roughness={1} />
            </Instanced>
         )}
         {pinesB.length > 0 && (
            <Instanced spots={pinesB} name="castle-pine-b">
               <primitive object={geo.pine} attach="geometry" />
               <meshStandardMaterial color={COLORS.pineB} flatShading roughness={1} />
            </Instanced>
         )}
         {rounds.length > 0 && (
            <Instanced spots={rounds} name="castle-round">
               <primitive object={geo.round} attach="geometry" />
               <meshStandardMaterial color={COLORS.round} flatShading roughness={1} />
            </Instanced>
         )}
         {rocks.length > 0 && (
            <Instanced spots={rocks} name="castle-rocks">
               <primitive object={geo.rock} attach="geometry" />
               <meshStandardMaterial color={COLORS.rock} flatShading roughness={1} />
            </Instanced>
         )}
         {flowersA.length > 0 && (
            <Instanced spots={flowersA} name="castle-flowers-a">
               <primitive object={geo.flower} attach="geometry" />
               <meshStandardMaterial color={COLORS.flowerA} flatShading roughness={0.7} />
            </Instanced>
         )}
         {flowersB.length > 0 && (
            <Instanced spots={flowersB} name="castle-flowers-b">
               <primitive object={geo.flower} attach="geometry" />
               <meshStandardMaterial color={COLORS.flowerB} flatShading roughness={0.7} />
            </Instanced>
         )}
         {tufts.length > 0 && (
            <Instanced spots={tufts} name="castle-tufts">
               <primitive object={geo.tuft} attach="geometry" />
               <meshStandardMaterial color={COLORS.tuft} flatShading roughness={1} />
            </Instanced>
         )}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="castle-clouds">
            <primitive object={geo.cloud} attach="geometry" />
            <meshStandardMaterial color={COLORS.cloud} flatShading roughness={1} />
         </DynamicInstanced>
         <DynamicInstanced count={BIRDS.count} update={placeBird} name="castle-birds">
            <primitive object={geo.bird} attach="geometry" />
            <meshStandardMaterial color={COLORS.bird} flatShading roughness={1} />
         </DynamicInstanced>
      </group>
   );
}
