"use client";

// The playable sky, drawn from the rules (rules.ts / sea.ts): every cloud is m2CloudPlatformV2
// fitted with its crown on the collider top (the still ones instanced once; the sinking, drifting and
// pulsing ones a dynamic pool that squashes on a landing, sinks, thins out before it bursts and is
// hidden while it re-forms), feathers (m2Feather) that come back, the colour orbs (m2SkyStar; Zuno's
// hidden trail only shows under the magnet), wind and lift rings (m2WindRing), the rainbow bridge
// (m2RainbowBridge) with the Tide Bell, rainbow arches on the anchor clouds, storm-cloud walls and
// thunderheads (m2StormCloud), Vexa's ghost veils, rim strikes, wind streaks, the secrets, and on
// level 5 Gloom Nimbus (its own m2GloomNimbusBoss GLB, 11 m wide, m2StormCloud as the fallback; it
// faces you, leans in to attack, pulses on the telegraph, flashes and recoils on a hit, glows its eyes
// while open and sinks on its defeat), its rods, its eye ring and its hail.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Object3D, Vector3, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BOSS_SCALE, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { GLOOM_NIMBUS, SECRETS } from "./progression";
import { FEATHER, bossVulnerable, cloudTop, cloudX, pulseOn, strikeLive, type Cloud, type Course as CourseData, type CloudRun } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const SCRATCH = new Matrix4();
const SCALE = new Vector3();
const DUMMY = new Object3D();
const CLOUD_SY = 0.62;

function crownY(top: number, sy: number): number {
   return top - GLB_SIZE.cloud.top * sy;
}

function CloudFallback({ spots }: { spots: readonly InstanceSpot[] }) {
   if (spots.length === 0) return null;
   return (
      <Instanced spots={spots}>
         <sphereGeometry args={[0.5, 14, 10]} />
         <meshStandardMaterial color={COLORS.cloud} roughness={0.72} />
      </Instanced>
   );
}

function isLive(c: Cloud): boolean {
   return c.sinks || !!c.drift || !!c.pulse;
}

function useSpots(course: CourseData) {
   return useMemo(() => {
      const still: InstanceSpot[] = [];
      const live: number[] = [];
      const arches: InstanceSpot[] = [];
      const archScale = 4.6 / GLB_SIZE.rainbow.x;
      course.clouds.forEach((c, i) => {
         if (isLive(c)) live.push(i);
         else
            still.push({
               x: c.cx,
               y: crownY(c.top, CLOUD_SY),
               z: c.cz,
               rotY: (i % 5) * 0.4,
               sx: (c.hw * 2) / GLB_SIZE.cloud.x,
               sy: CLOUD_SY,
               sz: (c.hd * 2) / GLB_SIZE.cloud.z,
            });
         if (c.kind === "anchor") arches.push({ x: c.cx, y: c.top, z: c.cz - c.hd * 0.55, scale: archScale, rotY: 0 });
      });
      const rings: InstanceSpot[] = course.rings.map((r) => ({ x: r.x, y: r.y - (r.radius * 2 * 0.5), z: r.z, scale: (r.radius * 2) / GLB_SIZE.windRing.y, rotY: 0 }));
      const thunder: InstanceSpot[] = course.thunder.map((t, i) => {
         const k = (t.r * 2.3) / GLB_SIZE.storm.x;
         return { x: t.x, y: t.y - (GLB_SIZE.storm.y * k) / 2, z: t.z, scale: k, rotY: i * 1.3 };
      });
      return { still, live, arches, rings, thunder };
   }, [course]);
}

/** Wind streaks: one instanced mesh of thin quads drifting along each band's wind. */
function WindStreaks({ course, clock }: { course: CourseData; clock: VisualClock }) {
   const ref = useRef<InstancedMesh>(null);
   const per = 14;
   const count = course.bands.length * per;
   const seeds = useMemo(() => {
      const out: number[] = [];
      for (let i = 0; i < count; i++) out.push(((i * 7919) % 1000) / 1000);
      return out;
   }, [count]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const t = clock.ms / 1000;
      for (let b = 0; b < course.bands.length; b++) {
         const band = course.bands[b];
         const len = band.z0 - band.z1;
         const sp = Math.hypot(band.wx, band.wz) || 1;
         for (let k = 0; k < per; k++) {
            const i = b * per + k;
            const s = seeds[i];
            // travel along the wind, wrapping inside the band
            const phase = (s + (t * sp) / Math.max(10, len)) % 1;
            const z = band.wz !== 0 ? band.z0 - (band.wz < 0 ? phase : 1 - phase) * len : band.z1 + s * len;
            const x = band.wx !== 0 ? (band.wx > 0 ? -12 + phase * 24 : 12 - phase * 24) : -8 + ((s * 13.7) % 1) * 16;
            DUMMY.position.set(x, -1 + ((s * 7.3) % 1) * 6, z);
            DUMMY.rotation.set(0, Math.atan2(band.wx, band.wz), 0);
            DUMMY.scale.set(0.05, 0.05, 1.6 + s * 1.8);
            DUMMY.updateMatrix();
            m.setMatrixAt(i, DUMMY.matrix);
         }
      }
      m.instanceMatrix.needsUpdate = true;
   });
   if (count === 0) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </instancedMesh>
   );
}

/** The ghost veils (Vexa): soft violet panes that flicker; storm-cloud walls (Riko) drawn from m2StormCloud until broken. */
function Walls({ run }: { run: CloudRun }) {
   const course = run.course;
   const ghosts = course.walls.map((w, i) => ({ w, i })).filter((g) => g.w.kind === "ghost");
   const storms = course.walls.map((w, i) => ({ w, i })).filter((g) => g.w.kind === "storm");
   const ghostRefs = useRef<(Mesh | null)[]>([]);
   const stormRefs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      ghosts.forEach((g, k) => {
         const m = ghostRefs.current[k];
         if (m) (m.material as MeshBasicMaterial).opacity = 0.22 + 0.08 * Math.sin(time.now * 2.2 + k);
      });
      storms.forEach((g, k) => {
         const m = stormRefs.current[k];
         if (m) m.visible = !run.broken[g.i];
      });
   });
   return (
      <>
         {ghosts.map(({ w }, k) => (
            <mesh key={`g${k}`} ref={(m) => {
                  ghostRefs.current[k] = m;
               }} position={[(w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2]}>
               <boxGeometry args={[w.x1 - w.x0, w.y1 - w.y0, Math.abs(w.z1 - w.z0)]} />
               <meshBasicMaterial color="#c4b5fd" transparent opacity={0.25} depthWrite={false} side={DoubleSide} />
            </mesh>
         ))}
         {storms.map(({ w }, k) => {
            const len = Math.abs(w.z1 - w.z0);
            const h = w.y1 - w.y0;
            return (
               <group key={`s${k}`} ref={(g) => {
                  stormRefs.current[k] = g;
               }} position={[(w.x0 + w.x1) / 2, w.y0, (w.z0 + w.z1) / 2]}>
                  <InstancedModel
                     asset={ASSETS.storm}
                     spots={[0, 1, 2].map((j) => ({ x: 0, y: (j * h) / 3, z: -len / 2 + (len * (j + 0.5)) / 3, sx: 2.2 / GLB_SIZE.storm.x, sy: (h / 2.6) / GLB_SIZE.storm.y, sz: (len / 2.6) / GLB_SIZE.storm.z, rotY: j }))}
                     fallback={null}
                  />
               </group>
            );
         })}
      </>
   );
}

/** Rim strikes (level 4): a white-violet flash on the rim while live, a crackle glow just before. */
function Strikes({ run, clock }: { run: CloudRun; clock: VisualClock }) {
   const st = run.course.strikes;
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      st.forEach((s, i) => {
         const m = refs.current[i];
         if (!m) return;
         const c = run.course.clouds[s.cloud];
         const live = strikeLive(s, ms);
         const soon = strikeLive(s, ms + 450);
         m.visible = live || soon;
         m.position.set(cloudX(c, ms) + s.ox, c.top + (live ? 1.6 : 0.4), c.cz + s.oz);
         m.scale.set(live ? 1 : 0.5, live ? 3.2 : 0.5, live ? 1 : 0.5);
      });
   });
   return (
      <>
         {st.map((s, i) => (
            <mesh key={i} ref={(m) => {
                  refs.current[i] = m;
               }} visible={false}>
               <sphereGeometry args={[s.radius * 0.6, 10, 8]} />
               <meshBasicMaterial color="#e9d5ff" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** The secrets: a glowing crystal (shard) or a round badge (sticker), hidden once found. */
function Secrets({ run }: { run: CloudRun }) {
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
               <mesh key={s.id} ref={(m) => {
                  refs.current[i] = m;
               }} position={[p.x, p.y, p.z]}>
                  {s.kind === "shard" ? <octahedronGeometry args={[0.32, 0]} /> : <cylinderGeometry args={[0.34, 0.34, 0.06, 20]} />}
                  <meshStandardMaterial color={s.kind === "shard" ? "#bae6fd" : "#f9a8d4"} emissive={s.kind === "shard" ? "#7dd3fc" : "#f472b6"} emissiveIntensity={0.9} roughness={0.3} />
               </mesh>
            );
         })}
      </>
   );
}

/** The Tide Bell on the rainbow bridge: it glows once it can ring (level 5: the boss is down). */
function TideBell({ run }: { run: CloudRun }) {
   const g = run.course.clouds[run.course.goal];
   const mat = useRef<MeshStandardMaterial>(null);
   const swing = useRef<Group>(null);
   const time = useGameTime();
   useFrame(() => {
      const ready = !run.boss || run.boss.step === "defeat" || run.boss.step === "done";
      if (mat.current) mat.current.emissiveIntensity = ready ? 0.7 + 0.3 * Math.sin(time.now * 3) : 0.12;
      if (swing.current) swing.current.rotation.z = run.ended === "win" ? Math.sin(time.now * 9) * 0.45 : Math.sin(time.now * 1.2) * 0.04;
   });
   const archScale = 7.2 / GLB_SIZE.rainbow.x;
   return (
      <group position={[g.cx, g.top, g.cz - g.hd + 2.2]}>
         <InstancedModel asset={ASSETS.rainbow} spots={[{ x: 0, y: 0, z: 0, scale: archScale }]} fallback={null} />
         <group ref={swing} position={[0, archScale * GLB_SIZE.rainbow.y * 0.92, 0]}>
            <mesh position={[0, -0.55, 0]}>
               <cylinderGeometry args={[0.18, 0.62, 1.0, 18, 1, true]} />
               <meshStandardMaterial ref={mat} color="#facc15" emissive="#fbbf24" emissiveIntensity={0.2} metalness={0.6} roughness={0.3} side={DoubleSide} />
            </mesh>
            <mesh position={[0, -1.08, 0]}>
               <sphereGeometry args={[0.13, 10, 8]} />
               <meshStandardMaterial color="#b45309" />
            </mesh>
         </group>
      </group>
   );
}

const EYE_ON = new Color("#fef08a");
const EYE_OFF = new Color("#7c3aed");

/**
 * Gloom Nimbus (level 5): m2GloomNimbusBoss (BOSS_WIDTH wide), three eye glints, behind you in the
 * chase and ahead after; it turns to face you, leans in through an attack, recoils on a hit and rolls
 * as it sinks; its rods, ring and hail.
 */
function Boss({ run, clock }: { run: CloudRun; clock: VisualClock }) {
   const body = useRef<Group>(null);
   const eyes = useRef<(Mesh | null)[]>([]);
   const ring = useRef<Mesh>(null);
   const hail = useRef<Mesh>(null);
   const time = useGameTime();
   const pos = useRef({ x: 0, y: 0, z: run.chaseZ, placed: false });
   const k = BOSS_SCALE;
   const lastHp = useRef(GLOOM_NIMBUS.maxHp);
   const recoil = useRef(0);
   useFrame((_s, delta) => {
      const b = run.boss;
      const g = body.current;
      if (!b || !g) return;
      const h = run.hero;
      // where it hangs: on the chase line behind you, then out in front of you
      const tz = b.phase === 0 ? run.chaseZ + 3 : h.z - 22;
      const ty = (b.phase === 0 ? h.lastTop : h.lastTop + 4) + 1;
      const p = pos.current;
      const kz = p.placed ? 1 - Math.exp(-4 * Math.min(0.1, delta)) : 1;
      p.placed = true;
      p.z += (tz - p.z) * kz;
      p.y += (ty - p.y) * kz;
      p.x += (h.x * 0.5 - p.x) * kz;
      const done = b.step === "done";
      const defeat = b.step === "defeat";
      g.visible = !done;
      const sink = defeat ? Math.min(1, b.stepMs / GLOOM_NIMBUS.defeatMs) : 0;
      g.position.set(p.x, p.y - sink * 8 + Math.sin(time.now * 1.3) * 0.4, p.z);
      const flash = b.flashMs > 0 ? 1.15 : 1;
      const pulse = b.step === "telegraph" ? 1 + 0.06 * Math.sin(stepProgress(b, GLOOM_NIMBUS) * Math.PI * 6) : 1;
      g.scale.setScalar(k * flash * pulse * (1 - sink * 0.6));
      // reactions: face the hero, lean in through an attack, recoil on a hit, roll as it sinks
      if (b.hp < lastHp.current) recoil.current = 1;
      lastHp.current = b.hp;
      recoil.current = Math.max(0, recoil.current - Math.min(0.1, delta) * 3);
      const dt = Math.min(0.1, delta);
      const face = Math.atan2(h.x - p.x, h.z - p.z);
      let dy = face - g.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      g.rotation.y += dy * (1 - Math.exp(-3 * dt));
      const lean = b.step === "attack" ? 0.22 : b.step === "telegraph" ? -0.1 * stepProgress(b, GLOOM_NIMBUS) : 0;
      g.rotation.x += (lean - recoil.current * 0.35 - g.rotation.x) * (1 - Math.exp(-6 * dt));
      g.rotation.z = sink * 0.5 + Math.sin(time.now * 0.9 + b.phase) * 0.05 * (1 + b.phase) + recoil.current * 0.12 * Math.sin(time.now * 40);
      // gold only while it can be hit (a chase window with no charge stays violet)
      const open = bossVulnerable(run);
      eyes.current.forEach((m) => {
         if (!m) return;
         const mm = m.material as MeshBasicMaterial;
         mm.color.copy(open ? EYE_ON : EYE_OFF);
      });
      const r = ring.current;
      if (r) {
         r.visible = run.eye.live && b.phase >= 1;
         r.position.set(run.eye.x, run.eye.y, run.eye.z);
         const s = open ? 1 + 0.08 * Math.sin(time.now * 10) : 0.85;
         r.scale.setScalar(s);
         (r.material as MeshBasicMaterial).opacity = open ? 0.95 : 0.4;
      }
      const hm = hail.current;
      if (hm) {
         hm.visible = run.hail.live;
         hm.position.set(run.hail.x, h.lastTop + 0.05, run.hail.z);
         (hm.material as MeshBasicMaterial).opacity = b.step === "attack" ? 0.6 : 0.3 + 0.2 * Math.sin(clock.ms / 60);
      }
   });
   const rods = run.course.rods;
   return (
      <>
         <group ref={body}>
            <Model
               asset={ASSETS.boss}
               fallback={
                  // m2StormCloud at the boss's width if its own GLB fails
                  <group scale={GLB_SIZE.boss.x / GLB_SIZE.storm.x}>
                     <Model asset={ASSETS.storm} />
                  </group>
               }
            />
            {[-0.32, 0, 0.32].map((dx, i) => (
               <mesh key={i} ref={(m) => {
                  eyes.current[i] = m;
               }} position={[dx * 0.85, GLB_SIZE.boss.y * (i === 1 ? 0.6 : 0.565), GLB_SIZE.boss.z * 0.5]}>
                  {/* small glints inside the GLB's own three eye sockets (0.09 covered the face as 1 m discs) */}
                  <sphereGeometry args={[0.045, 12, 10]} />
                  <meshBasicMaterial color="#7c3aed" toneMapped={false} />
               </mesh>
            ))}
         </group>
         {rods.map((r, i) => (
            <group key={i} position={[r.x, r.y, r.z]}>
               <mesh position={[3.2, -1, 0]}>
                  <cylinderGeometry args={[0.06, 0.09, 6, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />
               </mesh>
               <mesh rotation-y={0}>
                  <torusGeometry args={[2.6, 0.07, 8, 40]} />
                  <meshBasicMaterial color="#fde047" transparent opacity={0.7} toneMapped={false} />
               </mesh>
            </group>
         ))}
         <mesh ref={ring} visible={false}>
            <torusGeometry args={[1.9, 0.12, 10, 44]} />
            <meshBasicMaterial color="#fef08a" transparent opacity={0.5} toneMapped={false} depthWrite={false} />
         </mesh>
         <mesh ref={hail} rotation-x={-Math.PI / 2} visible={false}>
            <circleGeometry args={[2.2, 28]} />
            <meshBasicMaterial color="#4c1d95" transparent opacity={0.4} depthWrite={false} />
         </mesh>
      </>
   );
}

export function Course({ run, clock, won }: { run: CloudRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;
   const feathers = course.feathers;

   const liveUpdate = (i: number, m: Matrix4) => {
      const index = spots.live[i];
      const c = course.clouds[index];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      const top = cloudTop(run, index, ms);
      if (!(top === top)) return false;
      let sx = 1;
      let sy = CLOUD_SY;
      const la = run.landAt[index];
      if (c.sinks && la >= 0) {
         const dt = ms - la;
         // a squash and spring on the landing, then the cloud thins before it bursts
         if (dt < 400) sy *= 1 - 0.18 * Math.sin((dt / 400) * Math.PI) * Math.exp(-dt / 300);
         const left = course.burstMs - dt;
         if (left < 700 && left > 0) {
            const k = left / 700;
            sy *= 0.4 + 0.6 * k;
            sx = 0.75 + 0.25 * k;
         }
      }
      if (c.pulse) {
         // a pulse cloud swells on the beat
         const beat = (ms / c.pulse.periodMs + c.pulse.phase) % 1;
         sx *= 0.95 + 0.08 * Math.max(0, 1 - beat * 3);
         if (!pulseOn(c, ms + 120)) sy *= 0.8;
      }
      SCRATCH.makeScale(((c.hw * 2) / GLB_SIZE.cloud.x) * sx, sy, ((c.hd * 2) / GLB_SIZE.cloud.z) * sx);
      m.copy(SCRATCH);
      m.setPosition(cloudX(c, ms), crownY(top, sy), c.cz);
   };

   const magnetUp = () => run.hero.magnetUntil >= run.simMs;
   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      if (o.hidden && !magnetUp()) return false;
      m.makeRotationY(time.now * 2.2 + i);
      const s = ORB_SIZE / GLB_SIZE.star.x;
      m.scale(SCALE.set(s, s, s));
      m.setPosition(o.x, o.y + Math.sin(time.now * 2 + i * 0.7) * 0.12, o.z);
   };

   const featherUpdate = (i: number, m: Matrix4) => {
      const at = run.featherAt[i];
      const ms = clock.ms < 0 ? 0 : clock.ms;
      if (at >= 0 && ms - at < FEATHER.respawnMs) return false;
      const f = feathers[i];
      const s = 0.8 / GLB_SIZE.feather.y;
      m.makeRotationY(time.now * 1.4 + i);
      m.scale(SCALE.set(s, s, s));
      m.setPosition(f.x, f.y - 0.4 + Math.sin(time.now * 2.4 + i) * 0.1, f.z);
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: o.hidden ? 1 : 0.55, g: o.hidden ? 0.9 : 0.85, b: 1 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      const mag = magnetUp();
      for (let i = 0; i < orbs.length; i++) {
         const hide = run.collected[i] || (orbs[i].hidden && !mag);
         const size = hide ? 0 : ORB_SIZE * (2.1 + Math.sin(time.now * 3 + i) * 0.2);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };

   void won;
   return (
      <>
         <InstancedModel asset={ASSETS.cloud} spots={spots.still} fallback={<CloudFallback spots={spots.still} />} />
         {spots.live.length > 0 ? <DynamicInstancedModel asset={ASSETS.cloud} count={spots.live.length} update={liveUpdate} name="live-clouds" /> : null}
         {feathers.length > 0 ? <DynamicInstancedModel asset={ASSETS.feather} count={feathers.length} update={featherUpdate} name="feathers" /> : null}
         {spots.arches.length > 0 ? <InstancedModel asset={ASSETS.rainbow} spots={spots.arches} fallback={null} /> : null}
         {spots.rings.length > 0 ? <InstancedModel asset={ASSETS.windRing} spots={spots.rings} fallback={null} /> : null}
         {spots.thunder.length > 0 ? <InstancedModel asset={ASSETS.storm} spots={spots.thunder} fallback={null} /> : null}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.star} count={orbs.length} update={orbUpdate} name="orbs" /> : null}
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
         <Walls run={run} />
         <Strikes run={run} clock={clock} />
         <WindStreaks course={course} clock={clock} />
         <Secrets run={run} />
         <TideBell run={run} />
         {run.boss ? <Boss run={run} clock={clock} /> : null}
      </>
   );
}
