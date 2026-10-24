"use client";

// Surroundings outside the play area: distant Caribbean headlands and cliffs, a distant citadel,
// palm islets with reef rocks and surf rings, circling gulls and drifting tropical clouds.
// Strictly outside PLAY_BOUNDS: nothing sits inside the play area or occludes the view.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   CircleGeometry,
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   Matrix4,
   Quaternion,
   RingGeometry,
   Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import {
   BIRDS,
   CLIFF_SPOTS,
   CLOUD_DRIFT,
   CLOUDS,
   COLORS,
   DISTANT_FORT_SPOT,
   ISLET_SPOTS,
   PALM_DECOR_SPOTS,
   ROCK_SPOTS,
   SURF_SPOTS,
   type DecorSpot,
} from "./looks";

function toSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((s) => ({
      x: s.x,
      y: s.y,
      z: s.z,
      rotY: s.rotY ?? 0,
      sx: s.sx ?? 1,
      sy: s.sy ?? 1,
      sz: s.sz ?? 1,
   }));
}

export function Decor({ reduced }: { reduced: boolean }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Distant cliffs: faceted rock body with a lush green turf cap
      const rockBody = new CylinderGeometry(0.85, 1.25, 1.0, 7).translate(0, 0.5, 0);
      const turfCap = new CylinderGeometry(0.88, 0.9, 0.12, 7).translate(0, 1.04, 0);

      // 2. Distant citadel: fortress rampart + round watchtower with conical roof
      const rampart = new BoxGeometry(5.0, 1.8, 3.2).translate(0, 0.9, 0);
      const tower = new CylinderGeometry(0.7, 0.8, 3.4, 8).translate(1.6, 1.7, 1.0);
      const roof = new ConeGeometry(0.95, 1.2, 8).translate(1.6, 4.0, 1.0);
      const fort = mergeGeometries([rampart, tower, roof]);
      rampart.dispose();
      tower.dispose();
      roof.dispose();
      if (!fort) throw new Error("pirate decor: fort merge");

      // 3. Sandy islet dome
      const islet = new CylinderGeometry(0.75, 1.0, 0.28, 9).translate(0, 0.14, 0);

      // 4. Surf / foam ring around rocks and islets
      const surf = new RingGeometry(0.82, 1.0, 16).rotateX(-Math.PI / 2);

      // 5. Reef boulders
      const rock = new DodecahedronGeometry(0.75, 0).translate(0, 0.45, 0);

      // 6. Tropical coconut palm: curved trunk + layered fronds + coconuts
      const t1 = new CylinderGeometry(0.12, 0.18, 1.2, 6).translate(0, 0.6, 0);
      const t2 = new CylinderGeometry(0.09, 0.12, 1.2, 6).rotateZ(0.1).translate(0.06, 1.75, 0);
      const palmTrunk = mergeGeometries([t1, t2]);
      t1.dispose();
      t2.dispose();
      if (!palmTrunk) throw new Error("pirate decor: palm trunk merge");

      const f1 = new ConeGeometry(1.3, 0.5, 7).rotateX(0.2).translate(0.12, 2.3, 0);
      const f2 = new ConeGeometry(1.1, 0.45, 7).rotateZ(-0.2).translate(0.12, 2.45, 0);
      const palmCrown = mergeGeometries([f1, f2]);
      f1.dispose();
      f2.dispose();
      if (!palmCrown) throw new Error("pirate decor: palm crown merge");

      // 7. Cumulus clouds: merged multi-sphere puffs
      const c1 = new IcosahedronGeometry(0.85, 0).translate(0, 0, 0);
      const c2 = new IcosahedronGeometry(0.65, 0).translate(-0.6, -0.1, 0.2);
      const c3 = new IcosahedronGeometry(0.6, 0).translate(0.65, -0.12, -0.15);
      const c4 = new IcosahedronGeometry(0.5, 0).translate(0.1, 0.4, 0.1);
      const cloud = mergeGeometries([c1, c2, c3, c4]);
      c1.dispose();
      c2.dispose();
      c3.dispose();
      c4.dispose();
      if (!cloud) throw new Error("pirate decor: cloud merge");

      // 8. Seagulls: body + wings
      const birdBody = new ConeGeometry(0.1, 0.45, 4).rotateX(-Math.PI / 2);
      const birdWings = new BoxGeometry(0.65, 0.03, 0.16);
      const bird = mergeGeometries([birdBody, birdWings]);
      birdBody.dispose();
      birdWings.dispose();
      if (!bird) throw new Error("pirate decor: bird merge");

      return {
         rockBody,
         turfCap,
         fort,
         islet,
         surf,
         rock,
         palmTrunk,
         palmCrown,
         cloud,
         bird,
      };
   }, []);

   // Clean up geometries on unmount. Primitives carry no dispose={null}.
   useEffect(
      () => () => {
         for (const geometry of Object.values(geo)) geometry.dispose();
      },
      [geo]
   );

   const cliffs = useMemo(() => toSpots(CLIFF_SPOTS), []);
   const islets = useMemo(() => toSpots(ISLET_SPOTS), []);
   const surfSpots = useMemo(() => toSpots(SURF_SPOTS), []);
   const rocks = useMemo(() => toSpots(ROCK_SPOTS.slice(0, scaledCount(ROCK_SPOTS.length, quality.decor))), [quality.decor]);
   const palms = useMemo(() => toSpots(PALM_DECOR_SPOTS), []);
   const clouds = useMemo(() => toSpots(CLOUDS), []);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
      axis: new Vector3(0, 1, 0),
   }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const c = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.5) * CLOUD_DRIFT;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx ?? 1, c.sy ?? 1, c.sz ?? 1);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   const placeBird = (i: number, m: Matrix4) => {
      const angle = (reduced ? i * 0.5 : time.now * 0.42) + i * ((Math.PI * 2) / BIRDS.count);
      scratch.p.set(
         BIRDS.centerX + Math.cos(angle) * BIRDS.radiusX,
         BIRDS.y + (reduced ? 0 : Math.sin(time.now * 1.5 + i) * 0.35),
         BIRDS.centerZ + Math.sin(angle) * BIRDS.radiusZ
      );
      scratch.q.setFromAxisAngle(scratch.axis, -angle);
      scratch.s.set(1.4, 1.4, 1.4);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="bay-decor">
         {/* Distant headlands and cliffs framing the bay */}
         <Instanced spots={cliffs} name="distant-cliffs">
            <primitive object={geo.rockBody} attach="geometry" />
            <meshStandardMaterial color={COLORS.cliff} flatShading roughness={0.95} />
         </Instanced>
         <Instanced spots={cliffs} name="distant-cliff-turf">
            <primitive object={geo.turfCap} attach="geometry" />
            <meshStandardMaterial color={COLORS.cliffTop} flatShading roughness={0.9} />
         </Instanced>

         {/* Distant cliffside citadel */}
         <mesh position={[DISTANT_FORT_SPOT.x, DISTANT_FORT_SPOT.y, DISTANT_FORT_SPOT.z]} rotation-y={DISTANT_FORT_SPOT.rotY ?? 0} geometry={geo.fort}>
            <meshStandardMaterial color={COLORS.stone} flatShading roughness={0.9} />
         </mesh>

         {/* Outer sandy islets */}
         <Instanced spots={islets} name="outer-islets">
            <primitive object={geo.islet} attach="geometry" />
            <meshStandardMaterial color={COLORS.sand} flatShading roughness={1} />
         </Instanced>

         {/* Surf foam rings */}
         <Instanced spots={surfSpots} name="surf-rings">
            <primitive object={geo.surf} attach="geometry" />
            <meshStandardMaterial color={COLORS.surf} transparent opacity={0.75} roughness={0.5} depthWrite={false} />
         </Instanced>

         {/* Outer reef boulders */}
         {rocks.length > 0 && (
            <Instanced spots={rocks} name="outer-rocks">
               <primitive object={geo.rock} attach="geometry" />
               <meshStandardMaterial color={COLORS.rock} flatShading roughness={1} />
            </Instanced>
         )}

         {/* Palms on outer islets */}
         <Instanced spots={palms} name="outer-palm-trunks">
            <primitive object={geo.palmTrunk} attach="geometry" />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.9} />
         </Instanced>
         <Instanced spots={palms} name="outer-palm-crowns">
            <primitive object={geo.palmCrown} attach="geometry" />
            <meshStandardMaterial color={COLORS.palm} roughness={0.85} />
         </Instanced>

         {/* Drifting cumulus clouds */}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="clouds">
            <primitive object={geo.cloud} attach="geometry" />
            <meshStandardMaterial color={COLORS.cloud} flatShading roughness={0.9} />
         </DynamicInstanced>

         {/* Circling seagulls (skipped on low tier) */}
         {quality.tier !== "low" && (
            <DynamicInstanced count={BIRDS.count} update={placeBird} name="seagulls">
               <primitive object={geo.bird} attach="geometry" />
               <meshStandardMaterial color={COLORS.bird} flatShading roughness={0.7} />
            </DynamicInstanced>
         )}
      </group>
   );
}
