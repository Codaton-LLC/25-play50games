"use client";

// A fence along a core/path Path: posts every `spacing` m and rails between them, all instanced
// (two draw calls for the whole fence, whatever its length). Static: built once per path.
//
//    const PEN = createPath([{ x: -5, y: 0, z: -5 }, { x: 5, y: 0, z: -5 }, { x: 5, y: 0, z: 5 }], { closed: true });
//    <Fence path={PEN} spacing={1.6} height={1.1} color="#a16207" />
//
// Collision stays in rules.ts (e.g. the path's segments as walls); the fence only draws them.
import { useMemo } from "react";
import type { Path } from "../path";
import { Instanced } from "../render/Instanced";
import { fenceSpots, type FenceOptions } from "./kitGeometry";

export interface FenceProps extends FenceOptions {
   path: Path;
   /** posts colour; rails default to the same */
   color?: string;
   railColor?: string;
}

export function Fence({ path, spacing, height, rails, postSize, railSize, color = "#92400e", railColor }: FenceProps) {
   const spots = useMemo(() => fenceSpots(path, { spacing, height, rails, postSize, railSize }), [path, spacing, height, rails, postSize, railSize]);
   return (
      <group name="kit-fence">
         <Instanced spots={spots.posts} name="kit-fence-posts">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={color} roughness={0.8} />
         </Instanced>
         {spots.rails.length > 0 && (
            <Instanced spots={spots.rails} name="kit-fence-rails">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={railColor ?? color} roughness={0.8} />
            </Instanced>
         )}
      </group>
   );
}
