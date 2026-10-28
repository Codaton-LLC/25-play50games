"use client";

// The factory hall around the floor (no collision): a concrete floor with the 2 m grid, the hall's
// walls (m2FactoryHallBg panels), roof girders and hanging lamps, furnace mouths on the back wall
// that glow red again as the cells come in (Ember Heights' colour coming back), patrol bots on the
// outer aisle and drones circling under the roof (m2PatrolBot, m2FactoryDrone). The line is Course.tsx.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, Vector3, type Matrix4, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, levelLook } from "./look";
import { H, TILE, W } from "./factory";
import type { FactoryRun } from "./rules";

const HALF_W = (W * TILE) / 2 + 4;
const HALF_D = (H * TILE) / 2 + 4;
const SCALE = new Vector3();

function concrete(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 256;
   const g = c.getContext("2d")!;
   g.fillStyle = "#45413e";
   g.fillRect(0, 0, 256, 256);
   let s = 11;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 900; i++) {
      const v = 55 + rnd() * 30;
      g.fillStyle = `rgba(${v},${v - 4},${v - 6},0.35)`;
      g.fillRect(rnd() * 256, rnd() * 256, 3, 3);
   }
   g.strokeStyle = "rgba(20,18,17,0.65)";
   g.lineWidth = 4;
   g.strokeRect(2, 2, 252, 252);
   g.strokeStyle = "rgba(255,190,90,0.12)";
   g.lineWidth = 2;
   g.strokeRect(10, 10, 236, 236);
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

export default function World({ run }: { run: FactoryRun }) {
   const look = levelLook(run.level);
   const tex = useMemo(() => concrete(), []);
   useEffect(() => () => tex.dispose(), [tex]);
   tex.repeat.set((HALF_W * 2) / TILE, (HALF_D * 2) / TILE);
   const time = useGameTime();
   const furnace = useRef<MeshStandardMaterial>(null);
   const hot = useMemo(() => new Color(COLORS.red), []);
   const cold = useMemo(() => new Color("#3a3533"), []);
   const mix = useMemo(() => new Color(), []);
   useFrame(() => {
      const m = furnace.current;
      if (!m) return;
      const need = run.boss ? 8 : run.floor.spec.cells;
      const got = run.boss ? 8 - run.boss.hp : run.board.charged;
      const k = Math.min(1, got / Math.max(1, need));
      mix.copy(cold).lerp(hot, 0.15 + 0.85 * k);
      m.emissive.copy(mix);
      m.emissiveIntensity = 0.4 + 1.6 * k + 0.15 * Math.sin(time.now * 3);
   });
   const panels = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      const k = 12 / GLB_SIZE.hall.x;
      for (let i = -1; i <= 1; i++) out.push({ x: i * 12, y: 0, z: -HALF_D, scale: k, rotY: 0 });
      for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) out.push({ x: s * HALF_W, y: 0, z: i * 9, scale: k, rotY: (s * Math.PI) / 2 });
      return out;
   }, []);
   const girders = useMemo(() => Array.from({ length: 6 }, (_, i) => -HALF_D + 3 + i * ((HALF_D * 2 - 6) / 5)), []);
   const patrolK = 2.1 / GLB_SIZE.patrol.y;
   const droneK = 1.4 / GLB_SIZE.drone.y;
   const patrolUpdate = (i: number, m: Matrix4) => {
      const t = time.now * 0.12 + i * 0.5;
      const u = t % 1;
      // round the outer aisle
      const per = 4;
      const seg = Math.floor(u * per);
      const f = u * per - seg;
      const pts: [number, number][] = [
         [-(HALF_W - 2), HALF_D - 2],
         [HALF_W - 2, HALF_D - 2],
         [HALF_W - 2, -(HALF_D - 2)],
         [-(HALF_W - 2), -(HALF_D - 2)],
      ];
      const a = pts[seg];
      const b = pts[(seg + 1) % 4];
      const px = a[0] + (b[0] - a[0]) * f;
      const pz = a[1] + (b[1] - a[1]) * f;
      m.makeRotationY(Math.atan2(b[0] - a[0], b[1] - a[1]));
      m.scale(SCALE.set(patrolK, patrolK, patrolK));
      m.setPosition(px, 0, pz);
   };
   const droneUpdate = (i: number, m: Matrix4) => {
      const a = time.now * (0.25 + i * 0.07) + i * 2.1;
      m.makeRotationY(a + Math.PI / 2);
      m.scale(SCALE.set(droneK, droneK, droneK));
      m.setPosition(Math.cos(a) * (8 + i * 3), 7.5 + Math.sin(time.now + i) * 0.5, Math.sin(a) * (6 + i * 2));
   };
   return (
      <>
         <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[HALF_W * 2, HALF_D * 2]} />
            <meshStandardMaterial map={tex} roughness={0.95} />
         </mesh>
         <InstancedModel asset={ASSETS.hall} spots={panels} fallback={null} />
         {/* the back wall behind the panels, the furnace mouths */}
         <mesh position={[0, 6, -HALF_D - 0.6]}>
            <boxGeometry args={[HALF_W * 2 + 2, 12, 0.5]} />
            <meshStandardMaterial color="#2c2826" roughness={0.9} />
         </mesh>
         {[-8, 0, 8].map((x) => (
            <mesh key={x} position={[x, 2.2, -HALF_D - 0.3]}>
               <boxGeometry args={[3, 2.4, 0.3]} />
               <meshStandardMaterial ref={x === 0 ? furnace : undefined} color="#1a1210" emissive={COLORS.red} emissiveIntensity={0.5} />
            </mesh>
         ))}
         {/* roof girders and lamps */}
         {girders.map((z) => (
            <group key={z}>
               <mesh position={[0, 10, z]}>
                  <boxGeometry args={[HALF_W * 2, 0.5, 0.35]} />
                  <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.5} />
               </mesh>
               {[-6, 6].map((x) => (
                  <group key={x} position={[x, 9, z]}>
                     <mesh>
                        <coneGeometry args={[0.7, 0.6, 16, 1, true]} />
                        <meshStandardMaterial color={COLORS.dark} metalness={0.5} />
                     </mesh>
                     <mesh position={[0, -0.25, 0]}>
                        <sphereGeometry args={[0.22, 10, 8]} />
                        <meshBasicMaterial color="#ffe2b0" toneMapped={false} />
                     </mesh>
                  </group>
               ))}
            </group>
         ))}
         <DynamicInstancedModel asset={ASSETS.patrol} count={2} update={patrolUpdate} name="patrol" />
         <DynamicInstancedModel asset={ASSETS.drone} count={2} update={droneUpdate} name="drones" />
         <hemisphereLight args={["#fff1e0", "#4a3a34", look.hemi]} />
         <ambientLight intensity={look.ambient} />
         <directionalLight position={[8, 18, 10]} intensity={look.key} color="#fff3e2" />
         <pointLight position={[0, 4, -HALF_D + 1]} intensity={30} distance={26} color="#ff6a3a" />
      </>
   );
}
