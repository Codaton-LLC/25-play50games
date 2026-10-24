"use client";

// The round gallery. Pedestals are one instanced mesh (the kit pedestal is a mesh per copy).
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, BufferAttribute, BufferGeometry, Color, CylinderGeometry, SphereGeometry, BoxGeometry } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Model, InstancedModel } from "@/arcade3d/core/assets";
import { Fence, PEDESTAL_TOP } from "@/arcade3d/core/kit";
import { createPath } from "@/arcade3d/core/path";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { useCanvasTexture } from "@/arcade3d/core/render/useCanvasTexture";
import type { InstanceSpot } from "@/arcade3d/core/render/useInstanceMatrices";
import { useQuality } from "@/arcade3d/core/quality";
import { ASSETS } from "./assets";
import { COLORS } from "./looks";
import { BenchFallback } from "./Primitives";
import { EXITS, makePedestal, RING } from "./rules";

const PEDESTAL_SPOTS: InstanceSpot[] = Array.from({ length: RING.count }, (_, i) => {
   const ped = makePedestal(i);
   return { x: ped.x, y: 0, z: ped.z, rotY: ped.angle };
});

const PAINT_ANGLES = [0, Math.PI / 4, (3 * Math.PI) / 4, Math.PI, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
const PAINTINGS: InstanceSpot[] = PAINT_ANGLES.map((angle) => ({
   x: Math.sin(angle) * 7.55,
   y: 1.7,
   z: Math.cos(angle) * 7.55,
   rotY: angle + Math.PI,
}));

const VASES: InstanceSpot[] = [0, Math.PI / 4, Math.PI, (5 * Math.PI) / 4].map((angle) => ({
   x: Math.sin(angle) * 6.65,
   y: 0,
   z: Math.cos(angle) * 6.65,
}));

const DOOR_R = 7.35;
export const DOOR_SPOTS: InstanceSpot[] = [EXITS.pos, EXITS.neg].map((angle) => ({
   x: Math.sin(angle) * DOOR_R,
   y: 0,
   z: Math.cos(angle) * DOOR_R,
   rotY: angle + Math.PI,
}));

const DOOR_FALLBACK: InstanceSpot[] = DOOR_SPOTS.map((spot) => ({ ...spot, y: 1.05 }));

const ROPE = createPath(
   Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2;
      return { x: Math.sin(angle) * 3.35, y: 0, z: Math.cos(angle) * 3.35 };
   }),
   { closed: true }
);

function paint(geo: BufferGeometry, hex: string): BufferGeometry {
   const color = new Color(hex);
   const count = geo.getAttribute("position").count;
   const colors = new Float32Array(count * 3);
   for (let i = 0; i < count; i += 1) {
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
   }
   geo.setAttribute("color", new BufferAttribute(colors, 3));
   return geo;
}

function pedestalGeometry(): BufferGeometry {
   const top = PEDESTAL_TOP(RING.pedestalTop);
   const base = paint(new BoxGeometry(0.92, 0.1, 0.92).translate(0, 0.05, 0), COLORS.plinth);
   const column = paint(new BoxGeometry(0.52, top - 0.22, 0.52).translate(0, 0.1 + (top - 0.22) / 2, 0), COLORS.column);
   const cap = paint(new BoxGeometry(0.8, 0.12, 0.8).translate(0, top - 0.06, 0), COLORS.cap);
   return mergeGeometries([base, column, cap]) ?? cap;
}

function vaseGeometry(): BufferGeometry {
   return (
      mergeGeometries([
         new CylinderGeometry(0.1, 0.13, 0.08, 10).translate(0, 0.04, 0),
         new SphereGeometry(0.16, 12, 10).translate(0, 0.26, 0),
         new CylinderGeometry(0.05, 0.08, 0.14, 8).translate(0, 0.46, 0),
      ]) ?? new SphereGeometry(0.16, 10, 8)
   );
}

function drawFloor(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const glow = ctx.createRadialGradient(w / 2, h / 2, w * 0.02, w / 2, h / 2, w * 0.5);
   glow.addColorStop(0, "#3a3474");
   glow.addColorStop(0.4, "#221c48");
   glow.addColorStop(1, "#0b1020");
   ctx.fillStyle = glow;
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "rgba(196, 181, 253, 0.32)";
   ctx.lineWidth = 6;
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w * 0.33, 0, Math.PI * 2);
   ctx.stroke();
   ctx.strokeStyle = "rgba(248, 250, 252, 0.08)";
   ctx.lineWidth = 2;
   ctx.beginPath();
   ctx.arc(w / 2, h / 2, w * 0.16, 0, Math.PI * 2);
   ctx.stroke();
}

function motePositions(): Float32Array {
   const data = new Float32Array(36 * 3);
   for (let i = 0; i < 36; i += 1) {
      const angle = (i / 36) * Math.PI * 2 + (i % 3) * 0.2;
      const radius = 1.6 + (i % 6) * 0.85;
      data[i * 3] = Math.sin(angle) * radius;
      data[i * 3 + 1] = 0.35 + (i % 8) * 0.28;
      data[i * 3 + 2] = Math.cos(angle) * radius;
   }
   return data;
}

function Pedestals() {
   const geometry = useMemo(pedestalGeometry, []);
   return (
      <Instanced spots={PEDESTAL_SPOTS} name="pedestals">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.7} metalness={0.12} />
      </Instanced>
   );
}

function Vases() {
   const geometry = useMemo(vaseGeometry, []);
   return (
      <Instanced spots={VASES} name="vases">
         <primitive object={geometry} attach="geometry" />
         <meshStandardMaterial color={COLORS.vase} metalness={0.55} roughness={0.4} />
      </Instanced>
   );
}

function Motes() {
   const geometry = useMemo(() => {
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(motePositions(), 3));
      return geo;
   }, []);
   const time = useGameTime();
   useFrame(() => {
      const attr = geometry.getAttribute("position");
      const arr = attr.array as Float32Array;
      const t = time.now;
      for (let i = 0; i < 36; i += 1) arr[i * 3 + 1] = 0.4 + ((t * 0.12 + i * 0.17) % 2.1);
      attr.needsUpdate = true;
   });
   return (
      <points geometry={geometry}>
         <pointsMaterial color={COLORS.accent} size={0.045} transparent opacity={0.5} depthWrite={false} sizeAttenuation />
      </points>
   );
}

function DoorFallback() {
   return (
      <Instanced spots={DOOR_FALLBACK}>
         <boxGeometry args={[1.15, 2.1, 0.16]} />
         <meshStandardMaterial color={COLORS.door} roughness={0.55} metalness={0.15} />
      </Instanced>
   );
}

export default function Gallery() {
   const floor = useCanvasTexture(512, 512, drawFloor);
   const { tier } = useQuality();
   return (
      <group name="gallery">
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
            <circleGeometry args={[8.1, 48]} />
            <meshStandardMaterial map={floor} color="#ffffff" roughness={0.38} metalness={0.22} />
         </mesh>
         <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[7.9, 7.9, 3.6, 48, 1, true]} />
            <meshStandardMaterial color={COLORS.wall} roughness={0.92} side={BackSide} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 3.55, 0]}>
            <ringGeometry args={[1.15, 2.55, 32]} />
            <meshBasicMaterial color={COLORS.accent} transparent opacity={0.45} toneMapped={false} />
         </mesh>
         <Pedestals />
         <Instanced spots={PAINTINGS} name="paintings">
            <boxGeometry args={[0.85, 0.62, 0.05]} />
            <meshStandardMaterial color={COLORS.painting} emissive={COLORS.paintingGlow} emissiveIntensity={0.35} roughness={0.45} />
         </Instanced>
         <Vases />
         <Fence path={ROPE} spacing={1.55} height={0.72} color={COLORS.rope} railColor={COLORS.ropeRail} />
         <InstancedModel asset={ASSETS.door} spots={DOOR_SPOTS} fallback={<DoorFallback />} />
         {tier !== "low" && (
            <Model asset={ASSETS.bench} position={[0, 0, -2.35]} rotation={[0, 0, 0]} fallback={<BenchFallback />} />
         )}
         {tier !== "low" && <Motes />}
      </group>
   );
}
