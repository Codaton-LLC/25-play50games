"use client";

// A soft dark disc under a moving object: the arcade's shadow (no shadow maps, they cost a render
// pass on phones). Put it inside the object's group, at its feet; static props can bake contact
// shadows into the floor texture instead (useCanvasTexture).
export interface BlobShadowProps {
   radius: number;
   /** 0..1, default 0.32 */
   opacity?: number;
   color?: string;
   /** height above the floor (avoids z-fighting with it). Default 0.012 */
   y?: number;
}

export function BlobShadow({ radius, opacity = 0.32, color = "#020617", y = 0.012 }: BlobShadowProps) {
   return (
      <mesh rotation-x={-Math.PI / 2} position-y={y} renderOrder={1}>
         <circleGeometry args={[radius, 24]} />
         <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
   );
}
