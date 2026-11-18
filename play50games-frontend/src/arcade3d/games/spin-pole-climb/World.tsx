"use client";

// The jungle around the poles (no collision): a sky dome in the level's mood, the canopy far below
// (a wide disc of treetops the poles rise out of), ruined spiral towers standing in the mist all round
// (m2SpiralTowerBg), a few drifting mist sheets, and the lights (a sun or moon, a soft fill, and torch
// lights on the poles at night and in the storm). The card's colour return: the canopy is ashen at the
// start and greens up with the climb.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, CanvasTexture, Color, RepeatWrapping, SRGBColorSpace, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, levelLook } from "./look";
import type { SpinRun } from "./rules";

function canopyTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 512;
   c.height = 512;
   const g = c.getContext("2d")!;
   g.fillStyle = "#53614f";
   g.fillRect(0, 0, 512, 512);
   let s = 7;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 420; i++) {
      const x = rnd() * 512;
      const y = rnd() * 512;
      const r = 8 + rnd() * 26;
      const shade = 70 + Math.floor(rnd() * 60);
      g.fillStyle = `rgba(${shade - 20},${shade + 10},${shade - 25},0.85)`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
   }
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.repeat.set(6, 6);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function skyTexture(top: string, bottom: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 4;
   c.height = 256;
   const g = c.getContext("2d")!;
   const grad = g.createLinearGradient(0, 0, 0, 256);
   grad.addColorStop(0, top);
   grad.addColorStop(1, bottom);
   g.fillStyle = grad;
   g.fillRect(0, 0, 4, 256);
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** Ruined towers round the field, outside the play (rings 26-44 m out). */
export function towerSpots(level: number): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const n = 11;
   for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + level * 0.37;
      const r = 28 + ((i * 7) % 5) * 4;
      const h = 14 + ((i * 5) % 4) * 6;
      const w = 3 + ((i * 3) % 3);
      out.push({ x: Math.sin(t) * r, y: -12, z: Math.cos(t) * r, rotY: t * 2, sx: w / GLB_SIZE.tower.x, sy: (h + 12) / GLB_SIZE.tower.y, sz: w / GLB_SIZE.tower.z });
   }
   return out;
}

export default function World({ run }: { run: SpinRun }) {
   const look = levelLook(run.level);
   const canopy = useMemo(canopyTexture, []);
   const sky = useMemo(() => skyTexture(look.skyTop, look.skyBottom), [look.skyTop, look.skyBottom]);
   useEffect(() => () => {
      canopy.dispose();
      sky.dispose();
   }, [canopy, sky]);
   const towers = useMemo(() => towerSpots(run.level), [run.level]);
   const ground = useRef<MeshStandardMaterial>(null);
   const mist = useRef<Mesh[]>([]);
   const time = useGameTime();
   const ash = useMemo(() => new Color(COLORS.mossGrey), []);
   const green = useMemo(() => new Color("#6fbf73"), []);
   const tint = useMemo(() => new Color(), []);
   const top = run.course.top;
   useFrame(() => {
      // the colour returns as you climb: the canopy greens up with your height
      const k = Math.max(0, Math.min(1, run.hero.y / Math.max(1, top)));
      if (ground.current) ground.current.color.copy(tint.copy(ash).lerp(green, k));
      const t = time.now;
      mist.current.forEach((m, i) => {
         if (!m) return;
         m.position.x = Math.sin(t * 0.05 + i * 2.1) * 6;
         m.position.z = Math.cos(t * 0.04 + i * 1.7) * 6;
      });
   });
   const sunDir: [number, number, number] = look.lighting === "night" ? [-8, 20, -6] : look.lighting === "sunset" ? [18, 9, -10] : [10, 24, 8];
   const torchSpots = look.torches ? run.course.poles.filter((p) => !p.ghost) : [];
   return (
      <>
         <mesh scale={160} renderOrder={-10}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial map={sky} side={BackSide} depthWrite={false} fog={false} />
         </mesh>
         <hemisphereLight args={[look.skyBottom, "#3b4a32", look.lighting === "night" ? 0.45 : 0.75]} />
         <directionalLight position={sunDir} intensity={look.lighting === "night" ? 0.55 : 1.15} color={look.lighting === "sunset" ? "#ffd2a0" : look.lighting === "night" ? "#b8c8ff" : "#ffffff"} />
         {torchSpots.map((p) => (
            <pointLight key={p.id} position={[p.x, 3 + p.id * 2, p.z + p.walk + 0.4]} color={COLORS.torch} intensity={3} distance={9} decay={1.6} />
         ))}
         {/* the canopy far below: the poles rise out of the treetops */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -6, 0]}>
            <circleGeometry args={[90, 48]} />
            <meshStandardMaterial ref={ground} map={canopy} color={COLORS.mossGrey} roughness={1} />
         </mesh>
         {/* a stone base round each pole's foot, standing on the canopy */}
         {run.course.poles.map((p) => (
            <mesh key={p.id} position={[p.x, -3.2, p.z]}>
               <cylinderGeometry args={[p.walk + 0.6, p.walk + 1.4, 5.6, 14]} />
               <meshStandardMaterial color={p.ghost ? COLORS.ghost : COLORS.stoneDark} roughness={0.95} transparent={p.ghost} opacity={p.ghost ? 0.25 : 1} />
            </mesh>
         ))}
         <InstancedModel asset={ASSETS.tower} spots={towers} fallback={null} />
         {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(m) => { if (m) mist.current[i] = m; }} position={[0, 2 + i * (top / 3), 0]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[22, 24]} />
               <meshBasicMaterial color={look.fog} transparent opacity={0.08 * look.mist} depthWrite={false} />
            </mesh>
         ))}
      </>
   );
}
