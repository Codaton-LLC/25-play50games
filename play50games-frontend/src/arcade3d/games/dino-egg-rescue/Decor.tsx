"use client";

import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   Vector3,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   CLOUD_DRIFT,
   COLORS,
   PTEROSAURS,
   decorOf,
   pterosaurPosition,
   type DecorSpot,
} from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      yaw: spot.rotY,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

/**
 * Prehistoric jungle surroundings outside the play area:
 * palms, ferns, volcanic rocks, distant volcano silhouettes, clouds, and soaring pterosaurs.
 */
export function Decor({ reduced }: { reduced: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Fern cluster (5 arched fronds)
      const fronds: BufferGeometry[] = [];
      for (let i = 0; i < 5; i++) {
         const angle = (i * Math.PI * 2) / 5;
         const frond = new ConeGeometry(0.24, 1.15, 4);
         frond.rotateZ(0.55);
         frond.rotateY(angle);
         frond.translate(Math.cos(angle) * 0.22, 0.45, Math.sin(angle) * 0.22);
         fronds.push(frond);
      }
      const fern = mergeGeometries(fronds);
      for (const f of fronds) f.dispose();
      if (!fern) throw new Error("dino look: fern");

      // 2. Palm trunk & canopy fronds
      const palmTrunk = new CylinderGeometry(0.12, 0.22, 2.6, 6).translate(0, 1.3, 0);

      const leaves: BufferGeometry[] = [];
      for (let i = 0; i < 6; i++) {
         const angle = (i * Math.PI * 2) / 6;
         const leaf = new ConeGeometry(0.42, 1.7, 4);
         leaf.scale(1, 1, 0.15);
         leaf.rotateZ(1.15);
         leaf.rotateY(angle);
         leaf.translate(0, 2.5, 0);
         leaves.push(leaf);
      }
      const palmFronds = mergeGeometries(leaves);
      for (const l of leaves) l.dispose();
      if (!palmFronds) throw new Error("dino look: palm");

      // 3. Volcanic boulder
      const rock = new IcosahedronGeometry(0.55, 0).translate(0, 0.38, 0);

      // 4. Distant volcano silhouette peak
      const volcanoSilhouette = new ConeGeometry(4.5, 8.5, 5).translate(0, 4.25, 0);

      // 5. Sunset cloud (merged squashed spheres)
      const c1 = new IcosahedronGeometry(1.2, 0).scale(1.8, 0.65, 1.2);
      const c2 = new IcosahedronGeometry(0.9, 0).scale(1.4, 0.55, 1.0).translate(-1.4, -0.1, 0.2);
      const c3 = new IcosahedronGeometry(1.0, 0).scale(1.5, 0.6, 1.1).translate(1.3, -0.05, -0.2);
      const cloud = mergeGeometries([c1, c2, c3]);
      c1.dispose();
      c2.dispose();
      c3.dispose();
      if (!cloud) throw new Error("dino look: cloud");

      // 6. Flying pterosaur
      const body = new ConeGeometry(0.14, 0.85, 4);
      body.rotateX(-Math.PI / 2);
      const wings = new BoxGeometry(2.1, 0.04, 0.42);
      wings.translate(0, 0.05, 0);
      const crest = new ConeGeometry(0.08, 0.35, 3);
      crest.rotateX(Math.PI / 3);
      crest.translate(0, 0.12, -0.38);
      const pterosaur = mergeGeometries([body, wings, crest]);
      body.dispose();
      wings.dispose();
      crest.dispose();
      if (!pterosaur) throw new Error("dino look: pterosaur");

      return {
         fern,
         palmTrunk,
         palmFronds,
         rock,
         volcanoSilhouette,
         cloud,
         pterosaur,
      };
   }, []);

   // Geometries disposed on unmount.
   // Primitives carry no dispose={null}: R3F v8 applies props to the object, so dispose={null}
   // would overwrite geometry.dispose and crash on unmount.
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // Quality-scaled spot collections
   const fernsA = useMemo(
      () => asSpots(decorOf("fern", 0).slice(0, scaledCount(decorOf("fern", 0).length, quality.decor))),
      [quality.decor]
   );
   const fernsB = useMemo(
      () => asSpots(decorOf("fern", 1).slice(0, scaledCount(decorOf("fern", 1).length, quality.decor))),
      [quality.decor]
   );
   const palmsA = useMemo(
      () => asSpots(decorOf("palm", 0).slice(0, scaledCount(decorOf("palm", 0).length, quality.decor))),
      [quality.decor]
   );
   const palmsB = useMemo(
      () => asSpots(decorOf("palm", 1).slice(0, scaledCount(decorOf("palm", 1).length, quality.decor))),
      [quality.decor]
   );
   const palmTrunks = useMemo(() => [...palmsA, ...palmsB], [palmsA, palmsB]);

   const rocksA = useMemo(
      () => asSpots(decorOf("rock", 0).slice(0, scaledCount(decorOf("rock", 0).length, quality.decor))),
      [quality.decor]
   );
   const rocksB = useMemo(
      () => asSpots(decorOf("rock", 1).slice(0, scaledCount(decorOf("rock", 1).length, quality.decor))),
      [quality.decor]
   );
   const volcanoes = useMemo(() => asSpots(decorOf("volcanoSilhouette")), []);
   const clouds = useMemo(() => decorOf("cloud"), []);

   const scratch = useMemo(
      () => ({
         p: new Vector3(),
         q: new Quaternion(),
         s: new Vector3(),
         axisY: new Vector3(0, 1, 0),
      }),
      []
   );

   const placeCloud = (i: number, m: Matrix4) => {
      const cloud = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.4) * CLOUD_DRIFT;
      scratch.p.set(cloud.x + drift, cloud.y, cloud.z);
      scratch.q.identity();
      scratch.s.set(cloud.sx, cloud.sy, cloud.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
      return true;
   };

   const placePterosaur = (i: number, m: Matrix4) => {
      const spin = (reduced ? i * 2.1 : time.now * 0.35) + i * ((Math.PI * 2) / PTEROSAURS.count);
      const pos = pterosaurPosition(i, spin);
      scratch.p.set(
         pos.x,
         pos.y + (reduced ? 0 : Math.sin(time.now * 1.6 + i * 1.8) * 0.35),
         pos.z
      );
      // Tangent direction along orbit (faces where it flies)
      scratch.q.setFromAxisAngle(scratch.axisY, -spin);
      scratch.s.set(1, 1, 1);
      m.compose(scratch.p, scratch.q, scratch.s);
      return true;
   };

   return (
      <group name="dino-decor">
         {/* Ferns tone A & B */}
         {fernsA.length > 0 && (
            <Instanced spots={fernsA} name="dino-ferns-a">
               <primitive object={geo.fern} attach="geometry" />
               <meshStandardMaterial color={COLORS.fernA} flatShading roughness={0.7} />
            </Instanced>
         )}
         {fernsB.length > 0 && (
            <Instanced spots={fernsB} name="dino-ferns-b">
               <primitive object={geo.fern} attach="geometry" />
               <meshStandardMaterial color={COLORS.fernB} flatShading roughness={0.7} />
            </Instanced>
         )}

         {/* Palm Trunks */}
         {palmTrunks.length > 0 && (
            <Instanced spots={palmTrunks} name="dino-palm-trunks">
               <primitive object={geo.palmTrunk} attach="geometry" />
               <meshStandardMaterial color={COLORS.palmTrunk} flatShading roughness={0.9} />
            </Instanced>
         )}

         {/* Palm Fronds tone A & B */}
         {palmsA.length > 0 && (
            <Instanced spots={palmsA} name="dino-palm-fronds-a">
               <primitive object={geo.palmFronds} attach="geometry" />
               <meshStandardMaterial color={COLORS.palmLeafA} flatShading roughness={0.7} />
            </Instanced>
         )}
         {palmsB.length > 0 && (
            <Instanced spots={palmsB} name="dino-palm-fronds-b">
               <primitive object={geo.palmFronds} attach="geometry" />
               <meshStandardMaterial color={COLORS.palmLeafB} flatShading roughness={0.7} />
            </Instanced>
         )}

         {/* Volcanic Rocks tone A & B */}
         {rocksA.length > 0 && (
            <Instanced spots={rocksA} name="dino-rocks-a">
               <primitive object={geo.rock} attach="geometry" />
               <meshStandardMaterial color={COLORS.rock} flatShading roughness={0.85} />
            </Instanced>
         )}
         {rocksB.length > 0 && (
            <Instanced spots={rocksB} name="dino-rocks-b">
               <primitive object={geo.rock} attach="geometry" />
               <meshStandardMaterial color={COLORS.volcanoRock} flatShading roughness={0.9} />
            </Instanced>
         )}

         {/* Distant Volcano Silhouettes in horizon */}
         {volcanoes.length > 0 && (
            <Instanced spots={volcanoes} name="dino-volcanoes">
               <primitive object={geo.volcanoSilhouette} attach="geometry" />
               <meshStandardMaterial
                  color={COLORS.volcanoSilhouette}
                  flatShading
                  roughness={1}
               />
            </Instanced>
         )}

         {/* Sunset Drifting Clouds */}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="dino-clouds">
            <primitive object={geo.cloud} attach="geometry" />
            <meshStandardMaterial color={COLORS.cloud} flatShading roughness={1} />
         </DynamicInstanced>

         {/* Flying Pterosaurs */}
         <DynamicInstanced count={PTEROSAURS.count} update={placePterosaur} name="dino-pterosaurs">
            <primitive object={geo.pterosaur} attach="geometry" />
            <meshStandardMaterial color={COLORS.pterosaur} flatShading roughness={0.8} />
         </DynamicInstanced>
      </group>
   );
}
