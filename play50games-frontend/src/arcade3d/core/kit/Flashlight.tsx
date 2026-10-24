"use client";

// A flashlight / guard's torch whose light is exactly its vision cone: the lit fan on the floor is
// the set of points ai/vision inViewCone(origin, yaw, halfAngle, range, point) sees, so what the
// player sees lit is what the guard sees.
//
//    const torch = useRef<Group>(null);
//    useRunFrame(() => { torch.current!.position.set(g.x, 0, g.z); torch.current!.rotation.y = g.yaw; });
//    <Flashlight ref={torch} halfAngle={GUARD_FOV / 2} range={GUARD_RANGE} />
//    // rules.ts: inViewCone({ x: g.x, y: 0, z: g.z }, g.yaw, GUARD_FOV / 2, GUARD_RANGE, player)
//
// - The group is the guard's feet on the floor: rotation.y = yaw (yaw 0 faces +z, positive yaw
//   turns towards +x, as inViewCone). The lamp sits `height` above it.
// - Drawn: an additive fan sheet from the lamp down to the floor arc, and the lit sector on the
//   floor (additive, brightest near the guard). Two draw calls.
// - `light` adds a real SpotLight (shadows off) with the same angle and range. A light changes
//   every material's shader, so it is decided once at mount: skipped on the "low" quality tier;
//   keep the number of flashlights fixed for the whole run.
// - `blockers` clips the floor sector and the beam each frame (occludedFanPoints) from the group's
//   world position and yaw, so the lit floor is inViewCone and hasLineOfSightXZ (the box the guard
//   stands in excluded). It runs in a plain useFrame: move the group in useRunFrame or at a priority
//   below FRAME_PRIORITY.visuals, or the clip shows the previous frame's pose. The group and its
//   parents must only move and turn about y (no scale, tilt or roll). The SpotLight is not clipped.
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type ForwardedRef } from "react";
import { useFrame, type GroupProps } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Object3D, type Group } from "three";
import type { Box } from "../ai/vision";
import { useQuality } from "../quality";
import { fanPoints, fanSegments, occludedFanPoints } from "./kitGeometry";

export interface FlashlightProps extends Omit<GroupProps, "children"> {
   /** half the cone's opening, rad (inViewCone's halfAngle); at most PI / 2 */
   halfAngle: number;
   /** how far it sees, m (inViewCone's range) */
   range: number;
   /** lamp height above the group (default 1.3) */
   height?: number;
   color?: string;
   /** brightness of the drawn beam and floor sector, 0..1 (default 0.35) */
   opacity?: number;
   /** add a real SpotLight (default true; never on the "low" tier) */
   light?: boolean;
   /** the SpotLight's intensity (default 18) */
   intensity?: number;
   /** XZ boxes that stop the light (ai/vision Box); read every frame. Omitted: the open fan */
   blockers?: readonly Box[];
}

const FLOOR_Y = 0.015;

// fanGeometries, clipFan and unclipFan are exported for occludedFan.test.ts
export function fanGeometries(halfAngle: number, range: number, height: number) {
   const half = Math.min(Math.PI / 2, Math.max(0, halfAngle));
   const n = fanSegments(half);
   const pts = fanPoints(half, range, height, n);
   // the beam: apex -> floor arc, bright at the lamp, fading to the floor
   const beam = new BufferGeometry();
   const beamPos = new Float32Array(pts);
   const beamCol = new Float32Array((n + 2) * 4);
   beamCol.set([1, 1, 1, 0.55], 0);
   for (let i = 1; i < n + 2; i++) beamCol.set([1, 1, 1, 0.05], i * 4);
   const beamIndex: number[] = [];
   for (let i = 0; i < n; i++) beamIndex.push(0, i + 1, i + 2);
   beam.setAttribute("position", new BufferAttribute(beamPos, 3));
   beam.setAttribute("color", new BufferAttribute(beamCol, 4));
   beam.setIndex(beamIndex);
   beam.computeBoundingSphere();
   // the floor sector: centre (the guard) -> arc, just above the floor
   const floor = new BufferGeometry();
   const floorPos = new Float32Array(pts);
   floorPos[1] = 0;
   for (let i = 0; i < n + 2; i++) floorPos[i * 3 + 1] = FLOOR_Y;
   const floorCol = new Float32Array((n + 2) * 4);
   floorCol.set([1, 1, 1, 0.9], 0);
   for (let i = 1; i < n + 2; i++) floorCol.set([1, 1, 1, 0.35], i * 4);
   floor.setAttribute("position", new BufferAttribute(floorPos, 3));
   floor.setAttribute("color", new BufferAttribute(floorCol, 4));
   floor.setIndex(beamIndex);
   floor.computeBoundingSphere();
   return { beam, floor, pts, n, half, clip: new Float32Array(pts.length), origin: { x: 0, y: 0, z: 0 }, clipped: false };
}

export type FanGeometries = ReturnType<typeof fanGeometries>;

/** Writes the clipped fan into both position buffers (the beam's apex stays at the lamp). */
export function clipFan(geo: FanGeometries, range: number, height: number, blockers: readonly Box[], m: ArrayLike<number>) {
   geo.origin.x = m[12];
   geo.origin.y = m[13];
   geo.origin.z = m[14];
   // the group's local +z in world space: (sin yaw, ., cos yaw)
   occludedFanPoints(geo.origin, Math.atan2(m[8], m[10]), geo.half, range, blockers, geo.n, geo.clip);
   const beam = geo.beam.attributes.position as BufferAttribute;
   const floor = geo.floor.attributes.position as BufferAttribute;
   const bp = beam.array as Float32Array;
   const fp = floor.array as Float32Array;
   for (let i = 1; i < geo.n + 2; i++) {
      const o = i * 3;
      bp[o] = fp[o] = geo.clip[o];
      bp[o + 2] = fp[o + 2] = geo.clip[o + 2];
   }
   beam.needsUpdate = true;
   floor.needsUpdate = true;
   if (!geo.clipped) {
      // fixed bounds for any clip: no computeBoundingSphere per frame
      geo.clipped = true;
      for (const g of [geo.beam, geo.floor]) {
         g.boundingSphere!.center.set(0, 0, 0);
         g.boundingSphere!.radius = Math.max(range, height);
      }
   }
}

/** Back to the open fan (blockers removed). */
export function unclipFan(geo: FanGeometries) {
   geo.clipped = false;
   for (const g of [geo.beam, geo.floor]) {
      const attr = g.attributes.position as BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 1; i < geo.n + 2; i++) {
         arr[i * 3] = geo.pts[i * 3];
         arr[i * 3 + 2] = geo.pts[i * 3 + 2];
      }
      attr.needsUpdate = true;
      g.computeBoundingSphere();
   }
}

function setRef<T>(ref: ForwardedRef<T>, value: T | null) {
   if (typeof ref === "function") ref(value);
   else if (ref) ref.current = value;
}

export const Flashlight = forwardRef<Group, FlashlightProps>(function Flashlight(
   { halfAngle, range, height = 1.3, color = "#fef3c7", opacity = 0.35, light = true, intensity = 18, blockers, ...group },
   ref
) {
   const quality = useQuality();
   // decided once: adding or removing a light recompiles every material
   const [withLight] = useState(() => light && quality.tier !== "low");
   const geo = useMemo(() => fanGeometries(halfAngle, range, height), [halfAngle, range, height]);
   useEffect(
      () => () => {
         geo.beam.dispose();
         geo.floor.dispose();
      },
      [geo]
   );
   const target = useMemo(() => new Object3D(), []);
   const self = useRef<Group | null>(null);
   const groupRef = useCallback(
      (g: Group | null) => {
         self.current = g;
         setRef(ref, g);
      },
      [ref]
   );
   useFrame(() => {
      const g = self.current;
      if (!g) return;
      if (blockers) {
         g.updateWorldMatrix(true, false);
         clipFan(geo, range, height, blockers, g.matrixWorld.elements);
      } else if (geo.clipped) unclipFan(geo);
   });
   return (
      <group ref={groupRef} {...group} name="kit-flashlight">
         <mesh geometry={geo.beam} renderOrder={2}>
            <meshBasicMaterial color={color} vertexColors transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} fog={false} />
         </mesh>
         <mesh geometry={geo.floor} renderOrder={1}>
            <meshBasicMaterial color={color} vertexColors transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
         </mesh>
         {withLight && (
            <>
               <primitive object={target} position={[0, 0, range * 0.75]} />
               <spotLight
                  position={[0, height, 0]}
                  target={target}
                  angle={Math.min(Math.PI / 2, halfAngle)}
                  distance={Math.hypot(range, height) * 1.05}
                  penumbra={0.35}
                  decay={1.2}
                  intensity={intensity}
                  color={color}
               />
            </>
         )}
      </group>
   );
});
