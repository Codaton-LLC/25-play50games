"use client";

// The candy road (everything with a rule behind it), drawn from windows round the runner (pools sized
// once): the pink road with its lane lines, the obstacles (jelly cubes, chocolate walls, frozen blocks,
// cookie / candy-cane / frozen arches, lollipop wheels, the king's drum, throne and crown), each with
// its size sign (BIG / SMALL) shown 2 s ahead (3 s on level 1), the candy coins, the orbs, the side
// lanes and their gates (Riko's gingerbread wall, Vexa's ghost wall), Nami's candy-cane rail, Zuno's
// frosting walls, Kiro's popping fields, level 2's chocolate bridges and donuts, level 3's frosted ice,
// level 4's gummy monsters, and the finish gate. On level 5 the palace section is drawn twice while it
// repeats (this lap and the next), so the road ahead never runs out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, DoubleSide, Euler, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3, type Color, type Group, type Matrix4, type Mesh } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, COIN_SIZE, GLB_SIZE, GUMMY_H, OBSTACLE_W, ORB_SIZE } from "./assets";
import { COLORS } from "./look";
import { BIG, LANE_W, RAIL_Y, SMALL, laneX, needOf, type ObstacleKind } from "./course";
import { bossDone, inPhase, itemVisualS, visualS, type CandyRun } from "./rules";

const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

const BEHIND = 12;
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

/** The palace's lap (level 5): items in it are drawn again one lap on while it repeats. */
function lapOf(run: CandyRun): number {
   const l = run.course.loop;
   return l ? l.s1 - l.s0 : 0;
}

/**
 * For each copy index, which item and at which s: the window [s - BEHIND, s + AHEAD], with the palace
 * drawn twice while it repeats (and nothing past it then).
 */
function windowed<T extends { s: number; phase?: number }>(run: CandyRun, items: readonly T[], i: number, cache: { list: { it: T; s: number; now: boolean }[]; at: number }): { it: T; s: number; now: boolean } | null {
   if (i === 0 || cache.at !== run.ms) {
      cache.at = run.ms;
      cache.list.length = 0;
      const vs = visualS(run);
      const loop = run.course.loop;
      const looping = !!loop && !bossDone(run);
      const L = lapOf(run);
      for (const it of items) {
         if (it.phase !== undefined && !inPhase(run, it.phase)) continue;
         const at = itemVisualS(run, it.s);
         if (looping && loop && it.s > loop.s1 + 1) continue;
         if (at >= vs - BEHIND && at <= vs + AHEAD) cache.list.push({ it, s: at, now: true });
         // the palace's next lap ahead
         if (looping && loop && it.s >= loop.s0 && it.s <= loop.s1 && at + L <= vs + AHEAD && at + L >= vs - BEHIND) cache.list.push({ it, s: at + L, now: false });
      }
   }
   return cache.list[i] ?? null;
}

/** The road: a pink strip with lane lines, the side lanes where they run, frosted ice, the finish. */
function RoadBed({ run }: { run: CandyRun }) {
   const c = run.course;
   // long enough for level 5's palace laps (drawn on down the road)
   const len = c.finishS + 80 + (c.loop ? 8 * (c.loop.s1 - c.loop.s0) : 0);
   const lines = [-0.5, 0.5].map((k) => k * LANE_W);
   return (
      <group>
         <mesh position={[0, -0.25, -len / 2 + 20]} receiveShadow>
            <boxGeometry args={[LANE_W * 3 + 1.2, 0.5, len]} />
            <meshStandardMaterial color={COLORS.road} roughness={0.8} />
         </mesh>
         {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (LANE_W * 1.5 + 0.6), 0.05, -len / 2 + 20]}>
               <boxGeometry args={[0.5, 0.4, len]} />
               <meshStandardMaterial color={COLORS.roadEdge} roughness={0.6} />
            </mesh>
         ))}
         {lines.map((x) => (
            <mesh key={x} position={[x, 0.01, -len / 2 + 20]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[0.12, len]} />
               <meshBasicMaterial color={COLORS.laneLine} transparent opacity={0.8} />
            </mesh>
         ))}
         {c.sideLanes.map((sl, i) => (
            <mesh key={i} position={[laneX(sl.lane), -0.25, -(sl.s0 + sl.s1) / 2 + 4]}>
               <boxGeometry args={[LANE_W, 0.5, sl.s1 - sl.s0 + 8]} />
               <meshStandardMaterial color={sl.gate === "ghost" ? "#ddd6fe" : "#fcd9a8"} roughness={0.8} />
            </mesh>
         ))}
         {c.ice.map((ic, i) => (
            <mesh key={i} position={[0, 0.02, -(ic.s0 + ic.s1) / 2]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[LANE_W * 3, ic.s1 - ic.s0]} />
               <meshStandardMaterial color={COLORS.ice} roughness={0.1} metalness={0.2} transparent opacity={0.75} />
            </mesh>
         ))}
         {c.fields.map((f, i) => (
            <mesh key={i} position={[laneX(f.lane), 0.03, -(f.s0 + f.s1) / 2]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[LANE_W - 0.3, f.s1 - f.s0]} />
               <meshStandardMaterial color={COLORS.field} emissive="#a855f7" emissiveIntensity={0.35} roughness={0.5} />
            </mesh>
         ))}
         {c.bridges.map((br, i) => (
            <BridgeLook key={i} run={run} index={i} />
         ))}
      </group>
   );
}

/** A chocolate-bar bridge across its lane's gap (cracked: it sags dark). */
function BridgeLook({ run, index }: { run: CandyRun; index: number }) {
   const br = run.course.bridges[index];
   const g = useRef<Group>(null);
   useFrame(() => {
      if (g.current) g.current.position.y = run.bridgeCracked[index] ? -0.25 : 0.02;
   });
   const n = Math.ceil((br.s1 - br.s0) / 1.0);
   const k = (LANE_W - 0.2) / GLB_SIZE.choco.x;
   return (
      <group ref={g}>
         {Array.from({ length: n }, (_, i) => (
            <group key={i} position={[laneX(br.lane), 0, -(br.s0 + i * ((br.s1 - br.s0) / n))]} scale={[k, 1.6, 0.95 / GLB_SIZE.choco.z]}>
               <Model asset={ASSETS.choco} />
            </group>
         ))}
      </group>
   );
}

interface Look {
   asset: keyof typeof ASSETS;
   /** width, height, depth (m) */
   w: number;
   h: number;
   d: number;
   tint: string | null;
   /** stood up (the chocolate bar as a wall) */
   upright?: boolean;
}

const LOOKS: Record<ObstacleKind, Look> = {
   jelly: { asset: "jelly", w: OBSTACLE_W, h: 1.8, d: 1.8, tint: null },
   choco: { asset: "choco", w: OBSTACLE_W, h: 2.2, d: 0.5, tint: null, upright: true },
   frozenBlock: { asset: "jelly", w: OBSTACLE_W, h: 1.8, d: 1.8, tint: "#bae6fd" },
   cookieArch: { asset: "cookieArch", w: OBSTACLE_W + 0.2, h: 2.6, d: 1.0, tint: null },
   caneArch: { asset: "caneArch", w: OBSTACLE_W + 0.2, h: 2.6, d: 0.4, tint: null },
   frozenArch: { asset: "cookieArch", w: OBSTACLE_W + 0.2, h: 2.6, d: 1.0, tint: "#93c5fd" },
   wheel: { asset: "lollipop", w: OBSTACLE_W, h: 3.2, d: 0.5, tint: null },
   drum: { asset: "jelly", w: OBSTACLE_W, h: 1.8, d: 1.8, tint: "#fde047" },
   throne: { asset: "cupcake", w: 1.6, h: 3.0, d: 1.6, tint: "#fde047" },
   crown: { asset: "jelly", w: 1.6, h: 1.4, d: 1.6, tint: "#facc15" },
};

const KINDS = Object.keys(LOOKS) as ObstacleKind[];

/** One pool per obstacle kind (Big ones vanish once smashed; arches and wheels stay). */
function ObstaclePool({ run, kind }: { run: CandyRun; kind: ObstacleKind }) {
   const time = useGameTime();
   const items = useMemo(() => run.course.obstacles.map((o, i) => ({ ...o, index: i })).filter((o) => o.kind === kind), [run.course, kind]);
   const cache = useMemo(() => ({ list: [] as { it: (typeof items)[number]; s: number; now: boolean }[], at: -1 }), []);
   const L = LOOKS[kind];
   const g = GLB_SIZE[L.asset as keyof typeof GLB_SIZE];
   const update = (i: number, m: Matrix4, color: Color) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      const o = w.it;
      const met = run.metLap[o.index] === run.lap && w.now;
      if (met && needOf(o.kind) === BIG) return false;
      if (L.upright) E.set(Math.PI / 2, 0, 0);
      else if (kind === "wheel") E.set(0, Math.PI / 2, (run.ms / 1000) * 3);
      else E.set(0, kind === "crown" ? time.now : 0, 0);
      Q.setFromEuler(E);
      const y = kind === "crown" ? 2.2 + Math.sin(time.now * 2) * 0.2 : 0;
      if (L.upright) m.compose(V.set(laneX(o.lane), L.h / 2 + 0.1, -w.s), Q, S.set(L.w / g.x, L.d / g.y, L.h / g.z));
      else if (kind === "wheel") m.compose(V.set(laneX(o.lane), 0, -w.s), Q, S.set(L.d / g.z, L.h / g.y, L.w / g.x));
      else m.compose(V.set(laneX(o.lane), y, -w.s), Q, S.set(L.w / g.x, L.h / g.y, L.d / g.z));
      if (L.tint) color.set(L.tint);
   };
   if (items.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS[L.asset]} count={Math.min(items.length * 2, 24)} update={update} name={`obstacles-${kind}`} tinted={!!L.tint} />;
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
      // the silhouette: a big or a small ball
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(30, 32, text === "BIG" ? 18 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 54, 34);
   }
   const t = new CanvasTexture(c);
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** The size signs over the obstacles ahead (2 s ahead; 3 s on level 1): BIG (amber) or SMALL (blue). */
function Signs({ run }: { run: CandyRun }) {
   const tex = useMemo(() => ({ big: makeSign("BIG", COLORS.big), small: makeSign("SMALL", COLORS.small) }), []);
   useEffect(() => () => {
      tex.big.dispose();
      tex.small.dispose();
   }, [tex]);
   const items = useMemo(() => run.course.beats.map((b) => ({ s: b.s, lane: b.lane, need: b.need, phase: b.phase })), [run.course]);
   const cacheB = useMemo(() => ({ list: [] as { it: (typeof items)[number]; s: number; now: boolean }[], at: -1 }), []);
   const cacheS = useMemo(() => ({ list: [] as { it: (typeof items)[number]; s: number; now: boolean }[], at: -1 }), []);
   const ahead = (run.level === 1 ? 3 : 2) * run.course.config.speed;
   const byNeed = useMemo(() => ({ [BIG]: items.filter((b) => b.need === BIG), [SMALL]: items.filter((b) => b.need === SMALL) }), [items]);
   const draw = (need: number, cache: typeof cacheB) => (i: number, m: Matrix4) => {
      const w = windowed(run, byNeed[need as 0 | 2], i, cache);
      if (!w) return false;
      const d = w.s - visualS(run);
      if (d < 0 || d > ahead) return false;
      Q.identity();
      m.compose(V.set(laneX(w.it.lane), 3.4, -w.s + 0.6), Q, S.set(1.6, 0.8, 1));
   };
   const bigDraw = useMemo(() => draw(BIG, cacheB), [items]); // eslint-disable-line react-hooks/exhaustive-deps
   const smallDraw = useMemo(() => draw(SMALL, cacheS), [items]); // eslint-disable-line react-hooks/exhaustive-deps
   return (
      <>
         <DynamicInstanced count={6} update={bigDraw} name="signs-big">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex.big} transparent toneMapped={false} side={DoubleSide} />
         </DynamicInstanced>
         <DynamicInstanced count={6} update={smallDraw} name="signs-small">
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex.small} transparent toneMapped={false} side={DoubleSide} />
         </DynamicInstanced>
      </>
   );
}

/** The candy coins: spinning upright, gone once eaten (this lap). */
function Coins({ run }: { run: CandyRun }) {
   const time = useGameTime();
   const items = useMemo(() => run.course.coins.map((c, i) => ({ ...c, index: i })), [run.course]);
   const cache = useMemo(() => ({ list: [] as { it: (typeof items)[number]; s: number; now: boolean }[], at: -1 }), []);
   const k = COIN_SIZE / GLB_SIZE.coin.x;
   const update = (i: number, m: Matrix4) => {
      const w = windowed(run, items, i, cache);
      if (!w) return false;
      if (run.coinLap[w.it.index] === run.lap && w.now) return false;
      E.set(Math.PI / 2, time.now * 3 + w.it.index, 0, "YXZ");
      Q.setFromEuler(E);
      m.compose(V.set(laneX(w.it.lane), 0.9 + Math.sin(time.now * 3 + w.it.index) * 0.08, -w.s), Q, S.set(k, k, k));
   };
   return <DynamicInstancedModel asset={ASSETS.coin} count={40} update={update} name="coins" />;
}

/** The orbs with a halo tinted by whose route they are on; collected ones gone. */
function Orbs({ run }: { run: CandyRun }) {
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
      const x = o.magnet ? laneX(-1) : laneX(o.lane);
      m.compose(V.set(x, o.h - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i) * 0.1, -os), Q, S.set(k, k, k));
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      const o = c.orbs[i];
      const os = itemVisualS(run, o.s);
      if (run.collected[i] || Math.abs(os - visualS(run)) > AHEAD) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(laneX(o.lane), o.h + Math.sin(time.now * 2 + i) * 0.1, -os), camera.quaternion, S.set(sz, sz, sz));
      const b = o.bonus;
      color.set(b === "vexa" ? "#c4b5fd" : b === "kiro" ? "#86efac" : b === "riko" ? "#fca5a5" : b === "zuno" ? "#fde68a" : b === "nami" ? "#93c5fd" : b === "donut" ? "#fbcfe8" : "#ffe08a");
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

/** The side lanes' gates, Nami's rail, Zuno's frosting walls, the donuts, the gummies, the secrets. */
function Features({ run }: { run: CandyRun }) {
   const c = run.course;
   const time = useGameTime();
   const gates = useRef<(Mesh | null)[]>([]);
   const gummies = useRef<(Group | null)[]>([]);
   const secrets = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      c.sideLanes.forEach((sl, i) => {
         const m = gates.current[i];
         if (!m) return;
         m.visible = !run.gateOpen[i];
         if (sl.gate === "ghost") (m.material as { opacity: number }).opacity = run.ms <= run.phaseUntil ? 0.2 : 0.6;
      });
      c.gummies.forEach((gm, i) => {
         const g = gummies.current[i];
         if (!g) return;
         g.visible = !run.gummyDone[i];
         g.position.y = Math.abs(Math.sin(time.now * 4 + i)) * 0.3;
         void gm;
      });
      c.secrets.forEach((_sp, i) => {
         const m = secrets.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6;
      });
   });
   const kg = GUMMY_H / GLB_SIZE.gummy.y;
   const kd = (LANE_W - 0.4) / GLB_SIZE.donut.x;
   return (
      <>
         {c.sideLanes.map((sl, i) => (
            <mesh key={i} ref={(m) => { gates.current[i] = m; }} position={[laneX(sl.lane), 1.3, -sl.s0]}>
               <boxGeometry args={[LANE_W - 0.2, 2.6, 0.5]} />
               <meshStandardMaterial color={sl.gate === "ghost" ? COLORS.ghost : COLORS.gingerbread} transparent={sl.gate === "ghost"} opacity={sl.gate === "ghost" ? 0.6 : 1} emissive={sl.gate === "ghost" ? "#7c3aed" : "#000000"} emissiveIntensity={0.3} roughness={0.7} />
            </mesh>
         ))}
         {c.rails.map((r, i) => (
            <mesh key={i} position={[0, RAIL_Y - 0.08, -(r.s0 + r.s1) / 2]} rotation-x={Math.PI / 2}>
               <cylinderGeometry args={[0.12, 0.12, r.s1 - r.s0, 10]} />
               <meshStandardMaterial color={COLORS.rail} roughness={0.35} emissive="#be123c" emissiveIntensity={0.2} />
            </mesh>
         ))}
         {c.rails.map((r, i) => (
            <group key={`p${i}`}>
               {[r.s0, (r.s0 + r.s1) / 2, r.s1].map((s, j) => (
                  <mesh key={j} position={[0, RAIL_Y / 2, -s]}>
                     <cylinderGeometry args={[0.07, 0.07, RAIL_Y, 8]} />
                     <meshStandardMaterial color="#fff1f2" />
                  </mesh>
               ))}
            </group>
         ))}
         {c.trails.map((t, i) => (
            <mesh key={i} position={[laneX(-1), 1.3, -(t.s0 + t.s1) / 2]}>
               <boxGeometry args={[1.4, 2.6, t.s1 - t.s0]} />
               <meshStandardMaterial color={COLORS.frosting} transparent opacity={0.6} roughness={0.2} depthWrite={false} />
            </mesh>
         ))}
         {c.donuts.map((d, i) => (
            <group key={i} position={[laneX(d.lane), 0.02, -d.s]} scale={[kd, 1, kd]}>
               <Model asset={ASSETS.donut} />
            </group>
         ))}
         {c.gummies.map((gm, i) => (
            <group key={i} position={[laneX(gm.lane), 0, -gm.s]}>
               <group ref={(g) => { gummies.current[i] = g; }} scale={kg}>
                  <Model asset={ASSETS.gummy} />
               </group>
            </group>
         ))}
         {c.secrets.map((sp, i) =>
            sp.s < 0 ? null : (
               <mesh key={i} ref={(m) => { secrets.current[i] = m; }} position={[laneX(sp.lane), sp.h, -sp.s]}>
                  <octahedronGeometry args={[0.4, 0]} />
                  <meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={1} roughness={0.3} />
               </mesh>
            ),
         )}
         {c.exitArch ? (
            <group position={[laneX(c.exitArch.lane), 0, -c.exitArch.s]} scale={[(OBSTACLE_W + 0.2) / GLB_SIZE.caneArch.x, 2.0 / GLB_SIZE.caneArch.y, 1]}>
               <Model asset={ASSETS.caneArch} />
            </group>
         ) : null}
      </>
   );
}

/** The finish gate (the candy castle) and the decor along the road: cupcake towers and lollipops. */
function Scenery({ run }: { run: CandyRun }) {
   const c = run.course;
   const decor = useMemo(() => {
      const out: { s: number; side: number; kind: "cupcake" | "lollipop" | "castle"; k: number }[] = [];
      let i = 0;
      const end = c.finishS + 60 + (c.loop ? 8 * (c.loop.s1 - c.loop.s0) : 0);
      for (let s = 10; s < end; s += 18) {
         const side = i % 2 === 0 ? -1 : 1;
         out.push({ s, side, kind: i % 3 === 0 ? "lollipop" : "cupcake", k: 0.8 + ((i * 37) % 10) / 20 });
         i++;
      }
      for (let s = 40; s < end + 20; s += 70) out.push({ s, side: s % 140 < 70 ? -1 : 1, kind: "castle", k: 1 });
      return out;
   }, [c]);
   const pool = (kind: "cupcake" | "lollipop" | "castle") => {
      const list = decor.filter((d) => d.kind === kind);
      const g = GLB_SIZE[kind];
      const h = kind === "castle" ? 16 : kind === "cupcake" ? 6 : 4;
      const off = kind === "castle" ? 22 : 8;
      return (i: number, m: Matrix4) => {
         const d = list[i];
         if (!d) return false;
         const s = d.s;
         const vs = visualS(run);
         if (s < vs - BEHIND - 10 || s > vs + AHEAD + 60) return false;
         E.set(0, d.side * 0.4 + d.s * 0.01, 0);
         Q.setFromEuler(E);
         const k = (h * d.k) / g.y;
         m.compose(V.set(d.side * off, 0, -s), Q, S.set(k, k, k));
      };
   };
   const cupcake = useMemo(() => pool("cupcake"), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
   const lollipop = useMemo(() => pool("lollipop"), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
   const castle = useMemo(() => pool("castle"), [decor]); // eslint-disable-line react-hooks/exhaustive-deps
   const kc = 14 / GLB_SIZE.castle.y;
   const finish = useRef<Group>(null);
   useFrame(() => {
      if (finish.current) finish.current.position.z = -itemVisualS(run, c.finishS);
   });
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.cupcake} count={10} update={cupcake} name="decor-cupcakes" />
         <DynamicInstancedModel asset={ASSETS.lollipop} count={6} update={lollipop} name="decor-lollipops" />
         <DynamicInstancedModel asset={ASSETS.castle} count={4} update={castle} name="decor-castles" />
         <group ref={finish}>
            <group position={[0, 0, -8]} scale={kc}>
               <Model asset={ASSETS.castle} />
            </group>
            <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
               <planeGeometry args={[LANE_W * 3, 1.2]} />
               <meshBasicMaterial color="#ffffff" />
            </mesh>
         </group>
      </>
   );
}

export function Road({ run }: { run: CandyRun }) {
   const kinds = useMemo(() => KINDS.filter((k) => run.course.obstacles.some((o) => o.kind === k)), [run.course]);
   return (
      <>
         <RoadBed run={run} />
         {kinds.map((k) => (
            <ObstaclePool key={k} run={run} kind={k} />
         ))}
         <Signs run={run} />
         <Coins run={run} />
         <Orbs run={run} />
         <Features run={run} />
         <Scenery run={run} />
      </>
   );
}

