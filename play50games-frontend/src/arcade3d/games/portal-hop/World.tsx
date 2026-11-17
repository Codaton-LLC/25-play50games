"use client";

// The void round the islands (no collision): a violet sky dome with stars, a faint neon grid on the
// horizon far below, a ringed planet, ruins and spare islands drifting in the distance (m2FloatingRuinBg,
// the shared islandB-D), and the lights: a cold moon, a violet fill, and the colour returning on the
// edge strips (look.ts edge).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BackSide, CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { levelLook } from "./look";
import type { PortalRun } from "./rules";

function skyTexture(top: string, bottom: string, stars: number): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 512;
   c.height = 512;
   const g = c.getContext("2d")!;
   const grad = g.createLinearGradient(0, 0, 0, 512);
   grad.addColorStop(0, top);
   grad.addColorStop(0.55, bottom);
   grad.addColorStop(1, top);
   g.fillStyle = grad;
   g.fillRect(0, 0, 512, 512);
   let s = 11;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   const n = Math.floor(260 * stars);
   for (let i = 0; i < n; i++) {
      const x = rnd() * 512;
      const y = rnd() * 300;
      const r = rnd() < 0.08 ? 1.6 : 0.8;
      g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.6})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function gridTexture(color: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 128;
   const g = c.getContext("2d")!;
   g.clearRect(0, 0, 128, 128);
   g.strokeStyle = color;
   g.globalAlpha = 0.85;
   g.lineWidth = 2;
   g.strokeRect(1, 1, 126, 126);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.repeat.set(60, 60);
   t.colorSpace = SRGBColorSpace;
   return t;
}

interface Backdrop {
   ruins: InstanceSpot[];
   isles: Record<"islandB" | "islandC" | "islandD", InstanceSpot[]>;
}

/** Ruins and spare islands drifting round the course, 40-80 m out from its middle (never in play). */
export function backdropSpots(run: PortalRun): Backdrop {
   let cx = 0;
   let cz = 0;
   const isl = run.course.islands;
   for (const i of isl) {
      cx += i.x;
      cz += i.z;
   }
   cx /= isl.length;
   cz /= isl.length;
   let span = 0;
   for (const i of isl) span = Math.max(span, Math.hypot(i.x - cx, i.z - cz) + i.r);
   const ruins: InstanceSpot[] = [];
   const isles: Backdrop["isles"] = { islandB: [], islandC: [], islandD: [] };
   const keys = ["islandB", "islandC", "islandD"] as const;
   for (let k = 0; k < 18; k++) {
      const t = (k / 18) * Math.PI * 2 + run.level * 0.41;
      const r = span + 22 + ((k * 7) % 5) * 9;
      const x = cx + Math.sin(t) * r;
      const z = cz + Math.cos(t) * r;
      const y = -10 + ((k * 5) % 7) * 4;
      if (k % 2 === 0) {
         const w = 5 + (k % 3) * 2;
         ruins.push({ x, y, z, rotY: t * 3, sx: w / GLB_SIZE.ruin.x, sy: w / GLB_SIZE.ruin.x, sz: w / GLB_SIZE.ruin.x });
      } else {
         const key = keys[k % 3];
         const w = 6 + (k % 4) * 2;
         const sz = GLB_SIZE[key];
         isles[key].push({ x, y, z, rotY: t, sx: w / sz.x, sy: w / sz.x, sz: w / sz.z });
      }
   }
   return { ruins, isles };
}

export default function World({ run }: { run: PortalRun }) {
   const look = levelLook(run.level);
   const sky = useMemo(() => skyTexture(look.skyTop, look.skyBottom, look.stars), [look.skyTop, look.skyBottom, look.stars]);
   const grid = useMemo(() => gridTexture(look.grid), [look.grid]);
   useEffect(
      () => () => {
         sky.dispose();
         grid.dispose();
      },
      [sky, grid],
   );
   const back = useMemo(() => backdropSpots(run), [run]);
   const planet = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      if (planet.current) planet.current.rotation.y = time.now * 0.02;
   });
   const low = run.course.voidY;
   return (
      <>
         <mesh scale={240} renderOrder={-10}>
            <sphereGeometry args={[1, 32, 20]} />
            <meshBasicMaterial map={sky} side={BackSide} depthWrite={false} fog={false} />
         </mesh>
         <hemisphereLight args={["#c4b5fd", "#1e1b4b", 0.85]} />
         <directionalLight position={[-14, 26, 10]} intensity={1.15} color="#e0e7ff" />
         <directionalLight position={[18, 8, -20]} intensity={0.45} color={look.edge} />
         {/* the neon grid far below: the void has a floor you never reach */}
         <mesh rotation-x={-Math.PI / 2} position={[0, low - 10, 0]}>
            <planeGeometry args={[600, 600]} />
            <meshBasicMaterial map={grid} transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} />
         </mesh>
         {/* the ringed planet */}
         <group ref={planet} position={[-120, 40, -150]}>
            <mesh>
               <sphereGeometry args={[22, 32, 20]} />
               <meshStandardMaterial color="#6d28d9" emissive="#2e1065" emissiveIntensity={0.6} roughness={0.8} fog={false} />
            </mesh>
            <mesh rotation-x={Math.PI / 2.4}>
               <ringGeometry args={[30, 42, 64]} />
               <meshBasicMaterial color={look.edge} transparent opacity={0.35} side={2} fog={false} />
            </mesh>
         </group>
         <InstancedModel asset={ASSETS.ruin} spots={back.ruins} fallback={null} />
         <InstancedModel asset={ASSETS.islandB} spots={back.isles.islandB} fallback={null} />
         <InstancedModel asset={ASSETS.islandC} spots={back.isles.islandC} fallback={null} />
         <InstancedModel asset={ASSETS.islandD} spots={back.isles.islandD} fallback={null} />
      </>
   );
}
