"use client";

// The Paint Blob (level 5): the grey blob (m2PaintBlobBoss) on its pedestal in the middle of the court.
// Its tell drops a dark ring where you stood (and, in a twin slam, its mirror) that fills as the slam
// comes; the Blob rises and slams down, and the ring flashes grey. After a slam it sags, its core
// glows in your colour and a ring round it shows how close you must be to splat it. A hit flashes it
// white; the defeat squashes it flat and it bursts.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { heroAccent } from "@/arcade3d/menu2/heroAnim";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BLOB_SCALE } from "./assets";
import { COLORS } from "./look";
import { BLOB, SLAM_R } from "./progression";
import { HERO_R, SPLAT_REACH, type PaintRun } from "./rules";

export function Blob({ run }: { run: PaintRun }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const core = useRef<Mesh>(null);
   const flash = useRef<Mesh>(null);
   const reach = useRef<Mesh>(null);
   const rings = useRef<(Group | null)[]>([]);
   const fills = useRef<(Mesh | null)[]>([]);
   const fillMats = useRef<(MeshBasicMaterial | null)[]>([]);
   const spec = run.course.boss;
   useFrame(() => {
      const b = run.boss;
      const g = body.current;
      if (!b || !spec || !g) return;
      const now = time.now;
      const k = stepProgress(b, BLOB);
      let y = spec.y;
      let sy = 1;
      let sxz = 1;
      if (b.step === "telegraph") {
         y += Math.sin(Math.min(1, k) * Math.PI * 0.5) * 2.2;
         sy = 1 + 0.12 * k;
         sxz = 1 - 0.06 * k;
      } else if (b.step === "attack") {
         y += (1 - k) * 0.3;
         sy = 0.7 + 0.3 * k;
         sxz = 1.2 - 0.2 * k;
      } else if (b.step === "vulnerable") {
         sy = 0.78 + Math.sin(now * 3) * 0.03;
         sxz = 1.12;
      } else sy = 1 + Math.sin(now * 2.2) * 0.04;
      if (b.defeatMs >= 0) {
         const d = Math.min(1, b.defeatMs / 1600);
         sy *= 1 - 0.85 * d;
         sxz *= 1 + 0.6 * d;
      }
      g.position.set(spec.x, y, spec.z);
      g.scale.set(BLOB_SCALE * sxz, BLOB_SCALE * sy, BLOB_SCALE * sxz);
      g.rotation.y = Math.atan2(run.hero.x - spec.x, run.hero.z - spec.z);
      g.visible = b.step !== "done";
      const c = core.current;
      if (c) {
         c.visible = b.step === "vulnerable";
         c.position.set(spec.x, y + 1.6, spec.z);
         c.scale.setScalar(0.9 + Math.sin(now * 8) * 0.1);
      }
      const f = flash.current;
      if (f) {
         f.visible = b.flashMs > 0;
         f.position.set(spec.x, y + 1.8, spec.z);
         f.scale.setScalar(3 + (1 - b.flashMs / BLOB.hitFlashMs) * 1.5);
      }
      const r = reach.current;
      if (r) {
         r.visible = b.step === "vulnerable";
         (r.material as MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(now * 6);
      }
      // the slam rings
      const on = b.step === "telegraph" || b.step === "attack";
      const rad = SLAM_R[b.phase] ?? SLAM_R[0];
      for (let i = 0; i < 2; i++) {
         const ring = rings.current[i];
         const fill = fills.current[i];
         if (!ring || !fill) continue;
         const show = on && (i === 0 || run.ring.twin);
         ring.visible = show;
         if (!show) continue;
         const cx = i === 0 ? run.ring.x : 2 * spec.x - run.ring.x;
         const cz = i === 0 ? run.ring.z : 2 * spec.z - run.ring.z;
         ring.position.set(cx, 0.06, cz);
         ring.scale.setScalar(rad);
         const t = b.step === "attack" ? 1 : k;
         fill.scale.setScalar(Math.max(0.01, t));
         const m = fillMats.current[i];
         if (m) m.opacity = b.step === "attack" ? 0.75 : 0.35;
      }
   });
   if (!spec || !run.boss) return null;
   const tint = heroAccent(run.heroId);
   return (
      <>
         <mesh position={[spec.x, spec.y / 2, spec.z]}>
            <cylinderGeometry args={[2.1, 2.3, spec.y, 24]} />
            <meshStandardMaterial color={COLORS.base} roughness={0.5} metalness={0.3} />
         </mesh>
         <mesh position={[spec.x, spec.y + 0.02, spec.z]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[1.9, 2.1, 40]} />
            <meshBasicMaterial color="#e879f9" toneMapped={false} />
         </mesh>
         <group ref={body}>
            <Model asset={ASSETS.blob} tint={COLORS.blob} />
         </group>
         <mesh ref={core} visible={false}>
            <sphereGeometry args={[0.7, 20, 14]} />
            <meshBasicMaterial color={tint} transparent opacity={0.85} toneMapped={false} />
         </mesh>
         <mesh ref={flash} visible={false}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} toneMapped={false} />
         </mesh>
         <mesh ref={reach} position={[spec.x, 0.05, spec.z]} rotation-x={-Math.PI / 2} visible={false}>
            <ringGeometry args={[spec.r + HERO_R + SPLAT_REACH - 0.25, spec.r + HERO_R + SPLAT_REACH, 48]} />
            <meshBasicMaterial color={tint} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
         </mesh>
         {[0, 1].map((i) => (
            <group
               key={i}
               ref={(g) => {
                  rings.current[i] = g;
               }}
               visible={false}
            >
               <mesh rotation-x={-Math.PI / 2}>
                  <ringGeometry args={[0.92, 1, 48]} />
                  <meshBasicMaterial color={COLORS.ring} transparent opacity={0.85} depthWrite={false} />
               </mesh>
               <mesh
                  ref={(m) => {
                     fills.current[i] = m;
                  }}
                  rotation-x={-Math.PI / 2}
               >
                  <circleGeometry args={[1, 48]} />
                  <meshBasicMaterial
                     ref={(m) => {
                        fillMats.current[i] = m;
                     }}
                     color={COLORS.ring}
                     transparent
                     opacity={0.35}
                     depthWrite={false}
                  />
               </mesh>
            </group>
         ))}
      </>
   );
}
