"use client";

// The toy pinball table, drawn in table coordinates inside a group tilted TILT (the rules' plane):
// the painted playfield and the cabinet, vanilla rails along every wall, strawberry slingshot faces on
// bounce pads, the GLB bumpers (a light ring flashes on a hit), mushrooms, penguin drop targets (ice
// blocks on level 3) that sink when knocked down, lanterns, the clear plastic ramps with their gold score
// rings, the score orbs, Zuno's magnet pads over the coin trail under glass, the exit hole (a candy lid
// until it opens), Riko's cracked block, Nami's raised deck, Vexa's ghost gate and attic, the plunger
// that squeezes with the charge, the flippers (menu2/props Flipper), the chase lights round the rails
// (faster with the combo) and the backbox with the table's name. Visual only.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   CanvasTexture, CatmullRomCurve3, Color, DoubleSide, Euler, InstancedMesh, Matrix4, Object3D, Quaternion, SRGBColorSpace, Vector3,
   type Group, type Mesh, type MeshStandardMaterial,
} from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { Flipper, FLIPPER_SIZE } from "@/arcade3d/menu2/props";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS, chase, levelLook, type LevelLook } from "./look";
import { ATTIC, DECK, FLIPPER_LEN, LANE_X, PLUNGER, TILT, buildTable, type Seg, type Table } from "./table";
import { exitOpen, type PinRun } from "./rules";
import { LEVELS } from "./levels";

const RAIL_H = 0.62;

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = w;
   c.height = h;
   draw(c.getContext("2d")!);
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   t.anisotropy = 4;
   t.needsUpdate = true;
   return t;
}

/** The playfield art: the base, diagonal candy stripes, the lane arrows, a big star under the bumpers, the drain apron. */
function fieldTexture(table: Table, look: LevelLook): CanvasTexture {
   const W = 512;
   const H = 1024;
   // table x -7.4..7.4 -> 0..W, z -29.6..0.4 -> 0..H
   const X = (x: number) => ((x + 7.4) / 14.8) * W;
   const Z = (z: number) => ((z + 29.6) / 30) * H;
   return canvasTex(W, H, (g) => {
      g.fillStyle = look.field;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = look.stripe;
      g.lineWidth = 22;
      for (let k = -H; k < W + H; k += 64) {
         g.beginPath();
         g.moveTo(k, 0);
         g.lineTo(k + H * 0.6, H);
         g.stroke();
      }
      // a soft glow under the upper field
      const glow = g.createRadialGradient(X(0), Z(-18), 10, X(0), Z(-18), 230);
      glow.addColorStop(0, "rgba(255,255,255,0.65)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, W, H);
      // a star
      const star = (cx: number, cy: number, r: number, fill: string) => {
         g.beginPath();
         for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 === 0 ? r : r * 0.45;
            g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
         }
         g.closePath();
         g.fillStyle = fill;
         g.fill();
      };
      star(X(0), Z(-18.5), 120, `${look.accent}55`);
      star(X(0), Z(-18.5), 70, `${look.accent}88`);
      // the lane arrows up the middle
      g.fillStyle = `${look.accent}cc`;
      for (const [x, z] of [[-2.2, -8.2], [0, -9.2], [2.2, -8.2]] as const) {
         g.beginPath();
         g.moveTo(X(x), Z(z) - 26);
         g.lineTo(X(x) + 16, Z(z) + 8);
         g.lineTo(X(x) - 16, Z(z) + 8);
         g.closePath();
         g.fill();
      }
      // the ramp mouths: arrows along each ramp's way in
      g.fillStyle = "#ffffffcc";
      for (const r of table.ramps) {
         if (r.kind !== "ramp") continue;
         for (let k = 1; k <= 3; k++) {
            const cx = X(r.ex - r.dx * (k * 1.1));
            const cy = Z(r.ez - r.dz * (k * 1.1));
            g.save();
            g.translate(cx, cy);
            g.rotate(Math.atan2(r.dz, r.dx) + Math.PI / 2);
            g.beginPath();
            g.moveTo(0, -14);
            g.lineTo(11, 8);
            g.lineTo(-11, 8);
            g.closePath();
            g.fill();
            g.restore();
         }
      }
      // the drain apron and the plunger lane
      g.fillStyle = "#1f1b3acc";
      g.fillRect(0, Z(-1.4), W, H - Z(-1.4));
      g.fillStyle = "#fff4d6";
      g.font = "bold 30px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("PLATE BOUNCE", X(-0.6), Z(-0.55));
      g.fillStyle = `${look.accent}66`;
      g.fillRect(X(LANE_X), 0, W - X(LANE_X), H);
      // the coin window (the glass is drawn over it)
      g.fillStyle = "#1e3a5f";
      g.beginPath();
      g.ellipse(X(0), Z(-11.1), X(3.1) - X(0), Z(-10.1) - Z(-11.1), 0, 0, Math.PI * 2);
      g.fill();
   });
}

function backboxTexture(level: LevelId, look: LevelLook): CanvasTexture {
   return canvasTex(512, 256, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, look.accent);
      grad.addColorStop(1, "#2a1b5c");
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 256);
      g.strokeStyle = "#fff4d6";
      g.lineWidth = 10;
      g.strokeRect(8, 8, 496, 240);
      g.fillStyle = "#ffffff";
      g.font = "900 64px system-ui, sans-serif";
      g.textAlign = "center";
      g.fillText("PLATE", 256, 92);
      g.fillText("BOUNCE", 256, 158);
      g.fillStyle = "#ffd257";
      g.font = "bold 30px system-ui, sans-serif";
      g.fillText(LEVELS[level].name.toUpperCase(), 256, 214);
   });
}

const UP = new Vector3(0, 1, 0);
const Q = new Quaternion();
const E = new Euler();
const V = new Vector3();
const S = new Vector3();

function segSpot(s: Seg, h: number, height: number): Matrix4 {
   const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
   E.set(0, -Math.atan2(s.bz - s.az, s.bx - s.ax), 0);
   Q.setFromEuler(E);
   V.set((s.ax + s.bx) / 2, h + height / 2, (s.az + s.bz) / 2);
   S.set(len + s.r * 2, height, s.r * 2 + 0.06);
   return new Matrix4().compose(V, Q, S);
}

/** One instanced box per segment of a kind (static). */
function Rails({ segs, color, h = 0, height = RAIL_H, emissive }: { segs: Seg[]; color: string; h?: number; height?: number; emissive?: string }) {
   const mats = useMemo(() => segs.map((s) => segSpot(s, s.layer === 1 ? DECK.h + h : h, height)), [segs, h, height]);
   return (
      <instancedMesh
         ref={(m) => {
            if (!m) return;
            mats.forEach((mt, i) => m.setMatrixAt(i, mt));
            m.instanceMatrix.needsUpdate = true;
            m.computeBoundingSphere();
         }}
         args={[undefined, undefined, Math.max(1, segs.length)]}
         castShadow
         receiveShadow
      >
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color={color} roughness={0.38} metalness={0.05} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.5 : 0} />
      </instancedMesh>
   );
}

function Playfield({ table, level }: { table: Table; level: LevelId }) {
   const look = levelLook(level);
   const tex = useMemo(() => fieldTexture(table, look), [table, look]);
   const back = useMemo(() => backboxTexture(level, look), [level, look]);
   return (
      <group>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0, -14.6]} receiveShadow>
            <planeGeometry args={[14.8, 30]} />
            <meshStandardMaterial map={tex} roughness={0.35} metalness={0.02} />
         </mesh>
         {/* the attic floor */}
         <mesh rotation-x={-Math.PI / 2} position={[(ATTIC.x0 + ATTIC.x1) / 2 - 0.1, 0.005, (ATTIC.z0 + ATTIC.z1) / 2]} receiveShadow>
            <planeGeometry args={[ATTIC.x1 - ATTIC.x0 + 0.2, ATTIC.z1 - ATTIC.z0]} />
            <meshStandardMaterial color="#3b2a6b" roughness={0.6} emissive="#5b21b6" emissiveIntensity={0.25} />
         </mesh>
         {/* the cabinet: a box under the field, wider at the attic */}
         <mesh position={[0, -0.75, -14.6]} castShadow receiveShadow>
            <boxGeometry args={[15.2, 1.5, 30.4]} />
            <meshStandardMaterial color={COLORS.cabinet} roughness={0.5} />
         </mesh>
         <mesh position={[(ATTIC.x0 + ATTIC.x1) / 2 - 0.2, -0.75, (ATTIC.z0 + ATTIC.z1) / 2]} castShadow>
            <boxGeometry args={[3.0, 1.5, 5.4]} />
            <meshStandardMaterial color={COLORS.cabinetDark} roughness={0.5} />
         </mesh>
         {/* side trims */}
         <mesh position={[-7.55, 0.45, -14.6]}>
            <boxGeometry args={[0.3, 0.9, 30.4]} />
            <meshStandardMaterial color={COLORS.cabinetDark} roughness={0.45} />
         </mesh>
         <mesh position={[7.55, 0.45, -14.6]}>
            <boxGeometry args={[0.3, 0.9, 30.4]} />
            <meshStandardMaterial color={COLORS.cabinetDark} roughness={0.45} />
         </mesh>
         {/* the backbox */}
         <group position={[0, 0, -30.2]}>
            <mesh position={[0, 2.6, 0]} castShadow>
               <boxGeometry args={[12, 5.2, 0.8]} />
               <meshStandardMaterial color={COLORS.cabinetDark} roughness={0.45} />
            </mesh>
            <mesh position={[0, 2.8, 0.42]}>
               <planeGeometry args={[11, 4.4]} />
               <meshStandardMaterial map={back} emissive="#ffffff" emissiveMap={back} emissiveIntensity={0.45} roughness={0.4} />
            </mesh>
         </group>
      </group>
   );
}

/** Bulbs along the rails that chase faster with the combo. */
function ChaseLights({ run, mult }: { run: PinRun; mult: { current: number } }) {
   const ref = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const spots = useMemo(() => {
      const out: { x: number; z: number }[] = [];
      for (let z = -2.5; z > -21; z -= 1.5) {
         out.push({ x: -7.3, z });
      }
      for (let a = 0; a <= Math.PI; a += Math.PI / 12) out.push({ x: Math.cos(Math.PI - a) * 7.3, z: -22 - Math.sin(a) * 7.3 });
      for (let z = -21; z < -2.5; z += 1.5) out.push({ x: 7.3, z });
      return out;
   }, []);
   const base = useMemo(() => new Color(levelLook(run.level).neon), [run.level]);
   const dim = useMemo(() => new Color("#3a3150"), []);
   const c = useMemo(() => new Color(), []);
   const m = useMemo(() => new Matrix4(), []);
   useFrame(() => {
      const mesh = ref.current;
      if (!mesh) return;
      const t = time.now;
      for (let i = 0; i < spots.length; i++) {
         const k = chase(i, 8, t, mult.current);
         c.copy(dim).lerp(base, 0.25 + 0.75 * k);
         mesh.setColorAt(i, c);
         m.makeTranslation(spots[i].x, 0.75, spots[i].z);
         mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, spots.length]}>
         <sphereGeometry args={[0.14, 10, 8]} />
         <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
   );
}

function Ramps({ table }: { table: Table }) {
   const tubes = useMemo(
      () =>
         table.ramps.map((r) => {
            const pts = r.path.map((p) => new Vector3(p.x, p.h + 0.5, p.z));
            return new CatmullRomCurve3(pts, false, "catmullrom", 0.2);
         }),
      [table],
   );
   return (
      <group>
         {tubes.map((c, i) => (
            <group key={i}>
               <mesh renderOrder={2}>
                  <tubeGeometry args={[c, 120, 0.7, 12, false]} />
                  <meshStandardMaterial color={table.ramps[i].kind === "orbit" ? COLORS.orbit : COLORS.ramp} transparent opacity={0.32} roughness={0.15} side={DoubleSide} depthWrite={false} />
               </mesh>
               <mesh>
                  <tubeGeometry args={[c, 120, 0.08, 6, false]} />
                  <meshStandardMaterial color={COLORS.rail} roughness={0.3} metalness={0.4} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

const PLUNGER_SPOT: InstanceSpot[] = [{ x: 0, y: 0, z: 0, scale: 1.3 / 1.906 }];
const P = new Vector3();
const SC = new Vector3();
const QQ = new Quaternion();
const EE = new Euler();

function place(m: Matrix4, x: number, y: number, z: number, rotY: number, sx: number, sy: number, sz: number, rotX = 0): Matrix4 {
   EE.set(rotX, rotY, 0, "YXZ");
   QQ.setFromEuler(EE);
   P.set(x, y, z);
   SC.set(sx, sy, sz);
   return m.compose(P, QQ, SC);
}

export interface TableClock {
   /** bumper flash times (s, game time) */
   bumperAt: Float64Array;
   lanternAt: Float64Array;
   mult: { current: number };
}

export function createTableClock(table: Table): TableClock {
   return { bumperAt: new Float64Array(table.bumpers.length).fill(-9), lanternAt: new Float64Array(table.lanterns.length).fill(-9), mult: { current: 1 } };
}

export default function TableView({ run, clock }: { run: PinRun; clock: TableClock }) {
   const table = run.table;
   const level = run.level;
   const time = useGameTime();
   const look = levelLook(level);
   const wallSegs = useMemo(() => table.segs.filter((s) => s.kind === "wall" || s.kind === "oneway" || s.kind === "rim"), [table]);
   const kickSegs = useMemo(() => table.segs.filter((s) => s.kind === "kick"), [table]);
   const ghost = useMemo(() => table.segs.find((s) => s.kind === "ghost")!, [table]);
   const crack = useMemo(() => table.segs.find((s) => s.kind === "crack")!, [table]);
   const gate = useMemo(() => table.segs.find((s) => s.kind === "gate") ?? null, [table]);
   const ghostRef = useRef<Mesh>(null);
   const crackRef = useRef<Mesh>(null);
   const gateRef = useRef<Mesh>(null);
   const lidRef = useRef<Mesh>(null);
   const holeGlow = useRef<Mesh>(null);
   const flipL = useRef<Group>(null);
   const flipR = useRef<Group>(null);
   const plunger = useRef<Group>(null);
   const lanternRefs = useRef<(Mesh | null)[]>([]);
   const ringRefs = useRef<(Mesh | null)[]>([]);
   const shardRef = useRef<Mesh>(null);
   const marbleRefs = useRef<(Mesh | null)[]>([]);

   // static GLB spots
   const bumperSpots = useMemo<InstanceSpot[]>(
      () => table.bumpers.map((b) => ({ x: b.x, y: b.layer === 1 ? DECK.h : 0, z: b.z, sx: fit(GLB_SIZE.bumper.x, b.r * 2), sz: fit(GLB_SIZE.bumper.z, b.r * 2), sy: fit(GLB_SIZE.bumper.y, b.layer === 1 ? 0.8 : 1.25) })),
      [table],
   );
   const mushSpots = useMemo<InstanceSpot[]>(
      () => table.mushrooms.map((m) => ({ x: m.x, y: 0, z: m.z, scale: fit(GLB_SIZE.mushroom.x, m.r * 2.2) })),
      [table],
   );
   const magnetSpots = useMemo<InstanceSpot[]>(
      () => table.magnets.map((m) => ({ x: m.x, y: 0, z: m.z, sx: fit(GLB_SIZE.magnet.x, m.r * 2), sz: fit(GLB_SIZE.magnet.z, m.r * 2), sy: fit(GLB_SIZE.magnet.y, 0.55) })),
      [table],
   );
   const padSpots = useMemo<InstanceSpot[]>(
      () => [
         { x: -4.9, y: 0, z: -6.6, rotY: -0.46, sx: fit(GLB_SIZE.pad.x, 1.1), sy: 1.1, sz: fit(GLB_SIZE.pad.z, 2.6) },
         { x: 4.85, y: 0, z: -6.6, rotY: 0.46, sx: fit(GLB_SIZE.pad.x, 1.1), sy: 1.1, sz: fit(GLB_SIZE.pad.z, 2.6) },
      ],
      [],
   );
   const postSpots = useMemo<InstanceSpot[]>(() => table.posts.map((p) => ({ x: p.x, y: 0.4, z: p.z, sx: p.r * 2, sy: 0.8, sz: p.r * 2 })), [table]);
   const deckPosts = useMemo<InstanceSpot[]>(
      () => [
         { x: DECK.x0 + 0.2, y: DECK.h / 2, z: DECK.z0 + 0.2 },
         { x: DECK.x1 - 0.2, y: DECK.h / 2, z: DECK.z0 + 0.2 },
         { x: DECK.x0 + 0.2, y: DECK.h / 2, z: DECK.z1 - 0.2 },
         { x: DECK.x1 - 0.2, y: DECK.h / 2, z: DECK.z1 - 0.2 },
      ],
      [],
   );

   const targetH = 1.15;
   const updatePenguin = useMemo(
      () => (i: number, m: Matrix4, color: Color) => {
         const t = table.targets[i];
         if (!t) return false;
         const down = run.prog.down[i] === 1;
         const sink = down ? -targetH * 1.05 : 0;
         place(m, t.x, sink, t.z, 0, fit(GLB_SIZE.penguin.x, t.r * 2.1), fit(GLB_SIZE.penguin.y, targetH), fit(GLB_SIZE.penguin.z, t.r * 1.8));
         if (t.ice) color.set(COLORS.ice);
         return !down || sink > -targetH;
      },
      [table, run],
   );
   const orbSpots = useMemo(() => table.orbs.map((o, i) => ({ o, i })).filter(({ o }) => o.kind !== "ramp" && o.kind !== "coin"), [table]);
   const ringSpots = useMemo(() => table.orbs.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === "ramp"), [table]);
   const coinSpots = useMemo(() => table.orbs.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === "coin"), [table]);
   const updateOrb = useMemo(
      () => (k: number, m: Matrix4) => {
         const s = orbSpots[k];
         if (!s || run.collected[s.i]) return false;
         const t = time.now;
         const sc = fit(GLB_SIZE.orb.y, 0.7);
         place(m, s.o.x, s.o.h + 0.2 + Math.sin(t * 2.4 + k) * 0.08, s.o.z, t * 1.6 + k, sc, sc, sc);
      },
      [orbSpots, run, time],
   );
   const ringDir = useMemo(
      () =>
         ringSpots.map(({ o }) => {
            const r = table.ramps[o.ramp];
            let best = 1;
            let bd = Infinity;
            for (let i = 1; i < r.path.length; i++) {
               const d = Math.hypot(r.path[i].x - o.x, r.path[i].z - o.z);
               if (d < bd) {
                  bd = d;
                  best = i;
               }
            }
            const a = r.path[best - 1];
            const b = r.path[best];
            return Math.atan2(b.x - a.x, b.z - a.z);
         }),
      [ringSpots, table],
   );
   const updateRing = useMemo(
      () => (k: number, m: Matrix4) => {
         const s = ringSpots[k];
         if (!s || run.collected[s.i]) return false;
         const sc = fit(GLB_SIZE.ring.x, 1.9);
         // standing up across the ramp: the ball rolls through it
         place(m, s.o.x, s.o.h + 0.5, s.o.z, ringDir[k], sc, sc, sc, Math.PI / 2);
      },
      [ringSpots, ringDir, run],
   );
   const updateCoin = useMemo(
      () => (k: number, m: Matrix4) => {
         const s = coinSpots[k];
         if (!s || run.collected[s.i]) return false;
         const sc = fit(GLB_SIZE.orb.y, 0.55);
         place(m, s.o.x, 0.08, s.o.z + 0.27, 0, sc, sc, sc, -Math.PI / 2);
      },
      [coinSpots, run],
   );

   useFrame(() => {
      const t = time.now;
      const now = run.simMs;
      if (ghostRef.current) {
         const mat = ghostRef.current.material as MeshStandardMaterial;
         const phasing = run.phaseUntil >= now;
         mat.opacity = phasing ? 0.18 : 0.45 + 0.15 * Math.sin(t * 3);
         mat.emissiveIntensity = phasing ? 1.4 : 0.6;
      }
      if (crackRef.current) crackRef.current.visible = run.prog.cracked === 0;
      if (gateRef.current && gate) gateRef.current.visible = run.prog.stage < gate.until;
      const open = exitOpen(run);
      if (lidRef.current) lidRef.current.visible = !open && !table.boss;
      if (holeGlow.current) {
         holeGlow.current.visible = open;
         const s = 1 + 0.12 * Math.sin(t * 6);
         holeGlow.current.scale.set(s, s, 1);
      }
      const fl = [flipL.current, flipR.current];
      for (let i = 0; i < 2; i++) {
         const g = fl[i];
         if (!g) continue;
         const f = table.flippers[i];
         const a = run.flip[i];
         g.rotation.y = f.side === 1 ? -a : Math.PI + a;
         const jam = run.rollo.jam === i;
         g.position.y = jam ? 0.05 + 0.05 * Math.sin(t * 30) : 0.05;
      }
      if (plunger.current) {
         const c = run.ball.mode === "plunger" ? run.ball.charge : 0;
         plunger.current.scale.z = 1 - c * 0.45;
      }
      const o = run.prog;
      for (let i = 0; i < table.lanterns.length; i++) {
         const l = lanternRefs.current[i];
         if (!l) continue;
         const mat = l.material as MeshStandardMaterial;
         const flash = Math.max(0, 1 - (t - clock.lanternAt[i]) * 2);
         mat.emissiveIntensity = o.lit[i] ? 1.6 + flash * 2 : 0.15 + 0.1 * Math.sin(t * 4 + i);
      }
      for (let i = 0; i < table.bumpers.length; i++) {
         const r = ringRefs.current[i];
         if (!r) continue;
         const k = Math.max(0, 1 - (t - clock.bumperAt[i]) * 5);
         (r.material as MeshStandardMaterial).emissiveIntensity = 0.4 + k * 3;
         r.scale.setScalar(1 + k * 0.25);
      }
      if (shardRef.current) {
         shardRef.current.visible = !run.secrets.found[2];
         shardRef.current.rotation.y = t * 1.5;
      }
      for (let i = 0; i < 2; i++) {
         const mm = marbleRefs.current[i];
         const mb = run.marbles[i];
         if (!mm) continue;
         mm.visible = !!mb && mb.alive;
         if (mb) mm.position.set(mb.x, 0.42, mb.z);
      }
   });

   return (
      <group>
         <Playfield table={table} level={level} />
         <Rails segs={wallSegs} color={COLORS.rail} />
         <Rails segs={kickSegs} color={look.accent} emissive={look.accent} height={0.7} />
         <ChaseLights run={run} mult={clock.mult} />
         <Ramps table={table} />
         {/* the ghost gate, Riko's cracked block, the drain gate */}
         <mesh ref={ghostRef} matrixAutoUpdate={false} matrix={segSpot(ghost, 0, 1.2)} renderOrder={3}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} transparent opacity={0.5} depthWrite={false} />
         </mesh>
         <mesh ref={crackRef} matrixAutoUpdate={false} matrix={segSpot(crack, 0, 0.9)} castShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.crack} roughness={0.85} />
         </mesh>
         {gate ? (
            <mesh ref={gateRef} matrixAutoUpdate={false} matrix={segSpot(gate, 0, 0.45)}>
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.strawberry} emissive={COLORS.strawberry} emissiveIntensity={0.6} />
            </mesh>
         ) : null}
         {/* bumpers with their light rings */}
         <InstancedModel asset={ASSETS.bumper} spots={bumperSpots} fallback={<Instanced spots={bumperSpots}><cylinderGeometry args={[0.5, 0.5, 1.9, 16]} /><meshStandardMaterial color="#38bdf8" /></Instanced>} />
         {table.bumpers.map((b, i) => (
            <mesh key={i} ref={(m) => { ringRefs.current[i] = m; }} position={[b.x, (b.layer === 1 ? DECK.h : 0) + 0.08, b.z]} rotation-x={-Math.PI / 2}>
               <torusGeometry args={[b.r + 0.12, 0.08, 8, 28]} />
               <meshStandardMaterial color={look.neon} emissive={look.neon} emissiveIntensity={0.4} toneMapped={false} />
            </mesh>
         ))}
         {mushSpots.length ? <InstancedModel asset={ASSETS.mushroom} spots={mushSpots} fallback={<Instanced spots={mushSpots}><cylinderGeometry args={[0.6, 0.3, 1.7, 14]} /><meshStandardMaterial color="#ef4444" /></Instanced>} /> : null}
         <InstancedModel asset={ASSETS.magnet} spots={magnetSpots} fallback={<Instanced spots={magnetSpots}><cylinderGeometry args={[0.9, 0.9, 0.2, 18]} /><meshStandardMaterial color="#ef4444" /></Instanced>} />
         <InstancedModel asset={ASSETS.pad} spots={padSpots} fallback={<Instanced spots={padSpots}><boxGeometry args={[1.8, 0.5, 1.9]} /><meshStandardMaterial color="#38bdf8" /></Instanced>} />
         <Instanced spots={postSpots}>
            <cylinderGeometry args={[0.5, 0.5, 1, 12]} />
            <meshStandardMaterial color={COLORS.rail} roughness={0.3} />
         </Instanced>
         <DynamicInstancedModel asset={ASSETS.penguin} count={table.targets.length} update={updatePenguin} tinted />
         <DynamicInstancedModel asset={ASSETS.orb} count={orbSpots.length} update={updateOrb} />
         {ringSpots.length ? <DynamicInstancedModel asset={ASSETS.ring} count={ringSpots.length} update={updateRing} /> : null}
         <DynamicInstancedModel asset={ASSETS.coin} count={coinSpots.length} update={updateCoin} />
         {/* the glass over the coin trail */}
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.12, -11.1]} renderOrder={2}>
            <circleGeometry args={[1, 40]} />
            <meshStandardMaterial color={COLORS.glass} transparent opacity={0.28} roughness={0.05} metalness={0.3} depthWrite={false} />
         </mesh>
         {/* lanterns */}
         {table.lanterns.map((l, i) => (
            <group key={i} position={[l.x, 0, l.z]}>
               <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
                  <circleGeometry args={[l.r + 0.15, 24]} />
                  <meshStandardMaterial color="#3b2f1a" />
               </mesh>
               <mesh ref={(m) => { lanternRefs.current[i] = m; }} position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
                  <circleGeometry args={[l.r, 24]} />
                  <meshStandardMaterial color={COLORS.lantern} emissive={COLORS.lantern} emissiveIntensity={0.2} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {/* the exit hole */}
         {!table.boss ? (
            <group position={[table.hole.x, 0, table.hole.z]}>
               <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
                  <circleGeometry args={[table.hole.r, 28]} />
                  <meshBasicMaterial color={COLORS.hole} />
               </mesh>
               <mesh position={[0, 0.04, 0]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[table.hole.r, table.hole.r + 0.18, 32]} />
                  <meshStandardMaterial color={COLORS.rail} metalness={0.5} roughness={0.25} />
               </mesh>
               <mesh ref={lidRef} position={[0, 0.18, 0]} castShadow>
                  <cylinderGeometry args={[table.hole.r + 0.05, table.hole.r + 0.12, 0.36, 28]} />
                  <meshStandardMaterial color={look.accent} roughness={0.35} />
               </mesh>
               <mesh ref={holeGlow} position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[table.hole.r + 0.25, table.hole.r + 0.6, 32]} />
                  <meshBasicMaterial color={COLORS.holeOpen} transparent opacity={0.85} toneMapped={false} />
               </mesh>
            </group>
         ) : null}
         {/* the sticker spot and the attic shard */}
         <mesh position={[table.sticker.x, 0.03, table.sticker.z]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.45, 20]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={0.3} />
         </mesh>
         <mesh ref={shardRef} position={[table.shard.x, 0.7, table.shard.z]}>
            <octahedronGeometry args={[0.38, 0]} />
            <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={1.2} toneMapped={false} />
         </mesh>
         {/* Nami's deck */}
         <mesh position={[(DECK.x0 + DECK.x1) / 2, DECK.h - 0.08, (DECK.z0 + DECK.z1) / 2]} receiveShadow castShadow>
            <boxGeometry args={[DECK.x1 - DECK.x0, 0.16, DECK.z1 - DECK.z0]} />
            <meshStandardMaterial color={COLORS.deck} transparent opacity={0.8} roughness={0.2} />
         </mesh>
         <Instanced spots={deckPosts}>
            <cylinderGeometry args={[0.14, 0.14, DECK.h, 10]} />
            <meshStandardMaterial color={COLORS.rail} metalness={0.4} roughness={0.3} />
         </Instanced>
         {/* the plunger */}
         <group ref={plunger} position={[PLUNGER.x, 0.45, PLUNGER.z + 1.8]}>
            <group rotation-x={-Math.PI / 2}>
               <InstancedModel
                  asset={ASSETS.plunger}
                  spots={PLUNGER_SPOT}
                  fallback={<Instanced spots={[{ x: 0, y: 0, z: 0 }]}><cylinderGeometry args={[0.3, 0.3, 1.3, 12]} /><meshStandardMaterial color="#f59e0b" /></Instanced>}
               />
            </group>
         </group>
         {/* flippers: the prop's pivot cap is 0.22 of its length in from its origin */}
         {table.flippers.map((f, i) => {
            const s = FLIPPER_LEN / FLIPPER_SIZE.length;
            return (
               <group key={i} ref={i === 0 ? flipL : flipR} position={[f.px, 0.05, f.pz]}>
                  <Flipper position={[-0.22 * s, 0, 0]} scale={[s, 2.2, s * 1.2]} color={i === 0 ? look.accent : look.accent} accent="#fff4d6" />
               </group>
            );
         })}
         {/* the marbles */}
         {[0, 1].map((i) => (
            <mesh key={i} ref={(m) => { marbleRefs.current[i] = m; }} visible={false} castShadow>
               <sphereGeometry args={[0.42, 20, 14]} />
               <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.12} />
            </mesh>
         ))}
      </group>
   );
}

/** The table's tilted frame: children are in table coordinates. */
export function TableFrame({ children }: { children: React.ReactNode }) {
   return <group rotation-x={TILT}>{children}</group>;
}

export { buildTable, UP };
