"use client";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import { Model } from "@/arcade3d/core/assets";
import { EXPANSION_GLB_POINTS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, PACK_OFFSET, VACUUM_SCALE } from "./assets";
import { PackPrimitive } from "./Primitives";

export const HOSE_START = [
   -EXPANSION_GLB_POINTS.vacuumHose.x * VACUUM_SCALE + PACK_OFFSET[0],
   EXPANSION_GLB_POINTS.vacuumHose.y * VACUUM_SCALE + PACK_OFFSET[1],
   -EXPANSION_GLB_POINTS.vacuumHose.z * VACUUM_SCALE + PACK_OFFSET[2],
] as const;
export default function Vacuum() {
   const hose = useMemo(() => new TubeGeometry(new CatmullRomCurve3([
      new Vector3(...HOSE_START), new Vector3(0.35, 0.22, -0.25), new Vector3(0.47, -0.12, -0.13),
      new Vector3(0.47, -0.24, 0.32), new Vector3(0.3, -0.2, 0.7),
   ]), 12, 0.035, 6, false), []);
   useEffect(() => () => hose.dispose(), [hose]);
   return <group>
      <Model asset={ASSETS.vacuum} position={[...PACK_OFFSET]} fallback={<group rotation={[0, Math.PI, 0]}><PackPrimitive /></group>} />
      <mesh geometry={hose}><meshStandardMaterial color="#312e81" roughness={0.85} /></mesh>
   </group>;
}
