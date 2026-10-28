"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, PlaneGeometry, ShaderMaterial, type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { useCastleLevel } from "./useCastleLevel";
import { SkyDome } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Pedestal } from "@/arcade3d/core/kit";
import { Instanced, useCanvasTexture, type CanvasDraw, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, CATAPULT_SPOTS, THRONE_SPOTS, hasRoyalDecor } from "./assets";
import { Decor } from "./Decor";
import { COLORS, LEVEL_LOOKS, TOWERS, wallBlocks } from "./looks";
import { GatePrimitive, TowerFallback } from "./Primitives";
import type { CastleRun } from "./rules";
import { Terrain } from "./Terrain";

const drawBricks: CanvasDraw = (ctx, width, height) => {
   ctx.fillStyle = "#a89072";
   ctx.fillRect(0, 0, width, height);
   const cols = 4;
   const rows = 8;
   const bw = width / cols;
   const bh = height / rows;
   for (let row = 0; row < rows; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < cols + 1; col++) {
         ctx.fillStyle = (row + col) % 3 === 0 ? "#c4ad8e" : "#e7d5b6";
         ctx.fillRect(col * bw + off + 3, row * bh + 3, bw - 6, bh - 5);
      }
   }
};

const CLOTH_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
varying vec2 vUv;
void main() {
   vUv = uv;
   vec3 p = position;
   float free = 1.0 - uv.y;
   p.z += sin(uTime * 1.7 + uv.x * 6.0) * free * free * 0.16 * uAmp;
   p.x += sin(uTime * 0.9) * free * 0.04 * uAmp;
   gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const CLOTH_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uTrim;
varying vec2 vUv;
void main() {
   float edge = step(0.08, vUv.x) * step(vUv.x, 0.92) * step(0.05, vUv.y) * step(vUv.y, 0.96);
   float stripe = step(0.4, vUv.x) * step(vUv.x, 0.6);
   vec3 col = mix(uTrim, uColor, edge);
   col = mix(col, uTrim, stripe * edge);
   gl_FragColor = vec4(col, 1.0);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
}
`;

const RINGS: InstanceSpot[] = TOWERS.flatMap((tower) => [
   { x: tower.x, y: 1.35, z: tower.z },
   { x: tower.x, y: 3.05, z: tower.z },
]);
const POLES: InstanceSpot[] = [
   { x: -4.4, y: 1.875, z: 2.42, sy: 1.35 },
   { x: 4.4, y: 1.875, z: 2.42, sy: 1.35 },
   { x: -6.5, y: 6.3, z: 3.15, sy: 0.9 },
   { x: 6.5, y: 6.3, z: 3.15, sy: 0.9 },
];
const LANTERNS: InstanceSpot[] = [-4.8, -2.4, 2.4, 4.8].map((x) => ({ x, y: 0.82, z: 2.32 }));
/** where a night level's two torch lights hang: in front of the wall, between the lantern pairs */
const TORCHES = [[-3.6, 1], [3.6, 1]] as const;

function useWallGeometry(): { geometry: BufferGeometry; map: ReturnType<typeof useCanvasTexture> } {
   const map = useCanvasTexture(256, 256, drawBricks);
   const geometry = useMemo(() => {
      const parts = wallBlocks().map((block) => {
         const box = new BoxGeometry(block.w, block.h, block.d);
         if (block.rz) box.rotateZ(block.rz);
         box.translate(block.x, block.y, block.z);
         const count = box.getAttribute("position").count;
         const colors = new Float32Array(count * 3);
         for (let i = 0; i < count; i++) {
            colors[i * 3] = block.shade;
            colors[i * 3 + 1] = block.shade;
            colors[i * 3 + 2] = block.shade;
         }
         box.setAttribute("color", new BufferAttribute(colors, 3));
         return box;
      });
      const merged = mergeGeometries(parts, false);
      for (const part of parts) if (part !== merged) part.dispose();
      if (!merged) throw new Error("castle look: wall");
      return merged;
   }, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return { geometry, map };
}

function useClothMaterial(color: string, trim: string, phase: number, amp: { current: number }) {
   const time = useGameTime();
   const material = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: {
               uTime: { value: 0 },
               uAmp: { value: 0 },
               uColor: { value: new Color(color) },
               uTrim: { value: new Color(trim) },
            },
            vertexShader: CLOTH_VERT,
            fragmentShader: CLOTH_FRAG,
            side: DoubleSide,
         }),
      [color, trim],
   );
   useEffect(() => () => material.dispose(), [material]);
   useFrame(() => {
      material.uniforms.uTime.value = time.now + phase;
      material.uniforms.uAmp.value = amp.current;
   });
   return material;
}

function Cloth({
   width, height, color, trim, phase, amp, position,
}: {
   width: number;
   height: number;
   color: string;
   trim: string;
   phase: number;
   amp: { current: number };
   position: [number, number, number];
}) {
   const material = useClothMaterial(color, trim, phase, amp);
   const geometry = useMemo(() => {
      const plane = new PlaneGeometry(width, height, 8, 6);
      plane.translate(0, -height / 2, 0);
      return plane;
   }, [width, height]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return <mesh geometry={geometry} material={material} position={position} dispose={null} />;
}

export function Castle({ run, reduced }: { run: CastleRun; reduced: boolean }) {
   const { id } = useCastleLevel();
   const sky = LEVEL_LOOKS[id];
   const gate = useRef<Group>(null);
   const banners = useRef<Group>(null);
   const amp = useRef(reduced ? 0 : 0.8);
   const time = useGameTime();
   const endedAt = useRef(-1);
   const wall = useWallGeometry();
   useFrame(() => {
      if (run.end && endedAt.current < 0) endedAt.current = time.now;
      const won = run.end === "win" ? Math.min(1, (time.now - endedAt.current) / 0.4) : 0;
      amp.current = reduced ? 0 : 0.75 + won * 1.15;
      if (gate.current) gate.current.rotation.x = run.end === "lose" ? Math.min(1.2, (time.now - endedAt.current) * 0.8) : 0;
      // a win raises the wall banners (reduced motion: raised, still)
      if (banners.current) banners.current.scale.setScalar(1 + 0.8 * won);
   });
   return (
      <group>
         <SkyDome top={sky.skyTop} bottom={sky.sky} offset={0.12} exponent={0.8} />
         <Terrain reduced={reduced} ground={sky.ground} />
         <Decor reduced={reduced} />
         {hasRoyalDecor(id) && <>
            <InstancedModel asset={ASSETS.royalThrone} spots={THRONE_SPOTS} fallback={null} />
            <InstancedModel asset={ASSETS.siegeCatapultT} spots={CATAPULT_SPOTS} fallback={null} />
         </>}
         <mesh geometry={wall.geometry} dispose={null} name="castle-wall">
            <meshStandardMaterial map={wall.map} vertexColors roughness={0.94} />
         </mesh>
         <InstancedModel asset={ASSETS.tower} spots={TOWERS} fallback={<TowerFallback />} />
         <Instanced spots={RINGS} name="castle-rings">
            <torusGeometry args={[2.22, 0.09, 5, 14]} />
            <meshStandardMaterial color={COLORS.stone} flatShading roughness={0.95} />
         </Instanced>
         <Instanced spots={POLES} name="castle-poles">
            <cylinderGeometry args={[0.045, 0.055, 1, 6]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.8} />
         </Instanced>
         <Instanced spots={LANTERNS} name="castle-lanterns">
            <sphereGeometry args={[0.12, 8, 6]} />
            <meshStandardMaterial color={COLORS.lanternBody} emissive={COLORS.lantern} emissiveIntensity={0.85} roughness={0.45} />
         </Instanced>
         {/* a night level's torchlight (LevelLook.torches): warm pools on the near lanes from the gate lanterns */}
         {sky.torches ? TORCHES.map(([x, z]) => <pointLight key={x} position={[x, 2.2, z]} color={COLORS.lantern} intensity={sky.torches} distance={11} decay={1.3} />) : null}
         <group ref={gate} position={[0, 0, 2.51]}>
            <Model asset={ASSETS.gate} fallback={<GatePrimitive />} />
         </group>
         <Pedestal position={[0, 0, 3]} width={1.7} height={1.2} color={COLORS.stone} trim={COLORS.gold} />
         <group ref={banners} position={[0, 2.5, 2.42]}>
            <Cloth width={0.6} height={0.9} color={COLORS.banner} trim={COLORS.gold} phase={0} amp={amp} position={[-4.4, 0, 0]} />
            <Cloth width={0.6} height={0.9} color={COLORS.banner} trim={COLORS.gold} phase={1.4} amp={amp} position={[4.4, 0, 0]} />
         </group>
         <Cloth width={0.42} height={0.58} color={COLORS.gold} trim={COLORS.banner} phase={0.6} amp={amp} position={[-6.72, 6.72, 3.15]} />
         <Cloth width={0.42} height={0.58} color={COLORS.gold} trim={COLORS.banner} phase={2.1} amp={amp} position={[6.72, 6.72, 3.15]} />
      </group>
   );
}
