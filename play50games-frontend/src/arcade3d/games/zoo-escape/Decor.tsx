"use client";

// Zoo Escape's surroundings: low-poly parkland trees, manicured hedges, signposts,
// distant rolling hills, and floating clouds high above. Every piece is strictly OUTSIDE
// the play area, framing the zoo without occluding gameplay.
import { useEffect, useMemo } from "react";
import { Matrix4, Quaternion, Vector3 } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { CLOUD_DRIFT, decorOf, type DecorSpot } from "./looks";
import { cloudPieces, hedgePieces, hillPieces, mergePieces, pinePieces, signpostPieces, treePieces } from "./Primitives";

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

/** `exit`: the map's last gate; the north hedge row leaves the way out through it open. */
export function Decor({ reduced, exit }: { reduced: boolean; exit?: { x0: number; x1: number } }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(
      () => ({
         hedge: mergePieces(hedgePieces()),
         tree: mergePieces(treePieces()),
         pine: mergePieces(pinePieces()),
         signpost: mergePieces(signpostPieces()),
         hill: mergePieces(hillPieces()),
         cloud: mergePieces(cloudPieces()),
      }),
      []
   );

   // Clean up all merged geometries on unmount.
   // Never put dispose={null} on a <primitive attach="geometry"> because R3F v8 overwrites geometry.dispose.
   useEffect(
      () => () => {
         for (const geometry of Object.values(geo)) geometry.dispose();
      },
      [geo]
   );

   const hedges = useMemo(() => {
      const all = decorOf("hedge").filter((h) => !exit || h.z > -45 || h.x < exit.x0 - 2 || h.x > exit.x1 + 2);
      return asSpots(all.slice(0, scaledCount(all.length, quality.decor)));
   }, [quality.decor, exit]);
   const trees = useMemo(
      () => asSpots(decorOf("tree").slice(0, scaledCount(decorOf("tree").length, quality.decor))),
      [quality.decor]
   );
   const pines = useMemo(
      () => asSpots(decorOf("pine").slice(0, scaledCount(decorOf("pine").length, quality.decor))),
      [quality.decor]
   );
   const signposts = useMemo(() => asSpots(decorOf("signpost")), []);
   const hills = useMemo(() => asSpots(decorOf("hill")), []);
   const clouds = useMemo(() => decorOf("cloud"), []);

   const scratch = useMemo(
      () => ({
         p: new Vector3(),
         q: new Quaternion(),
         s: new Vector3(),
      }),
      []
   );

   const placeCloud = (i: number, m: Matrix4) => {
      const c = clouds[i];
      if (!c) return false;
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.5) * CLOUD_DRIFT;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx, c.sy, c.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="zoo-decor">
         {/* Distant rolling hills framing the zoo */}
         {hills.length > 0 && (
            <Instanced spots={hills} name="distant-hills">
               <primitive object={geo.hill} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.9} flatShading />
            </Instanced>
         )}

         {/* Outer perimeter hedges */}
         {hedges.length > 0 && (
            <Instanced spots={hedges} name="outer-hedges">
               <primitive object={geo.hedge} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.85} flatShading />
            </Instanced>
         )}

         {/* Parkland deciduous trees */}
         {trees.length > 0 && (
            <Instanced spots={trees} name="parkland-trees">
               <primitive object={geo.tree} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.85} flatShading />
            </Instanced>
         )}

         {/* Parkland pines */}
         {pines.length > 0 && (
            <Instanced spots={pines} name="parkland-pines">
               <primitive object={geo.pine} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.85} flatShading />
            </Instanced>
         )}

         {/* Directional zoo signposts */}
         {signposts.length > 0 && (
            <Instanced spots={signposts} name="zoo-signposts">
               <primitive object={geo.signpost} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.7} />
            </Instanced>
         )}

         {/* Floating clouds drifting gently in the sky */}
         <DynamicInstanced count={clouds.length} update={placeCloud} name="sky-clouds">
            <primitive object={geo.cloud} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={1} flatShading />
         </DynamicInstanced>
      </group>
   );
}
