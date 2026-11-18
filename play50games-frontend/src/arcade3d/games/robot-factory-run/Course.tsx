"use client";

// The factory line, drawn from the rules (rules.ts / factory.ts): conveyor belts (m2Conveyor) with
// chevrons running their way (amber on the klaxon belts, which flip), turntables
// (m2ConveyorTurntable) that swing a quarter turn with an arrow showing where they send cells (grey
// while jammed), red switch plates wired to their tables by glowing floor wires, machinery and step
// boxes (m2FactoryCrate), cracked crates (Riko), ghost crates (Vexa), the dispenser, the charger with
// a light per cell, the exit doors, hydraulic presses (m2HydraulicPress) with their shadow warning,
// laser gates (m2LaserGate), catwalks (m2SteelCatwalk), robot arms (m2RobotArm), tread bots
// (m2TreadBot), the power cells (m2PowerCell), the orbs (m2EnergyGem), the secrets, and on level 5
// Overseer M-8 (m2MegaRobotBoss).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, DoubleSide, Object3D, Vector3, type Group, type InstancedMesh, type Matrix4, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BOSS_HEIGHT, CELL_HEIGHT, GLB_SIZE, ORB_SIZE } from "./assets";
import { COLORS } from "./look";
import { OVERSEER, SECRETS } from "./progression";
import { DC, DR, H, K, TILE, W, at, tileX, tileZ } from "./factory";
import { TURN_MS, bossPos, botPos, klaxonOn, pressState, type FactoryRun } from "./rules";

const DUMMY = new Object3D();
const SCALE = new Vector3();
const P = { x: 0, z: 0 };
const JAMMED = new Color(COLORS.jam);
const CRACKED = new Color("#a16207");

/** A tile direction as a yaw for a model whose long axis is +x (E = 0). */
const dirYaw = (d: number): number => [Math.PI / 2, 0, -Math.PI / 2, Math.PI][d];

function useTiles(run: FactoryRun) {
   return useMemo(() => {
      const f = run.floor;
      const belts: { i: number; c: number; r: number }[] = [];
      const walls: InstanceSpot[] = [];
      const boxes: InstanceSpot[] = [];
      const catwalks: InstanceSpot[] = [];
      const legs: [number, number][] = [];
      const cracked: number[] = [];
      const ghosts: [number, number][] = [];
      const plain: InstanceSpot[] = [];
      const klax: InstanceSpot[] = [];
      const crateK = { x: 1.96 / GLB_SIZE.crate.x, z: 1.96 / GLB_SIZE.crate.z };
      for (let r = 0; r < H; r++) {
         for (let c = 0; c < W; c++) {
            const i = at(c, r);
            const t = f.tiles[i];
            const x = tileX(c);
            const z = tileZ(r);
            if (t.k === K.Belt || t.k === K.Disp) {
               belts.push({ i, c, r });
               const spot: InstanceSpot = { x, y: -0.36, z, rotY: dirYaw(t.dir), sx: TILE / GLB_SIZE.conveyor.x, sy: 0.5 / GLB_SIZE.conveyor.y, sz: 1.5 / GLB_SIZE.conveyor.z };
               (f.klaxonMask[i] ? klax : plain).push(spot);
            } else if (t.k === K.Wall) walls.push({ x, y: 0, z, sx: crateK.x, sy: 1.6 / GLB_SIZE.crate.y, sz: crateK.z, rotY: ((c * 7 + r * 3) % 4) * (Math.PI / 2) });
            else if (t.k === K.Box) boxes.push({ x, y: 0, z, sx: crateK.x, sy: 1.1 / GLB_SIZE.crate.y, sz: crateK.z });
            else if (t.k === K.Catwalk) {
               for (const dx of [-0.65, 0, 0.65]) catwalks.push({ x: x + dx, y: 2.2 - GLB_SIZE.catwalk.y * 1.0, z, sx: 0.66 / GLB_SIZE.catwalk.x, sy: 1, sz: TILE / GLB_SIZE.catwalk.z });
               legs.push([x, z]);
            } else if (t.k === K.Cracked) cracked.push(i);
            else if (t.k === K.Ghost) ghosts.push([x, z]);
         }
      }
      return { belts, walls, boxes, catwalks, legs, cracked, ghosts, plain, klax };
   }, [run.floor]);
}

/** Chevrons riding each belt its way (one instanced mesh). */
function Chevrons({ run, belts }: { run: FactoryRun; belts: { i: number; c: number; r: number }[] }) {
   const ref = useRef<InstancedMesh>(null);
   const n = belts.length * 2;
   const amber = useMemo(() => new Color(COLORS.klaxon), []);
   const pale = useMemo(() => new Color(COLORS.arrow), []);
   useEffect(() => {
      const m = ref.current;
      if (!m) return;
      belts.forEach((b, k) => {
         const col = run.floor.klaxonMask[b.i] ? amber : pale;
         m.setColorAt(2 * k, col);
         m.setColorAt(2 * k + 1, col);
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
   }, [belts, run.floor, amber, pale]);
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      const ms = run.board.ms;
      const flip = klaxonOn(run.floor, ms);
      const u = ((ms / 1000) * 2.5) % TILE;
      belts.forEach((b, k) => {
         const t = run.floor.tiles[b.i];
         let d = t.dir;
         if (flip && run.floor.klaxonMask[b.i]) d = (d + 2) % 4;
         for (let j = 0; j < 2; j++) {
            const s = ((u + j * 1.0) % TILE) - 1;
            DUMMY.position.set(tileX(b.c) + DC[d] * s, 0.15, tileZ(b.r) + DR[d] * s);
            DUMMY.rotation.set(-Math.PI / 2, 0, dirYaw(d) - Math.PI / 2);
            DUMMY.scale.set(0.42, 0.42, 0.42);
            DUMMY.updateMatrix();
            m.setMatrixAt(2 * k + j, DUMMY.matrix);
         }
      });
      m.instanceMatrix.needsUpdate = true;
   });
   if (n === 0) return null;
   return (
      <instancedMesh ref={ref} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={2}>
         <circleGeometry args={[0.5, 3]} />
         <meshBasicMaterial transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </instancedMesh>
   );
}

/** Turntables: they swing to their direction (a quarter turn over TURN_MS), arrows on top, grey while jammed. */
function Turntables({ run }: { run: FactoryRun }) {
   const f = run.floor;
   const n = f.turnAt.length;
   const shown = useRef<number[]>(f.spec.turns.map((d) => dirYaw(d)));
   const k = (TILE * 0.98) / GLB_SIZE.turntable.x;
   const arrows = useRef<InstancedMesh>(null);
   const update = (i: number, m: Matrix4, color?: Color) => {
      const b = run.board;
      const want = dirYaw(b.turns[i]);
      let cur = shown.current[i];
      let dy = want - cur;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const turning = b.ms < b.turnUntil[i];
      cur += turning ? dy * 0.25 : dy;
      shown.current[i] = cur;
      const [c, r] = f.turnAt[i];
      m.makeRotationY(cur);
      m.scale(SCALE.set(k, 0.5 / GLB_SIZE.turntable.y, k));
      m.setPosition(tileX(c), -0.35, tileZ(r));
      if (color && b.ms < b.jamUntil[i]) color.copy(JAMMED);
   };
   useFrame(() => {
      const m = arrows.current;
      if (!m) return;
      for (let i = 0; i < n; i++) {
         const [c, r] = f.turnAt[i];
         const yaw = shown.current[i];
         DUMMY.position.set(tileX(c) + Math.cos(yaw) * 0.45, 0.22, tileZ(r) - Math.sin(yaw) * 0.45);
         DUMMY.rotation.set(-Math.PI / 2, 0, yaw - Math.PI / 2);
         DUMMY.scale.set(0.75, 0.75, 0.75);
         DUMMY.updateMatrix();
         m.setMatrixAt(i, DUMMY.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
   });
   if (n === 0) return null;
   return (
      <>
         <DynamicInstancedModel asset={ASSETS.turntable} count={n} update={update} name="turntables" />
         <instancedMesh ref={arrows} args={[undefined, undefined, n]} frustumCulled={false} renderOrder={3}>
            <circleGeometry args={[0.5, 3]} />
            <meshBasicMaterial color={COLORS.hot} toneMapped={false} />
         </instancedMesh>
      </>
   );
}

/** Switch plates (they dip and flash when stepped on) and the glowing wires to what they control. */
function Plates({ run }: { run: FactoryRun }) {
   const f = run.floor;
   const refs = useRef<(Group | null)[]>([]);
   const mats = useRef<(MeshStandardMaterial | null)[]>([]);
   const last = useRef<number[]>(f.plateAt.map(() => -9999));
   const time = useGameTime();
   const wires = useMemo(() => {
      const out: { x: number; z: number; len: number; yaw: number; lane: boolean }[] = [];
      f.spec.plates.forEach((p, k) => {
         const [pc, pr] = f.plateAt[k];
         const ends: [number, number][] = p.turns.map((i) => f.turnAt[i]);
         if (p.lasers) for (const l of p.lasers) ends.push(f.laserAt[l]);
         if (p.bossLane && f.spec.boss) ends.push(f.spec.boss.lane[0]);
         for (const [tc, tr] of ends) {
            const x0 = tileX(pc);
            const z0 = tileZ(pr);
            const x1 = tileX(tc);
            const z1 = tileZ(tr);
            out.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, len: Math.hypot(x1 - x0, z1 - z0), yaw: Math.atan2(x1 - x0, z1 - z0), lane: !!p.bossLane });
         }
      });
      return out;
   }, [f]);
   useFrame(() => {
      const b = run.board;
      f.plateAt.forEach((_p, k) => {
         if (b.plateReadyAt[k] > 0 && b.plateReadyAt[k] !== last.current[k]) last.current[k] = b.plateReadyAt[k];
         const since = b.ms - (last.current[k] - 450);
         const g = refs.current[k];
         if (g) g.position.y = since >= 0 && since < 300 ? -0.06 : 0;
         const m = mats.current[k];
         if (m) m.emissiveIntensity = since >= 0 && since < 400 ? 1.8 : 0.45 + 0.2 * Math.sin(time.now * 3 + k);
      });
   });
   return (
      <>
         {f.plateAt.map(([c, r], k) => (
            <group key={k} position={[tileX(c), 0, tileZ(r)]}>
               <group
                  ref={(g) => {
                     refs.current[k] = g;
                  }}
               >
                  <mesh position={[0, 0.06, 0]}>
                     <cylinderGeometry args={[0.72, 0.8, 0.12, 28]} />
                     <meshStandardMaterial
                        ref={(m) => {
                           mats.current[k] = m;
                        }}
                        color={COLORS.plate}
                        emissive={COLORS.red}
                        emissiveIntensity={0.5}
                        roughness={0.5}
                     />
                  </mesh>
               </group>
               <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
                  <ringGeometry args={[0.82, 0.95, 32]} />
                  <meshStandardMaterial color={COLORS.plateRim} metalness={0.6} roughness={0.3} />
               </mesh>
            </group>
         ))}
         {wires.map((w, k) => (
            <mesh key={k} position={[w.x, 0.03, w.z]} rotation-y={w.yaw}>
               <boxGeometry args={[0.07, 0.03, w.len]} />
               <meshBasicMaterial color={w.lane ? COLORS.gold : COLORS.wire} transparent opacity={0.55} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** The dispenser, the charger (a light per cell), the secret charger and the exit doors. */
function Machines({ run }: { run: FactoryRun }) {
   const f = run.floor;
   const lights = useRef<(MeshStandardMaterial | null)[]>([]);
   const doors = useRef<(Group | null)[]>([]);
   const lamp = useRef<MeshStandardMaterial>(null);
   const time = useGameTime();
   useFrame(() => {
      const b = run.board;
      lights.current.forEach((m, i) => {
         if (m) m.emissiveIntensity = i < b.charged ? 2.2 : 0.15;
      });
      const open = b.charged >= f.spec.cells && !run.boss;
      doors.current.forEach((g, i) => {
         if (!g) return;
         const want = open ? (i === 0 ? -0.95 : 0.95) : i === 0 ? -0.45 : 0.45;
         g.position.x += (want - g.position.x) * 0.08;
      });
      if (lamp.current) lamp.current.emissiveIntensity = (b.ms % f.spec.cadenceMs) < 300 ? 2.5 : 0.6 + 0.2 * Math.sin(time.now * 4);
   });
   const [dc, dr] = f.dispenser;
   const [cc, cr] = f.charger;
   const [ec, er] = f.exit;
   return (
      <>
         <group position={[tileX(dc), 0, tileZ(dr)]}>
            <mesh position={[0, 1.6, 0]}>
               <boxGeometry args={[1.5, 1.2, 1.5]} />
               <meshStandardMaterial color={COLORS.steel} metalness={0.55} roughness={0.45} />
            </mesh>
            <mesh position={[0, 0.9, 0]}>
               <cylinderGeometry args={[0.5, 0.65, 0.4, 16]} />
               <meshStandardMaterial color={COLORS.dark} metalness={0.5} />
            </mesh>
            <mesh position={[0, 2.35, 0]}>
               <sphereGeometry args={[0.22, 12, 10]} />
               <meshStandardMaterial ref={lamp} color="#3a0f0c" emissive={COLORS.red} emissiveIntensity={0.6} />
            </mesh>
         </group>
         {!run.boss ? (
            <group position={[tileX(cc), 0, tileZ(cr)]}>
               <mesh position={[0, 0.7, 0]}>
                  <cylinderGeometry args={[0.9, 1.0, 1.4, 24]} />
                  <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.4} />
               </mesh>
               <mesh position={[0, 1.45, 0]}>
                  <torusGeometry args={[0.6, 0.12, 10, 28]} />
                  <meshStandardMaterial color="#3a1a10" emissive={COLORS.charger} emissiveIntensity={0.9} />
               </mesh>
               {Array.from({ length: f.spec.cells }, (_, i) => (
                  <mesh key={i} position={[Math.sin((i / f.spec.cells) * Math.PI * 2) * 0.95, 0.9, Math.cos((i / f.spec.cells) * Math.PI * 2) * 0.95]}>
                     <boxGeometry args={[0.22, 0.6, 0.22]} />
                     <meshStandardMaterial
                        ref={(m) => {
                           lights.current[i] = m;
                        }}
                        color="#2a0d08"
                        emissive={COLORS.red}
                        emissiveIntensity={0.15}
                     />
                  </mesh>
               ))}
            </group>
         ) : null}
         {f.secretCharger ? (
            <group position={[tileX(f.secretCharger[0]), 0, tileZ(f.secretCharger[1])]}>
               <mesh position={[0, 0.6, 0]}>
                  <cylinderGeometry args={[0.7, 0.8, 1.2, 20]} />
                  <meshStandardMaterial color="#6b5a2e" metalness={0.7} roughness={0.3} emissive={COLORS.gold} emissiveIntensity={0.25} />
               </mesh>
            </group>
         ) : null}
         {!run.boss ? (
            <group position={[tileX(ec), 0, tileZ(er)]}>
               {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * 1.05, 1.4, 0]}>
                     <boxGeometry args={[0.2, 2.8, 0.4]} />
                     <meshStandardMaterial color={COLORS.steel} metalness={0.6} />
                  </mesh>
               ))}
               <mesh position={[0, 2.85, 0]}>
                  <boxGeometry args={[2.3, 0.3, 0.4]} />
                  <meshStandardMaterial color="#3a1210" emissive={COLORS.red} emissiveIntensity={0.8} />
               </mesh>
               {[0, 1].map((i) => (
                  <group
                     key={i}
                     ref={(g) => {
                        doors.current[i] = g;
                     }}
                     position={[i === 0 ? -0.45 : 0.45, 0, -0.1]}
                  >
                     <mesh position={[0, 1.3, 0]}>
                        <boxGeometry args={[0.9, 2.6, 0.12]} />
                        <meshStandardMaterial color="#565d66" metalness={0.5} roughness={0.5} />
                     </mesh>
                  </group>
               ))}
            </group>
         ) : null}
      </>
   );
}

/** Presses: the head drops on the slam, a red shadow warns. */
function Presses({ run }: { run: FactoryRun }) {
   const presses = run.floor.spec.presses;
   const heads = useRef<(Group | null)[]>([]);
   const shadows = useRef<(Mesh | null)[]>([]);
   const k = 2.6 / GLB_SIZE.press.y;
   useFrame(() => {
      const ms = run.board.ms;
      presses.forEach(([, , ph], i) => {
         const st = pressState(ph, ms);
         const g = heads.current[i];
         if (g) g.position.y = st === "slam" ? -0.55 : st === "warn" ? 0.15 + Math.sin(ms / 30) * 0.04 : 0.2;
         const s = shadows.current[i];
         if (s) {
            s.visible = st !== "up";
            (s.material as MeshBasicMaterial).opacity = st === "slam" ? 0.75 : 0.45;
         }
      });
   });
   return (
      <>
         {presses.map(([c, r], i) => (
            <group key={i} position={[tileX(c), 0, tileZ(r)]}>
               <group
                  ref={(g) => {
                     heads.current[i] = g;
                  }}
               >
                  <group position={[0, 0.6, 0]} scale={k}>
                     <Model asset={ASSETS.press} />
                  </group>
               </group>
               <mesh
                  ref={(m) => {
                     shadows.current[i] = m;
                  }}
                  rotation-x={-Math.PI / 2}
                  position={[0, 0.2, 0]}
                  visible={false}
               >
                  <circleGeometry args={[0.9, 24]} />
                  <meshBasicMaterial color="#b91c1c" transparent opacity={0.5} depthWrite={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** Laser gates: the frame always, the beam while on (a shield walks through). */
function Lasers({ run }: { run: FactoryRun }) {
   const f = run.floor;
   const beams = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   const k = (TILE * 0.95) / GLB_SIZE.laser.x;
   useFrame(() => {
      beams.current.forEach((m, i) => {
         if (!m) return;
         const on = run.board.lasers[i] === 1;
         m.visible = on;
         (m.material as MeshBasicMaterial).opacity = 0.55 + 0.2 * Math.sin(time.now * 20 + i);
      });
   });
   return (
      <>
         {f.laserAt.map(([c, r], i) => (
            <group key={i} position={[tileX(c), 0, tileZ(r)]}>
               <group scale={k}>
                  <Model asset={ASSETS.laser} />
               </group>
               <mesh
                  ref={(m) => {
                     beams.current[i] = m;
                  }}
                  position={[0, 0.8, 0]}
               >
                  <boxGeometry args={[1.7, 1.2, 0.06]} />
                  <meshBasicMaterial color={COLORS.laser} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} side={DoubleSide} />
               </mesh>
            </group>
         ))}
      </>
   );
}

/** Robot arms: they swing from the pad to the drop on their cycle. */
function Arms({ run }: { run: FactoryRun }) {
   const arms = run.floor.spec.arms;
   const refs = useRef<(Group | null)[]>([]);
   const k = 2.4 / GLB_SIZE.arm.y;
   useFrame(() => {
      const ms = run.board.ms;
      arms.forEach((a, i) => {
         const g = refs.current[i];
         if (!g) return;
         const u = (((ms + a.phaseMs) % a.periodMs) + a.periodMs) % a.periodMs / a.periodMs;
         // a quick swing right after the lift, then back
         const swing = u < 0.18 ? Math.sin((u / 0.18) * Math.PI) : 0;
         const yaw = Math.atan2(tileX(a.drop[0]) - tileX(a.pad[0]), tileZ(a.drop[1]) - tileZ(a.pad[1]));
         g.rotation.y = yaw + swing * 0.8;
         g.rotation.z = -swing * 0.5;
      });
   });
   return (
      <>
         {arms.map((a, i) => {
            const mx = (tileX(a.pad[0]) + tileX(a.drop[0])) / 2;
            const mz = (tileZ(a.pad[1]) + tileZ(a.drop[1])) / 2;
            return (
               <group key={i}>
                  <mesh rotation-x={-Math.PI / 2} position={[tileX(a.pad[0]), 0.04, tileZ(a.pad[1])]}>
                     <ringGeometry args={[0.55, 0.85, 4, 1, Math.PI / 4]} />
                     <meshBasicMaterial color={COLORS.pad} transparent opacity={0.8} toneMapped={false} />
                  </mesh>
                  <group
                     ref={(g) => {
                        refs.current[i] = g;
                     }}
                     position={[mx + 1.1, 0, mz]}
                  >
                     <group scale={k}>
                        <Model asset={ASSETS.arm} />
                     </group>
                  </group>
               </group>
            );
         })}
      </>
   );
}

/** The secrets: a glowing crystal (shard) or a badge (sticker), hidden once found. */
function Secrets({ run }: { run: FactoryRun }) {
   const list = SECRETS[run.level];
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      list.forEach((_s, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = time.now * 1.6 + i;
      });
   });
   return (
      <>
         {list.map((s, i) => {
            const p = run.floor.spec.secrets[i];
            return (
               <mesh
                  key={s.id}
                  ref={(m) => {
                     refs.current[i] = m;
                  }}
                  position={[p[0], p[1] + (i === 0 && run.floor.secretCharger ? 1 : 0), p[2]]}
               >
                  {s.kind === "shard" ? <octahedronGeometry args={[0.3, 0]} /> : <cylinderGeometry args={[0.32, 0.32, 0.06, 20]} />}
                  <meshStandardMaterial color={s.kind === "shard" ? "#fca5a5" : "#f9a8d4"} emissive={s.kind === "shard" ? "#ef4444" : "#f472b6"} emissiveIntensity={0.9} />
               </mesh>
            );
         })}
      </>
   );
}

const SOCKET_ON = new Color("#ffcf6e");
const SOCKET_OFF = new Color("#5a1a14");

/** Overseer M-8: on its gantry (P1, P3) or walking the lane (P2); the chest socket, the vents. */
function Boss({ run }: { run: FactoryRun }) {
   const body = useRef<Group>(null);
   const socket = useRef<Mesh>(null);
   const vents = useRef<(Mesh | null)[]>([]);
   const pos = useRef({ x: 0, z: 0, placed: false });
   const time = useGameTime();
   const k = BOSS_HEIGHT / GLB_SIZE.boss.y;
   const spec = run.floor.spec.boss!;
   useFrame((_s, delta) => {
      const b = run.boss;
      const g = body.current;
      if (!b || !g) return;
      bossPos(run, P);
      const p = pos.current;
      const kz = p.placed ? 1 - Math.exp(-5 * Math.min(0.1, delta)) : 1;
      p.placed = true;
      p.x += (P.x - p.x) * kz;
      p.z += (P.z - p.z) * kz;
      const defeat = b.step === "defeat" || b.step === "done";
      const sink = defeat ? Math.min(1, b.stepMs / OVERSEER.defeatMs) : 0;
      const onLane = b.phase === 1;
      const scale = onLane ? 0.55 : 1;
      g.position.set(p.x, (onLane ? 0 : 0.4) - sink * 2, p.z);
      g.scale.setScalar(k * scale * (b.flashMs > 0 ? 1.06 : 1));
      g.rotation.set(sink * 0.6, onLane ? -Math.PI / 2 : 0, b.step === "attack" ? Math.sin(time.now * 18) * 0.06 : 0);
      g.visible = b.step !== "done" || sink < 1;
      const open = b.step === "vulnerable";
      const sm = socket.current;
      if (sm) {
         sm.visible = b.phase === 0 && !onLane;
         const mm = sm.material as MeshBasicMaterial;
         mm.color.copy(open ? SOCKET_ON : SOCKET_OFF);
         sm.scale.setScalar(open ? 1 + 0.1 * Math.sin(time.now * 10) : 0.85);
      }
      vents.current.forEach((m) => {
         if (!m) return;
         m.visible = b.phase === 2;
         (m.material as MeshBasicMaterial).opacity = open ? 0.85 : b.step === "telegraph" ? 0.4 * stepProgress(b, OVERSEER) : 0.15;
      });
   });
   return (
      <>
         <group ref={body}>
            <Model asset={ASSETS.boss} />
         </group>
         <mesh ref={socket} position={[tileX(spec.at[0]), 3.4, tileZ(spec.at[1]) + 1.2]}>
            <sphereGeometry args={[0.55, 18, 14]} />
            <meshBasicMaterial color={SOCKET_OFF} toneMapped={false} />
         </mesh>
         {spec.vents.map(([x, y, z], i) => (
            <mesh
               key={i}
               ref={(m) => {
                  vents.current[i] = m;
               }}
               position={[x, y, z]}
            >
               <cylinderGeometry args={[0.8, 0.8, 0.25, 20]} />
               <meshBasicMaterial color="#ff6a2a" transparent opacity={0.3} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

export function Course({ run }: { run: FactoryRun }) {
   const tiles = useTiles(run);
   const time = useGameTime();
   const f = run.floor;
   const cellK = CELL_HEIGHT / GLB_SIZE.cell.y;
   const cellUpdate = (i: number, m: Matrix4) => {
      const c = run.board.cells[i];
      if (!c || !c.live) return false;
      m.makeRotationY(time.now * 1.5 + i);
      m.scale(SCALE.set(cellK, cellK, cellK));
      m.setPosition(c.x, 0.16 + (c.holding ? Math.abs(Math.sin(time.now * 6)) * 0.08 : 0), c.z);
   };
   const orbK = ORB_SIZE / GLB_SIZE.gem.x;
   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = f.spec.orbs[i];
      m.makeRotationY(time.now * 2 + i);
      m.scale(SCALE.set(orbK, orbK, orbK));
      m.setPosition(o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i) * 0.08, o.z);
   };
   const crackedUpdate = (i: number, m: Matrix4, color?: Color) => {
      const idx = tiles.cracked[i];
      if (run.board.broken[idx]) return false;
      const c = idx % W;
      const r = Math.floor(idx / W);
      m.makeScale(1.9 / GLB_SIZE.crate.x, 1.2 / GLB_SIZE.crate.y, 1.9 / GLB_SIZE.crate.z);
      m.setPosition(tileX(c), 0, tileZ(r));
      if (color) color.copy(CRACKED);
   };
   const treadK = 1.3 / GLB_SIZE.tread.y;
   const treadUpdate = (i: number, m: Matrix4) => {
      const b = f.spec.bots[i];
      botPos(b, run.board.ms, P);
      m.makeRotationY(Math.atan2(tileX(b.b[0]) - tileX(b.a[0]), tileZ(b.b[1]) - tileZ(b.a[1])));
      m.scale(SCALE.set(treadK, treadK, treadK));
      m.setPosition(P.x, 0, P.z);
   };
   const ghostMat = useRef<MeshStandardMaterial>(null);
   useFrame(() => {
      if (ghostMat.current) ghostMat.current.opacity = run.simMs <= run.hero.phaseUntil ? 0.15 : 0.45 + 0.1 * Math.sin(time.now * 3);
   });
   return (
      <>
         <InstancedModel asset={ASSETS.conveyor} spots={tiles.plain} fallback={null} />
         {tiles.klax.length > 0 ? <InstancedModel asset={ASSETS.conveyor} spots={tiles.klax} fallback={null} /> : null}
         <Chevrons run={run} belts={tiles.belts} />
         <InstancedModel asset={ASSETS.crate} spots={tiles.walls} fallback={null} />
         {tiles.boxes.length > 0 ? <InstancedModel asset={ASSETS.crate} spots={tiles.boxes} fallback={null} /> : null}
         {tiles.catwalks.length > 0 ? <InstancedModel asset={ASSETS.catwalk} spots={tiles.catwalks} fallback={null} /> : null}
         {tiles.legs.map(([x, z], i) => (
            <mesh key={i} position={[x, 1.0, z + 0.8]}>
               <boxGeometry args={[1.9, 2.0, 0.12]} />
               <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.5} />
            </mesh>
         ))}
         {tiles.cracked.length > 0 ? <DynamicInstancedModel asset={ASSETS.crate} count={tiles.cracked.length} update={crackedUpdate} name="cracked" /> : null}
         {tiles.ghosts.map(([x, z], i) => (
            <mesh key={i} position={[x, 0.6, z]}>
               <boxGeometry args={[1.9, 1.2, 1.9]} />
               <meshStandardMaterial ref={i === 0 ? ghostMat : undefined} color={COLORS.ghost} emissive="#7c3aed" emissiveIntensity={0.6} transparent opacity={0.45} depthWrite={false} />
            </mesh>
         ))}
         <Turntables run={run} />
         <Plates run={run} />
         <Machines run={run} />
         <Presses run={run} />
         <Lasers run={run} />
         <Arms run={run} />
         {f.spec.bots.length > 0 ? <DynamicInstancedModel asset={ASSETS.tread} count={f.spec.bots.length} update={treadUpdate} name="treads" /> : null}
         <DynamicInstancedModel asset={ASSETS.cell} count={run.board.cells.length} update={cellUpdate} name="cells" />
         <DynamicInstancedModel asset={ASSETS.gem} count={f.spec.orbs.length} update={orbUpdate} name="orbs" />
         <Secrets run={run} />
         {run.boss ? <Boss run={run} /> : null}
      </>
   );
}

export { TURN_MS };
