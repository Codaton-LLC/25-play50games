"use client";

// The playable tunnel, drawn from the rules (rules.ts / tunnel.ts): the blocks (one instanced mesh per
// look, the shared panel material), the fans (m2WindFan, turned to their direction with a quick turn
// animation, a spinning code rotor in each grille), the vents (m2AirVent) with a glowing column while
// they blow, the current streaks (one pool for every current: cyan, near white where currents add), the
// fan lifts (m2FanLiftPlatform), Riko's cracked covers (m2FlyingCrate, gone once broken), Vexa's ghost
// housings, Kiro's shock vents, the drones (m2FactoryDrone), the anemometers (m2AnemometerPost), the
// orbs (the shared scoreOrb) with halos, the checkpoint beacons, the secrets, the exit glow (level 5:
// the Tide Bell), the ghost hint of a room's setup, the storm front, and on level 5 the Gale Engine with
// its core, its crates and its blast.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
   AdditiveBlending,
   BoxGeometry,
   Color,
   CylinderGeometry,
   DoubleSide,
   Matrix4,
   PlaneGeometry,
   Quaternion,
   ShaderMaterial,
   Vector3,
   type Group,
   type Mesh,
   type MeshBasicMaterial,
   type MeshStandardMaterial,
} from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BOSS_SCALE, FAN_SCALE, GLB_SIZE, ORB_SIZE, VENT_SCALE } from "./assets";
import { BLOCK_LOOKS, COLORS, blockMaterial, glowTexture, lightningFlash } from "./look";
import { GALE_ENGINE, SECRETS } from "./progression";
import { DIR_X, DIR_Z, FAN_FACE, FAN_R, HUB, VENT_R, VENT_TOP, type BlockDef } from "./tunnel";
import { TURN_MS, bossVulnerable, dronePos, fanDir, fanLive, fanX, gateOpen, liveReach, type WindRun } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const M = new Matrix4();
const M2 = new Matrix4();
const Q = new Quaternion();
const V = new Vector3();
const S = new Vector3();
const UP = new Vector3(0, 1, 0);
const P = { x: 0, y: 0, z: 0 };

/** The yaw a fan model turns to so its grille (the GLB's -z side, hub cap and blades) faces direction index d. */
export function fanYaw(d: number): number {
   return Math.atan2(-DIR_X[d], -DIR_Z[d]);
}

/** The drawn yaw of fan i now: eased through a turn (a tap is 90° clockwise seen from above). */
function drawnYaw(run: WindRun, i: number, ms: number): number {
   const d = fanDir(run, i, ms);
   const target = fanYaw(d);
   const f = run.course.fans[i];
   let left = 0;
   if (f.autoMs) {
      const into = ms % f.autoMs;
      left = into < TURN_MS ? 1 - into / TURN_MS : 0;
   } else {
      const until = run.world.turnUntil[i];
      left = until > ms ? (until - ms) / TURN_MS : 0;
   }
   const k = left * left * (3 - 2 * left);
   return target + (Math.PI / 2) * k;
}

function boxSpot(b: BlockDef): InstanceSpot {
   return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2, sx: b.x1 - b.x0, sy: b.y1 - b.y0, sz: b.z1 - b.z0 };
}

const BOX = new BoxGeometry(1, 1, 1);

/** Static blocks: one instanced mesh per look (the shared panel material). */
function Blocks({ run }: { run: WindRun }) {
   const groups = useMemo(() => {
      const out: { look: keyof typeof BLOCK_LOOKS; spots: InstanceSpot[] }[] = [];
      for (const look of Object.keys(BLOCK_LOOKS) as (keyof typeof BLOCK_LOOKS)[]) {
         const spots = run.course.blocks.filter((b) => b.look === look && b.kind === "solid").map(boxSpot);
         if (spots.length) out.push({ look, spots });
      }
      return out;
   }, [run.course]);
   const mats = useMemo(() => groups.map((g) => blockMaterial(g.look)), [groups]);
   useEffect(() => () => mats.forEach((m) => m.dispose()), [mats]);
   return (
      <>
         {groups.map((g, k) => (
            <Instanced key={g.look} spots={g.spots} name={`blocks-${g.look}`}>
               <primitive object={BOX} attach="geometry" />
               <primitive object={mats[k]} attach="material" />
            </Instanced>
         ))}
      </>
   );
}

/** The engine's gate and the arena shutter (level 5), the covers (crates until Riko breaks them), the ghost housings. */
function SpecialBlocks({ run, clock }: { run: WindRun; clock: VisualClock }) {
   const c = run.course;
   const covers = useMemo(() => c.blocks.map((b, i) => ({ b, i })).filter((x) => x.b.kind === "cover"), [c]);
   const ghosts = useMemo(() => c.blocks.filter((b) => b.kind === "ghost").map(boxSpot), [c]);
   const shutter = useMemo(() => c.blocks.find((b) => b.kind === "shutter") ?? null, [c]);
   const gate = useMemo(() => c.blocks.find((b) => b.kind === "gate") ?? null, [c]);
   const ghostMat = useRef<MeshBasicMaterial>(null);
   const shutterRef = useRef<Mesh>(null);
   const gateRef = useRef<Mesh>(null);
   const time = useGameTime();
   const wallMat = useMemo(() => blockMaterial("wall"), []);
   useEffect(() => () => wallMat.dispose(), [wallMat]);
   useFrame(() => {
      if (ghostMat.current) ghostMat.current.opacity = 0.28 + 0.1 * Math.sin(time.now * 2.6);
      if (shutterRef.current) shutterRef.current.visible = run.world.bossAwake && !gateOpen(run);
      if (gateRef.current) gateRef.current.visible = !gateOpen(run);
      void clock;
   });
   const coverUpdate = (k: number, m: Matrix4) => {
      const { b, i } = covers[k];
      if (run.world.broken[i]) return false;
      const sx = (b.x1 - b.x0) / GLB_SIZE.crate.x;
      const sy = (b.y1 - b.y0) / GLB_SIZE.crate.y;
      const sz = (b.z1 - b.z0) / GLB_SIZE.crate.z;
      m.makeScale(sx, sy, sz);
      m.setPosition((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2);
   };
   return (
      <>
         {covers.length > 0 ? <DynamicInstancedModel asset={ASSETS.crate} count={covers.length} update={coverUpdate} name="covers" /> : null}
         {ghosts.length > 0 ? (
            <Instanced spots={ghosts} name="ghosts">
               <primitive object={BOX} attach="geometry" />
               <meshBasicMaterial ref={ghostMat} color={COLORS.ghost} transparent opacity={0.3} depthWrite={false} side={DoubleSide} toneMapped={false} />
            </Instanced>
         ) : null}
         {shutter ? (
            <mesh ref={shutterRef} position={[(shutter.x0 + shutter.x1) / 2, (shutter.y0 + shutter.y1) / 2, (shutter.z0 + shutter.z1) / 2]} visible={false}>
               <boxGeometry args={[shutter.x1 - shutter.x0, shutter.y1 - shutter.y0, 0.2]} />
               <meshBasicMaterial color={COLORS.storm} transparent opacity={0.35} depthWrite={false} side={DoubleSide} toneMapped={false} />
            </mesh>
         ) : null}
         {gate ? (
            <mesh ref={gateRef} position={[(gate.x0 + gate.x1) / 2, (gate.y0 + gate.y1) / 2, gate.z0 + 0.5]} material={wallMat}>
               <boxGeometry args={[gate.x1 - gate.x0, gate.y1 - gate.y0, 1]} />
            </mesh>
         ) : null}
      </>
   );
}

/** The fans (m2WindFan) and their spinning rotors; the vents (m2AirVent) and their glowing columns. */
function Fans({ run, clock }: { run: WindRun; clock: VisualClock }) {
   const c = run.course;
   const fans = useMemo(() => c.fans.map((f, i) => ({ f, i })).filter((x) => x.f.kind === "fan"), [c]);
   const vents = useMemo(() => c.fans.map((f, i) => ({ f, i })).filter((x) => x.f.kind === "vent" && x.f.lift === undefined), [c]);
   const spin = useRef(new Float64Array(c.fans.length));
   const time = useGameTime();
   const ventSpots = useMemo<InstanceSpot[]>(() => vents.map(({ f }) => ({ x: f.x, y: f.y, z: f.z, scale: VENT_SCALE })), [vents]);
   const lastNow = useRef(0);
   useFrame(() => {
      const dt = Math.min(0.1, Math.max(0, time.now - lastNow.current));
      lastNow.current = time.now;
      const ms = Math.max(0, clock.ms);
      for (const { i } of fans) spin.current[i] += dt * (fanLive(run, i, ms) ? 22 : run.world.on[i] ? 4 : 0);
   });
   const fanUpdate = (k: number, m: Matrix4, color: Color) => {
      const { f, i } = fans[k];
      const ms = Math.max(0, clock.ms);
      m.makeRotationY(drawnYaw(run, i, ms));
      m.scale(S.set(FAN_SCALE, FAN_SCALE, FAN_SCALE));
      m.setPosition(fanX(f, ms), f.y, f.z);
      if (f.boss === "side" && run.world.spent[i]) color.setRGB(0.45, 0.35, 0.35);
   };
   const rotorUpdate = (k: number, m: Matrix4, color: Color) => {
      const { f, i } = fans[k];
      const ms = Math.max(0, clock.ms);
      const yaw = drawnYaw(run, i, ms);
      M.makeRotationY(yaw);
      M2.makeTranslation(0, HUB, -FAN_FACE * 0.55);
      M.multiply(M2);
      M2.makeRotationZ(spin.current[i]);
      M.multiply(M2);
      m.copy(M);
      m.setPosition(V.set(fanX(f, ms), f.y, f.z).add(S.set(0, HUB, -FAN_FACE * 0.55).applyAxisAngle(UP, yaw)));
      const live = fanLive(run, i, ms);
      if (live) color.set(COLORS.current);
      else if (run.world.on[i]) color.setRGB(0.4, 0.5, 0.6);
      else color.setRGB(0.18, 0.2, 0.26);
   };
   const columnUpdate = (k: number, m: Matrix4) => {
      const { f, i } = vents[k];
      const ms = Math.max(0, clock.ms);
      if (!fanLive(run, i, ms)) return false;
      const reach = liveReach(run, i, ms);
      m.makeScale(VENT_R * 0.95, reach, VENT_R * 0.95);
      m.setPosition(f.x, f.y + VENT_TOP + reach / 2, f.z);
   };
   const columnMat = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new Color(COLORS.current) } },
            vertexShader: /* glsl */ `
               varying vec2 vUv;
               void main() {
                  vUv = uv;
                  vec4 p = vec4(position, 1.0);
                  #ifdef USE_INSTANCING
                     p = instanceMatrix * p;
                  #endif
                  gl_Position = projectionMatrix * modelViewMatrix * p;
               }`,
            fragmentShader: /* glsl */ `
               varying vec2 vUv;
               uniform float uTime;
               uniform vec3 uColor;
               void main() {
                  float rise = fract(vUv.y * 3.0 - uTime * 1.6);
                  float bands = smoothstep(0.0, 0.25, rise) * (1.0 - smoothstep(0.35, 0.6, rise));
                  float edge = 1.0 - smoothstep(0.75, 1.0, vUv.y);
                  float a = (0.10 + 0.32 * bands) * edge * smoothstep(0.0, 0.08, vUv.y);
                  gl_FragColor = vec4(uColor, a);
               }`,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: DoubleSide,
         }),
      [],
   );
   const columnGeo = useMemo(() => new CylinderGeometry(1, 1, 1, 20, 1, true), []);
   useEffect(
      () => () => {
         columnMat.dispose();
         columnGeo.dispose();
      },
      [columnMat, columnGeo],
   );
   useFrame(() => {
      columnMat.uniforms.uTime.value = time.now;
   });
   const rotorGeo = useMemo(() => {
      // five blades as a flat star in the grille
      const g = new CylinderGeometry(0.42, 0.42, 0.03, 5, 1);
      g.rotateX(Math.PI / 2);
      return g;
   }, []);
   useEffect(() => () => rotorGeo.dispose(), [rotorGeo]);
   return (
      <>
         {fans.length > 0 ? <DynamicInstancedModel asset={ASSETS.fan} count={fans.length} update={fanUpdate} name="fans" tinted /> : null}
         {fans.length > 0 ? (
            <DynamicInstanced count={fans.length} update={rotorUpdate} name="rotors" tinted>
               <primitive object={rotorGeo} attach="geometry" />
               <meshBasicMaterial color="#ffffff" transparent opacity={0.42} depthWrite={false} toneMapped={false} />
            </DynamicInstanced>
         ) : null}
         {ventSpots.length > 0 ? <InstancedModel asset={ASSETS.vent} spots={ventSpots} fallback={null} /> : null}
         {vents.length > 0 ? (
            <DynamicInstanced count={vents.length} update={columnUpdate} name="vent-columns">
               <primitive object={columnGeo} attach="geometry" />
               <primitive object={columnMat} attach="material" />
            </DynamicInstanced>
         ) : null}
      </>
   );
}

/** Current streaks: thin glints flowing along every live current (and the Gale Engine's blast). */
function Streaks({ run, clock }: { run: WindRun; clock: VisualClock }) {
   const c = run.course;
   const PER_FAN = 10;
   const PER_VENT = 7;
   const BOSS = c.arena ? 36 : 0;
   const slots = useMemo(() => {
      const s: { fan: number; seed: number }[] = [];
      c.fans.forEach((f, i) => {
         if (f.lift !== undefined) return;
         const n = f.kind === "vent" ? PER_VENT : PER_FAN;
         for (let k = 0; k < n; k++) s.push({ fan: i, seed: ((i * 977 + k * 7919) % 1000) / 1000 });
      });
      for (let k = 0; k < BOSS; k++) s.push({ fan: -1, seed: ((k * 7919) % 1000) / 1000 });
      return s;
   }, [c, BOSS]);
   const time = useGameTime();
   const update = (k: number, m: Matrix4, color: Color) => {
      const slot = slots[k];
      const ms = Math.max(0, clock.ms);
      const t = time.now;
      const s = slot.seed;
      const r1 = (s * 13.37) % 1;
      const r2 = (s * 71.3) % 1;
      if (slot.fan < 0) {
         const a = c.arena!;
         const b = run.world.boss;
         if (!b || !run.world.bossAwake || b.step !== "attack") return false;
         const len = a.z0 - a.z1;
         const ph = (s + t * (b.phase === 0 ? 1.4 : -1.1)) % 1;
         const p = ph < 0 ? ph + 1 : ph;
         const z = a.z1 + p * len;
         V.set((r1 * 2 - 1) * a.lane, a.floor + 0.4 + r2 * 4.5, z);
         Q.setFromAxisAngle(UP, 0);
         m.compose(V, Q, S.set(0.05, 0.05, 2.4));
         color.set(b.phase === 0 ? COLORS.stormRim : COLORS.storm);
         return;
      }
      const f = c.fans[slot.fan];
      if (!fanLive(run, slot.fan, ms)) return false;
      const reach = liveReach(run, slot.fan, ms);
      if (reach <= 0.3) return false;
      const speed = 1.2;
      const p = (s + (t * speed * 7) / Math.max(4, reach)) % 1;
      const ang = r1 * Math.PI * 2;
      const rad = Math.sqrt(r2) * (f.kind === "vent" ? VENT_R : FAN_R) * 0.85;
      if (f.kind === "vent") {
         V.set(f.x + Math.cos(ang) * rad, f.y + VENT_TOP + p * reach, f.z + Math.sin(ang) * rad);
         Q.setFromAxisAngle(S.set(1, 0, 0), Math.PI / 2);
         m.compose(V, Q, S.set(0.04, 0.04, 1.3));
         color.set(COLORS.current);
         return;
      }
      const d = fanDir(run, slot.fan, ms);
      const ox = fanX(f, ms) + DIR_X[d] * FAN_FACE;
      const oz = f.z + DIR_Z[d] * FAN_FACE;
      const lat = Math.cos(ang) * rad;
      V.set(ox + DIR_X[d] * p * reach - DIR_Z[d] * lat, f.y + HUB + Math.sin(ang) * rad, oz + DIR_Z[d] * p * reach + DIR_X[d] * lat);
      Q.setFromAxisAngle(UP, Math.atan2(DIR_X[d], DIR_Z[d]));
      m.compose(V, Q, S.set(0.04, 0.04, 1.6));
      // where currents add, the streaks run near white
      let n = 0;
      for (let j = 0; j < c.fans.length; j++) {
         if (j === slot.fan || c.fans[j].kind !== "fan" || !fanLive(run, j, ms)) continue;
         const g = c.fans[j];
         const dj = fanDir(run, j, ms);
         const gx = fanX(g, ms) + DIR_X[dj] * FAN_FACE;
         const gz = g.z + DIR_Z[dj] * FAN_FACE;
         const along = (V.x - gx) * DIR_X[dj] + (V.z - gz) * DIR_Z[dj];
         if (along < 0 || along > liveReach(run, j, ms)) continue;
         const l2 = (V.x - gx) * -DIR_Z[dj] + (V.z - gz) * DIR_X[dj];
         const v2 = V.y - (g.y + HUB);
         if (l2 * l2 + v2 * v2 < FAN_R * FAN_R) n += 1;
      }
      color.set(n > 0 ? COLORS.currentStrong : COLORS.current);
   };
   if (slots.length === 0) return null;
   return (
      <DynamicInstanced count={slots.length} update={update} name="streaks" tinted>
         <primitive object={BOX} attach="geometry" />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} toneMapped={false} />
      </DynamicInstanced>
   );
}

/** The fan lifts (m2FanLiftPlatform), riding their vents. */
function Lifts({ run }: { run: WindRun }) {
   const lifts = run.course.lifts;
   const update = (i: number, m: Matrix4) => {
      const l = lifts[i];
      m.makeScale((l.hw * 2) / GLB_SIZE.lift.x, 0.6 / GLB_SIZE.lift.y, (l.hd * 2) / GLB_SIZE.lift.z);
      m.setPosition(l.x, run.world.liftY[i] - 0.6, l.z);
   };
   if (lifts.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.lift} count={lifts.length} update={update} name="lifts" />;
}

/** Kiro's static-shock vents: a dark plate that crackles with green arcs. */
function Shocks({ run }: { run: WindRun }) {
   const shocks = run.course.shocks;
   const time = useGameTime();
   const plates = useMemo<InstanceSpot[]>(() => shocks.map((s) => ({ x: (s.x0 + s.x1) / 2, y: s.y0 + 0.04, z: (s.z0 + s.z1) / 2, sx: s.x1 - s.x0, sy: 0.08, sz: s.z1 - s.z0 })), [shocks]);
   const ARCS = 10;
   const arcs = (k: number, m: Matrix4) => {
      const s = shocks[Math.floor(k / ARCS)];
      const j = k % ARCS;
      const t = time.now * 9 + j * 1.7;
      if (Math.sin(t * 3.1 + j) < -0.2) return false;
      const fx = (Math.sin(t * 1.3 + j * 2.1) * 0.5 + 0.5) * (s.x1 - s.x0) + s.x0;
      const fz = (Math.cos(t * 0.9 + j) * 0.5 + 0.5) * (s.z1 - s.z0) + s.z0;
      const h = 0.6 + ((j * 37) % 10) / 10 * (s.y1 - s.y0 - 0.6);
      Q.setFromAxisAngle(S.set(Math.sin(t), 0, Math.cos(t)).normalize(), Math.sin(t * 2.3) * 0.5);
      m.compose(V.set(fx, s.y0 + h / 2, fz), Q, S.set(0.05, h, 0.05));
   };
   if (shocks.length === 0) return null;
   return (
      <>
         <Instanced spots={plates} name="shock-plates">
            <primitive object={BOX} attach="geometry" />
            <meshStandardMaterial color="#0f2419" emissive={COLORS.shock} emissiveIntensity={0.16} roughness={0.35} metalness={0.4} />
         </Instanced>
         <DynamicInstanced count={shocks.length * ARCS} update={arcs} name="shock-arcs">
            <primitive object={BOX} attach="geometry" />
            <meshBasicMaterial color={COLORS.shock} transparent opacity={0.9} toneMapped={false} blending={AdditiveBlending} depthWrite={false} />
         </DynamicInstanced>
      </>
   );
}

/** Patrol drones (m2FactoryDrone), swinging across the currents. */
function Drones({ run, clock }: { run: WindRun; clock: VisualClock }) {
   const c = run.course;
   const k = 1.5 / GLB_SIZE.drone.x;
   const update = (i: number, m: Matrix4) => {
      const ms = Math.max(0, clock.ms);
      dronePos(c, i, ms, P);
      const ahead = dronePos(c, i, ms + 60, { x: 0, y: 0, z: 0 });
      const yaw = ahead.x > P.x ? Math.PI / 2 : -Math.PI / 2;
      m.makeRotationY(yaw);
      m.scale(S.set(k, k, k));
      m.setPosition(P.x, P.y - (GLB_SIZE.drone.y * k) / 2, P.z);
   };
   if (c.drones.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.drone} count={c.drones.length} update={update} name="drones" />;
}

/** The anemometer posts: they spin slowly, fast once the right fan blows into them. */
function Anemometers({ run }: { run: WindRun }) {
   const c = run.course;
   const time = useGameTime();
   const angle = useRef(new Float64Array(c.anemos.length));
   const last = useRef(0);
   const k = 2.6 / GLB_SIZE.post.y;
   useFrame(() => {
      const dt = Math.min(0.1, Math.max(0, time.now - last.current));
      last.current = time.now;
      for (let i = 0; i < c.anemos.length; i++) angle.current[i] += dt * (run.world.anemoOpen[i] ? 14 : 0.8);
   });
   const update = (i: number, m: Matrix4) => {
      const a = c.anemos[i];
      m.makeRotationY(angle.current[i]);
      m.scale(S.set(k, k, k));
      m.setPosition(a.x, a.y, a.z);
   };
   if (c.anemos.length === 0) return null;
   return <DynamicInstancedModel asset={ASSETS.post} count={c.anemos.length} update={update} name="anemometers" />;
}

/** The colour orbs (the shared scoreOrb) with a soft halo; collected ones gone. */
function Orbs({ run }: { run: WindRun }) {
   const orbs = run.course.orbs;
   const time = useGameTime();
   const camera = useThree((s) => s.camera);
   const k = ORB_SIZE / GLB_SIZE.orb.x;
   const update = (i: number, m: Matrix4) => {
      if (run.world.collected[i]) return false;
      const o = orbs[i];
      m.makeRotationY(time.now * 2.2 + i);
      m.scale(S.set(k, k, k));
      m.setPosition(o.x, o.y - (GLB_SIZE.orb.y * k) / 2 + Math.sin(time.now * 2 + i * 0.7) * 0.1, o.z);
   };
   const halo = (i: number, m: Matrix4, color: Color) => {
      if (run.world.collected[i]) return false;
      const o = orbs[i];
      const s = ORB_SIZE * (2.2 + Math.sin(time.now * 3 + i) * 0.2);
      m.compose(V.set(o.x, o.y + Math.sin(time.now * 2 + i * 0.7) * 0.1, o.z), camera.quaternion, S.set(s, s, s));
      if (o.bonus) color.set(o.bonus === "vexa" ? "#c4b5fd" : o.bonus === "kiro" ? "#86efac" : o.bonus === "riko" ? "#fca5a5" : o.bonus === "zuno" ? "#fde68a" : "#93c5fd");
      else color.set(COLORS.orb);
   };
   const glow = useMemo(() => glowTexture(), []);
   const planeGeo = useMemo(() => new PlaneGeometry(1, 1), []);
   useEffect(
      () => () => {
         glow.dispose();
         planeGeo.dispose();
      },
      [glow, planeGeo],
   );
   if (orbs.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.orb} count={orbs.length} update={update} name="orbs" />
         <DynamicInstanced count={orbs.length} update={halo} name="orb-halos" tinted>
            <primitive object={planeGeo} attach="geometry" />
            <meshBasicMaterial map={glow} transparent opacity={0.7} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </DynamicInstanced>
      </>
   );
}

/** The checkpoint beacons (shared checkpointBeacon) at each room's respawn spot, a ring that lights once reached. */
function Beacons({ run }: { run: WindRun }) {
   const rooms = run.course.rooms;
   const spots = useMemo<InstanceSpot[]>(() => rooms.slice(1).map((r) => ({ x: r.checkpoint.x + 3.2, y: r.checkpoint.y, z: r.checkpoint.z, scale: 1.9 / GLB_SIZE.beacon.y, rotY: -0.5 })), [rooms]);
   const time = useGameTime();
   const ring = (i: number, m: Matrix4, color: Color) => {
      const r = rooms[i + 1];
      const lit = run.checkpoint >= i + 1;
      const s = lit ? 1 + Math.sin(time.now * 3 + i) * 0.05 : 0.9;
      m.makeRotationX(-Math.PI / 2);
      m.scale(S.set(s, s, s));
      m.setPosition(r.checkpoint.x, r.checkpoint.y + 0.04, r.checkpoint.z);
      color.set(lit ? "#fbbf24" : "#3b82f6");
   };
   const ringGeo = useMemo(() => {
      const g = new CylinderGeometry(1.25, 1.25, 0.02, 32, 1, true);
      return g;
   }, []);
   useEffect(() => () => ringGeo.dispose(), [ringGeo]);
   if (spots.length === 0) return null;
   return (
      <>
         <InstancedModel asset={ASSETS.beacon} spots={spots} fallback={null} />
         <DynamicInstanced count={spots.length} update={ring} name="checkpoint-rings" tinted>
            <ringGeometry args={[0.95, 1.2, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} toneMapped={false} side={DoubleSide} />
         </DynamicInstanced>
      </>
   );
}

/** The secrets: a glowing crystal (shard) or a round badge (sticker), hidden once found. */
function Secrets({ run }: { run: WindRun }) {
   const list = SECRETS[run.level];
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      list.forEach((_s, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6 + i;
         m.position.y = run.course.secrets[i].y + Math.sin(time.now * 2 + i) * 0.12;
      });
   });
   return (
      <>
         {list.map((s, i) => {
            const p = run.course.secrets[i];
            return (
               <mesh key={s.id} ref={(m) => { refs.current[i] = m; }} position={[p.x, p.y, p.z]}>
                  {s.kind === "shard" ? <octahedronGeometry args={[0.34, 0]} /> : <cylinderGeometry args={[0.36, 0.36, 0.06, 20]} />}
                  <meshStandardMaterial color={s.kind === "shard" ? "#bae6fd" : "#f9a8d4"} emissive={s.kind === "shard" ? "#38bdf8" : "#f472b6"} emissiveIntensity={1.1} roughness={0.3} />
               </mesh>
            );
         })}
      </>
   );
}

/** The exit: a bright doorway of open sky (levels 1-4), or the Tide Bell in the open sky (level 5). */
function Exit({ run }: { run: WindRun }) {
   const g = run.course.goal;
   const time = useGameTime();
   const mat = useRef<MeshBasicMaterial>(null);
   const bellMat = useRef<MeshStandardMaterial>(null);
   const swing = useRef<Group>(null);
   useFrame(() => {
      if (mat.current) mat.current.opacity = 0.45 + 0.15 * Math.sin(time.now * 2.4);
      const ready = gateOpen(run);
      if (bellMat.current) bellMat.current.emissiveIntensity = ready ? 0.7 + 0.3 * Math.sin(time.now * 3) : 0.12;
      if (swing.current) swing.current.rotation.z = run.ended === "win" ? Math.sin(time.now * 9) * 0.45 : Math.sin(time.now * 1.2) * 0.04;
   });
   const cx = (g.x0 + g.x1) / 2;
   const floor = g.y0 + 0.5;
   if (run.course.arena) {
      const b = run.course.bell;
      return (
         <group position={[b.x, b.y, b.z]}>
            {[-1.6, 1.6].map((x) => (
               <mesh key={x} position={[x, 2.1, 0]}>
                  <cylinderGeometry args={[0.12, 0.16, 4.2, 10]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} />
               </mesh>
            ))}
            <mesh position={[0, 4.25, 0]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.12, 0.12, 3.6, 10]} />
               <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.3} />
            </mesh>
            <group ref={swing} position={[0, 4.1, 0]}>
               <mesh position={[0, -0.6, 0]}>
                  <cylinderGeometry args={[0.2, 0.7, 1.1, 20, 1, true]} />
                  <meshStandardMaterial ref={bellMat} color="#facc15" emissive="#fbbf24" emissiveIntensity={0.2} metalness={0.6} roughness={0.3} side={DoubleSide} />
               </mesh>
               <mesh position={[0, -1.2, 0]}>
                  <sphereGeometry args={[0.14, 10, 8]} />
                  <meshStandardMaterial color="#b45309" />
               </mesh>
            </group>
         </group>
      );
   }
   return (
      <mesh position={[cx, floor + 2.2, g.z0 - 0.4]}>
         <planeGeometry args={[6.4, 4.4]} />
         <meshBasicMaterial ref={mat} color="#e0f2fe" transparent opacity={0.5} toneMapped={false} side={DoubleSide} depthWrite={false} />
      </mesh>
   );
}

/** After 20 s in an unsolved room: a faint gold ghost of the setup (an arrow per fan, a column per vent). */
function Hint({ run }: { run: WindRun }) {
   const time = useGameTime();
   const parts = useMemo(() => run.course.rooms.map((r) => r.solution), [run.course]);
   const MAX = 3;
   const update = (k: number, m: Matrix4) => {
      if (run.hint < 0) return false;
      const p = parts[run.hint][k];
      if (!p) return false;
      const f = run.course.fans[p.fan];
      const pulse = 0.85 + 0.15 * Math.sin(time.now * 4);
      if (f.kind === "vent") {
         const len = f.lift !== undefined ? 4 : f.length;
         m.makeScale(0.5 * pulse, len, 0.5 * pulse);
         m.setPosition(f.x, f.y + VENT_TOP + len / 2, f.z);
         return;
      }
      const d = p.dir ?? (p.notDir !== undefined ? (p.notDir + 1) % 4 : 0);
      if (p.notDir !== undefined && p.on === undefined && p.dir === undefined) {
         // a crosswind to switch off: a gold cross over the fan
         m.makeScale(1.2 * pulse, 0.12, 1.2 * pulse);
         m.setPosition(fanX(f, run.ms), f.y + 2.8, f.z);
         return;
      }
      Q.setFromAxisAngle(UP, Math.atan2(DIR_X[d], DIR_Z[d]));
      M.makeRotationFromQuaternion(Q);
      M2.makeRotationX(Math.PI / 2);
      M.multiply(M2);
      m.copy(M);
      m.scale(S.set(0.5 * pulse, 6, 0.5 * pulse));
      m.setPosition(fanX(f, run.ms) + DIR_X[d] * 3.6, f.y + HUB, f.z + DIR_Z[d] * 3.6);
   };
   return (
      <DynamicInstanced count={MAX} update={update} name="hint">
         <coneGeometry args={[1, 1, 12, 1, true]} />
         <meshBasicMaterial color={COLORS.hint} transparent opacity={0.28} depthWrite={false} toneMapped={false} side={DoubleSide} />
      </DynamicInstanced>
   );
}

const STORM_FRAG = /* glsl */ `
   varying vec2 vUv;
   uniform float uTime;
   uniform float uFlash;
   uniform vec3 uColor;
   uniform vec3 uRim;
   float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
   float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
   }
   void main() {
      vec2 p = vUv * vec2(6.0, 8.0);
      float n = noise(p + vec2(uTime * 0.4, -uTime * 0.7)) * 0.6 + noise(p * 2.3 - vec2(uTime * 0.9, uTime * 0.3)) * 0.4;
      float a = smoothstep(0.25, 0.8, n) * 0.75 + 0.18;
      vec3 c = mix(uColor, uRim, smoothstep(0.7, 0.95, n) * 0.6 + uFlash * 0.5);
      gl_FragColor = vec4(c, a * (0.75 + uFlash * 0.25));
   }
`;

/** The violet storm front: layered swirling sheets across the tunnel at the storm's z, flashing with lightning. */
function StormFront({ run }: { run: WindRun }) {
   const ref = useRef<Group>(null);
   const time = useGameTime();
   const mat = useMemo(
      () =>
         new ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uColor: { value: new Color(COLORS.storm) }, uRim: { value: new Color(COLORS.stormRim) } },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: STORM_FRAG,
            transparent: true,
            depthWrite: false,
            side: DoubleSide,
         }),
      [],
   );
   useEffect(() => () => mat.dispose(), [mat]);
   useFrame(() => {
      const g = ref.current;
      if (!g) return;
      const s = run.world.storm;
      g.visible = s.active;
      if (!s.active) return;
      const r = run.course.rooms[Math.min(run.course.rooms.length - 1, run.course.rooms.findIndex((q) => s.z > q.z1) < 0 ? 0 : run.course.rooms.findIndex((q) => s.z > q.z1))];
      g.position.set(0, (r?.floor ?? 0) + 4, s.z);
      mat.uniforms.uTime.value = time.now;
      mat.uniforms.uFlash.value = lightningFlash(time.now * 1.3);
   });
   return (
      <group ref={ref} visible={false}>
         {[0, 1.6, 3.4, 5.6].map((dz, i) => (
            <mesh key={i} position={[0, 0, dz]} material={mat} renderOrder={6}>
               <planeGeometry args={[16, 34 - i * 2]} />
            </mesh>
         ))}
      </group>
   );
}

const CORE_ON = new Color("#fde047");
const CORE_OFF = new Color("#7c3aed");

/** Level 5: the Gale Engine (m2GaleEngineBoss) at the arena's end, its core, its crates. */
function Boss({ run, clock }: { run: WindRun; clock: VisualClock }) {
   const a = run.course.arena!;
   const body = useRef<Group>(null);
   const core = useRef<Mesh>(null);
   const time = useGameTime();
   const lastHp = useRef(GALE_ENGINE.maxHp);
   const recoil = useRef(0);
   useFrame((_s, delta) => {
      const b = run.world.boss;
      const g = body.current;
      if (!b || !g) return;
      const dt = Math.min(0.1, delta);
      const done = b.step === "done";
      const defeat = b.step === "defeat";
      g.visible = !done;
      const sink = defeat ? Math.min(1, b.stepMs / GALE_ENGINE.defeatMs) : 0;
      if (b.hp < lastHp.current) recoil.current = 1;
      lastHp.current = b.hp;
      recoil.current = Math.max(0, recoil.current - dt * 2.5);
      const pulse = b.step === "telegraph" ? 1 + 0.05 * Math.sin(stepProgress(b, GALE_ENGINE) * Math.PI * 8) : 1;
      const flash = b.flashMs > 0 ? 1.06 : 1;
      g.position.set(a.engine.x + recoil.current * 0.3 * Math.sin(time.now * 40), a.engine.y - sink * 9, a.engine.z - recoil.current * 0.8);
      g.scale.setScalar(BOSS_SCALE * pulse * flash);
      g.rotation.x = (b.step === "attack" ? (b.phase === 0 ? -0.06 : 0.08) : 0) - recoil.current * 0.12 + sink * 0.4;
      g.rotation.z = sink * 0.35 + Math.sin(time.now * 0.8) * 0.02;
      const c = core.current;
      if (c) {
         c.visible = !done && run.world.bossAwake;
         const open = bossVulnerable(run);
         (c.material as MeshBasicMaterial).color.copy(open ? CORE_ON : CORE_OFF);
         const s = b.phase >= 1 ? 1.1 + (b.step === "attack" ? 0.25 * Math.sin(time.now * 14) : 0) : 0.8;
         c.scale.setScalar(s * (open ? 1 + 0.08 * Math.sin(time.now * 10) : 1));
         c.rotation.z = time.now * (b.step === "attack" ? 6 : 1.5);
      }
      void clock;
   });
   const crates = run.world.crates;
   const k = 1.3 / GLB_SIZE.crate.x;
   const crateUpdate = (i: number, m: Matrix4) => {
      const cr = crates[i];
      if (cr.state !== "live") return false;
      m.makeRotationY(time.now * 0.8 + i);
      m.scale(S.set(k, k, k));
      m.setPosition(cr.x, cr.y - 0.6, cr.z);
   };
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.boss} />
         </group>
         <mesh ref={core} position={[0, a.floor + GLB_SIZE.boss.y * BOSS_SCALE * 0.42, a.z1 + 0.6]} visible={false}>
            <circleGeometry args={[2.6, 6]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.85} toneMapped={false} side={DoubleSide} />
         </mesh>
         <DynamicInstancedModel asset={ASSETS.crate} count={crates.length} update={crateUpdate} name="boss-crates" />
      </>
   );
}

export function Course({ run, clock }: { run: WindRun; clock: VisualClock }) {
   return (
      <>
         <Blocks run={run} />
         <SpecialBlocks run={run} clock={clock} />
         <Fans run={run} clock={clock} />
         <Streaks run={run} clock={clock} />
         <Lifts run={run} />
         <Shocks run={run} />
         <Drones run={run} clock={clock} />
         <Anemometers run={run} />
         <Orbs run={run} />
         <Beacons run={run} />
         <Secrets run={run} />
         <Exit run={run} />
         <Hint run={run} />
         <StormFront run={run} />
         {run.course.arena ? <Boss run={run} clock={clock} /> : null}
      </>
   );
}
