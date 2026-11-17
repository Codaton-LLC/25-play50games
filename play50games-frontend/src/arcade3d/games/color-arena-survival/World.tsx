"use client";

// Round the arena (no collision): the prism sky dome, the glowing pit far under the floor (where you
// fall), the fortress gate standing beyond the Keeper's perch, islands drifting in the distance, prism
// shards turning in the air, and the lights: the shell's preset plus a fill and a key from the camera's
// side so every tile colour reads at a glance (the card: "readable lighting with strong contrast").
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, CanvasTexture, Matrix4, SRGBColorSpace, Vector3, type Group, type InstancedMesh } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GATE_W, GLB_SIZE } from "./assets";
import { COLORS, levelLook } from "./look";
import type { Arena } from "./rules";

function skyTexture(top: string, bottom: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 16;
   c.height = 256;
   const g = c.getContext("2d")!;
   const grad = g.createLinearGradient(0, 0, 0, 256);
   grad.addColorStop(0, top);
   grad.addColorStop(0.52, bottom);
   grad.addColorStop(1, top);
   g.fillStyle = grad;
   g.fillRect(0, 0, 16, 256);
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** Islands drifting round the arena, 30-70 m out from its middle, under and above the floor (never in play). */
export function islandSpots(a: Arena): Record<"islandB" | "islandC" | "islandD", InstanceSpot[]> {
   const out: Record<"islandB" | "islandC" | "islandD", InstanceSpot[]> = { islandB: [], islandC: [], islandD: [] };
   const keys = ["islandB", "islandC", "islandD"] as const;
   for (let k = 0; k < 14; k++) {
      const t = (k / 14) * Math.PI * 2 + a.level * 0.37;
      const r = a.half + 24 + ((k * 7) % 5) * 9;
      const key = keys[k % 3];
      const w = 5 + (k % 4) * 2;
      const sz = GLB_SIZE[key];
      out[key].push({ x: Math.sin(t) * r, y: -12 + ((k * 5) % 7) * 4, z: Math.cos(t) * r, rotY: t, sx: w / sz.x, sy: w / sz.x, sz: w / sz.z });
   }
   return out;
}

const SHARDS = 18;
const shardM = new Matrix4();
const shardS = new Vector3();

/** Prism shards turning in the air round the arena (one instanced mesh). */
function Shards({ a }: { a: Arena }) {
   const ref = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const spots = useMemo(() => {
      const s: { x: number; y: number; z: number; k: number }[] = [];
      for (let i = 0; i < SHARDS; i++) {
         const t = (i / SHARDS) * Math.PI * 2;
         const r = a.half + 6 + (i % 4) * 3.5;
         s.push({ x: Math.cos(t) * r, y: 2 + (i % 5) * 1.6, z: Math.sin(t) * r, k: i });
      }
      return s;
   }, [a]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const now = time.now;
      for (let i = 0; i < spots.length; i++) {
         const s = spots[i];
         const sc = 0.5 + (s.k % 3) * 0.25;
         shardM.makeRotationY(now * 0.6 + s.k);
         shardM.scale(shardS.set(sc, sc * 1.8, sc));
         shardM.setPosition(s.x, s.y + Math.sin(now * 0.8 + s.k) * 0.5, s.z);
         m.setMatrixAt(i, shardM);
      }
      m.instanceMatrix.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, SHARDS]} frustumCulled={false}>
         <octahedronGeometry args={[0.6, 0]} />
         <meshStandardMaterial color={COLORS.prism} emissive={COLORS.prism} emissiveIntensity={0.55} roughness={0.15} metalness={0.4} transparent opacity={0.85} />
      </instancedMesh>
   );
}

export default function World({ arena }: { arena: Arena }) {
   const look = levelLook(arena.level);
   const sky = useMemo(() => skyTexture(look.skyTop, look.skyBottom), [look.skyTop, look.skyBottom]);
   useEffect(() => () => sky.dispose(), [sky]);
   const isles = useMemo(() => islandSpots(arena), [arena]);
   const pit = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (pit.current) pit.current.rotation.y = time.now * 0.05;
   });
   const gateS = GATE_W / GLB_SIZE.gate.x;
   return (
      <>
         <mesh scale={260} renderOrder={-10}>
            <sphereGeometry args={[1, 32, 20]} />
            <meshBasicMaterial map={sky} side={BackSide} depthWrite={false} fog={false} />
         </mesh>
         <ambientLight intensity={look.fill} color="#fdf4ff" />
         <directionalLight position={[-6, 18, 16]} intensity={1.1} color="#ffffff" />
         <directionalLight position={[10, 6, -18]} intensity={0.5} color={look.rim} />
         {/* the pit far below: a glowing well with rings, where a fall ends */}
         <group ref={pit} position={[0, -26, 0]}>
            <mesh rotation-x={-Math.PI / 2}>
               <circleGeometry args={[arena.half * 2.2, 48]} />
               <meshBasicMaterial color={look.pit} transparent opacity={0.55} depthWrite={false} fog={false} />
            </mesh>
            {[0.6, 1.1, 1.6, 2.1].map((k) => (
               <mesh key={k} rotation-x={-Math.PI / 2} position-y={0.1 + k}>
                  <ringGeometry args={[arena.half * k, arena.half * k + 0.5, 64]} />
                  <meshBasicMaterial color={look.rim} transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} fog={false} />
               </mesh>
            ))}
         </group>
         {/* the fortress gate beyond the Keeper's perch (north) */}
         <Model asset={ASSETS.gate} position={[0, -9, -arena.half - 38]} scale={gateS} fallback={null} />
         <InstancedModel asset={ASSETS.islandB} spots={isles.islandB} fallback={null} />
         <InstancedModel asset={ASSETS.islandC} spots={isles.islandC} fallback={null} />
         <InstancedModel asset={ASSETS.islandD} spots={isles.islandD} fallback={null} />
         <Shards a={arena} />
      </>
   );
}
