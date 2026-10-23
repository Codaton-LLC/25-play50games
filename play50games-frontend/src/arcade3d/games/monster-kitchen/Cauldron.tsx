// The cauldron on its stove drum: the GLB, the glowing liquid disc (the measured inner radius, just
// under the rim), instanced bubbles and a soft steam column. The bubbles and steam follow
// useQuality() (scaledCount; the steam is off on "low"); a wrong-toss burp surges both for a moment.
// Animations touch scales and intensities only — no per-frame colours.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { ASSETS, LIQUID_R, LIQUID_Y } from "./assets";
import { CauldronPrimitive } from "./Primitives";

/** Shared look: the burp surge time (time.now domain), written by the Scene. */
export interface CauldronLook {
   burpAt: number;
}

const Q = new Quaternion();
const V = new Vector3();
const SCALED = new Vector3();
/** The burp surge 0..1 this frame: the useFrame above the pools writes it, they read it. */
const SURGE = { v: 0 };

const BUBBLE_COUNT = 6;
const STEAM_COUNT = 5;

export function Cauldron({ look }: { look: CauldronLook }) {
   const time = useGameTime();
   const quality = useQuality();
   const liquid = useRef<Mesh>(null);

   useFrame(() => {
      SURGE.v = Math.max(0, 1 - (time.now - look.burpAt) / 1.1);
      const mesh = liquid.current;
      if (!mesh) return;
      const material = mesh.material as MeshStandardMaterial;
      material.emissiveIntensity = 0.55 + 0.12 * Math.sin(time.now * 2.6) + SURGE.v * 0.8;
      mesh.rotation.z += time.delta * 0.12;
      const s = 1 + 0.02 * Math.sin(time.now * 2.6) + SURGE.v * 0.04;
      mesh.scale.set(s, s, s);
   });

   const bubbleCount = scaledCount(BUBBLE_COUNT, quality.particles);

   const placeBubble = (i: number, m: Matrix4): boolean => {
      if (i >= bubbleCount) return false;
      const frac = (time.now * (0.5 + 1.6 * SURGE.v) + i / BUBBLE_COUNT) % 1;
      const a = i * 2.399;
      const r = (0.25 + 0.5 * frac) * LIQUID_R * 0.85;
      const scale = (0.35 + frac * 0.8) * (1 + SURGE.v * 0.6);
      m.compose(
         V.set(Math.cos(a) * r, LIQUID_Y + 0.02 + frac * 0.22, Math.sin(a) * r),
         Q.identity(),
         SCALED.set(scale, scale, scale),
      );
      return true;
   };

   const placeSteam = (i: number, m: Matrix4): boolean => {
      if (quality.tier === "low") return false;
      const frac = (time.now * 0.25 + i * 0.19) % 1;
      const scale = 0.4 + frac * 1.5;
      m.compose(
         V.set(Math.sin(i * 2.1 + time.now * 0.6) * 0.06, LIQUID_Y + 0.12 + frac * 0.8, Math.cos(i * 1.7) * 0.04),
         Q.identity(),
         SCALED.set(scale, scale, scale),
      );
      return true;
   };

   return (
      <group name="cauldron" position={[0, 0, -0.1]}>
         <Model asset={ASSETS.cauldron} fallback={<CauldronPrimitive />} />
         <mesh ref={liquid} position={[0, LIQUID_Y, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[LIQUID_R, 28]} />
            <meshStandardMaterial color="#65a30d" emissive="#4d7c0f" emissiveIntensity={0.55} roughness={0.3} />
         </mesh>
         <DynamicInstanced count={BUBBLE_COUNT} update={placeBubble} name="bubbles">
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial color="#4ade80" emissive="#16a34a" emissiveIntensity={0.5} transparent opacity={0.92} roughness={0.3} />
         </DynamicInstanced>
         <DynamicInstanced count={STEAM_COUNT} update={placeSteam} name="steam">
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#e7e5e4" transparent opacity={0.16} depthWrite={false} roughness={1} />
         </DynamicInstanced>
      </group>
   );
}
