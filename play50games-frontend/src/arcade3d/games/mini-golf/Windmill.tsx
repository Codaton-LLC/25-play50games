"use client";

// Hole 4's windmill: the GLB (2.2 m, tunnel along z) and the procedural sails turning at the
// rules' angle (course WINDMILL): four 1.10 x 0.30 sails on spars in the plane z = bladeZ, about
// the hub; an axle joins them to the GLB's hub boss. One merged mesh for the sails.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BoxGeometry, Color, Float32BufferAttribute, type BufferGeometry, type Group } from "three";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS, WINDMILL_HUB } from "./assets";
import type { Hole } from "./course";
import { COLORS } from "./looks";
import { WindmillPrimitive } from "./Primitives";
import { TICK_S, type RunState } from "./rules";

function painted(g: BufferGeometry, color: string): BufferGeometry {
   const c = new Color(color);
   const n = g.getAttribute("position").count;
   const col = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
   g.setAttribute("color", new Float32BufferAttribute(col, 3));
   return g;
}

/** The four sails (pointing down = angle 0, along -y from the hub) and their spars. */
export function buildSails(length: number, halfWidth: number): BufferGeometry {
   const parts: BufferGeometry[] = [];
   for (let k = 0; k < 4; k++) {
      const sail = painted(new BoxGeometry(halfWidth * 2, length - 0.2, 0.025), COLORS.blade);
      sail.translate(0, -(0.2 + (length - 0.2) / 2), 0);
      sail.rotateZ((k * Math.PI) / 2);
      const spar = painted(new BoxGeometry(0.05, length, 0.04), COLORS.spar);
      spar.translate(0, -length / 2, 0.02);
      spar.rotateZ((k * Math.PI) / 2);
      parts.push(sail, spar);
   }
   const merged = mergeGeometries(parts)!;
   parts.forEach((p) => p.dispose());
   return merged;
}

export function Windmill({ hole, run }: { hole: Hole; run: RunState }) {
   const w = hole.windmill!;
   const sails = useRef<Group>(null);
   const geometry = useMemo(() => buildSails(w.length, w.halfWidth), [w.length, w.halfWidth]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   useFrame(() => {
      if (!sails.current) return;
      const live = run.course[run.hole] === hole;
      const t = live ? run.holeTicks * TICK_S + run.clock.acc : 0;
      // the blade at angle phi from straight down points along (sin phi, -cos phi): rotation about +z by phi
      sails.current.rotation.z = w.phase + w.omega * t;
   });
   const axle = w.bladeZ - WINDMILL_HUB.z;
   return (
      <group name="windmill">
         <Model asset={ASSETS.windmill} fallback={<WindmillPrimitive />} />
         <mesh position={[0, w.hubY, WINDMILL_HUB.z + axle / 2]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, axle, 8]} />
            <meshStandardMaterial color={COLORS.spar} />
         </mesh>
         <group ref={sails} position={[0, w.hubY, w.bladeZ]}>
            <mesh geometry={geometry}>
               <meshStandardMaterial vertexColors roughness={0.7} />
            </mesh>
         </group>
      </group>
   );
}
