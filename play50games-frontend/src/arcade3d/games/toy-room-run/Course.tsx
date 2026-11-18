"use client";

// The playroom, drawn from the run (rules.ts) every frame. The desks, shelves, legs, the carpet far
// below and the walls are code (ground and set); every toy a player reads is a Hyper3D mesh: the
// dominoes, keyboards and book stacks of the chains, the drum, the race cars, spinning tops, the
// toy-block cascades and walls, the pencil ramp, the castle, the gems, the checkpoint beacons. Each
// piece topples about its front edge as the wave reaches it (a quickening swing), lies as a bridge,
// and slides off the edge when its time is up. Remounted per level (Scene keys it).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { ArchWall } from "@/arcade3d/menu2/props";
import {
   BRIDGE_MS,
   CAR_ROOF,
   PENCIL_H,
   PENCIL_LEN,
   PIECE_H,
   PIECE_W,
   cascadeOn,
   topAt,
   type Course as RoomCourse,
   type Piece,
} from "./room";
import { ASSETS, GLB_SIZE } from "./assets";
import { COLORS, LOOKS } from "./look";
import { carPoseAt, pieceStanding, type ToyRun } from "./rules";
import { SECRETS } from "./progression";
import type { PieceKind } from "./levels";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const UP = new Vector3(0, 1, 0);
const m1 = new Matrix4();
const m2 = new Matrix4();
const WHITE = new Color("#ffffff");
const GLOW = new Color("#fff1b8");
const GREY = new Color("#9ca3af");

export interface VisualClock {
   ms: number;
}

/** A toppling piece's swing (ms): it quickens like a real domino. */
export const TOPPLE_MS = 320;
/** The slab thickness as drawn (the rules' standing box is a little thicker). */
const SLAB_T = 0.36;
/** Every piece stands sunk this far, so a fallen one's top is flush with the desk (y = 0). */
const BASE_Y = -SLAB_T;

function place(m: Matrix4, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1): void {
   pos.set(x, y, z);
   quat.setFromAxisAngle(UP, yaw);
   scl.set(sx, sy, sz);
   m.compose(pos, quat, scl);
}

/**
 * Each kind's standing matrix: the GLB turned into a box PIECE_W wide, PIECE_H tall, SLAB_T thick,
 * standing on y = 0 with its front face on z = 0 (it falls toward +z, about that bottom edge).
 */
function standingMatrix(kind: PieceKind): Matrix4 {
   const out = new Matrix4();
   if (kind === "book") {
      const g = GLB_SIZE.book;
      // stands as modelled; centre its depth behind the front face
      out.makeScale(PIECE_W / g.x, PIECE_H / g.y, (SLAB_T * 1.6) / g.z);
      m1.makeTranslation(0, 0, -SLAB_T * 0.8);
      return out.premultiply(m1);
   }
   const g = kind === "domino" ? GLB_SIZE.domino : GLB_SIZE.key;
   // the GLB lies flat (thin y, long z): turn it up on end (z -> y), its thickness behind the face
   m1.makeRotationX(-Math.PI / 2);
   out.makeScale(PIECE_W / g.x, SLAB_T / g.y, PIECE_H / g.z);
   out.premultiply(m1);
   m2.makeTranslation(0, PIECE_H / 2, 0);
   return out.premultiply(m2);
}

const STANDING: Record<PieceKind, Matrix4> = { domino: standingMatrix("domino"), key: standingMatrix("key"), book: standingMatrix("book") };

/** The piece's angle (0 standing .. π/2 flat) and its slide-off drop, this ms. */
function pieceLook(run: ToyRun, i: number, ms: number, out: { a: number; drop: number; gone: boolean }): void {
   const p = run.course.pieces[i];
   out.drop = 0;
   out.gone = false;
   if (p.missing && !run.filled[i]) {
      out.gone = true;
      return;
   }
   if (run.status[p.chain] === 3) {
      out.a = Math.PI / 2;
      return;
   }
   const t = run.fallAt[i];
   if (!(t <= ms)) {
      out.a = 0;
      return;
   }
   const k = Math.min(1, (ms - t) / TOPPLE_MS);
   out.a = k * k * (Math.PI / 2);
   if (p.gap && !run.course.chains[p.chain].spec.untimed) {
      const late = ms - (t + BRIDGE_MS);
      if (late > 0) {
         out.drop = late * late * 0.000015;
         if (out.drop > 9) out.gone = true;
      }
   }
}

function Pieces({ run, clock, kind, glow }: { run: ToyRun; clock: VisualClock; kind: PieceKind; glow: number }) {
   const list = useMemo(() => run.course.pieces.map((p, i) => ({ p, i })).filter((q) => q.p.kind === kind), [run.course, kind]);
   const look = useMemo(() => ({ a: 0, drop: 0, gone: false }), []);
   const S = STANDING[kind];
   const update = (n: number, m: Matrix4, color?: Color) => {
      const q = list[n];
      if (!q) return false;
      const p: Piece = q.p;
      // the boss's pieces lie flat out of the way while their chain is down; everything else uses the rules' clock
      pieceLook(run, q.i, Math.max(0, clock.ms), look);
      if (look.gone) return false;
      const yaw = Math.atan2(p.dx, p.dz);
      // T(base) . Ry(yaw) . Rx(angle) . S
      place(m, p.x, BASE_Y - look.drop, p.z, yaw);
      m1.makeRotationX(look.a);
      m.multiply(m1).multiply(S);
      if (color) {
         color.copy(WHITE);
         if (look.a > 1.2 && glow > 0) color.lerp(GLOW, 0.5);
         if (!pieceStanding(run, q.i) && run.status[p.chain] === 3) color.copy(GREY);
      }
   };
   if (list.length === 0) return null;
   const asset = kind === "domino" ? ASSETS.domino : kind === "key" ? ASSETS.key : ASSETS.book;
   return <DynamicInstancedModel asset={asset} count={list.length} update={update} tinted name={`pieces-${kind}`} />;
}

/** Lights Out: fallen pieces glow (the bridge is all you see over a gap). */
function PieceGlow({ run, clock, strength }: { run: ToyRun; clock: VisualClock; strength: number }) {
   const look = useMemo(() => ({ a: 0, drop: 0, gone: false }), []);
   const pieces = run.course.pieces;
   const update = (i: number, m: Matrix4) => {
      const p = pieces[i];
      if (!p) return false;
      pieceLook(run, i, Math.max(0, clock.ms), look);
      if (look.gone || look.a < 1.4) return false;
      place(m, p.x + p.dx * (PIECE_H / 2), 0.03 - look.drop, p.z + p.dz * (PIECE_H / 2), Math.atan2(p.dx, p.dz), PIECE_W * 0.9, 1, PIECE_H * 0.9);
   };
   if (strength <= 0) return null;
   return (
      <DynamicInstanced count={pieces.length} update={update} name="pieceGlow">
         <boxGeometry args={[1, 0.02, 1]} />
         <meshBasicMaterial color={COLORS.glow} transparent opacity={0.55} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** Spare pieces lying beside a stalled slot (they vanish into it when pushed). */
function Spares({ run }: { run: ToyRun }) {
   const update = (i: number, m: Matrix4) => {
      const s = run.spares[i];
      if (!s || run.spareUsed[i]) return false;
      const p = run.course.pieces[s.piece];
      place(m, s.x, BASE_Y, s.z, Math.atan2(p.dx, p.dz) + 0.4);
      m1.makeRotationX(Math.PI / 2);
      m.multiply(m1).multiply(STANDING.domino);
   };
   if (run.spares.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.domino} count={run.spares.length} update={update} name="spares" />;
}

/** Desks, shelves and ledges (timber slabs) and their legs down to the carpet. */
function Furniture({ course }: { course: RoomCourse }) {
   const look = LOOKS[course.id];
   const slabs = course.plats;
   const top = (i: number, m: Matrix4, color?: Color) => {
      const p = slabs[i];
      if (!p) return false;
      place(m, (p.x0 + p.x1) / 2, p.y - 0.25, (p.z0 + p.z1) / 2, 0, p.x1 - p.x0, 0.5, p.z1 - p.z0);
      color?.set(p.kind === "desk" ? look.desk : p.kind === "shelf" ? COLORS.shelf : COLORS.ledge);
   };
   const legs = useMemo(() => {
      const out: { x: number; z: number; y: number; h: number }[] = [];
      for (const p of slabs) {
         const h = p.y + 9;
         out.push({ x: p.x0 + 0.5, z: p.z0 + 0.5, y: p.y - 0.5, h }, { x: p.x1 - 0.5, z: p.z0 + 0.5, y: p.y - 0.5, h }, { x: p.x0 + 0.5, z: p.z1 - 0.5, y: p.y - 0.5, h }, { x: p.x1 - 0.5, z: p.z1 - 0.5, y: p.y - 0.5, h });
      }
      return out;
   }, [slabs]);
   const leg = (i: number, m: Matrix4) => {
      const l = legs[i];
      if (!l) return false;
      place(m, l.x, l.y - l.h / 2, l.z, 0, 0.6, l.h, 0.6);
   };
   const cx = (course.minX + course.maxX) / 2;
   const cz = (course.minZ + course.maxZ) / 2;
   const w = course.maxX - course.minX + 60;
   const d = course.maxZ - course.minZ + 60;
   return (
      <group>
         <DynamicInstanced count={slabs.length} update={top} name="slabs" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
         </DynamicInstanced>
         <DynamicInstanced count={legs.length} update={leg} name="legs">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.leg} roughness={0.8} />
         </DynamicInstanced>
         {/* the carpet far below, and the room's walls */}
         <mesh position={[cx, -9, cz]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[w, d]} />
            <meshStandardMaterial color={look.carpet} roughness={1} />
         </mesh>
         <mesh position={[cx - w / 2, 6, cz]} rotation-y={Math.PI / 2}>
            <planeGeometry args={[d, 30]} />
            <meshStandardMaterial color={look.wall} roughness={0.95} side={DoubleSide} />
         </mesh>
         <mesh position={[cx + w / 2, 6, cz]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[d, 30]} />
            <meshStandardMaterial color={look.wall} roughness={0.95} side={DoubleSide} />
         </mesh>
         <mesh position={[cx, 6, course.maxZ + 30]} rotation-y={Math.PI}>
            <planeGeometry args={[w, 30]} />
            <meshStandardMaterial color={look.wall} roughness={0.95} side={DoubleSide} />
         </mesh>
      </group>
   );
}

function Drums({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const c = run.course;
   const rings = useRef<Group>(null);
   useFrame(() => {
      const g = rings.current;
      if (!g) return;
      g.children.forEach((child, d) => {
         const t = run.fallAt[c.drums[d].piece];
         const ms = clock.ms;
         // glows for the second before the wave hits it, and flashes as it does
         const k = Number.isFinite(t) ? (ms < t ? Math.max(0, 1 - (t - ms) / 1000) : Math.max(0, 1 - (ms - t) / 350)) : 0;
         const mat = (child as Mesh).material as MeshBasicMaterial;
         mat.opacity = 0.15 + 0.75 * k;
         child.scale.setScalar(1 + 0.15 * k * Math.sin(ms / 40));
      });
   });
   if (c.drums.length === 0) return null;
   return (
      <>
         {c.drums.map((d, i) => (
            <Model key={i} asset={ASSETS.drum} position={[d.x, 0, d.z]} />
         ))}
         <group ref={rings}>
            {c.drums.map((d, i) => (
               <mesh key={i} position={[d.x, 0.75, d.z]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[1.0, 1.45, 32]} />
                  <meshBasicMaterial color={COLORS.wave} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
               </mesh>
            ))}
         </group>
      </>
   );
}

function Cars({ run }: { run: ToyRun }) {
   const pose = useMemo(() => ({ x: 0, z: 0, yaw: 0 }), []);
   const update = (k: number, m: Matrix4) => {
      if (k >= run.course.cars.length) return false;
      carPoseAt(run, k, pose);
      place(m, pose.x, 0, pose.z, pose.yaw);
   };
   if (run.course.cars.length === 0) return null;
   void CAR_ROOF;
   return <DynamicInstancedModel asset={ASSETS.car} count={run.course.cars.length} update={update} name="cars" />;
}

function Tops({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const p = useMemo(() => ({ x: 0, z: 0 }), []);
   const update = (i: number, m: Matrix4) => {
      const t = run.course.tops[i];
      if (!t) return false;
      topAt(t, i, Math.max(0, clock.ms), p);
      place(m, p.x, 0, p.z, clock.ms / 60);
      // a little wobble
      m1.makeRotationZ(0.08 * Math.sin(clock.ms / 170 + i));
      m.multiply(m1);
   };
   if (run.course.tops.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.top} count={run.course.tops.length} update={update} name="tops" />;
}

/** Kiro's cascades (a toy-block tower that topples across the zone) and Riko's cracked block walls. */
function Blocks({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const c = run.course;
   const n = c.cascades.length + c.walls.length;
   const update = (i: number, m: Matrix4, color?: Color) => {
      if (i < c.cascades.length) {
         const z = c.cascades[i];
         const on = cascadeOn(i, Math.max(0, clock.ms));
         const w = z.x1 - z.x0;
         const d = z.z1 - z.z0;
         // the tower stands at the zone's back edge and swings across it while it is on
         const k = on ? 1 : 0;
         place(m, (z.x0 + z.x1) / 2, 0, z.z1 - 0.2, Math.PI, w / GLB_SIZE.blocks.x, (2.4 - k * 1.4) / GLB_SIZE.blocks.y, (d * (0.4 + 0.6 * k)) / GLB_SIZE.blocks.z);
         color?.copy(on ? GLOW : WHITE);
         return;
      }
      const wi = i - c.cascades.length;
      const z = c.walls[wi];
      if (!z || run.wallBroken[wi]) return false;
      place(m, (z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2, 0, (z.x1 - z.x0) / GLB_SIZE.blocks.x, 2.6 / GLB_SIZE.blocks.y, (z.z1 - z.z0 + 0.4) / GLB_SIZE.blocks.z);
      // cracked: a faint red pulse for Riko
      color?.set("#ffd0c8");
   };
   if (n === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.blocks} count={n} update={update} tinted name="blocks" />;
}

function Castles({ course, clock }: { course: RoomCourse; clock: VisualClock }) {
   const ghost = useRef<Mesh>(null);
   useFrame(() => {
      const g = ghost.current;
      if (g) (g.material as MeshBasicMaterial).opacity = 0.22 + 0.1 * Math.sin(clock.ms / 380);
   });
   const spots = useMemo(() => {
      const out = course.castles.map((z) => ({ x: (z.x0 + z.x1) / 2, y: 0, z: (z.z0 + z.z1) / 2, rotY: 0, sx: (z.x1 - z.x0) / GLB_SIZE.castle.x, sy: 6 / GLB_SIZE.castle.y, sz: (z.z1 - z.z0) / GLB_SIZE.castle.z }));
      // the big finish castle behind the toy chest (or the boss corner)
      out.push({ x: course.finish.x + (course.boss ? 0 : 3), y: 0, z: course.boss ? course.maxZ + 6 : course.finish.z + 5, rotY: Math.PI, sx: 4.2, sy: 4.2, sz: 4.2 });
      return out;
   }, [course]);
   const g = course.ghosts[0];
   return (
      <>
         <InstancedModel asset={ASSETS.castle} spots={spots} fallback={null} />
         {g ? (
            <group position={[(g.x0 + g.x1) / 2, 0, (g.z0 + g.z1) / 2]} rotation-y={Math.PI / 2}>
               <ArchWall color="#c4b5fd" accent={COLORS.ghost} />
               <mesh ref={ghost} position={[0, 1.2, 0.3]}>
                  <planeGeometry args={[1.6, 2.4]} />
                  <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.25} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            </group>
         ) : null}
      </>
   );
}

function Pencils({ course }: { course: RoomCourse }) {
   return (
      <>
         {course.pencils.map((r, i) => (
            // lying as a ramp: its point on the desk, its end at the lip
            <group key={i} position={[r.x - r.dx * PENCIL_LEN * 0.5, PENCIL_H * 0.5 - 0.1, r.z - r.dz * PENCIL_LEN * 0.5]} rotation-y={Math.atan2(r.dx, r.dz)}>
               <group rotation-x={-Math.atan2(PENCIL_H, PENCIL_LEN)}>
                  <Model asset={ASSETS.pencil} position={[0, -0.2, 0]} />
               </group>
            </group>
         ))}
      </>
   );
}

function Beacons({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const c = run.course;
   const rings = useRef<Group>(null);
   useFrame(() => {
      const g = rings.current;
      if (!g) return;
      g.children.forEach((child, i) => {
         const mat = (child as Mesh).material as MeshBasicMaterial;
         mat.opacity = i <= run.checkpoint ? 0.75 + 0.2 * Math.sin(clock.ms / 200) : 0.18;
      });
   });
   const spots = useMemo(() => c.checkpoints.slice(1).map((p) => ({ x: p.x + 4.4, y: 0, z: p.z })), [c]);
   return (
      <>
         {spots.length > 0 ? <InstancedModel asset={ASSETS.beacon} spots={spots} fallback={null} /> : null}
         <group ref={rings}>
            {c.checkpoints.map((p, i) => (
               <mesh key={i} position={[p.x, 0.04, p.z]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[1.7, 2.1, 36]} />
                  <meshBasicMaterial color="#7dd3fc" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
               </mesh>
            ))}
         </group>
      </>
   );
}

function Orbs({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const c = run.course;
   const update = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = c.orbs[i];
      if (o.hidden && run.hero.magnetUntil < run.simMs) return false;
      const t = clock.ms / 1000;
      const s = o.hidden ? 0.7 : 1;
      place(m, o.x, o.y - 0.3 + 0.12 * Math.sin(t * 2.4 + i), o.z, t * 1.6 + i, s, s, s);
   };
   return <DynamicInstancedModel asset={ASSETS.gem} count={c.orbs.length} update={update} name="gems" />;
}

function Secrets({ run, clock }: { run: ToyRun; clock: VisualClock }) {
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

/** The finish: a glowing ring on the desk in front of the castle (not on level 5: Jack is the goal). */
function Finish({ course, clock }: { course: RoomCourse; clock: VisualClock }) {
   const ring = useRef<Mesh>(null);
   useFrame(() => {
      const r = ring.current;
      if (r) r.scale.setScalar(1 + 0.08 * Math.sin(clock.ms / 200));
   });
   if (course.boss) return null;
   return (
      <group position={[course.finish.x, 0.05, course.finish.z]}>
         <mesh ref={ring} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[2.1, 2.5, 48]} />
            <meshBasicMaterial color={COLORS.wave} transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
         <Model asset={ASSETS.windKey} position={[0, 0, 0]} rotation-y={0.6} />
      </group>
   );
}

export function Course({ run, clock }: { run: ToyRun; clock: VisualClock }) {
   const course = run.course;
   const look = LOOKS[course.id];
   return (
      <group>
         <Furniture course={course} />
         <Pieces run={run} clock={clock} kind="domino" glow={look.pieceGlow} />
         <Pieces run={run} clock={clock} kind="key" glow={look.pieceGlow} />
         <Pieces run={run} clock={clock} kind="book" glow={look.pieceGlow} />
         <PieceGlow run={run} clock={clock} strength={look.pieceGlow} />
         <Spares run={run} />
         <Drums run={run} clock={clock} />
         <Cars run={run} />
         <Tops run={run} clock={clock} />
         <Blocks run={run} clock={clock} />
         <Castles course={course} clock={clock} />
         <Pencils course={course} />
         <Beacons run={run} clock={clock} />
         <Orbs run={run} clock={clock} />
         <Secrets run={run} clock={clock} />
         <Finish course={course} clock={clock} />
      </group>
   );
}
