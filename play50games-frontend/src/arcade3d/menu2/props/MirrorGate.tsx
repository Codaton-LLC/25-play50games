"use client";

// Open bevelled arch with violet trim and a thin recessed iridescent membrane.
// Three batches: satin metal, emissive trim, physical mirror. No render target or reflection camera.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, ExtrudeGeometry, MeshPhysicalMaterial, MeshStandardMaterial, Shape, ShapeGeometry, type BufferGeometry } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";

export const MIRROR_GATE_SIZE = { w: 1.64, h: 2.4, d: 0.3, openW: 1.22, openH: 2.19 } as const;

/** A U outline, rather than a wall or a rectangular panel. Origin on floor, front +Z. */
function archBand(outer: number, inner: number, bottom: number, depth: number, bevel: number): BufferGeometry {
   const spring = 1.58;
   const shape = new Shape();
   shape.moveTo(-outer, bottom);
   shape.lineTo(-outer, spring);
   shape.absarc(0, spring, outer, Math.PI, 0, true);
   shape.lineTo(outer, bottom);
   shape.lineTo(inner, bottom);
   shape.lineTo(inner, spring);
   shape.absarc(0, spring, inner, 0, Math.PI, false);
   shape.lineTo(-inner, bottom);
   shape.closePath();
   const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12, steps: 1 });
   geometry.translate(0, 0, -depth / 2);
   return geometry;
}

export function buildMirrorGateFrameGeometry(): BufferGeometry {
   return archBand(0.795, 0.635, 0.025, 0.2, 0.025);
}

export function buildMirrorGateTrimGeometry(): BufferGeometry {
   const geometry = archBand(0.683, 0.659, 0.055, 0.01, 0.008);
   geometry.translate(0, 0, 0.124);
   return geometry;
}

/** Shaped zero-thickness mirror behind the opening; the centre has no box/panel volume. */
export function buildMirrorGateSurfaceGeometry(): BufferGeometry {
   const shape = new Shape();
   shape.moveTo(-0.61, 0.03);
   shape.lineTo(0.61, 0.03);
   shape.lineTo(0.61, 1.58);
   shape.absarc(0, 1.58, 0.61, 0, Math.PI, false);
   shape.closePath();
   const geometry = new ShapeGeometry(shape, 24);
   geometry.translate(0, 0, -0.16);
   return geometry;
}

let shared: { frame: BufferGeometry; trim: BufferGeometry; surface: BufferGeometry } | undefined;
export function getSharedMirrorGateGeometry() {
   return shared ??= { frame: buildMirrorGateFrameGeometry(), trim: buildMirrorGateTrimGeometry(), surface: buildMirrorGateSurfaceGeometry() };
}
const FRAME = new MeshStandardMaterial({ color: "#252639", metalness: 0.65, roughness: 0.38 });

export interface MirrorGateProps {
   /** Bright trim while active, subdued trim otherwise. Default true. */
   active?: boolean;
   /** Neon trim tone; default violet. */
   color?: string;
}

export function MirrorGate({ active = true, color = "#ad65ff" }: MirrorGateProps) {
   const geometry = getSharedMirrorGateGeometry();
   const time = useGameTime();
   const materials = useMemo(() => ({
      trim: new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: active ? 2 : 0.18, roughness: 0.35, metalness: 0.25 }),
      mirror: new MeshPhysicalMaterial({ color: "#8e81c7", metalness: 0.92, roughness: 0.14, iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 440], clearcoat: 1, clearcoatRoughness: 0.1, side: DoubleSide, emissive: "#49316d", emissiveIntensity: 0.22 }),
   }), [active, color]);
   useEffect(() => () => {
      materials.trim.dispose();
      materials.mirror.dispose();
   }, [materials]);
   useFrame(() => {
      // Tiny satin shimmer also reads without an environment map; no per-frame allocations.
      materials.mirror.roughness = 0.14 + Math.sin(time.now * 1.7) * 0.025;
      materials.mirror.emissiveIntensity = 0.22 + Math.sin(time.now * 1.1) * 0.05;
      materials.mirror.iridescenceThicknessRange[1] = 440 + Math.sin(time.now * 0.8) * 50;
   });
   return (
      <group name="mirror-gate">
         <mesh geometry={geometry.frame} material={FRAME} dispose={null} castShadow receiveShadow />
         <mesh geometry={geometry.trim} material={materials.trim} dispose={null} />
         <mesh geometry={geometry.surface} material={materials.mirror} dispose={null} />
      </group>
   );
}
