"use client";

// The course's look: the sea, one floating island per hole (only the current and the next are
// mounted), the felt (one merged mesh per hole, drawn from the rules' height functions), the
// wooden rails (instanced boards on the rules' segments), the cup and the flag, the ponds and the
// gap, hole 5's pipes, hole 6's turntable, and the decor. Static except the bar (rules time).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, LatheGeometry, TubeGeometry, Vector2, Vector3, type Group } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Water } from "@/arcade3d/core/env";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { HILL_GRADE, RAMP, TIER_WALL_Z, TIER_Y, TURNTABLE, heightAt, type Hole } from "./course";
import { COLORS, feltRects, holeZ, onFelt, type FeltRect } from "./looks";
import { CUP } from "./physics";
import { FlagPrimitive, RockPrimitives, TreePrimitives } from "./Primitives";
import { TICK_S, type RunState } from "./rules";
import { Windmill } from "./Windmill";

// ---------- felt ----------

const CELL = 0.25;
const SKIRT = -0.3;

/** One merged felt mesh: every region's top (mowing stripes, darker low) plus its side skirts. */
export function buildFelt(hole: Hole, rects: readonly FeltRect[]): BufferGeometry {
   const pos: number[] = [];
   const col: number[] = [];
   const idx: number[] = [];
   const hi = new Color(COLORS.felt);
   const lo = new Color(COLORS.feltLow);
   const side = new Color(COLORS.feltSide);
   const c = new Color();
   const h = (r: FeltRect, x: number, z: number) => heightAt(hole, x, z, r.upper) ?? 0;
   for (const r of rects) {
      const nx = Math.max(1, Math.ceil((r.x1 - r.x0) / CELL));
      const nz = Math.max(1, Math.ceil((r.z1 - r.z0) / CELL));
      const base = pos.length / 3;
      for (let i = 0; i <= nx; i++) {
         for (let j = 0; j <= nz; j++) {
            const x = r.x0 + ((r.x1 - r.x0) * i) / nx;
            const z = r.z0 + ((r.z1 - r.z0) * j) / nz;
            const y = h(r, x, z);
            pos.push(x, y, z);
            const stripe = Math.floor((z + 20) / 0.5) % 2 === 0 ? 0.25 : 0.4;
            c.copy(lo).lerp(hi, Math.min(1, stripe + y * 0.6));
            col.push(c.r, c.g, c.b);
         }
      }
      for (let i = 0; i < nx; i++) {
         for (let j = 0; j < nz; j++) {
            const a = base + i * (nz + 1) + j;
            idx.push(a, a + 1, a + nz + 1, a + 1, a + nz + 2, a + nz + 1);
         }
      }
      // skirts: the region's four edges down to below the island's top
      const edges: [number, number, number, number][] = [[r.x0, r.z0, r.x1, r.z0], [r.x1, r.z0, r.x1, r.z1], [r.x1, r.z1, r.x0, r.z1], [r.x0, r.z1, r.x0, r.z0]];
      for (const [ax, az, bx, bz] of edges) {
         const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / CELL));
         const s = pos.length / 3;
         for (let k = 0; k <= n; k++) {
            const x = ax + ((bx - ax) * k) / n;
            const z = az + ((bz - az) * k) / n;
            pos.push(x, h(r, x, z) - 0.002, z, x, SKIRT, z);
            col.push(side.r, side.g, side.b, side.r * 0.7, side.g * 0.7, side.b * 0.7);
         }
         for (let k = 0; k < n; k++) idx.push(s + 2 * k, s + 2 * k + 1, s + 2 * k + 2, s + 2 * k + 1, s + 2 * k + 3, s + 2 * k + 2);
      }
   }
   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(pos, 3));
   g.setAttribute("color", new Float32BufferAttribute(col, 3));
   g.setIndex(idx);
   g.computeVertexNormals();
   return g;
}

/** The rail boards: each drawn rail (split where the felt under it changes height), its inner face on the rules' line. */
export function railSpots(hole: Hole, rects: readonly FeltRect[]): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const T = 0.06;
   for (const r of hole.rails) {
      if (!r.drawn) continue;
      const dx = r.b.x - r.a.x;
      const dz = r.b.z - r.a.z;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const mx = (r.a.x + r.b.x) / 2;
      const mz = (r.a.z + r.b.z) / 2;
      const inA = onFelt(rects, mx + nx * 0.08, mz + nz * 0.08);
      const inB = onFelt(rects, mx - nx * 0.08, mz - nz * 0.08);
      // out of the felt by half a board, plus the drawn ball's extra 3 cm, when only one side is felt
      const shift = inA === inB ? 0 : (inA ? -1 : 1) * (T / 2 + 0.03);
      const sloped = heightAt(hole, r.a.x, r.a.z, r.zone === 1) !== heightAt(hole, r.b.x, r.b.z, r.zone === 1);
      const pieces = sloped ? Math.ceil(len / 0.25) : 1;
      for (let k = 0; k < pieces; k++) {
         const t = (k + 0.5) / pieces;
         const x = r.a.x + dx * t + nx * shift;
         const z = r.a.z + dz * t + nz * shift;
         const y = r.zone === 1 ? TIER_Y : heightAt(hole, r.a.x + dx * t, r.a.z + dz * t) ?? 0;
         out.push({ x, y: y + 0.05 - 0.02, z, rotY: Math.atan2(dx, dz), sx: T, sy: 0.14, sz: len / pieces + (pieces > 1 ? 0.02 : T) });
      }
   }
   return out;
}

function Felt({ hole, rects }: { hole: Hole; rects: readonly FeltRect[] }) {
   const geometry = useMemo(() => buildFelt(hole, rects), [hole, rects]);
   useEffect(() => () => geometry.dispose(), [geometry]);
   return (
      <mesh geometry={geometry} name="felt">
         <meshStandardMaterial vertexColors roughness={0.95} side={2} />
      </mesh>
   );
}

/** The island's rock base: a lathe stretched under the hole's box. */
function IslandBase({ hole }: { hole: Hole }) {
   const geometry = useMemo(() => {
      const pts = [[0, -2.6], [0.45, -2.3], [0.8, -1.4], [0.97, -0.6], [1, -0.32], [0.98, -0.25]].map(([r, y]) => new Vector2(r, y));
      return new LatheGeometry(pts, 14);
   }, []);
   useEffect(() => () => geometry.dispose(), [geometry]);
   const b = hole.box;
   const sx = (b.x1 - b.x0) / 2 + 0.6;
   const sz = (b.z1 - b.z0) / 2 + 0.6;
   return (
      <mesh geometry={geometry} position={[(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]} scale={[sx, 1, sz]} name="island-base">
         <meshStandardMaterial color={COLORS.rock} roughness={1} flatShading />
      </mesh>
   );
}

function Rails({ hole, rects }: { hole: Hole; rects: readonly FeltRect[] }) {
   const spots = useMemo(() => railSpots(hole, rects), [hole, rects]);
   return (
      <Instanced spots={spots} name="rails">
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color={COLORS.rail} roughness={0.8} />
      </Instanced>
   );
}

function Cup({ hole }: { hole: Hole }) {
   const y = (heightAt(hole, hole.cup.x, hole.cup.z) ?? 0) + 0.004;
   return (
      <group position={[hole.cup.x, y, hole.cup.z]} name="cup">
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0, CUP.drawnRadius + 0.025, 24]} />
            <meshBasicMaterial color={COLORS.rim} />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position-y={0.002}>
            <circleGeometry args={[CUP.drawnRadius, 24]} />
            <meshBasicMaterial color={COLORS.cup} />
         </mesh>
         <group position-z={-CUP.flagBack} name="flag">
            <Model asset={ASSETS.flag} fallback={<FlagPrimitive />} />
         </group>
      </group>
   );
}

function Ponds({ hole }: { hole: Hole }) {
   return (
      <>
         {hole.ponds.map((p, i) => (
            <Water key={i} size={[p.x1 - p.x0, p.z1 - p.z0]} position={[(p.x0 + p.x1) / 2, 0.012, (p.z0 + p.z1) / 2]} color={COLORS.water} deep={COLORS.deep} amplitude={0.004} wavelength={0.6} opacity={0.95} foamEdge={0.12} />
         ))}
      </>
   );
}

/** Hole 3: the water in the gap and the dashed ring of the shortest carry. */
function Gap({ hole }: { hole: Hole }) {
   const spots = useMemo<InstanceSpot[]>(() => Array.from({ length: 10 }, (_v, i) => ({ x: hole.cup.x * 0 + (i - 4.5) * 0.11, y: 0.006, z: RAMP.gapEnd - 0.12 })), [hole]);
   return (
      <group name="gap">
         <Water size={[1.4, 1.2]} position={[0, RAMP.waterY, (RAMP.lip + RAMP.gapEnd) / 2]} color={COLORS.water} deep={COLORS.deep} amplitude={0.01} wavelength={0.8} opacity={0.95} />
         <Instanced spots={spots} name="carry-line">
            <boxGeometry args={[0.07, 0.004, 0.03]} />
            <meshBasicMaterial color="#f8fafc" />
         </Instanced>
      </group>
   );
}

/** Hole 5: three blue pipes bridging from the tier's mouths, outside the rails, to their portals. */
function Pipes({ hole }: { hole: Hole }) {
   const parts = useMemo(() => {
      const s = hole.sx;
      const P = (x: number, y: number, z: number) => new Vector3(x * s, y, z);
      const routes = [
         [P(-1, 0.33, 1.55), P(-1.2, 0.3, 1.35), P(-1.72, 0.28, 1.2), P(-1.75, 0.2, -2.6), P(-1.62, 0.1, -3.0)],
         [P(0, 0.33, 1.55), P(-0.6, 0.3, 1.33), P(-1.9, 0.3, 1.1), P(-1.92, 0.2, -4.6), P(-0.4, 0.1, -4.72), P(0, 0.1, -4.62)],
         [P(1, 0.33, 1.55), P(1.3, 0.3, 1.35), P(1.75, 0.2, 1.1), P(1.62, 0.1, 0.8)],
      ];
      const tubes = routes.map((pts) => new TubeGeometry(new CatmullRomCurve3(pts, false, "catmullrom", 0.2), 40, 0.075, 8));
      const geometry = mergeGeometries(tubes)!;
      tubes.forEach((t) => t.dispose());
      const portals: InstanceSpot[] = hole.pipes.map((p) => ({ x: p.exit.x - p.dir.x * 0.02, y: 0.1, z: p.exit.z - p.dir.z * 0.02, rotY: Math.atan2(p.dir.x, p.dir.z) }));
      const mouths: InstanceSpot[] = hole.pipes.map((p) => ({ x: p.mouth.x, y: TIER_Y + 0.003, z: TIER_WALL_Z + 0.06 }));
      return { geometry, portals, mouths };
   }, [hole]);
   useEffect(() => () => parts.geometry.dispose(), [parts]);
   return (
      <group name="pipes">
         <mesh geometry={parts.geometry}>
            <meshStandardMaterial color={COLORS.pipe} roughness={0.4} metalness={0.1} />
         </mesh>
         <Instanced spots={parts.portals}>
            <torusGeometry args={[0.1, 0.035, 8, 16]} />
            <meshStandardMaterial color={COLORS.pipeDark} roughness={0.5} />
         </Instanced>
         <Instanced spots={parts.mouths}>
            <boxGeometry args={[0.36, 0.006, 0.12]} />
            <meshBasicMaterial color={COLORS.cup} />
         </Instanced>
      </group>
   );
}

/** Hole 6: the fixed plate on the slope and the bar spinning at the rules' angle. */
function Turntable({ hole, run }: { hole: Hole; run: RunState }) {
   const bar = useRef<Group>(null);
   const tt = hole.turntable!;
   const y = heightAt(hole, tt.centre.x, tt.centre.z) ?? 0;
   useFrame(() => {
      if (!bar.current) return;
      const live = run.course[run.hole] === hole;
      const t = live ? run.holeTicks * TICK_S + run.clock.acc : 0;
      bar.current.rotation.y = tt.phase + tt.omega * t;
   });
   return (
      <group position={[tt.centre.x, y, tt.centre.z]} name="turntable">
         <group rotation-x={-Math.atan(HILL_GRADE)}>
            <mesh position-y={0.006}>
               <cylinderGeometry args={[TURNTABLE.plateRadius, TURNTABLE.plateRadius, 0.012, 32]} />
               <meshStandardMaterial color={COLORS.plate} roughness={0.7} />
            </mesh>
         </group>
         <group ref={bar} position-y={0.07}>
            <mesh>
               <boxGeometry args={[tt.half * 2, 0.09, 0.07]} />
               <meshStandardMaterial color={COLORS.bar} roughness={0.5} />
            </mesh>
         </group>
      </group>
   );
}

/** One floating island: everything of hole `hole` in its world place. */
export function Island({ hole, run }: { hole: Hole; run: RunState }) {
   const rects = useMemo(() => feltRects(hole), [hole]);
   return (
      <group position-z={holeZ(hole.index)} name={`hole-${hole.index + 1}`}>
         <IslandBase hole={hole} />
         <Felt hole={hole} rects={rects} />
         <Rails hole={hole} rects={rects} />
         <Cup hole={hole} />
         <Ponds hole={hole} />
         {hole.terrain === "ramp" && <Gap hole={hole} />}
         {hole.pipes.length > 0 && <Pipes hole={hole} />}
         {hole.turntable && <Turntable hole={hole} run={run} />}
         {hole.windmill && <Windmill hole={hole} run={run} />}
      </group>
   );
}

// ---------- decor ----------

/** Trees and rocks on the islands' far (-z) end and -x side: never between a camera (at +z or +x) and the lane. */
export function decorSpots(holes: readonly Hole[]): { trees: InstanceSpot[]; rocks: InstanceSpot[] } {
   const trees: InstanceSpot[] = [];
   const rocks: InstanceSpot[] = [];
   for (const hole of holes) {
      const b = hole.box;
      const z0 = holeZ(hole.index);
      const k = hole.index * 1.7;
      trees.push({ x: b.x0 - 0.75, y: -0.3, z: z0 + b.z0 + 0.2, rotY: k, scale: 0.9 });
      trees.push({ x: b.x0 - 0.65, y: -0.3, z: z0 + (b.z0 + b.z1) / 2 + 0.8, rotY: k + 2, scale: 1.05 });
      rocks.push({ x: (b.x0 + b.x1) / 2 + 0.4, y: -0.35, z: z0 + b.z0 - 0.55, rotY: k, scale: 0.7 });
      rocks.push({ x: b.x0 - 0.55, y: -0.35, z: z0 + b.z1 - 0.6, rotY: k + 1, scale: 0.55 });
      rocks.push({ x: b.x1 - 0.2, y: -0.35, z: z0 + b.z0 - 0.45, rotY: k + 3, scale: 0.45 });
   }
   return { trees, rocks };
}

export function Decor({ holes }: { holes: readonly Hole[] }) {
   const { decor } = useQuality();
   const spots = useMemo(() => {
      const all = decorSpots(holes);
      return { trees: all.trees.slice(0, scaledCount(all.trees.length, decor)), rocks: all.rocks.slice(0, scaledCount(all.rocks.length, decor)) };
   }, [holes, decor]);
   return (
      <group name="decor">
         <InstancedModel asset={ASSETS.tree} spots={spots.trees} fallback={<TreePrimitives spots={spots.trees} />} />
         <InstancedModel asset={ASSETS.rock} spots={spots.rocks} fallback={<RockPrimitives spots={spots.rocks} />} />
      </group>
   );
}

/** The calm sea under all six islands. */
export function Sea() {
   return <Water size={[70, 150]} position={[0, -1.3, -40]} color={COLORS.water} deep={COLORS.deep} amplitude={0.08} wavelength={5} opacity={0.92} />;
}
