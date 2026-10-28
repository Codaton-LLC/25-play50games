"use client";

// Around the cross-section: the surface (sky, the volcano's grey flank, the mine entrance, the
// headframe over the first shaft, crates and dug-out soil blocks), the rock mass framing the slab on
// both sides and below it, and the surface light. The cells themselves: Grid.tsx; the props: Props.tsx.
import { useEffect, useMemo } from "react";
import { BackSide, Color, MeshStandardMaterial, RepeatWrapping, ShaderMaterial } from "three";
import { Model } from "../../core/assets";
import type { World as RunWorld } from "./rules";
import { ASSETS } from "./assets";
import { CELL, cellX } from "./space";
import { lookFor } from "./look";
import { terrainTextures } from "./textures";

const SKY_VERT = /* glsl */ `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; varying vec3 vPos;
void main() {
   float h = clamp(normalize(vPos).y, 0.0, 1.0);
   gl_FragColor = vec4(mix(uHorizon, uTop, smoothstep(0.0, 0.6, h)), 1.0);
}`;

export function World({ world }: { world: RunWorld }) {
   const look = lookFor(world.level);
   const tex = useMemo(() => terrainTextures(look, 91 + world.level), [look, world.level]);
   const outer = useMemo(() => {
      const t = tex.bedrock.clone();
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(6, 30);
      t.needsUpdate = true;
      return new MeshStandardMaterial({ map: t, roughness: 1, color: "#8a7d72" });
   }, [tex]);
   const ground = useMemo(() => {
      const t = tex.soft.clone();
      t.wrapS = t.wrapT = RepeatWrapping;
      t.repeat.set(20, 4);
      t.needsUpdate = true;
      return new MeshStandardMaterial({ map: t, roughness: 1, color: "#9c958e" });
   }, [tex]);
   const sky = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uTop: { value: new Color(look.sky.top) }, uHorizon: { value: new Color(look.sky.horizon) } },
            vertexShader: SKY_VERT,
            fragmentShader: SKY_FRAG,
            side: BackSide,
            depthWrite: false,
            fog: false,
         }),
      [look]
   );
   useEffect(
      () => () => {
         tex.dispose();
         outer.map?.dispose();
         ground.map?.dispose();
         outer.dispose();
         ground.dispose();
         sky.dispose();
      },
      [tex, outer, ground, sky]
   );
   const halfW = (world.w / 2) * CELL;
   const depth = world.h * CELL;
   const groundY = -CELL / 2;
   const sx = cellX(world.w, world.map.start.col);
   const sideW = 60;
   return (
      <>
         {/* the sky over the volcano flank (only the surface sees it) */}
         <mesh material={sky} position={[0, 40, -40]} renderOrder={-10}>
            <sphereGeometry args={[150, 24, 12]} />
         </mesh>
         {/* the volcano's grey cone far behind, a dim ember at its crater on the deep levels */}
         <mesh position={[18, 6, -95]}>
            <coneGeometry args={[70, 55, 32, 1, true]} />
            <meshStandardMaterial color="#5b5550" roughness={1} />
         </mesh>
         {world.level >= 4 && (
            <mesh position={[18, 33.5, -95]}>
               <sphereGeometry args={[6, 16, 8]} />
               <meshBasicMaterial color="#ff5a2a" transparent opacity={0.35} />
            </mesh>
         )}
         {/* the ground plain at the surface, both sides and behind the slab */}
         <mesh material={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, groundY, -30]}>
            <planeGeometry args={[220, 60]} />
         </mesh>
         {/* the rock mass framing the cross-section */}
         <mesh material={outer} position={[-halfW - sideW / 2, groundY - depth / 2, 0]}>
            <boxGeometry args={[sideW, depth, CELL]} />
         </mesh>
         <mesh material={outer} position={[halfW + sideW / 2, groundY - depth / 2, 0]}>
            <boxGeometry args={[sideW, depth, CELL]} />
         </mesh>
         <mesh material={outer} position={[0, groundY - depth - 15, 0]}>
            <boxGeometry args={[halfW * 2 + sideW * 2, 30, CELL]} />
         </mesh>
         {/* behind the slab: dark rock so a turned camera never looks into the void */}
         <mesh material={outer} position={[0, groundY - depth / 2, -CELL / 2 - 6]}>
            <boxGeometry args={[halfW * 2 + sideW * 2, depth, 10]} />
         </mesh>
         {/* the surface set: the entrance, the headframe over the start, crates and the dug-out soil */}
         <group position={[sx - 7.5, groundY, -3.2]} rotation={[0, 0.35, 0]}>
            <Model asset={ASSETS.entrance} />
         </group>
         <group position={[sx, groundY, -0.6]}>
            <Model asset={ASSETS.beam} />
         </group>
         <group position={[sx + 4.2, groundY, -1.5]} rotation={[0, -0.4, 0]}>
            <Model asset={ASSETS.soilSet} />
         </group>
         <group position={[sx + 6.6, groundY, -2.2]} rotation={[0, 0.7, 0]}>
            <Model asset={ASSETS.crate} />
         </group>
         <group position={[sx + 7.2, groundY + 0.6, -2.0]} rotation={[0, 0.2, 0]}>
            <Model asset={ASSETS.crate} />
         </group>
         <directionalLight position={[20, 40, 30]} intensity={world.level === 5 ? 0.25 : 0.7} color={look.sky.horizon} />
         <ambientLight intensity={look.ambient * 0.5} color="#ffd9b0" />
      </>
   );
}
