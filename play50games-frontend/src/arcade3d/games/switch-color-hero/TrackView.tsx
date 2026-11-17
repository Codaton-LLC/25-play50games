"use client";

// The floating neon track: the deck in segments between the gaps (glowing lane strips, edge rails), the
// gates (three arches per gate, one energy field per lane recoloured every frame from the rules, with the
// colour's shape so colour-blind players can read it; a passed gate's fields fade), Chroma's core gates
// in the arena, energy blocks and low walls (the barrier GLB), beams and sweepers (light bars), energy
// pickups (spinning), checkpoints (flag and pad), the finish arch, the high prism and the ghost shard.
// Visual only: everything is read from the run.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BufferGeometry, CanvasTexture, CircleGeometry, Color, Euler, InstancedMesh, Matrix4, Quaternion, RepeatWrapping, SRGBColorSpace, Vector3,
   type Mesh, type MeshStandardMaterial,
} from "three";
import { DynamicInstancedModel, InstancedModel } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS, GLB_SIZE, fit } from "./assets";
import { COLORS, levelLook } from "./look";
import { LANES, LANE_W, PALETTE, START_Z, gateColor, sweeperX, type Gate, type Track } from "./track";
import { BEAM_H, type SwitchRun } from "./rules";

const DECK_W = LANE_W * 3 + 0.6;
const DECK_T = 0.5;
const FIELD_W = 2.15;
const FIELD_H = 2.9;
const ARCH_W = 2.55;
const ARCH_H = 3.5;
/** the arena's deck past the arena start (m) */
const ARENA_LEN = 2400;
const ARENA_POOL = 6;
/** the start platform: the switch platform GLB under the first metres (its top flush with the deck) */
const START_SPOTS: InstanceSpot[] = [{ x: 0, y: -0.44 * (0.6 / 0.438), z: START_Z + 6, sx: (DECK_W + 1.2) / 1.869, sy: 0.6 / 0.438, sz: 12 / 1.904 }];

const PALETTE_COLORS = PALETTE.map((p) => new Color(p.hex));
const DIM = new Color("#1e293b");

function deckTexture(glow: string): CanvasTexture {
   const c = document.createElement("canvas");
   c.width = 128;
   c.height = 128;
   const g = c.getContext("2d")!;
   g.fillStyle = "#1b2436";
   g.fillRect(0, 0, 128, 128);
   g.fillStyle = "#222d44";
   g.fillRect(0, 0, 128, 62);
   g.strokeStyle = `${glow}55`;
   g.lineWidth = 3;
   g.strokeRect(4, 4, 120, 120);
   g.fillStyle = `${glow}33`;
   g.beginPath();
   g.moveTo(64, 30);
   g.lineTo(84, 60);
   g.lineTo(44, 60);
   g.closePath();
   g.fill();
   const t = new CanvasTexture(c);
   t.wrapS = t.wrapT = RepeatWrapping;
   t.colorSpace = SRGBColorSpace;
   return t;
}

/** The deck's solid stretches: from the start platform to the end, cut at the gaps. */
export function deckSegments(t: Track): { z0: number; z1: number }[] {
   const end = t.arenaZ !== null ? t.arenaZ - ARENA_LEN : t.finishZ - 30;
   const gaps = t.obstacles.filter((o) => o.kind === "gap").sort((a, b) => b.z - a.z);
   const out: { z0: number; z1: number }[] = [];
   let z0 = START_Z + 12;
   for (const g of gaps) {
      out.push({ z0, z1: g.z });
      z0 = g.z - g.len;
   }
   out.push({ z0, z1: end });
   return out;
}

/** One geometry per shape, centred, 1 m across. */
function shapeGeometry(shape: string): BufferGeometry {
   const sides = shape === "circle" ? 28 : shape === "triangle" ? 3 : shape === "square" ? 4 : shape === "diamond" ? 4 : 6;
   const g = new CircleGeometry(0.5, sides, shape === "square" ? Math.PI / 4 : shape === "triangle" ? Math.PI / 2 : 0);
   return g;
}

const M = new Matrix4();
const P = new Vector3();
const S = new Vector3();
const Q = new Quaternion();
const E = new Euler();

function place(m: Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotY = 0): Matrix4 {
   E.set(0, rotY, 0);
   Q.setFromEuler(E);
   P.set(x, y, z);
   S.set(sx, sy, sz);
   return m.compose(P, Q, S);
}

export interface FieldSlot {
   gate: Gate;
   lane: number;
}

export default function TrackView({ run, level }: { run: SwitchRun; level: LevelId }) {
   const t = run.track;
   const time = useGameTime();
   const look = levelLook(level);
   const tex = useMemo(() => deckTexture(look.glow), [look]);
   const segs = useMemo(() => deckSegments(t), [t]);
   const segTex = useMemo(
      () =>
         segs.map((sg) => {
            const tx = tex.clone();
            tx.repeat.set(3, (sg.z0 - sg.z1) / LANE_W);
            tx.needsUpdate = true;
            return tx;
         }),
      [segs, tex],
   );
   const fields = useRef<InstancedMesh>(null);
   const shapes = useRef<(InstancedMesh | null)[]>([]);
   const highRef = useRef<Mesh>(null);
   const ghostRef = useRef<Mesh>(null);
   const sweepRefs = useRef<(Mesh | null)[]>([]);
   const arenaSweepRefs = useRef<(Mesh | null)[]>([]);
   const nFields = t.gates.length * 3 + ARENA_POOL * 3;
   const color = useMemo(() => new Color(), []);

   // static: the arches of the course gates (three per gate)
   const archSpots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const g of t.gates) for (const x of LANES) out.push({ x, y: 0, z: g.z, sx: fit(GLB_SIZE.archThin.x, ARCH_W), sy: fit(GLB_SIZE.archThin.y, ARCH_H), sz: 1.4 });
      return out;
   }, [t]);
   const blockSpots = useMemo(() => t.obstacles.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === "block" || o.kind === "wall"), [t]);
   const beamSpots = useMemo<InstanceSpot[]>(() => t.obstacles.filter((o) => o.kind === "beam").map((o) => ({ x: 0, y: BEAM_H + 0.3, z: o.z, sx: DECK_W, sy: 0.6, sz: 0.5 })), [t]);
   const postSpots = useMemo<InstanceSpot[]>(
      () => t.obstacles.filter((o) => o.kind === "beam").flatMap((o) => [-1, 1].map((s) => ({ x: s * (DECK_W / 2 + 0.1), y: 1.0, z: o.z, sx: 0.3, sy: 2.0, sz: 0.3 }))),
      [t],
   );
   const sweepers = useMemo(() => t.obstacles.filter((o) => o.kind === "sweeper"), [t]);
   const gapEdges = useMemo<InstanceSpot[]>(
      () => t.obstacles.filter((o) => o.kind === "gap").flatMap((o) => [o.z, o.z - o.len].map((z) => ({ x: 0, y: -0.05, z, sx: DECK_W, sy: 0.12, sz: 0.25 }))),
      [t],
   );
   const flagSpots = useMemo<InstanceSpot[]>(() => t.checkpoints.slice(1).map((z) => ({ x: DECK_W / 2 + 0.6, y: -0.2, z, scale: fit(GLB_SIZE.flag.y, 2.6), rotY: -Math.PI / 2 })), [t]);
   const padSpots = useMemo<InstanceSpot[]>(() => t.checkpoints.slice(1).map((z) => ({ x: 0, y: 0.005, z, sx: fit(GLB_SIZE.pad.x, DECK_W - 0.4), sy: 0.6, sz: fit(GLB_SIZE.pad.z, 1.4) })), [t]);
   const stripSpots = useMemo<InstanceSpot[]>(() => {
      const out: InstanceSpot[] = [];
      for (const s of segs) {
         const len = s.z0 - s.z1;
         for (const x of [-LANE_W * 1.5, -LANE_W / 2, LANE_W / 2, LANE_W * 1.5]) out.push({ x, y: 0.02, z: (s.z0 + s.z1) / 2, sx: x === -LANE_W * 1.5 || x === LANE_W * 1.5 ? 0.16 : 0.07, sy: 0.04, sz: len });
      }
      return out;
   }, [segs]);

   const updateArenaArch = useMemo(
      () => (k: number, m: Matrix4) => {
         const gi = Math.floor(k / 3);
         const a = run.arena[gi];
         if (!a || !a.live) return false;
         place(m, LANES[k % 3], 0, a.z, fit(GLB_SIZE.archThin.x, ARCH_W), fit(GLB_SIZE.archThin.y, ARCH_H), 1.4);
      },
      [run],
   );
   const updateBlock = useMemo(
      () => (k: number, m: Matrix4, c: Color) => {
         const s = blockSpots[k];
         if (!s || run.smashed[s.i]) return false;
         const tall = s.o.kind === "block";
         place(m, LANES[s.o.lane], 0, s.o.z, fit(GLB_SIZE.barrier.x, LANE_W - 0.25), fit(GLB_SIZE.barrier.y, tall ? 2.6 : 0.85), tall ? 6 : 4);
         c.set(tall ? COLORS.block : "#fbbf24");
      },
      [blockSpots, run],
   );
   const updatePickup = useMemo(
      () => (k: number, m: Matrix4) => {
         const p = t.pickups[k];
         if (!p || run.collected[k]) return false;
         const sc = fit(GLB_SIZE.pickup.y, p.main ? 0.85 : 1.0);
         place(m, p.x, p.y - 0.42 + Math.sin(time.now * 3 + k) * 0.08, p.z, sc, sc, sc, time.now * 2 + k);
      },
      [t, run, time],
   );

   const slotAt = (k: number): { g: Gate | null; lane: number; live: boolean; passed: boolean } => {
      const nCourse = t.gates.length * 3;
      if (k < nCourse) {
         const gi = Math.floor(k / 3);
         return { g: t.gates[gi], lane: k % 3, live: true, passed: gi < run.gateIdx };
      }
      const a = run.arena[Math.floor((k - nCourse) / 3)];
      return { g: a ?? null, lane: (k - nCourse) % 3, live: !!a && a.live, passed: false };
   };

   useFrame(() => {
      const f = fields.current;
      const now = run.simMs;
      const tt = time.now;
      if (f) {
         const counts = [0, 0, 0, 0, 0];
         for (let k = 0; k < nFields; k++) {
            const s = slotAt(k);
            if (!s.g || !s.live) {
               place(M, 0, -50, 0, 0.001, 0.001, 0.001);
               f.setMatrixAt(k, M);
               continue;
            }
            const c = gateColor(s.g, s.lane, now);
            const pulse = 0.85 + 0.15 * Math.sin(tt * 6 + k);
            place(M, LANES[s.lane], FIELD_H / 2 + 0.25, s.g.z, FIELD_W, FIELD_H, 1);
            f.setMatrixAt(k, M);
            color.copy(s.passed ? DIM : PALETTE_COLORS[c]).multiplyScalar(s.passed ? 1 : pulse);
            f.setColorAt(k, color);
            if (!s.passed) {
               const sh = shapes.current[c];
               if (sh) {
                  place(M, LANES[s.lane], FIELD_H / 2 + 0.25, s.g.z + 0.05, 0.9, 0.9, 1);
                  sh.setMatrixAt(counts[c]++, M);
               }
            }
         }
         f.instanceMatrix.needsUpdate = true;
         if (f.instanceColor) f.instanceColor.needsUpdate = true;
         for (let i = 0; i < 5; i++) {
            const sh = shapes.current[i];
            if (!sh) continue;
            sh.count = counts[i];
            sh.instanceMatrix.needsUpdate = true;
         }
      }
      for (let i = 0; i < sweepers.length; i++) {
         const m = sweepRefs.current[i];
         if (m) m.position.set(sweeperX(sweepers[i], now), 0.35, sweepers[i].z);
      }
      for (let i = 0; i < 4; i++) {
         const m = arenaSweepRefs.current[i];
         const s = run.sweeps[i];
         if (!m) continue;
         m.visible = !!s && s.live;
         if (s) m.position.set(sweeperX({ kind: "sweeper", z: s.z, lane: -1, len: 0, periodMs: s.periodMs, phase: s.phase }, now), 0.35, s.z);
      }
      if (highRef.current) {
         highRef.current.visible = !run.secrets.found[0];
         highRef.current.rotation.y = tt * 1.4;
      }
      if (ghostRef.current) {
         ghostRef.current.visible = !run.secrets.found[2];
         ghostRef.current.rotation.y = tt * 1.4;
         (ghostRef.current.material as MeshStandardMaterial).opacity = 0.55 + 0.25 * Math.sin(tt * 3);
      }
   });

   const shapeGeos = useMemo(() => PALETTE.map((p) => shapeGeometry(p.shape)), []);
   const finishZ = t.finishZ;
   return (
      <group>
         {/* the deck */}
         {segs.map((s, i) => {
            const len = s.z0 - s.z1;
            const tx = segTex[i];
            return (
               <mesh key={i} position={[0, -DECK_T / 2, (s.z0 + s.z1) / 2]} receiveShadow>
                  <boxGeometry args={[DECK_W, DECK_T, len]} />
                  <meshStandardMaterial map={tx} roughness={0.55} metalness={0.2} />
               </mesh>
            );
         })}
         <Instanced spots={stripSpots}>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={look.glow} toneMapped={false} />
         </Instanced>
         {gapEdges.length ? (
            <Instanced spots={gapEdges}>
               <boxGeometry args={[1, 1, 1]} />
               <meshBasicMaterial color={COLORS.beam} toneMapped={false} />
            </Instanced>
         ) : null}
         {/* the start platform */}
         <InstancedModel
            asset={ASSETS.platform}
            spots={START_SPOTS}
            fallback={<Instanced spots={START_SPOTS}><boxGeometry args={[1.87, 0.44, 1.9]} /><meshStandardMaterial color="#334155" /></Instanced>}
         />
         {/* gates */}
         <InstancedModel asset={ASSETS.archThin} spots={archSpots} fallback={<Instanced spots={archSpots}><boxGeometry args={[1.4, 1.9, 0.2]} /><meshStandardMaterial color="#334155" /></Instanced>} />
         <DynamicInstancedModel asset={ASSETS.archThin} count={ARENA_POOL * 3} update={updateArenaArch} />
         <instancedMesh ref={fields} args={[undefined, undefined, nFields]} frustumCulled={false} renderOrder={2}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial transparent opacity={0.6} depthWrite={false} toneMapped={false} />
         </instancedMesh>
         {shapeGeos.map((g, i) => (
            <instancedMesh key={i} ref={(m) => { shapes.current[i] = m; }} args={[g, undefined, nFields]} frustumCulled={false} renderOrder={3}>
               <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
            </instancedMesh>
         ))}
         {/* hazards */}
         {blockSpots.length ? <DynamicInstancedModel asset={ASSETS.barrier} count={blockSpots.length} update={updateBlock} tinted /> : null}
         {beamSpots.length ? (
            <>
               <Instanced spots={beamSpots}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.beam} emissive={COLORS.beam} emissiveIntensity={0.9} toneMapped={false} />
               </Instanced>
               <Instanced spots={postSpots}>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.3} />
               </Instanced>
            </>
         ) : null}
         {sweepers.map((o, i) => (
            <mesh key={i} ref={(m) => { sweepRefs.current[i] = m; }} position={[0, 0.35, o.z]} castShadow>
               <boxGeometry args={[2.2, 0.7, 0.35]} />
               <meshStandardMaterial color={COLORS.sweeper} emissive={COLORS.sweeper} emissiveIntensity={0.8} toneMapped={false} />
            </mesh>
         ))}
         {[0, 1, 2, 3].map((i) => (
            <mesh key={`as${i}`} ref={(m) => { arenaSweepRefs.current[i] = m; }} visible={false}>
               <boxGeometry args={[2.2, 0.7, 0.35]} />
               <meshStandardMaterial color={COLORS.beam} emissive={COLORS.beam} emissiveIntensity={1} toneMapped={false} />
            </mesh>
         ))}
         {/* pickups, checkpoints */}
         <DynamicInstancedModel asset={ASSETS.pickup} count={t.pickups.length} update={updatePickup} />
         {flagSpots.length ? <InstancedModel asset={ASSETS.flag} spots={flagSpots} fallback={<Instanced spots={flagSpots}><boxGeometry args={[0.3, 1.9, 0.3]} /><meshStandardMaterial color="#f8fafc" /></Instanced>} /> : null}
         {padSpots.length ? <InstancedModel asset={ASSETS.pad} spots={padSpots} fallback={<Instanced spots={padSpots}><boxGeometry args={[1.9, 0.2, 1.9]} /><meshStandardMaterial color="#38bdf8" /></Instanced>} /> : null}
         {/* the finish arch (levels 1-4) */}
         {t.arenaZ === null ? (
            <group position={[0, 0, finishZ]}>
               <InstancedModel
                  asset={ASSETS.arch}
                  spots={[{ x: 0, y: 0, z: 0, sx: fit(GLB_SIZE.arch.x, DECK_W + 1), sy: fit(GLB_SIZE.arch.y, 6), sz: 1.2 }]}
                  fallback={<Instanced spots={[{ x: 0, y: 2, z: 0 }]}><boxGeometry args={[DECK_W, 4, 0.5]} /><meshStandardMaterial color="#334155" /></Instanced>}
               />
               {PALETTE.slice(0, t.colors).map((p, i) => (
                  <mesh key={p.id} position={[-DECK_W / 2 + 0.8 + (i * (DECK_W - 1.6)) / Math.max(1, t.colors - 1), 4.6, 0.3]}>
                     <sphereGeometry args={[0.35, 14, 10]} />
                     <meshBasicMaterial color={p.hex} toneMapped={false} />
                  </mesh>
               ))}
            </group>
         ) : null}
         {/* secrets */}
         <mesh ref={highRef} position={[t.high.x, t.high.y, t.high.z]}>
            <octahedronGeometry args={[0.45, 0]} />
            <meshStandardMaterial color="#e0f2fe" emissive="#7dd3fc" emissiveIntensity={1.4} toneMapped={false} />
         </mesh>
         <mesh ref={ghostRef} position={[t.ghost.x, t.ghost.y, t.ghost.z]}>
            <octahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color={COLORS.phase} emissive={COLORS.phase} emissiveIntensity={1.2} transparent opacity={0.7} toneMapped={false} />
         </mesh>
      </group>
   );
}
