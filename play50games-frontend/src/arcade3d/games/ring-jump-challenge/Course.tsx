"use client";

// The playable canyon, drawn from the rules (rules.ts / canyon.ts): every ring is m2NeutralRing laid
// flat with its opening on the rules' radius (one tinted pool: white rings, orange speed rings,
// violet bonus rings in Vexa's shaft; a threaded ring pops and goes, a missed one greys, level 1's
// trio shrinks shut), the gold ring (the same GLB in gold), the colour orbs (m2NeutralStar, spinning;
// Zuno's wall orbs only glint until his magnet is up), the depth aids the card asks for (the next ring's
// glowing outline, a drop line from the hero and the mark where it will cross), updraft geysers
// (m2SpringPad on its rock shelf, rising streaks), the stone ledges, blade gates (arms in code,
// spikedBall on the ends), Kiro's storm pockets, Riko's cracked seals and Vexa's ghost panels over the
// pockets, the secret pickups, and on level 5 the wake rings (m2WindRing) and the lightning lanes.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   AdditiveBlending,
   Color,
   CylinderGeometry,
   DoubleSide,
   Euler,
   type InstancedMesh,
   Matrix4,
   type Mesh,
   type MeshBasicMaterial,
   type MeshStandardMaterial,
   Object3D,
   Quaternion,
   Vector3,
} from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { ASSETS, GLB_SIZE, ORB_SIZE, RING_FLAT, RING_INNER, WIND_INNER } from "./assets";
import { COLORS, glowTexture, ringTexture, streakTexture } from "./look";
import { SECRETS } from "./progression";
import { polarX, polarZ, shaftRadius } from "./canyon";
import { BLADE_BALL, LANE_HALF, WAKE, nextRing, predictCross, ringOpen, ringPos, type RingRun } from "./rules";

/** The visual clock (ms of rules time), written by the Scene every frame. */
export interface VisualClock {
   ms: number;
}

const POS = new Vector3();
const QUAT = new Quaternion();
const SCALE = new Vector3();
const EULER = new Euler();
const FLAT = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
const DUMMY = new Object3D();
const P2 = { x: 0, z: 0 };
const SPIN = new Quaternion();
const UP = new Vector3(0, 1, 0);
const WAKE_CENTRE = new Matrix4().makeTranslation(0, -GLB_SIZE.windRing.y * 0.5, 0);

const TINT = {
   ring: new Color(COLORS.ring),
   speed: new Color(COLORS.speed),
   bonus: new Color(COLORS.bonus),
   next: new Color(COLORS.ringNext),
   missed: new Color("#7c8794"),
   threaded: new Color("#fff7c2"),
   orb: new Color(COLORS.orb),
   hidden: new Color("#9a8f86"),
};

/** The rings (all but the gold one): a tinted pool of m2NeutralRing laid flat. */
function Rings({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const c = run.course;
   const seen = useMemo(() => new Float64Array(c.rings.length).fill(-1), [c]);
   const list = useMemo(() => c.rings.map((r, i) => i).filter((i) => c.rings[i].kind !== "gold"), [c]);
   const time = useGameTime();
   const next = useRef(-1);
   useFrame(() => {
      next.current = run.ended === null ? nextRing(run) : -1;
   }, -0.01);
   const update = useMemo(
      () => (k: number, m: Matrix4, color: Color) => {
         const i = list[k];
         if (i === undefined) return false;
         const r = c.rings[i];
         const ms = clock.ms < 0 ? 0 : clock.ms;
         // far above or far below the hero: not drawn
         const dy = r.y - run.hero.y;
         if (dy > 30 || dy < -120) return false;
         ringPos(r, ms, P2);
         let open = ringOpen(run, r, ms);
         let pop = 1;
         if (run.threaded[i] === 1) {
            if (seen[i] < 0) seen[i] = time.now;
            const t = time.now - seen[i];
            if (t > 0.45) return false;
            pop = 1 + t * 0.9;
            color.copy(TINT.threaded);
         } else if (run.missed[i] === 1) {
            color.copy(TINT.missed);
         } else if (i === next.current) {
            color.copy(TINT.next).lerp(TINT.ring, 0.35 + 0.35 * Math.sin(time.now * 6));
         } else {
            color.copy(r.kind === "speed" ? TINT.speed : r.kind === "bonus" ? TINT.bonus : TINT.ring);
         }
         if (open < 0.05) return false;
         open *= pop;
         const s = open / RING_INNER;
         const sy = s * RING_FLAT;
         POS.set(P2.x, r.y - GLB_SIZE.ring.y * 0.5 * sy, P2.z);
         QUAT.setFromEuler(EULER.set(0, (i * 0.7 + (r.kind === "speed" ? time.now * 2 : 0)) % (Math.PI * 2), 0));
         SCALE.set(s, sy, s);
         m.compose(POS, QUAT, SCALE);
      },
      [c, list, run, clock, seen, time],
   );
   return <DynamicInstancedModel asset={ASSETS.ring} count={list.length} update={update} tinted name="rings" />;
}

const GOLD_RING = { ...ASSETS.ring, id: "m2NeutralRingGold", material: "gold" as const };

/** The gold ring (the secret): the ring GLB in gold, turning slowly, gone once threaded. */
function GoldRing({ run }: { run: RingRun }) {
   const c = run.course;
   const idx = useMemo(() => c.rings.findIndex((r) => r.kind === "gold"), [c]);
   const time = useGameTime();
   const update = useMemo(
      () => (_k: number, m: Matrix4) => {
         if (idx < 0 || run.threaded[idx] === 1) return false;
         const r = c.rings[idx];
         const s = r.r / RING_INNER;
         const sy = s * RING_FLAT;
         POS.set(r.x, r.y - GLB_SIZE.ring.y * 0.5 * sy + Math.sin(time.now * 1.5) * 0.15, r.z);
         QUAT.setFromEuler(EULER.set(0, time.now * 0.6, 0));
         SCALE.set(s, sy, s);
         m.compose(POS, QUAT, SCALE);
      },
      [c, idx, run, time],
   );
   if (idx < 0) return null;
   return <DynamicInstancedModel asset={GOLD_RING} count={1} update={update} name="goldRing" />;
}

/** The colour orbs (m2NeutralStar), spinning and bobbing; taken ones go; Zuno's wall orbs only glint. */
function Orbs({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const c = run.course;
   const time = useGameTime();
   const s = ORB_SIZE / GLB_SIZE.star.y;
   const update = useMemo(
      () => (i: number, m: Matrix4, color: Color) => {
         const o = c.orbs[i];
         if (!o || run.taken[i] === 1) return false;
         const dy = o.y - run.hero.y;
         if (dy > 30 || dy < -100) return false;
         const magnet = clock.ms < run.hero.magnetUntil;
         const hidden = o.gate === "zuno" && !magnet;
         color.copy(hidden ? TINT.hidden : TINT.orb);
         const k = hidden ? 0.55 : 1;
         POS.set(o.x, o.y - GLB_SIZE.star.y * 0.5 * s * k + Math.sin(time.now * 2.4 + i) * 0.12, o.z);
         QUAT.setFromEuler(EULER.set(0, time.now * 2.2 + i, 0));
         SCALE.setScalar(s * k);
         m.compose(POS, QUAT, SCALE);
      },
      [c, run, clock, time, s],
   );
   return <DynamicInstancedModel asset={ASSETS.star} count={c.orbs.length} update={update} tinted name="orbs" />;
}

/** One pool of additive glow billboards: the orbs' halo, the secrets' shine, the next ring's crossing mark. */
function Glows({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const ref = useRef<InstancedMesh>(null);
   const tex = useMemo(() => glowTexture(), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const c = run.course;
   const count = c.orbs.length + c.secrets.length + 4;
   const col = useMemo(() => new Color(), []);
   const time = useGameTime();
   useFrame((state) => {
      const m = ref.current;
      if (!m) return;
      const camQ = state.camera.quaternion;
      let n = 0;
      const put = (x: number, y: number, z: number, size: number, color: string | Color) => {
         if (n >= count) return;
         DUMMY.position.set(x, y, z);
         DUMMY.quaternion.copy(camQ);
         DUMMY.scale.setScalar(size);
         DUMMY.updateMatrix();
         m.setMatrixAt(n, DUMMY.matrix);
         m.setColorAt(n, typeof color === "string" ? col.set(color) : color);
         n++;
      };
      const hy = run.hero.y;
      const magnet = clock.ms < run.hero.magnetUntil;
      for (let i = 0; i < c.orbs.length; i++) {
         const o = c.orbs[i];
         if (run.taken[i] === 1 || o.y - hy > 30 || o.y - hy < -100) continue;
         if (o.gate === "zuno" && !magnet) put(o.x, o.y, o.z, 1.1 + 0.4 * Math.sin(time.now * 3 + i), "#a8926a");
         else put(o.x, o.y, o.z, 2.2, "#ffd76a");
      }
      const list = SECRETS[run.level];
      for (let s = 0; s < c.secrets.length; s++) {
         const spot = c.secrets[s];
         if (spot.kind !== "pickup" || run.secrets.found[s]) continue;
         put(spot.x, spot.y, spot.z, 3 + 0.6 * Math.sin(time.now * 4), list[s]?.kind === "sticker" ? "#f9a8d4" : "#bae6fd");
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
   });
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={5}>
         <planeGeometry args={[1, 1]} />
         <meshBasicMaterial map={tex} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </instancedMesh>
   );
}

/**
 * The depth aids (the card's risk fix): the next ring's glowing outline, the drop line from the hero
 * down to its plane, and the mark where the hero would cross it now (green inside, amber outside).
 */
function Guide({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const outline = useRef<Mesh>(null);
   const mark = useRef<Mesh>(null);
   const line = useRef<Mesh>(null);
   const tex = useMemo(() => ringTexture(), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const time = useGameTime();
   const cross = useMemo(() => ({ x: 0, z: 0 }), []);
   const good = useMemo(() => new Color("#5bff9b"), []);
   const bad = useMemo(() => new Color("#ffb347"), []);
   useFrame(() => {
      const i = run.ended === null && run.hero.mode === "fall" ? nextRing(run) : -1;
      const show = i >= 0;
      for (const r of [outline, mark, line]) if (r.current) r.current.visible = show;
      if (!show) return;
      const ring = run.course.rings[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      ringPos(ring, ms, P2);
      const open = ringOpen(run, ring, ms);
      const h = run.hero;
      if (outline.current) {
         const k = open * 1.28 * (1 + 0.04 * Math.sin(time.now * 8));
         outline.current.position.set(P2.x, ring.y + 0.05, P2.z);
         outline.current.scale.set(k, k, k);
      }
      predictCross(run, ring.y, cross);
      const inside = Math.hypot(cross.x - P2.x, cross.z - P2.z) <= open * 0.92;
      if (mark.current) {
         mark.current.position.set(cross.x, ring.y + 0.1, cross.z);
         (mark.current.material as MeshBasicMaterial).color.copy(inside ? good : bad);
      }
      if (line.current) {
         const len = Math.max(0.1, h.y - ring.y);
         line.current.position.set(h.x, h.y - len / 2, h.z);
         line.current.scale.set(1, len, 1);
         (line.current.material as MeshBasicMaterial).color.copy(inside ? good : bad);
      }
   });
   return (
      <>
         <mesh ref={outline} rotation-x={-Math.PI / 2} renderOrder={6}>
            <planeGeometry args={[2, 2]} />
            <meshBasicMaterial map={tex} color={COLORS.ringNext} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
         <mesh ref={mark} rotation-x={-Math.PI / 2} renderOrder={6}>
            <circleGeometry args={[0.55, 20]} />
            <meshBasicMaterial transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={line} renderOrder={6}>
            <cylinderGeometry args={[0.035, 0.035, 1, 6, 1, true]} />
            <meshBasicMaterial transparent opacity={0.55} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}

/** The updraft geysers: the spring pad on its shelf and streaks rising in the column. */
function Updrafts({ run }: { run: RingRun }) {
   const c = run.course;
   const ref = useRef<InstancedMesh>(null);
   const tex = useMemo(() => streakTexture(), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const per = 22;
   const count = c.updrafts.length * per;
   const time = useGameTime();
   const pads = useMemo<InstanceSpot[]>(
      () =>
         c.ledges
            .filter((l) => l.geyser)
            .map((l) => {
               const rad = (l.inner + shaftRadius(c, l.y1)) / 2 - 0.4;
               const s = 3.4 / GLB_SIZE.spring.x;
               return { x: polarX(l.a, Math.max(l.inner + 1.4, rad - 3)), y: l.y1, z: polarZ(l.a, Math.max(l.inner + 1.4, rad - 3)), scale: s };
            }),
      [c],
   );
   useFrame((state) => {
      const m = ref.current;
      if (!m) return;
      const yaw = Math.atan2(state.camera.position.x - 0, state.camera.position.z - 0);
      for (let u = 0; u < c.updrafts.length; u++) {
         const d = c.updrafts[u];
         const h = d.y1 - d.y0;
         for (let k = 0; k < per; k++) {
            const i = u * per + k;
            const seed = ((i * 7919) % 997) / 997;
            const phase = (seed + time.now * (0.35 + seed * 0.2)) % 1;
            const a = seed * Math.PI * 2 + k;
            const rr = d.r * Math.sqrt(((k * 37) % 23) / 23);
            DUMMY.position.set(d.x + Math.cos(a) * rr, d.y0 + phase * h, d.z + Math.sin(a) * rr);
            DUMMY.rotation.set(0, yaw, 0);
            DUMMY.scale.set(0.16, 2.2 + seed * 2, 1);
            DUMMY.updateMatrix();
            m.setMatrixAt(i, DUMMY.matrix);
         }
      }
      m.instanceMatrix.needsUpdate = true;
   });
   if (c.updrafts.length === 0) return null;
   return (
      <>
         <InstancedModel asset={ASSETS.spring} spots={pads} fallback={null} />
         <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} renderOrder={4}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial map={tex} color={COLORS.updraft} transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} side={DoubleSide} />
         </instancedMesh>
      </>
   );
}

/** The stone ledges (Nami's nooks and the geysers' shelves): one instanced slab each, turned to its wall. */
function Ledges({ run }: { run: RingRun }) {
   const c = run.course;
   const ref = useRef<InstancedMesh>(null);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      c.ledges.forEach((l, i) => {
         const R = shaftRadius(c, l.y1) + 1.2;
         const mid = (l.inner + R) / 2;
         DUMMY.position.set(polarX(l.a, mid), (l.y0 + l.y1) / 2, polarZ(l.a, mid));
         DUMMY.rotation.set(0, -(l.a * Math.PI) / 180, 0);
         DUMMY.scale.set(R - l.inner, l.y1 - l.y0, l.half * 2);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   }, [c]);
   if (c.ledges.length === 0) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, c.ledges.length]} frustumCulled={false}>
         <boxGeometry args={[1, 1, 1]} />
         <meshStandardMaterial color="#b08c68" roughness={0.95} />
      </instancedMesh>
   );
}

/** Blade gates: the hub and arm in code (moving parts), a spikedBall on each end. */
function Blades({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const c = run.course;
   const arms = useRef<InstancedMesh>(null);
   const s = (BLADE_BALL * 2) / GLB_SIZE.spiked.x;
   const update = useMemo(
      () => (k: number, m: Matrix4) => {
         const b = c.blades[k >> 1];
         if (!b) return false;
         const ms = clock.ms < 0 ? 0 : clock.ms;
         const a = (b.omega * ms) / 1000 + b.phase + (k & 1) * Math.PI;
         POS.set(b.x + Math.cos(a) * b.arm, b.y - GLB_SIZE.spiked.y * 0.5 * s, b.z + Math.sin(a) * b.arm);
         QUAT.setFromEuler(EULER.set(0, -a * 2, 0));
         SCALE.setScalar(s);
         m.compose(POS, QUAT, SCALE);
      },
      [c, clock, s],
   );
   useFrame(() => {
      const m = arms.current;
      if (!m) return;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      c.blades.forEach((b, i) => {
         const a = (b.omega * ms) / 1000 + b.phase;
         DUMMY.position.set(b.x, b.y, b.z);
         DUMMY.rotation.set(0, -a, 0);
         DUMMY.scale.set(b.arm * 2, 0.35, 0.5);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   });
   if (c.blades.length === 0) return null;
   return (
      <>
         <instancedMesh ref={arms} args={[undefined, undefined, c.blades.length]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#5b6475" metalness={0.6} roughness={0.35} />
         </instancedMesh>
         <DynamicInstancedModel asset={ASSETS.spiked} count={c.blades.length * 2} update={update} name="blades" />
      </>
   );
}

/** Kiro's storm pockets: a violet whirl of shear (lightning flickers), calm while he shields. */
function Storms({ run }: { run: RingRun }) {
   const c = run.course;
   const refs = useRef<(Mesh | null)[]>([]);
   const tex = useMemo(() => streakTexture(), []);
   useEffect(() => () => tex.dispose(), [tex]);
   const time = useGameTime();
   useFrame(() => {
      refs.current.forEach((m, i) => {
         if (!m) return;
         m.rotation.y = time.now * (1.8 + i * 0.3);
         const flick = Math.sin(time.now * 23 + i * 5) > 0.93 ? 0.85 : 0.38;
         (m.material as MeshBasicMaterial).opacity = flick;
      });
   });
   return (
      <>
         {c.storms.map((s, i) => (
            <mesh
               key={i}
               ref={(m) => {
                  refs.current[i] = m;
               }}
               position={[s.x, (s.y0 + s.y1) / 2, s.z]}
               renderOrder={4}
            >
               <cylinderGeometry args={[s.r, s.r, s.y1 - s.y0, 24, 1, true]} />
               <meshBasicMaterial map={tex} color={COLORS.storm} transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} side={DoubleSide} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

function panelGeometry(R: number, a: number, half: number, h: number): CylinderGeometry {
   const g = new CylinderGeometry(R, R, h, 10, 1, true, ((90 - a - half) * Math.PI) / 180, (2 * half * Math.PI) / 180);
   return g;
}

/** Riko's cracked seals (stone, glowing cracks; gone once broken) and Vexa's ghost panels (violet, brighter while she phases). */
function Panels({ run, clock }: { run: RingRun; clock: VisualClock }) {
   const c = run.course;
   const panels = useMemo(
      () =>
         c.pockets
            .map((p, i) => ({ p, i }))
            .filter(({ p }) => p.kind !== "open")
            .map(({ p, i }) => {
               const R = shaftRadius(c, (p.y0 + p.y1) / 2) + 0.35;
               const half = (Math.asin(Math.min(0.99, (p.pr * 0.95) / R)) * 180) / Math.PI;
               return { i, kind: p.kind, geo: panelGeometry(R, p.a, half, p.y1 - p.y0), y: (p.y0 + p.y1) / 2 };
            }),
      [c],
   );
   useEffect(() => () => panels.forEach((p) => p.geo.dispose()), [panels]);
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      panels.forEach((p, k) => {
         const m = refs.current[k];
         if (!m) return;
         if (p.kind === "seal") {
            m.visible = run.broken[p.i] !== 1;
            (m.material as MeshStandardMaterial).emissiveIntensity = 0.35 + 0.25 * Math.sin(time.now * 2.5 + k);
         } else {
            const phasing = clock.ms < run.hero.phaseUntil;
            (m.material as MeshBasicMaterial).opacity = (phasing ? 0.18 : 0.42) + 0.08 * Math.sin(time.now * 3 + k);
         }
      });
   });
   return (
      <>
         {panels.map((p, k) =>
            p.kind === "seal" ? (
               <mesh key={k} ref={(m) => void (refs.current[k] = m)} geometry={p.geo} position={[0, p.y, 0]}>
                  <meshStandardMaterial color={COLORS.seal} emissive="#ff8a3d" emissiveIntensity={0.4} roughness={0.9} side={DoubleSide} />
               </mesh>
            ) : (
               <mesh key={k} ref={(m) => void (refs.current[k] = m)} geometry={p.geo} position={[0, p.y, 0]} renderOrder={4}>
                  <meshBasicMaterial color={COLORS.ghost} transparent opacity={0.4} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            ),
         )}
      </>
   );
}

/** The secret pickups (the inner shaft's sticker, level 4's seal shard): a turning badge or crystal. */
function SecretPickups({ run }: { run: RingRun }) {
   const c = run.course;
   const list = SECRETS[run.level];
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      c.secrets.forEach((spot, s) => {
         const m = refs.current[s];
         if (!m || spot.kind !== "pickup") return;
         m.visible = !run.secrets.found[s];
         m.rotation.y = time.now * 1.8 + s;
      });
   });
   return (
      <>
         {c.secrets.map((spot, s) =>
            spot.kind === "pickup" ? (
               <mesh key={s} ref={(m) => void (refs.current[s] = m)} position={[spot.x, spot.y, spot.z]}>
                  {list[s]?.kind === "shard" ? <octahedronGeometry args={[0.45, 0]} /> : <cylinderGeometry args={[0.5, 0.5, 0.08, 24]} />}
                  <meshStandardMaterial color={list[s]?.kind === "shard" ? "#bae6fd" : "#f9a8d4"} emissive={list[s]?.kind === "shard" ? "#7dd3fc" : "#f472b6"} emissiveIntensity={0.9} roughness={0.3} />
               </mesh>
            ) : null,
         )}
      </>
   );
}

/** Level 5's wake rings: m2WindRing laid flat where Cyclone Ray left them. */
function WakeRings({ run }: { run: RingRun }) {
   const time = useGameTime();
   const s = WAKE.r / WIND_INNER;
   const cyan = useMemo(() => new Color("#9ff3ff"), []);
   const gold = useMemo(() => new Color("#ffe58a"), []);
   const update = useMemo(
      () => (i: number, m: Matrix4, color: Color) => {
         const w = run.wake[i];
         if (!w || !w.alive) return false;
         color.copy(run.wakeChain >= 3 ? gold : cyan);
         POS.set(w.x, w.y, w.z);
         QUAT.copy(FLAT);
         QUAT.premultiply(SPIN.setFromAxisAngle(UP, time.now * 1.5 + i));
         SCALE.setScalar(s);
         // the hoop is centred on its own half height: shift it there before laying it flat
         m.compose(POS, QUAT, SCALE);
         m.multiply(WAKE_CENTRE);
      },
      [run, time, s, cyan, gold],
   );
   if (!run.course.boss) return null;
   return <DynamicInstancedModel asset={ASSETS.windRing} count={WAKE.slots} update={update} tinted name="wake" />;
}

/** Level 5's lightning lanes: three tall slabs through the axis, faint on the telegraph, white-hot on the strike. */
function Lanes({ run }: { run: RingRun }) {
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const b = run.boss;
      const on = !!b && b.phase === 1 && (b.step === "telegraph" || b.step === "attack");
      refs.current.forEach((m, k) => {
         if (!m) return;
         m.visible = on;
         if (!on || !b) return;
         const th = run.lanes[k];
         m.position.set(0, run.hero.y - 4, 0);
         m.rotation.set(0, -th, 0);
         const mat = m.material as MeshBasicMaterial;
         if (b.step === "telegraph") {
            mat.opacity = 0.12 + 0.12 * Math.abs(Math.sin(time.now * 14));
            m.scale.set(1, 1, 0.5);
         } else {
            mat.opacity = 0.75 + 0.25 * Math.sin(time.now * 60 + k);
            m.scale.set(1, 1, 1);
         }
      });
   });
   if (!run.course.boss) return null;
   const R = run.course.radius;
   return (
      <>
         {[0, 1, 2].map((k) => (
            <mesh key={k} ref={(m) => void (refs.current[k] = m)} visible={false} renderOrder={7}>
               <boxGeometry args={[R * 2, 34, LANE_HALF * 2]} />
               <meshBasicMaterial color={COLORS.lightning} transparent opacity={0.3} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

export function Course({ run, clock }: { run: RingRun; clock: VisualClock }) {
   return (
      <>
         <Rings run={run} clock={clock} />
         <GoldRing run={run} />
         <Orbs run={run} clock={clock} />
         <Glows run={run} clock={clock} />
         <Guide run={run} clock={clock} />
         <Updrafts run={run} />
         <Ledges run={run} />
         <Blades run={run} clock={clock} />
         <Storms run={run} />
         <Panels run={run} clock={clock} />
         <SecretPickups run={run} />
         <WakeRings run={run} />
         <Lanes run={run} />
      </>
   );
}
