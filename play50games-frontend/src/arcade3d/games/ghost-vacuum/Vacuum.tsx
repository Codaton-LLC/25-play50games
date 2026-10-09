"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type RefObject } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { EXPANSION_GLB_POINTS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, PACK_OFFSET, VACUUM_SCALE } from "./assets";
import { PackPrimitive } from "./Primitives";

export const HOSE_RADIUS = 0.035;
export const HOSE_START = [
   -EXPANSION_GLB_POINTS.vacuumHose.x * VACUUM_SCALE + PACK_OFFSET[0],
   EXPANSION_GLB_POINTS.vacuumHose.y * VACUUM_SCALE + PACK_OFFSET[1],
   -EXPANSION_GLB_POINTS.vacuumHose.z * VACUUM_SCALE + PACK_OFFSET[2],
] as const;
export const HOSE_ROUTE = [HOSE_START, [-0.48, 0.08, -0.3], [-0.6, -0.32, -0.16], [-0.6, -0.4, 0.35], [-0.3, -0.2, 0.65]] as const;
export interface VacuumHandle { update(): void }
const Vacuum = forwardRef<VacuumHandle, { nozzle: RefObject<Group> }>(function Vacuum({ nozzle }, ref) {
   const root = useRef<Group>(null);
   const kit = useMemo(() => {
      const curve = new CatmullRomCurve3(HOSE_ROUTE.map((p) => new Vector3(...p)));
      return { curve, hose: new TubeGeometry(curve, 12, HOSE_RADIUS, 6, false), point: new Vector3(), tangent: new Vector3(), normal: new Vector3(), binormal: new Vector3(), up: new Vector3(0, 1, 0), tip: new Vector3() };
   }, []);
   useEffect(() => () => kit.hose.dispose(), [kit]);
   useImperativeHandle(ref, () => ({ update: () => {
      if (!root.current || !nozzle.current) return;
      nozzle.current.updateWorldMatrix(true, false);
      root.current.updateWorldMatrix(true, false);
      nozzle.current.localToWorld(kit.tip.set(0, 0, 0));
      root.current.worldToLocal(kit.tip);
      kit.curve.points[4].copy(kit.tip);
      const positions = kit.hose.getAttribute("position");
      for (let i = 0; i <= 12; i++) {
         kit.curve.getPoint(i / 12, kit.point);
         kit.curve.getTangent(i / 12, kit.tangent);
         kit.normal.crossVectors(kit.tangent, kit.up).normalize();
         kit.binormal.crossVectors(kit.tangent, kit.normal).normalize();
         for (let j = 0; j <= 6; j++) {
            const a = j / 6 * Math.PI * 2, c = Math.cos(a) * HOSE_RADIUS, s = Math.sin(a) * HOSE_RADIUS;
            positions.setXYZ(i * 7 + j, kit.point.x + kit.normal.x * c + kit.binormal.x * s, kit.point.y + kit.normal.y * c + kit.binormal.y * s, kit.point.z + kit.normal.z * c + kit.binormal.z * s);
         }
      }
      positions.needsUpdate = true;
      kit.hose.computeVertexNormals();
      kit.hose.computeBoundingSphere();
   } }), [kit, nozzle]);
   return <group ref={root}>
      <Model asset={ASSETS.vacuum} position={[...PACK_OFFSET]} fallback={<group rotation={[0, Math.PI, 0]}><PackPrimitive /></group>} />
      <mesh geometry={kit.hose}><meshStandardMaterial color="#514269" roughness={0.85} /></mesh>
   </group>;
});
export default Vacuum;
