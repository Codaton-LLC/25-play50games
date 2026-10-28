"use client";

// The ride's props, drawn from the rules (rules.ts / waves.ts): the colour orbs (m2AquaOrb, spinning;
// Zuno's hidden trail shows only under his magnet), buoys (m2MarkerBuoy, bobbing and tilted with the
// face), sea rocks (m2SeaRock: the hazards, the reef ridges of the side lanes and level 4's canyon
// shelf), Riko's cracked reef walls (rocks with glowing cracks that burst when dashed), Vexa's ghost
// arches (menu2/props ArchWall in violet, a shimmering pane in the doorway), the lip gates
// (m2NeutralRing), jellies (m2SlimeBlob in jelly blue), diving gulls (m2SeaGullDiver, with their
// shadow telegraph), Kiro's violet storm spray, the checkpoint beacons (menu2's checkpointBeacon), the
// secrets, the finish line and the lagoon's sand bar, and on level 5 King Breaker (m2GiantCrabBoss),
// its claw shadow, its bubble mines and the Tide Bell.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Matrix4, Object3D, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ArchWall, ARCH_WALL_SIZE } from "@/arcade3d/menu2/props";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BUOY_HEIGHT, CRAB_SCALE, GLB_SIZE, GULL_SPAN, JELLY_WIDTH, ORB_SIZE } from "./assets";
import { COLORS, HAZARD } from "./look";
import { FACE_W, LANE, faceSlope, faceY } from "./waves";
import { KING_BREAKER, SECRETS } from "./progression";
import { GULL, bossAlive, bossVulnerable, gullBeat, jellyX, type SurfRun } from "./rules";
import type { VisualClock } from "./Wave";

const DUMMY = new Object3D();
const TINT_HIDDEN = new Color("#bae6fd");
const TINT_BONUS = new Color("#e0f2fe");
const JELLY_ASSET = { ...ASSETS.jelly, material: { color: "#7dd3fc", roughness: 0.18, metalness: 0, emissive: "#0e5f80" } };

function place(matrix: Matrix4, x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number, sy = s): void {
   DUMMY.position.set(x, y, z);
   DUMMY.rotation.set(rx, ry, rz, "YXZ");
   DUMMY.scale.set(s, sy, s);
   DUMMY.updateMatrix();
   matrix.copy(DUMMY.matrix);
}

/** The face's roll at x (rad about z): props stand square to the water. */
function roll(x: number, H: number): number {
   return Math.atan(faceSlope(x, H));
}

function Orbs({ run, clock }: { run: SurfRun; clock: VisualClock }) {
   const c = run.course;
   const time = useGameTime();
   const s = ORB_SIZE / GLB_SIZE.orb.y;
   return (
      <DynamicInstancedModel
         asset={ASSETS.orb}
         count={c.orbs.length}
         update={(i, m, color) => {
            if (run.collected[i]) return false;
            const o = c.orbs[i];
            const h = run.hero;
            if (Math.abs(o.z - h.z) > 170 || o.z - h.z > 20) return false;
            const magnet = clock.ms <= h.magnetUntil;
            if (o.hidden && !magnet) return false;
            if (o.hidden) color.copy(TINT_HIDDEN);
            else if (o.kind === "bonus") color.copy(TINT_BONUS);
            const bob = Math.sin(time.now * 2.4 + i) * 0.08;
            place(m, o.x, o.y - ORB_SIZE / 2 + bob, o.z, 0, time.now * 2.2 + i * 0.7, 0, s);
         }}
      />
   );
}

function Buoys({ run }: { run: SurfRun }) {
   const c = run.course;
   const time = useGameTime();
   const s = BUOY_HEIGHT / GLB_SIZE.buoy.y;
   if (c.buoys.length === 0) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.buoy}
         count={c.buoys.length}
         update={(i, m) => {
            const b = c.buoys[i];
            const hit = clock(run) - run.buoyAt[i];
            const knock = hit < 600 ? Math.sin((hit / 600) * Math.PI) * 0.5 : 0;
            const bob = Math.sin(time.now * 1.8 + i * 1.3) * 0.12;
            place(m, b.x, faceY(b.x, c.H) - 0.35 + bob, b.z, Math.sin(time.now * 1.3 + i) * 0.08 + knock, 0, -roll(b.x, c.H) * 0.6, s);
         }}
      />
   );
}

const clock = (run: SurfRun) => run.simMs;

function useRockSpots(run: SurfRun): InstanceSpot[] {
   return useMemo(() => {
      const c = run.course;
      const out: InstanceSpot[] = [];
      for (const r of c.rocks) {
         const k = (r.r * 2.1) / GLB_SIZE.rock.x;
         out.push({ x: r.x, y: faceY(r.x, c.H) - r.r * 0.35, z: r.z, rotY: r.x * 1.7 + r.z, sx: k, sy: k * 1.5, sz: k });
      }
      // the side lanes' reef ridges
      for (const l of c.lanes) {
         for (let z = l.z0; z >= l.z1; z -= 3.2) {
            const k = (1.5 + ((Math.abs(z) * 7.3) % 1) * 0.6) / GLB_SIZE.rock.x;
            out.push({ x: (LANE.x1 + 0) / 2 - 0.1, y: -0.35, z, rotY: z * 0.9, sx: k, sy: k * 1.1, sz: k });
         }
      }
      // level 4: the canyon's rock shelf where the trough was
      for (const n of c.narrows) {
         for (let z = n.z0; z >= n.z1; z -= 3.6) {
            const j = (Math.abs(z) * 3.7) % 1;
            const k = (3.4 + j * 1.4) / GLB_SIZE.rock.x;
            out.push({ x: n.lo - 1.6 - j * 0.8, y: -0.4, z, rotY: z * 1.3, sx: k, sy: k * (1.4 + j), sz: k });
         }
      }
      return out;
   }, [run.course]);
}

function Rocks({ run }: { run: SurfRun }) {
   const spots = useRockSpots(run);
   if (spots.length === 0) return null;
   return (
      <InstancedModel
         asset={ASSETS.rock}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <dodecahedronGeometry args={[0.9, 0]} />
               <meshStandardMaterial color={COLORS.reef} roughness={0.9} flatShading />
            </Instanced>
         }
      />
   );
}

/** Riko's cracked reef walls: a pile of rocks across each lane mouth with glowing cracks; they burst once dashed. */
function CrackedWalls({ run }: { run: SurfRun }) {
   const c = run.course;
   const walls = useMemo(() => c.lanes.map((l, i) => ({ l, i })).filter((w) => w.l.kind === "cracked"), [c]);
   const per = 3;
   const glow = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      walls.forEach((w, k) => {
         const m = glow.current[k];
         if (!m) return;
         m.visible = run.laneOpen[w.i] === 0;
         (m.material as MeshBasicMaterial).opacity = 0.55 + 0.3 * Math.sin(time.now * 4 + k);
      });
   });
   if (walls.length === 0) return null;
   const s = 1.7 / GLB_SIZE.rock.x;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.rock}
            count={walls.length * per}
            update={(i, m) => {
               const w = walls[Math.floor(i / per)];
               const k = i % per;
               if (run.laneOpen[w.i]) return false;
               const x = LANE.x0 + 0.8 + k * ((LANE.x1 - LANE.x0 - 1.6) / (per - 1));
               place(m, x, -0.3, w.l.z0, 0, k * 1.9 + w.i, 0, s, s * 1.9);
            }}
         />
         {walls.map((w, k) => (
            <mesh key={k} ref={(el) => {
                  glow.current[k] = el;
               }} position={[(LANE.x0 + LANE.x1) / 2, 0.9, w.l.z0 + 0.6]}>
               <planeGeometry args={[LANE.x1 - LANE.x0, 1.6]} />
               <meshBasicMaterial color="#fb923c" transparent opacity={0.6} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** Vexa's ghost arches: a violet arch across the lane mouth, a shimmering pane in its doorway. */
function GhostArches({ run }: { run: SurfRun }) {
   const c = run.course;
   const arches = useMemo(() => c.lanes.filter((l) => l.kind === "ghost"), [c]);
   const panes = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      panes.current.forEach((m, k) => {
         if (m) (m.material as MeshBasicMaterial).opacity = 0.28 + 0.12 * Math.sin(time.now * 2.6 + k);
      });
   });
   const w = (LANE.x1 - LANE.x0) / ARCH_WALL_SIZE.w;
   return (
      <>
         {arches.map((l, k) => (
            <group key={k} position={[(LANE.x0 + LANE.x1) / 2, -0.2, l.z0]} scale={[w, 1.1, 1]}>
               <ArchWall color="#8b7bd8" accent={HAZARD.glow} />
               <mesh ref={(el) => {
                  panes.current[k] = el;
               }} position={[0, 1.4, 0.25]}>
                  <planeGeometry args={[ARCH_WALL_SIZE.w * 0.98, 2.8]} />
                  <meshBasicMaterial color={HAZARD.glow} transparent opacity={0.3} depthWrite={false} side={DoubleSide} toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Gates({ run }: { run: SurfRun }) {
   const c = run.course;
   const time = useGameTime();
   if (c.gates.length === 0) return null;
   return (
      <DynamicInstancedModel
         asset={ASSETS.ring}
         count={c.gates.length}
         update={(i, m, color) => {
            const g = c.gates[i];
            const s = (g.r * 2.3) / GLB_SIZE.ring.x;
            if (run.gatePassed[i]) color.setRGB(1, 0.86, 0.4);
            // the ring stands up facing the ride (the GLB lies flat): a quarter turn about x
            DUMMY.position.set(g.x, g.y, g.z);
            DUMMY.rotation.set(Math.PI / 2, 0, Math.sin(time.now * 1.5 + i) * 0.06, "XYZ");
            DUMMY.scale.set(s, s, s);
            DUMMY.updateMatrix();
            m.copy(DUMMY.matrix);
            // the GLB's origin is its bottom face: centre its thickness on the gate
            m.multiply(SHIFT.makeTranslation(0, -GLB_SIZE.ring.y / 2, 0));
         }}
      />
   );
}
const SHIFT = new Matrix4();

function Jellies({ run, clock: vc }: { run: SurfRun; clock: VisualClock }) {
   const c = run.course;
   const time = useGameTime();
   const s = JELLY_WIDTH / GLB_SIZE.jelly.x;
   if (c.jellies.length === 0) return null;
   return (
      <DynamicInstancedModel
         asset={JELLY_ASSET}
         count={c.jellies.length}
         update={(i, m) => {
            const j = c.jellies[i];
            const x = jellyX(j, Math.max(0, vc.ms));
            const pulse = 1 + Math.sin(time.now * 3.1 + i) * 0.08;
            place(m, x, faceY(x, c.H) - 0.25 + Math.sin(time.now * 1.7 + i) * 0.1, j.z, 0, time.now * 0.4 + i, -roll(x, c.H), s * pulse, s * (2 - pulse));
         }}
      />
   );
}

/** The gulls circle high, cast a shadow on the face as they line up (the telegraph), then dive. */
function Gulls({ run, clock: vc }: { run: SurfRun; clock: VisualClock }) {
   const c = run.course;
   const s = GULL_SPAN / GLB_SIZE.gull.x;
   const shadows = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      const ms = Math.max(0, vc.ms);
      c.gulls.forEach((g, i) => {
         const m = shadows.current[i];
         if (!m) return;
         const beat = gullBeat(g, ms);
         const on = beat >= GULL.telegraph;
         m.visible = on;
         if (on) {
            const k = Math.min(1, (beat - GULL.telegraph) / (GULL.dive - GULL.telegraph));
            m.scale.setScalar(0.5 + 0.5 * k);
            (m.material as MeshBasicMaterial).opacity = beat >= GULL.dive ? 0.8 : 0.25 + 0.4 * k;
         }
      });
   });
   if (c.gulls.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.gull}
            count={c.gulls.length}
            update={(i, m) => {
               const g = c.gulls[i];
               const ms = Math.max(0, vc.ms);
               const beat = gullBeat(g, ms);
               const ground = faceY(g.x, c.H);
               let x = g.x;
               let z = g.z;
               let y = ground + 7;
               let pitch = 0;
               let yaw = beat * Math.PI * 2;
               if (beat < GULL.telegraph) {
                  // circling high over its spot
                  const a = beat * Math.PI * 2 * 1.5;
                  x += Math.cos(a) * 3;
                  z += Math.sin(a) * 3;
                  yaw = -a;
               } else if (beat < GULL.dive) {
                  // lining up over the spot, climbing a little
                  y = ground + 7.5;
                  yaw = 0;
               } else {
                  // the dive and the pull-up
                  const k = (beat - GULL.dive) / (1 - GULL.dive);
                  y = ground + 0.8 + 6.7 * Math.abs(1 - 2 * k) ** 1.6;
                  pitch = k < 0.5 ? 0.9 : -0.5;
                  yaw = 0;
               }
               place(m, x, y, z, pitch, yaw, 0, s);
            }}
         />
         {c.gulls.map((g, i) => (
            <mesh key={i} ref={(el) => {
                  shadows.current[i] = el;
               }} position={[g.x, faceY(g.x, c.H) + 0.06, g.z]} rotation={[-Math.PI / 2, roll(g.x, c.H), 0]} visible={false}>
               <circleGeometry args={[GULL.r, 24]} />
               <meshBasicMaterial color={HAZARD.violet} transparent opacity={0.4} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** Kiro's storm spray: a violet sheet of spray over the lip with a white rim, flickering. */
function Sprays({ run }: { run: SurfRun }) {
   const c = run.course;
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      refs.current.forEach((m, k) => {
         if (m) (m.material as MeshBasicMaterial).opacity = 0.42 + 0.14 * Math.sin(time.now * 9 + k * 2) + 0.06 * Math.sin(time.now * 23 + k);
      });
   });
   return (
      <>
         {c.sprays.map((s, k) => {
            const len = s.z0 - s.z1;
            const x0 = s.x0;
            const y0 = faceY(x0, c.H);
            return (
               <group key={k} position={[0, 0, (s.z0 + s.z1) / 2]}>
                  <mesh ref={(el) => {
                  refs.current[k] = el;
               }} position={[(x0 + FACE_W + 1) / 2, (y0 + c.H) / 2 + 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
                     <planeGeometry args={[len, c.H - y0 + 3.2]} />
                     <meshBasicMaterial color={HAZARD.violet} transparent opacity={0.45} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} toneMapped={false} />
                  </mesh>
                  <mesh position={[x0 - 0.05, y0 + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                     <planeGeometry args={[0.18, len]} />
                     <meshBasicMaterial color={HAZARD.rim} toneMapped={false} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

function Beacons({ run }: { run: SurfRun }) {
   const c = run.course;
   const spots = useMemo<InstanceSpot[]>(() => c.checkpoints.slice(1).map((z) => ({ x: FACE_W + 1.6, y: c.H - 0.1, z, scale: 2.2 / GLB_SIZE.beacon.y, rotY: -Math.PI / 2 })), [c]);
   if (spots.length === 0) return null;
   return (
      <InstancedModel
         asset={ASSETS.beacon}
         spots={spots}
         fallback={
            <Instanced spots={spots}>
               <cylinderGeometry args={[0.2, 0.3, 1.9, 10]} />
               <meshStandardMaterial color={COLORS.beacon} emissive={COLORS.beacon} emissiveIntensity={0.4} />
            </Instanced>
         }
      />
   );
}

/** The secrets: the pearl (a glowing white ball in its tube section), shards (crystals) and stickers (a disc badge). */
function Secrets({ run }: { run: SurfRun }) {
   const c = run.course;
   const list = SECRETS[run.level];
   const refs = useRef<(Group | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      list.forEach((_s, i) => {
         const g = refs.current[i];
         if (!g) return;
         g.visible = !run.secrets.found[i];
         g.rotation.y = time.now * 1.6 + i;
         g.position.y = c.secrets[i].y + Math.sin(time.now * 2 + i) * 0.12;
      });
   });
   return (
      <>
         {list.map((s, i) => {
            const p = c.secrets[i];
            const pearl = s.id === "pearl";
            return (
               <group key={s.id} ref={(el) => {
                  refs.current[i] = el;
               }} position={[p.x, p.y, p.z]}>
                  {pearl ? (
                     <mesh>
                        <sphereGeometry args={[0.32, 20, 14]} />
                        <meshStandardMaterial color="#fffaf0" emissive="#fde7f3" emissiveIntensity={0.7} roughness={0.15} />
                     </mesh>
                  ) : s.kind === "shard" ? (
                     <mesh>
                        <octahedronGeometry args={[0.38, 0]} />
                        <meshStandardMaterial color="#a5f3fc" emissive="#22d3ee" emissiveIntensity={0.8} roughness={0.2} flatShading />
                     </mesh>
                  ) : (
                     <mesh rotation-x={Math.PI / 2}>
                        <cylinderGeometry args={[0.36, 0.36, 0.08, 24]} />
                        <meshStandardMaterial color="#f9a8d4" emissive="#db2777" emissiveIntensity={0.6} roughness={0.3} />
                     </mesh>
                  )}
                  <mesh>
                     <sphereGeometry args={[0.7, 14, 10]} />
                     <meshBasicMaterial color={pearl ? "#fdf2f8" : s.kind === "shard" ? "#67e8f9" : "#f9a8d4"} transparent opacity={0.16} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

/** The finish: a glowing line across the face between two tall buoys, and the lagoon's sand bar beyond. */
function Finish({ run, won }: { run: SurfRun; won: { current: boolean } }) {
   const c = run.course;
   const line = useRef<Mesh>(null);
   const time = useGameTime();
   const strip = useMemo(() => {
      const pts: number[] = [];
      const idx: number[] = [];
      const n = 24;
      for (let i = 0; i <= n; i++) {
         const x = -1 + (FACE_W + 2) * (i / n);
         const y = faceY(x, c.H) + 0.06;
         pts.push(x, y, -0.6, x, y, 0.6);
         if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      return { pts: new Float32Array(pts), idx: new Uint16Array(idx) };
   }, [c.H]);
   useFrame(() => {
      const m = line.current;
      if (m) {
         const locked = bossAlive(run);
         const mat = m.material as MeshBasicMaterial;
         mat.color.set(locked ? HAZARD.glow : won.current ? "#fde68a" : "#ffffff");
         mat.opacity = 0.55 + 0.25 * Math.sin(time.now * 4);
      }
   });
   const s = 3 / GLB_SIZE.buoy.y;
   return (
      <group position={[0, 0, c.finishZ]}>
         <mesh ref={line}>
            <bufferGeometry>
               <bufferAttribute attach="attributes-position" args={[strip.pts, 3]} />
               <bufferAttribute attach="index" args={[strip.idx, 1]} />
            </bufferGeometry>
            <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} side={DoubleSide} toneMapped={false} />
         </mesh>
         <Model asset={ASSETS.buoy} position={[-1.6, -0.3, 0]} scale={s} />
         <Model asset={ASSETS.buoy} position={[FACE_W + 1.4, c.H - 0.4, 0]} scale={s} />
         {/* the lagoon's sand bar, in front of the wave beyond the line */}
         <mesh position={[-26, -1.2, -46]} scale={[22, 1.9, 30]}>
            <sphereGeometry args={[1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLORS.sand} roughness={0.95} />
         </mesh>
      </group>
   );
}

/** Level 5's Tide Bell on the sand bar: it swings and glows once King Breaker is down. */
function TideBell({ run, won }: { run: SurfRun; won: { current: boolean } }) {
   const bell = useRef<Group>(null);
   const glow = useRef<MeshStandardMaterial>(null);
   const time = useGameTime();
   useFrame(() => {
      const g = bell.current;
      if (!g) return;
      const free = !bossAlive(run);
      g.rotation.z = free ? Math.sin(time.now * (won.current ? 7 : 2.4)) * (won.current ? 0.45 : 0.12) : 0;
      if (glow.current) glow.current.emissiveIntensity = free ? 0.6 + 0.4 * Math.sin(time.now * 5) : 0.08;
   });
   return (
      <group position={[-12, 0.5, run.course.finishZ - 26]}>
         <mesh position={[-1.6, 2.6, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 5.2, 10]} />
            <meshStandardMaterial color="#8b6b4a" roughness={0.8} />
         </mesh>
         <mesh position={[1.6, 2.6, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 5.2, 10]} />
            <meshStandardMaterial color="#8b6b4a" roughness={0.8} />
         </mesh>
         <mesh position={[0, 5.1, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.14, 0.14, 3.6, 10]} />
            <meshStandardMaterial color="#8b6b4a" roughness={0.8} />
         </mesh>
         <group ref={bell} position={[0, 5, 0]}>
            <mesh position={[0, -1.1, 0]}>
               <cylinderGeometry args={[0.5, 1.05, 1.6, 24, 1, true]} />
               <meshStandardMaterial ref={glow} color="#3b82f6" emissive="#60a5fa" emissiveIntensity={0.1} metalness={0.55} roughness={0.32} side={DoubleSide} />
            </mesh>
            <mesh position={[0, -0.25, 0]}>
               <sphereGeometry args={[0.5, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
               <meshStandardMaterial color="#3b82f6" metalness={0.55} roughness={0.32} />
            </mesh>
         </group>
      </group>
   );
}

/**
 * King Breaker (level 5): it rides the crest ahead of you (the lip in phases 1-2, the face's middle in
 * the barrel), rears up on the telegraph, slams on the attack, sinks into the face while it burrows
 * (phase 2), glows its eyes while it can be hit, flashes on a hit and rolls over on its defeat.
 */
function Boss({ run }: { run: SurfRun }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const eyes = useRef<Group>(null);
   const slam = useRef<Mesh>(null);
   const mines = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   const sink = useRef(1);
   useFrame((_s, delta) => {
      const b = run.boss;
      const g = root.current;
      if (!b || !g) return;
      const crab = run.crab;
      const dt = Math.min(0.1, delta);
      const want = run.bossOn && crab.up ? 0 : 1;
      sink.current += (want - sink.current) * (1 - Math.exp(-4 * dt));
      const ground = faceY(crab.x, run.course.H);
      g.visible = run.bossOn && b.step !== "done";
      g.position.set(crab.x, ground - sink.current * 4.2, crab.z);
      const k = stepProgress(b, KING_BREAKER);
      const bd = body.current;
      if (bd) {
         let pitch = 0;
         if (b.step === "telegraph") pitch = -0.35 * k;
         else if (b.step === "attack") pitch = 0.3 * Math.sin(Math.min(1, k * 2) * Math.PI);
         const flash = b.flashMs > 0 ? Math.sin(time.now * 60) * 0.05 : 0;
         bd.rotation.set(pitch, 0, -roll(crab.x, run.course.H) + flash + (b.step === "defeat" ? k * 2.6 : 0));
         bd.position.y = b.step === "defeat" ? -k * 2 : Math.sin(time.now * 2.2) * 0.12;
         const sc = b.flashMs > 0 ? 1.06 : 1;
         bd.scale.setScalar(CRAB_SCALE * sc);
      }
      if (eyes.current) eyes.current.visible = bossVulnerable(run);
      const sm = slam.current;
      if (sm) {
         sm.visible = run.slam.live;
         if (run.slam.live) {
            sm.position.set(run.slam.x, faceY(run.slam.x, run.course.H) + 0.07, run.slam.z);
            sm.rotation.set(-Math.PI / 2, roll(run.slam.x, run.course.H), 0);
            const grow = b.step === "telegraph" ? 0.4 + 0.6 * k : 1;
            sm.scale.set(grow, grow * 1.9, grow);
            (sm.material as MeshBasicMaterial).opacity = b.step === "attack" ? 0.85 : 0.35 + 0.35 * k;
         }
      }
      for (let i = 0; i < 3; i++) {
         const m = mines.current[i];
         if (!m) continue;
         m.visible = run.minesLive;
         if (!run.minesLive) continue;
         const x = run.mines[i * 2];
         const z = run.mines[i * 2 + 1];
         const rise = b.step === "telegraph" ? k : 1;
         m.position.set(x, faceY(x, run.course.H) - 0.8 + rise * 1.2 + Math.sin(time.now * 3 + i) * 0.1, z);
         m.scale.setScalar(0.6 + 0.4 * rise);
      }
   });
   const ew = 0.32 * (5.2 / 1.9);
   return (
      <>
         <group ref={root}>
            <group ref={body}>
               <Model asset={ASSETS.crab} />
            </group>
            <group ref={eyes} position={[0, GLB_SIZE.crab.y * CRAB_SCALE * 0.82, GLB_SIZE.crab.z * CRAB_SCALE * 0.42]}>
               {[-1, 1].map((sd) => (
                  <mesh key={sd} position={[sd * ew, 0, 0]}>
                     <sphereGeometry args={[0.32, 14, 10]} />
                     <meshBasicMaterial color="#fde047" transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
                  </mesh>
               ))}
            </group>
         </group>
         <mesh ref={slam} visible={false}>
            <circleGeometry args={[1.8, 28]} />
            <meshBasicMaterial color={HAZARD.violet} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
         </mesh>
         {[0, 1, 2].map((i) => (
            <mesh key={i} ref={(el) => {
                  mines.current[i] = el;
               }} visible={false}>
               <sphereGeometry args={[1.0, 18, 12]} />
               <meshStandardMaterial color={HAZARD.violet} emissive={HAZARD.glow} emissiveIntensity={0.55} roughness={0.15} transparent opacity={0.85} />
            </mesh>
         ))}
      </>
   );
}

export function Course({ run, clock: vc, won }: { run: SurfRun; clock: VisualClock; won: { current: boolean } }) {
   return (
      <group>
         <Orbs run={run} clock={vc} />
         <Buoys run={run} />
         <Rocks run={run} />
         <CrackedWalls run={run} />
         <GhostArches run={run} />
         <Gates run={run} />
         <Jellies run={run} clock={vc} />
         <Gulls run={run} clock={vc} />
         <Sprays run={run} />
         <Beacons run={run} />
         <Secrets run={run} />
         <Finish run={run} won={won} />
         {run.course.boss ? <TideBell run={run} won={won} /> : null}
         {run.course.boss ? <Boss run={run} /> : null}
      </group>
   );
}
