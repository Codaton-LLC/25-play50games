"use client";

// The Ornament Vault: a round stone floor with brass rings inside the rim wall (m2ArenaRimWall
// segments round the circle), crystal hills beyond it, the score beacons (m2ScoreBeacon) with their
// banking rings (level 4: only the open one glows), the high pedestals (m2GemPedestal), the cracked
// crystal wall (m2IceCrystal; gone once Riko's dash breaks it), the ghost wall and the back vault,
// the sealed pocket, level 2's sinking hex tiles (m2ArenaTileV2: they shake, then drop into a pit),
// the frost sweepers' band, the treasure chests (m2TreasureChest), the orbs and the secrets.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { Instanced } from "@/arcade3d/core/render/Instanced";
import { BANK_R, beaconActive, sunkGroup, sweepBand, type Arena as ArenaData } from "./arena";
import type { GemRun } from "./rules";
import { ASSETS, GLB_SIZE, RIM_SPAN } from "./assets";
import { COLORS, LOOKS } from "./look";

export interface VisualClock {
   ms: number;
}

/** The rim wall segments round the circle (one InstancedModel). */
export function rimSpots(r: number) {
   const n = Math.ceil((Math.PI * 2 * r) / RIM_SPAN);
   return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { x: Math.sin(a) * r, y: 0, z: Math.cos(a) * r, rotY: a + Math.PI / 2 };
   });
}

/** Crystal hills beyond the rim (non-colliding backdrop). */
export function hillSpots(r: number) {
   return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + 0.2;
      const d = r + 7 + ((i * 5) % 4) * 2;
      const s = 4 + ((i * 7) % 5);
      return { x: Math.sin(a) * d, y: -0.3, z: Math.cos(a) * d, rotY: a * 2.3, scale: s / GLB_SIZE.hill.x };
   });
}

function Floor({ arena }: { arena: ArenaData }) {
   const look = LOOKS[arena.level];
   const r = arena.radius;
   return (
      <group>
         {/* the ground beyond the rim */}
         <mesh rotation-x={-Math.PI / 2} position-y={-0.32} receiveShadow>
            <circleGeometry args={[r + 45, 48]} />
            <meshStandardMaterial color={look.lighting === "night" ? "#151628" : "#b7c7d3"} roughness={1} />
         </mesh>
         {/* the vault floor and its brass rings */}
         <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow>
            <circleGeometry args={[r, 72]} />
            <meshStandardMaterial color={look.floor} roughness={0.85} />
         </mesh>
         <mesh position-y={-0.17}>
            <cylinderGeometry args={[r, r + 0.2, 0.32, 72, 1, true]} />
            <meshStandardMaterial color={COLORS.floorEdge} roughness={0.9} />
         </mesh>
         {[0.35, 0.62, 0.86].map((k) => (
            <mesh key={k} rotation-x={-Math.PI / 2} position-y={0.004}>
               <ringGeometry args={[r * k - 0.08, r * k + 0.08, 72]} />
               <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} emissive="#7c5a0a" emissiveIntensity={look.lighting === "night" ? 0.6 : 0.1} />
            </mesh>
         ))}
         <InstancedModel asset={ASSETS.rim} spots={rimSpots(r - 0.15)} fallback={<Instanced spots={rimSpots(r - 0.15)}><boxGeometry args={[RIM_SPAN, 0.85, 0.5]} /><meshStandardMaterial color="#cbd5e1" /></Instanced>} />
         <InstancedModel asset={ASSETS.hill} spots={hillSpots(r)} fallback={<group />} />
      </group>
   );
}

function Beacons({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   const rings = useRef<(Mesh | null)[]>([]);
   const stone = useRef<(Group | null)[]>([]);
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      const swallowed = run.boss !== null && run.boss.phase === 2 && run.boss.hp > 0;
      for (let i = 0; i < a.beacons.length; i++) {
         const on = beaconActive(a, i, ms) && !swallowed;
         const m = rings.current[i];
         if (m) {
            const mat = m.material as MeshBasicMaterial;
            mat.opacity = on ? 0.55 + 0.25 * Math.sin(ms / 220 + i) : 0.12;
            m.scale.setScalar(on ? 1 + 0.04 * Math.sin(ms / 300) : 0.9);
         }
         const g = stone.current[i];
         if (g) g.position.y = on ? 0 : -0.35;
      }
   });
   return (
      <>
         {a.beacons.map((b, i) => (
            <group key={i} position={[b.x, 0, b.z]}>
               <group ref={(g) => {
                  stone.current[i] = g;
               }}>
                  <Model asset={ASSETS.beacon} />
               </group>
               <mesh ref={(m) => {
                  rings.current[i] = m;
               }} rotation-x={-Math.PI / 2} position-y={0.03}>
                  <ringGeometry args={[BANK_R - 0.25, BANK_R, 40]} />
                  <meshBasicMaterial color={COLORS.beacon} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Pedestals({ arena }: { arena: ArenaData }) {
   return (
      <>
         {arena.pedestals.map((p, i) => (
            <group key={i} position={[p.x, 0, p.z]} scale={[1, p.h / (GLB_SIZE.pedestal.y * (ASSETS.pedestal.scale ?? 1)), 1]}>
               <Model asset={ASSETS.pedestal} />
            </group>
         ))}
      </>
   );
}

function Walls({ run }: { run: GemRun }) {
   const a = run.arena;
   const cracked = useRef<(Group | null)[]>([]);
   useFrame(() => {
      a.spec.crackedWalls.forEach((_, i) => {
         const g = cracked.current[i];
         if (g) g.visible = !run.wallBroken[i];
      });
   });
   return (
      <group>
         {a.solids
            .filter((s) => s.kind === "wall")
            .map((s, i) => (
               <group key={i}>
                  <mesh position={[(s.x0 + s.x1) / 2, 1.1, (s.z0 + s.z1) / 2]} castShadow receiveShadow>
                     <boxGeometry args={[s.x1 - s.x0, 2.2, s.z1 - s.z0]} />
                     <meshStandardMaterial color="#c7bfb2" roughness={0.8} />
                  </mesh>
                  <mesh position={[(s.x0 + s.x1) / 2, 2.25, (s.z0 + s.z1) / 2]}>
                     <boxGeometry args={[s.x1 - s.x0 + 0.08, 0.12, s.z1 - s.z0 + 0.08]} />
                     <meshStandardMaterial color="#c9a227" metalness={0.6} roughness={0.35} />
                  </mesh>
               </group>
            ))}
         {a.spec.crackedWalls.map((w, i) => {
            const cx = (w.x0 + w.x1) / 2;
            const len = w.z1 - w.z0;
            return (
               <group key={i} ref={(g) => {
                  cracked.current[i] = g;
               }} position={[cx, 0, (w.z0 + w.z1) / 2]}>
                  {[-1, 0, 1].map((k) => (
                     <group key={k} position={[0, 0, (k * len) / 3]} rotation-y={k * 0.7} scale={[0.75, 1.25, 0.75]}>
                        <Model asset={ASSETS.crystal} />
                     </group>
                  ))}
                  <mesh position-y={1.1}>
                     <boxGeometry args={[w.x1 - w.x0, 2.2, len]} />
                     <meshStandardMaterial color="#bae6fd" transparent opacity={0.35} roughness={0.2} emissive="#38bdf8" emissiveIntensity={0.25} />
                  </mesh>
               </group>
            );
         })}
         {/* the ghost wall: Vexa phases through it into the back vault */}
         <mesh position={[(a.spec.ghostWall.x0 + a.spec.ghostWall.x1) / 2, 1.1, (a.spec.ghostWall.z0 + a.spec.ghostWall.z1) / 2]}>
            <boxGeometry args={[a.spec.ghostWall.x1 - a.spec.ghostWall.x0, 2.2, a.spec.ghostWall.z1 - a.spec.ghostWall.z0]} />
            <meshStandardMaterial color={COLORS.ghost} transparent opacity={0.45} emissive={COLORS.ghost} emissiveIntensity={0.6} depthWrite={false} />
         </mesh>
      </group>
   );
}

const SHAKE_MS = 1300;

function Tiles({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   const tiles = a.tiles;
   const slabs = useRef<(Group | null)[]>([]);
   const pits = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      if (!tiles) return;
      const ms = Math.max(0, clock.ms);
      const now = sunkGroup(tiles, ms);
      const next = sunkGroup(tiles, ms + SHAKE_MS);
      const into = ms % tiles.everyMs;
      tiles.cells.forEach((c, i) => {
         const g = slabs.current[i];
         const p = pits.current[i];
         const down = c.group === now;
         const shaking = !down && c.group === next;
         if (g) {
            g.position.y = down ? -0.6 - Math.min(2.4, into / 250) : shaking ? 0.02 * Math.sin(ms / 30 + i) : 0;
            g.visible = !down || into < 700;
            g.rotation.z = shaking ? 0.02 * Math.sin(ms / 45 + i) : 0;
         }
         if (p) p.visible = down;
      });
   });
   if (!tiles) return null;
   return (
      <group>
         {tiles.cells.map((c, i) => {
            const w = c.x1 - c.x0;
            const s = (w * 0.96) / GLB_SIZE.tile.x;
            return (
               <group key={i}>
                  <group ref={(g) => {
                  slabs.current[i] = g;
               }} position={[(c.x0 + c.x1) / 2, 0, (c.z0 + c.z1) / 2]}>
                     <group rotation-x={-Math.PI / 2} position-y={-0.15} scale={[s, s, 1]}>
                        <Model asset={ASSETS.tile} />
                     </group>
                     <mesh position-y={-0.1}>
                        <boxGeometry args={[w * 0.98, 0.2, w * 0.98]} />
                        <meshStandardMaterial color="#b9b0a2" roughness={0.9} />
                     </mesh>
                  </group>
                  <mesh ref={(m) => {
                  pits.current[i] = m;
               }} position={[(c.x0 + c.x1) / 2, 0.006, (c.z0 + c.z1) / 2]} rotation-x={-Math.PI / 2} visible={false}>
                     <planeGeometry args={[w, w]} />
                     <meshBasicMaterial color={COLORS.pit} />
                  </mesh>
               </group>
            );
         })}
      </group>
   );
}

function Sweepers({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   const bands = useRef<(Mesh | null)[]>([]);
   const band = useMemo(() => ({ x0: 0, x1: 0 }), []);
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      a.sweepers.forEach((sw, i) => {
         const m = bands.current[i];
         if (!m) return;
         const on = sweepBand(sw, ms, band);
         m.visible = on;
         if (on) {
            m.position.x = (band.x0 + band.x1) / 2;
            m.scale.x = Math.max(0.05, band.x1 - band.x0);
         }
      });
   });
   return (
      <>
         {a.sweepers.map((sw, i) => (
            <group key={i}>
               <mesh rotation-x={-Math.PI / 2} position={[(sw.x0 + sw.x1) / 2, 0.01, (sw.z0 + sw.z1) / 2]}>
                  <planeGeometry args={[sw.x1 - sw.x0, sw.z1 - sw.z0]} />
                  <meshBasicMaterial color={COLORS.frostBand} transparent opacity={0.16} depthWrite={false} />
               </mesh>
               <mesh ref={(m) => {
                  bands.current[i] = m;
               }} position={[0, 0.6, (sw.z0 + sw.z1) / 2]}>
                  <boxGeometry args={[1, 1.2, sw.z1 - sw.z0]} />
                  <meshStandardMaterial color="#e0f2fe" transparent opacity={0.55} emissive="#7dd3fc" emissiveIntensity={0.8} depthWrite={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Chests({ run }: { run: GemRun }) {
   const a = run.arena;
   const refs = useRef<(Group | null)[]>([]);
   useFrame(() => {
      for (let c = 0; c < a.spec.chests.length; c++) {
         const g = refs.current[c];
         if (g) g.scale.setScalar(run.chestOpen[c] ? 0.8 : 1);
      }
   });
   return (
      <>
         {a.spec.chests.map((c, i) => (
            <group key={i} ref={(g) => {
                  refs.current[i] = g;
               }} position={[c.x, 0, c.z]} rotation-y={Math.atan2(-c.x, -c.z)}>
               <Model asset={ASSETS.chest} />
            </group>
         ))}
      </>
   );
}

function Orbs({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      a.orbs.forEach((o, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.orbTaken[i];
         m.position.y = o.y + 0.15 * Math.sin(ms / 400 + i);
      });
   });
   const hue = ["#f472b6", "#38bdf8", "#4ade80", "#facc15", "#a78bfa"];
   return (
      <>
         {a.orbs.map((o, i) => (
            <mesh key={i} ref={(m) => {
                  refs.current[i] = m;
               }} position={[o.x, o.y, o.z]}>
               <sphereGeometry args={[0.28, 16, 12]} />
               <meshStandardMaterial color={hue[i % 5]} emissive={hue[i % 5]} emissiveIntensity={1.2} toneMapped={false} />
            </mesh>
         ))}
      </>
   );
}

function Secrets({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   const refs = useRef<(Mesh | null)[]>([]);
   useFrame(() => {
      const ms = Math.max(0, clock.ms);
      a.secrets.forEach((_, i) => {
         const m = refs.current[i];
         if (!m) return;
         m.visible = !run.secrets.found[i];
         m.rotation.y = ms / 600 + i;
      });
   });
   return (
      <>
         {a.secrets.map((s, i) => (
            <mesh key={i} ref={(m) => {
                  refs.current[i] = m;
               }} position={[s.x, s.y, s.z]}>
               {i === 0 ? <cylinderGeometry args={[0.35, 0.35, 0.06, 5]} /> : <octahedronGeometry args={[0.32]} />}
               <meshStandardMaterial
                  color={i === 0 ? COLORS.sticker : COLORS.shard}
                  emissive={i === 0 ? COLORS.sticker : COLORS.shard}
                  emissiveIntensity={0.9}
                  toneMapped={false}
               />
            </mesh>
         ))}
      </>
   );
}

/** Night (level 4): soft lights over the beacons so the floor reads. */
function NightLights({ arena }: { arena: ArenaData }) {
   if (LOOKS[arena.level].lighting !== "night") return null;
   return (
      <>
         {arena.beacons.map((b, i) => (
            <pointLight key={i} position={[b.x, 3, b.z]} color="#fbbf24" intensity={18} distance={14} decay={2} />
         ))}
      </>
   );
}

export function Vault({ run, clock }: { run: GemRun; clock: VisualClock }) {
   const a = run.arena;
   return (
      <group>
         <Floor arena={a} />
         <Beacons run={run} clock={clock} />
         <Pedestals arena={a} />
         <Walls run={run} />
         <Tiles run={run} clock={clock} />
         <Sweepers run={run} clock={clock} />
         <Chests run={run} />
         <Orbs run={run} clock={clock} />
         <Secrets run={run} clock={clock} />
         <NightLights arena={a} />
      </group>
   );
}
