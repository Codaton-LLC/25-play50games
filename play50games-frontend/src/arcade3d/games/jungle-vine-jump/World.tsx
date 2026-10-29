"use client";

// The giant tree round the climb (no collision): a huge bark trunk with buttress roots, a limb out to
// every platform and every vine anchor (so the vines hang from real branches), a leafy canopy over the
// top, the jungle of background giants (m2GiantJungleTreeBg) all round in the haze, the forest floor
// far below, the sky, the sun through the leaves, and falling leaves near the hero. Level 4 scatters
// mossy ruin stones on the limbs.
import { useEffect, useMemo } from "react";
import { BackSide, CanvasTexture, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3, type Matrix4 } from "three";
import { InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { SkyDome } from "@/arcade3d/core/env/SkyDome";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE } from "./assets";
import { RING, TRUNK_R } from "./course";
import { COLORS, levelLook } from "./look";
import type { VineRun } from "./rules";

function barkTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 512;
   const g = c.getContext("2d")!;
   g.fillStyle = COLORS.bark;
   g.fillRect(0, 0, 256, 512);
   let s = 7;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   // long vertical bark ridges, darker cracks, moss patches
   for (let i = 0; i < 70; i++) {
      const x = rnd() * 256;
      const w = 4 + rnd() * 12;
      g.fillStyle = rnd() < 0.5 ? COLORS.barkDark : COLORS.barkLight;
      g.globalAlpha = 0.25 + rnd() * 0.35;
      g.fillRect(x, 0, w, 512);
   }
   g.globalAlpha = 1;
   for (let i = 0; i < 40; i++) {
      g.strokeStyle = COLORS.barkDark;
      g.lineWidth = 2;
      g.beginPath();
      const x = rnd() * 256;
      const y = rnd() * 512;
      g.moveTo(x, y);
      g.bezierCurveTo(x + rnd() * 10 - 5, y + 30, x + rnd() * 10 - 5, y + 60, x + rnd() * 6 - 3, y + 90);
      g.stroke();
   }
   for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(79,138,60,${0.25 + rnd() * 0.3})`;
      g.beginPath();
      g.ellipse(rnd() * 256, rnd() * 512, 10 + rnd() * 26, 6 + rnd() * 18, rnd() * 3, 0, Math.PI * 2);
      g.fill();
   }
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

const UP = new Vector3(0, 1, 0);
const DIR = new Vector3();
const SC = new Vector3();
const Q = new Quaternion();

/** A limb from the trunk's surface out to (x, y, z): position, quaternion and length for a unit cylinder. */
function limbSpot(x: number, y: number, z: number, thick: number): InstanceSpot & { q: Quaternion } {
   const n = Math.hypot(x, z) || 1;
   const sx = (x / n) * (TRUNK_R - 0.6);
   const sz = (z / n) * (TRUNK_R - 0.6);
   const sy = y - 1.2;
   DIR.set(x - sx, y - sy, z - sz);
   const len = DIR.length();
   DIR.normalize();
   Q.setFromUnitVectors(UP, DIR);
   return { x: (sx + x) / 2, y: (sy + y) / 2, z: (sz + z) / 2, sx: thick, sy: len, sz: thick, q: Q.clone() };
}

function Limbs({ run }: { run: VineRun }) {
   const c = run.course;
   const spots = useMemo(() => {
      const out: (InstanceSpot & { q: Quaternion })[] = [];
      for (const p of c.pads) {
         if (p.kind === "net" || p.kind === "hollow" || p.kind === "canopy") continue;
         out.push(limbSpot(p.x, p.y - 0.35, p.z, p.kind === "step" ? 0.45 : 0.7));
      }
      for (const v of c.vines) out.push(limbSpot(v.x, v.y + 0.25, v.z, 0.5));
      return out;
   }, [c]);
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new CylinderGeometry(0.85, 1, 1, 8), material: new MeshStandardMaterial({ color: COLORS.bark, roughness: 0.95 }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshStandardMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      const s = spots[i];
      m.compose(DIR.set(s.x, s.y, s.z), s.q, SC.set(s.sx ?? 1, s.sy ?? 1, s.sz ?? 1));
   };
   return <DynamicInstanced count={spots.length} update={update} parts={parts} name="limbs" />;
}

/** The canopy over the crown: big leafy blobs. */
function Canopy({ top }: { top: number }) {
   const spots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      let s = 3;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 26; i++) {
         const a = (i / 26) * Math.PI * 2 + rnd() * 0.3;
         const r = 6 + rnd() * 20;
         out.push({ x: Math.sin(a) * r, y: top + 9 + rnd() * 6, z: Math.cos(a) * r, sx: 7 + rnd() * 5, sy: 3.5 + rnd() * 2.5, sz: 7 + rnd() * 5 });
      }
      return out;
   }, [top]);
   return (
      <Instanced spots={spots}>
         <sphereGeometry args={[1, 12, 9]} />
         <meshStandardMaterial color={COLORS.leaf} roughness={0.9} />
      </Instanced>
   );
}

/** Falling leaves round the hero (decor only). */
function Leaves({ run, count }: { run: VineRun; count: number }) {
   const time = useGameTime();
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new PlaneGeometry(0.22, 0.14), material: new MeshBasicMaterial({ color: COLORS.leaf, side: DoubleSide }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      const h = run.hero;
      const t = time.now * 0.6 + i * 1.37;
      const fall = (t % 4) / 4;
      const a = i * 2.4;
      DIR.set(h.x + Math.sin(a) * (3 + (i % 5)) + Math.sin(t * 1.3) * 0.6, h.y + 9 - fall * 14, h.z + Math.cos(a) * (3 + (i % 5)));
      Q.setFromAxisAngle(UP, t * 2);
      m.compose(DIR, Q, SC.set(1, 1, 1));
   };
   return count > 0 ? <DynamicInstanced count={count} update={update} parts={parts} name="falling-leaves" /> : null;
}

export default function World({ run }: { run: VineRun }) {
   const look = levelLook(run.level);
   const top = run.course.top;
   const tex = useMemo(() => {
      const t = barkTexture();
      t.repeat.set(6, Math.max(3, (top + 40) / 10));
      return t;
   }, [top]);
   const trunkMat = useMemo(() => new MeshStandardMaterial({ map: tex, roughness: 0.95, color: new Color("#ffffff") }), [tex]);
   const rootGeo = useMemo(() => new CylinderGeometry(TRUNK_R, TRUNK_R * 1.9, 9, 24, 1, true), []);
   const floorMat = useMemo(() => new MeshStandardMaterial({ color: "#2f4a24", roughness: 1 }), []);
   const hazeMat = useMemo(() => new MeshBasicMaterial({ color: look.fog, side: BackSide, transparent: true, opacity: 0.35, depthWrite: false }), [look.fog]);
   useEffect(() => () => { tex.dispose(); trunkMat.dispose(); rootGeo.dispose(); floorMat.dispose(); hazeMat.dispose(); }, [tex, trunkMat, rootGeo, floorMat, hazeMat]);
   const bg = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (let i = 0; i < 14; i++) {
         const a = (i / 14) * Math.PI * 2 + 0.2;
         const r = 52 + (i % 3) * 12;
         const k = (28 + (i % 4) * 9) / GLB_SIZE.bgTree.y;
         out.push({ x: Math.sin(a) * r, y: -14, z: Math.cos(a) * r, rotY: a * 3, scale: k });
      }
      return out;
   }, []);
   const stones = useMemo<InstanceSpot[]>(() => {
      if (run.level !== 4) return [];
      const k = 0.9 / GLB_SIZE.stone.y;
      return run.course.pads.filter((p) => p.kind === "branch" || p.kind === "leaf").map((p, i) => {
         const n = Math.hypot(p.x, p.z) || 1;
         return { x: p.x + (p.x / n) * (p.r - 0.2), y: p.y - 0.05, z: p.z + (p.z / n) * (p.r - 0.2), rotY: i * 1.3, scale: k * (0.7 + (i % 3) * 0.2) };
      });
   }, [run]);
   const sunDir = useMemo(() => new Vector3(0.5, 1, 0.35).normalize(), []);
   return (
      <>
         <SkyDome top={look.skyTop} bottom={look.skyBottom} />
         <ambientLight intensity={look.ambient} color="#e8f5e0" />
         <hemisphereLight intensity={0.7} color="#d8f0ff" groundColor="#2a3a1a" />
         <directionalLight intensity={look.sunIntensity} color={look.sun} position={[sunDir.x * 40, top + 40, sunDir.z * 40]} />
         {/* the trunk, its buttress roots and the forest floor */}
         <mesh position={[0, (top + 8) / 2 - 4, 0]} material={trunkMat}>
            <cylinderGeometry args={[TRUNK_R * 0.86, TRUNK_R, top + 30, 28, 1, true]} />
         </mesh>
         <mesh position={[0, -9.5, 0]} geometry={rootGeo} material={trunkMat} />
         <mesh position={[0, -14, 0]} rotation-x={-Math.PI / 2} material={floorMat}>
            <circleGeometry args={[110, 32]} />
         </mesh>
         <mesh position={[0, top / 2, 0]} material={hazeMat}>
            <cylinderGeometry args={[RING + 34, RING + 34, top + 80, 32, 1, true]} />
         </mesh>
         <Limbs run={run} />
         <Canopy top={top} />
         <InstancedModel asset={ASSETS.bgTree} spots={bg} fallback={null} />
         {stones.length > 0 ? <InstancedModel asset={ASSETS.stone} spots={stones} fallback={null} /> : null}
         <Leaves run={run} count={look.leaves} />
      </>
   );
}

