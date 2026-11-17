"use client";

// The laser vault (everything with a rule behind it), drawn from windows round the hero (pools sized
// once): the corridor floor with its glowing grid and the vault walls along both sides, with security
// cams; the checkpoint pads; every laser as a glowing beam between two emitters (red: a live wall;
// amber: a low beam to jump; magenta: a gate; violet: a cage; a pulse dims to a faint guide line while
// it is dark, a gate goes dark when its switch opens it); the switches (crystal prisms, green while their
// gate is open); the moving barriers; the live floor tiles; the orbs and the secrets; the exit.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Euler, PlaneGeometry, Quaternion, RepeatWrapping, Vector3, type Color, type Matrix4, type Mesh } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, accentFor } from "./look";
import { HALF } from "./course";
import { barrierX, bossDone, laserOn, laserS, type LaserRun } from "./rules";

const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

const BEHIND = 14;
const AHEAD = 60;

const drawGlow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.35, "rgba(255,255,255,0.55)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

/** The floor's paint: a dark panel with a bright seam round it. */
const drawPanel = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.fillStyle = "#1b2130";
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "rgba(125,211,252,0.55)";
   ctx.lineWidth = 3;
   ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
   ctx.fillStyle = "rgba(148,163,184,0.25)";
   ctx.fillRect(w * 0.45, h * 0.45, w * 0.1, h * 0.1);
};

function near(run: LaserRun, s: number, pad = 0): boolean {
   const hs = run.runner.s;
   return s >= hs - BEHIND - pad && s <= hs + AHEAD + pad;
}

/** The corridor: a tiled floor (one textured strip), edge trims, the vault walls and their cams. */
function Corridor({ run, level }: { run: LaserRun; level: LevelId }) {
   const c = run.course;
   const len = c.finishS + 30;
   const panel = useCanvasTexture(128, 128, drawPanel);
   useEffect(() => {
      panel.wrapS = panel.wrapT = RepeatWrapping;
      panel.repeat.set(5, len / 1.8);
      panel.needsUpdate = true;
   }, [panel, len]);
   const accent = accentFor(level);
   const gw = GLB_SIZE.wall;
   const step = 4;
   const wall = (i: number, m: Matrix4) => {
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      const base = Math.floor((run.runner.s - BEHIND) / step);
      const s = (base + k) * step;
      if (s < -6 || s > len + 4) return false;
      E.set(0, side < 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      Q.setFromEuler(E);
      m.compose(V.set(side * (HALF + 0.45), 0, -s), Q, S.set(step / gw.x, 3.6 / gw.y, 0.9 / gw.z));
   };
   const gc = GLB_SIZE.cam;
   const cams = useMemo(() => c.zones.map((z, i) => ({ s: z.s0 + 7, side: i % 2 === 0 ? 1 : -1 })), [c]);
   const cam = (i: number, m: Matrix4) => {
      const q = cams[i];
      if (!q || !near(run, q.s)) return false;
      E.set(0.35, q.side < 0 ? -Math.PI / 2 + Math.sin(run.ms / 900 + i) * 0.5 : Math.PI / 2 + Math.sin(run.ms / 900 + i) * 0.5, 0);
      Q.setFromEuler(E);
      const k = 0.9 / gc.y;
      m.compose(V.set(q.side * (HALF + 0.1), 3.1, -q.s), Q, S.set(k, k, k));
   };
   const count = Math.ceil((BEHIND + AHEAD) / step) * 2 + 4;
   return (
      <group>
         <mesh position={[0, -0.25, -len / 2 + 4]} receiveShadow>
            <boxGeometry args={[HALF * 2, 0.5, len + 10]} />
            <meshStandardMaterial color={COLORS.floor} roughness={0.6} metalness={0.3} />
         </mesh>
         <mesh position={[0, 0.005, -len / 2 + 4]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[HALF * 2, len + 10]} />
            <meshStandardMaterial map={panel} roughness={0.5} metalness={0.4} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (HALF - 0.05), 0.03, -len / 2 + 4]}>
               <boxGeometry args={[0.1, 0.06, len + 10]} />
               <meshBasicMaterial color={accent} toneMapped={false} />
            </mesh>
         ))}
         <DynamicInstancedModel asset={ASSETS.wall} count={count} update={wall} name="vault-walls" />
         <DynamicInstancedModel asset={ASSETS.cam} count={cams.length} update={cam} name="security-cams" />
      </group>
   );
}

/** The checkpoint pads (one per room) and the exit at the far end. */
function Pads({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const g = GLB_SIZE.pad;
   const pad = (i: number, m: Matrix4, color: Color) => {
      const z = c.zones[i];
      if (!z || !near(run, z.cp)) return false;
      Q.identity();
      m.compose(V.set(0, 0, -z.cp), Q, S.set(2.4 / g.x, 1, 2.4 / g.z));
      color.set(run.zone === i ? "#86efac" : "#ffffff");
   };
   const exit = useRef<Mesh>(null);
   useFrame(() => {
      if (exit.current) exit.current.rotation.y = time.now * 0.6;
   });
   const kb = 3 / GLB_SIZE.beacon.y;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.pad} count={c.zones.length} update={pad} name="checkpoint-pads" tinted />
         <group position={[0, 0, -c.finishS]}>
            {[-1, 1].map((side) => (
               <group key={side} position={[side * (HALF - 0.6), 0, 0]} scale={kb}>
                  <Model asset={ASSETS.beacon} />
               </group>
            ))}
            <mesh ref={exit} position={[0, 0.04, -1.5]} rotation-x={-Math.PI / 2}>
               <ringGeometry args={[1.4, 2.0, 6]} />
               <meshBasicMaterial color={COLORS.safe} toneMapped={false} />
            </mesh>
         </group>
      </>
   );
}

function beamColor(kind: string, low: boolean): string {
   if (kind === "cage") return COLORS.cage;
   if (kind === "gate") return COLORS.gate;
   if (kind === "sweep") return COLORS.sweep;
   return low ? COLORS.low : COLORS.beam;
}

/** Every laser: a glowing beam (core + halo) between two emitters. */
function Lasers({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const items = useMemo(() => c.lasers.map((l, i) => ({ l, i })), [c]);
   /** A laser's drawn box: centre, length along its run, the beam's height band. */
   const place = (i: number, m: Matrix4, color: Color, halo: boolean): false | void => {
      const it = items[i];
      if (!it) return false;
      const l = it.l;
      const s = laserS(run, it.i);
      if (!near(run, l.along ? (l.s + l.s1) / 2 : s, l.along ? l.s1 - l.s : 0)) return false;
      const on = laserOn(run, it.i);
      // a dark pulse or an open gate: a faint guide line on the floor (a cage never goes dark)
      const low = l.y1 < 1;
      const dark = !on;
      const lines = low ? 1 : 3;
      void lines;
      const y = dark ? 0.03 : low ? (l.y0 + l.y1) / 2 : (l.y0 + l.y1) / 2;
      const hgt = dark ? 0.03 : l.y1 - l.y0;
      const thick = (halo ? 0.34 : 0.07) * (dark ? 0.6 : 1) * (1 + (halo ? Math.sin(time.now * 14 + i) * 0.1 : 0));
      Q.identity();
      if (l.along) m.compose(V.set(l.x0, y, -(l.s + l.s1) / 2), Q, S.set(thick, low || dark ? Math.max(thick, hgt * 0.15) : hgt, l.s1 - l.s));
      else m.compose(V.set((l.x0 + l.x1) / 2, y, -s), Q, S.set(l.x1 - l.x0, low || dark ? Math.max(thick, hgt * 0.3) : hgt, thick));
      color.set(dark ? COLORS.off : beamColor(l.kind, low));
   };
   const core = (i: number, m: Matrix4, color: Color) => place(i, m, color, false);
   const halo = (i: number, m: Matrix4, color: Color) => place(i, m, color, true);
   // the emitters at both ends of every beam across the corridor
   const ge = GLB_SIZE.emitter;
   const em = (i: number, m: Matrix4) => {
      const it = items[i >> 1];
      if (!it || it.l.along) return false;
      const l = it.l;
      const s = laserS(run, it.i);
      if (!near(run, s)) return false;
      const end = i % 2 === 0 ? l.x0 : l.x1;
      const side = i % 2 === 0 ? 1 : -1;
      E.set(0, side > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      Q.setFromEuler(E);
      const k = 0.5 / ge.y;
      m.compose(V.set(end - side * 0.15, Math.max(0, (l.y0 + l.y1) / 2 - 0.25), -s), Q, S.set(k, k, k));
   };
   // the gates stand in a laser frame across the corridor
   const gates = useMemo(() => items.filter((it) => it.l.kind === "gate"), [items]);
   const gf = GLB_SIZE.frame;
   const frame = (i: number, m: Matrix4) => {
      const it = gates[i];
      if (!it || !near(run, it.l.s)) return false;
      Q.identity();
      m.compose(V.set(0, 0, -it.l.s), Q, S.set((HALF * 2 + 0.6) / gf.x, 2.4 / gf.y, 0.7 / gf.z));
   };
   return (
      <>
         {gates.length > 0 ? <DynamicInstancedModel asset={ASSETS.frame} count={gates.length} update={frame} name="gate-frames" /> : null}
         <DynamicInstanced count={items.length} update={core} name="laser-cores" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={items.length} update={halo} name="laser-halos" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.28} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.emitter} count={items.length * 2} update={em} name="laser-emitters" />
      </>
   );
}

/** The switches: crystal prisms on their pads (green while a gate of theirs is open; the pylons glow gold while the core is open). */
function Switches({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const gp = GLB_SIZE.prism;
   const update = (i: number, m: Matrix4, color: Color) => {
      const sw = c.switches[i];
      if (!sw || !near(run, sw.s)) return false;
      E.set(0, time.now * 0.8 + i, 0);
      Q.setFromEuler(E);
      const k = 1.1 / gp.y;
      m.compose(V.set(sw.x, 0.15 + Math.sin(time.now * 2 + i) * 0.05, -sw.s), Q, S.set(k, k, k));
      const open = sw.off.some((g) => run.offUntil[g] > run.ms);
      const pylon = !!c.arena && c.arena.pylons.includes(i);
      const hot = pylon && run.boss && run.bossAwake && run.boss.step === "vulnerable";
      color.set(hot ? "#fde047" : open ? "#86efac" : "#ffffff");
   };
   const gpad = GLB_SIZE.pad;
   const pad = (i: number, m: Matrix4) => {
      const sw = c.switches[i];
      if (!sw || !near(run, sw.s)) return false;
      Q.identity();
      m.compose(V.set(sw.x, 0, -sw.s), Q, S.set(1.3 / gpad.x, 0.7, 1.3 / gpad.z));
   };
   if (c.switches.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.prism} count={c.switches.length} update={update} name="switches" tinted />
         <DynamicInstancedModel asset={ASSETS.pad} count={c.switches.length} update={pad} name="switch-pads" />
      </>
   );
}

/** The moving barriers. */
function Barriers({ run }: { run: LaserRun }) {
   const c = run.course;
   const gb = GLB_SIZE.barrier;
   const update = (i: number, m: Matrix4) => {
      const b = c.barriers[i];
      if (!b || !near(run, b.s)) return false;
      Q.identity();
      m.compose(V.set(barrierX(run, i), 0, -b.s), Q, S.set(b.width / gb.x, 1.4 / gb.y, 0.6 / gb.z));
   };
   if (c.barriers.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.barrier} count={c.barriers.length} update={update} name="barriers" />;
}

/** The live floor tiles: tiles tinted red, pulsing. */
function Floors({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const tiles = useMemo(() => {
      const out: { x: number; s: number }[] = [];
      for (const f of c.floors) for (let s = f.s0 + 0.95; s < f.s1; s += 1.9) out.push({ x: (f.x0 + f.x1) / 2, s });
      return out;
   }, [c]);
   const gt = GLB_SIZE.tile;
   const update = (i: number, m: Matrix4, color: Color) => {
      const t = tiles[i];
      if (!t || !near(run, t.s)) return false;
      Q.identity();
      m.compose(V.set(t.x, 0.02, -t.s), Q, S.set(1.9 / gt.x, 1.5, 1.9 / gt.z));
      const k = 0.6 + 0.4 * Math.sin(time.now * 6 + i);
      color.setRGB(1, 0.25 * k, 0.2 * k);
   };
   if (tiles.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.tile} count={tiles.length} update={update} name="live-floors" tinted />;
}

/** The orbs with a halo tinted by whose route they are on; collected ones gone. */
function Orbs({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const orb = (i: number, m: Matrix4) => {
      const o = c.orbs[i];
      if (run.collected[i] || !near(run, o.s)) return false;
      E.set(0, time.now * 2.2 + i, 0);
      Q.setFromEuler(E);
      m.compose(V.set(o.x, o.h - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i) * 0.1, -o.s), Q, S.set(k, k, k));
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const o = c.orbs[i];
      if (run.collected[i] || !near(run, o.s)) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(o.x, o.h + Math.sin(time.now * 2 + i) * 0.1, -o.s), camera.quaternion, S.set(sz, sz, sz));
      const b = o.bonus;
      color.set(b === "cage" ? "#c4b5fd" : b === "floor" ? "#86efac" : b === "dash" ? "#fca5a5" : b === "high" ? "#93c5fd" : "#ffe08a");
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

/** The secrets: a spinning shard / sticker. */
function Secrets({ run }: { run: LaserRun }) {
   const c = run.course;
   const time = useGameTime();
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      c.secrets.forEach((_sp, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6;
      });
   });
   return (
      <>
         {c.secrets.map((sp, i) => (
            <mesh key={i} ref={(m) => { refs.current[i] = m; }} position={[sp.x, sp.h, -sp.s]}>
               <octahedronGeometry args={[0.4, 0]} />
               <meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={1} roughness={0.3} />
            </mesh>
         ))}
      </>
   );
}

export function Vault({ run, level }: { run: LaserRun; level: LevelId }) {
   void bossDone;
   return (
      <>
         <Corridor run={run} level={level} />
         <Pads run={run} />
         <Lasers run={run} />
         <Switches run={run} />
         <Barriers run={run} />
         <Floors run={run} />
         <Orbs run={run} />
         <Secrets run={run} />
      </>
   );
}
