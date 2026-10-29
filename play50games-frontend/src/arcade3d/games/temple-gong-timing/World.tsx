"use client";

// The jungle temple round the stage (no gameplay): the sky in the level's mood, the canopy below the
// raised ruin, a ring of crumbling ruin walls (m2JungleRuinBg) with the hidden ninth gong tucked among
// them on the front left, and the lights (sun or moon, a soft fill, torches on the stage at night and in
// the storm). Level 5's storm sky clears into warm sun once Coilstone is freed.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BackSide, CanvasTexture, Color, SRGBColorSpace, type DirectionalLight, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE, GONG_W } from "./assets";
import { NINTH } from "./rules";
import { COLORS, levelLook } from "./look";
import type { GongRun } from "./rules";

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

/** Ruin walls in a ring round the stage (13-16 m out), with a gap at the front for the camera. */
export function ruinSpots(): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const n = 16;
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.cos(a) > 0.8) continue;
      const r = 13 + (i % 3);
      const w = 5 + (i % 2) * 2;
      const h = 3 + ((i * 7) % 4);
      out.push({ x: r * Math.sin(a), y: -0.4, z: r * Math.cos(a), rotY: a + Math.PI, sx: w / GLB_SIZE.ruin.x, sy: h / GLB_SIZE.ruin.y, sz: 1.6 / GLB_SIZE.ruin.z });
   }
   return out;
}

export default function World({ run }: { run: GongRun }) {
   const look = levelLook(run.level);
   const sky = useMemo(() => skyTexture(look.skyTop, look.skyBottom), [look.skyTop, look.skyBottom]);
   const sunSky = useMemo(() => skyTexture("#6fb1d9", "#fde9b6"), []);
   useEffect(() => () => {
      sky.dispose();
      sunSky.dispose();
   }, [sky, sunSky]);
   const ruins = useMemo(ruinSpots, []);
   const sun = useRef<DirectionalLight>(null);
   const skyMat = useRef<{ map: CanvasTexture | null; needsUpdate: boolean } | null>(null);
   const freed = useRef(false);
   const warm = useMemo(() => new Color("#fff1d6"), []);
   useFrame(() => {
      // level 5: the storm breaks into sun once Coilstone is freed
      if (!run.boss || freed.current || run.ended !== "win") return;
      freed.current = true;
      if (skyMat.current) {
         skyMat.current.map = sunSky;
         skyMat.current.needsUpdate = true;
      }
      if (sun.current) {
         sun.current.intensity = 1.5;
         sun.current.color.copy(warm);
      }
   });
   const ninthAngle = Math.atan2(NINTH.x, NINTH.z);
   const sunDir: [number, number, number] = look.lighting === "night" ? [-8, 20, 6] : look.lighting === "sunset" ? [16, 10, 6] : [8, 22, 12];
   const ninth = useRef<Group>(null);
   return (
      <>
         <mesh scale={150} renderOrder={-10}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial ref={(m) => { skyMat.current = m as unknown as typeof skyMat.current; }} map={sky} side={BackSide} depthWrite={false} fog={false} />
         </mesh>
         <hemisphereLight args={[look.skyBottom, "#3b4a32", look.lighting === "night" ? 0.45 : 0.7]} />
         <directionalLight ref={sun} position={sunDir} intensity={look.lighting === "night" ? 0.55 : 1.1} color={look.lighting === "sunset" ? "#ffd2a0" : look.lighting === "night" ? "#b8c8ff" : "#ffffff"} />
         {look.torches &&
            [-1, 1].map((s) => (
               <pointLight key={s} position={[s * 6.5, 3, -4]} color={COLORS.torch} intensity={4} distance={14} decay={1.5} />
            ))}
         {/* the canopy far below the raised ruin */}
         <mesh rotation-x={-Math.PI / 2} position={[0, -5, 0]}>
            <circleGeometry args={[80, 40]} />
            <meshStandardMaterial color="#56704f" roughness={1} />
         </mesh>
         {/* the plinth the stage stands on */}
         <mesh position={[0, -2.6, 0]}>
            <cylinderGeometry args={[9.4, 10.6, 5, 24]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={0.95} />
         </mesh>
         <InstancedModel asset={ASSETS.ruin} spots={ruins} fallback={null} />
         {/* the hidden ninth gong among the ruins, front left (three downbeat strikes on it: a remix) */}
         <group ref={ninth} position={[8.1 * Math.sin(ninthAngle), 0, 8.1 * Math.cos(ninthAngle)]} rotation-y={ninthAngle + Math.PI} scale={(GONG_W * 0.55) / GLB_SIZE.gong.x}>
            <Model asset={ASSETS.gong} />
         </group>
         <mesh position={[8.8 * Math.sin(ninthAngle + 0.18), 1, 8.8 * Math.cos(ninthAngle + 0.18)]} rotation-y={ninthAngle}>
            <boxGeometry args={[2.6, 2, 0.8]} />
            <meshStandardMaterial color={COLORS.stoneDark} roughness={1} />
         </mesh>
      </>
   );
}
