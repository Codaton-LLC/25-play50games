"use client";

// The playable docks: the deck slabs (sky platforms, the landing pad, the beacons), the grapple rings
// hung under balloons (the airships on level 3, the windmill rotors, the drone, the galleon's
// falling rings), the rope and its claw, the auto-target highlight, orbs, the hero pockets (crate
// stacks, spark and smoke lines, ghost hulls), secrets and the safety net. Every drawn point is the
// rules' point: a deck's grass is its `y`, a ring's centre is its hook point.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BufferGeometry,
   Color,
   Float32BufferAttribute,
   Matrix4,
   Quaternion,
   Vector3,
   type Group,
   type Mesh,
   type MeshStandardMaterial,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, BALLOON_HEIGHT, DRONE_WIDTH, GLB_SIZE, GLB_TOP, RING_DROP, SHIP_HEIGHT, deckScale, fit } from "./assets";
import { BillboardField, tintOf, type Billboard, type FogBand } from "./Billboards";
import { COLORS } from "./look";
import { SECRETS } from "./progression";
import { anchorAt, type Anchor, type Course } from "./course";
import { anchorPoint, NONE, type SwingRun } from "./rules";
import { glowTexture, smokeTexture, sparkTexture } from "./textures";

export interface VisualClock {
   ms: number;
}

/** What the scene shares with the docks each frame: the ring a press would take. */
export interface AimState {
   index: number;
}

const UP = new Vector3(0, 1, 0);
const DIR = new Vector3();
const QUAT = new Quaternion();
const M = new Matrix4();
const P = { x: 0, y: 0, z: 0 };
const WHITE = new Color("#ffffff");
const RING_TINT = new Color(COLORS.ring);
const CRACK_TINT = new Color(COLORS.cracked);
const SHARD_TINT = new Color(COLORS.shard);
const DIM_TINT = new Color("#8b7a66");
const HEAVY_TINT = new Color("#64748b");
const LOCK_TINT = new Color("#ef4444");

/** The ring's radius (m) as drawn; the rules' hook point is its centre. */
export const RING_R = 0.62;

function hasBalloon(a: Anchor): boolean {
   // the galleon's hull rings hang from its yardarms instead (Galleon.tsx)
   return !a.cut && (a.kind === "ring" || a.kind === "post" || a.kind === "cracked" || a.kind === "ship" || a.kind === "heavy");
}

// ---------------- decks ----------------

function Decks({ run }: { run: SwingRun }) {
   const course = run.course;
   const { slabs, pads, beacons } = useMemo(() => {
      const slabs: InstanceSpot[] = [];
      const pads: InstanceSpot[] = [];
      const beacons: InstanceSpot[] = [];
      course.islands.forEach((s) => {
         if (s.kind === "net") return;
         const k = deckScale(s.r);
         slabs.push({ x: s.x, y: s.y - GLB_TOP.platform * k, z: s.z, scale: k });
         if (s.kind === "pad") {
            const p = fit(GLB_SIZE.pad.x, s.r * 1.7);
            pads.push({ x: s.x, y: s.y - GLB_TOP.pad * p + 0.02, z: s.z, scale: p });
         }
         if (s.cp && s.kind !== "start") beacons.push({ x: s.x + s.r - 0.75, y: s.y, z: s.z - s.r + 0.75, scale: 1.25, rotY: -Math.PI / 4 });
      });
      return { slabs, pads, beacons };
   }, [course]);
   return (
      <>
         <InstancedModel asset={ASSETS.platform} spots={slabs} fallback={null} />
         <InstancedModel asset={ASSETS.pad} spots={pads} fallback={null} />
         <InstancedModel asset={ASSETS.beacon} spots={beacons} fallback={null} />
      </>
   );
}

/** Lit beacons: a glow over each checkpoint the hero has reached (one draw call). */
function BeaconGlows({ run, map, fog }: { run: SwingRun; map: ReturnType<typeof glowTexture>; fog: FogBand }) {
   const course = run.course;
   const spots = useMemo<Billboard[]>(
      () =>
         course.islands
            .filter((s) => s.cp && s.kind !== "start")
            .map((s) => ({ x: s.x + s.r - 0.75, y: s.y + 2.4, z: s.z - s.r + 0.75, size: 0, ...tintOf("#7dd3fc") })),
      [course],
   );
   const index = useMemo(() => course.islands.map((s, i) => (s.cp && s.kind !== "start" ? i : -1)).filter((i) => i >= 0), [course]);
   const time = useGameTime();
   return (
      <BillboardField
         spots={spots}
         map={map}
         fog={fog}
         additive
         aspect={1}
         live={(d) => {
            const reached = course.islands[run.checkpoint]?.x ?? 0;
            for (let k = 0; k < index.length; k++) {
               const lit = course.islands[index[k]].x <= reached;
               d[k * 4 + 3] = lit ? 2.6 + Math.sin(time.now * 3 + k) * 0.25 : 0.9;
            }
            return true;
         }}
      />
   );
}

// ---------------- the safety net ----------------

function Net({ run }: { run: SwingRun }) {
   const net = run.course.islands.find((s) => s.kind === "net");
   const geometry = useMemo(() => {
      if (!net) return null;
      const pos: number[] = [];
      const r = net.r;
      const step = 1.1;
      const sag = (x: number, z: number) => -0.6 * (1 - (x * x) / (r * r)) * (1 - (z * z) / (r * r));
      for (let a = -r; a <= r + 1e-6; a += step) {
         for (let b = -r; b < r - 1e-6; b += step / 2) {
            const b2 = Math.min(r, b + step / 2);
            pos.push(a, sag(a, b), b, a, sag(a, b2), b2);
            pos.push(b, sag(b, a), a, b2, sag(b2, a), a);
         }
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pos, 3));
      return g;
   }, [net]);
   useEffect(() => () => geometry?.dispose(), [geometry]);
   if (!net || !geometry) return null;
   const r = net.r;
   const corners = [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
   ];
   const balloon = fit(GLB_SIZE.airship.y, 2.6);
   return (
      <group position={[net.x, net.y, net.z]}>
         <lineSegments geometry={geometry}>
            <lineBasicMaterial color={COLORS.net} />
         </lineSegments>
         {corners.map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
               <mesh position={[0, 2.4, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 4.8, 4]} />
                  <meshStandardMaterial color={COLORS.ropeDark} roughness={0.9} />
               </mesh>
               <group position={[0, 4.6, 0]} scale={balloon}>
                  <Model asset={ASSETS.airship} />
               </group>
            </group>
         ))}
         {[0, 1, 2, 3].map((i) => {
            const horizontal = i < 2;
            const off = (i % 2 === 0 ? -1 : 1) * r;
            return (
               <mesh key={`f${i}`} position={horizontal ? [0, 0, off] : [off, 0, 0]} rotation={horizontal ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.07, 0.07, 2 * r, 6]} />
                  <meshStandardMaterial color={COLORS.ropeDark} roughness={0.8} />
               </mesh>
            );
         })}
      </group>
   );
}

// ---------------- rings, balloons, cables ----------------

function Rings({ run, clock, aim }: { run: SwingRun; clock: VisualClock; aim: AimState }) {
   const course = run.course;
   const anchors = course.anchors;
   const time = useGameTime();
   const balloons = useMemo(() => anchors.map((a, i) => (hasBalloon(a) ? i : -1)).filter((i) => i >= 0), [anchors]);
   const place = (i: number, out: { x: number; y: number; z: number }) => anchorAt(anchors[i], clock.ms, run.fallMs, out);
   /** a ring that cannot be hooked any more: a snapped cracked ring, a hull ring the drones cut */
   const gone = (i: number) => run.ringBroken[i] === 1 || (anchors[i].cut && !!run.boss && run.boss.phase >= 1);
   return (
      <>
         {/* the rings: one draw call, tinted per copy (brass, cracked rust, the compass ring's teal) */}
         <DynamicInstanced
            count={anchors.length}
            tinted
            update={(i, m, color) => {
               const a = anchors[i];
               if (a.kind === "drone" && (!run.boss || run.boss.phase !== 1)) return false;
               place(i, P);
               let y = P.y;
               if (gone(i)) {
                  // it falls away into the clouds
                  const since = Math.max(0, clock.ms - (run.ringBroken[i] ? run.hero.hookAt + a.crackMs : 0));
                  if (!run.ringBroken[i]) return false;
                  y -= Math.min(30, (since / 1000) * (since / 1000) * 9);
                  if (since > 1800) return false;
               }
               let shake = 0;
               if (a.crackMs > 0 && run.hero.anchor === i && run.hero.mode === "swing") {
                  const left = 1 - (run.simMs - run.hero.hookAt) / a.crackMs;
                  shake = left < 0.45 ? Math.sin(time.now * 60) * 0.06 * (1 - left) : 0;
               }
               QUAT.setFromAxisAngle(UP, Math.PI / 2);
               M.makeRotationFromQuaternion(QUAT);
               const s = (aim.index === i ? 1.18 + Math.sin(time.now * 10) * 0.06 : 1) * (a.kind === "heavy" ? 1.5 : 1);
               m.copy(M).scale(DIR.set(s, s, s)).setPosition(P.x + shake, y, P.z);
               const off = a.kind === "fall" && run.fallMs < 0;
               const locked = run.versus && run.lockUntil[i] > run.simMs;
               color.copy(locked ? LOCK_TINT : a.kind === "heavy" ? HEAVY_TINT : a.kind === "cracked" ? CRACK_TINT : off ? DIM_TINT : anchors[i].y > 0 && !course.route.includes(i) && a.kind === "ring" ? SHARD_TINT : RING_TINT);
            }}
         >
            <torusGeometry args={[RING_R, 0.09, 10, 28]} />
            <meshStandardMaterial color={WHITE} metalness={0.65} roughness={0.32} emissive={COLORS.ring} emissiveIntensity={0.18} />
         </DynamicInstanced>
         {/* the cable from each ring up to its balloon's basket */}
         <DynamicInstanced
            count={balloons.length}
            update={(k, m) => {
               const i = balloons[k];
               if (gone(i)) return false;
               place(i, P);
               const len = anchors[i].kind === "ship" ? RING_DROP + 0.6 : RING_DROP;
               m.makeScale(1, len, 1).setPosition(P.x, P.y + RING_R + len / 2, P.z);
            }}
         >
            <cylinderGeometry args={[0.035, 0.035, 1, 5]} />
            <meshStandardMaterial color={COLORS.ropeDark} roughness={0.9} />
         </DynamicInstanced>
         <DynamicInstancedModel
            asset={ASSETS.airship}
            count={balloons.length}
            update={(k, m) => {
               const i = balloons[k];
               const a = anchors[i];
               place(i, P);
               const ship = a.kind === "ship";
               const h = ship ? SHIP_HEIGHT : BALLOON_HEIGHT;
               const s = fit(GLB_SIZE.airship.y, h);
               const drop = ship ? RING_DROP + 0.6 : RING_DROP;
               // a snapped cracked ring's balloon drifts up and away
               let lift = 0;
               if (run.ringBroken[i]) lift = Math.min(40, Math.max(0, clock.ms - run.hero.hookAt - a.crackMs) / 1000 * 3);
               if (a.cut && run.boss && run.boss.phase >= 1) return false;
               const bob = Math.sin(time.now * 0.9 + i * 1.7) * 0.05;
               m.makeRotationY(i * 1.3).scale(DIR.set(s, s, s)).setPosition(P.x, P.y + RING_R + drop + bob + lift, P.z);
            }}
         />
      </>
   );
}

/** The windmill blade rings: a rotor turning on a mast over a windmill island in the clouds. */
function Windmills({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const blades = useMemo(() => run.course.anchors.filter((a) => a.kind === "blade"), [run.course]);
   const rotors = useRef<Array<Group | null>>([]);
   useFrame(() => {
      blades.forEach((a, i) => {
         const g = rotors.current[i];
         if (g) g.rotation.z = a.phase + (Math.PI * 2 * clock.ms) / 1000 / a.period;
      });
   });
   const mill = fit(GLB_SIZE.windmill.x, 12);
   return (
      <>
         {blades.map((a, i) => (
            <group key={i} position={[a.hubX, a.hubY, a.hubZ]}>
               {/* the mast behind the rotor, down to the island in the clouds */}
               <mesh position={[0, -9, -1.4]}>
                  <cylinderGeometry args={[0.45, 0.8, 18, 10]} />
                  <meshStandardMaterial color="#d8c3a0" roughness={0.75} />
               </mesh>
               <mesh position={[0, 0, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.22, 0.22, 1.6, 8]} />
                  <meshStandardMaterial color="#6b4a2e" roughness={0.6} metalness={0.2} />
               </mesh>
               <group ref={(g) => { rotors.current[i] = g; }}>
                  <mesh>
                     <cylinderGeometry args={[0.55, 0.55, 0.5, 12]} />
                     <meshStandardMaterial color="#b45309" roughness={0.5} metalness={0.3} />
                  </mesh>
                  {[0, 1, 2, 3].map((k) => (
                     <group key={k} rotation={[0, 0, (k * Math.PI) / 2]}>
                        <mesh position={[a.radius / 2, 0, 0]}>
                           <boxGeometry args={[a.radius, 0.22, 0.12]} />
                           <meshStandardMaterial color="#7c5a35" roughness={0.8} />
                        </mesh>
                        <mesh position={[a.radius * 0.55, 0.42, 0.02]}>
                           <boxGeometry args={[a.radius * 0.8, 0.7, 0.04]} />
                           <meshStandardMaterial color={k === 0 ? "#f8e7c4" : "#efe4d0"} roughness={0.95} />
                        </mesh>
                     </group>
                  ))}
               </group>
               <group position={[0, -19, -1.4]} scale={mill}>
                  <Model asset={ASSETS.windmill} />
               </group>
            </group>
         ))}
      </>
   );
}

/** Level 5's drone: the GLB flying its circle round the mast, its ring underneath. */
function Drone({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const index = useMemo(() => run.course.anchors.findIndex((a) => a.kind === "drone"), [run.course]);
   const ref = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = ref.current;
      if (!g || index < 0) return;
      anchorAt(run.course.anchors[index], clock.ms, run.fallMs, P);
      g.visible = !!run.boss && run.boss.phase <= 1 && run.ended === null;
      g.position.set(P.x, P.y + RING_R + 0.1 + Math.sin(time.now * 6) * 0.05, P.z);
      g.rotation.y = Math.PI / 2 + Math.sin(time.now * 1.3) * 0.3;
   });
   if (index < 0) return null;
   const s = fit(GLB_SIZE.drone.x, DRONE_WIDTH);
   return (
      <group ref={ref}>
         <group scale={s}>
            <Model asset={ASSETS.drone} />
         </group>
      </group>
   );
}

// ---------------- the rope and the claw ----------------

export function Rope({ run, clock, hand }: { run: SwingRun; clock: VisualClock; hand?: { x: number; y: number; z: number } }) {
   const rope = useRef<Mesh>(null);
   const claw = useRef<Group>(null);
   const tip = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const from = useMemo(() => new Vector3(), []);
   useFrame(() => {
      const mesh = rope.current;
      const c = claw.current;
      const h = run.hero;
      if (!mesh || !c) return;
      if (h.mode !== "swing") {
         mesh.visible = false;
         c.visible = false;
         return;
      }
      anchorPoint(run, h.anchor, clock.ms, tip);
      if (hand) from.set(hand.x, hand.y, hand.z);
      else from.set(h.x, h.y + 1.25, h.z);
      // the throw: the claw flies out from the hand in 110 ms, then the rope snaps tight
      const k = Math.min(1, Math.max(0, (clock.ms - h.hookAt) / 110));
      const tx = from.x + (tip.x - from.x) * k;
      const ty = from.y + (tip.y + RING_R * 0.8 - from.y) * k;
      const tz = from.z + (tip.z - from.z) * k;
      const len = Math.max(0.05, Math.hypot(tx - from.x, ty - from.y, tz - from.z));
      mesh.visible = true;
      mesh.position.set((tx + from.x) / 2, (ty + from.y) / 2, (tz + from.z) / 2);
      DIR.set(tx - from.x, ty - from.y, tz - from.z).normalize();
      QUAT.setFromUnitVectors(UP, DIR);
      mesh.quaternion.copy(QUAT);
      mesh.scale.set(1, len, 1);
      const mat = mesh.material as MeshStandardMaterial;
      mat.emissiveIntensity = h.peak ? 1.1 : 0;
      mat.color.set(h.peak ? COLORS.peak : COLORS.rope);
      c.visible = true;
      c.position.set(tx, ty, tz);
      c.quaternion.copy(QUAT);
   });
   return (
      <>
         <mesh ref={rope}>
            <cylinderGeometry args={[0.05, 0.05, 1, 6]} />
            <meshStandardMaterial color={COLORS.rope} emissive={COLORS.peak} emissiveIntensity={0} roughness={0.7} />
         </mesh>
         {/* a three-pronged claw hooked over the ring */}
         <group ref={claw}>
            <mesh>
               <cylinderGeometry args={[0.1, 0.1, 0.32, 8]} />
               <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
            </mesh>
            {[0, 1, 2].map((k) => (
               <group key={k} rotation={[0, (k * Math.PI * 2) / 3, 0]}>
                  <mesh position={[0.16, 0.2, 0]} rotation={[0, 0, -0.9]}>
                     <coneGeometry args={[0.05, 0.36, 6]} />
                     <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.25} />
                  </mesh>
               </group>
            ))}
            <mesh position={[0, -0.18, 0]}>
               <torusGeometry args={[0.09, 0.03, 6, 12]} />
               <meshStandardMaterial color="#2563eb" metalness={0.4} roughness={0.4} />
            </mesh>
         </group>
      </>
   );
}

// ---------------- orbs, glows, aim, secrets ----------------

function Orbs({ run, clock, map, fog, aim }: { run: SwingRun; clock: VisualClock; map: ReturnType<typeof glowTexture>; fog: FogBand; aim: AimState }) {
   const orbs = run.course.orbs;
   const time = useGameTime();
   const tints = useMemo(() => orbs.map((o) => new Color(o.kind === "magnet" ? COLORS.magnet : o.kind === "bonus" ? COLORS.bonus : COLORS.orb)), [orbs]);
   const glows = useMemo<Billboard[]>(() => {
      const out: Billboard[] = orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: 1.3, ...tintOf(o.kind === "magnet" ? COLORS.magnet : COLORS.orb) }));
      // one more: the auto-target glow on the ring a press would take
      out.push({ x: 0, y: 0, z: 0, size: 0, ...tintOf(COLORS.aim) });
      return out;
   }, [orbs]);
   return (
      <>
         <DynamicInstanced
            count={orbs.length}
            tinted
            update={(i, m, color) => {
               if (run.collected[i]) return false;
               const o = orbs[i];
               const bob = Math.sin(time.now * 2.4 + i) * 0.12;
               m.makeRotationY(time.now * 2 + i).scale(DIR.set(1, 1.25, 1)).setPosition(o.x, o.y + bob, o.z);
               color.copy(tints[i]);
            }}
         >
            <octahedronGeometry args={[0.32, 1]} />
            <meshStandardMaterial color={WHITE} emissive={COLORS.orb} emissiveIntensity={0.45} metalness={0.3} roughness={0.25} />
         </DynamicInstanced>
         <BillboardField
            spots={glows}
            map={map}
            fog={fog}
            additive
            aspect={1}
            live={(d) => {
               for (let i = 0; i < orbs.length; i++) d[i * 4 + 3] = run.collected[i] ? 0 : 1.3 + Math.sin(time.now * 3 + i) * 0.15;
               const k = orbs.length * 4;
               if (aim.index !== NONE && run.hero.mode !== "swing") {
                  anchorPoint(run, aim.index, clock.ms, P);
                  d[k] = P.x;
                  d[k + 1] = P.y;
                  d[k + 2] = P.z;
                  d[k + 3] = 3.2 + Math.sin(time.now * 9) * 0.35;
               } else d[k + 3] = 0;
               return true;
            }}
         />
      </>
   );
}

function Secrets({ run }: { run: SwingRun }) {
   const spots = run.course.secrets;
   const refs = useRef<Array<Group | null>>([]);
   const time = useGameTime();
   useFrame(() => {
      spots.forEach((_, i) => {
         const g = refs.current[i];
         if (!g) return;
         g.visible = !run.secrets.found[i];
         g.rotation.y = time.now * 1.6 + i;
         g.position.y = spots[i].y + Math.sin(time.now * 2 + i) * 0.15;
      });
   });
   return (
      <>
         {spots.map((s, i) => {
            const sticker = SECRETS[run.level][i]?.kind === "sticker";
            return (
               <group key={i} ref={(g) => { refs.current[i] = g; }} position={[s.x, s.y, s.z]}>
                  {sticker ? (
                     <mesh>
                        <boxGeometry args={[0.7, 0.7, 0.06]} />
                        <meshStandardMaterial color={COLORS.sticker} emissive={COLORS.sticker} emissiveIntensity={0.5} roughness={0.4} />
                     </mesh>
                  ) : (
                     <mesh scale={[0.32, 0.6, 0.32]}>
                        <octahedronGeometry args={[1, 0]} />
                        <meshStandardMaterial color={COLORS.shard} emissive={COLORS.shard} emissiveIntensity={0.9} metalness={0.2} roughness={0.1} transparent opacity={0.9} />
                     </mesh>
                  )}
               </group>
            );
         })}
      </>
   );
}

// ---------------- hero pockets: walls, crates, ghost hulls, sparks, smoke ----------------

function Blocks({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const blocks = run.course.blocks;
   const ghosts = useRef<Array<MeshStandardMaterial | null>>([]);
   const time = useGameTime();
   // crate stacks: 2 x 2 x 3 crates filling each block; a smashed stack scatters for a moment
   const crates = useMemo(() => {
      const out: Array<{ block: number; x: number; y: number; z: number; s: number; dx: number; dz: number }> = [];
      blocks.forEach((b, i) => {
         if (b.kind !== "crate") return;
         const w = (b.x1 - b.x0) / 2;
         const layers = 3;
         const h = (b.y1 - b.y0) / layers;
         const s = fit(GLB_SIZE.crate.x, w * 0.98);
         for (let l = 0; l < layers; l++) {
            for (let a = 0; a < 2; a++) {
               for (let c = 0; c < 2; c++) {
                  if (l === 2 && a + c === 2) continue;
                  out.push({ block: i, x: b.x0 + w * (a + 0.5), y: b.y0 + l * h, z: b.z0 + w * (c + 0.5), s, dx: a - 0.5, dz: c - 0.5 });
               }
            }
         }
      });
      return out;
   }, [blocks]);
   const smashedAt = useRef<number[]>([]);
   useFrame(() => {
      blocks.forEach((b, i) => {
         if (run.broken[i] && smashedAt.current[i] === undefined) smashedAt.current[i] = time.now;
      });
      const phasing = run.hero.phaseUntil >= run.simMs;
      for (const m of ghosts.current) {
         if (!m) continue;
         m.opacity = phasing ? 0.16 : 0.42 + Math.sin(time.now * 2.2) * 0.06;
      }
   });
   return (
      <>
         {blocks.map((b, i) => {
            const w = b.x1 - b.x0;
            const h = b.y1 - b.y0;
            const d = b.z1 - b.z0;
            const c: [number, number, number] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2];
            if (b.kind === "wall") {
               return (
                  <group key={i} position={c}>
                     <mesh>
                        <boxGeometry args={[w, h, d]} />
                        <meshStandardMaterial color={COLORS.hull} roughness={0.85} />
                     </mesh>
                     {[-1, 1].map((s) => (
                        <mesh key={s} position={[(s * w) / 2, 0, 0]}>
                           <boxGeometry args={[0.18, h + 0.1, d + 0.2]} />
                           <meshStandardMaterial color={COLORS.hullTrim} roughness={0.5} metalness={0.4} />
                        </mesh>
                     ))}
                     {Array.from({ length: Math.floor(h / 0.9) }, (_, k) => (
                        <mesh key={`p${k}`} position={[0, -h / 2 + 0.45 + k * 0.9, 0]}>
                           <boxGeometry args={[w + 0.04, 0.06, d + 0.04]} />
                           <meshStandardMaterial color={COLORS.hullDark} roughness={0.9} />
                        </mesh>
                     ))}
                  </group>
               );
            }
            if (b.kind === "ghost") {
               return (
                  <mesh key={i} position={c}>
                     <boxGeometry args={[w, h, d]} />
                     <meshStandardMaterial
                        ref={(m) => { ghosts.current[i] = m; }}
                        color={COLORS.ghost}
                        emissive={COLORS.hazard}
                        emissiveIntensity={0.55}
                        transparent
                        opacity={0.42}
                        depthWrite={false}
                        roughness={0.2}
                     />
                  </mesh>
               );
            }
            return null;
         })}
         <DynamicInstancedModel
            asset={ASSETS.crate}
            count={crates.length}
            update={(k, m) => {
               const c = crates[k];
               const at = smashedAt.current[c.block];
               let x = c.x;
               let y = c.y;
               let z = c.z;
               let spin = (k % 3) * 0.3;
               if (at !== undefined) {
                  const t = time.now - at;
                  if (t > 0.9) return false;
                  x += c.dx * t * 9;
                  z += c.dz * t * 9;
                  y += t * 6 - t * t * 18;
                  spin += t * 8;
               }
               m.makeRotationY(spin).scale(DIR.set(c.s, c.s, c.s)).setPosition(x, y, z);
            }}
         />
         <Hulls run={run} clock={clock} />
      </>
   );
}

/** The ghost hulls' frames: a dark keel and ribs round each violet panel box (Vexa's inner decks). */
function Hulls({ run }: { run: SwingRun; clock: VisualClock }) {
   return (
      <>
         {run.course.hulls.map((h, i) => {
            const w = h.x1 - h.x0 + 0.6;
            const d = h.z1 - h.z0 + 0.6;
            const top = h.y1 + 0.3;
            return (
               <group key={i} position={[(h.x0 + h.x1) / 2, 0, (h.z0 + h.z1) / 2]}>
                  {[-1, 1].map((sx) =>
                     [-1, 1].map((sz) => (
                        <mesh key={`${sx}${sz}`} position={[(sx * w) / 2, (h.y0 + top) / 2 + 0.4, (sz * d) / 2]}>
                           <boxGeometry args={[0.22, top - h.y0 - 0.2, 0.22]} />
                           <meshStandardMaterial color={COLORS.hullDark} roughness={0.8} />
                        </mesh>
                     )),
                  )}
                  <mesh position={[0, top + 0.05, 0]}>
                     <boxGeometry args={[w + 0.25, 0.16, d + 0.25]} />
                     <meshStandardMaterial color={COLORS.hullTrim} roughness={0.5} metalness={0.4} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

function Hazards({ run, fog }: { run: SwingRun; fog: FogBand }) {
   const hazards = run.course.hazards;
   const time = useGameTime();
   const spark = useMemo(() => sparkTexture(), []);
   const smoke = useMemo(() => smokeTexture(), []);
   useEffect(
      () => () => {
         spark.dispose();
         smoke.dispose();
      },
      [spark, smoke],
   );
   const sparks = useMemo<Billboard[]>(() => hazards.filter((h) => h.kind === "spark").flatMap((h) => [0, 1].map(() => ({ x: h.x, y: h.y, z: h.z, size: h.r * 2.2, ...tintOf(COLORS.hazard) }))), [hazards]);
   const puffs = useMemo<Billboard[]>(() => hazards.filter((h) => h.kind === "smoke").flatMap((h) => [0, 1, 2].map(() => ({ x: h.x, y: h.y, z: h.z, size: h.r * 2.4, ...tintOf("#6b5f86") }))), [hazards]);
   const sparkBase = useMemo(() => hazards.filter((h) => h.kind === "spark"), [hazards]);
   const smokeBase = useMemo(() => hazards.filter((h) => h.kind === "smoke"), [hazards]);
   // the cables the sparks run along: one per line of three
   const lines = useMemo(() => {
      const out: Array<{ x0: number; x1: number; y: number; z: number }> = [];
      for (let i = 0; i + 2 < hazards.length; i += 3) {
         const a = hazards[i];
         const b = hazards[i + 2];
         if (a.kind !== "spark") continue;
         out.push({ x0: a.x - 2.5, x1: b.x + 2.5, y: a.y, z: a.z });
      }
      return out;
   }, [hazards]);
   return (
      <>
         {lines.map((l, i) => (
            <group key={i}>
               <mesh position={[(l.x0 + l.x1) / 2, l.y, l.z]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.06, 0.06, l.x1 - l.x0, 6]} />
                  <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} emissive={COLORS.hazard} emissiveIntensity={0.4} />
               </mesh>
               {[l.x0, l.x1].map((x, k) => (
                  <mesh key={k} position={[x, l.y - 1.6, l.z]}>
                     <cylinderGeometry args={[0.12, 0.16, 3.2, 8]} />
                     <meshStandardMaterial color={COLORS.hullDark} roughness={0.7} />
                  </mesh>
               ))}
            </group>
         ))}
         <BillboardField
            spots={sparks}
            map={spark}
            fog={fog}
            additive
            aspect={1}
            live={(d) => {
               for (let i = 0; i < sparks.length; i++) {
                  const h = sparkBase[i >> 1];
                  const f = Math.sin(time.now * 37 + i * 2.1) * 0.5 + 0.5;
                  d[i * 4] = h.x + Math.sin(time.now * 23 + i) * 0.35;
                  d[i * 4 + 1] = h.y + Math.cos(time.now * 19 + i) * 0.3;
                  d[i * 4 + 3] = h.r * (1.4 + f * 1.4);
               }
               return true;
            }}
         />
         <BillboardField
            spots={puffs}
            map={smoke}
            fog={fog}
            opacity={0.85}
            aspect={1}
            live={(d) => {
               for (let i = 0; i < puffs.length; i++) {
                  const h = smokeBase[Math.floor(i / 3)];
                  const t = (time.now * 0.6 + i * 0.33) % 1;
                  d[i * 4] = h.x + Math.sin(i * 2.4) * 0.6;
                  d[i * 4 + 1] = h.y - 0.6 + t * 1.6;
                  d[i * 4 + 3] = h.r * (1.6 + t * 1.6);
               }
               return true;
            }}
         />
      </>
   );
}

export default function Docks({ run, clock, aim, fog }: { run: SwingRun; clock: VisualClock; aim: AimState; fog: FogBand }) {
   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   return (
      <group>
         <Decks run={run} />
         <BeaconGlows run={run} map={glow} fog={fog} />
         <Net run={run} />
         <Rings run={run} clock={clock} aim={aim} />
         <Windmills run={run} clock={clock} />
         <Drone run={run} clock={clock} />
         <Orbs run={run} clock={clock} map={glow} fog={fog} aim={aim} />
         <Secrets run={run} />
         <Blocks run={run} clock={clock} />
         <Hazards run={run} fog={fog} />
      </group>
   );
}
