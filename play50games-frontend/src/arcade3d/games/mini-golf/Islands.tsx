"use client";

// The course's look: the sea, one floating island per hole (only the current and the next are
// mounted), rich putting green felt with subtle mowing stripes, wooden rails with golden top caps,
// regulation cups with metallic rims, sand hazard bunkers, gap trestle beams, two-tone pipes,
// bevelled turntable obstacles, and surrounding resort decor (palms, flower beds, flags, hills, clubhouse).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
   BoxGeometry,
   BufferGeometry,
   CatmullRomCurve3,
   Color,
   CylinderGeometry,
   DoubleSide,
   Float32BufferAttribute,
   LatheGeometry,
   RingGeometry,
   TubeGeometry,
   Vector2,
   Vector3,
   type Group,
} from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Water } from "@/arcade3d/core/env";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS } from "./assets";
import { HILL_GRADE, RAMP, TIER_WALL_Z, TIER_Y, TURNTABLE, heightAt, type Hole } from "./course";
import { COLORS, decorSpots, surroundingsSpots, feltRects, holeZ, onFelt, type FeltRect } from "./looks";
import { CUP } from "./physics";
import {
   ClubhouseSilhouette,
   DistantHills,
   FlagPrimitive,
   FlowerBedPrimitives,
   PalmPrimitives,
   PennantPrimitives,
   RockPrimitives,
   TreePrimitives,
} from "./Primitives";
import { TICK_S, type RunState } from "./rules";
import { Windmill } from "./Windmill";

// ---------- felt ----------

const CELL = 0.25;
const SKIRT = -0.3;

/** One merged felt mesh: rich putting-green turf with subtle mow pattern and bevelled curb skirts. */
export function buildFelt(hole: Hole, rects: readonly FeltRect[]): BufferGeometry {
   const pos: number[] = [];
   const col: number[] = [];
   const idx: number[] = [];
   const hi = new Color(COLORS.feltLight);
   const lo = new Color(COLORS.feltDark);
   const sideTop = new Color(COLORS.curb);
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

            // Alternating mowing stripes with subtle checkerboard texture
            const stripeZ = Math.floor((z + 20) / 0.5) % 2 === 0 ? 0.35 : 0.0;
            const crossX = Math.floor((x + 20) / 0.5) % 2 === 0 ? 0.1 : 0.0;
            const mow = Math.min(1, 0.45 + stripeZ + crossX + y * 0.4);
            c.copy(lo).lerp(hi, mow);
            col.push(c.r, c.g, c.b);
         }
      }

      for (let i = 0; i < nx; i++) {
         for (let j = 0; j < nz; j++) {
            const a = base + i * (nz + 1) + j;
            idx.push(a, a + 1, a + nz + 1, a + 1, a + nz + 2, a + nz + 1);
         }
      }

      // skirts: retaining curb down to below the island's top
      const edges: [number, number, number, number][] = [
         [r.x0, r.z0, r.x1, r.z0],
         [r.x1, r.z0, r.x1, r.z1],
         [r.x1, r.z1, r.x0, r.z1],
         [r.x0, r.z1, r.x0, r.z0],
      ];
      for (const [ax, az, bx, bz] of edges) {
         const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / CELL));
         const s = pos.length / 3;
         for (let k = 0; k <= n; k++) {
            const x = ax + ((bx - ax) * k) / n;
            const z = az + ((bz - az) * k) / n;
            pos.push(x, h(r, x, z) - 0.002, z, x, SKIRT, z);
            col.push(sideTop.r, sideTop.g, sideTop.b, side.r * 0.7, side.g * 0.7, side.b * 0.7);
         }
         for (let k = 0; k < n; k++) {
            idx.push(s + 2 * k, s + 2 * k + 1, s + 2 * k + 2, s + 2 * k + 1, s + 2 * k + 3, s + 2 * k + 2);
         }
      }
   }

   const g = new BufferGeometry();
   g.setAttribute("position", new Float32BufferAttribute(pos, 3));
   g.setAttribute("color", new Float32BufferAttribute(col, 3));
   g.setIndex(idx);
   g.computeVertexNormals();
   return g;
}

/** The rail boards: each drawn rail with its inner face on the rules' line. */
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
         <meshStandardMaterial vertexColors roughness={0.9} side={DoubleSide} />
      </mesh>
   );
}

/** The island's rock base: a multi-tier faceted coastal cliff with retaining curb and sandy terrace. */
function IslandBase({ hole }: { hole: Hole }) {
   const geometry = useMemo(() => {
      // Sculpted profile: top curb (0), sandy ledge (-0.4), rock cliff tiers down to water (-2.5)
      const pts = [
         new Vector2(0, -2.6),
         new Vector2(0.48, -2.3),
         new Vector2(0.82, -1.5),
         new Vector2(0.96, -0.65),
         new Vector2(1.02, -0.34),
         new Vector2(1.01, -0.26),
         new Vector2(0.98, -0.22),
      ];
      const lathe = new LatheGeometry(pts, 16);
      const pos = lathe.getAttribute("position");
      const colors = new Float32Array(pos.count * 3);
      const cCurb = new Color(COLORS.curb);
      const cSand = new Color(COLORS.sand);
      const cRock = new Color(COLORS.rock);
      const cDark = new Color(COLORS.rockDark);
      const c = new Color();

      for (let i = 0; i < pos.count; i++) {
         const y = pos.getY(i);
         if (y > -0.32) c.copy(cCurb);
         else if (y > -0.7) c.copy(cSand);
         else if (y > -1.8) c.copy(cRock);
         else c.copy(cDark);
         colors.set([c.r, c.g, c.b], i * 3);
      }
      lathe.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return lathe;
   }, []);

   useEffect(() => () => geometry.dispose(), [geometry]);
   const b = hole.box;
   const sx = (b.x1 - b.x0) / 2 + 0.6;
   const sz = (b.z1 - b.z0) / 2 + 0.6;
   return (
      <mesh geometry={geometry} position={[(b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2]} scale={[sx, 1, sz]} name="island-base">
         <meshStandardMaterial vertexColors roughness={0.95} flatShading />
      </mesh>
   );
}

/** Bevelled wooden rails with warm golden teak caps and rich mahogany bumper sides. */
function Rails({ hole, rects }: { hole: Hole; rects: readonly FeltRect[] }) {
   const spots = useMemo(() => railSpots(hole, rects), [hole, rects]);
   const geo = useMemo(() => {
      const g = new BoxGeometry(1, 1, 1, 1, 2, 1);
      const pos = g.getAttribute("position");
      const colors = new Float32Array(pos.count * 3);
      const cTop = new Color(COLORS.railTop);
      const cMid = new Color(COLORS.rail);
      const cBot = new Color(COLORS.railTrim);
      const c = new Color();
      for (let i = 0; i < pos.count; i++) {
         const y = pos.getY(i);
         if (y > 0.2) c.copy(cTop);
         else if (y < -0.2) c.copy(cBot);
         else c.copy(cMid);
         colors.set([c.r, c.g, c.b], i * 3);
      }
      g.setAttribute("color", new Float32BufferAttribute(colors, 3));
      return g;
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="rails">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial vertexColors roughness={0.7} />
      </Instanced>
   );
}

/** Regulation golf cup: recessed dark interior cylinder, clean metallic lip rim, red flag. */
function Cup({ hole }: { hole: Hole }) {
   const y = (heightAt(hole, hole.cup.x, hole.cup.z) ?? 0) + 0.004;
   return (
      <group position={[hole.cup.x, y, hole.cup.z]} name="cup">
         {/* Metallic cup lip ring */}
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[CUP.drawnRadius - 0.005, CUP.drawnRadius + 0.03, 32]} />
            <meshStandardMaterial color={COLORS.rim} roughness={0.3} metalness={0.2} />
         </mesh>
         {/* Recessed dark interior cup liner */}
         <mesh position-y={-0.03}>
            <cylinderGeometry args={[CUP.drawnRadius - 0.004, CUP.drawnRadius - 0.004, 0.06, 24, 1, true]} />
            <meshBasicMaterial color={COLORS.cup} side={DoubleSide} />
         </mesh>
         {/* Cup floor */}
         <mesh rotation-x={-Math.PI / 2} position-y={-0.06}>
            <circleGeometry args={[CUP.drawnRadius - 0.004, 24]} />
            <meshBasicMaterial color={COLORS.cup} />
         </mesh>
         <group position-z={-CUP.flagBack} name="flag">
            <Model asset={ASSETS.flag} fallback={<FlagPrimitive />} />
         </group>
      </group>
   );
}

/** Ponds: realistic water framed by warm golden sand bunker rims. */
function Ponds({ hole }: { hole: Hole }) {
   return (
      <group name="ponds">
         {hole.ponds.map((p, i) => {
            const cx = (p.x0 + p.x1) / 2;
            const cz = (p.z0 + p.z1) / 2;
            const w = p.x1 - p.x0;
            const d = p.z1 - p.z0;
            return (
               <group key={i}>
                  {/* Decorative sand bunker framing */}
                  <mesh position={[cx, 0.008, cz]} rotation-x={-Math.PI / 2}>
                     <planeGeometry args={[w + 0.22, d + 0.22]} />
                     <meshStandardMaterial color={COLORS.sand} roughness={1} />
                  </mesh>
                  {/* Clear water */}
                  <Water
                     size={[w, d]}
                     position={[cx, 0.014, cz]}
                     color={COLORS.water}
                     deep={COLORS.deep}
                     foam={COLORS.foam}
                     amplitude={0.004}
                     wavelength={0.6}
                     opacity={0.95}
                     foamEdge={0.12}
                  />
               </group>
            );
         })}
      </group>
   );
}

/** Hole 3: the water gap with rustic wooden trestle support beams and carry marker line. */
function Gap({ hole }: { hole: Hole }) {
   const spots = useMemo<InstanceSpot[]>(
      () => Array.from({ length: 10 }, (_v, i) => ({ x: hole.cup.x * 0 + (i - 4.5) * 0.11, y: 0.006, z: RAMP.gapEnd - 0.12 })),
      [hole]
   );
   const beams = useMemo<InstanceSpot[]>(
      () => [
         { x: -0.62, y: 0.05, z: (RAMP.lip + RAMP.gapEnd) / 2, sx: 0.06, sy: 0.14, sz: Math.abs(RAMP.gapEnd - RAMP.lip) },
         { x: 0.62, y: 0.05, z: (RAMP.lip + RAMP.gapEnd) / 2, sx: 0.06, sy: 0.14, sz: Math.abs(RAMP.gapEnd - RAMP.lip) },
         { x: -0.62, y: -0.08, z: RAMP.lip, sx: 0.08, sy: 0.36, sz: 0.08 },
         { x: 0.62, y: -0.08, z: RAMP.lip, sx: 0.08, sy: 0.36, sz: 0.08 },
      ],
      []
   );

   return (
      <group name="gap">
         <Water
            size={[1.6, 1.4]}
            position={[0, RAMP.waterY, (RAMP.lip + RAMP.gapEnd) / 2]}
            color={COLORS.water}
            deep={COLORS.deep}
            foam={COLORS.foam}
            amplitude={0.01}
            wavelength={0.8}
            opacity={0.95}
         />
         <Instanced spots={beams} name="gap-trestle">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={COLORS.spar} roughness={0.85} />
         </Instanced>
         <Instanced spots={spots} name="carry-line">
            <boxGeometry args={[0.07, 0.004, 0.03]} />
            <meshBasicMaterial color="#f8fafc" />
         </Instanced>
      </group>
   );
}

/** Hole 5: three royal blue pipes bridging from tier mouths to portals with two-tone brass collars. */
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
      const portals: InstanceSpot[] = hole.pipes.map((p) => ({
         x: p.exit.x - p.dir.x * 0.02,
         y: 0.1,
         z: p.exit.z - p.dir.z * 0.02,
         rotY: Math.atan2(p.dir.x, p.dir.z),
      }));
      const mouths: InstanceSpot[] = hole.pipes.map((p) => ({
         x: p.mouth.x,
         y: TIER_Y + 0.003,
         z: TIER_WALL_Z + 0.06,
      }));
      return { geometry, portals, mouths };
   }, [hole]);

   useEffect(() => () => parts.geometry.dispose(), [parts]);

   return (
      <group name="pipes">
         <mesh geometry={parts.geometry}>
            <meshStandardMaterial color={COLORS.pipe} roughness={0.35} metalness={0.2} />
         </mesh>
         <Instanced spots={parts.portals}>
            <torusGeometry args={[0.1, 0.035, 8, 16]} />
            <meshStandardMaterial color={COLORS.pipeFlange} roughness={0.4} metalness={0.5} />
         </Instanced>
         <Instanced spots={parts.mouths}>
            <boxGeometry args={[0.36, 0.008, 0.12]} />
            <meshStandardMaterial color={COLORS.pipeDark} roughness={0.6} />
         </Instanced>
      </group>
   );
}

/** Hole 6: the bevelled brass plate on the slope and spinning obstacle bar with white rubber bumper caps. */
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

   const barGeo = useMemo(() => {
      const parts: BufferGeometry[] = [];
      const half = tt.half;
      // Main vibrant orange obstacle bar
      const body = new BoxGeometry(half * 2 - 0.12, 0.09, 0.07);
      const cBar = new Color(COLORS.bar);
      const countB = body.getAttribute("position").count;
      const colB = new Float32Array(countB * 3);
      for (let i = 0; i < countB; i++) colB.set([cBar.r, cBar.g, cBar.b], i * 3);
      body.setAttribute("color", new Float32BufferAttribute(colB, 3));
      parts.push(body);

      // White protective rubber bumper caps on both ends
      const cCap = new Color(COLORS.barCap);
      for (const side of [-1, 1]) {
         const cap = new BoxGeometry(0.06, 0.094, 0.074).translate(side * (half - 0.03), 0, 0);
         const countC = cap.getAttribute("position").count;
         const colC = new Float32Array(countC * 3);
         for (let i = 0; i < countC; i++) colC.set([cCap.r, cCap.g, cCap.b], i * 3);
         cap.setAttribute("color", new Float32BufferAttribute(colC, 3));
         parts.push(cap);
      }

      // Center pivot cap
      const pivot = new CylinderGeometry(0.08, 0.08, 0.11, 16);
      const cPiv = new Color(COLORS.gold);
      const countP = pivot.getAttribute("position").count;
      const colP = new Float32Array(countP * 3);
      for (let i = 0; i < countP; i++) colP.set([cPiv.r, cPiv.g, cPiv.b], i * 3);
      pivot.setAttribute("color", new Float32BufferAttribute(colP, 3));
      parts.push(pivot);

      const merged = mergeGeometries(parts)!;
      parts.forEach((p) => p.dispose());
      return merged;
   }, [tt.half]);

   useEffect(() => () => barGeo.dispose(), [barGeo]);

   return (
      <group position={[tt.centre.x, y, tt.centre.z]} name="turntable">
         <group rotation-x={-Math.atan(HILL_GRADE)}>
            {/* Outer brass bevel rim */}
            <mesh position-y={0.005}>
               <cylinderGeometry args={[TURNTABLE.plateRadius + 0.02, TURNTABLE.plateRadius + 0.02, 0.01, 32]} />
               <meshStandardMaterial color={COLORS.plateRim} roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Inner brushed gold disc */}
            <mesh position-y={0.008}>
               <cylinderGeometry args={[TURNTABLE.plateRadius, TURNTABLE.plateRadius, 0.012, 32]} />
               <meshStandardMaterial color={COLORS.plate} roughness={0.5} metalness={0.4} />
            </mesh>
         </group>
         <group rotation-x={-Math.atan(HILL_GRADE)}>
            <group ref={bar} position-y={0.07}>
               <mesh geometry={barGeo}>
                  <meshStandardMaterial vertexColors roughness={0.6} />
               </mesh>
            </group>
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

/** The mounted holes' trees, rocks, palms, flower beds and surrounding resort scenery. */
export function Decor({ holes, yaws }: { holes: readonly Hole[]; yaws: readonly number[] }) {
   const { decor } = useQuality();
   const spots = useMemo(() => {
      const all = decorSpots(holes, yaws);
      const surroundings = surroundingsSpots(holes, yaws);
      return {
         trees: all.trees.slice(0, scaledCount(all.trees.length, decor)),
         rocks: all.rocks.slice(0, scaledCount(all.rocks.length, decor)),
         palms: surroundings.palms.slice(0, scaledCount(surroundings.palms.length, decor)),
         flowers: surroundings.flowers.slice(0, scaledCount(surroundings.flowers.length, decor)),
         pennants: surroundings.pennants.slice(0, scaledCount(surroundings.pennants.length, decor)),
         hills: surroundings.hills,
         clubhouse: surroundings.clubhouse,
      };
   }, [holes, yaws, decor]);

   return (
      <group name="decor">
         <InstancedModel asset={ASSETS.tree} spots={spots.trees} fallback={<TreePrimitives spots={spots.trees} />} />
         <InstancedModel asset={ASSETS.rock} spots={spots.rocks} fallback={<RockPrimitives spots={spots.rocks} />} />
         {spots.palms.length > 0 && <PalmPrimitives spots={spots.palms} />}
         {spots.flowers.length > 0 && <FlowerBedPrimitives spots={spots.flowers} />}
         {spots.pennants.length > 0 && <PennantPrimitives spots={spots.pennants} />}
         <DistantHills spots={spots.hills} />
         <ClubhouseSilhouette spots={spots.clubhouse} />
      </group>
   );
}

/** The calm crystal sea under all six islands, expanded to cover all screens with zero gap/void. */
export function Sea() {
   return (
      <Water
         size={[260, 320]}
         position={[0, -1.3, -50]}
         color={COLORS.water}
         deep={COLORS.deep}
         foam={COLORS.foam}
         amplitude={0.08}
         wavelength={5}
         opacity={0.94}
      />
   );
}
