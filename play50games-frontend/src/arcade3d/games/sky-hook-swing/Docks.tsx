"use client";

// The docks: islands, rings, the rope, orbs, turrets and the bell. The rope, the claw and the
// turrets are code (a moving line, a claw, a gun). Everything else is a Hyper3D GLB fitted so
// the walkable top or the hook point sits on the rules' coordinate.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Group, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { ANCHOR_HEIGHT, ASSETS, DRONE_WIDTH, GLB_SIZE, fit } from "./assets";
import { COLORS } from "./look";
import { anchorAt, type Anchor } from "./course";
import { anchorPoint, type SwingRun } from "./rules";

export interface VisualClock {
   ms: number;
}

const UP = new Vector3(0, 1, 0);
const DIR = new Vector3();
const QUAT = new Quaternion();

function islandAsset(kind: string) {
   if (kind === "pad") return ASSETS.pad;
   return ASSETS.island;
}

function islandSize(kind: string) {
   return kind === "pad" ? GLB_SIZE.pad : GLB_SIZE.island;
}

function anchorAsset(kind: Anchor["kind"]) {
   if (kind === "post" || kind === "cracked") return kind === "cracked" ? ASSETS.postOld : ASSETS.post;
   if (kind === "heavy") return ASSETS.anchorOld;
   if (kind === "drone") return ASSETS.drone;
   return ASSETS.anchor;
}

function anchorSize(kind: Anchor["kind"]) {
   if (kind === "post") return GLB_SIZE.postV2;
   if (kind === "cracked") return GLB_SIZE.post;
   if (kind === "heavy") return GLB_SIZE.anchor;
   if (kind === "drone") return GLB_SIZE.drone;
   return GLB_SIZE.anchorV2;
}

function Props({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const course = run.course;
   const spots = useMemo(() => course.anchors.map(() => ({ x: 0, y: 0, z: 0 })), [course]);
   const refs = useRef<Array<Group | null>>([]);
   const orbs = useRef<Array<Mesh | null>>([]);
   useFrame(() => {
      const ms = clock.ms;
      for (let i = 0; i < course.anchors.length; i++) {
         const g = refs.current[i];
         if (!g) continue;
         const p = anchorAt(course.anchors[i], ms, run.fallMs, spots[i]);
         g.position.set(p.x, p.y, p.z);
         g.visible = course.anchors[i].kind !== "fall" || run.fallMs >= 0;
      }
      for (let i = 0; i < course.orbs.length; i++) {
         const m = orbs.current[i];
         if (m) m.visible = !run.collected[i];
      }
   });
   return (
      <group>
         {course.islands.map((s, i) => {
            const size = islandSize(s.kind);
            const wide = Math.max(size.x, size.z);
            const scale = fit(wide, s.r * 2);
            const y = s.y - size.y * scale;
            return (
               <Model key={i} asset={s.kind === "net" ? ASSETS.island : islandAsset(s.kind)} position={[s.x, y, s.z]} scale={scale} />
            );
         })}
         {course.anchors.map((a, i) => {
            const size = anchorSize(a.kind);
            const scale = a.kind === "drone" ? fit(size.x, DRONE_WIDTH) : fit(size.y, ANCHOR_HEIGHT);
            return (
               <group key={i} ref={(g) => { refs.current[i] = g; }}>
                  <group position={[0, -size.y * scale, 0]}>
                     <Model asset={anchorAsset(a.kind)} scale={scale} />
                  </group>
               </group>
            );
         })}
         {course.turrets.map((t, i) => (
            <group key={i} position={[t.x, t.y, t.z]} visible={!run.turretHit[i]}>
               <mesh position={[0, 0.4, 0]}>
                  <cylinderGeometry args={[0.7, 0.9, 1.4, 8]} />
                  <meshStandardMaterial color={COLORS.turret} roughness={0.4} metalness={0.35} />
               </mesh>
               <mesh position={[0.9, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.18, 0.18, 1.4, 8]} />
                  <meshStandardMaterial color="#475569" />
               </mesh>
            </group>
         ))}
         {course.bell ? (
            <mesh position={[course.bell.x, course.bell.y, course.bell.z]}>
               <sphereGeometry args={[0.7, 16, 12]} />
               <meshStandardMaterial color={COLORS.bell} emissive={COLORS.bell} emissiveIntensity={0.45} />
            </mesh>
         ) : null}
         {course.anchors.filter((a) => a.kind === "blade").map((a) => {
            const scale = fit(GLB_SIZE.windmill.y, ANCHOR_HEIGHT);
            return (
               <Model
                  key="windmill"
                  asset={ASSETS.windmill}
                  position={[a.hubX, a.hubY - GLB_SIZE.windmill.y * scale, a.hubZ]}
                  scale={scale}
               />
            );
         })}
         {course.orbs.map((o, i) => (
            <mesh key={i} ref={(m) => { orbs.current[i] = m; }} position={[o.x, o.y, o.z]}>
               <sphereGeometry args={[0.32, 12, 10]} />
               <meshStandardMaterial
                  color={o.kind === "magnet" ? COLORS.magnet : COLORS.orb}
                  emissive={o.kind === "magnet" ? COLORS.magnet : COLORS.orb}
                  emissiveIntensity={0.35}
               />
            </mesh>
         ))}
      </group>
   );
}

export function Rope({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   const ref = useRef<Mesh>(null);
   const tip = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   useFrame(() => {
      const mesh = ref.current;
      const h = run.hero;
      if (!mesh) return;
      if (h.mode !== "swing") {
         mesh.visible = false;
         return;
      }
      anchorPoint(run, h.anchor, clock.ms, tip);
      const hx = h.x;
      const hy = h.y + 1.15;
      const hz = h.z;
      const len = Math.max(0.2, Math.hypot(hx - tip.x, hy - tip.y, hz - tip.z));
      mesh.visible = true;
      mesh.position.set((hx + tip.x) / 2, (hy + tip.y) / 2, (hz + tip.z) / 2);
      DIR.set(hx - tip.x, hy - tip.y, hz - tip.z).normalize();
      QUAT.setFromUnitVectors(UP, DIR);
      mesh.quaternion.copy(QUAT);
      mesh.scale.set(1, len, 1);
      const mat = mesh.material as unknown as { emissiveIntensity: number; color: { set: (c: string) => void } };
      mat.emissiveIntensity = h.peak ? 0.8 : 0.05;
      mat.color.set(h.peak ? COLORS.peak : COLORS.rope);
   });
   return (
      <mesh ref={ref}>
         <cylinderGeometry args={[0.045, 0.045, 1, 6]} />
         <meshStandardMaterial color={COLORS.rope} emissive={COLORS.peak} emissiveIntensity={0.05} />
      </mesh>
   );
}

export default function Docks({ run, clock }: { run: SwingRun; clock: VisualClock }) {
   return (
      <group>
         <Props run={run} clock={clock} />
         <Rope run={run} clock={clock} />
      </group>
   );
}
