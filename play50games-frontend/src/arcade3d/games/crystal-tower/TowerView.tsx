"use client";

// The tower, drawn from the run (rules.ts) every frame. The spire is code (set); every object a
// player reads is a Hyper3D mesh: the pads (m2CircularPlatform, tinted by kind, shaking as they
// crumble), the tier crystals (m2CrystalCluster tinted their colour: dim while dormant, bright while
// live, pulsing as the beacon shows their colour, bobbing on L4+, gone once the round is done),
// Prism Shade's five rim crystals (sliding to their new slots on a shuffle, grey in Blackout), the
// beacons (checkpointBeacon, their ring and show flash coloured by state), the summit crystal
// (m2IceCrystal), the dark crystal walls, the void gates (menu2/props ArchWall), the spark drones,
// the shard storms (m2HangingCrystal raining), the gems and the secrets. Remounted per level.
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Quaternion, Vector3, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstanced } from "@/arcade3d/core/render";
import { DynamicInstancedModel, Model } from "@/arcade3d/core/assets";
import { ArchWall } from "@/arcade3d/menu2/props";
import { PALETTE } from "./levels";
import { CORE_R, CRUMBLE_MS, SHOW_STEP_MS, STORM_ON, STORM_PERIOD, STORM_R, crystalAt, droneAt, padCenterAt, stormIn, stormOn, type Course } from "./tower";
import { ASSETS, CRYSTAL_W, GLB_SIZE, PAD_T } from "./assets";
import { COLORS, LOOKS } from "./look";
import { bossCrystalAt, padAvailable, type TowerRun } from "./rules";
import { PRISM, SECRETS } from "./progression";
import { beaconBlocksView } from "./camera";

const pos = new Vector3();
const quat = new Quaternion();
const scl = new Vector3();
const UP = new Vector3(0, 1, 0);
const m1 = new Matrix4();
const WHITE = new Color("#ffffff");
const GREY = new Color("#6b7280");
const DIM = new Color("#8b84a8");
const PAL = PALETTE.map((p) => new Color(p.hex));
const C_PAD = new Color(COLORS.pad);
const C_GLASS = new Color(COLORS.padGlass);
const C_CRUMBLE = new Color(COLORS.padCrumble);
const C_ARENA = new Color("#4c1d95");
const C_SIDE = new Color("#5b21b6");
const C_WALL = new Color(COLORS.wall);
const C_BEACON = new Color(COLORS.beacon);
const C_BEACON_OFF = new Color(COLORS.beaconOff);
const C_DONE = new Color("#7c3aed");

export interface VisualClock {
   ms: number;
}

/** What the scene remembers for the visuals the rules don't carry: the slots before a shuffle. */
export interface TowerFx {
   shuffleAt: number;
   prevSlot: Uint8Array;
}

export function createTowerFx(): TowerFx {
   const prevSlot = new Uint8Array(5);
   for (let i = 0; i < 5; i++) prevSlot[i] = i;
   return { shuffleAt: -1, prevSlot };
}

function place(m: Matrix4, x: number, y: number, z: number, yaw: number, sx = 1, sy = 1, sz = 1): void {
   pos.set(x, y, z);
   quat.setFromAxisAngle(UP, yaw);
   scl.set(sx, sy, sz);
   m.compose(pos, quat, scl);
}

/** The colour the current tier's beacon is flashing this ms (-1 none). */
export function showColorNow(run: TowerRun, ms: number): number {
   const ts = run.tiers[run.tier];
   const tier = run.course.tiers[run.tier];
   if (!ts || !tier || ts.showStart < 0) return -1;
   const step = Math.floor((ms - ts.showStart) / SHOW_STEP_MS);
   if (step < 0 || step >= tier.seqLen) return -1;
   return ts.seq[step];
}

/** The colour Prism Shade is flashing this ms (-1 none). */
export function bossShowColorNow(run: TowerRun): number {
   const b = run.boss;
   if (!b || !run.bossAwake || b.step !== "telegraph") return -1;
   const step = Math.floor(b.stepMs / SHOW_STEP_MS);
   if (step >= run.bossLen) return -1;
   return run.bossSeq[step];
}

/** The spire: a dark crystal column with a glowing core line, from far below to the top. */
function Spire({ course }: { course: Course }) {
   const bottom = course.minY - 34;
   const top = course.arena ? course.arena.y : course.maxY + 7;
   const h = top - bottom;
   return (
      <group position={[0, bottom + h / 2, 0]}>
         <mesh>
            {/* 16 facets (was 8): up close one facet filled a third of the screen as a flat purple slab */}
            <cylinderGeometry args={[CORE_R * 0.88, CORE_R, h, 16, 1]} />
            <meshStandardMaterial color="#1e0b4a" roughness={0.22} metalness={0.55} emissive={COLORS.coreEdge} emissiveIntensity={0.12} flatShading />
         </mesh>
         <mesh>
            <cylinderGeometry args={[CORE_R * 0.92, CORE_R * 1.03, h, 8, 1, true]} />
            <meshBasicMaterial color={COLORS.glow} transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </mesh>
         {course.arena ? (
            <mesh position={[0, h / 2 + 0.02, 0]} rotation-x={-Math.PI / 2}>
               <circleGeometry args={[CORE_R * 0.88, 8]} />
               <meshStandardMaterial color="#3b0764" roughness={0.4} emissive={COLORS.coreEdge} emissiveIntensity={0.4} />
            </mesh>
         ) : null}
      </group>
   );
}

function Pads({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const g = GLB_SIZE.pad;
   const centre = useMemo(() => ({ x: 0, z: 0 }), []);
   const update = (i: number, m: Matrix4, color?: Color) => {
      const p = c.pads[i];
      if (!p) return false;
      const ms = Math.max(0, clock.ms);
      if (!padAvailable(run, i)) return false;
      padCenterAt(p, ms, centre);
      let dx = 0;
      let dz = 0;
      let sink = 0;
      const t = run.crumbleAt[i];
      if (t >= 0 && ms < t + CRUMBLE_MS) {
         const k = (ms - t) / CRUMBLE_MS;
         dx = Math.sin(ms / 23) * 0.06 * k;
         dz = Math.cos(ms / 29) * 0.06 * k;
         sink = k * k * 0.35;
      }
      place(m, centre.x + dx, p.y - PAD_T - sink, centre.z + dz, Math.atan2(p.x, p.z), (2 * p.r) / g.x, PAD_T / g.y, (2 * p.r) / g.z);
      if (color) color.copy(p.kind === "arena" ? C_ARENA : p.kind !== "pad" ? C_SIDE : p.slick ? C_GLASS : p.crumble ? C_CRUMBLE : C_PAD);
   };
   return <DynamicInstancedModel asset={ASSETS.pad} count={c.pads.length} update={update} tinted name="pads" />;
}

/** The neon rim of every pad (brighter on the armed beacon's pad). */
function Rims({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const look = LOOKS[c.id];
   const centre = useMemo(() => ({ x: 0, z: 0 }), []);
   const update = (i: number, m: Matrix4, color?: Color) => {
      const p = c.pads[i];
      if (!p || !padAvailable(run, i)) return false;
      padCenterAt(p, Math.max(0, clock.ms), centre);
      place(m, centre.x, p.y + 0.02, centre.z, 0, p.r, 1, p.r);
      if (color) color.copy(p.slick ? C_GLASS : p.crumble ? C_CRUMBLE : WHITE).multiplyScalar(look.rimGlow);
   };
   return (
      <DynamicInstanced count={c.pads.length} update={update} name="rims" tinted>
         <ringGeometry args={[0.93, 1, 40]} />
         <meshBasicMaterial color={COLORS.padRim} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </DynamicInstanced>
   );
}

const cPos = { x: 0, y: 0, z: 0 };
const sPos = { x: 0, y: 0, z: 0 };

/** The tier crystals and, on level 5, Prism Shade's five. */
function Crystals({ run, clock, fx }: { run: TowerRun; clock: VisualClock; fx: TowerFx }) {
   const c = run.course;
   const g = GLB_SIZE.crystal;
   const s = CRYSTAL_W / g.x;
   const n = c.crystals.length + (c.boss ? 5 : 0);
   const update = (i: number, m: Matrix4, color?: Color) => {
      const ms = Math.max(0, clock.ms);
      if (i < c.crystals.length) {
         const cr = c.crystals[i];
         const ts = run.tiers[cr.tier];
         if (ts.done) return false;
         crystalAt(cr, ms, cPos);
         const live = cr.tier === run.tier && ts.shown && ts.showStart < 0;
         const flashing = cr.tier === run.tier && showColorNow(run, ms) === cr.color;
         const k = (flashing ? 1.35 : 1) * (1 + 0.04 * Math.sin(ms / 180 + i));
         place(m, cPos.x, cPos.y - (g.y * s * k) / 2, cPos.z, ms / 900 + i, s * k, s * k, s * k);
         if (color) {
            color.copy(PAL[cr.color]);
            if (cr.tier > run.tier) color.lerp(DIM, 0.6);
            else if (!live && !flashing) color.lerp(DIM, 0.25);
            if (flashing) color.lerp(WHITE, 0.35);
         }
         return;
      }
      if (!run.bossAwake || !run.boss) return false;
      const col = i - c.crystals.length;
      bossCrystalAt(run, col, cPos);
      let x = cPos.x;
      let z = cPos.z;
      // the shuffle: slide from the old slot to the new one through the attack step
      const since = ms - fx.shuffleAt;
      const attackMs = PRISM.phases[0].attacks[0].attackMs;
      if (fx.shuffleAt >= 0 && since >= 0 && since < attackMs) {
         const from = c.slots[fx.prevSlot[col]];
         const k = since / attackMs;
         const e = k * k * (3 - 2 * k);
         x = from.x + (cPos.x - from.x) * e;
         z = from.z + (cPos.z - from.z) * e;
         cPos.y += Math.sin(k * Math.PI) * 1.2;
      }
      const flashing = bossShowColorNow(run) === col;
      const k = (flashing ? 1.35 : 1) * (1 + 0.04 * Math.sin(ms / 180 + i));
      place(m, x, cPos.y - (g.y * s * k) / 2, z, ms / 900 + i, s * k, s * k, s * k);
      if (color) {
         color.copy(PAL[col]);
         if (run.bossDark && run.boss.step !== "telegraph") color.copy(GREY);
         if (flashing) color.lerp(WHITE, 0.35);
         if (run.boss.step !== "vulnerable" && !flashing) color.lerp(DIM, 0.3);
      }
   };
   if (n === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.crystal} count={n} update={update} tinted name="crystals" />;
}

/**
 * The sequence beacons: the post, a ring on the pad, and the flash over it during the show. A post
 * standing between the camera and the hero (camera.ts beaconBlocksView) is left out of the frame; its
 * ring and flash stay, so the beacon still reads.
 */
function Beacons({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const camera = useThree((s) => s.camera);
   const post = (i: number, m: Matrix4) => {
      const t = c.tiers[i];
      if (!t) return false;
      if (beaconBlocksView(t.beacon, camera.position, run.hero)) return false;
      place(m, t.beacon.x, t.beacon.y, t.beacon.z, Math.atan2(t.beacon.x, t.beacon.z));
   };
   const ring = (i: number, m: Matrix4, color?: Color) => {
      const t = c.tiers[i];
      if (!t) return false;
      const ms = Math.max(0, clock.ms);
      const ts = run.tiers[i];
      const pulse = 1 + 0.06 * Math.sin(ms / 160);
      const armed = i === run.tier;
      place(m, t.beacon.x, t.beacon.y + 0.03, t.beacon.z, 0, armed ? pulse : 1, 1, armed ? pulse : 1);
      if (color) {
         const sc = armed ? showColorNow(run, ms) : -1;
         if (sc >= 0) color.copy(PAL[sc]).lerp(WHITE, 0.3);
         else if (i < run.tier || ts.done) color.copy(C_DONE).multiplyScalar(0.6);
         else if (armed) color.copy(C_BEACON).multiplyScalar(ts.shown ? 0.8 : 1.3);
         else color.copy(C_BEACON_OFF);
      }
   };
   const flash = (i: number, m: Matrix4, color?: Color) => {
      const t = c.tiers[i];
      if (!t || i !== run.tier) return false;
      const ms = Math.max(0, clock.ms);
      const sc = showColorNow(run, ms);
      if (sc < 0) return false;
      const ts = run.tiers[i];
      const inStep = ((ms - ts.showStart) % SHOW_STEP_MS) / SHOW_STEP_MS;
      const k = 1.1 - 0.35 * inStep;
      place(m, t.beacon.x, t.beacon.y + 2.9, t.beacon.z, 0, k, k, k);
      color?.copy(PAL[sc]).lerp(WHITE, 0.25);
   };
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.beacon} count={c.tiers.length} update={post} name="beaconPosts" />
         <DynamicInstanced count={c.tiers.length} update={ring} name="beaconRings" tinted>
            <ringGeometry args={[1.45, 1.65, 48]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={c.tiers.length} update={flash} name="beaconFlash" tinted>
            <sphereGeometry args={[0.55, 16, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The summit crystal (the finish, not on level 5) and its ring once every tier is done. */
function Summit({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const ring = useRef<Mesh>(null);
   const mat = useRef<MeshStandardMaterial>(null);
   useFrame(() => {
      const r = ring.current;
      const open = run.tier >= c.tiers.length;
      if (r) {
         r.scale.setScalar(1 + 0.08 * Math.sin(clock.ms / 200));
         (r.material as MeshBasicMaterial).opacity = open ? 0.85 : 0.18;
      }
   });
   if (c.boss) return null;
   return (
      <group position={[c.summit.x, c.summit.y, c.summit.z]}>
         <mesh ref={ring} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.9, 2.2, 48]} />
            <meshBasicMaterial ref={mat as never} color={COLORS.glow} transparent opacity={0.2} depthWrite={false} toneMapped={false} />
         </mesh>
         <Model asset={ASSETS.summit} tint="#d8b4fe" />
         <pointLight position={[0, 2.5, 0]} intensity={1.2} distance={14} color={COLORS.glow} />
      </group>
   );
}

/** Riko's dark crystal walls (gone once shattered). */
function Walls({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const g = GLB_SIZE.crystal;
   const update = (i: number, m: Matrix4, color?: Color) => {
      const w = c.walls[i];
      if (!w || run.wallBroken[i]) return false;
      const h = w.y1 - w.y0 - 0.4;
      place(m, w.x, w.y0 + 0.2, w.z, Math.atan2(w.x, w.z), (2.2 * w.r) / g.x, h / g.y, (2.2 * w.r) / g.z);
      // cracked: a faint red pulse for Riko
      color?.copy(C_WALL).lerp(new Color("#ef4444"), 0.15 + 0.1 * Math.sin(clock.ms / 300));
   };
   if (c.walls.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.crystal} count={c.walls.length} update={update} tinted name="walls" />;
}

/** Vexa's void gates: an arch with a shimmering void in it. */
function Gates({ course, clock }: { course: Course; clock: VisualClock }) {
   const voids = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      voids.current.forEach((v, i) => {
         if (v) (v.material as MeshBasicMaterial).opacity = 0.3 + 0.12 * Math.sin(clock.ms / 380 + i);
      });
   });
   return (
      <>
         {course.gates.map((g, i) => (
            <group key={i} position={[g.x, g.y0 + 0.2, g.z]} rotation-y={Math.atan2(g.x, g.z) + Math.PI / 2}>
               <ArchWall color="#312e81" accent={COLORS.gate} />
               <mesh
                  ref={(m) => {
                     voids.current[i] = m;
                  }}
                  position={[0, 1.2, 0]}
               >
                  <planeGeometry args={[1.6, 2.4]} />
                  <meshBasicMaterial color={COLORS.gate} transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Drones({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const update = (i: number, m: Matrix4) => {
      const d = c.drones[i];
      if (!d) return false;
      const ms = Math.max(0, clock.ms);
      droneAt(c, d, ms, cPos);
      droneAt(c, d, ms + 60, sPos);
      const yaw = Math.atan2(sPos.x - cPos.x, sPos.z - cPos.z);
      place(m, cPos.x, cPos.y - 0.6 + 0.1 * Math.sin(ms / 140), cPos.z, Number.isFinite(yaw) ? yaw : 0);
   };
   if (c.drones.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.drone} count={c.drones.length} update={update} name="drones" />;
}

const SHARDS = 6;

/** Kiro's shard storms: crystal shards raining on the storm pads, and a warning ring before each. */
function Storms({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const pads = useMemo(() => c.pads.filter((p) => p.storm !== undefined), [c]);
   const g = GLB_SIZE.hanging;
   const centre = useMemo(() => ({ x: 0, z: 0 }), []);
   const shard = (i: number, m: Matrix4) => {
      const p = pads[Math.floor(i / SHARDS)];
      if (!p) return false;
      const ms = Math.max(0, clock.ms);
      if (!stormOn(p, ms)) return false;
      const k = i % SHARDS;
      const t = ((ms + (p.storm ?? 0)) % STORM_PERIOD) / STORM_ON;
      const fall = (t + k * 0.13) % 1;
      padCenterAt(p, ms, centre);
      const a = k * 1.05 + ms / 700;
      const r = 0.25 + (k % 3) * 0.3;
      const s = 0.9 / g.y;
      place(m, centre.x + Math.sin(a) * r, p.y + 7.5 - fall * 7.5, centre.z + Math.cos(a) * r, a, s, s, s);
   };
   const ring = (i: number, m: Matrix4, color?: Color) => {
      const p = pads[i];
      if (!p) return false;
      const ms = Math.max(0, clock.ms);
      const on = stormOn(p, ms);
      const soon = stormIn(p, ms);
      if (!on && soon > 900) return false;
      padCenterAt(p, ms, centre);
      const k = on ? 1 : 1 - soon / 900;
      place(m, centre.x, p.y + 0.04, centre.z, 0, STORM_R * (0.8 + 0.2 * k), 1, STORM_R * (0.8 + 0.2 * k));
      color?.set(on ? "#bfdbfe" : COLORS.storm).multiplyScalar(0.4 + 0.6 * k);
   };
   if (pads.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.hanging} count={pads.length * SHARDS} update={shard} name="shards" />
         <DynamicInstanced count={pads.length} update={ring} name="stormRings" tinted>
            <ringGeometry args={[0.8, 1, 36]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

function Gems({ run, clock }: { run: TowerRun; clock: VisualClock }) {
   const c = run.course;
   const update = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = c.orbs[i];
      if (!o) return false;
      if (o.hidden && run.hero.magnetUntil < run.simMs) return false;
      const t = clock.ms / 1000;
      const s = o.hidden ? 0.7 : 1;
      place(m, o.x, o.y - 0.3 + 0.12 * Math.sin(t * 2.4 + i), o.z, t * 1.6 + i, s, s, s);
   };
   return <DynamicInstancedModel asset={ASSETS.gem} count={c.orbs.length} update={update} name="gems" />;
}

function Secrets({ run, clock }: { run: TowerRun; clock: VisualClock }) {
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

export function Tower({ run, clock, fx }: { run: TowerRun; clock: VisualClock; fx: TowerFx }) {
   const course = run.course;
   return (
      <group>
         <Spire course={course} />
         <Pads run={run} clock={clock} />
         <Rims run={run} clock={clock} />
         <Crystals run={run} clock={clock} fx={fx} />
         <Beacons run={run} clock={clock} />
         <Summit run={run} clock={clock} />
         <Walls run={run} clock={clock} />
         <Gates course={course} clock={clock} />
         <Drones run={run} clock={clock} />
         <Storms run={run} clock={clock} />
         <Gems run={run} clock={clock} />
         <Secrets run={run} clock={clock} />
      </group>
   );
}
