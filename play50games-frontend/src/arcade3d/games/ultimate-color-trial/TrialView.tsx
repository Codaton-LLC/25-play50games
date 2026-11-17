"use client";

// The trial corridor, drawn from the run (rules.ts) every frame. The floor strips, the walls between
// doors and the colour bands are code (ground and set); every object a player reads is a Hyper3D
// mesh: the spawn pads (jump pads, sliding ones, and the checkpoints), the runway slabs, the trial
// rings (the next one white, done ones green), the colour switches and colour doors (m2ColorGateV2
// tinted, a shut door's light in front of it), the exit gates (lifted once open), the laser
// emitters with their beams, the rolling orbs, the energy core (over the hero's head while carried)
// and its receptor pedestal, the Sentinel's beacon, the nook barriers (a crystal wall, a void gate),
// the gems and the secrets. Remounted per level (Scene keys it).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ArchWall } from "@/arcade3d/menu2/props";
import { HALF_W, PALETTE } from "./levels";
import { BEAM_Y, GATE_T, ORB_R, blobAt, laserZ, padCenterAt, type Course } from "./course";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, LOOKS } from "./look";
import { BOSS_HOVER } from "./camera";
import { currentSection, doorOpen, exitShut, type TrialRun } from "./rules";
import { SECRETS } from "./progression";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const UP = new Vector3(0, 1, 0);
const m1 = new Matrix4();
const WHITE = new Color("#ffffff");
const PAL = PALETTE.map((p) => new Color(p.hex));
const C_PAD = new Color(COLORS.pad);
const C_RING = new Color(COLORS.ring);
const C_RING_NEXT = new Color(COLORS.ringNext);
const C_RING_DONE = new Color(COLORS.ringDone);
const C_GATE = new Color(COLORS.gate);
const C_SHUT = new Color(COLORS.gateShut);
const C_OPEN = new Color(COLORS.gateOpen);
const C_FLOOR = new Color(COLORS.floor);
const C_WALL = new Color(COLORS.floorEdge);
const DIM = new Color("#6b6687");

export interface VisualClock {
   ms: number;
}

/** A pad disc is this thick (m); its top is the rules' pad y. */
export const PAD_T = 0.35;
/** A door or gate is drawn this tall (m). */
export const GATE_H = 3.5;

function place(m: Matrix4, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1): void {
   pos.set(x, y, z);
   quat.setFromAxisAngle(UP, yaw);
   scl.set(sx, sy, sz);
   m.compose(pos, quat, scl);
}

/** The floor strips (code slabs) and the colour bands across them. */
function Floors({ course }: { course: Course }) {
   const look = LOOKS[course.id];
   const strips = course.floors;
   const bands = useMemo(() => {
      const out: { x: number; z: number; w: number; color: number }[] = [];
      for (const f of strips) {
         if (f.kind !== "floor") continue;
         // the start strip begins behind z = 0: the band index wraps positively there too
         for (let z = f.z0 + 3; z < f.z1 - 1; z += 6) out.push({ x: (f.x0 + f.x1) / 2, z, w: f.x1 - f.x0 - 0.6, color: ((Math.floor(z / 6) % PALETTE.length) + PALETTE.length) % PALETTE.length });
      }
      return out;
   }, [strips]);
   const slab = (i: number, m: Matrix4, color?: Color) => {
      const f = strips[i];
      if (!f) return false;
      place(m, (f.x0 + f.x1) / 2, f.y - 0.3, (f.z0 + f.z1) / 2, 0, f.x1 - f.x0, 0.6, f.z1 - f.z0);
      color?.copy(f.kind === "floor" ? C_FLOOR : C_WALL);
   };
   const band = (i: number, m: Matrix4, color?: Color) => {
      const b = bands[i];
      if (!b) return false;
      place(m, b.x, 0.015, b.z, 0, b.w, 1, 0.25);
      color?.copy(PAL[b.color]).multiplyScalar(look.neon);
   };
   return (
      <group>
         <DynamicInstanced count={strips.length} update={slab} name="floors" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.55} metalness={0.25} />
         </DynamicInstanced>
         <DynamicInstanced count={bands.length} update={band} name="bands" tinted>
            <boxGeometry args={[1, 0.03, 1]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </group>
   );
}

/** The jump pads (sliding ones move) and the checkpoints' pads. */
function Pads({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const g = GLB_SIZE.pad;
   const centre = useMemo(() => ({ x: 0, z: 0 }), []);
   const n = c.pads.length + c.checkpoints.length;
   const update = (i: number, m: Matrix4, color?: Color) => {
      const ms = Math.max(0, clock.ms);
      if (i < c.pads.length) {
         const p = c.pads[i];
         padCenterAt(p, ms, centre);
         place(m, centre.x, p.y - PAD_T, centre.z, 0, (2 * p.r) / g.x, PAD_T / g.y, (2 * p.r) / g.z);
         color?.copy(C_PAD).lerp(WHITE, p.move ? 0.25 : 0);
         return;
      }
      const k = i - c.pads.length;
      const cp = c.checkpoints[k];
      place(m, cp.x, 0.02 - PAD_T + 0.1, cp.z, 0, 2.6 / g.x, 0.1 / g.y, 2.6 / g.z);
      color?.set(k <= run.checkpoint ? COLORS.checkpoint : "#2a2152");
   };
   return <DynamicInstancedModel asset={ASSETS.pad} count={n} update={update} tinted name="pads" />;
}

/** The neon rims of the jump pads. */
function Rims({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const look = LOOKS[c.id];
   const centre = useMemo(() => ({ x: 0, z: 0 }), []);
   const update = (i: number, m: Matrix4, color?: Color) => {
      const p = c.pads[i];
      if (!p) return false;
      padCenterAt(p, Math.max(0, clock.ms), centre);
      place(m, centre.x, p.y + 0.02, centre.z, 0, p.r, 1, p.r);
      color?.copy(WHITE).multiplyScalar(look.neon);
   };
   if (c.pads.length === 0) return null;
   return (
      <DynamicInstanced count={c.pads.length} update={update} name="rims" tinted>
         <ringGeometry args={[0.93, 1, 40]} />
         <meshBasicMaterial color={COLORS.padRim} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** Runway slabs on the laser runways (three lanes). */
function Runways({ course }: { course: Course }) {
   const g = GLB_SIZE.runway;
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      const len = 3.8;
      const s = len / g.z;
      for (const sec of course.sections) {
         if (sec.kind !== "runner") continue;
         for (let z = sec.z0 + 2; z < sec.z1 - 2; z += len + 0.3) for (const x of [-3.9, 0, 3.9]) out.push({ x, y: 0.02, z: z + len / 2, sx: 3.6 / g.x, sy: 0.08 / g.y, sz: s });
      }
      return out;
   }, [course, g]);
   if (spots.length === 0) return null;
   return <InstancedModel asset={ASSETS.runway} spots={spots} fallback={null} />;
}

/** The trial rings: upright hoops, the next one white and pulsing, done ones green. */
function Rings({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const g = GLB_SIZE.ring;
   const update = (i: number, m: Matrix4, color?: Color) => {
      const r = c.rings[i];
      if (!r) return false;
      const sec = c.sections[r.section];
      const boss = sec.kind === "boss";
      const next = boss ? run.bossAwake && run.boss?.phase === 1 && r.order === run.bossRingNext : r.order === run.ringNext[r.section] && !run.secDone[r.section];
      const done = boss ? run.bossAwake && run.boss?.phase === 1 && r.order < run.bossRingNext : run.secDone[r.section] || r.order < run.ringNext[r.section];
      const ms = Math.max(0, clock.ms);
      const k = next ? 1 + 0.05 * Math.sin(ms / 150) : 1;
      const s = ((2 * r.r + 0.5) / g.x) * k;
      place(m, r.x, r.y - (g.y * s) / 2, r.z, 0, s, s, 0.6 / g.z);
      if (color) color.copy(next ? C_RING_NEXT : done ? C_RING_DONE : C_RING).lerp(DIM, next || done || r.section === currentSection(run) ? 0 : 0.5);
   };
   if (c.rings.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.ring} count={c.rings.length} update={update} tinted name="rings" />;
}

/** The colour switches, each its colour, lit while the hero carries it. */
function Switches({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const update = (i: number, m: Matrix4, color?: Color) => {
      const w = c.switches[i];
      if (!w) return false;
      const lit = run.charge === w.color;
      place(m, w.x, lit ? -0.08 : 0, w.z, 0);
      color?.copy(PAL[w.color]).lerp(WHITE, lit ? 0.5 + 0.2 * Math.sin(clock.ms / 120) : 0);
   };
   if (c.switches.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.switch} count={c.switches.length} update={update} tinted name="switches" />;
}

/** The door rows: a gate frame per door in its colour, walls between, a light in front of a shut door; and the exit gates. */
function Gates({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const g = GLB_SIZE.gate;
   const doors = useMemo(() => c.rows.flatMap((row) => row.doors.map((d) => ({ row, d }))), [c]);
   const walls = useMemo(() => {
      const out: { x0: number; x1: number; z: number }[] = [];
      for (const row of c.rows) {
         let x = -HALF_W;
         for (const d of [...row.doors].sort((a, b) => a.x0 - b.x0)) {
            if (d.x0 > x + 0.05) out.push({ x0: x, x1: d.x0, z: row.z });
            x = d.x1;
         }
         if (x < HALF_W - 0.05) out.push({ x0: x, x1: HALF_W, z: row.z });
      }
      return out;
   }, [c]);
   const gated = useMemo(() => c.sections.filter((s) => s.gated), [c]);
   const door = (i: number, m: Matrix4, color?: Color) => {
      const q = doors[i];
      if (!q) return false;
      const w = q.d.x1 - q.d.x0;
      place(m, (q.d.x0 + q.d.x1) / 2, 0, q.row.z, 0, w / g.x, GATE_H / g.y, (GATE_T * 2) / g.z);
      color?.copy(PAL[q.d.color]).lerp(WHITE, 0.2);
   };
   const light = (i: number, m: Matrix4, color?: Color) => {
      const q = doors[i];
      if (!q) return false;
      const open = doorOpen(run, q.row.index, (q.d.x0 + q.d.x1) / 2);
      const w = q.d.x1 - q.d.x0 - 0.5;
      place(m, (q.d.x0 + q.d.x1) / 2, GATE_H / 2 - 0.2, q.row.z, 0, w, GATE_H - 0.6, 1);
      color?.copy(PAL[q.d.color]).multiplyScalar(open ? 0.15 : 0.55 + 0.1 * Math.sin(clock.ms / 200));
   };
   const wall = (i: number, m: Matrix4) => {
      const w = walls[i];
      if (!w) return false;
      place(m, (w.x0 + w.x1) / 2, GATE_H / 2, w.z, 0, w.x1 - w.x0, GATE_H, GATE_T * 2);
   };
   const exit = (i: number, m: Matrix4, color?: Color) => {
      const s = gated[i];
      if (!s) return false;
      const shut = exitShut(run, s.index);
      // open: lifted well out of the way (above the orbit camera's band, so it never fills the view from behind)
      place(m, 0, shut ? 0 : GATE_H + 5, s.z1, 0, (2 * HALF_W) / g.x, GATE_H / g.y, (GATE_T * 2) / g.z);
      color?.copy(shut ? C_SHUT : C_OPEN).lerp(C_GATE, 0.4);
   };
   const exitLight = (i: number, m: Matrix4, color?: Color) => {
      const s = gated[i];
      if (!s || !exitShut(run, s.index)) return false;
      place(m, 0, GATE_H / 2 - 0.2, s.z1, 0, 2 * HALF_W - 0.8, GATE_H - 0.6, 1);
      color?.copy(C_SHUT).multiplyScalar(0.35 + 0.1 * Math.sin(clock.ms / 240));
   };
   return (
      <>
         {doors.length > 0 ? <DynamicInstancedModel asset={ASSETS.gate} count={doors.length} update={door} tinted name="doors" /> : null}
         {doors.length > 0 ? (
            <DynamicInstanced count={doors.length} update={light} name="doorLights" tinted>
               <planeGeometry args={[1, 1]} />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
            </DynamicInstanced>
         ) : null}
         {walls.length > 0 ? (
            <DynamicInstanced count={walls.length} update={wall} name="rowWalls">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color="#23204a" roughness={0.5} metalness={0.3} emissive="#4c1d95" emissiveIntensity={0.2} />
            </DynamicInstanced>
         ) : null}
         {gated.length > 0 ? <DynamicInstancedModel asset={ASSETS.gate} count={gated.length} update={exit} tinted name="exits" /> : null}
         {gated.length > 0 ? (
            <DynamicInstanced count={gated.length} update={exitLight} name="exitLights" tinted>
               <planeGeometry args={[1, 1]} />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
            </DynamicInstanced>
         ) : null}
      </>
   );
}

/** The laser beams and the emitter pair that sweeps with each. */
function Lasers({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const beam = (i: number, m: Matrix4) => {
      const l = c.lasers[i];
      if (!l) return false;
      place(m, 0, BEAM_Y, laserZ(l, Math.max(0, clock.ms)), 0, 2 * HALF_W - 1.2, 0.12, 0.12);
   };
   const emitter = (i: number, m: Matrix4) => {
      const l = c.lasers[Math.floor(i / 2)];
      if (!l) return false;
      const side = i % 2 === 0 ? -1 : 1;
      place(m, side * (HALF_W - 0.7), 0, laserZ(l, Math.max(0, clock.ms)), side * -Math.PI / 2);
   };
   if (c.lasers.length === 0) return null;
   return (
      <>
         <DynamicInstanced count={c.lasers.length} update={beam} name="beams">
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={COLORS.beam} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.emitter} count={c.lasers.length * 2} update={emitter} name="emitters" />
      </>
   );
}

/** The rolling hazard orbs (the Sentinel's only during his sweeps). */
function Orbs({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const p = useMemo(() => ({ x: 0, z: 0 }), []);
   const update = (i: number, m: Matrix4) => {
      const b = c.blobs[i];
      if (!b) return false;
      const sec = c.sections[b.section];
      if (sec.kind === "boss" && !(run.bossAwake && run.boss && run.boss.step === "attack")) return false;
      const ms = Math.max(0, clock.ms);
      blobAt(b, ms, p);
      place(m, p.x, 0, p.z, ms / 400 + i);
      void ORB_R;
   };
   if (c.blobs.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.orb} count={c.blobs.length} update={update} name="orbs" />;
}

/** The energy cores (a section's, the Sentinel's): on the floor, over the hero's head, or in the receptor; and the receptor pedestals. */
function Cores({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const coreSections = useMemo(() => c.sections.filter((s) => s.core), [c]);
   const n = coreSections.length + (c.boss ? 1 : 0);
   const update = (i: number, m: Matrix4) => {
      const ms = Math.max(0, clock.ms);
      const h = run.hero;
      if (i < coreSections.length) {
         const s = coreSections[i];
         const st = run.coreState[s.index];
         const bob = 0.2 * Math.sin(ms / 300);
         if (st === 1) place(m, h.x, h.y + 1.9 + bob * 0.3, h.z, ms / 500);
         else if (st === 2) place(m, s.receptor!.x, 1.9 + bob, s.receptor!.z, ms / 900);
         else place(m, run.coreX[s.index], 0.5 + bob, run.coreZ[s.index], ms / 900);
         return;
      }
      if (!c.bossSpec || run.bossCore === 0) return false;
      const bob = 0.2 * Math.sin(ms / 300);
      if (run.bossCore === 2) place(m, h.x, h.y + 1.9 + bob * 0.3, h.z, ms / 500);
      else place(m, run.bossCoreX, 0.5 + bob, run.bossCoreZ, ms / 900);
   };
   const pedestals = useMemo(() => {
      const out: InstanceSpot[] = coreSections.map((s) => ({ x: s.receptor!.x, y: 0, z: s.receptor!.z }));
      if (c.bossSpec) out.push({ x: c.bossSpec.receptor.x, y: 0, z: c.bossSpec.receptor.z });
      return out;
   }, [c, coreSections]);
   if (n === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.core} count={n} update={update} name="cores" />
         <InstancedModel asset={ASSETS.pedestal} spots={pedestals} fallback={null} />
      </>
   );
}

/** The Sentinel's beacon, with the colour it asks for over it. */
function Beacon({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const bs = run.course.bossSpec;
   const light = useRef<Mesh>(null);
   useFrame(() => {
      const l = light.current;
      if (!l || !run.boss) return;
      const col = run.bossAwake && run.boss.phase === 0 && run.boss.step !== "transition" ? run.bossColor : -1;
      l.visible = col >= 0;
      if (col >= 0) {
         (l.material as MeshBasicMaterial).color.copy(PAL[col]).lerp(WHITE, 0.3);
         l.scale.setScalar(1 + 0.2 * Math.sin(clock.ms / 90));
      }
   });
   if (!bs) return null;
   return (
      <group position={[bs.beacon.x, 0, bs.beacon.z]}>
         <Model asset={ASSETS.beacon} tint={COLORS.beacon} />
         <mesh ref={light} position={[0, 3.9, 0]} visible={false}>
            <octahedronGeometry args={[0.55, 0]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </mesh>
         <pointLight position={[0, 3.5, 0]} intensity={1.2} distance={14} color={COLORS.beacon} />
      </group>
   );
}

/** Riko's crystal wall (gone once shattered) and Vexa's void gate, in the nook openings. */
function Nooks({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const voids = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      voids.current.forEach((v, i) => {
         if (v) (v.material as MeshBasicMaterial).opacity = 0.3 + 0.12 * Math.sin(clock.ms / 380 + i);
      });
   });
   return (
      <>
         {c.nooks.map((n, i) =>
            n.kind === "wall" ? (
               run.wallBroken[i] ? null : (
                  <mesh key={i} position={[n.disc.x, 1.7, n.disc.z]}>
                     <boxGeometry args={[0.9, 3.4, n.disc.r * 2]} />
                     <meshStandardMaterial color="#312e81" roughness={0.3} metalness={0.4} emissive="#f87171" emissiveIntensity={0.3} />
                  </mesh>
               )
            ) : (
               <group key={i} position={[n.disc.x, 0, n.disc.z]} rotation-y={Math.PI / 2}>
                  <ArchWall color="#312e81" accent="#7c3aed" />
                  <mesh
                     ref={(m) => {
                        voids.current[i] = m;
                     }}
                     position={[0, 1.2, 0]}
                  >
                     <planeGeometry args={[1.6, 2.4]} />
                     <meshBasicMaterial color="#7c3aed" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
                  </mesh>
               </group>
            ),
         )}
      </>
   );
}

function Gems({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const update = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = c.gems[i];
      if (!o) return false;
      if (o.hidden && run.hero.magnetUntil < run.simMs) return false;
      const t = clock.ms / 1000;
      const s = o.hidden ? 0.7 : 1;
      place(m, o.x, o.y - 0.3 + 0.12 * Math.sin(t * 2.4 + i), o.z, t * 1.6 + i, s, s, s);
   };
   return <DynamicInstancedModel asset={ASSETS.gem} count={c.gems.length} update={update} name="gems" />;
}

function Secrets({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const list = SECRETS[run.level];
   const update = (i: number, m: Matrix4, color?: Color) => {
      const s = c.secrets[i];
      if (!s || run.secrets.found[i]) return false;
      place(m, s.x, s.y + 0.1 * Math.sin(clock.ms / 300 + i), s.z, clock.ms / 500);
      color?.set(list[i].kind === "shard" ? COLORS.shard : COLORS.sticker);
   };
   return (
      <DynamicInstanced count={c.secrets.length} update={update} name="secrets" tinted>
         <octahedronGeometry args={[0.38, 0]} />
         <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.6} roughness={0.2} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** The finish: a glowing ring on the floor (not on level 5: the Sentinel is the goal). */
function Finish({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const c = run.course;
   const ring = useRef<Mesh>(null);
   useFrame(() => {
      const r = ring.current;
      if (!r) return;
      r.scale.setScalar(1 + 0.08 * Math.sin(clock.ms / 200));
      (r.material as MeshBasicMaterial).opacity = currentSection(run) >= c.sections.length ? 0.85 : 0.2;
   });
   if (c.boss) return null;
   return (
      <group position={[c.finish.x, 0.05, c.finish.z]}>
         <mesh ref={ring} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.9, 2.3, 48]} />
            <meshBasicMaterial color={COLORS.glow} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh position={[0, 1.4, 0]}>
            <octahedronGeometry args={[0.6, 0]} />
            <meshBasicMaterial color={COLORS.glow} toneMapped={false} />
         </mesh>
      </group>
   );
}

export function TrialView({ run, clock }: { run: TrialRun; clock: VisualClock }) {
   const course = run.course;
   void BOSS_HOVER;
   return (
      <group>
         <Floors course={course} />
         <Pads run={run} clock={clock} />
         <Rims run={run} clock={clock} />
         <Runways course={course} />
         <Rings run={run} clock={clock} />
         <Switches run={run} clock={clock} />
         <Gates run={run} clock={clock} />
         <Lasers run={run} clock={clock} />
         <Orbs run={run} clock={clock} />
         <Cores run={run} clock={clock} />
         <Beacon run={run} clock={clock} />
         <Nooks run={run} clock={clock} />
         <Gems run={run} clock={clock} />
         <Secrets run={run} clock={clock} />
         <Finish run={run} clock={clock} />
      </group>
   );
}
