"use client";

// The playable peak (everything with a rule behind it): the ice sheets, snow patches and cracked ice
// (each a stretched Hyper3D slab; cracked ice trembles once touched and is gone while it regrows; level
// 4's snow darkens while its lantern is out), the golem's slope, steps and cairn climb (level 5, only in
// their phase), the frozen walls (Zuno's coin trails, Vexa's ghost ice, the mitten cube), the orbs and
// secrets, the icicles (they shake, then drop), the yeti and his snowballs (a shadow marks where each
// lands), the rolling snowballs, the ice slimes, Kiro's icicle-rain chute, the lanterns, the checkpoint
// beacons, the summit cairn, and the landing arc (levels 1-2). Few draw calls: one pool per model.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Euler, PlaneGeometry, Quaternion, Vector3, type Color, type Matrix4, type Mesh, type Group } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE, SLIME_H, YETI_H } from "./assets";
import { COLORS } from "./look";
import { SECRETS } from "./progression";
import { DIRS, halfAlong, type Plat } from "./course";
import {
   APEX,
   ARC_MIN_V,
   FALL_X,
   G,
   ICICLE,
   ROLLER_R,
   V_JUMP,
   V_LAUNCH_MIN,
   YETI,
   grips,
   icicleState,
   lanternLit,
   platSolid,
   rollerAt,
   slimeAt,
   wallSolid,
   type PeakRun,
} from "./rules";

const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const XZ = { x: 0, z: 0 };

/** A soft round glow (white centre fading to clear). */
const drawGlow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.35, "rgba(255,255,255,0.55)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

/** How thick each surface's slab is drawn (m below its top). */
const THICK = { ice: 1.0, snow: 1.2, cracked: 0.5 } as const;

type Look = "ice" | "snow" | "snow2" | "cracked" | "block";

function lookOf(p: Plat): Look {
   if (p.ramp) return "ice";
   if (p.surface === "cracked") return "cracked";
   if (p.surface === "snow") return p.hx * p.hz < 5 ? "snow2" : "snow";
   return p.kind === "boss" ? "block" : "ice";
}

/** One pool per platform look: stretched to the platform's footprint, its top at the platform's top. */
function PlatPool({ run, look }: { run: PeakRun; look: Look }) {
   const time = useGameTime();
   const list = useMemo(() => run.course.plats.filter((p) => !p.ramp && lookOf(p) === look), [run.course, look]);
   const g = GLB_SIZE[look === "snow2" ? "snow2" : look];
   const update = (i: number, m: Matrix4, color: Color) => {
      const p = list[i];
      if (!platSolid(run, p)) return false;
      const thick = look === "block" ? 1.4 : THICK[p.surface];
      let jx = 0;
      let jz = 0;
      const touched = run.touchedAt[p.id];
      if (p.crumbleMs > 0 && touched >= 0) {
         // trembling until it goes (harder near the end)
         const k = Math.min(1, (run.ms - touched) / p.crumbleMs);
         jx = Math.sin(time.now * 70 + p.id) * 0.05 * k;
         jz = Math.cos(time.now * 63 + p.id) * 0.05 * k;
      }
      E.set(0, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(p.x + jx, p.y - thick, p.z + jz), Q, S.set((2 * p.hx) / g.x, thick / g.y, (2 * p.hz) / g.z));
      if (p.lantern >= 0) color.set(grips(run, p) ? "#ffffff" : "#6b7cab");
      else if (p.phase >= 0) color.set("#dbeafe");
   };
   if (list.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS[look]} count={list.length} update={update} name={`plats-${look}`} tinted />;
}

/** The golem's slam slopes: a tilted ice slab (code: the slope is a moving part of the fight). */
function Ramps({ run }: { run: PeakRun }) {
   const ramps = useMemo(() => run.course.plats.filter((p) => p.ramp), [run.course]);
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      ramps.forEach((p, i) => {
         const m = refs.current[i];
         if (m) m.visible = platSolid(run, p);
      });
   });
   return (
      <>
         {ramps.map((p, i) => {
            const r = p.ramp!;
            const h = halfAlong(p, r.dir) * 2;
            const len = Math.hypot(h, r.rise);
            const ang = Math.atan2(r.rise, h);
            const d = DIRS[r.dir];
            const yaw = Math.atan2(d.x, d.z);
            const w = r.dir === "N" || r.dir === "S" ? p.hx * 2 : p.hz * 2;
            return (
               <group key={p.id} position={[p.x, p.y + r.rise / 2, p.z]} rotation-y={yaw}>
                  <mesh ref={(m) => { refs.current[i] = m; }} rotation-x={-ang} position={[0, -0.25, 0]}>
                     <boxGeometry args={[w, 0.5, len]} />
                     <meshStandardMaterial color={COLORS.ice} roughness={0.15} metalness={0.1} emissive="#3b82f6" emissiveIntensity={0.15} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

/** The frozen walls: Zuno's coin trails (clear ice), Vexa's ghost ice (violet, see-through while phasing), the mitten cube. */
function Walls({ run }: { run: PeakRun }) {
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      run.course.walls.forEach((w, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.broken[i];
         if (w.kind === "ghost") {
            const mat = m.material as { opacity: number };
            mat.opacity = wallSolid(run, i) ? 0.55 : 0.18;
         }
      });
   });
   return (
      <>
         {run.course.walls.map((w, i) => (
            <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[w.x, (w.y0 + w.y1) / 2, w.z]}>
               <boxGeometry args={[w.hx * 2, w.y1 - w.y0, w.hz * 2]} />
               <meshStandardMaterial
                  color={w.kind === "ghost" ? COLORS.ghost : w.kind === "cube" ? "#dbeafe" : COLORS.trail}
                  transparent
                  opacity={w.kind === "ghost" ? 0.55 : w.kind === "cube" ? 0.7 : 0.45}
                  roughness={0.1}
                  metalness={0.1}
                  emissive={w.kind === "ghost" ? "#7c3aed" : "#0ea5e9"}
                  emissiveIntensity={0.25}
                  depthWrite={false}
               />
            </mesh>
         ))}
      </>
   );
}

/** The orbs (shared scoreOrb) with a halo tinted by whose route they are on; collected ones gone. */
function Orbs({ run }: { run: PeakRun }) {
   const c = run.course;
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const orb = (i: number, m: Matrix4) => {
      const o = c.orbs[i];
      if (run.collected[i]) return false;
      E.set(0, time.now * 2.2 + i, 0);
      Q.setFromEuler(E);
      m.compose(V.set(o.x, o.y - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i) * 0.1, o.z), Q, S.set(k, k, k));
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const o = c.orbs[i];
      if (run.collected[i]) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(o.x, o.y + Math.sin(time.now * 2 + i) * 0.1, o.z), camera.quaternion, S.set(sz, sz, sz));
      const b = o.bonus;
      color.set(b === "vexa" ? "#c4b5fd" : b === "kiro" ? "#86efac" : b === "riko" ? "#fca5a5" : b === "zuno" ? "#fde68a" : b === "nami" ? "#93c5fd" : b === "ride" ? "#e0f2fe" : "#ffe08a");
   };
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(() => () => plane.dispose(), [plane]);
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.orb} count={c.orbs.length} update={orb} name="orbs" />
         <DynamicInstanced count={c.orbs.length} update={halo} name="orb-halos" tinted>
            <primitive object={plane} attach="geometry" />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The secrets: an ice crystal (shard) or a golden badge (the mitten sticker); hidden once found. */
function Secrets({ run }: { run: PeakRun }) {
   const list = SECRETS[run.level];
   const time = useGameTime();
   const groups = useRef<(Group | null)[]>([]);
   useFrame(() => {
      list.forEach((_s, i) => {
         const g = groups.current[i];
         if (!g) return;
         g.visible = !run.secrets.found[i];
         g.rotation.y = time.now * 1.4 + i;
         g.position.y = run.course.secrets[i].y - 0.45 + Math.sin(time.now * 2 + i) * 0.1;
      });
   });
   const kc = 0.9 / GLB_SIZE.crystal.y;
   return (
      <>
         {list.map((s, i) => {
            const at = run.course.secrets[i];
            return (
               <group key={s.id} ref={(g) => { groups.current[i] = g; }} position={[at.x, at.y, at.z]}>
                  {s.kind === "shard" ? (
                     <group scale={kc}>
                        <Model asset={ASSETS.crystal} />
                     </group>
                  ) : (
                     <mesh position={[0, 0.45, 0]} rotation-x={Math.PI / 2}>
                        <cylinderGeometry args={[0.38, 0.38, 0.06, 20]} />
                        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.8} metalness={0.6} roughness={0.3} />
                     </mesh>
                  )}
               </group>
            );
         })}
      </>
   );
}

/** Icicles over the routes (level 2): they shake 0.8 s once you pass under, then drop and regrow. */
function Icicles({ run }: { run: PeakRun }) {
   const time = useGameTime();
   const list = run.course.icicles;
   const k = 1.4 / GLB_SIZE.icicle.y;
   const update = (i: number, m: Matrix4) => {
      const c = list[i];
      const st = icicleState(run, i);
      if (st >= 3) return false;
      let y = c.y + 4.4;
      let jx = 0;
      if (st > 0 && st < 1) jx = Math.sin(time.now * 60 + i) * 0.06 * st;
      if (st >= 1) y -= (st - 1) * 4.2;
      // hanging: the model upside down (its tips point down)
      E.set(Math.PI, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(c.x + jx, y + GLB_SIZE.icicle.y * k, c.z), Q, S.set(k * 0.7, k, k * 0.7));
   };
   // the warning ring on the ice under a shaking icicle
   const ring = (i: number, m: Matrix4) => {
      const st = icicleState(run, i);
      if (st <= 0 || st >= 2) return false;
      const c = list[i];
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      const s = ICICLE.hitR * (0.6 + 0.4 * Math.min(1, st));
      m.compose(V.set(c.x, c.y + 0.04, c.z), Q, S.set(s, s, s));
   };
   if (list.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.icicle} count={list.length} update={update} name="icicles" />
         <DynamicInstanced count={list.length} update={ring} name="icicle-rings">
            <ringGeometry args={[0.7, 1, 28]} />
            <meshBasicMaterial color={COLORS.danger} transparent opacity={0.6} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The yeti on his ledge (level 3) and his snowballs in flight, each with the shadow of where it lands. */
function Yeti({ run }: { run: PeakRun }) {
   const y = run.course.yetis[0];
   const g = useRef<Group>(null);
   const ky = YETI_H / GLB_SIZE.yeti.y;
   const kb = 0.8 / GLB_SIZE.snowball.y;
   useFrame(() => {
      if (!g.current || !y) return;
      g.current.rotation.y = Math.atan2(run.hero.x - y.x, run.hero.z - y.z);
   });
   const ball = (i: number, m: Matrix4) => {
      const t = run.throws[run.throws.length - 1 - i];
      if (!t || t.done || !y) return false;
      const k = Math.max(0, Math.min(1, (run.ms - t.fromAt) / YETI.flightMs));
      const x = y.x + (t.x - y.x) * k;
      const z = y.z + (t.z - y.z) * k;
      const h = y.y + 2.2 + (t.y - y.y - 2.2) * k + Math.sin(k * Math.PI) * 4;
      E.set(k * 9, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(x, h - 0.4, z), Q, S.set(kb, kb, kb));
   };
   const shadow = (i: number, m: Matrix4) => {
      const t = run.throws[run.throws.length - 1 - i];
      if (!t || t.done) return false;
      const k = Math.max(0, Math.min(1, (run.ms - t.fromAt) / YETI.flightMs));
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      const s = YETI.hitR * (0.5 + 0.5 * k);
      m.compose(V.set(t.x, t.y + 0.04, t.z), Q, S.set(s, s, s));
   };
   if (!y) return null;
   return (
      <>
         <group ref={g} position={[y.x, y.y, y.z]} scale={ky}>
            <Model asset={ASSETS.yeti} />
         </group>
         <DynamicInstancedModel asset={ASSETS.snowball} count={3} update={ball} name="yeti-balls" />
         <DynamicInstanced count={3} update={shadow} name="yeti-shadows">
            <circleGeometry args={[1, 24]} />
            <meshBasicMaterial color="#1e293b" transparent opacity={0.35} depthWrite={false} />
         </DynamicInstanced>
      </>
   );
}

/** Rolling snowballs (level 3): ride one (land on top) for 2 s. */
function Rollers({ run }: { run: PeakRun }) {
   const list = run.course.rollers;
   const k = (ROLLER_R * 2) / GLB_SIZE.snowball.y;
   const update = (i: number, m: Matrix4) => {
      const at = rollerAt(run, i, run.ms, XZ);
      if (!at) return false;
      const r = list[i];
      const dist = Math.hypot(at.x - r.x0, at.z - r.z0);
      const yaw = Math.atan2(r.x1 - r.x0, r.z1 - r.z0);
      E.set(dist / ROLLER_R, yaw, 0, "YXZ");
      Q.setFromEuler(E);
      m.compose(V.set(at.x, r.y, at.z), Q, S.set(k, k, k));
   };
   if (list.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.snowball} count={list.length} update={update} name="rollers" />;
}

/** Ice slimes patrolling snow patches (level 4). */
function Slimes({ run }: { run: PeakRun }) {
   const time = useGameTime();
   const list = run.course.slimes;
   const k = SLIME_H / GLB_SIZE.slime.y;
   const update = (i: number, m: Matrix4) => {
      const at = slimeAt(run, i, XZ);
      const p = run.course.plats[list[i].plat];
      const s = list[i];
      const vel = Math.cos((run.ms / 1000) * s.speed);
      const yaw = s.axis === "x" ? (vel >= 0 ? Math.PI / 2 : -Math.PI / 2) : vel >= 0 ? 0 : Math.PI;
      const squash = 1 + Math.sin(time.now * 8 + i) * 0.06;
      E.set(0, yaw, 0);
      Q.setFromEuler(E);
      m.compose(V.set(at.x, p.y, at.z), Q, S.set(k * squash, k / squash, k * squash));
   };
   if (list.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.slime} count={list.length} update={update} name="slimes" />;
}

/** Kiro's chutes: a steady rain of icicles inside the chute box. */
function Chutes({ run }: { run: PeakRun }) {
   const time = useGameTime();
   const list = run.course.chutes;
   const n = list.length * 5;
   const k = 0.9 / GLB_SIZE.icicle.y;
   const update = (i: number, m: Matrix4) => {
      const c = list[Math.floor(i / 5)];
      const j = i % 5;
      const t = (time.now * 1.1 + j * 0.21) % 1;
      const x = c.x + (((j * 0.37) % 1) - 0.5) * c.hx * 1.6;
      const z = c.z + (((j * 0.61) % 1) - 0.5) * c.hz * 1.6;
      E.set(Math.PI, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(x, c.y1 - t * (c.y1 - c.y0) + 0.9, z), Q, S.set(k * 0.6, k, k * 0.6));
   };
   if (n === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.icicle} count={n} update={update} name="chute-rain" />;
}

/** Lantern posts (level 4): a warm glow while lit (4 s of every 6 s), dark otherwise. */
function Lanterns({ run }: { run: PeakRun }) {
   const glow = useCanvasTexture(64, 64, drawGlow);
   const camera = useThree((s) => s.camera);
   const list = run.course.lanterns;
   const halo = (i: number, m: Matrix4, color: Color) => {
      const l = list[i];
      const lit = lanternLit(run, i);
      m.compose(V.set(l.x, l.y + 2.3, l.z), camera.quaternion, S.setScalar(lit ? 3.2 : 0.8));
      color.set(lit ? "#fde68a" : "#475569");
   };
   const post = (i: number, m: Matrix4) => {
      const l = list[i];
      Q.identity();
      m.compose(V.set(l.x, l.y + 1.1, l.z), Q, S.set(1, 1, 1));
   };
   const bulb = (i: number, m: Matrix4, color: Color) => {
      const l = list[i];
      Q.identity();
      m.compose(V.set(l.x, l.y + 2.3, l.z), Q, S.setScalar(1));
      color.set(lanternLit(run, i) ? "#fbbf24" : "#334155");
   };
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(() => () => plane.dispose(), [plane]);
   if (list.length === 0) return null;
   return (
      <>
         <DynamicInstanced count={list.length} update={post} name="lantern-posts">
            <cylinderGeometry args={[0.07, 0.09, 2.2, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.4} />
         </DynamicInstanced>
         <DynamicInstanced count={list.length} update={bulb} name="lantern-bulbs" tinted>
            <sphereGeometry args={[0.22, 14, 10]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={list.length} update={halo} name="lantern-halos" tinted>
            <primitive object={plane} attach="geometry" />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.65} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The checkpoint beacons on the main snow patches (lit once reached) and the summit cairn on the goal. */
function Landmarks({ run }: { run: PeakRun }) {
   const c = run.course;
   const spots = useMemo(() => c.route.map((id) => c.plats[id]).filter((p) => p.surface === "snow" && p.id !== c.goal && p.lantern < 0), [c]);
   const kb = 1.6 / GLB_SIZE.beacon.y;
   const update = (i: number, m: Matrix4, color: Color) => {
      const p = spots[i];
      Q.identity();
      m.compose(V.set(p.x - p.hx + 0.5, p.y, p.z - p.hz + 0.5), Q, S.set(kb, kb, kb));
      color.set(run.checkpoint === p.id ? "#fde68a" : "#94a3b8");
   };
   const goal = c.plats[c.goal];
   const kc = 2.4 / GLB_SIZE.cairn.y;
   return (
      <>
         {spots.length > 0 ? <DynamicInstancedModel asset={ASSETS.beacon} count={spots.length} update={update} name="beacons" tinted /> : null}
         <group position={[goal.x, goal.y, goal.z - goal.hz * 0.4]} scale={kc}>
            <Model asset={ASSETS.cairn} />
         </group>
         <mesh position={[goal.x + 0.8, goal.y + 3.4, goal.z - goal.hz * 0.4]}>
            <planeGeometry args={[1.2, 0.7]} />
            <meshStandardMaterial color="#38bdf8" side={DoubleSide} emissive="#0284c7" emissiveIntensity={0.4} />
         </mesh>
         <mesh position={[goal.x + 0.2, goal.y + 2.6, goal.z - goal.hz * 0.4]}>
            <cylinderGeometry args={[0.04, 0.04, 2.4, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.4} />
         </mesh>
      </>
   );
}

/** The dotted landing arc (levels 1-2, above 4 m/s on the ground): where a jump now would land. */
function LandingArc({ run }: { run: PeakRun }) {
   const N = 16;
   const pts = useMemo(() => new Float32Array(N * 3), []);
   const count = useRef(0);
   useFrame(() => {
      const h = run.hero;
      count.current = 0;
      if (!run.course.config.arc || h.ground < 0 || h.state !== "play") return;
      const s = Math.hypot(h.vx, h.vz);
      if (s < ARC_MIN_V) return;
      const v = Math.max(s, V_LAUNCH_MIN);
      const ux = h.vx / s;
      const uz = h.vz / s;
      const tUp = V_JUMP / G;
      const tDown = Math.sqrt((2 * (APEX + 1.5)) / (G * FALL_X));
      const total = tUp + tDown;
      for (let i = 0; i < N; i++) {
         const t = ((i + 1) / N) * total;
         const y = t <= tUp ? V_JUMP * t - 0.5 * G * t * t : APEX - 0.5 * G * FALL_X * (t - tUp) * (t - tUp);
         pts[i * 3] = h.x + ux * v * t;
         pts[i * 3 + 1] = h.y + y + 0.3;
         pts[i * 3 + 2] = h.z + uz * v * t;
         count.current = i + 1;
      }
   });
   const update = (i: number, m: Matrix4) => {
      if (i >= count.current) return false;
      Q.identity();
      m.compose(V.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]), Q, S.setScalar(1));
   };
   if (!run.course.config.arc) return null;
   return (
      <DynamicInstanced count={N} update={update} name="landing-arc">
         <sphereGeometry args={[0.08, 8, 6]} />
         <meshBasicMaterial color={COLORS.arc} transparent opacity={0.85} toneMapped={false} />
      </DynamicInstanced>
   );
}

export function Peak({ run }: { run: PeakRun }) {
   return (
      <>
         <PlatPool run={run} look="ice" />
         <PlatPool run={run} look="snow" />
         <PlatPool run={run} look="snow2" />
         <PlatPool run={run} look="cracked" />
         <PlatPool run={run} look="block" />
         <Ramps run={run} />
         <Walls run={run} />
         <Orbs run={run} />
         <Secrets run={run} />
         <Icicles run={run} />
         <Yeti run={run} />
         <Rollers run={run} />
         <Slimes run={run} />
         <Chutes run={run} />
         <Lanterns run={run} />
         <Landmarks run={run} />
         <LandingArc run={run} />
      </>
   );
}

