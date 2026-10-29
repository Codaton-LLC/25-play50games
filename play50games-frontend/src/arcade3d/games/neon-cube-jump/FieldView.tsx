"use client";

// The cube field drawn from the rules every frame (no React state): solid cubes are the neon cube GLB
// (m2NeonCube, tinted per set), holograms a 25 % wireframe box; every A / B / rogue cube carries its
// glyph on top (square / triangle / ring), filled while solid and outlined as a hologram, so the state
// reads by shape and fill, not by hue. Neutral cubes carry an energy pad (m2EnergyPad); checkpoints and
// the goal a beacon. Laser walls (m2LaserWall) shine while their set is solid; sentry drones
// (m2NeonSentryDrone) dim while theirs is not. Orbs, Zuno's coins (m2DigitalCoin) inside the cubes,
// Vexa's ghost walls and crystals, the parity shard, Nami's ledge sticker, and the landing preview: a
// ring on the top the hero will land on.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Quaternion, Vector3, type Mesh } from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, BEACON_SCALE, COIN_SCALE, CUBE_STRETCH, DRONE_SCALE, GLB_SIZE, LASER_STRETCH, ORB_SIZE, PAD_SCALE } from "./assets";
import type { Cube } from "./course";
import { COLORS } from "./look";
import { SECRETS } from "./progression";
import { HERO_R, cubePos, cubeSolid, dronePos, laserLive, type NeonRun } from "./rules";

const UP = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);
const Q = new Quaternion();
const Q2 = new Quaternion();
const P = new Vector3();
const S = new Vector3();
const CP = { x: 0, z: 0 };
const DP = { x: 0, y: 0, z: 0 };
const FLAT = new Quaternion().setFromAxisAngle(X, -Math.PI / 2);

const TINT: Record<string, Color> = {
   A: new Color(COLORS.a).lerp(new Color("#ffffff"), 0.35),
   B: new Color(COLORS.b).lerp(new Color("#ffffff"), 0.35),
   R: new Color(COLORS.rogue).lerp(new Color("#ffffff"), 0.35),
   N: new Color(COLORS.neutral),
};
const GLOW: Record<string, Color> = { A: new Color(COLORS.a), B: new Color(COLORS.b), R: new Color(COLORS.rogue), N: new Color(COLORS.neutral) };
const DIM = new Color("#475569");

/** Is cube c drawn solid now (a phasing Vexa sees holograms too, but they stay holograms on screen)? */
const solidNow = (run: NeonRun, c: Cube) => cubeSolid(run, c);

function SolidCubes({ run }: { run: NeonRun }) {
   const cubes = run.course.cubes;
   return (
      <DynamicInstancedModel
         asset={ASSETS.cube}
         count={cubes.length}
         name="cubes-solid"
         update={(i, m: Matrix4, color?: Color) => {
            const c = cubes[i];
            if (!solidNow(run, c)) return false;
            cubePos(run, c, CP);
            P.set(CP.x, c.top - 2, CP.z);
            S.set(CUBE_STRETCH[0], CUBE_STRETCH[1], CUBE_STRETCH[2]);
            Q.identity();
            m.compose(P, Q, S);
            color?.copy(TINT[c.set]);
         }}
      />
   );
}

/** Holograms: a wireframe box and a faint fill, in the set's colour. */
function HoloCubes({ run }: { run: NeonRun }) {
   const cubes = run.course.cubes;
   const time = useGameTime();
   const update = (i: number, m: Matrix4, color?: Color) => {
      const c = cubes[i];
      if (c.set === "N" || solidNow(run, c)) return false;
      cubePos(run, c, CP);
      const pulse = 1 + Math.sin(time.now * 3 + i) * 0.01;
      P.set(CP.x, c.top - 1, CP.z);
      S.set(2 * pulse, 2 * pulse, 2 * pulse);
      Q.identity();
      m.compose(P, Q, S);
      color?.copy(GLOW[c.set]);
   };
   return (
      <>
         <DynamicInstanced count={cubes.length} update={update} name="cubes-holo-wire" tinted>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial wireframe transparent opacity={0.55} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={cubes.length} update={update} name="cubes-holo-fill" tinted>
            <boxGeometry args={[0.98, 0.98, 0.98]} />
            <meshBasicMaterial transparent opacity={0.1} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The glyphs on top: square (A), triangle (B), ring (rogue); filled solid, outlined hologram. */
function Glyphs({ run }: { run: NeonRun }) {
   const cubes = run.course.cubes;
   const make = (set: "A" | "B" | "R", filled: boolean) => (i: number, m: Matrix4, color?: Color) => {
      const c = cubes[i];
      if (c.set !== set || solidNow(run, c) !== filled) return false;
      cubePos(run, c, CP);
      P.set(CP.x, c.top + 0.03, CP.z);
      Q2.setFromAxisAngle(UP, set === "A" ? Math.PI / 4 : set === "B" ? Math.PI : 0);
      Q.copy(Q2).multiply(FLAT);
      S.set(1, 1, 1);
      m.compose(P, Q, S);
      color?.copy(GLOW[set]);
   };
   const fills = useMemo(() => ({ A: make("A", true), B: make("B", true), R: make("R", true), a: make("A", false), b: make("B", false), r: make("R", false) }), [run]); // eslint-disable-line react-hooks/exhaustive-deps
   const n = cubes.length;
   return (
      <>
         <DynamicInstanced count={n} update={fills.A} name="glyph-a" tinted>
            <circleGeometry args={[0.55, 4]} />
            <meshBasicMaterial toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.B} name="glyph-b" tinted>
            <circleGeometry args={[0.6, 3]} />
            <meshBasicMaterial toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.R} name="glyph-r" tinted>
            <ringGeometry args={[0.32, 0.55, 32]} />
            <meshBasicMaterial toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.a} name="glyph-a-outline" tinted>
            <ringGeometry args={[0.47, 0.55, 4]} />
            <meshBasicMaterial transparent opacity={0.7} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.b} name="glyph-b-outline" tinted>
            <ringGeometry args={[0.5, 0.6, 3]} />
            <meshBasicMaterial transparent opacity={0.7} toneMapped={false} />
         </DynamicInstanced>
         <DynamicInstanced count={n} update={fills.r} name="glyph-r-outline" tinted>
            <ringGeometry args={[0.48, 0.55, 32]} />
            <meshBasicMaterial transparent opacity={0.7} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** Pads on the neutral cubes (not the arena floor), beacons on checkpoints and the goal. */
function Fixtures({ run }: { run: NeonRun }) {
   const { pads, beacons } = useMemo(() => {
      const pads: InstanceSpot[] = [];
      const beacons: InstanceSpot[] = [];
      for (const c of run.course.cubes) {
         if (c.set !== "N" || c.arena) continue;
         pads.push({ x: c.x, y: c.top + 0.01, z: c.z, scale: PAD_SCALE });
         if (c.checkpoint || c.goal) beacons.push({ x: c.x + 0.75, y: c.top, z: c.z + 0.75, scale: BEACON_SCALE * (c.goal ? 1.6 : 1) });
      }
      return { pads, beacons };
   }, [run]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.pad}
            spots={pads}
            fallback={
               <Instanced spots={pads}>
                  <cylinderGeometry args={[0.8, 0.8, 0.1, 24]} />
                  <meshStandardMaterial color={COLORS.b} emissive={COLORS.b} emissiveIntensity={0.6} />
               </Instanced>
            }
         />
         <InstancedModel
            asset={ASSETS.beacon}
            spots={beacons}
            fallback={
               <Instanced spots={beacons}>
                  <cylinderGeometry args={[0.15, 0.2, 1.5, 8]} />
                  <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={0.7} />
               </Instanced>
            }
         />
      </>
   );
}

function Lasers({ run }: { run: NeonRun }) {
   const cubes = useMemo(() => run.course.cubes.filter((c) => c.laser), [run]);
   const frames = useMemo(() => cubes.map((c) => ({ x: c.x, y: c.top, z: c.z, sx: LASER_STRETCH[0], sy: LASER_STRETCH[1], sz: LASER_STRETCH[2] })), [cubes]);
   const time = useGameTime();
   if (!cubes.length) return null;
   return (
      <>
         <InstancedModel
            asset={ASSETS.laser}
            spots={frames}
            fallback={
               <Instanced spots={frames}>
                  <boxGeometry args={[GLB_SIZE.laser.x, 0.1, GLB_SIZE.laser.z]} />
                  <meshStandardMaterial color="#475569" />
               </Instanced>
            }
         />
         <DynamicInstanced
            count={cubes.length}
            name="laser-beams"
            tinted
            update={(i, m: Matrix4, color?: Color) => {
               const c = cubes[i];
               if (!laserLive(run, c)) return false;
               P.set(c.x, c.top + 1.05, c.z);
               Q.identity();
               S.set(1.85, 1.6 * (0.96 + Math.sin(time.now * 30 + i) * 0.04), 1);
               m.compose(P, Q, S);
               color?.copy(GLOW[c.laser!]);
            }}
         >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0.55} side={2} depthWrite={false} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

function Drones({ run }: { run: NeonRun }) {
   const drones = run.course.drones;
   const time = useGameTime();
   if (!drones.length) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.drone}
         count={drones.length}
         name="drones"
         update={(i, m: Matrix4, color?: Color) => {
            const d = drones[i];
            dronePos(d, run.simMs, DP);
            const on = run.solid === d.set;
            P.set(DP.x, DP.y - 0.3 + (on ? Math.sin(time.now * 6 + i) * 0.06 : -0.25), DP.z);
            Q.setFromAxisAngle(UP, time.now * (on ? 1.5 : 0.3));
            const s = DRONE_SCALE * (on ? 1 : 0.85);
            S.set(s, s, s);
            m.compose(P, Q, S);
            color?.copy(on ? GLOW[d.set] : DIM);
         }}
      />
   );
}

function Orbs({ run }: { run: NeonRun }) {
   const orbs = run.course.orbs;
   const time = useGameTime();
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={orbs.length}
         name="orbs"
         update={(i, m: Matrix4) => {
            if (run.taken[i]) return false;
            const o = orbs[i];
            P.set(o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i) * 0.08, o.z);
            Q.setFromAxisAngle(UP, time.now * 1.5 + i);
            const s = ORB_SIZE / GLB_SIZE.orb.y;
            S.set(s, s, s);
            m.compose(P, Q, S);
         }}
      />
   );
}

function Coins({ run }: { run: NeonRun }) {
   const coins = run.course.coins;
   const time = useGameTime();
   if (!coins.length) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.coin}
         count={coins.length}
         name="coins"
         update={(i, m: Matrix4) => {
            if (run.coinTaken[i]) return false;
            const o = coins[i];
            P.set(o.x, o.y - 0.27, o.z);
            Q.setFromAxisAngle(UP, time.now * 2.4 + i);
            S.set(COIN_SCALE, COIN_SCALE, COIN_SCALE);
            m.compose(P, Q, S);
         }}
      />
   );
}

/** Vexa's ghost walls (faint, bright while she phases), their crystals, the parity shard, Nami's ledge sticker. */
function Secrets({ run }: { run: NeonRun }) {
   const c = run.course;
   const time = useGameTime();
   const walls = useRef<(Mesh | null)[]>([]);
   const gems = useRef<(Mesh | null)[]>([]);
   const shard = useRef<Mesh>(null);
   const ledge = useRef<Mesh>(null);
   useFrame(() => {
      const phasing = run.simMs <= run.hero.phaseUntil;
      walls.current.forEach((w) => {
         if (!w) return;
         const mat = w.material as { opacity: number };
         mat.opacity += ((phasing ? 0.15 : 0.45) - mat.opacity) * 0.15;
      });
      gems.current.forEach((g, i) => {
         if (!g) return;
         const id = c.ghostWalls[i].id === 0 ? "ghost-a" : run.level === 3 ? "ghost-a" : "ghost-b";
         const idx = SECRET_INDEX(run, id);
         g.visible = idx < 0 || !run.secrets.found[idx];
         g.rotation.y = time.now * 2 + i;
      });
      const sh = shard.current;
      if (sh) {
         sh.visible = !run.secrets.found[SECRET_INDEX(run, "parity")];
         sh.rotation.y = time.now * 1.6;
         // bright on an even jump count (it can be taken), dim on odd
         sh.scale.setScalar(run.parity % 2 === 0 ? 1 : 0.7);
      }
      const le = ledge.current;
      if (le) {
         le.visible = !run.secrets.found[SECRET_INDEX(run, "ledge")];
         le.rotation.y = time.now * 1.8;
      }
   });
   return (
      <>
         {c.ghostWalls.map((w, i) => (
            <group key={w.id}>
               <mesh
                  ref={(m) => {
                     walls.current[i] = m;
                  }}
                  position={[w.x, w.y, w.z]}
               >
                  <boxGeometry args={[w.normal === "x" ? 0.12 : 2, 2.4, w.normal === "x" ? 2 : 0.12]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.6} transparent opacity={0.45} depthWrite={false} />
               </mesh>
               <mesh
                  ref={(m) => {
                     gems.current[i] = m;
                  }}
                  position={[w.crystal.x, w.crystal.y, w.crystal.z]}
               >
                  <octahedronGeometry args={[0.32, 0]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive="#a78bfa" emissiveIntensity={1.4} toneMapped={false} />
               </mesh>
            </group>
         ))}
         <mesh ref={shard} position={[c.shard.x, c.shard.y, c.shard.z]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial color={COLORS.shard} emissive={COLORS.shard} emissiveIntensity={1.2} toneMapped={false} />
         </mesh>
         {c.ledge ? (
            <mesh ref={ledge} position={[c.ledge.x, c.ledge.y, c.ledge.z]}>
               <torusKnotGeometry args={[0.2, 0.07, 48, 8]} />
               <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
         ) : null}
      </>
   );
}

function SECRET_INDEX(run: NeonRun, id: string): number {
   return SECRETS[run.level].findIndex((s) => s.id === id);
}

/** The landing preview: a ring on the top the hero will come down on (the solid set, or a phasing Vexa's hologram). */
function LandingPreview({ run }: { run: NeonRun }) {
   const ref = useRef<Mesh>(null);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const h = run.hero;
      if (h.ground >= 0 || h.deadMs >= 0) {
         m.visible = false;
         return;
      }
      let best: Cube | null = null;
      for (const c of run.course.cubes) {
         if (c.top > h.y + 0.05) continue;
         const phasing = run.simMs <= h.phaseUntil;
         if (!cubeSolid(run, c) && !(phasing && (c.set === "A" || c.set === "B"))) continue;
         cubePos(run, c, CP);
         if (Math.abs(h.x - CP.x) > 1 + HERO_R * 0.6 || Math.abs(h.z - CP.z) > 1 + HERO_R * 0.6) continue;
         if (!best || c.top > best.top) best = c;
      }
      m.visible = !!best;
      if (best) m.position.set(h.x, best.top + 0.05, h.z);
   });
   return (
      <mesh ref={ref} rotation-x={-Math.PI / 2} renderOrder={3}>
         <ringGeometry args={[0.36, 0.48, 32]} />
         <meshBasicMaterial color={COLORS.preview} transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
   );
}

export function Field({ run }: { run: NeonRun }) {
   return (
      <group>
         <SolidCubes run={run} />
         <HoloCubes run={run} />
         <Glyphs run={run} />
         <Fixtures run={run} />
         <Lasers run={run} />
         <Drones run={run} />
         <Orbs run={run} />
         <Coins run={run} />
         <Secrets run={run} />
         <LandingPreview run={run} />
      </group>
   );
}

