"use client";

// A soft flashlight pool on the floor. The kit <Flashlight> draws an additive sheet from the lamp
// to the floor arc; with the eye sitting on the lamp that sheet projects to a full-height white
// strip, and its floor sector is a hard-edged band. Here the lit area is the same inViewCone
// sector (half-angle, range), drawn once with a canvas falloff texture: u runs across the cone,
// v along it, so the edges and the far end fade out. One draw call, plus the optional spot light
// (decided once at mount and skipped on the "low" tier, as the kit does).
import { forwardRef, useEffect, useMemo, useState } from "react";
import type { GroupProps } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, Object3D, type Group } from "three";
import { useQuality } from "@/arcade3d/core/quality";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";

const RINGS = 14;
const NEAR = 0.35;

function smooth(e0: number, e1: number, x: number): number {
   const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
   return t * t * (3 - 2 * t);
}

/** u across the cone (0..1), v from the guard (0) to the range (1). Grey = brightness. */
function drawFalloff(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const img = ctx.createImageData(w, h);
   for (let y = 0; y < h; y += 1) {
      const v = 1 - y / (h - 1);
      const along = smooth(0.0, 0.3, v) * (1 - smooth(0.55, 1, v)) * (0.85 + 0.15 * (1 - v));
      for (let x = 0; x < w; x += 1) {
         const u = x / (w - 1);
         const c = Math.abs(u - 0.5) * 2;
         const across = 1 - smooth(0.35, 1, c);
         const core = 1 + 0.35 * (1 - smooth(0, 0.45, c)) * smooth(0.15, 0.5, v) * (1 - smooth(0.5, 0.9, v));
         const k = Math.min(1, along * across * core);
         const g = Math.round(255 * Math.sqrt(k));
         const i = (y * w + x) * 4;
         img.data[i] = g;
         img.data[i + 1] = g;
         img.data[i + 2] = g;
         img.data[i + 3] = 255;
      }
   }
   ctx.putImageData(img, 0, 0);
}

function sectorGeometry(halfAngle: number, range: number): BufferGeometry {
   const half = Math.min(Math.PI / 2, Math.max(0.01, halfAngle));
   const segs = Math.max(8, Math.ceil((2 * half) / (Math.PI / 60)));
   const cols = segs + 1;
   const pos = new Float32Array(cols * (RINGS + 1) * 3);
   const uv = new Float32Array(cols * (RINGS + 1) * 2);
   for (let r = 0; r <= RINGS; r += 1) {
      const v = r / RINGS;
      const dist = NEAR + (range - NEAR) * v;
      for (let s = 0; s <= segs; s += 1) {
         const u = s / segs;
         const a = -half + 2 * half * u;
         const i = r * cols + s;
         pos[i * 3] = Math.sin(a) * dist;
         pos[i * 3 + 1] = 0.018;
         pos[i * 3 + 2] = Math.cos(a) * dist;
         uv[i * 2] = u;
         uv[i * 2 + 1] = v;
      }
   }
   const index: number[] = [];
   for (let r = 0; r < RINGS; r += 1) {
      for (let s = 0; s < segs; s += 1) {
         const a = r * cols + s;
         const b = a + cols;
         index.push(a, b, a + 1, a + 1, b, b + 1);
      }
   }
   const geo = new BufferGeometry();
   geo.setAttribute("position", new BufferAttribute(pos, 3));
   geo.setAttribute("uv", new BufferAttribute(uv, 2));
   geo.setIndex(index);
   geo.computeBoundingSphere();
   return geo;
}

export interface SoftBeamProps extends Omit<GroupProps, "children"> {
   halfAngle: number;
   range: number;
   height?: number;
   color: string;
   opacity: number;
   light?: boolean;
   intensity?: number;
}

/** rotation.y = yaw (0 faces +z), the inViewCone frame of rules.ts. */
export const SoftBeam = forwardRef<Group, SoftBeamProps>(function SoftBeam(
   { halfAngle, range, height = 1.55, color, opacity, light = false, intensity = 22, ...group },
   ref
) {
   const quality = useQuality();
   const [withLight] = useState(() => light && quality.tier !== "low");
   const falloff = useCanvasTexture(64, 128, drawFalloff);
   const geometry = useMemo(() => sectorGeometry(halfAngle, range), [halfAngle, range]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   const target = useMemo(() => new Object3D(), []);
   return (
      <group ref={ref} {...group} name="soft-beam">
         <mesh geometry={geometry} renderOrder={1}>
            <meshBasicMaterial map={falloff} color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} fog={false} />
         </mesh>
         {withLight && (
            <>
               <primitive object={target} position={[0, 0, range * 0.75]} />
               <spotLight
                  position={[0, height, 0]}
                  target={target}
                  angle={Math.min(Math.PI / 2, halfAngle * 1.15)}
                  distance={Math.hypot(range, height) * 1.05}
                  penumbra={0.7}
                  decay={1.2}
                  intensity={intensity}
                  color={color}
               />
            </>
         )}
      </group>
   );
});
