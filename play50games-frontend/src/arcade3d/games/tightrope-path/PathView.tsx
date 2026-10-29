"use client";

// The walk drawn: rock-pillar tops (m2RockPillarBg columns from the river, a stone cap, a checkpoint
// beacon), the wide plank bridges (plankBridge), the narrow balance beams (m2BalanceBeam; the rotating
// ones spin 20 deg/s about their long axis), the ropes (a sagging code tube between posts; the dash
// ropes carry cracked planks), Vexa's ghost planks (faint, bright while she phases), the swinging
// sandbags (m2SwingSandbag under a crossbar), the orbs (the shared scoreOrb; the high ones over the
// gaps), Zuno's coin arcs in the mist, the lookout towers (m2LookoutTower; torches at night), the
// shard, and the gusts' leaves and mist streaks (one second ahead of the push).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, Object3D, Vector3, type Group, type InstancedMesh, type Mesh } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, BEACON_SCALE, BEAM_T, BEAM_W, GLB_SIZE, ORB_SIZE, PLANK_W, SANDBAG_SCALE, TOWER_SCALE } from "./assets";
import { PILLAR_R, linkPoint, type Course, type Link } from "./course";
import { COLORS, levelLook } from "./look";
import { bagPhase, gustState, type TightRun } from "./rules";

const rotOf = (l: Link): number => Math.atan2(-l.dz, l.dx);
const mid = (l: Link) => linkPoint(l, l.len / 2, { x: 0, y: 0, z: 0 });

function Pillars({ course }: { course: Course }) {
   const { columns, caps, beacons } = useMemo(() => {
      const columns: InstanceSpot[] = [];
      const caps: InstanceSpot[] = [];
      const beacons: InstanceSpot[] = [];
      for (const l of course.links) {
         if (l.kind !== "pillar") continue;
         const m = mid(l);
         const top = m.y - 0.18;
         columns.push({ x: m.x, y: -1, z: m.z, rotY: l.id * 1.3, sx: 3.4 / GLB_SIZE.pillar.x, sy: (top + 1) / GLB_SIZE.pillar.y, sz: 3.4 / GLB_SIZE.pillar.z });
         caps.push({ x: m.x, y: top, z: m.z, rotY: l.id * 0.7 });
         beacons.push({ x: m.x - l.dz * (PILLAR_R - 0.35), y: m.y, z: m.z + l.dx * (PILLAR_R - 0.35), rotY: rotOf(l), scale: BEACON_SCALE });
      }
      return { columns, caps, beacons };
   }, [course]);
   return (
      <>
         <InstancedModel
            asset={ASSETS.pillar}
            spots={columns}
            fallback={
               <Instanced spots={columns}>
                  <boxGeometry args={[GLB_SIZE.pillar.x, GLB_SIZE.pillar.y, GLB_SIZE.pillar.z]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.95} />
               </Instanced>
            }
         />
         <Instanced spots={caps}>
            <cylinderGeometry args={[PILLAR_R, PILLAR_R * 1.08, 0.36, 18]} />
            <meshStandardMaterial color={COLORS.rockTop} roughness={0.9} />
         </Instanced>
         <InstancedModel
            asset={ASSETS.beacon}
            spots={beacons}
            fallback={
               <Instanced spots={beacons}>
                  <cylinderGeometry args={[0.15, 0.2, 1.6, 8]} />
                  <meshStandardMaterial color={COLORS.moss} emissive={COLORS.moss} emissiveIntensity={0.6} />
               </Instanced>
            }
         />
      </>
   );
}

function Planks({ course }: { course: Course }) {
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const l of course.links) {
         if (l.kind !== "plank") continue;
         const m = mid(l);
         out.push({ x: m.x, y: m.y - 0.22, z: m.z, rotY: rotOf(l), sx: l.len / GLB_SIZE.plank.x, sy: 0.55, sz: PLANK_W / GLB_SIZE.plank.z });
      }
      return out;
   }, [course]);
   if (!spots.length) return null;
   return (
      <InstancedModel
         asset={ASSETS.plank}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <boxGeometry args={[GLB_SIZE.plank.x, 0.3, GLB_SIZE.plank.z]} />
               <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
            </Instanced>
         }
      />
   );
}

function Beams({ course }: { course: Course }) {
   const spots = useMemo(() => {
      const out: InstanceSpot[] = [];
      for (const l of course.links) {
         if (l.kind !== "beam") continue;
         const m = mid(l);
         out.push({ x: m.x, y: m.y - BEAM_T, z: m.z, rotY: rotOf(l), sx: l.len / GLB_SIZE.beam.x, sy: BEAM_T / GLB_SIZE.beam.y, sz: BEAM_W / GLB_SIZE.beam.z });
      }
      return out;
   }, [course]);
   if (!spots.length) return null;
   return (
      <InstancedModel
         asset={ASSETS.beam}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <boxGeometry args={[GLB_SIZE.beam.x, GLB_SIZE.beam.y, GLB_SIZE.beam.z]} />
               <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
            </Instanced>
         }
      />
   );
}

/** A rotating beam: 20 deg/s about its long axis (the walk's needle push is in rules.ts). */
function SpinBeam({ l }: { l: Link }) {
   const time = useGameTime();
   const ref = useRef<Group>(null);
   const m = mid(l);
   useFrame(() => {
      if (ref.current) ref.current.rotation.x = time.now * ((20 * Math.PI) / 180) * l.spin;
   });
   return (
      <group position={[m.x, m.y - BEAM_T / 2, m.z]} rotation-y={rotOf(l)}>
         <group ref={ref}>
            <Model asset={ASSETS.beam} position={[0, -BEAM_T / 2, 0]} scale={[l.len / GLB_SIZE.beam.x, BEAM_T / GLB_SIZE.beam.y, (BEAM_W * 1.15) / GLB_SIZE.beam.z]} />
         </group>
         {[-1, 1].map((e) => (
            <mesh key={e} position={[(e * l.len) / 2, -0.25, 0]} rotation-z={Math.PI / 2}>
               <cylinderGeometry args={[0.28, 0.28, 0.25, 14]} />
               <meshStandardMaterial color="#b08a4a" metalness={0.6} roughness={0.35} />
            </mesh>
         ))}
      </group>
   );
}

/** A rope: a sagging tube between two posts; a dash rope carries cracked red planks. */
function Rope({ l }: { l: Link }) {
   const curve = useMemo(() => {
      const pts: Vector3[] = [];
      const p = { x: 0, y: 0, z: 0 };
      for (let i = 0; i <= 14; i++) {
         linkPoint(l, (l.len * i) / 14, p);
         pts.push(new Vector3(p.x, p.y - 0.04, p.z));
      }
      return new CatmullRomCurve3(pts);
   }, [l]);
   const planks = useMemo(() => {
      if (l.kind !== "dash") return [];
      const out: InstanceSpot[] = [];
      const p = { x: 0, y: 0, z: 0 };
      for (let s = 0.4, i = 0; s < l.len - 0.3; s += 0.45, i++) {
         if (i % 4 === 3) continue;
         linkPoint(l, s, p);
         out.push({ x: p.x, y: p.y - 0.05, z: p.z, rotY: rotOf(l) + Math.PI / 2 + (i % 3) * 0.08 });
      }
      return out;
   }, [l]);
   const posts = [linkPoint(l, 0, { x: 0, y: 0, z: 0 }), linkPoint(l, l.len, { x: 0, y: 0, z: 0 })];
   return (
      <group>
         <mesh>
            <tubeGeometry args={[curve, 40, 0.055, 6, false]} />
            <meshStandardMaterial color={l.kind === "dash" ? COLORS.ropeDash : COLORS.rope} roughness={0.9} />
         </mesh>
         {posts.map((p, i) => (
            <group key={i} position={[p.x - l.dz * 0.45 * (i ? 1 : -1), p.y, p.z + l.dx * 0.45 * (i ? 1 : -1)]}>
               <mesh position={[0, 0.45, 0]}>
                  <cylinderGeometry args={[0.09, 0.11, 1.1, 8]} />
                  <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
               </mesh>
            </group>
         ))}
         {planks.length ? (
            <Instanced spots={planks}>
               <boxGeometry args={[0.32, 0.05, 0.24]} />
               <meshStandardMaterial color="#9a5a32" roughness={0.9} />
            </Instanced>
         ) : null}
      </group>
   );
}

/** Vexa's ghost planks: barely there, bright while she phases. */
function Ghost({ course, run }: { course: Course; run: TightRun }) {
   const ref = useRef<Mesh[]>([]);
   const ghosts = course.links.filter((l) => l.kind === "ghost");
   useFrame(() => {
      const on = run.simMs <= run.hero.phaseUntil;
      for (const m of ref.current) {
         if (!m) continue;
         const mat = m.material as { opacity: number };
         mat.opacity += ((on ? 0.55 : 0.07) - mat.opacity) * 0.1;
      }
   });
   return (
      <>
         {ghosts.map((l, i) => {
            const m = mid(l);
            return (
               <mesh
                  key={l.id}
                  ref={(x) => {
                     if (x) ref.current[i] = x;
                  }}
                  position={[m.x, m.y - 0.08, m.z]}
                  rotation-y={rotOf(l)}
               >
                  <boxGeometry args={[l.len, 0.12, 0.8]} />
                  <meshStandardMaterial color={COLORS.ghost} emissive={COLORS.ghost} emissiveIntensity={0.7} transparent opacity={0.07} depthWrite={false} />
               </mesh>
            );
         })}
      </>
   );
}

/** The sandbags: a crossbar over the walk, the bag swinging across it (rules.ts bagPhase). */
function Sandbags({ course, run }: { course: Course; run: TightRun }) {
   const swings = useRef<(Group | null)[]>([]);
   useFrame(() => {
      course.sandbags.forEach((b, i) => {
         const g = swings.current[i];
         if (g) g.rotation.x = Math.sin(2 * Math.PI * bagPhase(b, run.simMs)) * 0.75;
      });
   });
   return (
      <>
         {course.sandbags.map((b, i) => {
            const l = course.links[b.link];
            const p = linkPoint(l, b.s, { x: 0, y: 0, z: 0 });
            const top = p.y + 3.35;
            return (
               <group key={i} position={[p.x, 0, p.z]} rotation-y={rotOf(l)}>
                  {[-1, 1].map((e) => (
                     <mesh key={e} position={[0, top - 1.7, e * 1.9]}>
                        <cylinderGeometry args={[0.1, 0.13, 3.4, 8]} />
                        <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
                     </mesh>
                  ))}
                  <mesh position={[0, top, 0]} rotation-x={Math.PI / 2}>
                     <cylinderGeometry args={[0.09, 0.09, 3.9, 8]} />
                     <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
                  </mesh>
                  <group
                     position={[0, top, 0]}
                     ref={(g) => {
                        swings.current[i] = g;
                     }}
                  >
                     <Model asset={ASSETS.sandbag} position={[0, -2.4, 0]} rotation-y={Math.PI / 2} scale={SANDBAG_SCALE} />
                  </group>
               </group>
            );
         })}
      </>
   );
}

function Orbs({ course, run }: { course: Course; run: TightRun }) {
   const time = useGameTime();
   const refs = useRef<(Group | null)[]>([]);
   const spots = useMemo(() => course.orbs.map((o) => linkPoint(course.links[o.link], o.s, { x: 0, y: 0, z: 0 })), [course]);
   useFrame(() => {
      course.orbs.forEach((o, i) => {
         const g = refs.current[i];
         if (!g) return;
         g.visible = !run.taken[o.id];
         g.position.y = spots[i].y + (o.high ? 1.8 : 0.55) + Math.sin(time.now * 2 + i) * 0.08;
         g.rotation.y = time.now * 1.5 + i;
      });
   });
   return (
      <>
         {course.orbs.map((o, i) => (
            <group
               key={o.id}
               position={[spots[i].x, spots[i].y, spots[i].z]}
               ref={(g) => {
                  refs.current[i] = g;
               }}
            >
               <Model asset={ASSETS.orb} position={[0, -ORB_SIZE / 2, 0]} scale={ORB_SIZE / GLB_SIZE.orb.y} tint={o.high ? "#93c5fd" : undefined} />
            </group>
         ))}
      </>
   );
}

/** Zuno's coin arcs under the walk, glinting in the mist. */
function Coins({ course, run }: { course: Course; run: TightRun }) {
   const ref = useRef<InstancedMesh>(null);
   const time = useGameTime();
   const dummy = useMemo(() => new Object3D(), []);
   const base = useMemo(() => course.coins.map((k) => linkPoint(course.links[k.link], k.s, { x: 0, y: 0, z: 0 })), [course]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      course.coins.forEach((k, i) => {
         const p = base[i];
         const gone = run.coinTaken[k.id] === 1;
         dummy.position.set(p.x, p.y - 2.6 + Math.sin(time.now * 1.6 + i * 0.7) * 0.35, p.z);
         dummy.rotation.set(Math.PI / 2, 0, time.now * 3 + i);
         dummy.scale.setScalar(gone ? 0.0001 : 1);
         dummy.updateMatrix();
         m.setMatrixAt(i, dummy.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
   });
   if (!course.coins.length) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, course.coins.length]}>
         <cylinderGeometry args={[0.22, 0.22, 0.05, 16]} />
         <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.5} metalness={0.7} roughness={0.3} />
      </instancedMesh>
   );
}

function Towers({ course }: { course: Course }) {
   const night = levelLook(course.level).torches;
   const time = useGameTime();
   const flames = useRef<(Mesh | null)[]>([]);
   const spots = useMemo(
      () =>
         course.links
            .filter((l) => l.tower)
            .map((l, i) => {
               const m = mid(l);
               const side = i % 2 ? 1 : -1;
               // out past the camera's reach behind the hero (it orbits up to 6 m), the rope's towers a little closer
               const off = l.kind === "pillar" ? 7.5 : 5;
               return { x: m.x - l.dz * side * off, y: m.y - 4.5, z: m.z + l.dx * side * off, rot: rotOf(l) };
            }),
      [course],
   );
   useFrame(() => {
      flames.current.forEach((f, i) => {
         if (f) f.scale.setScalar(1 + Math.sin(time.now * 11 + i * 2) * 0.12);
      });
   });
   return (
      <>
         {spots.map((t, i) => (
            <group key={i} position={[t.x, t.y, t.z]}>
               <Model asset={ASSETS.tower} rotation-y={t.rot} scale={TOWER_SCALE} />
               <mesh position={[0, -2.5, 0]}>
                  <cylinderGeometry args={[1.6, 2.2, 5, 10]} />
                  <meshStandardMaterial color={COLORS.rock} roughness={0.95} />
               </mesh>
               <mesh
                  position={[0, 9.3, 0]}
                  ref={(m) => {
                     flames.current[i] = m;
                  }}
               >
                  <sphereGeometry args={[0.32, 10, 8]} />
                  <meshBasicMaterial color={COLORS.torch} toneMapped={false} />
               </mesh>
               {night && i < 4 ? <pointLight position={[0, 9.3, 0]} color={COLORS.torch} intensity={18} distance={16} decay={1.6} /> : null}
            </group>
         ))}
      </>
   );
}

function Shard({ course, run }: { course: Course; run: TightRun }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   const at = useMemo(() => (course.shard ? linkPoint(course.links[course.shard.link], course.shard.s, { x: 0, y: 0, z: 0 }) : null), [course]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      m.visible = !run.secrets.found[1];
      m.rotation.y = time.now * 2;
      m.position.y = (at?.y ?? 0) + 0.9 + Math.sin(time.now * 2.4) * 0.1;
   });
   if (!at) return null;
   return (
      <mesh ref={ref} position={[at.x, at.y + 0.9, at.z]}>
         <octahedronGeometry args={[0.3, 0]} />
         <meshStandardMaterial color={COLORS.ghost} emissive="#a78bfa" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
   );
}

/** The gusts: leaves and mist streaks blow across the walk a second before the push. */
function GustLeaves({ course, run }: { course: Course; run: TightRun }) {
   const N = 18;
   const ref = useRef<InstancedMesh>(null);
   const dummy = useMemo(() => new Object3D(), []);
   const total = course.gusts.length * N;
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const ms = run.simMs;
      const p = { x: 0, y: 0, z: 0 };
      course.gusts.forEach((g, gi) => {
         const l = course.links[g.link];
         const st = gustState(g, ms);
         const t = ((ms + g.offsetMs) % g.periodMs) / 1000;
         for (let k = 0; k < N; k++) {
            const i = gi * N + k;
            if (st === 0) {
               dummy.scale.setScalar(0.0001);
            } else {
               const s = g.s0 + ((k * 0.37) % 1) * (g.s1 - g.s0);
               linkPoint(l, s, p);
               const across = ((t * 4 + k * 0.53) % 3) - 1.5;
               const side = g.sign * across * 2.2;
               dummy.position.set(p.x - l.dz * side, p.y + 0.6 + ((k * 0.29) % 1) * 1.6 + Math.sin(t * 6 + k) * 0.2, p.z + l.dx * side);
               dummy.rotation.set(t * 5 + k, t * 3, k);
               dummy.scale.setScalar(st === 2 ? 1 : 0.7);
            }
            dummy.updateMatrix();
            m.setMatrixAt(i, dummy.matrix);
         }
      });
      m.instanceMatrix.needsUpdate = true;
   });
   if (!total) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, total]} frustumCulled={false}>
         <planeGeometry args={[0.18, 0.1]} />
         <meshBasicMaterial color={COLORS.gust} side={2} transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
   );
}

export function Path({ run }: { run: TightRun }) {
   const course = run.course;
   return (
      <group>
         <Pillars course={course} />
         <Planks course={course} />
         <Beams course={course} />
         {course.links
            .filter((l) => l.kind === "spin")
            .map((l) => (
               <SpinBeam key={l.id} l={l} />
            ))}
         {course.links
            .filter((l) => l.kind === "rope" || l.kind === "dash")
            .map((l) => (
               <Rope key={l.id} l={l} />
            ))}
         <Ghost course={course} run={run} />
         <Sandbags course={course} run={run} />
         <Orbs course={course} run={run} />
         <Coins course={course} run={run} />
         <Towers course={course} />
         <Shard course={course} run={run} />
         <GustLeaves course={course} run={run} />
      </group>
   );
}
