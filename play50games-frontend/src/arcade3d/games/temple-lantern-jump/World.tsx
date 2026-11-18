"use client";

// The temple shaft around the climb (no collision): a round wall of mossy stone blocks that reads as
// depth in the dark, the abyss under the start deck, towers out in the fog, and the lights. The light
// is the game: a very dim ambient (the phone tier lifts it 20 %, timings unchanged), one point light on
// the hero that follows the ember's radius, and a point light on each of the two nearest lit lanterns.
// Level 5 adds the golden roof over the arena (m2RuinRoofSection, m2TempleBeam) with its giant brazier.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, CanvasTexture, CircleGeometry, Color, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, type PointLight } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ROOF_BRAZIER_SCALE } from "./assets";
import { COLORS, levelLook } from "./look";
import { emberRadius, type TempleRun } from "./rules";

export const WALL_R = 13;

function wallTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 512;
   c.height = 512;
   const g = c.getContext("2d")!;
   g.fillStyle = COLORS.wall;
   g.fillRect(0, 0, 512, 512);
   let s = 11;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 32 : 0;
      for (let col = -1; col < 8; col++) {
         const shade = 18 + Math.floor(rnd() * 22);
         g.fillStyle = `rgb(${shade},${shade + 18},${shade + 10})`;
         g.fillRect(col * 64 + off + 2, row * 64 + 2, 60, 60);
         if (rnd() < 0.35) {
            g.fillStyle = `rgba(74,222,128,${0.05 + rnd() * 0.1})`;
            g.fillRect(col * 64 + off + 2, row * 64 + 38 + rnd() * 16, 60, 18);
         }
      }
   }
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

function Lights({ run }: { run: TempleRun }) {
   const look = levelLook(run.level);
   const size = useThree((s) => s.size);
   const phone = size.width < 700;
   const ember = useRef<PointLight>(null);
   const l1 = useRef<PointLight>(null);
   const l2 = useRef<PointLight>(null);
   const time = useGameTime();
   const c = useMemo(() => new Color(), []);
   useFrame(() => {
      const h = run.hero;
      const r = emberRadius(run);
      const e = ember.current;
      if (e) {
         e.position.set(h.x, h.y + 1.1, h.z);
         e.intensity = r > 0 ? 6 + r * 1.5 + Math.sin(time.now * 14) * 0.4 : 0;
         e.distance = r > 0 ? r * 2.6 : 1;
      }
      // the two nearest lit lanterns
      let a = -1;
      let b = -1;
      let da = Infinity;
      let db = Infinity;
      for (const id of run.course.lanterns) {
         if (run.litUntil[id] <= run.simMs) continue;
         const p = run.course.pads[id];
         const d = Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z);
         if (d < da) {
            b = a;
            db = da;
            a = id;
            da = d;
         } else if (d < db) {
            b = id;
            db = d;
         }
      }
      for (const [light, id] of [[l1.current, a], [l2.current, b]] as const) {
         if (!light) continue;
         if (id < 0) {
            light.intensity = 0;
            continue;
         }
         const p = run.course.pads[id];
         const left = Math.min(1, (run.litUntil[id] - run.simMs) / 1500);
         light.position.set(p.x, p.y - 0.5, p.z);
         light.intensity = 9 * left;
         light.distance = 11;
         c.set(COLORS.lantern);
         light.color.copy(c);
      }
   });
   return (
      <>
         <ambientLight intensity={look.ambient * (phone ? 1.2 : 1)} color="#b8d8c8" />
         <hemisphereLight intensity={look.hemi * (phone ? 1.2 : 1)} color="#a8c8d8" groundColor="#2a1f14" />
         <pointLight ref={ember} color={COLORS.ember} decay={1.6} />
         <pointLight ref={l1} color={COLORS.lantern} decay={1.6} />
         <pointLight ref={l2} color={COLORS.lantern} decay={1.6} />
      </>
   );
}

/** The golden roof (level 5): a ring of roof sections and crossing beams over the arena, the giant brazier hanging under it. */
function Roof({ run }: { run: TempleRun }) {
   const c = run.course;
   const spots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      const k = 5.2 / GLB_SIZE.roof.x;
      for (let i = 0; i < 6; i++) {
         const a = (i / 6) * Math.PI * 2;
         out.push({ x: Math.cos(a) * 6.2, y: c.roofY, z: Math.sin(a) * 6.2, rotY: -a + Math.PI / 2, scale: k });
      }
      return out;
   }, [c]);
   const beams = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      const k = 9 / GLB_SIZE.beam.x;
      for (let i = 0; i < 3; i++) out.push({ x: 0, y: c.roofY - 0.9, z: 0, rotY: (i / 3) * Math.PI, scale: k });
      return out;
   }, [c]);
   const rb = c.roofBrazier;
   return (
      <>
         <InstancedModel asset={ASSETS.roof} spots={spots} fallback={null} />
         <InstancedModel asset={ASSETS.beam} spots={beams} fallback={null} />
         {rb ? <Model asset={ASSETS.brazier} position={[rb.x, rb.y - 0.6, rb.z]} scale={ROOF_BRAZIER_SCALE} /> : null}
      </>
   );
}

export default function World({ run }: { run: TempleRun }) {
   const look = levelLook(run.level);
   const top = run.course.top;
   const tex = useMemo(() => {
      const t = wallTexture();
      t.repeat.set(10, Math.max(3, (top + 40) / 6));
      return t;
   }, [top]);
   const wallMat = useMemo(() => new MeshBasicMaterial({ map: tex, side: BackSide, color: new Color(look.wall * 0.9, look.wall * 1.0, look.wall * 0.95) }), [tex, look.wall]);
   const floor = useMemo(() => new CircleGeometry(40, 32), []);
   const floorMat = useMemo(() => new MeshBasicMaterial({ color: "#050a08" }), []);
   useEffect(() => () => { tex.dispose(); wallMat.dispose(); floor.dispose(); floorMat.dispose(); }, [tex, wallMat, floor, floorMat]);
   const towers = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      const k = 10 / GLB_SIZE.tower.y;
      for (let i = 0; i < 7; i++) {
         const a = (i / 7) * Math.PI * 2 + 0.4;
         out.push({ x: Math.cos(a) * 30, y: -9 + (i % 3) * 7, z: Math.sin(a) * 30, rotY: -a, scale: k * (1 + (i % 3) * 0.35) });
      }
      return out;
   }, []);
   return (
      <>
         <Lights run={run} />
         <mesh position={[0, (top + 4) / 2, 0]} scale={[1, top + 44, 1]} material={wallMat}>
            <cylinderGeometry args={[WALL_R, WALL_R, 1, 40, 1, true]} />
         </mesh>
         <mesh geometry={floor} material={floorMat} position={[0, -11, 0]} rotation-x={-Math.PI / 2} />
         <InstancedModel asset={ASSETS.tower} spots={towers} fallback={null} />
         {run.course.cfg.boss ? <Roof run={run} /> : null}
      </>
   );
}
