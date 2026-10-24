"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, CylinderGeometry, MeshStandardMaterial, type Matrix4, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel, useModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, useCanvasTexture } from "@/arcade3d/core/render";
import { Pedestal } from "@/arcade3d/core/kit";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, fitStationScene } from "./assets";
import { COLORS } from "./palette";
import { MODULES, REPAIR, stageAt, type Run } from "./rules";

const SPOTS = MODULES.map((m) => ({ x: m.x, y: 0, z: m.z, rotY: m.angle }));
const BASES = SPOTS.map((p) => ({ ...p, y: 0.48 }));
const CAPS = SPOTS.map((p) => ({ ...p, y: 1.03 }));
const STRUTS = MODULES.map((m) => ({ x: m.x / 2, y: -0.07, z: m.z / 2, rotY: m.angle }));
const PANELS = [-1, 1].map((side) => ({ x: side * 8.7, y: 0.35, z: 0 }));
const PANEL_LINES = [-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, i) => ({ x: side * 8.7, y: 0.4, z: -0.8 + i * 0.4 })));
const GOOD = new Color(COLORS.mint), BAD = new Color(COLORS.warning), ACCENT = new Color(COLORS.accent), DARK = new Color(COLORS.shadow);
function drawLabels(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.clearRect(0, 0, w, h);
   ctx.textAlign = "center"; ctx.textBaseline = "middle";
   for (const m of MODULES) {
      const x = (0.5 + m.x / 12) * w, y = (0.5 + m.z / 12) * h;
      ctx.fillStyle = COLORS.space; ctx.beginPath(); ctx.arc(x, y, w * 0.038, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.white; ctx.font = `700 ${Math.round(w * 0.047)}px system-ui`; ctx.fillText(String(m.id + 1), x, y);
   }
}
function drawEarth(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.earth; ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.land;
   const shapes = [[0.1, 0.2, 0.08, 0.17], [0.23, 0.48, 0.065, 0.25], [0.55, 0.28, 0.22, 0.12], [0.54, 0.51, 0.075, 0.22], [0.84, 0.73, 0.08, 0.075]];
   for (const [x, y, a, b] of shapes) { ctx.beginPath(); ctx.ellipse(x * w, y * h, a * w, b * h, 0.3, 0, Math.PI * 2); ctx.fill(); }
   ctx.strokeStyle = "rgba(248,250,252,0.32)"; ctx.lineWidth = 9;
   for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(w * i / 4, h * (0.3 + i * 0.12), w * 0.16, h * 0.08, -0.3, 0, Math.PI); ctx.stroke(); }
}
function Modules() {
   const { scene } = useModel(ASSETS.station);
   const fitted = useMemo(() => {
      if (!scene) return ASSETS.station;
      return fitStationScene(scene);
   }, [scene]);
   return <InstancedModel asset={fitted} spots={SPOTS} fallback={<>
      <Instanced spots={BASES}><cylinderGeometry args={[0.61, 0.66, 0.96, 12]} /><meshStandardMaterial color={COLORS.hull} metalness={0.3} roughness={0.4} /></Instanced>
      <Instanced spots={CAPS}><cylinderGeometry args={[0.5, 0.61, 0.3, 12]} /><meshStandardMaterial color={COLORS.panel} metalness={0.35} roughness={0.32} /></Instanced>
   </>} />;
}
export default function Station({ run, reduced }: { run: Run; reduced: boolean }) {
   const time = useGameTime(), earth = useRef<Mesh>(null);
   const labels = useCanvasTexture(1024, 1024, drawLabels), earthMap = useCanvasTexture(1024, 512, drawEarth);
   const batteryParts = useMemo(() => [
      { geometry: new CylinderGeometry(0.22, 0.22, 1, 12).translate(0, 0.5, 0), material: new MeshStandardMaterial({ color: COLORS.mint, roughness: 0.35, metalness: 0.3 }) },
      { geometry: new CylinderGeometry(0.235, 0.235, 0.14, 12).translate(0, 0.72, 0), material: new MeshStandardMaterial({ color: COLORS.panel, emissive: COLORS.accent, emissiveIntensity: 0.3 }) },
   ], []);
   useEffect(() => () => { for (const part of batteryParts) { part.geometry.dispose(); part.material.dispose(); } }, [batteryParts]);
   useFrame(() => { if (earth.current && !reduced) earth.current.rotation.y = time.now * 0.006; });
   const ring = (i: number, m: Matrix4, c: Color) => {
      const p = MODULES[i], b = run.modules[i];
      m.makeRotationX(-Math.PI / 2); m.setPosition(p.x, 1.26, p.z);
      c.copy(b.broken ? BAD : run.time - b.fixedAt < 1.2 ? GOOD : ACCENT);
   };
   const dock = (i: number, m: Matrix4, c: Color) => {
      const p = MODULES[i]; m.makeRotationX(-Math.PI / 2); m.setPosition(p.dx, 0.06, p.dz);
      c.copy(run.modules[i].broken ? run.docked === i ? GOOD : ACCENT : DARK);
   };
   const pip = (i: number, m: Matrix4, c: Color) => {
      const id = Math.floor(i / 3), n = i % 3, p = MODULES[id], b = run.modules[id];
      if (n >= REPAIR.hits[id]) return false;
      m.makeRotationX(-Math.PI / 2); m.setPosition(p.x - 0.18 + 0.18 * n, 1.285, p.z + 0.35);
      c.copy(!b.broken || n < b.hits ? GOOD : BAD);
   };
   const debris = (i: number, m: Matrix4) => {
      if (i >= stageAt(run.time) + 2) return false;
      const p = run.debris[i].position;
      m.makeRotationY(time.play * 0.7 + i); m.setPosition(p.x, p.y, p.z);
   };
   const cell = (i: number, m: Matrix4) => {
      const c = run.cells[i]; if (!c.active) return false;
      m.makeRotationX(-50 * Math.PI / 180); m.setPosition(c.x, c.y - 0.32 + (reduced ? 0 : 0.035 * Math.sin(time.now * 3)), c.z + 0.38);
   };
   return <>
      <Modules />
      <Instanced spots={STRUTS}><boxGeometry args={[0.26, 0.14, 4.2]} /><meshStandardMaterial color={COLORS.shadow} metalness={0.45} roughness={0.45} /></Instanced>
      <mesh position-y={0.3}><cylinderGeometry args={[1.2, 1.2, 0.6, 16]} /><meshStandardMaterial color={COLORS.panel} metalness={0.35} roughness={0.4} /></mesh>
      <Pedestal width={1.3} height={0.7} color={COLORS.hull} trim={COLORS.panel} />
      <Instanced spots={PANELS}><boxGeometry args={[1.2, 0.1, 2]} /><meshStandardMaterial color={COLORS.panel} metalness={0.5} roughness={0.3} emissive={COLORS.panel} emissiveIntensity={0.3} /></Instanced>
      <Instanced spots={PANEL_LINES}><boxGeometry args={[1.16, 0.025, 0.025]} /><meshBasicMaterial color={COLORS.rim} /></Instanced>
      <mesh position-y={1.24} rotation-x={-Math.PI / 2} renderOrder={2}><planeGeometry args={[12, 12]} /><meshBasicMaterial map={labels} transparent depthWrite={false} alphaTest={0.02} /></mesh>
      <DynamicInstanced count={8} update={ring} tinted><ringGeometry args={[0.66, 0.7, 32]} /><meshBasicMaterial color={COLORS.white} transparent opacity={0.85} depthWrite={false} toneMapped={false} /></DynamicInstanced>
      <DynamicInstanced count={8} update={dock} tinted><ringGeometry args={[0.5, 0.6, 32, 1, 0, Math.PI * 1.8]} /><meshBasicMaterial transparent opacity={0.8} depthWrite={false} toneMapped={false} /></DynamicInstanced>
      <DynamicInstanced count={24} update={pip} tinted><circleGeometry args={[0.055, 8]} /><meshBasicMaterial depthWrite={false} toneMapped={false} /></DynamicInstanced>
      <DynamicInstanced count={4} update={debris}><dodecahedronGeometry args={[0.25, 0]} /><meshStandardMaterial color={COLORS.shadow} metalness={0.5} roughness={0.4} emissive={COLORS.accent} emissiveIntensity={0.16} /></DynamicInstanced>
      <DynamicInstancedModel asset={ASSETS.battery} count={3} update={cell} fallbackParts={batteryParts} />
      <mesh ref={earth} position={[0, -25, -12]}><sphereGeometry args={[12, 48, 32]} /><meshStandardMaterial map={earthMap} roughness={0.95} emissive={COLORS.earth} emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, -25, -12]}><sphereGeometry args={[12.15, 32, 24]} /><meshBasicMaterial color={COLORS.rim} transparent opacity={0.065} blending={AdditiveBlending} depthWrite={false} /></mesh>
   </>;
}
