"use client";

// A museum pedestal: plinth, column and top slab merged into one mesh (one draw call), the trims
// in a vertex colour. Its top is at y = `height`: put the exhibit there.
//
//    <Pedestal position={[x, 0, z]} height={1} />
//    <Model asset={STATUE} position={[x, PEDESTAL_TOP(1), z]} />
import { forwardRef, useEffect, useMemo } from "react";
import type { GroupProps } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, Color, type BufferGeometry, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface PedestalProps extends Omit<GroupProps, "children"> {
   /** width of the column, m (default 0.8); plinth and slab are a little wider */
   width?: number;
   /** height of the top surface (default 1) */
   height?: number;
   color?: string;
   trim?: string;
}

/** Where an exhibit stands on a pedestal of `height`. */
export const PEDESTAL_TOP = (height = 1) => height;

function piece(w: number, h: number, d: number, y: number, color: Color): BufferGeometry {
   const g = new BoxGeometry(w, h, d).translate(0, y, 0);
   const n = g.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) color.toArray(colors, i * 3);
   g.setAttribute("color", new BufferAttribute(colors, 3));
   return g;
}

export const Pedestal = forwardRef<Group, PedestalProps>(function Pedestal({ width = 0.8, height = 1, color = "#e7e5e4", trim = "#a8a29e", ...group }, ref) {
   const geometry = useMemo(() => {
      const body = new Color(color);
      const edge = new Color(trim);
      const plinth = Math.min(0.14, height * 0.15);
      const slab = Math.min(0.1, height * 0.1);
      const parts = [
         piece(width * 1.25, plinth, width * 1.25, plinth / 2, edge),
         piece(width, Math.max(0.01, height - plinth - slab), width, plinth + (height - plinth - slab) / 2, body),
         piece(width * 1.15, slab, width * 1.15, height - slab / 2, edge),
      ];
      const merged = mergeGeometries(parts, false) ?? parts[1];
      for (const p of parts) if (p !== merged) p.dispose();
      return merged;
   }, [width, height, color, trim]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <group ref={ref} {...group} name="kit-pedestal">
         <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial vertexColors roughness={0.7} />
         </mesh>
      </group>
   );
});
