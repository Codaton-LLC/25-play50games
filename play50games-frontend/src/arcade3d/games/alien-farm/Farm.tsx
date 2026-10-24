"use client";

// The moonlit crater farm: dusk sky, stars and moon (core/env), the soil out to the horizon, a low
// crater rim, nine raised beds with glowing irrigation channels, purple rocks and crates. Static:
// every repeated piece is instanced (about 10 draw calls for the whole set).
import { useEffect, useMemo } from "react";
import { LatheGeometry, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { InstancedModel } from "@/arcade3d/core/assets";
import { SkyDome, Starfield } from "@/arcade3d/core/env";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { COLORS, HEIGHTS } from "./looks";
import { CratePrimitives, RockPrimitives } from "./Primitives";
import { FARM, PLOTS } from "./rules";

const BED_SPOTS: InstanceSpot[] = PLOTS.map((p) => ({ x: p.x, y: 0, z: p.z }));
/** Channels between neighbouring beds (x runs and z runs), drawn as thin glowing strips. */
const CHANNELS: InstanceSpot[] = [
   ...[-4, 0, 4].flatMap((z) => [-2.5, 2.5].map((x) => ({ x, y: HEIGHTS.channel, z, sx: 3.0, sy: 1, sz: 0.12 }))),
   ...[-5, 0, 5].flatMap((x) => [-2, 2].map((z) => ({ x, y: HEIGHTS.channel, z, sx: 0.12, sy: 1, sz: 2.2 }))),
];
const ROCKS: InstanceSpot[] = [-7, 0, 7].flatMap((z, i) => [-12, 12].map((x, j) => ({ x, y: 0, z, rotY: i * 1.3 + j * 2.1, scale: 0.85 + 0.15 * ((i + j) % 2) })));
const CRATES: InstanceSpot[] = [
   { x: -11.8, y: 0, z: 8.8, rotY: 0.2 },
   { x: -10.8, y: 0, z: 9.2, rotY: -0.4 },
   { x: -11.8, y: 0, z: 7.8, rotY: 0.9 },
];

function Beds() {
   const geo = useMemo(() => {
      const s = FARM.bedHalf * 2;
      return {
         body: new RoundedBoxGeometry(s, FARM.bedTopY * 2, s, 2, 0.06).translate(0, 0, 0),
         top: new RoundedBoxGeometry(s - 0.24, 0.04, s - 0.24, 1, 0.02).translate(0, FARM.bedTopY + 0.001, 0),
         channel: new RoundedBoxGeometry(1, 0.02, 1, 1, 0.005),
      };
   }, []);
   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
   return (
      <group name="beds">
         <Instanced spots={BED_SPOTS} name="bed-body">
            <primitive object={geo.body} attach="geometry" />
            <meshStandardMaterial color={COLORS.bed} roughness={0.9} />
         </Instanced>
         <Instanced spots={BED_SPOTS} name="bed-soil">
            <primitive object={geo.top} attach="geometry" />
            <meshStandardMaterial color={COLORS.bedTop} roughness={1} />
         </Instanced>
         <Instanced spots={CHANNELS} name="channels">
            <primitive object={geo.channel} attach="geometry" />
            <meshStandardMaterial color={COLORS.soilDark} emissive={COLORS.channel} emissiveIntensity={0.35} roughness={0.4} />
         </Instanced>
      </group>
   );
}

function Ground() {
   // a low crater rim (lathe) around the 26 x 20 farm; the soil disc runs to the fogged horizon
   const rim = useMemo(
      () => new LatheGeometry([new Vector2(15.5, -0.01), new Vector2(16.5, 0.45), new Vector2(17.4, 0.7), new Vector2(18.6, 0.4), new Vector2(20.5, -0.01)], 64),
      [],
   );
   useEffect(() => () => rim.dispose(), [rim]);
   return (
      <group name="ground">
         <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <circleGeometry args={[90, 48]} />
            <meshStandardMaterial color={COLORS.soil} roughness={1} />
         </mesh>
         <mesh geometry={rim} scale={[1, 1, 0.82]}>
            <meshStandardMaterial color={COLORS.rim} roughness={0.95} />
         </mesh>
      </group>
   );
}

export function FarmScene() {
   const { particles } = useQuality();
   return (
      <group name="farm">
         <SkyDome top={COLORS.skyTop} bottom={COLORS.skyBottom} offset={-0.02} exponent={0.7} />
         <Starfield count={scaledCount(600, particles)} seed={21} upperOnly size={2} />
         <mesh position={[-20, 18, -35]}>
            <sphereGeometry args={[6, 32, 20]} />
            <meshBasicMaterial color={COLORS.moon} fog={false} />
         </mesh>
         <Ground />
         <Beds />
         <InstancedModel asset={ASSETS.rock} spots={ROCKS} fallback={<RockPrimitives spots={ROCKS} />} />
         <InstancedModel asset={ASSETS.crate} spots={CRATES} fallback={<CratePrimitives spots={CRATES} />} />
      </group>
   );
}
