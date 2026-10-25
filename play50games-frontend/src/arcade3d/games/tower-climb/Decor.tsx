"use client";

// Sky, distant mountains and instanced scenery. Everything here is behind the play column
// (looks.ts) and follows the climb anchor, so the frame stays full at every height.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, Group, IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { useLevel } from "@/arcade3d/core/level";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { TowerLevel } from "./levels";
import {
   BIRD_BOB, BIRDS, CLOUD_DRIFT, CLOUDS, COLORS, LEVEL_LOOKS, ROCK_RADIUS, SKY_RADIUS,
   buildBackdrop, decorOf, type DecorSpot,
} from "./looks";
import type { TowerRun } from "./rules";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({ x: spot.x, y: spot.y, z: spot.z, rotY: spot.rotY, sx: spot.sx, sy: spot.sy, sz: spot.sz }));
}

/** Sky dome, a mountain wall under and beside the tower, clouds, floating rocks and a far flock. */
export function Decor({ run, reduced }: { run: TowerRun; reduced: boolean }) {
   const { id } = useLevel<TowerLevel>();
   const look = LEVEL_LOOKS[id];
   const quality = useQuality();
   const time = useGameTime();
   const anchor = useRef<Group>(null);
   const geo = useMemo(() => {
      const puffA = new IcosahedronGeometry(0.62, 0);
      const puffB = new IcosahedronGeometry(0.5, 0).translate(0.36, -0.06, 0.08);
      const puffC = new IcosahedronGeometry(0.46, 0).translate(-0.32, 0.04, -0.06);
      const cloud = mergeGeometries([puffA, puffB, puffC]);
      puffA.dispose(); puffB.dispose(); puffC.dispose();
      if (!cloud) throw new Error("tower look: cloud");
      const body = new ConeGeometry(0.12, 0.48, 5);
      body.rotateX(-Math.PI / 2);
      const wings = new BoxGeometry(0.7, 0.04, 0.16);
      const bird = mergeGeometries([body, wings]);
      body.dispose(); wings.dispose();
      if (!bird) throw new Error("tower look: bird");
      const data = buildBackdrop();
      const mountains = new BufferGeometry();
      mountains.setAttribute("position", new BufferAttribute(data.positions, 3));
      mountains.setAttribute("color", new BufferAttribute(data.colors, 3));
      mountains.computeVertexNormals();
      return { cloud, rock: new IcosahedronGeometry(ROCK_RADIUS, 0), bird, mountains };
   }, []);
   // the primitives below carry no dispose={null}: R3F v8 applies a primitive's props to its object, so
   // dispose={null} would overwrite geometry.dispose with null and this cleanup would throw on unmount
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   const clouds = useMemo(() => CLOUDS.slice(0, scaledCount(CLOUDS.length, quality.decor)), [quality.decor]);
   const rocks = useMemo(() => asSpots(decorOf("rock").slice(0, scaledCount(decorOf("rock").length, quality.decor))), [quality.decor]);
   const rocksDark = useMemo(() => asSpots(decorOf("rockDark").slice(0, scaledCount(decorOf("rockDark").length, quality.decor))), [quality.decor]);
   const scratch = useMemo(() => ({ p: new Vector3(), q: new Quaternion(), s: new Vector3(), axis: new Vector3(0, 1, 0) }), []);

   useFrame(() => {
      if (anchor.current) anchor.current.position.y = run.maxHeight;
   });

   const placeCloud = (i: number, m: Matrix4) => {
      const cloud = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.7) * CLOUD_DRIFT;
      scratch.p.set(cloud.x + drift, cloud.y, cloud.z);
      scratch.q.identity();
      scratch.s.set(cloud.sx, cloud.sy, cloud.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };
   const placeBird = (i: number, m: Matrix4) => {
      const spin = (reduced ? i * 0.7 : time.now * 0.35) + i * ((Math.PI * 2) / BIRDS.count);
      const bob = reduced ? 0 : Math.sin(time.now * 1.4 + i) * BIRD_BOB;
      scratch.p.set(
         BIRDS.x + Math.cos(spin) * BIRDS.radiusX,
         BIRDS.y + bob,
         BIRDS.z + Math.sin(spin) * BIRDS.radiusZ,
      );
      scratch.q.setFromAxisAngle(scratch.axis, -spin);
      scratch.s.set(1, 1, 1);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <>
         <SkyDome top={look.skyTop} bottom={look.sky} offset={0.08} exponent={0.72} radius={SKY_RADIUS} />
         <group ref={anchor} name="tower-surround">
            <mesh geometry={geo.mountains} dispose={null} frustumCulled={false} name="tower-mountains">
               <meshStandardMaterial vertexColors flatShading roughness={1} />
            </mesh>
            <DynamicInstanced count={clouds.length} update={placeCloud} name="tower-clouds">
               <primitive object={geo.cloud} attach="geometry" />
               <meshStandardMaterial color={COLORS.cloud} flatShading roughness={1} />
            </DynamicInstanced>
            {rocks.length > 0 && (
               <Instanced spots={rocks} name="tower-rocks">
                  <primitive object={geo.rock} attach="geometry" />
                  <meshStandardMaterial color={COLORS.rock} flatShading roughness={1} />
               </Instanced>
            )}
            {rocksDark.length > 0 && (
               <Instanced spots={rocksDark} name="tower-rocks-dark">
                  <primitive object={geo.rock} attach="geometry" />
                  <meshStandardMaterial color={COLORS.rockDark} flatShading roughness={1} />
               </Instanced>
            )}
            <DynamicInstanced count={BIRDS.count} update={placeBird} name="tower-birds">
               <primitive object={geo.bird} attach="geometry" />
               <meshStandardMaterial color={COLORS.bird} flatShading roughness={1} />
            </DynamicInstanced>
         </group>
      </>
   );
}
