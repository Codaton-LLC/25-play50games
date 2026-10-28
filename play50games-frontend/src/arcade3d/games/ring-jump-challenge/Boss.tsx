"use client";

// Cyclone Ray (level 5), drawn from the rules' pure rayPose: its own Hyper3D GLB (m2CycloneRayBoss),
// 13 m across the wings, swimming its spiral under the hero, banking belly-up when it opens in phase 2,
// diving to the sea and surfacing with its tail pad in phase 3. A wing-beat bob, a pulse on the
// telegraph, a flash and recoil on a hit, its back fin glowing gold once the dive strike is charged,
// the tail pad's target ring on the water, and the slow-mo finish (visual only, menu2/boss bossTimeScale).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { stepProgress } from "@/arcade3d/menu2/boss/boss";
import { ASSETS, BOSS_SCALE, GLB_SIZE } from "./assets";
import { CYCLONE_RAY } from "./progression";
import { RAY, TAIL, createRayPose, rayPose, type RingRun } from "./rules";

/** The GLB's own facing: turned so the head leads the swim (README "Models"). */
export const BOSS_YAW = Math.PI;

export function CycloneRay({ run, clock }: { run: RingRun; clock: { ms: number } }) {
   const root = useRef<Group>(null);
   const body = useRef<Group>(null);
   const fin = useRef<Mesh>(null);
   const pad = useRef<Mesh>(null);
   const pose = useMemo(createRayPose, []);
   const time = useGameTime();
   const fallback = useMemo(
      () => (
         <mesh scale={[GLB_SIZE.boss.x, GLB_SIZE.boss.y * 0.35, GLB_SIZE.boss.z]} position={[0, GLB_SIZE.boss.y * 0.3, 0]}>
            <sphereGeometry args={[0.5, 20, 12]} />
            <meshStandardMaterial color="#4338ca" emissive="#22d3ee" emissiveIntensity={0.3} />
         </mesh>
      ),
      [],
   );
   useFrame(() => {
      const g = root.current;
      const b = run.boss;
      if (!g) return;
      const ms = clock.ms < 0 ? 0 : clock.ms;
      rayPose(run, ms, pose);
      const show = !!b && pose.visible && !(b.step === "done" && b.phase < 2);
      g.visible = show;
      if (pad.current) pad.current.visible = !!b && b.phase === 2 && (b.step === "vulnerable" || b.step === "attack");
      if (!show || !b) return;
      const t = time.now;
      const flap = Math.sin(t * 2.2) * 0.35;
      g.position.set(pose.x, pose.y + flap * 0.6, pose.z);
      // swim heading (+z of the model along the travel), banked when open
      g.rotation.set(0, Math.atan2(Math.cos(pose.heading), Math.sin(pose.heading)) + BOSS_YAW, pose.bank * Math.PI * 0.85, "YXZ");
      let s = 1;
      if (b.step === "telegraph") s = 1 + 0.06 * Math.sin(stepProgress(b, CYCLONE_RAY) * Math.PI * 6);
      if (b.flashMs > 0) s *= 1 + 0.12 * (b.flashMs / CYCLONE_RAY.hitFlashMs);
      if (b.step === "defeat" || b.step === "done") s *= Math.max(0.2, 1 - Math.max(0, b.defeatMs - 600) / 3000);
      if (body.current) {
         body.current.scale.setScalar(s);
         body.current.rotation.z = flap * 0.15;
      }
      if (fin.current) {
         const charged = run.charged && b.phase === 0;
         fin.current.visible = charged || (b.phase === 1 && b.step === "vulnerable");
         const k = b.step === "vulnerable" ? 1 : 0.5;
         fin.current.position.set(pose.hx, pose.hy + 0.6, pose.hz);
         fin.current.scale.setScalar((b.phase === 0 ? RAY.fin.r : RAY.body.r) * (0.8 + 0.2 * Math.sin(t * 8)) * k);
         (fin.current.material as MeshBasicMaterial).opacity = 0.35 + 0.25 * k;
      }
      if (pad.current) {
         pad.current.position.set(pose.x, TAIL.y + 0.15, pose.z);
         pad.current.scale.setScalar(1 + 0.05 * Math.sin(t * 5));
      }
   });
   return (
      <>
         <group ref={root} visible={false}>
            <group ref={body}>
               <Model asset={ASSETS.boss} scale={BOSS_SCALE} position={[0, -GLB_SIZE.boss.y * BOSS_SCALE * 0.45, 0]} fallback={fallback} />
            </group>
         </group>
         <mesh ref={fin} visible={false} renderOrder={6}>
            <sphereGeometry args={[1, 18, 12]} />
            <meshBasicMaterial color="#ffe066" transparent opacity={0.5} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
         </mesh>
         <mesh ref={pad} rotation-x={-Math.PI / 2} visible={false} renderOrder={6}>
            <ringGeometry args={[run.course.pad.r - 0.5, run.course.pad.r, 40]} />
            <meshBasicMaterial color="#7ef9ff" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
         </mesh>
      </>
   );
}
