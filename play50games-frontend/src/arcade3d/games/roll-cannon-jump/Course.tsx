"use client";

// The show itself, drawn from the rules (rules.ts / layouts.ts): every circus cannon is m2RollCannon
// on an m2CannonIsle top over a striped pedestal (the hero's cannon turns with the aim; rail cannons
// slide on their rails, wheel cannons sweep, a paint-jammed cannon goes grey), platforms are striped
// circus drums, m2Trampoline and m2BalloonBunch, the colour orbs (the shared menu2 scoreOrb; Zuno's
// hidden trail only shows under the magnet), fire hoops and the gold finish ring, cracked target
// boards, tent poles (Vexa's ghost poles flicker violet), grey smoke jets, tent walls and trapeze
// banners, the secrets, the aim preview (the card's arc: all of it on L1, half on L2-L3, 30 % after),
// the ghost of the last shot, the power ring round the barrel, and on level 5 Ashbag
// (m2SmokeBlimpBoss) with its pods, gondola, valve and the paint bomb's shadow.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, Object3D, SRGBColorSpace, type Group, type InstancedMesh, type Matrix4, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BOSS_SCALE, CANNON_LENGTH, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS } from "./look";
import { LEVELS } from "./levels";
import { ASHBAG, SECRETS } from "./progression";
import {
   G,
   HERO_R,
   NONE,
   V_TERM,
   bossWindowSpot,
   cannonPos,
   jetLive,
   launchVelocity,
   litPod,
   pulseAt,
   wheelYaw,
   type CannonRun,
} from "./rules";
import { DEG, type SpotDef } from "./show";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const DUMMY = new Object3D();
const P = { x: 0, y: 0, z: 0 };
const V = { x: 0, y: 0, z: 0 };
const JAMMED = new Color("#5c5a58");
const HIDDEN = new Color("#c7b9a2");

/** A cannon's drawn pitch: the barrel tilts with the aim, a little less than the shot (it reads, never clips). */
function drawnPitch(p: number): number {
   return Math.min(55 * DEG, p * 0.75);
}

function stripeTexture(a: string, b: string, n: number): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 256;
   c.height = 16;
   const g = c.getContext("2d")!;
   for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? a : b;
      g.fillRect((i * 256) / n, 0, 256 / n + 1, 16);
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

function targetTexture(): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = c.height = 128;
   const g = c.getContext("2d")!;
   const rings = ["#e9dcc2", "#b23a30", "#e9dcc2", "#b23a30", "#f6c453"];
   rings.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(64, 64, 62 - i * 12, 0, Math.PI * 2);
      g.fill();
   });
   g.strokeStyle = "#3a2a20";
   g.lineWidth = 3;
   g.beginPath();
   g.moveTo(30, 20);
   g.lineTo(58, 60);
   g.lineTo(44, 100);
   g.moveTo(58, 60);
   g.lineTo(98, 76);
   g.stroke();
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** Pedestals under every cannon, platform and trampoline: one instanced striped column. */
function Pedestals({ run }: { run: CannonRun }) {
   const ref = useRef<InstancedMesh>(null);
   const tex = useMemo(() => stripeTexture(COLORS.cream, COLORS.ash, 10), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const cols = useMemo(() => {
      const out: { x: number; z: number; top: number; r: number }[] = [];
      for (const c of run.course.cannons) if (!c.rail && !c.stage) out.push({ x: c.x, z: c.z, top: c.y - 1.25, r: 0.32 });
      for (const p of run.course.platforms) out.push({ x: p.x, z: p.z, top: p.y - 0.6, r: Math.min(p.hw, p.hd) * 0.45 });
      for (const t of run.course.tramps) out.push({ x: t.x, z: t.z, top: t.y - 0.2, r: 0.3 });
      return out;
   }, [run.course]);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      cols.forEach((c, i) => {
         DUMMY.position.set(c.x, c.top / 2, c.z);
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.scale.set(c.r, Math.max(0.1, c.top), c.r);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   }, [cols]);
   if (cols.length === 0) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, cols.length]}>
         <cylinderGeometry args={[1, 1.15, 1, 14]} />
         <meshStandardMaterial map={tex} roughness={0.75} />
      </instancedMesh>
   );
}

/** The circus drums (platforms): a striped side, a cream top, a gold rim. */
function Drums({ run }: { run: CannonRun }) {
   const tex = useMemo(() => stripeTexture(COLORS.red, COLORS.cream, 16), []);
   useEffect(() => () => tex.dispose(), [tex]);
   return (
      <>
         {run.course.platforms.map((p, i) => (
            <group key={i} position={[p.x, p.y, p.z]}>
               {p.round ? (
                  <>
                     <mesh position={[0, -0.35, 0]}>
                        <cylinderGeometry args={[p.hw, p.hw, 0.7, 40, 1, true]} />
                        <meshStandardMaterial map={tex} roughness={0.7} side={DoubleSide} />
                     </mesh>
                     <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
                        <circleGeometry args={[p.hw, 40]} />
                        <meshStandardMaterial color={COLORS.standTop} roughness={0.85} />
                     </mesh>
                     <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
                        <ringGeometry args={[p.hw - 0.25, p.hw, 40]} />
                        <meshStandardMaterial color={COLORS.brass} metalness={0.5} roughness={0.4} />
                     </mesh>
                  </>
               ) : (
                  <>
                     <mesh position={[0, -0.35, 0]}>
                        <boxGeometry args={[p.hw * 2, 0.7, p.hd * 2]} />
                        <meshStandardMaterial map={tex} roughness={0.7} />
                     </mesh>
                     <mesh position={[0, 0.01, 0]}>
                        <boxGeometry args={[p.hw * 2 - 0.1, 0.04, p.hd * 2 - 0.1]} />
                        <meshStandardMaterial color={COLORS.standTop} roughness={0.85} />
                     </mesh>
                  </>
               )}
            </group>
         ))}
      </>
   );
}

/** Every cannon (one pool): the hero's barrel follows the aim, rails slide, wheels sweep. */
function Cannons({ run, clock }: { run: CannonRun; clock: VisualClock }) {
   const course = run.course;
   const k = CANNON_LENGTH / GLB_SIZE.cannon.z;
   const isleK = 1.5 / GLB_SIZE.isle.x;
   const update = (i: number, m: Matrix4, color?: Color) => {
      const c = course.cannons[i];
      const ms = Math.max(0, clock.ms);
      cannonPos(c, ms, P);
      const h = run.hero;
      const mine = (h.mode === "aim" || h.mode === "catch") && h.cannon === i;
      const yaw = mine ? h.yaw : wheelYaw(c, ms);
      const pitch = drawnPitch(mine ? h.pitch : c.pitch);
      // the model's mouth (its -z end) sits at the rules' mouth; it stands on the isle
      DUMMY.position.set(P.x, P.y - 1.2, P.z);
      DUMMY.rotation.set(0, yaw, 0, "YXZ");
      DUMMY.updateMatrix();
      m.copy(DUMMY.matrix);
      DUMMY.position.set(0, 0, CANNON_LENGTH * 0.3);
      DUMMY.rotation.set(pitch, 0, 0);
      DUMMY.scale.setScalar(k);
      DUMMY.updateMatrix();
      m.multiply(DUMMY.matrix);
      DUMMY.scale.setScalar(1);
      if (color) {
         if (ms < run.jamUntil[i]) color.copy(JAMMED);
         else if (c.board >= 0 && !run.broken[c.board]) color.copy(HIDDEN);
      }
   };
   const isles = useMemo<InstanceSpot[]>(
      () => course.cannons.filter((c) => !c.rail && !c.stage).map((c) => ({ x: c.x, y: c.y - 1.25 - GLB_SIZE.isle.top * isleK, z: c.z, scale: isleK })),
      [course, isleK],
   );
   const rails = course.cannons.filter((c) => c.rail);
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.cannon} count={course.cannons.length} update={update} name="cannons" />
         <InstancedModel asset={ASSETS.isle} spots={isles} fallback={null} />
         {rails.map((c, i) => {
            const r = c.rail!;
            const len = r.travel * 2 + 1.6;
            return (
               <group key={i} position={[c.x, c.y - 1.3, c.z]} rotation-y={Math.atan2(r.ax, r.az) + Math.PI / 2}>
                  <mesh>
                     <boxGeometry args={[len, 0.18, 0.5]} />
                     <meshStandardMaterial color={COLORS.brass} metalness={0.6} roughness={0.35} />
                  </mesh>
                  {[-1, 1].map((s) => (
                     <mesh key={s} position={[(s * len) / 2, -(c.y - 1.3) / 2, 0]}>
                        <cylinderGeometry args={[0.18, 0.24, c.y - 1.3, 10]} />
                        <meshStandardMaterial color={COLORS.pole} roughness={0.6} />
                     </mesh>
                  ))}
               </group>
            );
         })}
      </>
   );
}

/** The power ring round the hero's barrel: 24 segments lit up to the pulse; gold at 100 %. */
function PowerRing({ run }: { run: CannonRun }) {
   const ref = useRef<InstancedMesh>(null);
   const N = 24;
   const lit = useMemo(() => new Color(COLORS.gold), []);
   const hot = useMemo(() => new Color("#fff3b0"), []);
   const off = useMemo(() => new Color("#3a3330"), []);
   const last = useRef(-1);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = run.hero;
      const show = h.mode === "aim";
      m.visible = show;
      if (!show) return;
      const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
      const power = !c || c.kind === "aim" ? pulseAt(run.simMs - h.aimFrom) : c.power;
      const frac = (power - 0.6) / 0.4;
      const fx = -Math.sin(h.yaw);
      const fz = -Math.cos(h.yaw);
      for (let i = 0; i < N; i++) {
         const a = (i / N) * Math.PI * 2;
         // a ring in the plane facing the barrel's forward
         const rx = Math.cos(a) * 0.95;
         const ry = Math.sin(a) * 0.95;
         DUMMY.position.set(h.x + rx * fz + fx * 0.25, h.y + 0.3 + ry, h.z - rx * fx + fz * 0.25);
         DUMMY.rotation.set(0, h.yaw, a);
         DUMMY.scale.set(0.14, 0.06, 0.06);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      const on = Math.round(frac * N);
      const key = on + (power >= 0.995 ? 100 : 0);
      if (key !== last.current) {
         last.current = key;
         for (let i = 0; i < N; i++) m.setColorAt(i, i < on ? (power >= 0.995 ? hot : lit) : off);
         if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, N]} frustumCulled={false} renderOrder={4}>
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
   );
}

/**
 * The aim preview: dots along the arc the shot would fly now (a share of it per level), and the
 * faint ghost of the last shot (the card's risk fix: the same arc twice is the same shot).
 */
function ArcDots({ run }: { run: CannonRun }) {
   const aim = useRef<InstancedMesh>(null);
   const ghost = useRef<InstancedMesh>(null);
   const N = 40;
   const share = LEVELS[run.level].preview;
   const fill = (m: InstancedMesh, x: number, y: number, z: number, vx: number, vy: number, vz: number, part: number) => {
      // the full flight: until the arc drops under the net
      let t = 0;
      let yy = y;
      let vvy = vy;
      while (t < 4 && yy > run.course.killY) {
         t += 0.02;
         vvy = Math.max(-V_TERM, vvy - G * 0.02);
         yy += vvy * 0.02;
      }
      const T = t * part;
      for (let i = 0; i < N; i++) {
         const s = (T * (i + 1)) / N;
         DUMMY.position.set(x + vx * s, y + vy * s - (G / 2) * s * s, z + vz * s);
         DUMMY.scale.setScalar(0.11 * (1 - (i / N) * 0.5));
         DUMMY.rotation.set(0, 0, 0);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
   };
   useFrame(() => {
      const h = run.hero;
      const a = aim.current;
      const g = ghost.current;
      if (!a || !g) return;
      const show = h.mode === "aim";
      a.visible = show;
      g.visible = show && run.ghost.at !== NONE;
      if (!show) return;
      const c = h.cannon >= 0 ? run.course.cannons[h.cannon] : null;
      const power = !c || c.kind === "aim" ? pulseAt(run.simMs - h.aimFrom) : c.power;
      launchVelocity(h.yaw, h.pitch, power, V);
      fill(a, h.x, h.y, h.z, V.x, V.y, V.z, share);
      const gs = run.ghost;
      fill(g, gs.x, gs.y, gs.z, gs.vx, gs.vy, gs.vz, 1);
   });
   return (
      <>
         <instancedMesh ref={aim} args={[undefined, undefined, N]} frustumCulled={false} renderOrder={5}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={COLORS.aim} toneMapped={false} />
         </instancedMesh>
         <instancedMesh ref={ghost} args={[undefined, undefined, N]} frustumCulled={false} renderOrder={5}>
            <sphereGeometry args={[0.6, 6, 4]} />
            <meshBasicMaterial color={COLORS.ghostArc} transparent opacity={0.35} depthWrite={false} />
         </instancedMesh>
      </>
   );
}

/** Fire hoops (flickering orange) and the gold finish ring. */
function Rings({ run }: { run: CannonRun }) {
   const course = run.course;
   const hoopRefs = useRef<(MeshStandardMaterial | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      hoopRefs.current.forEach((m, i) => {
         if (!m) return;
         m.emissiveIntensity = run.hooped[i] ? 0.4 : 1.4 + 0.5 * Math.sin(time.now * 14 + i * 2);
      });
   });
   const f = course.finish;
   return (
      <>
         {course.hoops.map((hp, i) => (
            <group key={i} position={[hp.x, hp.y, hp.z]} rotation-y={hp.yaw}>
               <mesh>
                  <torusGeometry args={[hp.r, 0.12, 10, 36]} />
                  <meshStandardMaterial
                     ref={(m) => {
                        hoopRefs.current[i] = m;
                     }}
                     color="#5a3a24"
                     emissive={COLORS.flame}
                     emissiveIntensity={1.4}
                     metalness={0.4}
                     roughness={0.5}
                  />
               </mesh>
               <mesh>
                  <torusGeometry args={[hp.r, 0.32, 6, 24]} />
                  <meshBasicMaterial color={COLORS.flame} transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
               </mesh>
               <mesh position={[0, -hp.r - 1.5, 0]}>
                  <cylinderGeometry args={[0.06, 0.08, 3, 6]} />
                  <meshStandardMaterial color={COLORS.pole} />
               </mesh>
            </group>
         ))}
         {f ? (
            <group position={[f.x, f.y, f.z]} rotation-y={f.yaw}>
               <mesh>
                  <torusGeometry args={[f.r, 0.2, 14, 48]} />
                  <meshStandardMaterial color={COLORS.gold} emissive="#b8860b" emissiveIntensity={0.7} metalness={0.7} roughness={0.25} />
               </mesh>
               <mesh>
                  <circleGeometry args={[f.r - 0.1, 40]} />
                  <meshBasicMaterial color="#fff3c4" transparent opacity={0.18} side={DoubleSide} depthWrite={false} toneMapped={false} />
               </mesh>
               {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * (f.r + 0.2), -f.y / 2 - f.r * 0.2, 0]}>
                     <cylinderGeometry args={[0.12, 0.16, f.y, 8]} />
                     <meshStandardMaterial color={COLORS.brass} metalness={0.6} roughness={0.35} />
                  </mesh>
               ))}
            </group>
         ) : null}
      </>
   );
}

/** Target boards (hidden once smashed), tent poles, smoke jets, tent walls and trapeze banners. */
function Obstacles({ run, clock }: { run: CannonRun; clock: VisualClock }) {
   const course = run.course;
   const target = useMemo(() => targetTexture(), []);
   const canvas = useMemo(() => stripeTexture(COLORS.cream, "#8d857d", 12), []);
   useEffect(
      () => () => {
         target.dispose();
         canvas.dispose();
      },
      [target, canvas],
   );
   const boardRefs = useRef<(Group | null)[]>([]);
   const jetRefs = useRef<(Mesh | null)[]>([]);
   const ghostRefs = useRef<(MeshStandardMaterial | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      boardRefs.current.forEach((g, i) => {
         if (g) g.visible = !run.broken[i];
      });
      jetRefs.current.forEach((m, i) => {
         if (!m) return;
         const j = course.jets[i];
         const on = jetLive(j, ms);
         const soon = !on && jetLive(j, ms + 350);
         const mat = m.material as MeshBasicMaterial;
         mat.opacity = on ? 0.5 + 0.08 * Math.sin(time.now * 9 + i) : soon ? 0.16 : 0.05;
         m.scale.set(on ? 1 + 0.06 * Math.sin(time.now * 7 + i) : 0.55, 1, on ? 1 + 0.06 * Math.cos(time.now * 6 + i) : 0.55);
      });
      const phasing = run.simMs <= run.hero.phaseUntil;
      ghostRefs.current.forEach((m, i) => {
         if (!m) return;
         m.opacity = phasing ? 0.18 : 0.45 + 0.12 * Math.sin(time.now * 3 + i);
      });
   });
   let ghostK = 0;
   return (
      <>
         {course.boards.map((b, i) => (
            <group
               key={i}
               ref={(g) => {
                  boardRefs.current[i] = g;
               }}
               position={[b.x, b.y, b.z]}
            >
               <mesh rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[Math.max(b.hx, b.hy), Math.max(b.hx, b.hy), b.hz * 2, 32]} />
                  <meshStandardMaterial color={COLORS.board} roughness={0.8} />
               </mesh>
               <mesh position={[0, 0, b.hz + 0.01]}>
                  <circleGeometry args={[Math.max(b.hx, b.hy) - 0.04, 32]} />
                  <meshStandardMaterial map={target} roughness={0.8} />
               </mesh>
               <mesh position={[0, -b.y / 2, 0]}>
                  <cylinderGeometry args={[0.08, 0.1, b.y, 6]} />
                  <meshStandardMaterial color={COLORS.pole} />
               </mesh>
            </group>
         ))}
         {course.poles.map((p, i) => {
            const k = p.ghost ? ghostK++ : -1;
            return (
               <mesh key={i} position={[p.x, (p.y0 + p.y1) / 2, p.z]}>
                  <cylinderGeometry args={[p.r, p.r * 1.1, p.y1 - p.y0, 14]} />
                  {p.ghost ? (
                     <meshStandardMaterial
                        ref={(m) => {
                           ghostRefs.current[k] = m;
                        }}
                        color={COLORS.ghost}
                        emissive="#7c3aed"
                        emissiveIntensity={0.8}
                        transparent
                        opacity={0.5}
                        depthWrite={false}
                     />
                  ) : (
                     <meshStandardMaterial color={COLORS.pole} roughness={0.6} />
                  )}
               </mesh>
            );
         })}
         {course.jets.map((j, i) => (
            <group key={i}>
               <mesh
                  ref={(m) => {
                     jetRefs.current[i] = m;
                  }}
                  position={[j.x, (j.y0 + j.y1) / 2, j.z]}
               >
                  <cylinderGeometry args={[j.r * 0.85, j.r * 0.55, j.y1 - j.y0, 16, 1, true]} />
                  <meshBasicMaterial color={COLORS.smoke} transparent opacity={0.4} depthWrite={false} side={DoubleSide} />
               </mesh>
               <mesh position={[j.x, j.y0 / 2, j.z]}>
                  <cylinderGeometry args={[0.45, 0.6, j.y0, 10]} />
                  <meshStandardMaterial color="#4a4744" metalness={0.5} roughness={0.5} />
               </mesh>
            </group>
         ))}
         {course.walls.map((w, i) => {
            const sx = w.maxX - w.minX;
            const sy = w.maxY - w.minY;
            const sz = w.maxZ - w.minZ;
            const cx = (w.minX + w.maxX) / 2;
            const cz = (w.minZ + w.maxZ) / 2;
            if (w.kind === "trapeze") {
               // a banner hanging from the roof, a bar along its foot
               const banner = Math.min(sy, 6);
               return (
                  <group key={i}>
                     <mesh position={[cx, w.minY + banner / 2 + 0.15, cz]}>
                        <boxGeometry args={[sx, banner, Math.max(0.06, sz * 0.5)]} />
                        <meshStandardMaterial map={canvas} roughness={0.9} />
                     </mesh>
                     <mesh position={[cx, w.minY + 0.08, cz]} rotation-z={Math.PI / 2}>
                        <cylinderGeometry args={[0.08, 0.08, sx + 0.4, 8]} />
                        <meshStandardMaterial color={COLORS.brass} metalness={0.6} roughness={0.3} />
                     </mesh>
                     {[-1, 1].map((s) => (
                        <mesh key={s} position={[cx + (s * sx) / 2, w.minY + banner + (sy - banner) / 2, cz]}>
                           <cylinderGeometry args={[0.03, 0.03, sy - banner, 4]} />
                           <meshStandardMaterial color="#2b2522" />
                        </mesh>
                     ))}
                  </group>
               );
            }
            return (
               <mesh key={i} position={[cx, (w.minY + w.maxY) / 2, cz]}>
                  <boxGeometry args={[sx, sy, sz]} />
                  <meshStandardMaterial map={canvas} roughness={0.9} />
               </mesh>
            );
         })}
      </>
   );
}

/** The secrets: a glowing crystal (shard) or a round badge (sticker), hidden once found. */
function Secrets({ run }: { run: CannonRun }) {
   const list = SECRETS[run.level];
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      list.forEach((_s, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6 + i;
         m.position.y = run.course.secrets[i].y + Math.sin(time.now * 2 + i) * 0.12;
      });
   });
   return (
      <>
         {list.map((s, i) => {
            const p = run.course.secrets[i];
            return (
               <mesh
                  key={s.id}
                  ref={(m) => {
                     refs.current[i] = m;
                  }}
                  position={[p.x, p.y, p.z]}
               >
                  {s.kind === "shard" ? <octahedronGeometry args={[0.34, 0]} /> : <cylinderGeometry args={[0.36, 0.36, 0.06, 20]} />}
                  <meshStandardMaterial color={s.kind === "shard" ? "#fca5a5" : "#f9a8d4"} emissive={s.kind === "shard" ? "#ef4444" : "#f472b6"} emissiveIntensity={0.9} roughness={0.3} />
               </mesh>
            );
         })}
      </>
   );
}

const CENTRE: SpotDef = { x: 0, y: 0, z: 0 };
const PART: SpotDef = { x: 0, y: 0, z: 0 };
const PREV: SpotDef = { x: 0, y: 0, z: 0 };
const PREVP: SpotDef = { x: 0, y: 0, z: 0 };
const POD_OFF = [0, 2.1, -2.1];

/**
 * Ashbag (level 5): m2SmokeBlimpBoss, 10 m long. Between windows it drifts round the ring to the
 * next hover spot (and rises for the valve); in a window it hangs still with the hittable part
 * glowing (the lit pod, the gondola, the valve); it flashes and recoils on a hit, shudders on the
 * telegraph and sinks on its defeat. The paint bomb's shadow marks the cannon it will jam.
 */
function Boss({ run }: { run: CannonRun }) {
   const body = useRef<Group>(null);
   const pods = useRef<(Mesh | null)[]>([]);
   const part = useRef<Mesh>(null);
   const mark = useRef<Mesh>(null);
   const time = useGameTime();
   const a = run.course.arena!;
   const pos = useRef({ x: a.x + a.circleR, y: a.circleY + 8, z: a.z, yaw: 0, placed: false });
   const lastHp = useRef(ASHBAG.maxHp);
   const recoil = useRef(0);
   useFrame((_s, delta) => {
      const b = run.boss;
      const g = body.current;
      if (!b || !g) return;
      const dt = Math.min(0.1, delta);
      const p = pos.current;
      const on = run.arenaAt !== NONE;
      bossWindowSpot(run, b.phase, b.attack, CENTRE, PART);
      let tx = CENTRE.x;
      let ty = CENTRE.y;
      let tz = CENTRE.z;
      if (!on) {
         // waiting over the far side of the ring before the hero arrives
         const ang = time.now * 0.25;
         tx = a.x + Math.sin(ang) * a.circleR;
         ty = a.circleY + 4;
         tz = a.z + Math.cos(ang) * a.circleR;
      } else if (b.step !== "vulnerable") {
         // drifting from the last spot to the next one, round the ring
         bossWindowSpot(run, b.phase, Math.max(0, b.attack - 1), PREV, PREVP);
         const k = b.step === "telegraph" ? 0.2 * stepProgress(b, ASHBAG) : b.step === "attack" ? 0.2 + 0.8 * stepProgress(b, ASHBAG) : 0;
         const a0 = Math.atan2(PREV.x - a.x, PREV.z - a.z);
         let a1 = Math.atan2(tx - a.x, tz - a.z);
         if (a1 - a0 > Math.PI) a1 -= Math.PI * 2;
         if (a0 - a1 > Math.PI) a1 += Math.PI * 2;
         const ang = a0 + (a1 - a0) * k;
         const r0 = Math.hypot(PREV.x - a.x, PREV.z - a.z);
         const r1 = Math.hypot(tx - a.x, tz - a.z);
         const r = Math.max(4, r0 + (r1 - r0) * k) + Math.sin(k * Math.PI) * 3;
         tx = a.x + Math.sin(ang) * r;
         tz = a.z + Math.cos(ang) * r;
         ty = PREV.y + (ty - PREV.y) * k + Math.sin(k * Math.PI) * 2;
      }
      const kz = p.placed ? 1 - Math.exp(-3.5 * dt) : 1;
      p.placed = true;
      p.x += (tx - p.x) * kz;
      p.y += (ty - p.y) * kz;
      p.z += (tz - p.z) * kz;
      const defeat = b.step === "defeat" || b.step === "done";
      const sink = defeat ? Math.min(1, b.stepMs / ASHBAG.defeatMs) : 0;
      if (b.hp < lastHp.current) recoil.current = 1;
      lastHp.current = b.hp;
      recoil.current = Math.max(0, recoil.current - dt * 3);
      const shudder = b.step === "telegraph" ? 0.06 * Math.sin(time.now * 40) : 0;
      g.position.set(p.x + shudder, p.y - sink * 12 + Math.sin(time.now * 1.1) * 0.3, p.z);
      // nose along the drift, towards the stage while it hangs
      const face = Math.atan2(a.x - p.x, a.z - p.z) + Math.PI / 2;
      let dy = face - p.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.yaw += dy * (1 - Math.exp(-2 * dt));
      g.rotation.set(recoil.current * 0.25 + sink * 0.4, p.yaw, Math.sin(time.now * 0.7) * 0.05 + sink * 0.6);
      const flash = b.flashMs > 0 ? 1.12 : 1;
      g.scale.setScalar(BOSS_SCALE * flash * (1 - sink * 0.5));
      g.visible = b.step !== "done";
      // the pods: the lit one swells and glows in its window, popped ones are gone
      const lit = litPod(run);
      pods.current.forEach((m, k) => {
         if (!m) return;
         m.visible = b.phase === 0 && !run.pods[k];
         const glow = k === lit && b.step === "vulnerable";
         m.scale.setScalar(glow ? 1.25 + 0.08 * Math.sin(time.now * 10) : 0.9);
         (m.material as MeshStandardMaterial).emissiveIntensity = glow ? 1.6 : k === lit && b.step === "telegraph" ? 0.8 : 0.1;
      });
      // the hittable part's halo, in world space
      const pm = part.current;
      if (pm) {
         const open = on && b.step === "vulnerable";
         pm.visible = open;
         pm.position.set(PART.x, PART.y, PART.z);
         pm.scale.setScalar(1 + 0.1 * Math.sin(time.now * 9));
      }
      const mm = mark.current;
      if (mm) {
         const i = run.bombMark;
         mm.visible = i >= 0;
         if (i >= 0) {
            const c = run.course.cannons[i];
            mm.position.set(c.x, c.y - 1.15, c.z);
            mm.scale.setScalar(0.6 + stepProgress(b, ASHBAG) * 0.8);
         }
      }
   });
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.boss} />
            {POD_OFF.map((dz, k) => (
               <mesh
                  key={k}
                  ref={(m) => {
                     pods.current[k] = m;
                  }}
                  position={[0, GLB_SIZE.boss.y * 0.45, dz / BOSS_SCALE + (k === 0 ? GLB_SIZE.boss.z * 0.55 : 0)]}
               >
                  <sphereGeometry args={[0.13, 14, 10]} />
                  <meshStandardMaterial color="#8b8f94" emissive="#ffb347" emissiveIntensity={0.1} roughness={0.6} />
               </mesh>
            ))}
         </group>
         <mesh ref={part} visible={false} renderOrder={6}>
            <sphereGeometry args={[1.5, 20, 14]} />
            <meshBasicMaterial color="#ffd27a" transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={mark} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
            <circleGeometry args={[1.6, 28]} />
            <meshBasicMaterial color="#141210" transparent opacity={0.55} depthWrite={false} />
         </mesh>
      </>
   );
}

export function Course({ run, clock }: { run: CannonRun; clock: VisualClock }) {
   const course = run.course;
   const time = useGameTime();
   const orbs = course.orbs;
   const tramps = useMemo<InstanceSpot[]>(
      () => course.tramps.map((t) => ({ x: t.x, y: t.y - GLB_SIZE.trampoline.top * ((t.r * 2) / GLB_SIZE.trampoline.x), z: t.z, scale: (t.r * 2) / GLB_SIZE.trampoline.x })),
      [course],
   );
   const magnetUp = () => run.simMs <= run.hero.magnetUntil;
   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      if (o.hidden && !magnetUp()) return false;
      if (o.pod >= 0 && !run.pods[o.pod]) return false;
      const s = ORB_SIZE / GLB_SIZE.orb.y;
      DUMMY.position.set(o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i * 0.7) * 0.1, o.z);
      DUMMY.rotation.set(0, time.now * 2 + i, 0);
      DUMMY.scale.setScalar(s);
      DUMMY.updateMatrix();
      m.copy(DUMMY.matrix);
   };
   const balloonK = 2.4 / GLB_SIZE.balloon.y;
   const balloonUpdate = (i: number, m: Matrix4) => {
      if (run.popped[i]) return false;
      const b = course.balloons[i];
      DUMMY.position.set(b.x, b.y - 1.2 + Math.sin(time.now * 1.5 + i) * 0.15, b.z);
      DUMMY.rotation.set(0, time.now * 0.3, 0);
      DUMMY.scale.setScalar(balloonK);
      DUMMY.updateMatrix();
      m.copy(DUMMY.matrix);
   };
   return (
      <>
         <Pedestals run={run} />
         <Drums run={run} />
         <Cannons run={run} clock={clock} />
         {tramps.length > 0 ? <InstancedModel asset={ASSETS.trampoline} spots={tramps} fallback={null} /> : null}
         {course.balloons.length > 0 ? <DynamicInstancedModel asset={ASSETS.balloon} count={course.balloons.length} update={balloonUpdate} name="balloons" /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.orb} count={orbs.length} update={orbUpdate} name="orbs" /> : null}
         <Rings run={run} />
         <Obstacles run={run} clock={clock} />
         <Secrets run={run} />
         <PowerRing run={run} />
         <ArcDots run={run} />
         {run.boss ? <Boss run={run} /> : null}
      </>
   );
}

export { HERO_R };
