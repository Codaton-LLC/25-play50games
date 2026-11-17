"use client";

// Each level's room (levels.ts `theme`, looks.ts LAB_THEMES): the props its title promises, drawn
// beyond the wall ring or flat on the floor so nothing stands in the walk. Visual only: rules.ts
// never reads this file.
import { useEffect, useMemo } from "react";
import { ConeGeometry, CylinderGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Starfield } from "@/arcade3d/core/env";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { WizardLevel } from "./levels";
import { LAB_THEMES, type LabLook } from "./looks";
import type { Run } from "./rules";

/** Props on a ring beyond the wall (the wall stands at `radius`). */
export function ringProps(radius: number, n: number, out: number, spread: number, phase = 0): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + phase;
      const r = radius + out + ((i * 37) % 7) / 7 * spread;
      spots.push({ x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, rotY: a * 3.1 });
   }
   return spots;
}

/**
 * Tall props only on the far side and the flanks: none in the arc between the wall and the camera
 * (the fitted yaw), where they would hide the lab on a low phone camera.
 */
export function awayFromCamera(spots: InstanceSpot[], yaw: number): InstanceSpot[] {
   return spots.filter((s) => Math.cos(Math.atan2(s.x, s.z) - yaw) < 0.2);
}

/** Small props at the foot of the wall, between the candles. */
function wallFoot(radius: number, n: number, scale: number): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.45;
      spots.push({ x: Math.sin(a) * (radius - 0.28), y: 0, z: Math.cos(a) * (radius - 0.28), rotY: a, scale: scale * (0.8 + (i % 3) * 0.2) });
   }
   return spots;
}

function Mushrooms({ level, look, yaw }: { level: WizardLevel; look: LabLook; yaw: number }) {
   const { decor } = useQuality();
   const geo = useMemo(() => ({
      stem: new CylinderGeometry(0.18, 0.26, 1, 8).translate(0, 0.5, 0),
      cap: new SphereGeometry(0.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, 1, 0),
   }), []);
   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
   const big = useMemo(() => awayFromCamera(ringProps(level.radius, scaledCount(14, decor), 1.6, 1.4), yaw).map((s, i) => ({ ...s, scale: 1.6 + (i % 4) * 0.45 })), [level.radius, decor, yaw]);
   const small = useMemo(() => wallFoot(level.radius, scaledCount(14, decor), 0.28), [level.radius, decor]);
   return (
      <group name="mushroom-lab">
         {[big, small].map((spots, k) => (
            <group key={k}>
               <Instanced spots={spots}>
                  <primitive object={geo.stem} attach="geometry" />
                  <meshStandardMaterial color="#e7e5c8" roughness={0.8} />
               </Instanced>
               <Instanced spots={spots}>
                  <primitive object={geo.cap} attach="geometry" />
                  <meshStandardMaterial color={k ? "#a3e635" : "#16a34a"} emissive={look.glow} emissiveIntensity={k ? 0.9 : 0.35} roughness={0.5} />
               </Instanced>
            </group>
         ))}
      </group>
   );
}

function Crystals({ level, run, look, yaw }: { level: WizardLevel; run: Run; look: LabLook; yaw: number }) {
   const { decor } = useQuality();
   const spires = useMemo(() => {
      const out: InstanceSpot[] = [];
      awayFromCamera(ringProps(level.radius, scaledCount(16, decor), 1.4, 1.6, 0.2), yaw).forEach((s, i) => {
         out.push({ ...s, y: 1.2, sx: 0.55, sy: 2.4 + (i % 3) * 0.8, sz: 0.55 });
         out.push({ x: s.x * 1.04 + 0.5, y: 0.6, z: s.z * 1.04, rotY: (s.rotY ?? 0) + 1, sx: 0.35, sy: 1.2, sz: 0.35 });
      });
      return out;
   }, [level.radius, decor, yaw]);
   const shards = useMemo(() => wallFoot(level.radius, scaledCount(16, decor), 1).map((s) => ({ ...s, y: 0.18, sx: 0.12, sy: 0.3, sz: 0.12 })), [level.radius, decor]);
   return (
      <group name="crystal-lab">
         <Instanced spots={spires}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#67e8f9" emissive={look.glow} emissiveIntensity={0.55} roughness={0.12} metalness={0.3} flatShading />
         </Instanced>
         <Instanced spots={shards}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.8} roughness={0.1} flatShading />
         </Instanced>
         <WanderRail run={run} look={look} />
      </group>
   );
}

/** A glowing rail under the sliding ingredient: shows its 3 m path (levels 3+). */
function WanderRail({ run, look }: { run: Run; look: LabLook }) {
   const rails = useMemo<InstanceSpot[]>(
      () => run.shelves.filter((s) => s.wander).map((s) => ({ x: s.x, y: 0.03, z: s.z, rotY: Math.atan2(s.tx, s.tz), sx: 0.14, sy: 0.02, sz: 3.2 })),
      [run],
   );
   if (!rails.length) return null;
   return (
      <Instanced spots={rails} name="wander-rail">
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial color={look.glow} toneMapped={false} transparent opacity={0.85} />
      </Instanced>
   );
}

const LEAVES = 28;
const Q = new Quaternion();
const AXIS = new Vector3(1, 0.3, 0.2).normalize();
const P = new Vector3();
const S = new Vector3(0.16, 0.02, 0.11);

function Forest({ level, run, look, reduced, yaw }: { level: WizardLevel; run: Run; look: LabLook; reduced: boolean; yaw: number }) {
   const { decor, particles } = useQuality();
   const time = useGameTime();
   const geo = useMemo(() => {
      const trunk = new CylinderGeometry(0.16, 0.26, 2, 7).translate(0, 1, 0);
      const c1 = new ConeGeometry(1.2, 1.8, 8).translate(0, 2.4, 0);
      const c2 = new ConeGeometry(0.95, 1.5, 8).translate(0, 3.2, 0);
      const c3 = new ConeGeometry(0.65, 1.2, 8).translate(0, 3.9, 0);
      const crown = mergeGeometries([c1, c2, c3]);
      c1.dispose(); c2.dispose(); c3.dispose();
      return { trunk, crown: crown! };
   }, []);
   useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
   const trees = useMemo(() => awayFromCamera(ringProps(level.radius, scaledCount(16, decor), 1.5, 1.8, 0.1), yaw).map((s, i) => ({ ...s, scale: 1 + (i % 3) * 0.25 })), [level.radius, decor, yaw]);
   const ferns = useMemo(() => wallFoot(level.radius, scaledCount(14, decor), 0.5), [level.radius, decor]);
   const leaves = scaledCount(LEAVES, particles);
   const place = (i: number, m: Matrix4) => {
      if (i >= leaves) return false;
      const seed = Math.imul(i + 11, 2654435761) >>> 0;
      const a = (seed % 628) / 100;
      const r = ((seed >>> 10) % 100) / 100 * level.radius * 0.85;
      const period = 6 + (seed % 5);
      const k = reduced ? 1 : ((time.now + (seed % 97) / 10) % period) / period;
      P.set(Math.sin(a) * r + Math.sin(k * 9 + i) * 0.4, 3.2 * (1 - k) + 0.03, Math.cos(a) * r + Math.cos(k * 7 + i) * 0.4);
      Q.setFromAxisAngle(AXIS, reduced ? a : k * 12 + i);
      m.compose(P, Q, S);
   };
   return (
      <group name="forest-lab">
         <Instanced spots={trees}>
            <primitive object={geo.trunk} attach="geometry" />
            <meshStandardMaterial color="#5b3a1e" roughness={0.9} />
         </Instanced>
         <Instanced spots={trees}>
            <primitive object={geo.crown} attach="geometry" />
            <meshStandardMaterial color="#3f7d20" roughness={0.85} flatShading />
         </Instanced>
         <Instanced spots={ferns}>
            <coneGeometry args={[0.5, 0.6, 6]} />
            <meshStandardMaterial color="#65a30d" roughness={0.85} flatShading />
         </Instanced>
         <DynamicInstanced count={LEAVES} update={place} name="falling-leaves">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#f59e0b" emissive={look.glow} emissiveIntensity={0.2} roughness={0.7} />
         </DynamicInstanced>
         <WanderRail run={run} look={look} />
      </group>
   );
}

const BOOKS = 10;
const BOOK_S = new Vector3(0.36, 0.08, 0.5);

function Tower({ level, run, look, reduced }: { level: WizardLevel; run: Run; look: LabLook; reduced: boolean }) {
   const time = useGameTime();
   const ring = useMemo(() => new TorusGeometry(level.radius * 0.62, 0.05, 6, 64).rotateX(Math.PI / 2), [level.radius]);
   useEffect(() => () => ring.dispose(), [ring]);
   const place = (i: number, m: Matrix4) => {
      const a = (i / BOOKS) * Math.PI * 2 + (reduced ? 0 : time.now * 0.15);
      const r = level.radius + 0.9;
      P.set(Math.sin(a) * r, 3.1 + Math.sin((reduced ? 0 : time.now * 1.3) + i) * 0.25, Math.cos(a) * r);
      Q.setFromAxisAngle(AXIS, a * 2);
      m.compose(P, Q, BOOK_S);
   };
   return (
      <group name="master-tower">
         <Starfield count={500} seed={7} upperOnly />
         <mesh geometry={ring} position={[0, 0.03, 0]}>
            <meshBasicMaterial color={look.rune} toneMapped={false} />
         </mesh>
         <DynamicInstanced count={BOOKS} update={place} name="orbiting-books">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#7c3aed" emissive={look.glow} emissiveIntensity={0.45} roughness={0.6} />
         </DynamicInstanced>
         <WanderRail run={run} look={look} />
      </group>
   );
}

export default function Room({ level, run, yaw }: { level: WizardLevel; run: Run; yaw: number }) {
   const look = LAB_THEMES[level.theme];
   const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
   if (look.props === "mushrooms") return <Mushrooms level={level} look={look} yaw={yaw} />;
   if (look.props === "crystals") return <Crystals level={level} run={run} look={look} yaw={yaw} />;
   if (look.props === "forest") return <Forest level={level} run={run} look={look} reduced={reduced} yaw={yaw} />;
   if (look.props === "tower") return <Tower level={level} run={run} look={look} reduced={reduced} />;
   return null;
}
