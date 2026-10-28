"use client";

// The cave, drawn from the rules (rules.ts / track.ts): the faceted rock tunnel that follows the rails
// (look.ts buildCave, one mesh), the rails (m2MineTrack pieces; the ghost rails tinted violet, the upper
// track on m2MineScaffold legs), the hazards (m2CaveRock, m2CaveArchBridge beams, ember pits under the
// gaps, m2HangingCrystal falling with a red shadow, m2LavafallRock with its lava stream, Riko's cracked
// barricades), the orbs (scoreOrb) with halos, the lanterns (m2CaveLanternPost), the decor (crystal
// clusters, stalagmites, glow mushrooms, bats), the hoard with the egg and the patrol bots, the skull
// gate at the exit, the secrets, and level 5's plates, ramps, collar locks and fireballs.
// Everything along the rails is drawn from a window round the cart (pools sized once), so a 900 m cave
// costs what 200 m of it does.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Euler, PlaneGeometry, Quaternion, Vector3, type Color, type Matrix4, type Mesh } from "three";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, useCanvasTexture } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, ORB_SIZE, TRACK_LEN, TRACK_SCALE } from "./assets";
import { COLORS, buildCave, buildFloor, hash2 } from "./look";
import { SECRETS } from "./progression";
import { SCAFFOLD_Y, lanePoint, type Course as CourseData } from "./track";
import { bossDone, lavaOn, type CaveRun } from "./rules";
import type { ModelAsset } from "@/arcade3d/core/types";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const P = { x: 0, y: 0, z: 0, h: 0 };
const V = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

/** A soft round glow (white centre fading to clear) for the orb halos and the light beyond the gate. */
const drawGlow = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
   const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
   g.addColorStop(0, "rgba(255,255,255,1)");
   g.addColorStop(0.35, "rgba(255,255,255,0.55)");
   g.addColorStop(1, "rgba(255,255,255,0)");
   ctx.fillStyle = g;
   ctx.fillRect(0, 0, w, h);
};

/** One placed copy along the rails. */
export interface Item {
   s: number;
   x: number;
   y: number;
   z: number;
   rotY: number;
   sx: number;
   sy: number;
   sz: number;
   tint?: string;
   /** what it stands for (an orb's index, a hazard's index), -1 for decor */
   ref: number;
}

/** Places an item at (s, sideways d, height y) with its long axis along the rails (alongX: the GLB's x). */
export function itemAt(c: CourseData, s: number, d: number, y: number, scale: { x: number; y: number; z: number }, alongX = false, ref = -1, extraYaw = 0): Item {
   lanePoint(c, s, d, y, P);
   return { s, x: P.x, y: P.y, z: P.z, rotY: P.h + (alongX ? Math.PI / 2 : Math.PI) + extraYaw, sx: scale.x, sy: scale.y, sz: scale.z, ref };
}

/** The first index with items[i].s >= s (items sorted by s). */
export function lowerBound(items: readonly Item[], s: number): number {
   let lo = 0;
   let hi = items.length;
   while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (items[m].s < s) lo = m + 1;
      else hi = m;
   }
   return lo;
}

/** A pool of copies of one GLB drawn from a window of the rails round the cart. */
function WindowPool({
   asset,
   items,
   run,
   count,
   behind = 25,
   ahead = 170,
   hide,
   pose,
   tinted = false,
   name,
}: {
   asset: ModelAsset;
   items: readonly Item[];
   run: CaveRun;
   count: number;
   behind?: number;
   ahead?: number;
   hide?: (it: Item) => boolean;
   pose?: (it: Item, out: { y: number; rotY: number; s: number }) => void;
   tinted?: boolean;
   name: string;
}) {
   const start = useRef(0);
   const extra = useMemo(() => ({ y: 0, rotY: 0, s: 1 }), []);
   const update = (i: number, m: Matrix4, color: Color) => {
      if (i === 0) start.current = lowerBound(items, run.cart.s - behind);
      // skip hidden ones: walk forward through the window
      const it = items[start.current + i];
      if (!it || it.s > run.cart.s + ahead) return false;
      if (hide && hide(it)) return false;
      extra.y = it.y;
      extra.rotY = it.rotY;
      extra.s = 1;
      if (pose) pose(it, extra);
      if (extra.s <= 0.001) return false;
      E.set(0, extra.rotY, 0);
      Q.setFromEuler(E);
      m.compose(V.set(it.x, extra.y, it.z), Q, S.set(it.sx * extra.s, it.sy * extra.s, it.sz * extra.s));
      if (it.tint) color.set(it.tint);
   };
   if (items.length === 0) return null;
   return <DynamicInstancedModel asset={asset} count={Math.min(count, items.length)} update={update} name={name} tinted={tinted} />;
}

/** The rock tunnel and the floor: two meshes built once per level. */
function Cave({ course }: { course: CourseData }) {
   const geo = useMemo(() => {
      const make = (m: { positions: Float32Array; colors: Float32Array; indices: Uint32Array }) => {
         const g = new BufferGeometry();
         g.setAttribute("position", new BufferAttribute(m.positions, 3));
         g.setAttribute("color", new BufferAttribute(m.colors, 3));
         g.setIndex(new BufferAttribute(m.indices, 1));
         g.computeVertexNormals();
         return g;
      };
      return { cave: make(buildCave(course)), floor: make(buildFloor(course)) };
   }, [course]);
   useEffect(
      () => () => {
         geo.cave.dispose();
         geo.floor.dispose();
      },
      [geo],
   );
   const loop = course.loop;
   return (
      <>
         <mesh geometry={geo.cave} frustumCulled={false}>
            {/* the vertex colours tinted down: warm rock in the lantern light; level 3 nearly black */}
            <meshStandardMaterial vertexColors color={course.config.dark ? "#3a3548" : "#b8a49a"} flatShading roughness={0.92} metalness={0.05} side={DoubleSide} />
         </mesh>
         <mesh geometry={geo.floor} frustumCulled={false}>
            <meshStandardMaterial vertexColors color={course.config.dark ? "#5a5468" : "#ffffff"} roughness={0.95} />
         </mesh>
         {loop ? (
            // the hoard cavern round Cindermaw's loop: a great dome and a floor of embers
            <group position={[loop.centre.x, course.samples[Math.round(loop.s0 / 0.5) * 4 + 1], loop.centre.z]}>
               <mesh>
                  <sphereGeometry args={[loop.radius + 22, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.95} flatShading side={DoubleSide} />
               </mesh>
               <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]}>
                  <circleGeometry args={[loop.radius + 22, 40]} />
                  <meshStandardMaterial color={COLORS.floor} emissive="#3a1206" emissiveIntensity={0.6} roughness={0.9} />
               </mesh>
            </group>
         ) : null}
      </>
   );
}

/** Every rail piece, the scaffold legs, the ember pits under the gaps. */
function useRails(course: CourseData) {
   return useMemo(() => {
      const rails: Item[] = [];
      const legs: Item[] = [];
      const pits: Item[] = [];
      const sc = { x: TRACK_SCALE, y: TRACK_SCALE, z: TRACK_SCALE * 1.15 };
      course.lanes.forEach((l, li) => {
         const s0 = Math.max(0, l.s0);
         const s1 = Math.min(course.length + 6, l.s1);
         const gaps = course.hazards.filter((h) => h.kind === "gap" && h.lane === li);
         for (let s = s0 + TRACK_LEN / 2; s < s1; s += TRACK_LEN) {
            if (gaps.some((g) => s + TRACK_LEN / 2 > g.s && s - TRACK_LEN / 2 < g.s + g.len)) continue;
            const it = itemAt(course, s, l.d, l.y - 0.02, sc, true, li);
            if (l.kind === "ghost") it.tint = "#a78bfa";
            rails.push(it);
            if (l.kind === "scaffold" && Math.round((s - s0) / TRACK_LEN) % 3 === 0) {
               const k = SCAFFOLD_Y / GLB_SIZE.scaffold.y;
               legs.push(itemAt(course, s, l.d, 0, { x: 1.7 / GLB_SIZE.scaffold.x, y: k, z: 1.4 / GLB_SIZE.scaffold.z }, true));
            }
         }
         for (const g of gaps) pits.push(itemAt(course, g.s + g.len / 2, l.d, -0.9, { x: 1, y: 1, z: 1 }, false, li));
      });
      rails.sort((a, b) => a.s - b.s);
      legs.sort((a, b) => a.s - b.s);
      return { rails, legs, pits };
   }, [course]);
}

/** Decor along the cave: crystal clusters, stalagmites, rocks, mushrooms (dense on level 3), bats, lanterns. */
function useDecor(course: CourseData) {
   return useMemo(() => {
      const clusters: Item[] = [];
      const stal: Item[] = [];
      const shrooms: Item[] = [];
      const lanterns: Item[] = [];
      const rocks: Item[] = [];
      const dark = course.config.dark;
      const inLoop = (s: number) => !!course.loop && s > course.loop.s0 - 2 && s < course.loop.s1 + 2;
      for (let s = 6, k = 0; s < course.length; s += 11, k++) {
         if (inLoop(s)) continue;
         const side = k % 2 ? 1 : -1;
         const r = hash2(k, 3.1);
         const kk = 1.6 + r * 1.6;
         if (r < 0.55) clusters.push(itemAt(course, s, side * (6.4 + r), -0.3, { x: kk / GLB_SIZE.cluster.x, y: kk / GLB_SIZE.cluster.x, z: kk / GLB_SIZE.cluster.x }, false, -1, r * 6));
         else stal.push(itemAt(course, s, side * (6.8 + r * 0.6), -0.3, { x: 3 / GLB_SIZE.stalagmites.x, y: (2 + r * 2) / GLB_SIZE.stalagmites.y, z: 2 / GLB_SIZE.stalagmites.z }, false, -1, r * 4));
         if (dark || k % 3 === 0) shrooms.push(itemAt(course, s + 4, -side * (5.8 + r), -0.3, { x: 1.6 / GLB_SIZE.mushrooms.x, y: 1.6 / GLB_SIZE.mushrooms.x, z: 1.6 / GLB_SIZE.mushrooms.x }, false, -1, r * 5));
         if (k % 4 === 1) rocks.push(itemAt(course, s + 6, side * 5.6, -0.35, { x: 1.8 / GLB_SIZE.rock.x, y: 1.4 / GLB_SIZE.rock.y, z: 1.8 / GLB_SIZE.rock.z }, false, -1, r * 3));
      }
      for (const s of course.lanterns) lanterns.push(itemAt(course, Math.max(2, s), -4.9, -0.3, { x: 2.4 / GLB_SIZE.lantern.y, y: 2.4 / GLB_SIZE.lantern.y, z: 2.4 / GLB_SIZE.lantern.y }, false, -1, Math.PI / 2));
      for (let s = 30; s < course.length; s += 45) if (!inLoop(s)) lanterns.push(itemAt(course, s, 4.9, -0.3, { x: 2.2 / GLB_SIZE.lantern.y, y: 2.2 / GLB_SIZE.lantern.y, z: 2.2 / GLB_SIZE.lantern.y }, false, -1, -Math.PI / 2));
      const sort = (a: Item[]) => a.sort((p, q) => p.s - q.s);
      return { clusters: sort(clusters), stal: sort(stal), shrooms: sort(shrooms), lanterns: sort(lanterns), rocks: sort(rocks) };
   }, [course]);
}

/** The hazards: rocks, beams, crystals, lavafalls, barricades (each drawn by its own pool). */
function useHazards(course: CourseData) {
   return useMemo(() => {
      const rocks: Item[] = [];
      const beams: Item[] = [];
      const crystals: Item[] = [];
      const lavas: Item[] = [];
      course.hazards.forEach((h, i) => {
         const l = course.lanes[h.lane];
         if (h.kind === "rock") rocks.push(itemAt(course, h.s, l.d, l.y - 0.1, { x: 1.4 / GLB_SIZE.rock.x, y: 0.8 / GLB_SIZE.rock.y, z: 1.2 / GLB_SIZE.rock.z }, false, i, 0.4));
         else if (h.kind === "beam") beams.push(itemAt(course, h.s, 0, 1.55, { x: 15 / GLB_SIZE.arch.x, y: 1.6 / GLB_SIZE.arch.y, z: 1.4 / GLB_SIZE.arch.z }, false, i, Math.PI / 2));
         else if (h.kind === "crystal") crystals.push(itemAt(course, h.s, l.d, 0, { x: 1.6 / GLB_SIZE.crystal.x, y: 2.6 / GLB_SIZE.crystal.y, z: 1.6 / GLB_SIZE.crystal.z }, false, i));
         else if (h.kind === "lavafall") lavas.push(itemAt(course, h.s + h.len / 2, l.d, 6.2, { x: 2.6 / GLB_SIZE.lavafall.x, y: 2 / GLB_SIZE.lavafall.y, z: 2.6 / GLB_SIZE.lavafall.z }, false, i));
      });
      return { rocks, beams, crystals, lavas };
   }, [course]);
}

/** The lava streams (code: animated emissive columns) under the lavafalls while they pour; a flicker before. */
function LavaStreams({ run, clock }: { run: CaveRun; clock: VisualClock }) {
   const lavas = useMemo(() => run.course.hazards.map((h, i) => ({ h, i })).filter((x) => x.h.kind === "lavafall"), [run.course]);
   const time = useGameTime();
   const update = (k: number, m: Matrix4, color: Color) => {
      const { h } = lavas[k];
      if (Math.abs(h.s - run.cart.s) > 160) return false;
      const ms = Math.max(0, clock.ms);
      const on = lavaOn(h, ms);
      const soon = !on && lavaOn(h, ms + 500);
      if (!on && !soon) return false;
      const l = run.course.lanes[h.lane];
      lanePoint(run.course, h.s + h.len / 2, l.d, l.y, P);
      const w = on ? 1.3 + Math.sin(time.now * 20 + k) * 0.08 : 0.3;
      m.compose(V.set(P.x, P.y + 3.1, P.z), Q.identity(), S.set(w, 6.2, w));
      color.set(on ? COLORS.lava : "#fbbf24");
   };
   if (lavas.length === 0) return null;
   return (
      <DynamicInstanced count={lavas.length} update={update} name="lava" tinted>
         <cylinderGeometry args={[0.5, 0.7, 1, 12, 1, true]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} side={DoubleSide} />
      </DynamicInstanced>
   );
}

/** The red shadow a crystal casts on its lane before it falls (the card's telegraph), and the ember pits. */
function Marks({ run, pits }: { run: CaveRun; pits: readonly Item[] }) {
   const crystals = useMemo(() => run.course.hazards.filter((h) => h.kind === "crystal"), [run.course]);
   const time = useGameTime();
   const shadow = (k: number, m: Matrix4) => {
      const h = crystals[k];
      const d = h.s - run.cart.s;
      if (d < -2 || d > 70) return false;
      const l = run.course.lanes[h.lane];
      lanePoint(run.course, h.s, l.d, l.y + 0.06, P);
      const pulse = 1 + Math.sin(time.now * 9) * 0.1;
      E.set(-Math.PI / 2, 0, 0);
      Q.setFromEuler(E);
      m.compose(V.set(P.x, P.y, P.z), Q, S.set(1.4 * pulse, 1.4 * pulse, 1));
   };
   const pit = (k: number, m: Matrix4) => {
      const it = pits[k];
      if (Math.abs(it.s - run.cart.s) > 170) return false;
      E.set(-Math.PI / 2, 0, it.rotY);
      Q.setFromEuler(E);
      m.compose(V.set(it.x, it.y, it.z), Q, S.set(2.2, 6, 1));
   };
   return (
      <>
         {crystals.length > 0 ? (
            <DynamicInstanced count={crystals.length} update={shadow} name="crystal-shadows">
               <circleGeometry args={[1, 24]} />
               <meshBasicMaterial color={COLORS.danger} transparent opacity={0.45} depthWrite={false} toneMapped={false} />
            </DynamicInstanced>
         ) : null}
         {pits.length > 0 ? (
            <DynamicInstanced count={pits.length} update={pit} name="pits">
               <planeGeometry args={[1, 1]} />
               <meshBasicMaterial color="#ff5a14" transparent opacity={0.75} toneMapped={false} />
            </DynamicInstanced>
         ) : null}
      </>
   );
}

/** The orbs (shared scoreOrb) with a halo tinted by who they belong to; collected ones gone. */
function Orbs({ run }: { run: CaveRun }) {
   const c = run.course;
   const items = useMemo(() => {
      const out: Item[] = c.orbs.map((o, i) => {
         const l = c.lanes[o.lane];
         return itemAt(c, o.s, l.d + o.dx, l.y + o.h, { x: 1, y: 1, z: 1 }, false, i);
      });
      return out.sort((a, b) => a.s - b.s);
   }, [c]);
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const start = useRef(0);
   const orb = (i: number, m: Matrix4) => {
      if (i === 0) start.current = lowerBound(items, run.cart.s - 10);
      const it = items[start.current + i];
      if (!it || it.s > run.cart.s + 160 || run.collected[it.ref]) return false;
      E.set(0, time.now * 2.2 + it.ref, 0);
      Q.setFromEuler(E);
      m.compose(V.set(it.x, it.y - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + it.ref) * 0.1, it.z), Q, S.set(k, k, k));
   };
   const start2 = useRef(0);
   const halo = (i: number, m: Matrix4, color: Color) => {
      if (i === 0) start2.current = lowerBound(items, run.cart.s - 10);
      const it = items[start2.current + i];
      if (!it || it.s > run.cart.s + 160 || run.collected[it.ref]) return false;
      const sz = ORB_SIZE * (2.3 + Math.sin(time.now * 3 + it.ref) * 0.2);
      m.compose(V.set(it.x, it.y + Math.sin(time.now * 2 + it.ref) * 0.1, it.z), camera.quaternion, S.set(sz, sz, sz));
      const b = c.orbs[it.ref].bonus;
      color.set(b === "vexa" ? "#c4b5fd" : b === "kiro" ? "#86efac" : b === "riko" ? "#fca5a5" : b === "zuno" ? "#fde68a" : b === "nami" ? "#93c5fd" : COLORS.orb);
   };
   const plane = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(() => () => plane.dispose(), [plane]);
   const glow = useCanvasTexture(64, 64, drawGlow);
   const N = Math.min(40, items.length);
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.orb} count={N} update={orb} name="orbs" />
         <DynamicInstanced count={N} update={halo} name="orb-halos" tinted>
            <primitive object={plane} attach="geometry" />
            <meshBasicMaterial color="#ffffff" map={glow} transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** Riko's cracked barricades: a rock wall across the shortcut's mouth with glowing cracks, gone once broken. */
function Barricades({ run }: { run: CaveRun }) {
   const c = run.course;
   const items = useMemo(() => c.barricades.map((b, i) => itemAt(c, b.s, c.lanes[b.lane].d, -0.2, { x: 2.8 / GLB_SIZE.wall.x, y: 2.4 / GLB_SIZE.wall.y, z: 1.2 / GLB_SIZE.wall.z }, false, i, Math.PI / 2)), [c]);
   const update = (i: number, m: Matrix4, color: Color) => {
      const it = items[i];
      if (run.broken[it.ref] || Math.abs(it.s - run.cart.s) > 170) return false;
      E.set(0, it.rotY, 0);
      Q.setFromEuler(E);
      m.compose(V.set(it.x, it.y, it.z), Q, S.set(it.sx, it.sy, it.sz));
      color.set("#ffb38a");
   };
   if (items.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.wall} count={items.length} update={update} name="barricades" tinted />;
}

/** The secrets: a glowing crystal (shard) or a round badge (sticker), hidden once found. */
function Secrets({ run }: { run: CaveRun }) {
   const list = SECRETS[run.level];
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   const spots = useMemo(() => run.course.secrets.map((sp) => lanePoint(run.course, sp.s, run.course.lanes[sp.lane].d, run.course.lanes[sp.lane].y + sp.h, { x: 0, y: 0, z: 0, h: 0 })), [run.course]);
   useFrame(() => {
      list.forEach((_s, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6 + i;
         m.position.y = spots[i].y + Math.sin(time.now * 2 + i) * 0.12;
      });
   });
   return (
      <>
         {list.map((s, i) => (
            <mesh key={s.id} ref={(m) => { refs.current[i] = m; }} position={[spots[i].x, spots[i].y, spots[i].z]}>
               {s.kind === "shard" ? <octahedronGeometry args={[0.36, 0]} /> : <cylinderGeometry args={[0.38, 0.38, 0.06, 20]} />}
               <meshStandardMaterial color={s.kind === "shard" ? "#fecaca" : "#f9a8d4"} emissive={s.kind === "shard" ? COLORS.ember : "#f472b6"} emissiveIntensity={1.2} roughness={0.3} />
            </mesh>
         ))}
      </>
   );
}

/** The hoard (level 1's beat 3, the patrol bots that stole the egg beside it) and the skull gate at the exit. */
function Landmarks({ run }: { run: CaveRun }) {
   const c = run.course;
   const hoard = useMemo(() => (c.hoardS > 0 ? lanePoint(c, c.hoardS, -6.8, -0.3, { x: 0, y: 0, z: 0, h: 0 }) : null), [c]);
   const gate = useMemo(() => lanePoint(c, c.finishS + 4, 0, -0.3, { x: 0, y: 0, z: 0, h: 0 }), [c]);
   const gk = 11 / GLB_SIZE.gate.y;
   const hk = 5 / GLB_SIZE.hoard.x;
   const bk = 1.6 / GLB_SIZE.bot.y;
   const glow = useCanvasTexture(64, 64, drawGlow);
   return (
      <>
         {hoard ? (
            <group position={[hoard.x, hoard.y, hoard.z]} rotation-y={hoard.h}>
               <group scale={hk}>
                  <Model asset={ASSETS.hoard} />
               </group>
               {[-2.6, 2.6].map((dz, i) => (
                  <group key={i} position={[2.6, 0, dz]} rotation-y={-Math.PI / 2} scale={bk}>
                     <Model asset={ASSETS.bot} />
                  </group>
               ))}
            </group>
         ) : null}
         <group position={[gate.x, gate.y, gate.z]} rotation-y={gate.h} scale={gk}>
            <Model asset={ASSETS.gate} />
         </group>
         <mesh position={[gate.x, gate.y + 4.2, gate.z]} rotation-y={gate.h}>
            <planeGeometry args={[9, 9]} />
            <meshBasicMaterial color="#ffd8a8" map={glow} transparent opacity={0.8} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} depthWrite={false} />
         </mesh>
      </>
   );
}

/** Level 5: the trigger plates, the ore ramps and the collar locks on the loop (the current phase's glow), and the fireballs. */
function BossTrack({ run, clock }: { run: CaveRun; clock: VisualClock }) {
   const c = run.course;
   const time = useGameTime();
   const ev = c.bossEvents;
   const update = (k: number, m: Matrix4, color: Color) => {
      const e = ev[k];
      const b = run.boss;
      if (!b || bossDone(run)) return false;
      const live = e.phase === b.phase && run.eventLap[k] !== run.lap;
      const l = c.lanes[e.lane];
      lanePoint(c, e.s, l.d, l.y, P);
      if (e.kind === "lock") {
         E.set(0, P.h, 0);
         Q.setFromEuler(E);
         const s = live ? 1 + Math.sin(time.now * 6 + k) * 0.06 : 0.7;
         m.compose(V.set(P.x, P.y + 2.8, P.z), Q, S.set(s * 1.6, s * 1.6, s * 1.6));
         color.set(live ? "#c4b5fd" : "#3f3f46");
      } else if (e.kind === "plate") {
         E.set(-Math.PI / 2, 0, 0);
         Q.setFromEuler(E);
         m.compose(V.set(P.x, P.y + 0.08, P.z), Q, S.set(1.2, 1.2, 0.2));
         color.set(live ? "#fde047" : "#57534e");
      } else {
         E.set(-0.4, P.h, 0);
         Q.setFromEuler(E);
         m.compose(V.set(P.x, P.y + 0.4, P.z), Q, S.set(1.6, 0.25, 2.4));
         color.set(live ? COLORS.ember : "#57534e");
      }
      void clock;
   };
   const fire = (k: number, m: Matrix4) => {
      if (run.fireballsUntil <= run.ms) return false;
      const left = (run.fireballsUntil - run.ms) / 1800;
      const s = run.cart.s + 6 + left * 40 + k * 7;
      lanePoint(c, s, 0, 1.0 + Math.sin(time.now * 8 + k) * 0.2, P);
      m.compose(V.set(P.x, P.y, P.z), Q.identity(), S.set(0.8, 0.8, 0.8));
   };
   if (!c.loop) return null;
   return (
      <>
         <DynamicInstanced count={ev.length} update={update} name="boss-track" tinted>
            <torusGeometry args={[0.8, 0.12, 8, 24]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={3} update={fire} name="fireballs">
            <sphereGeometry args={[0.6, 12, 10]} />
            <meshBasicMaterial color="#ff7a1a" toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

export function Course({ run, clock }: { run: CaveRun; clock: VisualClock; won?: MutableRefObject<boolean> }) {
   const c = run.course;
   const rails = useRails(c);
   const decor = useDecor(c);
   const hz = useHazards(c);
   const time = useGameTime();
   const crystalPose = (it: Item, out: { y: number; rotY: number; s: number }) => {
      // hangs from the roof until the cart is 45 m away, then falls onto its lane
      const d = it.s - run.cart.s;
      const fall = Math.max(0, Math.min(1, (45 - d) / 12));
      out.y = it.y + 7.2 * (1 - fall * fall);
      out.rotY += fall * 0.4;
   };
   const batItems = useMemo(() => {
      const out: Item[] = [];
      if (c.level < 2 || c.config.boss) return out;
      for (let s = 60; s < c.length; s += 70) out.push(itemAt(c, s, 0, 5.5, { x: 0.9 / GLB_SIZE.bat.x, y: 0.9 / GLB_SIZE.bat.x, z: 0.9 / GLB_SIZE.bat.x }, false, out.length));
      return out;
   }, [c]);
   const batPose = (it: Item, out: { y: number; rotY: number; s: number }) => {
      out.y = it.y + Math.sin(time.now * 3 + it.ref) * 0.6;
      out.rotY += Math.sin(time.now * 1.3 + it.ref) * 0.8;
   };
   return (
      <>
         <Cave course={c} />
         <WindowPool asset={ASSETS.track} items={rails.rails} run={run} count={130} name="rails" tinted />
         <WindowPool asset={ASSETS.scaffold} items={rails.legs} run={run} count={12} name="scaffold" />
         <Marks run={run} pits={rails.pits} />
         <WindowPool asset={ASSETS.cluster} items={decor.clusters} run={run} count={14} name="clusters" />
         <WindowPool asset={ASSETS.stalagmites} items={decor.stal} run={run} count={12} name="stalagmites" />
         <WindowPool asset={ASSETS.mushrooms} items={decor.shrooms} run={run} count={c.config.dark ? 18 : 8} name="mushrooms" />
         <WindowPool asset={ASSETS.rock} items={decor.rocks} run={run} count={6} name="rocks" />
         <WindowPool asset={ASSETS.lantern} items={decor.lanterns} run={run} count={8} name="lanterns" />
         <WindowPool asset={ASSETS.rock} items={hz.rocks} run={run} count={4} name="hazard-rocks" />
         <WindowPool asset={ASSETS.arch} items={hz.beams} run={run} count={3} name="beams" />
         <WindowPool asset={ASSETS.crystal} items={hz.crystals} run={run} count={4} pose={crystalPose} name="crystals" />
         <WindowPool asset={ASSETS.lavafall} items={hz.lavas} run={run} count={4} name="lavafalls" />
         <WindowPool asset={ASSETS.bat} items={batItems} run={run} count={3} pose={batPose} name="bats" />
         <LavaStreams run={run} clock={clock} />
         <Barricades run={run} />
         <Orbs run={run} />
         <Secrets run={run} />
         <Landmarks run={run} />
         <BossTrack run={run} clock={clock} />
      </>
   );
}

