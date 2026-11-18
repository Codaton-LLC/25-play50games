"use client";

// The alien track (everything with a rule behind it), drawn from windows round the runner (pools sized
// once): the violet track with its glowing lane lines; the covers (crystals, rocks, drifting pods, the
// craters level 3's meteors leave) and the painted SHADOW STRIP behind each one (washed out while a glow
// plant near it shines; a low cover's strip carries a SLIDE sign); the scan line itself (a violet sheet
// sweeping forward, or on level 4 a lateral one crossing the lanes); rocks to jump and the energy bars
// to slide under; the meteors falling on their rings; the glow plants; the goo; Nyla's mesa; Vexa's
// caves behind their ghost-crystal walls; the orbs, the secrets; level 5's decoy pods, abduction beams,
// saucer stepping stones and the launch pad. On level 5 the launch road is drawn twice while it repeats
// (this lap and the next), so the track ahead never runs out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, DoubleSide, Euler, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Color, type Group, type Matrix4, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, COVER_W, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS } from "./look";
import { LANE_W, LATERAL_MS, MESA_Y, STRIP, laneX, type CoverKind, type ObstacleKind } from "./course";
import { LURE_LOCK, METEOR_MS, bossDone, coverUp, coverWashed, coverX, inPhase, itemVisualS, scanLineS, visualS, type AlienRun } from "./rules";

const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

const BEHIND = 12;
/** the lateral line runs this long along the track (m) */
const LATERAL_LEN = 26;
const AHEAD = 120;

/** A soft round glow (white centre fading to clear). */
const drawGlow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.35, "rgba(255,255,255,0.55)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

/** The shadow strip's paint: a dark pool, its edges glowing cyan, soft at the far end. */
const drawStrip = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.clearRect(0, 0, w, h);
   const g = ctx.createLinearGradient(0, 0, 0, h);
   g.addColorStop(0, "rgba(255,255,255,0.95)");
   g.addColorStop(0.8, "rgba(255,255,255,0.85)");
   g.addColorStop(1, "rgba(255,255,255,0.15)");
   ctx.fillStyle = g;
   ctx.fillRect(6, 0, w - 12, h);
};

/** The scan sheet's paint: a bright core line with a fading glow on both sides and scan bands. */
const drawScan = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   ctx.clearRect(0, 0, w, h);
   const g = ctx.createLinearGradient(0, 0, w, 0);
   g.addColorStop(0, "rgba(168,85,247,0)");
   g.addColorStop(0.42, "rgba(192,132,252,0.45)");
   g.addColorStop(0.5, "rgba(250,232,255,1)");
   g.addColorStop(0.58, "rgba(192,132,252,0.45)");
   g.addColorStop(1, "rgba(168,85,247,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "rgba(255,255,255,0.12)";
   for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 2);
};

/** The launch road's lap (level 5): items in it are drawn again one lap on while it repeats. */
function lapOf(run: AlienRun): number {
   const l = run.course.loop;
   return l ? l.s1 - l.s0 : 0;
}

type Win<T> = { it: T; s: number; now: boolean };
type Cache<T> = { list: Win<T>[]; at: number };

function useCache<T>(): Cache<T> {
   return useMemo(() => ({ list: [] as Win<T>[], at: -1 }), []);
}

/**
 * For each copy index, which item and at which s: the window [s - BEHIND, s + AHEAD], with the launch
 * road drawn twice while it repeats (and nothing past it then).
 */
function windowed<T extends { s: number; phase?: number }>(run: AlienRun, items: readonly T[], i: number, cache: Cache<T>): Win<T> | null {
   if (i === 0 || cache.at !== run.ms) {
      cache.at = run.ms;
      cache.list.length = 0;
      const vs = visualS(run);
      const loop = run.course.loop;
      const looping = !!loop && !bossDone(run);
      const L = lapOf(run);
      for (const it of items) {
         if (it.phase !== undefined && it.phase >= 0 && !inPhase(run, it.phase)) continue;
         const at = itemVisualS(run, it.s);
         if (looping && loop && it.s > loop.s1 + 1) continue;
         if (at >= vs - BEHIND && at <= vs + AHEAD) cache.list.push({ it, s: at, now: true });
         if (looping && loop && it.s >= loop.s0 && it.s <= loop.s1 && at + L <= vs + AHEAD && at + L >= vs - BEHIND) cache.list.push({ it, s: at + L, now: false });
      }
   }
   return cache.list[i] ?? null;
}

/** The track: a violet strip with glowing lane lines and edges, the caves' floor, Nyla's mesa, the goo. */
function TrackBed({ run }: { run: AlienRun }) {
   const c = run.course;
   const len = c.finishS + 80 + (c.loop ? 8 * (c.loop.s1 - c.loop.s0) : 0);
   const lines = [-0.5, 0.5].map((k) => k * LANE_W);
   const ghosts = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      c.caves.forEach((_cv, i) => {
         const m = ghosts.current[i];
         if (!m) return;
         const phased = run.ms < run.phaseUntil;
         (m.material as MeshBasicMaterial).opacity = run.caveOpen[i] ? 0.12 : phased ? 0.25 : 0.55;
      });
   });
   const kslab = { x: (LANE_W - 0.1) / GLB_SIZE.slab.x, y: 0.6 / GLB_SIZE.slab.y };
   return (
      <group>
         <mesh position={[0, -0.25, -len / 2 + 20]} receiveShadow>
            <boxGeometry args={[LANE_W * 3 + 1.2, 0.5, len]} />
            <meshStandardMaterial color={COLORS.road} roughness={0.75} metalness={0.1} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (LANE_W * 1.5 + 0.6), 0.08, -len / 2 + 20]}>
               <boxGeometry args={[0.3, 0.3, len]} />
               <meshBasicMaterial color={COLORS.roadEdge} toneMapped={false} />
            </mesh>
         ))}
         {lines.map((x) => (
            <mesh key={x} position={[x, 0.01, -len / 2 + 20]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[0.1, len]} />
               <meshBasicMaterial color={COLORS.laneLine} transparent opacity={0.55} toneMapped={false} />
            </mesh>
         ))}
         {c.caves.map((cv, i) => (
            <group key={i}>
               <mesh position={[laneX(3), -0.25, -(cv.s0 + cv.s1) / 2 + 4]}>
                  <boxGeometry args={[LANE_W, 0.5, cv.s1 - cv.s0 + 8]} />
                  <meshStandardMaterial color={COLORS.cave} roughness={0.7} emissive="#6d28d9" emissiveIntensity={0.25} />
               </mesh>
               {/* the ghost-crystal wall */}
               <mesh ref={(m) => { ghosts.current[i] = m; }} position={[laneX(3), 1.4, -cv.s0]}>
                  <boxGeometry args={[LANE_W - 0.2, 2.8, 0.4]} />
                  <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
               </mesh>
               {/* the cave's crystal wall on its outer side (open above, so the camera keeps the hero) */}
               {Array.from({ length: Math.max(2, Math.floor((cv.s1 - cv.s0) / 6)) }, (_v, k) => (
                  <group key={k} position={[laneX(3) + LANE_W * 0.75, 0, -(cv.s0 + 3 + k * 6)]} rotation={[0, k * 1.9, -0.25]} scale={[1.3 / GLB_SIZE.crystal.x, 2.6 / GLB_SIZE.crystal.y, 1.3 / GLB_SIZE.crystal.z]}>
                     <Model asset={ASSETS.crystal} />
                  </group>
               ))}
            </group>
         ))}
         {c.mesas.map((m, i) => (
            <group key={i}>
               <group position={[0, MESA_Y - 0.6, -(m.s0 + m.s1) / 2]} rotation-y={Math.PI / 2} scale={[(m.s1 - m.s0) / GLB_SIZE.slab.x, kslab.y, (LANE_W - 0.2) / GLB_SIZE.slab.z]}>
                  <Model asset={ASSETS.slab} />
               </group>
               {[m.s0 + 1, m.s1 - 1].map((s, j) => (
                  <mesh key={j} position={[0, (MESA_Y - 0.6) / 2, -s]}>
                     <cylinderGeometry args={[0.18, 0.28, MESA_Y - 0.6, 8]} />
                     <meshStandardMaterial color={COLORS.mesa} emissive="#7c3aed" emissiveIntensity={0.3} />
                  </mesh>
               ))}
            </group>
         ))}
         {c.goo.map((g, i) => (
            <group key={i} position={[laneX(g.lane), 0.0, -(g.s0 + g.s1) / 2]} scale={[(LANE_W - 0.3) / GLB_SIZE.goo.x, 0.35, (g.s1 - g.s0) / GLB_SIZE.goo.z]}>
               <Model asset={ASSETS.goo} />
            </group>
         ))}
      </group>
   );
}

interface CoverLook {
   asset: keyof typeof ASSETS;
   h: number;
   lowH: number;
   w: number;
}

const COVER_LOOKS: Record<CoverKind, CoverLook> = {
   crystal: { asset: "crystal", h: 3.0, lowH: 1.3, w: COVER_W },
   rock: { asset: "meteor", h: 2.2, lowH: 1.2, w: COVER_W + 0.2 },
   pod: { asset: "pod", h: 2.4, lowH: 1.2, w: COVER_W },
   crater: { asset: "meteor", h: 1.6, lowH: 1.2, w: COVER_W },
};

/** One pool per cover kind (a crater only once its meteor has landed; a pod drifts across). */
function CoverPool({ run, kind }: { run: AlienRun; kind: CoverKind }) {
   const time = useGameTime();
   const items = useMemo(() => run.course.covers.map((c, i) => ({ ...c, index: i })).filter((c) => c.kind === kind), [run.course, kind]);
   const cache = useCache<(typeof items)[number]>();
   const L = COVER_LOOKS[kind];
   const g = GLB_SIZE[L.asset as keyof typeof GLB_SIZE];
   const update = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      const c = w.it;
      if (w.now && !coverUp(run, c.index)) return false;
      if (!w.now && kind === "crater") return false;
      const h = c.low ? L.lowH : L.h;
      const x = w.now ? coverX(run, c.index) : laneX(c.from);
      const bob = kind === "pod" ? 0.5 + Math.sin(time.now * 2 + c.index) * 0.15 : kind === "crater" ? -0.5 : 0;
      E.set(kind === "crater" ? 0.4 : 0, c.index * 1.7, 0);
      Q.setFromEuler(E);
      m.compose(V.set(x, bob, -w.s), Q, S.set(L.w / g.x, h / g.y, L.w / g.z));
   };
   if (items.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS[L.asset]} count={Math.min(items.length * 2, 16)} update={update} name={`covers-${kind}`} />;
}

/** The crater rims (level 3): dark scorched rings round the fresh craters. */
function CraterRims({ run }: { run: AlienRun }) {
   const items = useMemo(() => run.course.covers.map((c, i) => ({ ...c, index: i })).filter((c) => c.kind === "crater"), [run.course]);
   const cache = useCache<(typeof items)[number]>();
   const update = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cache);
      if (!w || !w.now || !coverUp(run, w.it.index)) return false;
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane), 0.03, -w.s), Q, S.set(1, 1, 1));
   };
   if (items.length === 0) return null;
   return (
      <DynamicInstanced count={8} update={update} name="crater-rims">
         <ringGeometry args={[0.9, 1.5, 28]} />
         <meshBasicMaterial color="#1c1917" transparent opacity={0.75} depthWrite={false} />
      </DynamicInstanced>
   );
}

/** The painted shadow strips: dark pools behind the covers (gone while washed out, or before a crater forms). */
function Strips({ run }: { run: AlienRun }) {
   const tex = useCanvasTexture(64, 128, drawStrip);
   const items = useMemo(() => run.course.covers.map((c, i) => ({ ...c, index: i })), [run.course]);
   const cache = useCache<(typeof items)[number]>();
   const len = STRIP.to - STRIP.from;
   const update = (i: number, m: Matrix4, color: Color) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      const c = w.it;
      if (w.now && (!coverUp(run, c.index) || coverWashed(run, c.index))) return false;
      if (!w.now && c.kind === "crater") return false;
      const x = w.now ? coverX(run, c.index) : laneX(c.from);
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(x, 0.025, -(w.s + STRIP.from + len / 2)), Q, S.set(LANE_W - 0.25, len, 1));
      color.set(c.low ? "#082f49" : COLORS.shadow);
   };
   return (
      <DynamicInstanced count={16} update={update} name="shadow-strips" tinted>
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial color="#ffffff" map={tex} transparent opacity={0.8} depthWrite={false} />
      </DynamicInstanced>
   );
}

function makeSign(text: string, bg: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 64;
   const ctx = c.getContext("2d");
   if (ctx) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(4, 4, 120, 56, 14);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      // a down chevron and the word
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(16, 22);
      ctx.lineTo(30, 40);
      ctx.lineTo(44, 22);
      ctx.lineTo(38, 22);
      ctx.lineTo(30, 32);
      ctx.lineTo(22, 22);
      ctx.closePath();
      ctx.fill();
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 52, 34);
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** The SLIDE signs over the low covers ahead (3 s ahead). */
function Signs({ run }: { run: AlienRun }) {
   const tex = useMemo(() => makeSign("SLIDE", "#0891b2"), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const items = useMemo(() => run.course.covers.filter((c) => c.low), [run.course]);
   const cache = useCache<(typeof items)[number]>();
   const ahead = 3 * run.course.config.speed;
   const update = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      const d = w.s - visualS(run);
      if (d < -1 || d > ahead) return false;
      Q.identity();
      m.compose(V.set(laneX(w.it.lane), 2.6, -w.s), Q, S.set(1.6, 0.8, 1));
   };
   if (items.length === 0) return null;
   return (
      <DynamicInstanced count={4} update={update} name="signs-slide">
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial map={tex} transparent toneMapped={false} side={DoubleSide} />
      </DynamicInstanced>
   );
}

/** The scan line: a violet sheet across the track sweeping forward (or across the lanes on level 4). */
function ScanLine({ run }: { run: AlienRun }) {
   const tex = useCanvasTexture(128, 64, drawScan);
   const sheet = useRef<Mesh>(null);
   const floor = useRef<Mesh>(null);
   const time = useGameTime();
   useFrame(() => {
      const m = sheet.current;
      const f = floor.current;
      if (!m || !f) return;
      const i = run.active;
      const on = i >= 0;
      m.visible = on;
      f.visible = on;
      if (!on) return;
      const sc = run.course.scans[i];
      const lineS = itemVisualS(run, scanLineS(run));
      if (sc.kind === "sweep") {
         // a wall of light across the track, and its bright line on the ground
         m.rotation.set(0, 0, 0);
         m.position.set(0, 2.5, -lineS);
         m.scale.set(LANE_W * 3 + 3, 5, 1);
         f.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
         f.position.set(0, 0.04, -lineS);
         f.scale.set(1.6, LANE_W * 3 + 1, 1);
      } else {
         // the lateral line crosses from the drone's side (x +) to the far side over 1.5 s, along the track
         const k = Math.min(1, Math.max(0, (run.ms - run.scanAt[i]) / LATERAL_MS));
         const x = 6 - 12 * k;
         const z = -itemVisualS(run, sc.meet);
         m.rotation.set(0, Math.PI / 2, 0);
         m.position.set(x, 2.5, z);
         m.scale.set(LATERAL_LEN, 5, 1);
         f.rotation.set(-Math.PI / 2, 0, 0);
         f.position.set(x, 0.04, z);
         f.scale.set(1.6, LATERAL_LEN, 1);
      }
      (m.material as MeshBasicMaterial).opacity = 0.65 + Math.sin(time.now * 30) * 0.1;
   });
   return (
      <>
         <mesh ref={sheet} visible={false} renderOrder={3}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} transparent opacity={0.7} side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={floor} visible={false} renderOrder={3}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

interface ObstacleLook {
   asset: keyof typeof ASSETS;
   w: number;
   h: number;
}

const OBSTACLE_LOOKS: Record<Exclude<ObstacleKind, "arch">, ObstacleLook> = {
   rock: { asset: "meteor", w: 1.6, h: 0.75 },
   blob: { asset: "blob", w: 1.5, h: 0.8 },
};

/** Rocks to jump and level 5's blobs. */
function ObstaclePool({ run, kind }: { run: AlienRun; kind: "rock" | "blob" }) {
   const time = useGameTime();
   const items = useMemo(() => run.course.obstacles.map((o, i) => ({ ...o, index: i })).filter((o) => o.kind === kind), [run.course, kind]);
   const cache = useCache<(typeof items)[number]>();
   const L = OBSTACLE_LOOKS[kind];
   const g = GLB_SIZE[L.asset as keyof typeof GLB_SIZE];
   const update = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      const o = w.it;
      const squish = kind === "blob" ? 1 + Math.sin(time.now * 6 + o.index) * 0.08 : 1;
      E.set(0, kind === "blob" ? Math.PI : o.index * 2.1, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(o.lane), 0, -w.s), Q, S.set((L.w / g.x) * squish, (L.h / g.y) / squish, (L.w / g.z) * squish));
   };
   if (items.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS[L.asset]} count={Math.min(items.length * 2, 10)} update={update} name={`obstacles-${kind}`} />;
}

/** The energy bars to slide under: a glowing bar across the lane between two crystal posts. */
function Arches({ run }: { run: AlienRun }) {
   const time = useGameTime();
   const items = useMemo(() => run.course.obstacles.filter((o) => o.kind === "arch"), [run.course]);
   const cacheA = useCache<(typeof items)[number]>();
   const cacheB = useCache<(typeof items)[number]>();
   const g = GLB_SIZE.crystal;
   const bar = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cacheA);
      if (!w) return false;
      Q.identity();
      const pulse = 1 + Math.sin(time.now * 12) * 0.08;
      m.compose(V.set(laneX(w.it.lane), 1.15, -w.s), Q, S.set(LANE_W - 0.2, 0.22 * pulse, 0.22 * pulse));
   };
   const post = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i >> 1, cacheB);
      if (!w) return false;
      const side = i % 2 === 0 ? -1 : 1;
      E.set(0, i * 0.7, side * 0.1);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane) + side * (LANE_W / 2 - 0.1), 0, -w.s), Q, S.set(0.6 / g.x, 1.7 / g.y, 0.6 / g.z));
   };
   if (items.length === 0) return null;
   return (
      <>
         <DynamicInstanced count={8} update={bar} name="arch-bars">
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#f0abfc" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.crystal} count={16} update={post} name="arch-posts" />
      </>
   );
}

/** Level 3's meteors: a ring on the ground grows as each one falls, then the dust. */
function Meteors({ run }: { run: AlienRun }) {
   const c = run.course;
   const rocks = useRef<(Group | null)[]>([]);
   const rings = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      c.meteors.forEach((mt, i) => {
         const g = rocks.current[i];
         const rg = rings.current[i];
         const at = run.meteorAt[i];
         const fall = at >= 0 && run.ms < at ? 1 - (at - run.ms) / METEOR_MS : -1;
         if (g) {
            g.visible = fall >= 0;
            g.position.set(laneX(mt.lane) + (1 - fall) * 6, 30 * (1 - fall), -mt.s - (1 - fall) * 10);
            g.rotation.set(run.ms * 0.01, run.ms * 0.007, 0);
         }
         if (rg) {
            rg.visible = fall >= 0;
            rg.position.set(laneX(mt.lane), 0.05, -mt.s);
            const k = 0.4 + 0.8 * Math.max(0, fall);
            rg.scale.set(k, k, k);
         }
      });
   });
   if (c.meteors.length === 0) return null;
   const k = 1.4 / GLB_SIZE.meteor.y;
   return (
      <>
         {c.meteors.map((_m, i) => (
            <group key={i}>
               <group ref={(g) => { rocks.current[i] = g; }} visible={false} scale={k}>
                  <Model asset={ASSETS.meteor} />
               </group>
               <mesh ref={(m) => { rings.current[i] = m; }} rotation-x={-Math.PI / 2} visible={false}>
                  <ringGeometry args={[1.5, 1.9, 32]} />
                  <meshBasicMaterial color="#fb923c" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** Level 4's glow plants: brushed, they flare cyan (and wash the shadows near them out for 3 s). */
function Plants({ run }: { run: AlienRun }) {
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const items = useMemo(() => run.course.plants.map((p, i) => ({ ...p, index: i })), [run.course]);
   const cacheA = useCache<(typeof items)[number]>();
   const cacheB = useCache<(typeof items)[number]>();
   const g = GLB_SIZE.plant;
   const plant = (i: number, m: Matrix4, color: Color) => {
      const w = windowed(run, items, i, cacheA);
      if (!w) return false;
      const lit = run.plantUntil[w.it.index] > run.ms;
      E.set(0, w.it.index * 1.3 + Math.sin(time.now + w.it.index) * 0.1, 0);
      Q.setFromEuler(E);
      const k = (lit ? 1.15 : 1) * (1.6 / g.y);
      m.compose(V.set(laneX(w.it.lane), 0, -w.s), Q, S.set(k, k, k));
      color.set(lit ? "#a5f3fc" : "#ffffff");
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const w = windowed(run, items, i, cacheB);
      if (!w) return false;
      const lit = run.plantUntil[w.it.index] > run.ms;
      const sz = lit ? 7 + Math.sin(time.now * 8) * 0.6 : 1.6;
      m.compose(V.set(laneX(w.it.lane), 1.2, -w.s), camera.quaternion, S.set(sz, sz, sz));
      color.set(lit ? COLORS.plantLit : "#0e7490");
   };
   if (items.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.plant} count={10} update={plant} name="plants" tinted />
         <DynamicInstanced count={10} update={halo} name="plant-glows" tinted>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The orbs with a halo tinted by whose route they are on; collected ones gone. */
function Orbs({ run }: { run: AlienRun }) {
   const c = run.course;
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const orb = (i: number, m: Matrix4) => {
      const o = c.orbs[i];
      const os = itemVisualS(run, o.s);
      if (run.collected[i] || Math.abs(os - visualS(run)) > AHEAD) return false;
      E.set(0, time.now * 2.2 + i, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(o.lane), o.h - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i) * 0.1, -os), Q, S.set(k, k, k));
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const o = c.orbs[i];
      const os = itemVisualS(run, o.s);
      if (run.collected[i] || Math.abs(os - visualS(run)) > AHEAD) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(laneX(o.lane), o.h + Math.sin(time.now * 2 + i) * 0.1, -os), camera.quaternion, S.set(sz, sz, sz));
      const b = o.bonus;
      color.set(b === "vexa" ? "#c4b5fd" : b === "kiro" ? "#86efac" : b === "open" ? "#fca5a5" : b === "zuno" ? "#fde68a" : b === "nami" ? "#93c5fd" : "#ffe08a");
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

/** The secrets (a spinning shard / sticker), level 3's floating rock for the abducted shard. */
function Secrets({ run }: { run: AlienRun }) {
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
   const kr = 2.4 / GLB_SIZE.meteor.x;
   return (
      <>
         {c.secrets.map((sp, i) => (
            <group key={i}>
               <mesh ref={(m) => { refs.current[i] = m; }} position={[laneX(sp.lane), sp.h, -sp.s]}>
                  <octahedronGeometry args={[0.4, 0]} />
                  <meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={1} roughness={0.3} />
               </mesh>
               {sp.id === "abducted" ? (
                  <group position={[laneX(sp.lane), sp.h - 1.6, -sp.s]} rotation-x={Math.PI} scale={kr}>
                     <Model asset={ASSETS.meteor} />
                  </group>
               ) : null}
            </group>
         ))}
      </>
   );
}

/** Level 5's track events: decoy pods and their abduction beams, the saucer stepping stones, the crash meteor. */
function BossTrack({ run }: { run: AlienRun }) {
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const lures = useMemo(() => run.course.bossEvents.map((e, i) => ({ ...e, index: i })).filter((e) => e.kind === "lure"), [run.course]);
   const unders = useMemo(() => run.course.bossEvents.map((e, i) => ({ ...e, index: i })).filter((e) => e.kind === "underside"), [run.course]);
   const crashes = useMemo(() => run.course.bossEvents.map((e, i) => ({ ...e, index: i })).filter((e) => e.kind === "crash"), [run.course]);
   const cPod = useCache<(typeof lures)[number]>();
   const cBeam = useCache<(typeof lures)[number]>();
   const cSaucer = useCache<(typeof unders)[number]>();
   const cGlow = useCache<(typeof unders)[number]>();
   const cCrash = useCache<(typeof crashes)[number]>();
   const gp = GLB_SIZE.pod;
   const gs = GLB_SIZE.saucer;
   const gm = GLB_SIZE.meteor;
   const pod = (i: number, m: Matrix4) => {
      const w = windowed(run, lures, i, cPod);
      if (!w) return false;
      // the decoy pod sits beside the lure lane
      const side = w.it.lane === 2 ? -1 : 1;
      E.set(0, w.it.index, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane) + side * (LANE_W * 0.5), 0.4 + Math.sin(time.now * 2 + i) * 0.1, -w.s), Q, S.set(1.5 / gp.x, 1.6 / gp.y, 1.5 / gp.z));
   };
   const beam = (i: number, m: Matrix4, color: Color) => {
      const w = windowed(run, lures, i, cBeam);
      if (!w) return false;
      const d = w.s - visualS(run);
      if (d > LURE_LOCK + 14 || d < -3) return false;
      const locked = w.now && run.lureLap[w.it.index] === run.lap;
      const k = locked ? 1 : 0.35;
      Q.identity();
      m.compose(V.set(laneX(w.it.lane), 5, -w.s), Q, S.set(1.8 * k + 0.4, 10, 1.8 * k + 0.4));
      color.set(locked ? "#f0abfc" : "#7c3aed");
   };
   const saucer = (i: number, m: Matrix4) => {
      const w = windowed(run, unders, Math.floor(i / 3), cSaucer);
      if (!w) return false;
      const j = i % 3;
      E.set(0, time.now * 0.8 + j, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane), 0.6 + j * 0.6, -(w.s - 12 + j * 4)), Q, S.set(1.6 / gs.x, 0.4 / gs.y, 1.6 / gs.z));
   };
   const under = (i: number, m: Matrix4) => {
      const w = windowed(run, unders, i, cGlow);
      if (!w) return false;
      const sz = 3 + Math.sin(time.now * 6) * 0.3;
      m.compose(V.set(laneX(w.it.lane), 2.4, -w.s), camera.quaternion, S.set(sz, sz, sz));
   };
   const crash = (i: number, m: Matrix4) => {
      const w = windowed(run, crashes, i, cCrash);
      if (!w) return false;
      E.set(time.now * 0.5, time.now * 0.3, 0);
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane) + 1.2, 0, -w.s), Q, S.set(1.6 / gm.x, 1.4 / gm.y, 1.6 / gm.z));
   };
   if (!run.course.loop) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.pod} count={6} update={pod} name="decoy-pods" />
         <DynamicInstanced count={4} update={beam} name="abduction-beams" tinted>
            <cylinderGeometry args={[0.5, 0.5, 1, 20, 1, true]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.saucer} count={12} update={saucer} name="saucer-steps" />
         <DynamicInstanced count={4} update={under} name="underside-glows">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color="#fde047" map={glow} transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstancedModel asset={ASSETS.meteor} count={2} update={crash} name="crash-meteor" />
      </>
   );
}

/** The scenery: alien spires and crystal clusters along both sides, and the launch pad at the finish. */
function Scenery({ run }: { run: AlienRun }) {
   const c = run.course;
   const decor = useMemo(() => {
      const out: { s: number; side: number; kind: "spires" | "crystal"; k: number }[] = [];
      let i = 0;
      const end = c.finishS + 60 + (c.loop ? 8 * (c.loop.s1 - c.loop.s0) : 0);
      for (let s = 6; s < end; s += 13) {
         const side = i % 2 === 0 ? -1 : 1;
         out.push({ s, side, kind: "crystal", k: 0.8 + ((i * 37) % 10) / 15 });
         i++;
      }
      for (let s = 20; s < end + 20; s += 34) out.push({ s, side: Math.floor(s / 34) % 2 === 0 ? -1 : 1, kind: "spires", k: 0.8 + ((s * 13) % 7) / 10 });
      return out;
   }, [c]);
   const pool = (kind: "spires" | "crystal") => {
      const list = decor.filter((d) => d.kind === kind);
      const g = GLB_SIZE[kind];
      const h = kind === "spires" ? 18 : 3.4;
      const off = kind === "spires" ? 34 : 7.4;
      return (i: number, m: Matrix4) => {
         const d = list[i];
         if (!d) return false;
         const vs = visualS(run);
         // the decor repeats every 1000 m so level 5's laps never run out of it
         const span = 1000;
         let s = d.s;
         while (s < vs - BEHIND - 10) s += span;
         if (s > vs + AHEAD + 60) return false;
         E.set(0, d.side * 0.4 + d.s * 0.01, 0);
         Q.setFromEuler(E);
         const k = (h * d.k) / g.y;
         m.compose(V.set(d.side * (off + (d.k - 0.8) * 3), 0, -s), Q, S.set(k, k, k));
      };
   };
   const spires = useMemo(() => pool("spires"), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
   const crystals = useMemo(() => pool("crystal"), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
   const finish = useRef<Group>(null);
   useFrame(() => {
      if (finish.current) finish.current.position.z = -itemVisualS(run, c.finishS);
   });
   const kb = 3.2 / GLB_SIZE.beacon.y;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.spires} count={6} update={spires} name="decor-spires" />
         <DynamicInstancedModel asset={ASSETS.crystal} count={12} update={crystals} name="decor-crystals" />
         <group ref={finish}>
            {[-1, 1].map((side) => (
               <group key={side} position={[side * (LANE_W * 1.5 + 0.8), 0, 0]} scale={kb}>
                  <Model asset={ASSETS.beacon} />
               </group>
            ))}
            {/* the launch pad */}
            <mesh position={[0, 0.03, -6]} rotation-x={-Math.PI / 2}>
               <ringGeometry args={[2.4, 3.6, 40]} />
               <meshBasicMaterial color="#22d3ee" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[LANE_W * 3, 1.2]} />
               <meshBasicMaterial color="#f5d0fe" toneMapped={false} />
            </mesh>
         </group>
      </>
   );
}

export function Road({ run }: { run: AlienRun }) {
   const coverKinds = useMemo(() => (["crystal", "rock", "pod", "crater"] as const).filter((k) => run.course.covers.some((c) => c.kind === k)), [run.course]);
   return (
      <>
         <TrackBed run={run} />
         {coverKinds.map((k) => (
            <CoverPool key={k} run={run} kind={k} />
         ))}
         <CraterRims run={run} />
         <Strips run={run} />
         <Signs run={run} />
         <ScanLine run={run} />
         <ObstaclePool run={run} kind="rock" />
         <ObstaclePool run={run} kind="blob" />
         <Arches run={run} />
         <Meteors run={run} />
         <Plants run={run} />
         <Orbs run={run} />
         <Secrets run={run} />
         <BossTrack run={run} />
         <Scenery run={run} />
      </>
   );
}
