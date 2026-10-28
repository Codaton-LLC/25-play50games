"use client";

// The playable city, drawn from the rules (never the other way round). Flat roofs are m2RooftopBlock
// fitted so its deck sits on the collider top; slanted roofs are m2SlopedRoofI turned so its gutter
// lip is the slope's low edge (rain-wet tin in a darker, glossy look; a code tin wedge with a raised
// lip while the GLB is missing). Under every roof stands its building (code, two tones). Gondolas and
// crane slabs hang from their cables, blinking roofs are one dynamic pool (hidden while gone),
// chimneys blow a shimmering updraft, neon signs spark across the slopes on their cycle, cracked
// skylights (gone once smashed) and purple ghost billboards sit on their decks, secrets spin until
// found, water towers stand by their ledges, and on level 5 the helipad arena (ramps, pad, antenna)
// holds Ashback (m2ShadowArmadillo), his water tank and his grey paint. Each deck's neon strip
// relights red once you have landed on it.
import { Suspense, useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, ExtrudeGeometry, Matrix4, Shape, Vector3, type Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASHBACK_SCALE, ASSETS, GLB_SIZE, ORB_SIZE, SLOPED_ROOF_TOP } from "./assets";
import { COLORS, glowTexture } from "./look";
import { BillboardField, type Billboard } from "./World";
import { LEVELS } from "./levels";
import { NONE, roofGone, strikeLive, supportX, supportZ, type Course as CourseData, type RoofRun, type Support } from "./rules";

/** The visual clock (ms of rules time), written by Scene every frame. */
export interface VisualClock {
   ms: number;
}

const BLOCK_SY = 1.15;
const SCRATCH = new Matrix4();
const SCALE = new Vector3();
/** Buildings reach down to here (under the fog). */
const STREET_Y = -40;

/** Rain-wet tin: the same GLB in a dark, glossy blue-grey. */
export const WET_ROOF: ModelAsset = { ...ASSETS.slopedRoof, id: "m2SlopedRoofWet", material: { color: "#3f5677", roughness: 0.16, metalness: 0.55 } };

function deckY(top: number): number {
   return top - GLB_SIZE.rooftopBlock.top * BLOCK_SY;
}

function blockScale(s: Support, target: Matrix4): void {
   target.makeScale((s.hw * 2) / GLB_SIZE.rooftopBlock.x, BLOCK_SY, (s.hd * 2) / GLB_SIZE.rooftopBlock.z);
}

/** The sloped-roof GLB fitted to a slope: its +z (ridge to gutter) turned to the slope's dir along x. */
export function slopeSpot(s: Support): InstanceSpot {
   const sl = s.slope!;
   const drop = s.top - s.low;
   const sy = drop / (SLOPED_ROOF_TOP.ridge - SLOPED_ROOF_TOP.lip);
   return {
      x: s.cx,
      y: s.top - SLOPED_ROOF_TOP.ridge * sy,
      z: s.cz,
      rotY: sl.dir > 0 ? Math.PI / 2 : -Math.PI / 2,
      sx: (s.hd * 2) / GLB_SIZE.slopedRoof.x,
      sy,
      sz: (s.hw * 2) / GLB_SIZE.slopedRoof.z,
   };
}

interface LiveRoof {
   s: Support;
   index: number;
}

interface Spots {
   roofs: InstanceSpot[];
   slopes: InstanceSpot[];
   wet: InstanceSpot[];
   codeSlopes: Support[];
   bodies: InstanceSpot[];
   cornices: InstanceSpot[];
   fans: InstanceSpot[];
   solar: InstanceSpot[];
   live: LiveRoof[];
   movers: LiveRoof[];
   chimneys: Support[];
   ledges: Support[];
   decks: number[];
}

function useSpots(course: CourseData): Spots {
   return useMemo(() => {
      const out: Spots = { roofs: [], slopes: [], wet: [], codeSlopes: [], bodies: [], cornices: [], fans: [], solar: [], live: [], movers: [], chimneys: [], ledges: [], decks: [] };
      const fanScale = 1.15 / GLB_SIZE.exhaustFan.y;
      const solarScale = 0.85 / GLB_SIZE.solarRack.y;
      const body = (s: Support, top: number) => {
         const h = top - STREET_Y;
         out.bodies.push({ x: s.cx, y: STREET_Y + h / 2, z: s.cz, sx: s.hw * 2 - 0.1, sy: h, sz: s.hd * 2 - 0.1 });
         out.cornices.push({ x: s.cx, y: top - 0.18, z: s.cz, sx: s.hw * 2 + 0.12, sy: 0.36, sz: s.hd * 2 + 0.12 });
      };
      course.supports.forEach((s, i) => {
         if (s.mover) {
            out.live.push({ s, index: i });
            out.movers.push({ s, index: i });
            return;
         }
         if (s.vanish) {
            out.live.push({ s, index: i });
            body(s, deckY(s.top) - 0.05);
            return;
         }
         if (s.slope) {
            const spot = slopeSpot(s);
            (s.slope.wet ? out.wet : out.slopes).push(spot);
            out.codeSlopes.push(s);
            body(s, spot.y + 0.02);
            return;
         }
         if (s.launch > 0) {
            out.chimneys.push(s);
            return;
         }
         if (s.role === "ledge") {
            out.ledges.push(s);
            return;
         }
         out.roofs.push({ x: s.cx, y: deckY(s.top), z: s.cz, rotY: (i % 2) * Math.PI, sx: (s.hw * 2) / GLB_SIZE.rooftopBlock.x, sy: BLOCK_SY, sz: (s.hd * 2) / GLB_SIZE.rooftopBlock.z });
         body(s, deckY(s.top) + 0.02);
         if (s.role === "deck" || s.role === "arenaDeck") out.decks.push(i);
         if (s.kind === "goal" || s.kind === "start" || s.role !== "deck") return;
         // a fan or a solar rack on a landing deck's back corner, off the landing line
         const side = s.block % 2 === 0 ? -1 : 1;
         const ax = s.cx + side * Math.max(0.4, s.hw - 0.85);
         const az = s.cz + Math.max(0.35, s.hd - 0.75);
         if (i % 2 === 0) out.fans.push({ x: ax, y: s.top, z: az, scale: fanScale, rotY: side > 0 ? 0.4 : -0.4 });
         else out.solar.push({ x: ax, y: s.top, z: az, scale: solarScale, rotY: 0.3 });
      });
      return out;
   }, [course]);
}

/** The code tin roof (the GLB's fallback): a wedge falling along the slope, a raised lip at the gutter, two tones. */
function CodeSlope({ s }: { s: Support }) {
   const geo = useMemo(() => {
      const sl = s.slope!;
      const L = s.hw * 2;
      const drop = s.top - s.low;
      const shape = new Shape();
      // profile in (along the fall, height), the high edge at 0
      shape.moveTo(0, 0);
      shape.lineTo(L, -drop);
      shape.lineTo(L, -drop - 0.9);
      shape.lineTo(0, -drop - 0.9);
      shape.closePath();
      const g = new ExtrudeGeometry(shape, { depth: s.hd * 2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
      g.translate(-L / 2, 0, -s.hd);
      if (sl.dir < 0) g.scale(-1, 1, 1);
      return g;
   }, [s]);
   useEffect(() => () => geo.dispose(), [geo]);
   const sl = s.slope!;
   const lipX = s.cx + sl.dir * s.hw;
   return (
      <group>
         <mesh geometry={geo} position={[s.cx, s.top, s.cz]}>
            <meshStandardMaterial color={sl.wet ? "#3f5677" : "#9f3a2c"} roughness={sl.wet ? 0.18 : 0.55} metalness={0.45} side={DoubleSide} />
         </mesh>
         {/* the raised gutter lip */}
         <mesh position={[lipX - sl.dir * 0.08, s.low + 0.06, s.cz]}>
            <boxGeometry args={[0.16, 0.16, s.hd * 2 + 0.1]} />
            <meshStandardMaterial color="#d6d3d1" roughness={0.4} metalness={0.6} />
         </mesh>
      </group>
   );
}

function CodeSlopes({ slopes }: { slopes: Support[] }) {
   return (
      <>
         {slopes.map((s, i) => (
            <CodeSlope key={i} s={s} />
         ))}
      </>
   );
}

/** Every roof's building: a wall column and a lighter cornice band (instanced, two draw calls). */
function Buildings({ spots }: { spots: Spots }) {
   return (
      <>
         <Instanced spots={spots.bodies} name="buildings">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#3b4a63" roughness={0.85} />
         </Instanced>
         <Instanced spots={spots.cornices} name="cornices">
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#64748b" roughness={0.6} />
         </Instanced>
      </>
   );
}

/** Gondolas hang from two cables to the sky; crane slabs swing from one cable and a hook. */
function MoverRig({ s, crane, clock }: { s: Support; crane: boolean; clock: VisualClock }) {
   const g = useRef<Group>(null);
   useFrame(() => {
      if (g.current) g.current.position.set(supportX(s, clock.ms), s.top, supportZ(s, clock.ms));
   });
   const len = 14;
   return (
      <group ref={g}>
         {crane ? (
            <>
               <mesh position={[0, len / 2 + 1.4, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, len, 5]} />
                  <meshStandardMaterial color="#1f2937" />
               </mesh>
               <mesh position={[0, 1.25, 0]}>
                  <torusGeometry args={[0.32, 0.08, 6, 12, Math.PI]} />
                  <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.4} />
               </mesh>
               {[-1, 1].map((k) => (
                  <mesh key={k} position={[k * s.hw * 0.7, 0.6, 0]} rotation={[0, 0, -k * 0.75]}>
                     <cylinderGeometry args={[0.025, 0.025, 1.6, 4]} />
                     <meshStandardMaterial color="#334155" />
                  </mesh>
               ))}
            </>
         ) : (
            [-1, 1].map((k) => (
               <group key={k}>
                  <mesh position={[k * (s.hw - 0.15), len / 2, 0]}>
                     <cylinderGeometry args={[0.03, 0.03, len, 4]} />
                     <meshStandardMaterial color="#1f2937" />
                  </mesh>
                  {/* the gondola's rail */}
                  <mesh position={[k * (s.hw - 0.1), 0.5, 0]}>
                     <boxGeometry args={[0.06, 0.06, s.hd * 2]} />
                     <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
                  </mesh>
               </group>
            ))
         )}
      </group>
   );
}

/** A chimney stack under the updraft's cap, and the shimmering hot-air column above it. */
function Chimney({ s }: { s: Support }) {
   const time = useGameTime();
   const col = useRef<Mesh>(null);
   useFrame(() => {
      const m = col.current;
      if (!m) return;
      const t = time.now;
      (m.material as MeshBasicMaterial).opacity = 0.16 + 0.08 * Math.sin(t * 7);
      m.scale.set(1 + 0.06 * Math.sin(t * 5), 1, 1 + 0.06 * Math.cos(t * 5));
   });
   const h = s.top - STREET_Y;
   return (
      <group position={[s.cx, 0, s.cz]}>
         <mesh position={[0, STREET_Y + h / 2 - 0.1, 0]}>
            <boxGeometry args={[s.hw * 2, h - 0.2, s.hd * 2]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.8} />
         </mesh>
         <mesh position={[0, s.top - 0.08, 0]}>
            <boxGeometry args={[s.hw * 2 + 0.24, 0.16, s.hd * 2 + 0.24]} />
            <meshStandardMaterial color="#44403c" roughness={0.6} />
         </mesh>
         <mesh ref={col} position={[0, s.top + 2.6, 0]}>
            <cylinderGeometry args={[s.hw * 0.75, s.hw * 0.95, 5.2, 14, 1, true]} />
            <meshBasicMaterial color="#fde68a" transparent opacity={0.2} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} />
         </mesh>
      </group>
   );
}

/** A water-tower ledge: a wooden walkway (the stand rectangle) on steel legs, the barrel tank behind it. */
function WaterTower({ s }: { s: Support }) {
   return (
      <group position={[s.cx, s.top, s.cz]}>
         <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[s.hw * 2, 0.24, s.hd * 2]} />
            <meshStandardMaterial color="#92400e" roughness={0.8} />
         </mesh>
         {[-1, 1].flatMap((a) =>
            [-1, 1].map((b) => (
               <mesh key={`${a}${b}`} position={[a * (s.hw - 0.15), -3, b * (s.hd - 0.15)]}>
                  <boxGeometry args={[0.14, 6, 0.14]} />
                  <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.5} />
               </mesh>
            )),
         )}
         <group position={[0, 0, -s.hd - 1.1]}>
            <mesh position={[0, 1.2, 0]}>
               <cylinderGeometry args={[1.0, 1.05, 2.4, 16]} />
               <meshStandardMaterial color="#9a3412" roughness={0.75} />
            </mesh>
            <mesh position={[0, 2.75, 0]}>
               <coneGeometry args={[1.15, 0.8, 16]} />
               <meshStandardMaterial color="#44403c" roughness={0.6} />
            </mesh>
            {[0.5, 1.6].map((y) => (
               <mesh key={y} position={[0, y, 0]}>
                  <torusGeometry args={[1.06, 0.04, 6, 24]} />
                  <meshStandardMaterial color="#1f2937" metalness={0.6} />
               </mesh>
            ))}
         </group>
      </group>
   );
}

/** Each deck's neon strip on its front edge: grey (Shadow Plates drained it) until you land, then red. */
function NeonStrips({ run, decks }: { run: RoofRun; decks: number[] }) {
   const mats = useRef<(MeshStandardMaterial | null)[]>([]);
   const lit = useRef<boolean[]>([]);
   useFrame(() => {
      for (let k = 0; k < decks.length; k++) {
         const on = run.visited[decks[k]] === 1 || decks[k] === run.course.checkpoints[0];
         if (lit.current[k] === on) continue;
         lit.current[k] = on;
         const m = mats.current[k];
         if (!m) continue;
         m.color.set(on ? "#ef4444" : "#6b7280");
         m.emissive.set(on ? "#ef4444" : "#1f2937");
         m.emissiveIntensity = on ? 1.6 : 0.2;
      }
   });
   return (
      <>
         {decks.map((i, k) => {
            const s = run.course.supports[i];
            return (
               <mesh key={i} position={[s.cx, s.top - 0.32, s.cz + s.hd + 0.08]}>
                  <boxGeometry args={[s.hw * 1.6, 0.12, 0.06]} />
                  <meshStandardMaterial
                     ref={(m) => {
                        mats.current[k] = m;
                     }}
                     color="#6b7280"
                     emissive="#1f2937"
                     emissiveIntensity={0.2}
                     toneMapped={false}
                  />
               </mesh>
            );
         })}
      </>
   );
}

function CheckpointLamps({ course, run }: { course: CourseData; run: RoofRun }) {
   const lamps = course.checkpoints.slice(1);
   const mats = useRef<(MeshStandardMaterial | null)[]>([]);
   useFrame(() => {
      lamps.forEach((index, k) => {
         const m = mats.current[k];
         if (!m) return;
         const lit = run.checkpoint >= course.checkpoints.indexOf(index);
         const c = lit ? COLORS.beaconLit : COLORS.beaconIdle;
         m.color.set(c);
         m.emissive.set(c);
      });
   });
   return (
      <>
         {lamps.map((index, k) => {
            const s = course.supports[index];
            return (
               <group key={index} position={[s.cx - s.hw + 0.55, s.top, s.cz - s.hd + 0.55]}>
                  <mesh position={[0, 0.7, 0]}>
                     <cylinderGeometry args={[0.05, 0.07, 1.4, 6]} />
                     <meshStandardMaterial color="#334155" />
                  </mesh>
                  <mesh position={[0, 1.5, 0]}>
                     <sphereGeometry args={[0.16, 10, 8]} />
                     <meshStandardMaterial
                        ref={(m) => {
                           mats.current[k] = m;
                        }}
                        color={COLORS.beaconIdle}
                        emissive={COLORS.beaconIdle}
                        emissiveIntensity={0.8}
                     />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

function Helipad({ course }: { course: CourseData }) {
   const goal = course.supports[course.goal];
   return (
      <group position={[goal.cx, goal.top + 0.04, goal.cz]}>
         <mesh rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.15, 1.45, 24]} />
            <meshBasicMaterial color="#f8fafc" />
         </mesh>
         <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
            <circleGeometry args={[0.35, 16]} />
            <meshBasicMaterial color="#facc15" />
         </mesh>
         {course.arena ? (
            // the antenna Ashback rams in the duel, on the pad's far edge (off the roll line)
            <group position={[0, 0, -goal.hd + 0.4]}>
               <mesh position={[0, 2.2, 0]}>
                  <cylinderGeometry args={[0.07, 0.12, 4.4, 6]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.35} />
               </mesh>
               <mesh position={[0, 4.5, 0]}>
                  <sphereGeometry args={[0.14, 8, 6]} />
                  <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.5} toneMapped={false} />
               </mesh>
            </group>
         ) : null}
      </group>
   );
}

/** Neon signs whose spark arcs cross the roll line (and the Kiro secret's live arc): bright while live. */
function Strikes({ run, clock }: { run: RoofRun; clock: VisualClock }) {
   const strikes = run.course.strikes;
   const arcs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      const ms = clock.ms < 0 ? 0 : clock.ms;
      for (let i = 0; i < strikes.length; i++) {
         const m = arcs.current[i];
         if (!m) continue;
         const live = strikeLive(strikes[i], ms);
         m.visible = live;
         if (live) {
            m.rotation.y = time.now * 9 + i;
            m.scale.y = 0.85 + 0.3 * Math.abs(Math.sin(time.now * 31 + i));
         }
      }
   });
   if (strikes.length === 0) return null;
   return (
      <>
         {strikes.map((st, i) => {
            const s = run.course.supports[st.support];
            const x = s.cx + st.ox;
            const z = s.cz + st.oz;
            // the sign's post stands on the slope's edge, the arc drops from it across the line
            const y = s.slope ? s.top - s.slope.grade * Math.max(0, Math.min(2 * s.hw, (x - (s.cx - s.slope.dir * s.hw)) * s.slope.dir)) : s.top;
            return (
               <group key={i} position={[x, y, z]}>
                  <mesh position={[0, 1.4, -st.radius - 0.4]}>
                     <boxGeometry args={[1.6, 0.7, 0.12]} />
                     <meshStandardMaterial color="#1e1b4b" emissive="#f472b6" emissiveIntensity={0.9} toneMapped={false} />
                  </mesh>
                  <mesh
                     ref={(m) => {
                        arcs.current[i] = m;
                     }}
                     position={[0, 1.3, 0]}
                     visible={false}
                  >
                     <cylinderGeometry args={[st.radius, st.radius, 2.6, 10, 1, true]} />
                     <meshBasicMaterial color="#e0e7ff" transparent opacity={0.45} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
                  </mesh>
               </group>
            );
         })}
      </>
   );
}

/** Cracked skylights (gone once Riko's dash smashed them) and purple ghost billboards (Vexa phases through). */
function Blocks({ run }: { run: RoofRun }) {
   const blocks = run.course.blocks;
   const refs = useRef<(Group | null)[]>([]);
   useFrame(() => {
      for (let i = 0; i < blocks.length; i++) {
         const g = refs.current[i];
         if (g && blocks[i].kind === "crack") g.visible = run.broken[i] !== 1;
      }
   });
   return (
      <>
         {blocks.map((b, i) => (
            <group
               key={i}
               ref={(g) => {
                  refs.current[i] = g;
               }}
               position={[b.cx, (b.y0 + b.y1) / 2, b.cz]}
            >
               {b.kind === "crack" ? (
                  <>
                     <mesh>
                        <boxGeometry args={[b.hw * 2, b.y1 - b.y0, b.hd * 2]} />
                        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.45} roughness={0.1} metalness={0.3} />
                     </mesh>
                     <mesh position={[0, (b.y1 - b.y0) / 2 + 0.02, 0]} rotation-x={-Math.PI / 2}>
                        <planeGeometry args={[b.hw * 2, b.hd * 2]} />
                        <meshBasicMaterial color="#e0f2fe" wireframe />
                     </mesh>
                  </>
               ) : (
                  <>
                     <mesh>
                        <boxGeometry args={[b.hw * 2, b.y1 - b.y0, b.hd * 2]} />
                        <meshBasicMaterial color="#a78bfa" transparent opacity={0.25} depthWrite={false} />
                     </mesh>
                     <mesh>
                        <boxGeometry args={[b.hw * 2 + 0.04, b.y1 - b.y0 + 0.04, b.hd * 2 + 0.04]} />
                        <meshBasicMaterial color="#8b5cf6" wireframe toneMapped={false} />
                     </mesh>
                  </>
               )}
            </group>
         ))}
      </>
   );
}

/** The level's secrets: a spinning shard or sticker, gone once found. */
function Secrets({ run }: { run: RoofRun }) {
   const secrets = run.course.secrets;
   const refs = useRef<(Mesh | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      for (let i = 0; i < secrets.length; i++) {
         const m = refs.current[i];
         if (!m) continue;
         m.visible = run.secrets.found[i] !== 1;
         m.rotation.y = time.now * 2 + i;
         m.position.y = secrets[i].y + Math.sin(time.now * 2.4 + i) * 0.08;
      }
   });
   return (
      <>
         {secrets.map((o, i) => (
            <mesh
               key={i}
               ref={(m) => {
                  refs.current[i] = m;
               }}
               position={[o.x, o.y, o.z]}
            >
               <octahedronGeometry args={[0.26, 0]} />
               <meshStandardMaterial color="#f87171" emissive="#ef4444" emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

/** The stand-in Ashback while his GLB loads: a dark armoured ball-backed body with grey plates. */
function AshbackStandIn() {
   return (
      <group>
         <mesh position={[0, 0.95, 0]} scale={[0.9, 0.75, 1.1]}>
            <sphereGeometry args={[1, 16, 12]} />
            <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.3} />
         </mesh>
         {[-0.45, 0, 0.45].map((z) => (
            <mesh key={z} position={[0, 1.5, z]} scale={[0.85, 0.25, 0.32]}>
               <sphereGeometry args={[1, 12, 8]} />
               <meshStandardMaterial color="#94a3b8" roughness={0.5} metalness={0.4} />
            </mesh>
         ))}
         <mesh position={[0, 0.9, 1.15]}>
            <sphereGeometry args={[0.32, 10, 8]} />
            <meshStandardMaterial color="#1e293b" />
         </mesh>
      </group>
   );
}

/**
 * Ashback (level 5 solo): where rules placeBoss puts him, facing the side he goes for; curled and
 * spinning while he rams (P3), flashing on a hit, fleeing off the pad on his defeat. His water tank
 * rolls across the pad in P1; in P2 the ramp he sprays turns grey.
 */
function Ashback({ run }: { run: RoofRun }) {
   const g = useRef<Group>(null);
   const body = useRef<Group>(null);
   const tank = useRef<Group>(null);
   const paint = useRef<Group>(null);
   const paintMesh = useRef<Mesh>(null);
   const time = useGameTime();
   const spin = useRef(0);
   const last = useRef(0);
   const b = run.boss;
   const course = run.course;
   const a = course.arena;
   useFrame(() => {
      if (!b || !a) return;
      const now = time.now;
      const dt = Math.min(0.1, Math.max(0, now - last.current));
      last.current = now;
      const root = g.current;
      if (root) {
         root.visible = b.state.step !== "done";
         root.position.set(b.x, b.y, b.z);
         // face the hero (the GLB faces +z; a quarter turn faces +x)
         root.rotation.y = run.hero.x >= b.x ? Math.PI / 2 : -Math.PI / 2;
      }
      const curled = b.state.step === "attack" && b.state.phase === 2;
      spin.current += curled ? dt * 14 : 0;
      const bd = body.current;
      if (bd) {
         bd.rotation.x = curled ? spin.current : 0;
         const k = curled ? 0.72 : 1;
         const flash = b.state.flashMs > 0 ? 1.12 : 1;
         bd.scale.set(ASHBACK_SCALE * k * flash, ASHBACK_SCALE * k * flash, ASHBACK_SCALE * k * flash);
         bd.position.y = curled ? 0.75 : 0;
         // a wind-up wobble on the telegraph
         bd.rotation.z = b.state.step === "telegraph" ? Math.sin(now * 22) * 0.08 : 0;
      }
      const t = tank.current;
      if (t) {
         t.visible = b.tankOn;
         t.position.set(b.tankX, b.y + 0.6, b.z);
         t.rotation.z -= dt * 8 * a.dir;
      }
      const p = paint.current;
      if (p) {
         p.visible = b.paint !== NONE;
         if (b.paint !== NONE) {
            const s = course.supports[b.paint];
            const sl = s.slope!;
            p.position.set(s.cx, (s.top + s.low) / 2 + 0.05, s.cz);
            // lie on the ramp: tilted about z so it falls towards the slope's dir
            p.rotation.set(0, 0, -Math.atan(sl.grade) * sl.dir);
            paintMesh.current?.scale.set(Math.hypot(s.hw * 2, s.top - s.low), s.hd * 2, 1);
         }
      }
   });
   if (!b || !a) return null;
   return (
      <>
         <group ref={g}>
            <group ref={body}>
               <Suspense fallback={null}>
                  <Model asset={ASSETS.ashback} fallback={<AshbackStandIn />} />
               </Suspense>
            </group>
         </group>
         <group ref={tank} visible={false}>
            <mesh rotation-x={Math.PI / 2}>
               <cylinderGeometry args={[0.6, 0.6, 1.3, 14]} />
               <meshStandardMaterial color="#9a3412" roughness={0.7} />
            </mesh>
         </group>
         <group ref={paint} visible={false}>
            <mesh ref={paintMesh} rotation-x={-Math.PI / 2} renderOrder={2}>
               <planeGeometry args={[1, 1]} />
               <meshStandardMaterial color="#6b7280" roughness={0.95} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
            </mesh>
         </group>
      </>
   );
}

export function Course({ run, clock, won }: { run: RoofRun; clock: VisualClock; won: MutableRefObject<boolean> }) {
   const course = run.course;
   const spots = useSpots(course);
   const time = useGameTime();
   const orbs = course.orbs;
   const crane = LEVELS[run.level].spec.street === "crane";

   const liveUpdate = (i: number, m: Matrix4) => {
      const { s, index } = spots.live[i];
      const gripped = run.hero.support === index && clock.ms <= run.hero.gripUntil;
      if (s.vanish && !gripped && roofGone(s, clock.ms)) return false;
      blockScale(s, SCRATCH);
      m.copy(SCRATCH);
      m.setPosition(supportX(s, clock.ms), deckY(s.top), supportZ(s, clock.ms));
   };

   const orbUpdate = (i: number, m: Matrix4) => {
      if (run.collected[i]) return false;
      const o = orbs[i];
      m.makeRotationY(time.now * 2.4 + i);
      m.scale(SCALE.set(1, 1, 1));
      m.setPosition(o.x, o.y + Math.sin(time.now * 2 + i * 0.7) * 0.1, o.z);
   };

   const glow = useMemo(() => glowTexture(), []);
   useEffect(() => () => glow.dispose(), [glow]);
   const halos = useMemo<Billboard[]>(() => orbs.map((o) => ({ x: o.x, y: o.y, z: o.z, size: ORB_SIZE * 2.2, r: 1, g: 0.86, b: 0.42 })), [orbs]);
   const hideCollected = (data: Float32Array) => {
      let changed = false;
      for (let i = 0; i < orbs.length; i++) {
         const size = run.collected[i] ? 0 : ORB_SIZE * (2.1 + Math.sin(time.now * 3 + i) * 0.2);
         if (data[i * 4 + 3] !== size) {
            data[i * 4 + 3] = size;
            changed = true;
         }
      }
      return changed;
   };
   const codeDry = useMemo(() => spots.codeSlopes.filter((s) => !s.slope!.wet), [spots]);
   const codeWet = useMemo(() => spots.codeSlopes.filter((s) => s.slope!.wet), [spots]);

   void won;
   return (
      <>
         <InstancedModel asset={ASSETS.rooftopBlock} spots={spots.roofs} fallback={null} />
         {spots.slopes.length > 0 ? <InstancedModel asset={ASSETS.slopedRoof} spots={spots.slopes} fallback={<CodeSlopes slopes={codeDry} />} /> : null}
         {spots.wet.length > 0 ? <InstancedModel asset={WET_ROOF} spots={spots.wet} fallback={<CodeSlopes slopes={codeWet} />} /> : null}
         <Buildings spots={spots} />
         <InstancedModel asset={ASSETS.exhaustFan} spots={spots.fans} fallback={null} />
         <InstancedModel asset={ASSETS.solarRack} spots={spots.solar} fallback={null} />
         {spots.live.length > 0 ? <DynamicInstancedModel asset={ASSETS.rooftopBlock} count={spots.live.length} update={liveUpdate} name="live-roofs" /> : null}
         {spots.movers.map(({ s, index }) => (
            <MoverRig key={index} s={s} crane={crane} clock={clock} />
         ))}
         {spots.chimneys.map((s, i) => (
            <Chimney key={i} s={s} />
         ))}
         {spots.ledges.map((s, i) => (
            <WaterTower key={i} s={s} />
         ))}
         {orbs.length > 0 ? <DynamicInstancedModel asset={ASSETS.coin} count={orbs.length} update={orbUpdate} name="coins" /> : null}
         <NeonStrips run={run} decks={spots.decks} />
         <CheckpointLamps course={course} run={run} />
         <Helipad course={course} />
         <Strikes run={run} clock={clock} />
         <Blocks run={run} />
         <Secrets run={run} />
         <Ashback run={run} />
         <BillboardField spots={halos} map={glow} additive aspect={1} opacity={0.85} live={hideCollected} renderOrder={5} />
      </>
   );
}
