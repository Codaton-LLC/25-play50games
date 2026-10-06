"use client";

// Obstacle Race look: the inflatable course on its pool, the sweeper, the blocks, the beam, the
// checkpoint gates, the stand-in finish arch and the stand-in runner. Decoration for this game only
// (README "What a new game copies from here": copy the patterns in Scene.tsx, not this file).
// Every size comes from rules.ts (COURSE, BAR, BLOCK, BEAM, PLATFORM, ARCH), so what is drawn is what
// the rules collide with. Nothing here moves by itself: Scene.tsx turns the bar, slides the blocks,
// tilts the beam, lights the gates and swings the runner's joints.
//
// Draw calls: static repeats are one InstancedMesh each (pad bodies, tops, rims, pillars, slabs,
// lines, posts, lane-rope floats); the five blocks are one vertex-coloured mesh in one
// <DynamicInstanced> (Scene.tsx). No shadow maps: the runner's BlobShadow is placed by Scene.tsx.
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import {
   BoxGeometry,
   BufferAttribute,
   CapsuleGeometry,
   Color,
   CylinderGeometry,
   DoubleSide,
   MeshBasicMaterial,
   MeshStandardMaterial,
   PlaneGeometry,
   RepeatWrapping,
   RingGeometry,
   SphereGeometry,
   TorusGeometry,
   type BufferGeometry,
   type Group,
   type InstancedMesh,
   type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useCanvasTexture, useInstanceMatrices, type InstanceSpot } from "@/arcade3d/core/render";
import { ARCH, BAR, BEAM, BLOCK, COURSE, DISC, HUB, LINES, PLATFORM, WATER_Y, type Support } from "./rules";

// ---------- look ----------

export const COLORS = {
   sky: "#bae6fd",
   water: "#38bdf8",
   deck: "#e2e8f0",
   coping: "#f8fafc",
   padSide: "#3b82f6",
   padTop: "#e0f2fe",
   checkpointTop: "#c7d2fe",
   finishTop: "#bbf7d0",
   rim: "#fbbf24",
   discSide: "#ef4444",
   discStripeA: "#fff1f2",
   discStripeB: "#fecaca",
   hub: "#facc15",
   hubCap: "#f97316",
   barRed: "#ef4444",
   barWhite: "#ffffff",
   slab: "#16a34a",
   cushion: "#86efac",
   pillar: "#e2e8f0",
   block: "#f59e0b",
   blockTop: "#fcd34d",
   rail: "#94a3b8",
   beam: "#a855f7",
   beamTop: "#c4b5fd",
   line: "#ffffff",
   accent: "#6366f1",
   reached: "#22c55e",
   post: "#f8fafc",
   archLeg: "#ef4444",
   archTop: "#facc15",
   ropeA: "#ef4444",
   ropeB: "#ffffff",
   ropeC: "#2563eb",
   splash: "#e0f2fe",
   hoodie: "#f97316",
   hood: "#ea580c",
   pants: "#1e293b",
   shoes: "#f8fafc",
   skin: "#f5c9a3",
   hair: "#3f2a1d",
   band: "#14b8a6",
   pack: "#1d4ed8",
   eye: "#0f172a",
} as const;

/** How far below the water the course's bodies reach (m): the pool hides the cut. */
const UNDER = WATER_Y - 0.4;
/** Pads and bridges: a lighter skin this thick on top of the body. */
const SKIN = 0.1;
/** The pool around the course (m): the water plane and the deck beside it. */
export const POOL = { halfWidth: 24, near: 40, far: -170 } as const;

// ---------- helpers ----------

/** A box spot from a footprint in p (z = −p) and a y range. */
function boxSpot(minX: number, maxX: number, minP: number, maxP: number, bottom: number, top: number): InstanceSpot {
   return { x: (minX + maxX) / 2, y: (bottom + top) / 2, z: -(minP + maxP) / 2, sx: maxX - minX, sy: top - bottom, sz: maxP - minP };
}

const SUPPORTS = COURSE.supports;
const byKind = (...kinds: Support["kind"][]) => SUPPORTS.filter((s) => kinds.includes(s.kind));
const CHECKPOINT_PADS = new Set(COURSE.checkpoints.slice(1).map((c) => c.support));
const FINISH_PAD = COURSE.finish.support;

/** Static copies of one geometry with a colour per copy (instanceColor; the material is white). */
function ColoredInstances({
   spots,
   colors,
   geometry,
   material,
   name,
}: {
   spots: readonly InstanceSpot[];
   colors: readonly Color[];
   geometry: BufferGeometry;
   material: Material;
   name?: string;
}) {
   const ref = useRef<InstancedMesh>(null);
   useInstanceMatrices(ref, spots);
   useLayoutEffect(() => {
      const mesh = ref.current;
      if (!mesh) return;
      for (let i = 0; i < spots.length; i++) mesh.setColorAt(i, colors[i % colors.length]);
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
   }, [spots, colors]);
   return <instancedMesh ref={ref} args={[geometry, material, spots.length]} name={name} />;
}

/** Geometries and materials made once per mount and disposed with it. */
function useDisposable<T extends Record<string, { dispose(): void }>>(make: () => T): T {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const made = useMemo(make, []);
   useEffect(() => () => Object.values(made).forEach((item) => item.dispose()), [made]);
   return made;
}

// ---------- drawn textures ----------

function drawWater(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#38bdf8";
   ctx.fillRect(0, 0, w, h);
   ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
   ctx.lineWidth = 3;
   ctx.lineCap = "round";
   // soft caustic squiggles, tiling in both directions
   for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
         const x0 = (col / 4) * w + (row % 2) * (w / 8);
         const y0 = ((row + 0.5) / 8) * h;
         ctx.beginPath();
         for (let k = 0; k <= 12; k++) {
            const x = x0 + (k / 12) * (w / 5);
            const y = y0 + Math.sin(k * 0.9 + row) * 5;
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
         ctx.stroke();
      }
   }
   ctx.fillStyle = "rgba(14, 165, 233, 0.25)";
   for (let k = 0; k < 40; k++) {
      const x = ((k * 97) % 256) / 256;
      const y = ((k * 57) % 256) / 256;
      ctx.beginPath();
      ctx.ellipse(x * w, y * h, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
   }
}

function drawDiscTop(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cx = w / 2;
   const cy = h / 2;
   const r = w / 2;
   const wedges = 16;
   for (let k = 0; k < wedges; k++) {
      ctx.fillStyle = k % 2 === 0 ? COLORS.discStripeA : COLORS.discStripeB;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, (k / wedges) * Math.PI * 2, ((k + 1) / wedges) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
   }
   // the safe ring near the hub and a red outer band (where the bar's tip runs fastest)
   ctx.strokeStyle = "#f87171";
   ctx.lineWidth = w * 0.025;
   ctx.beginPath();
   ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
   ctx.stroke();
   ctx.fillStyle = "#fde68a";
   ctx.beginPath();
   ctx.arc(cx, cy, r * 0.16, 0, Math.PI * 2);
   ctx.fill();
}

function drawStripes(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = COLORS.barWhite;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = COLORS.barRed;
   const n = 24;
   const step = w / n;
   for (let k = -2; k < n + 2; k += 2) {
      ctx.beginPath();
      ctx.moveTo(k * step, h);
      ctx.lineTo((k + 1) * step, h);
      ctx.lineTo((k + 2) * step, 0);
      ctx.lineTo((k + 1) * step, 0);
      ctx.closePath();
      ctx.fill();
   }
}

function drawChecker(ctx: CanvasRenderingContext2D, w: number, h: number) {
   const cols = 16;
   const rows = 2;
   for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
         ctx.fillStyle = (i + j) % 2 === 0 ? "#111827" : "#ffffff";
         ctx.fillRect((i / cols) * w, (j / rows) * h, w / cols + 1, h / rows + 1);
      }
   }
}

// ---------- water and pool ----------

/** The pool: one water plane (Scene.tsx scrolls its texture) and the deck beside the course. */
export function Pool({ water }: { water: RefObject<MeshStandardMaterial> }) {
   const ripples = useCanvasTexture(256, 256, drawWater);
   useLayoutEffect(() => {
      ripples.wrapS = RepeatWrapping;
      ripples.wrapT = RepeatWrapping;
      ripples.repeat.set((2 * POOL.halfWidth) / 6, (POOL.near - POOL.far) / 6);
      ripples.needsUpdate = true;
   }, [ripples]);
   const length = POOL.near - POOL.far;
   const zMid = (POOL.near + POOL.far) / 2;
   return (
      <group name="pool">
         <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, zMid]}>
            <planeGeometry args={[2 * POOL.halfWidth, length]} />
            <meshStandardMaterial ref={water} map={ripples} color="#ffffff" roughness={0.35} metalness={0.05} />
         </mesh>
         {[-1, 1].map((side) => (
            <group key={side}>
               <mesh position={[side * (POOL.halfWidth + 6), WATER_Y + 0.4, zMid]}>
                  <boxGeometry args={[12, 1.2, length]} />
                  <meshStandardMaterial color={COLORS.deck} roughness={0.8} />
               </mesh>
               <mesh position={[side * (POOL.halfWidth + 0.25), WATER_Y + 1.05, zMid]}>
                  <boxGeometry args={[0.5, 0.1, length]} />
                  <meshStandardMaterial color={COLORS.coping} roughness={0.6} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

/** Two floating lane ropes beside the course: depth cues on the water. One draw call. */
const ROPE_SPOTS: InstanceSpot[] = (() => {
   const spots: InstanceSpot[] = [];
   for (const x of [-11, 11]) for (let z = 18; z > -150; z -= 0.75) spots.push({ x, y: WATER_Y + 0.06, z, scale: 0.2 });
   return spots;
})();
const ROPE_COLORS = [COLORS.ropeA, COLORS.ropeA, COLORS.ropeB, COLORS.ropeB, COLORS.ropeC, COLORS.ropeC].map((c) => new Color(c));

export function LaneRopes() {
   const res = useDisposable(() => ({ ball: new SphereGeometry(1, 10, 8), mat: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }) }));
   return <ColoredInstances spots={ROPE_SPOTS} colors={ROPE_COLORS} geometry={res.ball} material={res.mat} name="lane-ropes" />;
}

// ---------- the static course ----------

const PADS = byKind("pad", "bridge");
const PAD_BODY_SPOTS = PADS.map((s) => boxSpot(s.minX, s.maxX, s.minP, s.maxP, UNDER, -SKIN));
const PAD_TOP_SPOTS = PADS.filter((s) => !CHECKPOINT_PADS.has(SUPPORTS.indexOf(s)) && SUPPORTS.indexOf(s) !== FINISH_PAD).map((s) =>
   boxSpot(s.minX, s.maxX, s.minP, s.maxP, -SKIN, 0)
);
const CHECKPOINT_TOP_SPOTS = [...CHECKPOINT_PADS].map((i) => {
   const s = SUPPORTS[i];
   return boxSpot(s.minX, s.maxX, s.minP, s.maxP, -SKIN, 0);
});
const FINISH_TOP_SPOTS = [boxSpot(SUPPORTS[FINISH_PAD].minX, SUPPORTS[FINISH_PAD].maxX, SUPPORTS[FINISH_PAD].minP, SUPPORTS[FINISH_PAD].maxP, -SKIN, 0)];

/** Inflatable tubes along the pads' and bridges' edges, just under the top (never under the feet). */
const RIM_R = 0.22;
const RIM_Y = -0.12 - RIM_R;
const RIM_SPOTS: InstanceSpot[] = (() => {
   const spots: InstanceSpot[] = [];
   for (const s of PADS) {
      const len = s.maxP - s.minP;
      const zc = -(s.minP + s.maxP) / 2;
      for (const x of [s.minX, s.maxX]) spots.push({ x, y: RIM_Y, z: zc, sx: RIM_R, sy: RIM_R, sz: len });
      if (s.kind === "pad") {
         const wid = s.maxX - s.minX;
         for (const p of [s.minP, s.maxP]) spots.push({ x: (s.minX + s.maxX) / 2, y: RIM_Y, z: -p, rotY: Math.PI / 2, sx: RIM_R, sy: RIM_R, sz: wid });
      }
   }
   return spots;
})();

const PLATFORMS = byKind("platform");
const CUSHION = 0.08;
const SLAB_SPOTS = PLATFORMS.map((s) => boxSpot(s.minX, s.maxX, s.minP, s.maxP, s.top - PLATFORM.thickness, s.top - CUSHION));
const CUSHION_SPOTS = PLATFORMS.map((s) => boxSpot(s.minX, s.maxX, s.minP, s.maxP, s.top - CUSHION, s.top));
const PILLAR_SPOTS = COURSE.solids.filter((o) => o.shape === "box").map((o) => boxSpot(o.minX, o.maxX, o.minP, o.maxP, UNDER, o.top));

/** Under the beam: four posts inside its footprint, down to the water. */
const BEAM_SUPPORT = SUPPORTS.find((s) => s.kind === "beam") as Support;
const BEAM_POST_SPOTS: InstanceSpot[] = [0.12, 0.37, 0.63, 0.88].map((k) => ({
   x: 0,
   y: (UNDER + -BEAM.thickness) / 2,
   z: -(BEAM_SUPPORT.minP + k * (BEAM_SUPPORT.maxP - BEAM_SUPPORT.minP)),
   sx: 0.2,
   sy: -BEAM.thickness - UNDER,
   sz: 0.2,
}));

/** Rails under each block row (looks only): the track the block slides on. */
const BLOCK_ROWS = byKind("block");
const RAIL_SPOTS: InstanceSpot[] = BLOCK_ROWS.flatMap((s) =>
   [s.minP + 0.45, s.maxP - 0.45].map((p) => ({ x: 0, y: -0.85, z: -p, rotY: Math.PI / 2, sx: 0.07, sy: 0.07, sz: 2 * (BLOCK.travel + BLOCK.width / 2) + 1 }))
);

/** Painted lines: the start line and the three checkpoint lines (white), the finish line (checkered). */
const LINE_DEPTH = 0.35;
const LINE_SPOTS: InstanceSpot[] = COURSE.checkpoints.map((c) => {
   const s = SUPPORTS[c.support];
   return { x: 0, y: 0.004, z: -c.line, sx: s.maxX - s.minX - 0.3, sy: 1, sz: LINE_DEPTH };
});

function useCourseParts() {
   return useDisposable(() => {
      const box = new BoxGeometry(1, 1, 1);
      // a unit tube along z (radius 1, length 1)
      const tube = new CylinderGeometry(1, 1, 1, 14, 1, false).rotateX(Math.PI / 2);
      const flat = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      return {
         box,
         tube,
         flat,
         padSide: new MeshStandardMaterial({ color: COLORS.padSide, roughness: 0.45 }),
         padTop: new MeshStandardMaterial({ color: COLORS.padTop, roughness: 0.55 }),
         checkpointTop: new MeshStandardMaterial({ color: COLORS.checkpointTop, roughness: 0.55 }),
         finishTop: new MeshStandardMaterial({ color: COLORS.finishTop, roughness: 0.55 }),
         rim: new MeshStandardMaterial({ color: COLORS.rim, roughness: 0.4 }),
         slab: new MeshStandardMaterial({ color: COLORS.slab, roughness: 0.45 }),
         cushion: new MeshStandardMaterial({ color: COLORS.cushion, roughness: 0.5 }),
         pillar: new MeshStandardMaterial({ color: COLORS.pillar, roughness: 0.6 }),
         rail: new MeshStandardMaterial({ color: COLORS.rail, roughness: 0.4, metalness: 0.3 }),
         line: new MeshBasicMaterial({ color: COLORS.line, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      };
   });
}

/** A ref that writes `spots` into an InstancedMesh once (core useInstanceMatrices). */
function useSpots(spots: readonly InstanceSpot[]): RefObject<InstancedMesh> {
   const ref = useRef<InstancedMesh>(null);
   useInstanceMatrices(ref, spots);
   return ref;
}

const PILLARS_AND_POSTS = [...PILLAR_SPOTS, ...BEAM_POST_SPOTS];

/** Everything of the course that never moves: pads, bridges, rims, platforms, pillars, posts, rails, lines, the disc, the hub. */
export function CourseStatic() {
   const p = useCourseParts();
   const checker = useCanvasTexture(512, 64, drawChecker);
   const discTop = useCanvasTexture(512, 512, drawDiscTop);
   const padBodies = useSpots(PAD_BODY_SPOTS);
   const padTops = useSpots(PAD_TOP_SPOTS);
   const checkpointTops = useSpots(CHECKPOINT_TOP_SPOTS);
   const finishTop = useSpots(FINISH_TOP_SPOTS);
   const rims = useSpots(RIM_SPOTS);
   const slabs = useSpots(SLAB_SPOTS);
   const cushions = useSpots(CUSHION_SPOTS);
   const pillars = useSpots(PILLARS_AND_POSTS);
   const rails = useSpots(RAIL_SPOTS);
   const lines = useSpots(LINE_SPOTS);
   const finishLine = SUPPORTS[COURSE.finish.support];
   return (
      <group name="course">
         <instancedMesh ref={padBodies} args={[p.box, p.padSide, PAD_BODY_SPOTS.length]} name="pad-bodies" />
         <instancedMesh ref={padTops} args={[p.box, p.padTop, PAD_TOP_SPOTS.length]} name="pad-tops" />
         <instancedMesh ref={checkpointTops} args={[p.box, p.checkpointTop, CHECKPOINT_TOP_SPOTS.length]} name="checkpoint-tops" />
         <instancedMesh ref={finishTop} args={[p.box, p.finishTop, FINISH_TOP_SPOTS.length]} name="finish-top" />
         <instancedMesh ref={rims} args={[p.tube, p.rim, RIM_SPOTS.length]} name="rims" />
         <instancedMesh ref={slabs} args={[p.box, p.slab, SLAB_SPOTS.length]} name="platform-slabs" />
         <instancedMesh ref={cushions} args={[p.box, p.cushion, CUSHION_SPOTS.length]} name="platform-cushions" />
         <instancedMesh ref={pillars} args={[p.box, p.pillar, PILLARS_AND_POSTS.length]} name="pillars" />
         <instancedMesh ref={rails} args={[p.tube, p.rail, RAIL_SPOTS.length]} name="rails" />
         <instancedMesh ref={lines} args={[p.flat, p.line, LINE_SPOTS.length]} name="lines" />
         <mesh position={[0, 0.005, -LINES.finish]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[finishLine.maxX - finishLine.minX - 0.3, 0.9]} />
            <meshBasicMaterial map={checker} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
         </mesh>
         {/* the sweeper disc: a red drum with a striped top, a yellow tube round its rim */}
         <mesh position={[DISC.x, (UNDER + DISC.top) / 2, -DISC.p]}>
            <cylinderGeometry args={[DISC.radius, DISC.radius, DISC.top - UNDER, 64, 1, false]} />
            <meshStandardMaterial attach="material-0" color={COLORS.discSide} roughness={0.45} />
            <meshStandardMaterial attach="material-1" map={discTop} roughness={0.55} />
            <meshStandardMaterial attach="material-2" color={COLORS.discSide} />
         </mesh>
         <mesh position={[DISC.x, RIM_Y, -DISC.p]} rotation-x={Math.PI / 2}>
            <torusGeometry args={[DISC.radius, RIM_R, 10, 72]} />
            <meshStandardMaterial color={COLORS.rim} roughness={0.4} />
         </mesh>
         {/* the hub: solid, taller than a jump's apex */}
         <mesh position={[DISC.x, HUB.height / 2, -DISC.p]}>
            <cylinderGeometry args={[HUB.radius, HUB.radius, HUB.height, 28]} />
            <meshStandardMaterial color={COLORS.hub} roughness={0.4} />
         </mesh>
         <mesh position={[DISC.x, HUB.height, -DISC.p]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[HUB.radius, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.hubCap} roughness={0.4} />
         </mesh>
      </group>
   );
}

// ---------- the sweeper bar ----------

/** The bar through the hub (Scene.tsx sets the group's rotation.y to rules barAngle). */
export function SweeperBar({ bar }: { bar: RefObject<Group> }) {
   const stripes = useCanvasTexture(512, 32, drawStripes);
   const height = BAR.top - BAR.bottom;
   return (
      <group ref={bar} position={[DISC.x, DISC.top, -DISC.p]} name="sweeper-bar">
         <mesh position-y={(BAR.bottom + BAR.top) / 2}>
            <boxGeometry args={[2 * BAR.reach, height, BAR.thickness]} />
            <meshStandardMaterial map={stripes} roughness={0.5} />
         </mesh>
         {/* a collar on the hub that turns with the bar, and soft pads on the tips */}
         <mesh position-y={(BAR.bottom + BAR.top) / 2}>
            <cylinderGeometry args={[HUB.radius + 0.06, HUB.radius + 0.06, height + 0.1, 24]} />
            <meshStandardMaterial color={COLORS.barRed} roughness={0.45} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (BAR.reach - 0.12), (BAR.bottom + BAR.top) / 2, 0]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.3, 0.3, 0.26, 16]} />
               <meshStandardMaterial color={COLORS.barRed} roughness={0.5} />
            </mesh>
         ))}
      </group>
   );
}

// ---------- the moving blocks ----------

/** A box from y0 to y1 (x/z centred) with one vertex colour, to merge into a two-tone slab. */
function tintedBox(width: number, depth: number, y0: number, y1: number, color: string): BufferGeometry {
   const box = new BoxGeometry(width, y1 - y0, depth).translate(0, (y0 + y1) / 2, 0);
   const c = new Color(color);
   const n = box.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
   box.setAttribute("color", new BufferAttribute(colors, 3));
   return box;
}

/**
 * One block: an amber body and a lighter top merged into one vertex-coloured geometry, so the five
 * blocks are one InstancedMesh (Scene.tsx places them with <DynamicInstanced>). The block's origin is
 * the middle of its top, like the rules' footprint at its x.
 */
export function useBlockMesh(): { geometry: BufferGeometry; material: MeshStandardMaterial } {
   return useDisposable(() => {
      const body = tintedBox(BLOCK.width, BLOCK.depth, -BLOCK.height, -CUSHION, COLORS.block);
      const top = tintedBox(BLOCK.width, BLOCK.depth, -CUSHION, 0, COLORS.blockTop);
      const geometry = mergeGeometries([body, top]);
      body.dispose();
      top.dispose();
      return { geometry, material: new MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.5 }) };
   });
}

// ---------- the balance beam ----------

/** The beam: its group's origin is the top centre line, so Scene.tsx tilts it round the walking line. */
export function BalanceBeam({ beam }: { beam: RefObject<Group> }) {
   const s = BEAM_SUPPORT;
   const length = s.maxP - s.minP;
   return (
      <group ref={beam} position={[0, 0, -(s.minP + s.maxP) / 2]} name="beam">
         <mesh position-y={-(BEAM.thickness + 0.06) / 2}>
            <boxGeometry args={[BEAM.width, BEAM.thickness - 0.06, length]} />
            <meshStandardMaterial color={COLORS.beam} roughness={0.45} />
         </mesh>
         <mesh position-y={-0.03}>
            <boxGeometry args={[BEAM.width, 0.06, length]} />
            <meshStandardMaterial color={COLORS.beamTop} roughness={0.5} />
         </mesh>
      </group>
   );
}

// ---------- checkpoint gates ----------

export const GATE = { postX: 3.3, height: 2.9, postRadius: 0.12 } as const;

const GATE_LINES = COURSE.checkpoints.slice(1).map((c) => c.line);
const GATE_POST_SPOTS: InstanceSpot[] = GATE_LINES.flatMap((line) =>
   [-GATE.postX, GATE.postX].map((x) => ({ x, y: (WATER_Y + GATE.height) / 2, z: -line, sx: 2 * GATE.postRadius, sy: GATE.height - WATER_Y, sz: 2 * GATE.postRadius }))
);

/** What Scene.tsx animates on a gate: its banner material (colour) and its flag (pop). */
export interface GateRig {
   banner: MeshStandardMaterial;
   flag: Group | null;
}

/** The three gates: posts (one draw call), and per gate a banner and a flag Scene.tsx colours and pops. */
export function Gates({ rigs }: { rigs: GateRig[] }) {
   const res = useDisposable(() => ({
      post: new CylinderGeometry(0.5, 0.5, 1, 12),
      postMat: new MeshStandardMaterial({ color: COLORS.post, roughness: 0.5 }),
      beam: new BoxGeometry(2 * GATE.postX + 0.3, 0.36, 0.16),
      flag: new PlaneGeometry(0.7, 0.45).translate(0.35, 0, 0),
      pole: new CylinderGeometry(0.03, 0.03, 0.9, 6),
      poleMat: new MeshStandardMaterial({ color: "#475569" }),
   }));
   const posts = useSpots(GATE_POST_SPOTS);
   return (
      <group name="gates">
         <instancedMesh ref={posts} args={[res.post, res.postMat, GATE_POST_SPOTS.length]} />
         {GATE_LINES.map((line, k) => (
            <group key={line} position={[0, GATE.height, -line]}>
               <mesh geometry={res.beam} material={rigs[k].banner} />
               <group
                  ref={(g) => {
                     rigs[k].flag = g;
                  }}
                  position-y={0.18}
               >
                  <mesh geometry={res.pole} material={res.poleMat} position-y={0.45} />
                  <mesh geometry={res.flag} material={rigs[k].banner} position-y={0.66} />
               </group>
            </group>
         ))}
      </group>
   );
}

export function createGateRigs(): GateRig[] {
   return GATE_LINES.map(() => ({
      banner: new MeshStandardMaterial({ color: COLORS.accent, roughness: 0.4, side: DoubleSide, emissive: new Color(COLORS.accent), emissiveIntensity: 0.15 }),
      flag: null,
   }));
}

// ---------- the finish arch (stand-in until finishArch.glb exists) ----------

/** Two red inflatable legs (the rules' solid posts), a yellow top tube and a checkered banner. Faces +z. */
export function FinishArchPrimitive() {
   const checker = useCanvasTexture(512, 64, drawChecker);
   const legHeight = ARCH.height - 0.6;
   const topY = ARCH.height - 0.42;
   return (
      <group name="finish-arch-primitive">
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * ARCH.postX, legHeight / 2, 0]}>
               <cylinderGeometry args={[ARCH.postRadius, ARCH.postRadius + 0.05, legHeight, 20]} />
               <meshStandardMaterial color={COLORS.archLeg} roughness={0.35} />
            </mesh>
         ))}
         <mesh position-y={topY} rotation-z={Math.PI / 2}>
            <capsuleGeometry args={[0.42, ARCH.width - 0.84, 8, 20]} />
            <meshStandardMaterial color={COLORS.archTop} roughness={0.35} />
         </mesh>
         <mesh position={[0, topY - 0.85, 0]}>
            <planeGeometry args={[2 * (ARCH.postX - ARCH.postRadius), 0.8]} />
            <meshStandardMaterial map={checker} side={DoubleSide} roughness={0.6} />
         </mesh>
      </group>
   );
}

// ---------- splash and spawn effects ----------

/** Shared pieces for the splash (droplets, ring) and the spawn flash ring. */
export function useFxParts() {
   return useDisposable(() => ({
      ring: new RingGeometry(0.55, 0.75, 40).rotateX(-Math.PI / 2),
      splashMat: new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }),
      spawnMat: new MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0, depthWrite: false }),
      marker: new RingGeometry(0.42, 0.56, 32).rotateX(-Math.PI / 2),
      markerMat: new MeshBasicMaterial({ color: COLORS.accent, transparent: true, opacity: 0.8, depthWrite: false }),
   }));
}

// ---------- the stand-in runner ----------

/** The joints Scene.tsx swings (null with a GLB: only the whole-body effects apply then). */
export interface RunnerRig {
   hipL: Group | null;
   hipR: Group | null;
   kneeL: Group | null;
   kneeR: Group | null;
   shoulderL: Group | null;
   shoulderR: Group | null;
   elbowL: Group | null;
   elbowR: Group | null;
   head: Group | null;
   tails: Group | null;
}

export function createRunnerRig(): RunnerRig {
   return { hipL: null, hipR: null, kneeL: null, kneeR: null, shoulderL: null, shoulderR: null, elbowL: null, elbowR: null, head: null, tails: null };
}

function useRunnerParts() {
   return useDisposable(() => {
      const mat = (color: string, roughness = 0.6) => new MeshStandardMaterial({ color, roughness });
      return {
         thigh: new CapsuleGeometry(0.085, 0.2, 4, 10),
         shin: new CapsuleGeometry(0.07, 0.19, 4, 10),
         shoe: new BoxGeometry(0.15, 0.1, 0.27),
         torso: new CapsuleGeometry(0.2, 0.26, 6, 14),
         hood: new SphereGeometry(0.15, 14, 10),
         pack: new BoxGeometry(0.3, 0.34, 0.14),
         upperArm: new CapsuleGeometry(0.065, 0.13, 4, 10),
         forearm: new CapsuleGeometry(0.058, 0.1, 4, 10),
         hand: new SphereGeometry(0.065, 10, 8),
         head: new SphereGeometry(0.2, 20, 14),
         hair: new SphereGeometry(0.212, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
         band: new TorusGeometry(0.205, 0.026, 8, 24),
         tail: new BoxGeometry(0.05, 0.015, 0.2),
         eye: new SphereGeometry(0.028, 8, 6),
         hoodie: mat(COLORS.hoodie, 0.7),
         hoodDark: mat(COLORS.hood, 0.75),
         pants: mat(COLORS.pants, 0.8),
         shoes: mat(COLORS.shoes, 0.45),
         skin: mat(COLORS.skin, 0.5),
         hairMat: mat(COLORS.hair, 0.65),
         bandMat: mat(COLORS.band, 0.5),
         packMat: mat(COLORS.pack, 0.55),
         eyeMat: mat(COLORS.eye, 0.3),
      };
   });
}

/**
 * The Play50 Runner until runner.glb exists (as office-escape's stand-in): an orange-hoodie vinyl
 * toy about 1.55 m tall, its feet at the origin, facing -z. Scene.tsx scales it to 1.5 m and swings
 * the joints.
 */
export function RunnerPrimitive({ rig }: { rig: RunnerRig }) {
   const p = useRunnerParts();
   const leg = (side: -1 | 1) => (
      <group
         ref={(g) => {
            if (side < 0) rig.hipL = g;
            else rig.hipR = g;
         }}
         position={[side * 0.1, 0.74, 0]}
      >
         <mesh geometry={p.thigh} material={p.pants} position-y={-0.17} />
         <group
            ref={(g) => {
               if (side < 0) rig.kneeL = g;
               else rig.kneeR = g;
            }}
            position-y={-0.34}
         >
            <mesh geometry={p.shin} material={p.pants} position-y={-0.15} />
            <mesh geometry={p.shoe} material={p.shoes} position={[0, -0.33, -0.05]} />
         </group>
      </group>
   );
   const arm = (side: -1 | 1) => (
      <group
         ref={(g) => {
            if (side < 0) rig.shoulderL = g;
            else rig.shoulderR = g;
         }}
         position={[side * 0.26, 1.2, 0]}
      >
         <mesh geometry={p.upperArm} material={p.hoodie} position-y={-0.12} />
         <group
            ref={(g) => {
               if (side < 0) rig.elbowL = g;
               else rig.elbowR = g;
            }}
            position-y={-0.24}
         >
            <mesh geometry={p.forearm} material={p.hoodie} position-y={-0.1} />
            <mesh geometry={p.hand} material={p.skin} position-y={-0.21} />
         </group>
      </group>
   );
   return (
      <group name="runner-primitive">
         {leg(-1)}
         {leg(1)}
         <mesh geometry={p.torso} material={p.hoodie} position-y={0.99} />
         <mesh geometry={p.hood} material={p.hoodDark} position={[0, 1.24, 0.14]} scale={[1.1, 0.7, 0.75]} />
         <mesh geometry={p.pack} material={p.packMat} position={[0, 1.02, 0.2]} />
         {arm(-1)}
         {arm(1)}
         <group
            ref={(g) => {
               rig.head = g;
            }}
            position-y={1.35}
         >
            <mesh geometry={p.head} material={p.skin} />
            <mesh geometry={p.hair} material={p.hairMat} position={[0, 0.01, 0.015]} rotation-x={0.45} />
            <mesh geometry={p.band} material={p.bandMat} position-y={0.06} rotation-x={Math.PI / 2 + 0.12} />
            {[-1, 1].map((side) => (
               <mesh key={side} geometry={p.eye} material={p.eyeMat} position={[side * 0.075, 0.0, -0.188]} />
            ))}
            <group
               ref={(g) => {
                  rig.tails = g;
               }}
               position={[0, 0.07, 0.2]}
            >
               {[-1, 1].map((side) => (
                  <mesh key={side} geometry={p.tail} material={p.bandMat} position={[side * 0.04, 0, 0.09]} rotation-y={side * 0.25} />
               ))}
            </group>
         </group>
      </group>
   );
}
