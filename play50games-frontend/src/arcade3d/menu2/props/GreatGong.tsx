"use client";

// Three batches: static mossy stone, moving bronze gong + ropes, moving emissive inlay.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, Color, CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape, SphereGeometry, TorusGeometry, type BufferGeometry, type Group } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameTime } from "@/arcade3d/core/gameTime";

export const GREAT_GONG_SIZE = { w: 3.12, h: 3, d: 0.5, gongD: 2.2, pivotY: 2.56, centreY: 1.35 } as const;

function merge(parts: { geometry: BufferGeometry; color: string }[]): BufferGeometry {
   const painted = parts.map(({ geometry, color }) => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      const tone = new Color(color);
      const colors = new Float32Array(flat.getAttribute("position").count * 3);
      for (let i = 0; i < colors.length; i += 3) {
         colors[i] = tone.r;
         colors[i + 1] = tone.g;
         colors[i + 2] = tone.b;
      }
      flat.setAttribute("color", new BufferAttribute(colors, 3));
      return flat;
   });
   const result = mergeGeometries(painted);
   painted.forEach((part) => part.dispose());
   if (!result) throw new Error("great gong: merge failed");
   return result;
}

/** Open U-shaped stone arch; bevel silhouette reaches exactly y=3. */
export function buildGreatGongFrameGeometry(): BufferGeometry {
   const shape = new Shape();
   shape.moveTo(-1.52, 0.04);
   shape.lineTo(-1.52, 1.44);
   shape.absarc(0, 1.44, 1.52, Math.PI, 0, true);
   shape.lineTo(1.52, 0.04);
   shape.lineTo(1.27, 0.04);
   shape.lineTo(1.27, 1.44);
   shape.absarc(0, 1.44, 1.27, 0, Math.PI, false);
   shape.lineTo(-1.27, 0.04);
   shape.closePath();
   const stone = new ExtrudeGeometry(shape, { depth: 0.42, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 10, steps: 1 });
   stone.translate(0, 0, -0.21);
   const parts = [{ geometry: stone as BufferGeometry, color: "#788775" }];
   for (const side of [-1, 1]) {
      // Moss cushions along the crown, distinct from the desaturated stone.
      for (let i = 0; i < 3; i++) {
         const moss = new SphereGeometry(0.12, 8, 4);
         moss.scale(1.5, 0.42, 1);
         moss.translate(side * (0.35 + i * 0.32), 1.44 + Math.sqrt(1.48 ** 2 - (0.35 + i * 0.32) ** 2), 0.12);
         parts.push({ geometry: moss, color: "#466b42" });
      }
   }
   return merge(parts);
}

/** Bronze disc and concentric raised rings, in REST coordinates, centred at y=1.35. */
export function buildGreatGongGeometry(): BufferGeometry {
   const disc = new CylinderGeometry(1.055, 1.055, 0.09, 40);
   disc.rotateX(Math.PI / 2);
   disc.translate(0, 1.35, 0);
   const rim = new TorusGeometry(1.055, 0.045, 6, 40);
   rim.translate(0, 1.35, 0);
   const boss = new SphereGeometry(0.24, 20, 8);
   boss.scale(1, 1, 0.55);
   boss.translate(0, 1.35, 0.045);
   const parts = [
      { geometry: disc as BufferGeometry, color: "#b4823c" },
      { geometry: rim as BufferGeometry, color: "#e0b668" },
      { geometry: boss as BufferGeometry, color: "#e0b668" },
   ];
   for (const radius of [0.38, 0.9]) {
      const ring = new TorusGeometry(radius, 0.015, 4, 40);
      ring.translate(0, 1.35, 0.051);
      parts.push({ geometry: ring, color: "#75502c" });
   }
   for (const side of [-1, 1]) {
      const rope = new CylinderGeometry(0.025, 0.025, 0.38, 6);
      rope.translate(side * 0.56, 2.44, 0);
      parts.push({ geometry: rope, color: "#796449" });
   }
   return merge(parts);
}

export function buildGreatGongRingGeometry(): BufferGeometry {
   const ring = new TorusGeometry(0.72, 0.018, 5, 40);
   ring.translate(0, 1.35, 0.052);
   return ring;
}

let shared: { frame: BufferGeometry; gong: BufferGeometry; ring: BufferGeometry } | undefined;
export function getSharedGreatGongGeometry() {
   return shared ??= { frame: buildGreatGongFrameGeometry(), gong: buildGreatGongGeometry(), ring: buildGreatGongRingGeometry() };
}
const STONE = new MeshStandardMaterial({ vertexColors: true, roughness: 0.88 });
const BRONZE = new MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.72 });

/** Strike is caller-owned hit envelope (1 at impact, decay to 0); seconds is pause-safe game time. */
export function greatGongSwing(strike: number, seconds: number): number {
   return Math.max(0, Math.min(1, strike)) * 0.075 * Math.sin(seconds * 14);
}

export interface GreatGongProps {
   strike?: number;
   glow?: number;
}

export function GreatGong({ strike = 0, glow = 0 }: GreatGongProps) {
   const geometry = getSharedGreatGongGeometry();
   const time = useGameTime();
   const swing = useRef<Group>(null);
   const light = useMemo(() => new MeshStandardMaterial({ color: "#f2c46d", emissive: "#ffbc51", roughness: 0.35, metalness: 0.6 }), []);
   useEffect(() => () => light.dispose(), [light]);
   useFrame(() => {
      if (swing.current) swing.current.rotation.x = greatGongSwing(strike, time.now);
      light.emissiveIntensity = Math.max(0, Math.min(1, glow)) + Math.max(0, Math.min(1, strike)) * (1.2 + 0.8 * Math.cos(time.now * 14));
   });
   return (
      <group name="great-gong" dispose={null}>
         <mesh geometry={geometry.frame} material={STONE} castShadow receiveShadow />
         <group ref={swing} position={[0, GREAT_GONG_SIZE.pivotY, 0]}>
            <group position={[0, -GREAT_GONG_SIZE.pivotY, 0]}>
               <mesh geometry={geometry.gong} material={BRONZE} castShadow receiveShadow />
               <mesh geometry={geometry.ring} material={light} />
            </group>
         </group>
      </group>
   );
}
