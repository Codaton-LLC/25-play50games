"use client";

// A faceted gem: a flat-shaded icosahedron with a soft glow and bright edges, spinning and bobbing
// on the run's pause-safe clock. Two draw calls (one without edges on the "low" tier); for dozens
// of gems at once, draw <DynamicInstanced> with GEM_GEOMETRY_DETAIL instead.
//
//    <Gem position={[x, 0.5, z]} color="#22d3ee" size={0.3} />
import { forwardRef, useEffect, useMemo, useRef } from "react";
import { useFrame, type GroupProps } from "@react-three/fiber";
import { Color, EdgesGeometry, IcosahedronGeometry, type Group } from "three";
import { useGameTime } from "../gameTime";
import { useQuality } from "../quality";
import { FRAME_PRIORITY } from "../frameLoop";

export interface GemProps extends Omit<GroupProps, "children"> {
   /** radius, m (default 0.3) */
   size?: number;
   color?: string;
   /** rad per second (default 1.2; 0 = still) */
   spin?: number;
   /** bob height, m (default 0.05) */
   bob?: number;
   /** glow 0..1 (default 0.35) */
   glow?: number;
   /** spin and bob phase, rad (default 0): give neighbours different ones */
   phase?: number;
}

/** An icosahedron of detail 0: 20 facets. */
export const GEM_GEOMETRY_DETAIL = 0;

export const Gem = forwardRef<Group, GemProps>(function Gem({ size = 0.3, color = "#22d3ee", spin = 1.2, bob = 0.05, glow = 0.35, phase = 0, ...group }, ref) {
   const quality = useQuality();
   const time = useGameTime();
   const geo = useMemo(() => {
      const body = new IcosahedronGeometry(1, GEM_GEOMETRY_DETAIL);
      // a gem cut: a little taller than wide
      body.scale(1, 1.25, 1);
      return { body, edges: new EdgesGeometry(body, 1) };
   }, []);
   useEffect(
      () => () => {
         geo.body.dispose();
         geo.edges.dispose();
      },
      [geo]
   );
   const emissive = useMemo(() => new Color(color).multiplyScalar(glow), [color, glow]);
   const edge = useMemo(() => new Color(color).lerp(new Color(1, 1, 1), 0.6), [color]);
   const inner = useRef<Group>(null);
   useFrame(() => {
      const g = inner.current;
      if (!g) return;
      g.rotation.y = time.now * spin + phase;
      g.position.y = Math.sin(time.now * 2 + phase) * bob;
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref} {...group} name="kit-gem">
         <group ref={inner} scale={size}>
            <mesh geometry={geo.body} castShadow>
               <meshStandardMaterial color={color} emissive={emissive} roughness={0.18} metalness={0.15} flatShading />
            </mesh>
            {quality.tier !== "low" && (
               <lineSegments geometry={geo.edges}>
                  <lineBasicMaterial color={edge} transparent opacity={0.85} toneMapped={false} />
               </lineSegments>
            )}
         </group>
      </group>
   );
});
