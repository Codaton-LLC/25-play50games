"use client";

// The crater farm: dusk sky, starry field, low-poly distant hills,
// flat plum soil disc out to the horizon, purple beds with dark teal furrows, and surroundings decor.
import { useEffect, useMemo } from "react";
import { CylinderGeometry } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { Decor } from "./Decor";
import {
   COLORS,
   HEIGHTS,
   coloredGeometry,
   hillMesh,
} from "./looks";
import { FARM, PLOTS } from "./rules";

const BED_SPOTS: InstanceSpot[] = PLOTS.map((p) => ({ x: p.x, y: 0, z: p.z }));

/** Channels between neighbouring beds (x runs and z runs), drawn as thin glowing conduits. */
const CHANNELS: InstanceSpot[] = [
   ...[-4, 0, 4].flatMap((z) =>
      [-2.5, 2.5].map((x) => ({ x, y: HEIGHTS.channel, z, sx: 3.0, sy: 1, sz: 0.14 }))
   ),
   ...[-5, 0, 5].flatMap((x) =>
      [-2, 2].map((z) => ({ x, y: HEIGHTS.channel, z, sx: 0.14, sy: 1, sz: 2.2 }))
   ),
];

function Beds() {
   const geo = useMemo(() => {
      const s = FARM.bedHalf * 2;
      // 1. Bed planter frame
      const frame = new RoundedBoxGeometry(s, 0.1, s, 2, 0.05).translate(0, 0.05, 0);

      // 2. Inner soil bed slab
      const soil = new RoundedBoxGeometry(s - 0.24, 0.04, s - 0.24, 2, 0.02).translate(
         0,
         0.08,
         0
      );

      // 3. Soft furrows: 3 parallel rounded ridges along z in each bed
      const f1 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(-0.38, 0.1, 0);
      const f2 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(0, 0.1, 0);
      const f3 = new CylinderGeometry(0.11, 0.11, s - 0.28, 8)
         .rotateX(Math.PI / 2)
         .scale(1, 0.25, 1)
         .translate(0.38, 0.1, 0);

      const furrows = mergeGeometries([f1, f2, f3]);
      f1.dispose();
      f2.dispose();
      f3.dispose();
      if (!furrows) throw new Error("alien-farm look: furrows");

      // 4. Glowing irrigation channel conduit
      const channel = new RoundedBoxGeometry(1, 0.024, 1, 1, 0.005);

      return {
         frame,
         soil,
         furrows,
         channel,
      };
   }, []);

   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);

   return (
      <group name="beds">
         {/* Planter frame in rich purple */}
         <Instanced spots={BED_SPOTS} name="bed-frame">
            <primitive object={geo.frame} attach="geometry" />
            <meshStandardMaterial color={COLORS.bed} roughness={0.85} />
         </Instanced>

         {/* Soil bed base in rich plum soil */}
         <Instanced spots={BED_SPOTS} name="bed-soil-base">
            <primitive object={geo.soil} attach="geometry" />
            <meshStandardMaterial color={COLORS.bedSoil} roughness={0.95} />
         </Instanced>

         {/* Soft furrow ridges in deep dark teal for strong crop contrast */}
         <Instanced spots={BED_SPOTS} name="bed-furrows">
            <primitive object={geo.furrows} attach="geometry" />
            <meshStandardMaterial color={COLORS.furrowRidge} roughness={0.8} />
         </Instanced>

         {/* Glowing irrigation channels linking the plots */}
         <Instanced spots={CHANNELS} name="channels">
            <primitive object={geo.channel} attach="geometry" />
            <meshStandardMaterial
               color={COLORS.soilDark}
               emissive={COLORS.channel}
               emissiveIntensity={0.45}
               roughness={0.4}
            />
         </Instanced>
      </group>
   );
}

function Ground() {
   // Distant hills mesh: low-poly rolling terrain outside the farm (north and flanks)
   const hills = useMemo(() => coloredGeometry(hillMesh()), []);

   useEffect(() => () => {
      hills.dispose();
   }, [hills]);

   return (
      <group name="ground">
         {/* Wide ground soil disc extending out to radius 90 in plum to prevent any void below the scene */}
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} name="soil-plane">
            <circleGeometry args={[90, 48]} />
            <meshStandardMaterial color={COLORS.soil} roughness={1} />
         </mesh>

         {/* Distant low-poly alien hills */}
         <mesh geometry={hills} name="distant-hills">
            <meshStandardMaterial vertexColors flatShading roughness={0.95} />
         </mesh>
      </group>
   );
}

export function FarmScene() {
   const { particles } = useQuality();

   return (
      <group name="farm">
         {/* Whimsical sunset sky dome */}
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} offset={-0.02} exponent={0.7} />
         <Starfield count={scaledCount(700, particles)} seed={21} upperOnly size={2} />
         <Ground />
         <Beds />
         <Decor />
      </group>
   );
}
