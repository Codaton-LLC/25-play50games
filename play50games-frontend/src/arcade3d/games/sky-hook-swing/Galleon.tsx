"use client";

// Level 5's set-piece: the Gust Galleon. A storm-fleet hull flies alongside the run under three huge
// balloons; its yardarms carry the hull rings out over the route; its three cannon turrets ride
// their own storm rocks by the route (telegraph glow, a cannonball, knocked off on a hit); the mast
// and sail stand on the foredeck with the drone circling; the Tide Bell hangs in the crow's nest frame
// on the landing pad. In the escape phase the hull sinks and tilts and its broken planks carry the
// falling rings. Visual only: every hit point is the rules' (course.turrets, mast, bell).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { LatheGeometry, Vector2, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { ASSETS, GLB_SIZE, TURRET_HEIGHT, fit } from "./assets";
import { COLORS } from "./look";
import { anchorAt } from "./course";
import { RING_R, type VisualClock } from "./Docks";
import type { SwingRun } from "./rules";

const P = { x: 0, y: 0, z: 0 };
/** where the galleon's hull runs beside the route (m): the far side from the default camera */
export const HULL_Z = -21;
const SIDE = Math.sign(HULL_Z);
const HULL_Y = 1.5;

function bellGeometry(): LatheGeometry {
   const pts = [
      [0.0, 1.05],
      [0.18, 1.04],
      [0.3, 0.92],
      [0.36, 0.6],
      [0.45, 0.25],
      [0.66, 0.06],
      [0.7, 0.0],
      [0.6, 0.02],
   ].map(([x, y]) => new Vector2(x, y));
   return new LatheGeometry(pts, 24);
}

export default function Galleon({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const course = run.course;
   const g = course.galleon;
   const time = useGameTime();
   const hull = useRef<Group>(null);
   const turrets = useRef<Array<Group | null>>([]);
   const glows = useRef<Array<Mesh | null>>([]);
   const shot = useRef<Mesh>(null);
   const sail = useRef<Mesh>(null);
   const bell = useRef<Group>(null);
   const planks = useRef<Array<Group | null>>([]);
   const bellGeo = useMemo(() => bellGeometry(), []);
   const falls = useMemo(() => course.anchors.map((a, i) => (a.kind === "fall" ? i : -1)).filter((i) => i >= 0), [course]);
   const cuts = useMemo(() => course.anchors.map((a, i) => (a.cut ? i : -1)).filter((i) => i >= 0), [course]);
   const balloons = useMemo(() => {
      if (!g) return [];
      const s = fit(GLB_SIZE.airship.y, 24);
      return [0.2, 0.5, 0.8].map((k) => ({ x: g.x0 + (g.x1 - g.x0) * k, y: HULL_Y + 22, z: HULL_Z, scale: s, rotY: k * 2 }));
   }, [g]);
   const won = useRef(-1);

   useFrame(() => {
      const b = run.boss;
      if (!g || !b) return;
      const now = time.now;
      // the hull: rides the storm, then sinks and lists once the escape starts
      const sinking = run.fallMs >= 0 ? Math.max(0, clock.ms - run.fallMs) / 1000 : 0;
      if (hull.current) {
         hull.current.position.y = Math.sin(now * 0.5) * 0.35 - Math.min(14, sinking * sinking * 0.25);
         hull.current.rotation.x = Math.sin(now * 0.37) * 0.015 - Math.min(0.22, sinking * 0.03);
         hull.current.rotation.z = Math.min(0.12, sinking * 0.015);
      }
      // the turrets: the next live one aims and glows through its telegraph; knocked-off ones fall away
      let next = 0;
      while (next < run.turretHit.length && run.turretHit[next]) next++;
      course.turrets.forEach((t, i) => {
         const tg = turrets.current[i];
         if (tg) {
            const hit = run.turretHit[i] === 1;
            tg.visible = !hit || tg.position.y > t.y - 40;
            if (hit) {
               tg.position.y -= 0.35;
               tg.rotation.z += 0.04;
            } else {
               tg.position.y = t.y - TURRET_HEIGHT * 0.62 + Math.sin(now * 0.8 + i) * 0.12;
            }
         }
         const glow = glows.current[i];
         if (glow) {
            const live = i === next && b.phase === 0;
            const open = b.step === "vulnerable";
            const tele = b.step === "telegraph";
            glow.visible = live && (tele || open) && !run.turretHit[i];
            const k = tele ? 0.6 + Math.sin(now * 18) * 0.4 : 1;
            glow.scale.setScalar(open ? 2.3 + Math.sin(now * 5) * 0.2 : 1.2 * k);
            (glow.material as MeshStandardMaterial).color.set(open ? COLORS.peak : COLORS.hazard);
            (glow.material as MeshStandardMaterial).emissive.set(open ? COLORS.peak : COLORS.hazard);
         }
      });
      if (shot.current) {
         shot.current.visible = run.shotLive;
         shot.current.position.set(run.shotX, run.shotY, run.shotZ);
      }
      // the sail tears when the drone is swung into the mast
      if (sail.current) {
         const torn = b.phase >= 2;
         sail.current.scale.set(1, torn ? 0.45 : 1, 1);
         sail.current.position.y = torn ? -1.6 : 0;
         sail.current.rotation.y = Math.sin(now * 1.2) * 0.12;
      }
      // the falling hull planks carry their rings
      falls.forEach((i, k) => {
         const pg = planks.current[k];
         if (!pg) return;
         anchorAt(course.anchors[i], clock.ms, run.fallMs, P);
         pg.position.set(P.x, P.y + RING_R + 0.5, P.z);
         pg.rotation.z = Math.sin(now * 0.8 + k) * 0.1 + (run.fallMs >= 0 ? 0.25 : 0);
      });
      // the bell swings once it is rung
      if (bell.current) {
         if (run.ended === "win" && won.current < 0) won.current = now;
         const t = won.current < 0 ? 0 : now - won.current;
         bell.current.rotation.x = won.current < 0 ? Math.sin(now * 1.1) * 0.04 : Math.sin(t * 9) * 0.6 * Math.exp(-t * 0.8);
      }
   });

   if (!g) return null;
   const length = g.x1 - g.x0;
   const cx = (g.x0 + g.x1) / 2;
   const turretScale = fit(GLB_SIZE.turret.y, TURRET_HEIGHT);
   const mast = course.mast;
   const bellSpot = course.bell;
   return (
      <group>
         {/* the hull beside the route, under its balloons */}
         <group ref={hull}>
            <group position={[cx, HULL_Y, HULL_Z]}>
               <mesh position={[0, -2.6, 0]}>
                  <boxGeometry args={[length, 5.2, 11]} />
                  <meshStandardMaterial color={COLORS.hull} roughness={0.85} />
               </mesh>
               <mesh position={[0, -6.2, 0]}>
                  <boxGeometry args={[length * 0.94, 2.4, 7]} />
                  <meshStandardMaterial color={COLORS.hullDark} roughness={0.9} />
               </mesh>
               <mesh position={[0, -8, 0]}>
                  <boxGeometry args={[length * 0.86, 1.4, 2.2]} />
                  <meshStandardMaterial color="#2a1a0f" roughness={0.9} />
               </mesh>
               {/* the bow, a gold gunwale, gun ports along the side that faces the route */}
               <mesh position={[length / 2 + 4, -2.6, 0]} rotation={[0, 0, -Math.PI / 2]}>
                  <coneGeometry args={[5.6, 8, 4, 1]} />
                  <meshStandardMaterial color={COLORS.hull} roughness={0.85} />
               </mesh>
               <mesh position={[0, 0.1, 0]}>
                  <boxGeometry args={[length + 0.4, 0.5, 11.6]} />
                  <meshStandardMaterial color={COLORS.hullTrim} metalness={0.5} roughness={0.4} />
               </mesh>
               {Array.from({ length: Math.floor(length / 7) }, (_, k) => (
                  <mesh key={k} position={[-length / 2 + 4 + k * 7, -2.2, -SIDE * 5.55]}>
                     <boxGeometry args={[1.4, 1.1, 0.2]} />
                     <meshStandardMaterial color="#1c1410" emissive={COLORS.hazard} emissiveIntensity={0.35} />
                  </mesh>
               ))}
               {/* its own masts with storm sails */}
               {[-0.3, 0.05, 0.38].map((k, i) => (
                  <group key={i} position={[k * length, 0, 0]}>
                     <mesh position={[0, 8, 0]}>
                        <cylinderGeometry args={[0.35, 0.5, 16, 8]} />
                        <meshStandardMaterial color="#4a3221" roughness={0.8} />
                     </mesh>
                     <mesh position={[0, 9, -0.6]}>
                        <boxGeometry args={[9, 8, 0.1]} />
                        <meshStandardMaterial color="#5b4b8a" roughness={0.95} />
                     </mesh>
                  </group>
               ))}
            </group>
            {/* the yardarms that carry the hull rings out over the route */}
            {cuts.map((i) => {
               const a = course.anchors[i];
               const top = a.y + RING_R + 2.2;
               const reach = Math.abs(HULL_Z) - 4;
               return (
                  <group key={i}>
                     <mesh position={[a.x, top, SIDE * (reach / 2 + 1)]} rotation={[Math.PI / 2, 0, 0]}>
                        <cylinderGeometry args={[0.22, 0.28, reach + 2, 8]} />
                        <meshStandardMaterial color="#4a3221" roughness={0.8} />
                     </mesh>
                     <mesh position={[a.x, (top + HULL_Y) / 2, SIDE * (reach + 0.4)]} rotation={[SIDE * -0.6, 0, 0]}>
                        <cylinderGeometry args={[0.04, 0.04, top - HULL_Y + 2, 4]} />
                        <meshStandardMaterial color={COLORS.ropeDark} />
                     </mesh>
                     <CutCable run={run} index={i} top={top} />
                  </group>
               );
            })}
         </group>
         <InstancedModel asset={ASSETS.airship} spots={balloons} fallback={null} />
         {/* the turrets on their storm rocks, facing back down the route */}
         {course.turrets.map((t, i) => (
            <group key={i} ref={(r) => { turrets.current[i] = r; }} position={[t.x, t.y - TURRET_HEIGHT * 0.62, t.z + SIDE * 1.6]} rotation={[0, -Math.PI / 2, 0]}>
               <group scale={turretScale}>
                  <Model asset={ASSETS.turret} />
               </group>
            </group>
         ))}
         {course.turrets.map((t, i) => (
            <mesh key={`g${i}`} ref={(m) => { glows.current[i] = m; }} position={[t.x - 0.9, t.y + 0.5, t.z + SIDE * 1.6]}>
               <sphereGeometry args={[0.45, 14, 10]} />
               <meshStandardMaterial color={COLORS.hazard} emissive={COLORS.hazard} emissiveIntensity={1.6} transparent opacity={0.55} depthWrite={false} />
            </mesh>
         ))}
         <mesh ref={shot}>
            <sphereGeometry args={[0.55, 16, 12]} />
            <meshStandardMaterial color="#1e1b4b" emissive={COLORS.hazard} emissiveIntensity={1.4} roughness={0.3} metalness={0.4} />
         </mesh>
         {/* the foredeck mast and its sail; the drone flies round its top */}
         {mast ? (
            <group position={[mast.x + 1.2, 2.4, mast.z - 2.2]}>
               <mesh position={[0, 6.5, 0]}>
                  <cylinderGeometry args={[0.3, 0.45, 13, 10]} />
                  <meshStandardMaterial color="#5a3d26" roughness={0.75} />
               </mesh>
               <mesh position={[0, 9.4, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.14, 0.14, 7, 6]} />
                  <meshStandardMaterial color="#5a3d26" roughness={0.75} />
               </mesh>
               <group position={[0, 6.6, 0.15]}>
                  <mesh ref={sail}>
                     <planeGeometry args={[6.4, 5.4, 6, 4]} />
                     <meshStandardMaterial color={COLORS.sail} roughness={0.95} side={2} />
                  </mesh>
               </group>
            </group>
         ) : null}
         {/* the broken planks that carry the falling rings */}
         {falls.map((i, k) => (
            <group key={i} ref={(r) => { planks.current[k] = r; }}>
               <mesh>
                  <boxGeometry args={[3.2, 0.35, 1.4]} />
                  <meshStandardMaterial color={COLORS.hull} roughness={0.85} />
               </mesh>
               <mesh position={[0.9, 0.3, 0]} rotation={[0, 0, 0.5]}>
                  <boxGeometry args={[1.6, 0.25, 1.2]} />
                  <meshStandardMaterial color={COLORS.hullDark} roughness={0.9} />
               </mesh>
            </group>
         ))}
         {/* the Tide Bell in the crow's nest frame on the pad */}
         {bellSpot ? (
            <group position={[bellSpot.x, bellSpot.y - 2.2, bellSpot.z - 1.4]}>
               {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * 1.3, 2.1, 0]}>
                     <cylinderGeometry args={[0.13, 0.16, 4.2, 8]} />
                     <meshStandardMaterial color="#5a3d26" roughness={0.75} />
                  </mesh>
               ))}
               <mesh position={[0, 4.2, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.15, 0.15, 3, 8]} />
                  <meshStandardMaterial color={COLORS.hullTrim} metalness={0.6} roughness={0.35} />
               </mesh>
               <group ref={bell} position={[0, 4.1, 0]}>
                  <mesh geometry={bellGeo} position={[0, -1.15, 0]}>
                     <meshStandardMaterial color={COLORS.bell} metalness={0.85} roughness={0.25} emissive={COLORS.bell} emissiveIntensity={0.25} side={2} />
                  </mesh>
               </group>
            </group>
         ) : null}
      </group>
   );
}

/** The cable from a yardarm down to its hull ring; the drones cut it in phase 2. */
function CutCable({ run, index, top }: { run: SwingRun; index: number; top: number }) {
   const ref = useRef<Mesh>(null);
   const a = run.course.anchors[index];
   useFrame(() => {
      if (ref.current) ref.current.visible = !(run.boss && run.boss.phase >= 1);
   });
   const len = top - a.y - RING_R;
   return (
      <mesh ref={ref} position={[a.x, a.y + RING_R + len / 2, 0]}>
         <cylinderGeometry args={[0.04, 0.04, len, 5]} />
         <meshStandardMaterial color={COLORS.ropeDark} />
      </mesh>
   );
}
