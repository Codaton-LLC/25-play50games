"use client";

// The hazards and the scenery: solid rocks, the sliding rocks (boulders that come down the north cliff
// and roll south along their dust chute), the crevasses, the boundary ledges, the distant mesas, the base
// camp with the astronaut, the L5 ancient arch; plus the rover's dust trail, its tyre tracks and the guide
// arrow on the ground pointing to the next objective.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Euler, Quaternion, Shape, ShapeGeometry, Vector3, type BufferGeometry, type Group, type Matrix4 } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { HumanoidModel, cheerPose, idlePose, useHumanoidPose } from "@/arcade3d/core/rig";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, BOULDER_HALF_H } from "./assets";
import type { MarsLevel } from "./levels";
import { COLORS, campSpots, laneSpots, mesaSpots, ruinSpots, wallSpots } from "./looks";
import { AstronautFigure, CampPrimitive, PartsInstanced, boulderParts, mesaParts, rockParts, useParts, wallParts } from "./Primitives";
import { BOULDER_RADIUS, type Run } from "./rules";
import type { HeightFn } from "./terrain";
import type { Vis } from "./visual";

const V = new Vector3();
const Q = new Quaternion();
const E = new Euler();
const S = new Vector3();
const DUST = new Color(COLORS.dust);
const GROUND = new Color(COLORS.groundLight);
const TRACK = new Color(COLORS.tracks);

const onGround = (spots: readonly InstanceSpot[], height: HeightFn, lift = 0) => spots.map((s) => ({ ...s, y: height(s.x, s.z) + lift + (s.y ?? 0) }));

/** A lens: a crack 1 long (x) and 1 wide (z), lying flat. */
function lensGeometry(): BufferGeometry {
   const s = new Shape();
   const n = 12;
   s.moveTo(-0.5, 0);
   for (let i = 1; i <= n; i++) {
      const t = i / n;
      s.lineTo(-0.5 + t, 0.5 * Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.sin(t * 17)));
   }
   for (let i = n - 1; i >= 0; i--) {
      const t = i / n;
      s.lineTo(-0.5 + t, -0.5 * Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.cos(t * 13)));
   }
   return new ShapeGeometry(s).rotateX(-Math.PI / 2);
}

function useGeo(make: () => BufferGeometry) {
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const g = useMemo(make, []);
   useEffect(() => () => g.dispose(), [g]);
   return g;
}

export function Hazards({ run, level, height }: { run: Run; level: MarsLevel; height: HeightFn }) {
   const rockFallback = useParts(rockParts);
   const boulderFallback = useParts(boulderParts);
   const lens = useGeo(lensGeometry);
   const rockSpots = useMemo<InstanceSpot[]>(() => run.rocks.map((r) => ({ x: r.x, y: height(r.x, r.z) - 0.05, z: r.z, rotY: r.rotY })), [run, height]);
   const lanes = useMemo(() => onGround(laneSpots(level, run.boulders), height), [level, run, height]);
   // a crack: the dark core and a lighter broken rim, along each crevasse's axis
   const rims = useMemo<InstanceSpot[]>(() => run.crevasses.map((c) => ({ x: c.x, y: height(c.x, c.z) + 0.03, z: c.z, rotY: -c.angle, sx: 2 * (c.halfLength + c.halfWidth) + 0.9, sy: 1, sz: 2 * c.halfWidth + 1.0 })), [run, height]);
   const cores = useMemo<InstanceSpot[]>(() => run.crevasses.map((c) => ({ x: c.x, y: height(c.x, c.z) + 0.05, z: c.z, rotY: -c.angle, sx: 2 * (c.halfLength + c.halfWidth), sy: 1, sz: 2 * c.halfWidth })), [run, height]);

   const placeBoulder = (i: number, m: Matrix4) => {
      const b = run.boulders[i];
      if (!b) return false;
      // the first 2 m of its lane: it slides down the north cliff's chute onto the plain, fast
      const rise = Math.min(1, (b.z - b.minZ) / 2);
      const back = (1 - rise) * 9;
      const z = b.z - back;
      const fall = Math.min(1, (b.maxZ - b.z) / 1.5);
      const y = height(b.x, z) + BOULDER_HALF_H - (1 - fall) * BOULDER_HALF_H * 2;
      V.set(b.x, y, z);
      E.set(b.rolled / BOULDER_RADIUS + back * 0.8, 0, 0);
      Q.setFromEuler(E);
      S.set(1, 1, 1);
      m.compose(V, Q, S);
   };

   return (
      <>
         <InstancedModel asset={ASSETS.rock} spots={rockSpots} fallback={<PartsInstanced spots={rockSpots} parts={rockFallback} name="rocks" />} />
         {run.boulders.length > 0 && (
            <>
               <DynamicInstancedModel asset={ASSETS.boulder} count={run.boulders.length} update={placeBoulder} fallbackParts={boulderFallback} name="boulders" />
               <Instanced spots={lanes} name="lanes">
                  <boxGeometry args={[1, 0.01, 1]} />
                  <meshStandardMaterial color={COLORS.lane} roughness={1} transparent opacity={0.22} depthWrite={false} />
               </Instanced>
            </>
         )}
         {run.crevasses.length > 0 && (
            <>
               <Instanced spots={rims} name="crevasse-rims">
                  <primitive object={lens} attach="geometry" />
                  <meshStandardMaterial color={COLORS.crevasseRim} roughness={1} transparent opacity={0.85} depthWrite={false} />
               </Instanced>
               <Instanced spots={cores} name="crevasse-cores">
                  <primitive object={lens} attach="geometry" />
                  <meshBasicMaterial color={COLORS.crevasse} />
               </Instanced>
            </>
         )}
      </>
   );
}

export function Decor({ run, level, id, height }: { run: Run; level: MarsLevel; id: LevelId; height: HeightFn }) {
   const quality = useQuality();
   const time = useGameTime();
   const wallFallback = useParts(wallParts);
   const mesaFallback = useParts(mesaParts);
   const walls = useMemo(() => onGround(wallSpots(level), height, -0.15), [level, height]);
   const mesas = useMemo(() => {
      const all = onGround(mesaSpots(level, id), height, -0.5);
      return all.slice(0, scaledCount(all.length, quality.decor));
   }, [level, id, height, quality.decor]);
   const lander = run.props.find((p) => p.kind === "lander") ?? { x: -4, z: level.depth / 2 };
   const camp = useMemo(() => campSpots(level, lander), [level, lander]);
   const crates = useMemo(() => onGround(camp.crates, height), [camp, height]);
   const ruins = useMemo(() => (level.terrain === "ruins" ? ruinSpots(level) : null), [level]);
   const ruinPillars = useMemo(() => (ruins ? onGround(ruins.pillars, height, -0.2) : []), [ruins, height]);
   const astronautPose = useHumanoidPose((p) => {
      if (run.over === "win") cheerPose(time.now, p);
      else idlePose(time.now, p);
   });
   const at = (p: { x: number; z: number }) => [p.x, height(p.x, p.z), p.z] as [number, number, number];
   return (
      <>
         <InstancedModel asset={ASSETS.wall} spots={walls} fallback={<PartsInstanced spots={walls} parts={wallFallback} name="walls" />} />
         <InstancedModel asset={ASSETS.mesa} spots={mesas} fallback={<PartsInstanced spots={mesas} parts={mesaFallback} name="mesas" />} />
         <Model asset={ASSETS.base} position={at(camp.base)} rotation-y={camp.base.rotY} scale={camp.base.scale} fallback={<CampPrimitive kind="base" />} />
         <Model asset={ASSETS.antenna} position={at(camp.antenna)} rotation-y={camp.antenna.rotY} scale={camp.antenna.scale} fallback={<CampPrimitive kind="antenna" />} />
         <InstancedModel asset={ASSETS.crate} spots={crates} fallback={null} />
         <group position={at(camp.astronaut)} rotation-y={Math.PI}>
            <HumanoidModel asset={ASSETS.astronaut} pose={astronautPose} fallback={<AstronautFigure />} />
         </group>
         {ruins && (
            <>
               <Model asset={ASSETS.arch} position={at(ruins.arch)} rotation-y={ruins.arch.rotY} scale={ruins.arch.scale} fallback={null} />
               <InstancedModel asset={ASSETS.relic} spots={ruinPillars} fallback={null} />
            </>
         )}
      </>
   );
}

// ---------- the rover's dust trail, tracks and the guide arrow ----------

const DUST_N = 72;
interface Puff {
   x: number;
   y: number;
   z: number;
   vx: number;
   vy: number;
   vz: number;
   age: number;
   life: number;
   size: number;
}

export function DustTrail({ run, height }: { run: Run; height: HeightFn }) {
   const time = useGameTime();
   const quality = useQuality();
   const count = scaledCount(DUST_N, quality.decor);
   const puffs = useMemo<Puff[]>(() => Array.from({ length: count }, () => ({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, age: 9, life: 1, size: 1 })), [count]);
   const head = useRef(0);
   const acc = useRef(0);
   useFrame(() => {
      const dt = Math.min(0.05, time.delta || 0);
      const r = run.rover;
      const speed = Math.abs(r.speed);
      acc.current += dt * (speed > 0.8 ? 10 + speed * 4 : 0);
      const fx = Math.sin(r.yaw);
      const fz = Math.cos(r.yaw);
      while (acc.current >= 1 && count > 0) {
         acc.current -= 1;
         const p = puffs[head.current++ % count];
         const side = head.current % 2 ? 0.78 : -0.78;
         // behind a rear wheel
         p.x = r.x - fx * 1.1 - fz * side * 1;
         p.z = r.z - fz * 1.1 + fx * side * 1;
         p.y = height(p.x, p.z) + 0.15;
         p.vx = -fx * speed * 0.25 + (Math.random() - 0.5) * 0.6;
         p.vz = -fz * speed * 0.25 + (Math.random() - 0.5) * 0.6;
         p.vy = 0.5 + Math.random() * 0.5;
         p.age = 0;
         p.life = 0.9 + Math.random() * 0.7;
         p.size = 0.25 + Math.min(1, speed / 7) * 0.25;
      }
      for (const p of puffs) {
         if (p.age >= p.life) continue;
         p.age += dt;
         p.x += p.vx * dt;
         p.y += p.vy * dt;
         p.z += p.vz * dt;
         p.vx *= 1 - 1.5 * dt;
         p.vz *= 1 - 1.5 * dt;
         p.vy *= 1 - 1.2 * dt;
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   const update = (i: number, m: Matrix4, color: Color) => {
      const p = puffs[i];
      if (!p || p.age >= p.life) return false;
      const t = p.age / p.life;
      const s = p.size * (0.6 + t * 2.2) * (1 - t * t);
      V.set(p.x, p.y, p.z);
      Q.identity();
      S.set(s, s * 0.8, s);
      m.compose(V, Q, S);
      color.copy(DUST).lerp(GROUND, t);
   };
   if (count === 0) return null;
   return (
      <DynamicInstanced count={count} update={update} name="dust-trail" tinted>
         <icosahedronGeometry args={[0.5, 1]} />
         <meshStandardMaterial transparent opacity={0.22} depthWrite={false} roughness={1} />
      </DynamicInstanced>
   );
}

const TRACK_N = 260;

export function Tracks({ run, height }: { run: Run; height: HeightFn }) {
   const marks = useMemo(() => Array.from({ length: TRACK_N }, () => ({ x: 0, z: 0, y: -50, yaw: 0, n: -1 })), []);
   const st = useRef({ head: 0, lastX: run.rover.x, lastZ: run.rover.z, n: 0 }).current;
   useFrame(() => {
      const r = run.rover;
      const d = Math.hypot(r.x - st.lastX, r.z - st.lastZ);
      if (d > 3) {
         // a jump (a fall put the rover back): start a new trail
         st.lastX = r.x;
         st.lastZ = r.z;
         return;
      }
      if (d < 0.32) return;
      st.lastX = r.x;
      st.lastZ = r.z;
      const fx = Math.sin(r.yaw);
      const fz = Math.cos(r.yaw);
      for (const side of [0.78, -0.78]) {
         const k = marks[st.head++ % TRACK_N];
         k.x = r.x - fz * side;
         k.z = r.z + fx * side;
         k.y = height(k.x, k.z) + 0.025;
         k.yaw = r.yaw;
         k.n = st.n++;
      }
   }, FRAME_PRIORITY.visuals - 0.01);
   const update = (i: number, m: Matrix4, color: Color) => {
      const k = marks[i];
      if (k.n < 0) return false;
      const age = (st.n - k.n) / TRACK_N;
      if (age >= 1) return false;
      V.set(k.x, k.y, k.z);
      E.set(0, k.yaw, 0);
      Q.setFromEuler(E);
      S.set(0.3, 1, 0.2);
      m.compose(V, Q, S);
      color.copy(TRACK).lerp(GROUND, age * 0.9);
   };
   return (
      <DynamicInstanced count={TRACK_N} update={update} name="tracks" tinted>
         <boxGeometry args={[1, 0.005, 1]} />
         <meshStandardMaterial transparent opacity={0.3} depthWrite={false} roughness={1} />
      </DynamicInstanced>
   );
}

/** A chevron on the ground ahead of the rover, pointing to `goal` (hidden when near it or when `goal.on` is false). */
export function GuideArrow({ run, height, goal, vis }: { run: Run; height: HeightFn; goal: { x: number; z: number; color: string; on: boolean }; vis: Vis }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   const geo = useGeo(() => {
      const s = new Shape();
      s.moveTo(0, 0.55);
      s.lineTo(0.5, -0.1);
      s.lineTo(0.22, -0.1);
      s.lineTo(0.22, -0.5);
      s.lineTo(-0.22, -0.5);
      s.lineTo(-0.22, -0.1);
      s.lineTo(-0.5, -0.1);
      s.closePath();
      // the arrow's tip along +z once laid flat
      return new ShapeGeometry(s).rotateX(-Math.PI / 2).rotateY(Math.PI);
   });
   const mat = useRef<import("three").MeshBasicMaterial>(null);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const r = run.rover;
      const dx = goal.x - r.x;
      const dz = goal.z - r.z;
      const d = Math.hypot(dx, dz);
      g.visible = goal.on && d > 6 && vis.winT < 0 && !run.over;
      if (!g.visible) return;
      const a = Math.atan2(dx, dz);
      const ahead = 3.2;
      const x = r.x + (dx / d) * ahead;
      const z = r.z + (dz / d) * ahead;
      g.position.set(x, height(x, z) + 0.35 + Math.sin(time.now * 5) * 0.08, z);
      g.rotation.set(0, a, 0);
      const s = 1 + Math.sin(time.now * 5) * 0.06;
      g.scale.set(s, s, s);
      if (mat.current) mat.current.color.set(goal.color);
   }, FRAME_PRIORITY.visuals);
   return (
      <group ref={ref}>
         <mesh geometry={geo} scale={1.25} renderOrder={4}>
            <meshBasicMaterial ref={mat} color={goal.color} transparent opacity={0.92} depthWrite={false} toneMapped={false} side={2} />
         </mesh>
      </group>
   );
}

