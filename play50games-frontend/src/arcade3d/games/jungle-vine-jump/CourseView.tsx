"use client";

// Jungle Vine Jump's climb, drawn from the run (rules.ts / course.ts): branch slabs and broad leaves
// for the platforms (bobbing on level 2), every vine as a leafy top (m2JungleVine, the dry m2JungleVineV2)
// with the rope drawn as a chain of instanced segments that follows the swing (the card's fix for a
// stretched mesh), the stone arches of level 4, the orbs, the emeralds, the snapper plants, the fruit
// monkeys and their pods, the ghost-root wall round Vexa's hollow and, on levels 1-2, the dotted
// release arc. Everything is instanced (about twenty draw calls).
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending, CylinderGeometry, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Object3D, SphereGeometry,
   type Matrix4,
} from "three";
import { DynamicInstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { DynamicInstanced, type InstancePart } from "@/arcade3d/core/render";
import { snapPhase, padY, type Pad, type Vine } from "./course";
import { ARCH_W, ASSETS, EMERALD_W, GLB_SIZE, KING_H, MONKEY_H, ORB_SIZE, POD_H, SNAPPER_H, VINE_TOP, branchScale, leafScale } from "./assets";
import { COLORS } from "./look";
import { GLOW_GRIP, GRAV, GRIP_MAX, HANG, anchorOf, heroPhasing, kingPos, monkeyWarning, vineDown, type VineRun } from "./rules";

const DUMMY = new Object3D();
const A = { x: 0, y: 0, z: 0 };
const K = { x: 0, y: 0, z: 0 };
/** a vine's rope: this many segments over its full length */
const SEG = 9;
const ROPE_LEN = GRIP_MAX + 0.4;

/** Writes a matrix: position, Euler (YXZ), per-axis scale. */
function place(m: Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0, rotX = 0, rotZ = 0): void {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rotX, rotY, rotZ, "YXZ");
   DUMMY.scale.set(sx, sy, sz);
   DUMMY.updateMatrix();
   m.copy(DUMMY.matrix);
}

const isLeaf = (p: Pad) => p.kind === "leaf" || p.kind === "net" || p.kind === "canopy" || p.kind === "hollow";

/** The platforms: branch slabs (start, branches, stairs, the arena and the goal) and broad leaves. */
function Pads({ run }: { run: VineRun }) {
   const branches = useMemo(() => run.course.pads.filter((p) => !isLeaf(p)), [run]);
   const leaves = useMemo(() => run.course.pads.filter(isLeaf), [run]);
   const branch = (i: number, m: Matrix4) => {
      const p = branches[i];
      const s = branchScale(p.r);
      // a slab across the route, its top on the pad, turned so its length runs round the trunk
      place(m, p.x, padY(p, run.simMs) - GLB_SIZE.branch.y * s * 0.9, p.z, s, s * 0.9, s, Math.atan2(p.x, p.z) + Math.PI / 2);
   };
   const leaf = (i: number, m: Matrix4) => {
      const p = leaves[i];
      const s = leafScale(p.r);
      place(m, p.x, padY(p, run.simMs) - GLB_SIZE.leaf.y * s * 0.8, p.z, s * 1.35, s * 0.8, s, Math.atan2(p.x, p.z) + i * 0.4);
   };
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.branch} count={branches.length} update={branch} name="branches" />
         <DynamicInstancedModel asset={ASSETS.leaf} count={leaves.length} update={leaf} name="leaves" />
      </>
   );
}

/** The angle a vine's rope hangs at this frame: along the hero's swing, the King's (phase 3), else a gentle sway. */
function ropeAngle(run: VineRun, v: Vine, now: number): number {
   const h = run.hero;
   if (h.vine === v.id) return h.theta;
   const a = run.course.arena;
   if (a && v.id === a.kingVine && run.bossActive && run.boss && run.boss.phase === 2) return run.kingTheta;
   return 0.06 * Math.sin(now * 0.9 + v.id * 1.7);
}

/** The ropes: SEG segments a vine, live green or dry brown; a snapped vine is a short stub. */
function Ropes({ run, dry }: { run: VineRun; dry: boolean }) {
   const vines = useMemo(() => run.course.vines.filter((v) => (v.kind === "dry") === dry), [run, dry]);
   const time = useGameTime();
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new CylinderGeometry(0.06, 0.075, 1, 6), material: new MeshStandardMaterial({ color: dry ? COLORS.dry : COLORS.vine, roughness: 0.85 }) }], [dry]);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshStandardMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      const v = vines[Math.floor(i / SEG)];
      const k = i % SEG;
      const down = vineDown(run, v.id);
      const len = down ? 1 : ROPE_LEN;
      const seg = len / SEG;
      anchorOf(run, v, A);
      const theta = ropeAngle(run, v, time.now);
      // a little curl at the tail
      const curl = theta + 0.04 * k * Math.sin(time.now * 1.3 + v.id);
      const mid = (k + 0.5) * seg;
      const s = Math.sin(curl);
      const c = Math.cos(curl);
      place(m, A.x + v.dx * s * mid, A.y - c * mid, A.z + v.dz * s * mid, 1, seg * 1.04, 1, Math.atan2(v.dx, v.dz), curl);
   };
   return vines.length > 0 ? <DynamicInstanced count={vines.length * SEG} update={update} parts={parts} name={dry ? "dry-ropes" : "ropes"} /> : null;
}

/** The vines' leafy tops at the anchors (the dry ones brown and sparse), the arches of level 4 over theirs. */
function VineTops({ run }: { run: VineRun }) {
   const live = useMemo(() => run.course.vines.filter((v) => v.kind !== "dry"), [run]);
   const dry = useMemo(() => run.course.vines.filter((v) => v.kind === "dry"), [run]);
   const arches = useMemo(() => run.course.vines.filter((v) => v.kind === "arch"), [run]);
   const k = VINE_TOP / GLB_SIZE.vine.y;
   const kd = VINE_TOP / GLB_SIZE.dryVine.y;
   const ka = ARCH_W / GLB_SIZE.arch.x;
   const top = (list: Vine[], scale: number, h: number) => (i: number, m: Matrix4) => {
      const v = list[i];
      anchorOf(run, v, A);
      place(m, A.x, A.y - h * scale * 0.55, A.z, scale, scale, scale, Math.atan2(v.dx, v.dz) + i);
   };
   const arch = (i: number, m: Matrix4) => {
      const v = arches[i];
      anchorOf(run, v, A);
      const tilt = (run.lean[v.id] ?? 0) * 0.25;
      place(m, A.x, A.y - 0.2, A.z, ka, ka, ka, Math.atan2(v.dz, -v.dx), 0, tilt);
   };
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.vine} count={live.length} update={top(live, k, GLB_SIZE.vine.y)} name="vine-tops" />
         {dry.length > 0 ? <DynamicInstancedModel asset={ASSETS.dryVine} count={dry.length} update={top(dry, kd, GLB_SIZE.dryVine.y)} name="dry-tops" /> : null}
         {arches.length > 0 ? <DynamicInstancedModel asset={ASSETS.arch} count={arches.length} update={arch} name="arches" /> : null}
      </>
   );
}

/** The hidden emerald vine: glows up as the hero hangs low on it (and once found). */
function GlowVine({ run }: { run: VineRun }) {
   const id = run.course.glow;
   const time = useGameTime();
   const geo = useMemo(() => new SphereGeometry(1, 14, 10), []);
   const mat = useMemo(() => new MeshBasicMaterial({ color: COLORS.glow, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, toneMapped: false }), []);
   useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
   const parts = useMemo<InstancePart[]>(() => [{ geometry: geo, material: mat }], [geo, mat]);
   const update = (i: number, m: Matrix4) => {
      if (id < 0) return false;
      const h = run.hero;
      const on = h.vine === id ? Math.max(0, (h.grip - 4.5) / (GLOW_GRIP - 4.5)) : run.secrets.found[2] ? 0.5 : 0;
      if (on <= 0.02) return false;
      const v = run.course.vines[id];
      anchorOf(run, v, A);
      const r = (0.12 + 0.18 * on) * (1 + 0.15 * Math.sin(time.now * 6 + i));
      const d = ((i + 0.5) / 7) * ROPE_LEN;
      const th = h.vine === id ? h.theta : 0;
      place(m, A.x + v.dx * Math.sin(th) * d, A.y - Math.cos(th) * d, A.z + v.dz * Math.sin(th) * d, r, r, r);
   };
   useFrame(() => {
      mat.opacity = 0.8;
   });
   return id >= 0 ? <DynamicInstanced count={7} update={update} parts={parts} name="glow-vine" /> : null;
}

/** The colour orbs: the shared scoreOrb, bobbing; gone once taken. */
function Orbs({ run }: { run: VineRun }) {
   const time = useGameTime();
   const update = (i: number, m: Matrix4) => {
      if (run.orbTaken[i]) return false;
      const o = run.course.orbs[i];
      const s = ORB_SIZE / GLB_SIZE.orb.y;
      place(m, o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i * 0.9) * 0.08, o.z, s, s, s, time.now * 2 + i);
   };
   return <DynamicInstancedModel asset={ASSETS.orb} count={run.course.orbs.length} update={update} name="orbs" />;
}

/** The emeralds: spinning green gems (Zuno's magnet pulls them). */
function Emeralds({ run }: { run: VineRun }) {
   const time = useGameTime();
   const k = EMERALD_W / GLB_SIZE.emerald.x;
   const update = (i: number, m: Matrix4) => {
      if (run.emeraldTaken[i]) return false;
      const e = run.course.emeralds[i];
      place(m, e.x, e.y - 0.15 + Math.sin(time.now * 2.4 + i) * 0.06, e.z, k, k, k, time.now * 1.8 + i);
   };
   return <DynamicInstancedModel asset={ASSETS.emerald} count={run.course.emeralds.length} update={update} name="emeralds" />;
}

/** Snapper plants (L3, L5): rise as they warn, lunge on the bite. */
function Snappers({ run }: { run: VineRun }) {
   const k = SNAPPER_H / GLB_SIZE.snapper.y;
   const update = (i: number, m: Matrix4) => {
      const s = run.course.snappers[i];
      const ph = snapPhase(s, run.simMs);
      const grow = ph === "bite" ? 1.3 : ph === "warn" ? 1.12 : 1;
      const lean = ph === "bite" ? 0.5 : 0;
      place(m, s.x, s.y - 0.05, s.z, k * grow, k * grow, k * grow, Math.atan2(-s.x, -s.z), lean);
   };
   return run.course.snappers.length > 0 ? <DynamicInstancedModel asset={ASSETS.snapper} count={run.course.snappers.length} update={update} name="snappers" /> : null;
}

/** The fruit monkeys (L4, L5) on their perches: they face the hero and hop up as they wind up a throw. */
function Monkeys({ run }: { run: VineRun }) {
   const k = MONKEY_H / GLB_SIZE.monkey.y;
   const update = (i: number, m: Matrix4) => {
      const mk = run.course.monkeys[i];
      const warn = monkeyWarning(mk.phase, run.simMs);
      const hop = warn ? 0.15 + 0.1 * Math.sin(run.simMs / 60) : 0;
      place(m, mk.x, mk.y + hop, mk.z, k, k, k, Math.atan2(run.hero.x - mk.x, run.hero.z - mk.z));
   };
   return run.course.monkeys.length > 0 ? <DynamicInstancedModel asset={ASSETS.monkey} count={run.course.monkeys.length} update={update} name="monkeys" /> : null;
}

/** The monkeys' perches: a little leafy branch stub under each. */
function Perches({ run }: { run: VineRun }) {
   const k = 1.2 / GLB_SIZE.stub.x;
   const update = (i: number, m: Matrix4) => {
      const mk = run.course.monkeys[i];
      place(m, mk.x, mk.y - GLB_SIZE.stub.y * k * 0.55, mk.z, k, k * 0.55, k, i);
   };
   return run.course.monkeys.length > 0 ? <DynamicInstancedModel asset={ASSETS.stub} count={run.course.monkeys.length} update={update} name="perches" /> : null;
}

/** Fruit pods in flight (monkeys and the King's volleys). */
function Pods({ run }: { run: VineRun }) {
   const time = useGameTime();
   const k = POD_H / GLB_SIZE.pod.y;
   const update = (i: number, m: Matrix4) => {
      const p = run.pods[i];
      if (!p || !p.live) return false;
      place(m, p.x, p.y - POD_H / 2, p.z, k, k, k, time.now * 9 + i, time.now * 7);
   };
   return <DynamicInstancedModel asset={ASSETS.pod} count={12} update={update} name="pods" />;
}

/** The ghost-root wall round Vexa's trunk hollow: a shimmering violet curtain, faint while she phases. */
function GhostWall({ run }: { run: VineRun }) {
   const g = run.course.ghost;
   const time = useGameTime();
   const geo = useMemo(() => new CylinderGeometry(g.r, g.r, g.y1 - g.y0, 24, 1, true), [g]);
   const mat = useMemo(() => new MeshBasicMaterial({ color: COLORS.ghost, transparent: true, opacity: 0.2, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }), []);
   useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
   useFrame(() => {
      mat.opacity = heroPhasing(run) ? 0.05 : 0.16 + 0.06 * Math.sin(time.now * 2.4);
   });
   return <mesh geometry={geo} material={mat} position={[g.x, (g.y0 + g.y1) / 2, g.z]} />;
}

/** Levels 1-2: the dotted release arc from the hands, while hanging (removed from level 3 on, the card). */
function ReleaseArc({ run }: { run: VineRun }) {
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(0.07, 8, 6), material: new MeshBasicMaterial({ color: COLORS.arc, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshBasicMaterial).dispose(); }), [parts]);
   const update = (i: number, m: Matrix4) => {
      const h = run.hero;
      if (h.vine < 0) return false;
      const t = (i + 1) * 0.07;
      const x = h.x + h.vx * t;
      const y = h.y + HANG + h.vy * t - 0.5 * GRAV * t * t;
      const z = h.z + h.vz * t;
      const r = 1 - i / 22;
      place(m, x, y, z, r, r, r);
   };
   return run.course.cfg.arcPreview ? <DynamicInstanced count={18} update={update} parts={parts} name="release-arc" /> : null;
}

/** The Howler King's own vine (level 5, phase 3): drawn by Ropes as a "boss" vine; this adds his grip. */
function KingGrip({ run }: { run: VineRun }) {
   const parts = useMemo<InstancePart[]>(() => [{ geometry: new SphereGeometry(0.12, 8, 6), material: new MeshStandardMaterial({ color: COLORS.vineDark }) }], []);
   useEffect(() => () => parts.forEach((p) => { p.geometry.dispose(); (p.material as MeshStandardMaterial).dispose(); }), [parts]);
   const update = (_i: number, m: Matrix4) => {
      const b = run.boss;
      if (!b || !run.bossActive || b.phase !== 2) return false;
      kingPos(run, K);
      place(m, K.x, K.y + KING_H * 0.85, K.z, 1, 1, 1);
   };
   return run.course.arena ? <DynamicInstanced count={1} update={update} parts={parts} name="king-grip" /> : null;
}

export function Course({ run }: { run: VineRun }) {
   return (
      <>
         <Pads run={run} />
         <Ropes run={run} dry={false} />
         <Ropes run={run} dry />
         <VineTops run={run} />
         <GlowVine run={run} />
         <Orbs run={run} />
         <Emeralds run={run} />
         <Snappers run={run} />
         <Perches run={run} />
         <Monkeys run={run} />
         <Pods run={run} />
         <GhostWall run={run} />
         <ReleaseArc run={run} />
         <KingGrip run={run} />
      </>
   );
}

