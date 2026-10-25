"use client";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type RefObject } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferAttribute, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { EXPANSION_GLB_POINTS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, PACK_OFFSET, VACUUM_SCALE } from "./assets";
import { PackPrimitive } from "./Primitives";

export const HOSE_RADIUS = 0.035;
export const HOSE_TUBULAR_SEGMENTS = 12;
export const HOSE_RADIAL_SEGMENTS = 6;
/** Squared metres. A nozzle that moved less than 0.1 mm does not rebuild the tube. */
export const HOSE_DIRTY_EPS_SQ = 1e-8;
const TANGENT_DELTA = 0.0001;

export const HOSE_START = [
   -EXPANSION_GLB_POINTS.vacuumHose.x * VACUUM_SCALE + PACK_OFFSET[0],
   EXPANSION_GLB_POINTS.vacuumHose.y * VACUUM_SCALE + PACK_OFFSET[1],
   -EXPANSION_GLB_POINTS.vacuumHose.z * VACUUM_SCALE + PACK_OFFSET[2],
] as const;
export const HOSE_ROUTE = [HOSE_START, [-0.48, 0.08, -0.3], [-0.6, -0.32, -0.16], [-0.6, -0.4, 0.35], [-0.3, -0.2, 0.65]] as const;
export interface VacuumHandle { update(): void }

export interface HoseKit {
   curve: CatmullRomCurve3;
   hose: TubeGeometry;
   point: Vector3;
   tangent: Vector3;
   ahead: Vector3;
   behind: Vector3;
   normal: Vector3;
   binormal: Vector3;
   up: Vector3;
   tip: Vector3;
   lastTip: Vector3;
}

export function createHoseKit(): HoseKit {
   const curve = new CatmullRomCurve3(HOSE_ROUTE.map((p) => new Vector3(p[0], p[1], p[2])));
   return {
      curve,
      hose: new TubeGeometry(curve, HOSE_TUBULAR_SEGMENTS, HOSE_RADIUS, HOSE_RADIAL_SEGMENTS, false),
      point: new Vector3(),
      tangent: new Vector3(),
      ahead: new Vector3(),
      behind: new Vector3(),
      normal: new Vector3(),
      binormal: new Vector3(),
      up: new Vector3(0, 1, 0),
      tip: new Vector3(),
      // not a real tip, so the first update always builds the tube once
      lastTip: new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY),
   };
}

/** True when the nozzle tip has moved far enough to change the hose. */
export function hoseShapeDirty(tip: Vector3, lastTip: Vector3): boolean {
   return tip.distanceToSquared(lastTip) > HOSE_DIRTY_EPS_SQ;
}

/** Unit tangent at t, written into `out`. `ahead` and `behind` are scratch; nothing is allocated. */
function writeTangent(curve: CatmullRomCurve3, t: number, out: Vector3, ahead: Vector3, behind: Vector3): void {
   let t1 = t - TANGENT_DELTA;
   let t2 = t + TANGENT_DELTA;
   if (t1 < 0) t1 = 0;
   if (t2 > 1) t2 = 1;
   curve.getPoint(t1, behind);
   curve.getPoint(t2, ahead);
   out.copy(ahead).sub(behind).normalize();
}

/**
 * Rewrites the tube from the nozzle tip. `computeVertexNormals` and `computeBoundingSphere`
 * allocate inside three.js, so they run only when the tip moved. The samples use the kit's
 * scratch vectors (Curve.getTangent would allocate two vectors per ring). Returns whether the
 * shape was rebuilt.
 */
export function syncHose(kit: HoseKit): boolean {
   if (!hoseShapeDirty(kit.tip, kit.lastTip)) return false;
   kit.lastTip.copy(kit.tip);
   kit.curve.points[kit.curve.points.length - 1].copy(kit.tip);
   const positions = kit.hose.getAttribute("position") as BufferAttribute;
   const cols = HOSE_RADIAL_SEGMENTS + 1;
   for (let i = 0; i <= HOSE_TUBULAR_SEGMENTS; i++) {
      const t = i / HOSE_TUBULAR_SEGMENTS;
      kit.curve.getPoint(t, kit.point);
      writeTangent(kit.curve, t, kit.tangent, kit.ahead, kit.behind);
      kit.normal.crossVectors(kit.tangent, kit.up).normalize();
      kit.binormal.crossVectors(kit.tangent, kit.normal).normalize();
      for (let j = 0; j <= HOSE_RADIAL_SEGMENTS; j++) {
         const a = (j / HOSE_RADIAL_SEGMENTS) * Math.PI * 2;
         const c = Math.cos(a) * HOSE_RADIUS;
         const s = Math.sin(a) * HOSE_RADIUS;
         positions.setXYZ(
            i * cols + j,
            kit.point.x + kit.normal.x * c + kit.binormal.x * s,
            kit.point.y + kit.normal.y * c + kit.binormal.y * s,
            kit.point.z + kit.normal.z * c + kit.binormal.z * s,
         );
      }
   }
   positions.needsUpdate = true;
   kit.hose.computeVertexNormals();
   kit.hose.computeBoundingSphere();
   return true;
}

const Vacuum = forwardRef<VacuumHandle, { nozzle: RefObject<Group> }>(function Vacuum({ nozzle }, ref) {
   const root = useRef<Group>(null);
   const kit = useMemo(createHoseKit, []);
   useEffect(() => () => kit.hose.dispose(), [kit]);
   useImperativeHandle(ref, () => ({
      update: () => {
         if (!root.current || !nozzle.current) return;
         nozzle.current.updateWorldMatrix(true, false);
         root.current.updateWorldMatrix(true, false);
         nozzle.current.localToWorld(kit.tip.set(0, 0, 0));
         root.current.worldToLocal(kit.tip);
         syncHose(kit);
      },
   }), [kit, nozzle]);
   return <group ref={root}>
      <Model asset={ASSETS.vacuum} position={[...PACK_OFFSET]} fallback={<group rotation={[0, Math.PI, 0]}><PackPrimitive /></group>} />
      <mesh geometry={kit.hose}><meshStandardMaterial color="#514269" roughness={0.85} /></mesh>
   </group>;
});
export default Vacuum;
