"use client";

// The course (no gameplay here: rules.ts owns it). Floating islands (the shared menu2 islandA slab, a
// glass rock column under plateaus and pillars, a glowing edge strip on every rim: the colour returning),
// the ENTRY portals (m2PortalFrame with a violet filled surface, or a floor pad: m2PortalIsle rim round a
// swirling disc), the ANCHOR obelisks on their pads (m2GlowObelisk on m2PortalAnchorPad; hollow ring
// = an exit can open here), the EXIT frame (m2PortalFrameV2, a filled cyan surface; a wireframe while it
// moves), the ghost arc from the nearest entry, the orbs (menu2 scoreOrb; Riko's in a cracked void
// crystal, Kiro's in a laser cage), Vexa's shard behind a frame, the cargo crystals (m2VoidCrystal), the
// pressure plate and its bridge, the beacon spikes (m2ColorBeacon) and the goal ring. Shape and fill
// carry the state, not hue (World 5's readability rule). Obelisks are clickable: a tap opens the exit there.
import { useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { DynamicInstancedModel, InstancedModel, Model } from "@/arcade3d/core/assets";
import { DynamicInstanced, type InstanceSpot } from "@/arcade3d/core/render";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, FRAME_W, GLB_SIZE, ISLAND_SY, OBELISK_H, ORB_SIZE } from "./assets";
import { EXIT_UP, exitPose, islandOn, type Anchor, type Course, type ExitPose } from "./course";
import { COLORS, levelLook } from "./look";
import { secretIndex } from "./progression";
import { anchorBlocksView } from "./camera";
import { pickLatch } from "./latch";
import { BLOCK_HALF, anchorVisible, pairOpen, previewArc, previewPair, type PortalRun } from "./rules";


const POSE: ExitPose = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, ax: 0, az: 0, yaw: 0 };


function islandSpots(course: Course): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const i of course.islands) {
      const sx = (i.r * 2 * 1.08) / GLB_SIZE.islandA.x;
      const sz = (i.r * 2 * 1.08) / GLB_SIZE.islandA.z;
      const sy = ISLAND_SY / GLB_SIZE.islandA.y;
      out.push({ x: i.x, y: i.y - GLB_SIZE.islandA.top * sy, z: i.z, rotY: (i.id * 1.3) % 6.28, sx, sy, sz });
   }
   return out;
}

function Islands({ run }: { run: PortalRun }) {
   const c = run.course;
   const edge = levelLook(run.level).edge;
   const fixed = useMemo(() => islandSpots({ ...c, islands: c.islands.filter((i) => i.gate < 0) }), [c]);
   const gated = useMemo(() => c.islands.filter((i) => i.gate >= 0), [c]);
   const columns = useMemo(() => c.islands.filter((i) => i.look === "plateau" || i.look === "pillar"), [c]);
   const bridge = useRef<Group[]>([]);
   const time = useGameTime();
   useFrame(() => {
      gated.forEach((i, k) => {
         const g = bridge.current[k];
         if (!g) return;
         const on = islandOn(i, run.gates);
         g.visible = on;
         g.position.y = on ? Math.max(0, g.position.y - 0.12) : -3;
      });
      void time;
   });
   return (
      <>
         <InstancedModel asset={ASSETS.islandA} spots={fixed} fallback={null} />
         {columns.map((i) => {
            const h = Math.min(14, i.y + 6);
            return (
               <mesh key={i.id} position={[i.x, i.y - ISLAND_SY * 0.6 - h / 2, i.z]}>
                  <cylinderGeometry args={[i.r * 0.82, i.r * 0.55, h, 18]} />
                  <meshStandardMaterial color={COLORS.glassDark} roughness={0.55} metalness={0.25} emissive={COLORS.violetDeep} emissiveIntensity={0.35} />
               </mesh>
            );
         })}
         {c.islands
            .filter((i) => i.gate < 0)
            .map((i) => (
               <mesh key={`e${i.id}`} position={[i.x, i.y + 0.03, i.z]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[i.r - 0.18, i.r - 0.02, 48]} />
                  <meshBasicMaterial color={edge} transparent opacity={0.75} toneMapped={false} />
               </mesh>
            ))}
         {gated.map((i, k) => (
            <group key={`g${i.id}`} ref={(g) => { if (g) bridge.current[k] = g; }} visible={false}>
               <mesh position={[i.x, i.y - 0.25, i.z]}>
                  <cylinderGeometry args={[i.r, i.r * 0.85, 0.5, 24]} />
                  <meshStandardMaterial color={COLORS.glass} emissive={COLORS.plate} emissiveIntensity={0.25} roughness={0.4} />
               </mesh>
               <mesh position={[i.x, i.y + 0.03, i.z]} rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[i.r - 0.16, i.r - 0.02, 32]} />
                  <meshBasicMaterial color={COLORS.plate} toneMapped={false} />
               </mesh>
            </group>
         ))}
         {c.goal && (
            <mesh position={[c.goal.x, c.goal.y + 0.05, c.goal.z]} rotation-x={-Math.PI / 2}>
               <ringGeometry args={[c.goal.r - 0.3, c.goal.r, 48]} />
               <meshBasicMaterial color={COLORS.gold} transparent opacity={0.9} toneMapped={false} />
            </mesh>
         )}
      </>
   );
}

/** A portal surface: a filled disc (open), or a wire ring (closed while the exit moves). */
function Surface({ color, radius, refMat }: { color: string; radius: number; refMat?: (m: MeshBasicMaterial | null) => void }) {
   return (
      <mesh>
         <circleGeometry args={[radius, 36]} />
         <meshBasicMaterial ref={refMat} color={color} transparent opacity={0.55} side={DoubleSide} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </mesh>
   );
}

function Entries({ run }: { run: PortalRun }) {
   const c = run.course;
   const mats = useRef<(MeshBasicMaterial | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      c.pairs.forEach((p, k) => {
         const m = mats.current[k];
         if (!m) return;
         const open = pairOpen(run, p.id);
         m.opacity = open ? 0.45 + Math.sin(time.now * 3 + k) * 0.12 : 0.12;
         m.wireframe = !open;
      });
   });
   const fs = FRAME_W / GLB_SIZE.frame.x;
   return (
      <>
         {c.pairs.map((p, k) => {
            const e = p.entry;
            if (e.kind === "wall") {
               return (
                  <group key={p.id} position={[e.x, e.y, e.z]} rotation-y={e.yaw}>
                     <Model asset={ASSETS.frame} scale={fs} />
                     <group position={[0, EXIT_UP, 0.05]}>
                        <Surface color={COLORS.entry} radius={0.95} refMat={(m) => { mats.current[k] = m; }} />
                     </group>
                  </group>
               );
            }
            const s = (e.r * 2 + 0.9) / GLB_SIZE.isle.x;
            return (
               <group key={p.id} position={[e.x, e.y, e.z]}>
                  <Model asset={ASSETS.isle} scale={[s, 0.8, s]} position={[0, -0.31, 0]} />
                  <group position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
                     <Surface color={COLORS.entry} radius={e.r} refMat={(m) => { mats.current[k] = m; }} />
                  </group>
               </group>
            );
         })}
      </>
   );
}

function Obelisk({ run, a }: { run: PortalRun; a: Anchor }) {
   const root = useRef<Group>(null);
   const camera = useThree((st) => st.camera);
   const ring = useRef<Mesh>(null);
   const time = useGameTime();
   const c = run.course;
   const os = OBELISK_H / GLB_SIZE.obelisk.y;
   const ps = 1.9 / GLB_SIZE.anchorPad.x;
   useFrame(() => {
      const g = root.current;
      if (!g) return;
      exitPose(c, a, run.simMs, POSE);
      g.position.set(POSE.ax, a.y, POSE.az);
      g.rotation.y = POSE.yaw;
      const visible = !a.hidden || anchorVisible(run, a) || c.pairs[a.pair].anchors[run.sel[a.pair]] === a.id;
      g.visible = visible && !anchorBlocksView(POSE, camera.position, run.hero);
      const r = ring.current;
      if (r) {
         const selected = c.pairs[a.pair].anchors[run.sel[a.pair]] === a.id;
         r.visible = !selected;
         r.rotation.z = time.now * 0.8;
      }
   });
   const onDown = (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      pickLatch.anchor = a.id;
   };
   return (
      <group ref={root}>
         <Model asset={ASSETS.anchorPad} scale={[ps, 0.35, ps]} position={[0, -0.25, 0]} />
         <Model asset={ASSETS.obelisk} scale={os} onPointerDown={onDown} />
         {/* the hollow ring: an exit can open here (tap it) */}
         <mesh ref={ring} position={[0, OBELISK_H + 0.55, 0]} onPointerDown={onDown}>
            <torusGeometry args={[0.36, 0.06, 8, 24]} />
            <meshBasicMaterial color={a.beacon >= 0 ? COLORS.beacon : a.loop ? COLORS.magenta : COLORS.cyan} toneMapped={false} />
         </mesh>
         {/* a generous invisible hit box for the tap */}
         <mesh position={[0, OBELISK_H / 2, 0]} visible={false} onPointerDown={onDown}>
            <boxGeometry args={[1.6, OBELISK_H + 1, 1.6]} />
            <meshBasicMaterial />
         </mesh>
      </group>
   );
}

/** Each pair's exit frame, in front of its selected anchor (a wire surface while it moves). */
function Exits({ run }: { run: PortalRun }) {
   const c = run.course;
   const camera = useThree((st) => st.camera);
   const groups = useRef<(Group | null)[]>([]);
   const mats = useRef<(MeshBasicMaterial | null)[]>([]);
   const time = useGameTime();
   useFrame(() => {
      c.pairs.forEach((p, k) => {
         const g = groups.current[k];
         if (!g) return;
         const a = c.anchors[p.anchors[run.sel[p.id]]];
         exitPose(c, a, run.simMs, POSE);
         g.position.set(POSE.x, POSE.y - EXIT_UP, POSE.z);
         g.rotation.set(0, POSE.yaw, 0);
         g.visible = !anchorBlocksView(POSE, camera.position, run.hero);
         const open = pairOpen(run, p.id);
         const m = mats.current[k];
         if (m) {
            m.wireframe = !open;
            m.opacity = open ? 0.5 + Math.sin(time.now * 4 + k) * 0.15 : 0.2;
         }
         const s = open ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(time.now * 12));
         g.scale.setScalar(s);
      });
   });
   const fs = FRAME_W / GLB_SIZE.exitFrame.x;
   return (
      <>
         {c.pairs.map((p, k) => (
            <group key={p.id} ref={(g) => { groups.current[k] = g; }}>
               <group rotation-x={0}>
                  <Model asset={ASSETS.exitFrame} scale={fs} />
                  <group position={[0, EXIT_UP, 0.05]}>
                     <Surface color={COLORS.exit} radius={0.95} refMat={(m) => { mats.current[k] = m; }} />
                  </group>
               </group>
            </group>
         ))}
      </>
   );
}

const ARC_POINTS = 48;

/** The ghost arc: where the nearest entry's exit would fling you, updated live as you switch anchors. */
function GhostArc({ run }: { run: PortalRun }) {
   const pts = useMemo(() => new Float32Array(ARC_POINTS * 3), []);
   const count = useRef(0);
   const time = useGameTime();
   useFrame(() => {
      const p = previewPair(run);
      count.current = p.pair >= 0 && pairOpen(run, p.pair) && run.ended === null ? previewArc(run, p.pair, p.speed, pts) : 0;
   }, -0.3);
   return (
      <DynamicInstanced
         count={ARC_POINTS}
         update={(i, m) => {
            if (i >= count.current) return false;
            const s = 0.12 + 0.05 * Math.sin(time.now * 6 - i * 0.5);
            m.makeScale(s, s, s);
            m.setPosition(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
         }}
         name="ghost-arc"
      >
         <sphereGeometry args={[1, 10, 8]} />
         <meshBasicMaterial color={COLORS.arc} transparent opacity={0.85} toneMapped={false} />
      </DynamicInstanced>
   );
}

function Orbs({ run }: { run: PortalRun }) {
   const c = run.course;
   const time = useGameTime();
   const s = ORB_SIZE / GLB_SIZE.orb.y;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.orb}
            count={c.orbs.length}
            update={(i, m) => {
               if (run.orbTaken[i]) return false;
               const o = c.orbs[i];
               m.makeRotationY(time.now * 1.5 + i);
               m.scale(SV.set(s, s, s));
               m.setPosition(o.x, o.y - ORB_SIZE / 2 + Math.sin(time.now * 2 + i) * 0.08, o.z);
            }}
         />
         {c.orbs.map((o, i) =>
            o.gate === "riko" ? (
               <OrbCage key={i} run={run} index={i} kind="crystal" />
            ) : o.gate === "kiro" ? (
               <OrbCage key={i} run={run} index={i} kind="laser" />
            ) : null,
         )}
      </>
   );
}

const SV = new Vector3(1, 1, 1);

/** Riko's cracked crystal round an orb (her dash smashes it), Kiro's laser cage (his shield passes it). */
function OrbCage({ run, index, kind }: { run: PortalRun; index: number; kind: "crystal" | "laser" }) {
   const g = useRef<Group>(null);
   useFrame(() => {
      if (g.current) g.current.visible = !run.orbTaken[index];
   });
   const o = run.course.orbs[index];
   if (kind === "crystal") {
      const s = 1.3 / GLB_SIZE.crystal.z;
      return (
         <group ref={g} position={[o.x, o.y - 0.7, o.z]}>
            <Model asset={ASSETS.crystal} scale={s} tint="#cbd5e1" />
         </group>
      );
   }
   return (
      <group ref={g} position={[o.x, o.y - 0.8, o.z]}>
         {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.sin((k * Math.PI) / 2) * 0.6, 0.8, Math.cos((k * Math.PI) / 2) * 0.6]}>
               <boxGeometry args={[0.04, 1.6, 0.04]} />
               <meshBasicMaterial color={COLORS.laser} toneMapped={false} />
            </mesh>
         ))}
         {[0.2, 0.8, 1.4].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation-x={-Math.PI / 2}>
               <ringGeometry args={[0.56, 0.62, 24]} />
               <meshBasicMaterial color={COLORS.laser} transparent opacity={0.8} toneMapped={false} side={DoubleSide} />
            </mesh>
         ))}
      </group>
   );
}

function Shard({ run }: { run: PortalRun }) {
   const ref = useRef<Mesh>(null);
   const time = useGameTime();
   const sh = run.course.shard;
   const idx = secretIndex(run.level, "ghost-frame");
   useFrame(() => {
      const m = ref.current;
      if (!m) return;
      m.visible = idx >= 0 && !run.secrets.found[idx];
      m.rotation.y = time.now * 2;
   });
   if (!sh) return null;
   return (
      <mesh ref={ref} position={[sh.x, sh.y, sh.z]}>
         <octahedronGeometry args={[0.32]} />
         <meshStandardMaterial color={COLORS.purple} emissive={COLORS.purple} emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
   );
}

function Cargo({ run }: { run: PortalRun }) {
   const c = run.course;
   const s = (BLOCK_HALF * 2) / GLB_SIZE.crystal.z;
   const plates = useRef<(MeshBasicMaterial | null)[]>([]);
   useFrame(() => {
      c.plates.forEach((p, k) => {
         const m = plates.current[k];
         if (m) m.opacity = run.gates[p.gate] ? 1 : 0.5;
      });
   });
   if (c.blocks.length === 0) return null;
   return (
      <>
         <DynamicInstancedModel
            asset={ASSETS.crystal}
            count={c.blocks.length}
            update={(i, m) => {
               const b = run.blocks[i];
               if (b.lostUntil >= 0) return false;
               m.makeScale(s, (BLOCK_HALF * 2) / GLB_SIZE.crystal.y, s);
               m.setPosition(b.x, b.y, b.z);
            }}
         />
         {c.plates.map((p, k) => (
            <group key={k} position={[p.x, p.y + 0.04, p.z]} rotation-x={-Math.PI / 2}>
               <mesh>
                  <circleGeometry args={[p.r, 32]} />
                  <meshBasicMaterial ref={(m) => { plates.current[k] = m; }} color={COLORS.plate} transparent opacity={0.5} toneMapped={false} />
               </mesh>
               <mesh position={[0, 0, 0.01]}>
                  <ringGeometry args={[p.r - 0.12, p.r, 32]} />
                  <meshBasicMaterial color="#fef9c3" toneMapped={false} />
               </mesh>
            </group>
         ))}
      </>
   );
}

function Beacons({ run }: { run: PortalRun }) {
   const c = run.course;
   const s = 3.2 / GLB_SIZE.beacon.y;
   const groups = useRef<(Group | null)[]>([]);
   useFrame(() => {
      c.beacons.forEach((_b, k) => {
         const g = groups.current[k];
         if (g) g.visible = run.beaconAlive[k];
      });
   });
   return (
      <>
         {c.beacons.map((b, k) => (
            <group key={k} ref={(g) => { groups.current[k] = g; }} position={[b.x, b.y, b.z]}>
               <mesh position={[0, -0.6, 0]}>
                  <cylinderGeometry args={[1.4, 0.8, 1.2, 12]} />
                  <meshStandardMaterial color={COLORS.glassDark} roughness={0.6} />
               </mesh>
               <Model asset={ASSETS.beacon} scale={s} />
            </group>
         ))}
      </>
   );
}

export function Course({ run }: { run: PortalRun }) {
   const c = run.course;
   return (
      <>
         <Islands run={run} />
         <Entries run={run} />
         {c.anchors.map((a) => (
            <Obelisk key={a.id} run={run} a={a} />
         ))}
         <Exits run={run} />
         <GhostArc run={run} />
         <Orbs run={run} />
         <Shard run={run} />
         <Cargo run={run} />
         <Beacons run={run} />
      </>
   );
}
