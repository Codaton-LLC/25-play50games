"use client";

// The cannon on its turntable (aimed by the player, recoiling on each shot), the reload ring, the
// 0.8 s trajectory preview with its landing ring on the water, and the cannonballs in flight. The
// cannon's matrix is cannonPose.ts (the rules' muzzle transform); the preview is core TrajectoryDots
// on the rules' launch state with the current wind.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MeshBasicMaterial, RingGeometry, type Group, type Matrix4, type Mesh } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { spring } from "@/arcade3d/core/motion";
import { DynamicInstanced, TrajectoryDots } from "@/arcade3d/core/render";
import type { AimState } from "./aim";
import { ASSETS } from "./assets";
import { cannonMatrix } from "./cannonPose";
import { COLORS } from "./looks";
import { CannonPrimitive, useBallParts } from "./Primitives";
import { CANNON, ballAt, launchState, windParams, type RunState } from "./rules";

/** The preview: 9 dots 0.1 s apart (the first 0.8 s of the flight). */
const PREVIEW = { count: 9, step: 0.1 } as const;
const RECOIL = { kick: 0.35, stiffness: 140 } as const;
const RING_SEGMENTS = 48;

/** What the cannon visuals share with the Scene: the recoil spring (kicked on each shot). */
export interface CannonLook {
   recoil: { x: number; v: number };
}
export const createCannonLook = (): CannonLook => ({ recoil: { x: 0, v: 0 } });
export const kickCannon = (look: CannonLook) => {
   look.recoil.x = RECOIL.kick;
   look.recoil.v = 0;
};

export function Cannon({ run, aim, look }: { run: RunState; aim: AimState; look: CannonLook }) {
   const time = useGameTime();
   const body = useRef<Group>(null);
   const landing = useRef<Mesh>(null);
   const ballParts = useBallParts();
   const [preview] = useMemo(() => [{ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }], []);
   const [params] = useMemo(() => [{ gravity: 9.8, wind: { x: 0, z: 0 } }], []);
   const [scratch] = useMemo(() => [{ buf: new Float32Array(6), at: { x: 0, y: 0, z: 0 }, ball: { launch: preview, params } }], [preview, params]);
   const ringGeometry = useMemo(() => new RingGeometry(1.25, 1.45, RING_SEGMENTS, 1, Math.PI / 2, Math.PI * 2), []);
   const ringMaterial = useMemo(() => new MeshBasicMaterial({ color: COLORS.ring, transparent: true, opacity: 0.85, depthWrite: false }), []);
   const ready = useMemo(() => new Color(COLORS.ring), []);
   const loading = useMemo(() => new Color("#94a3b8"), []);
   useEffect(
      () => () => {
         ringGeometry.dispose();
         ringMaterial.dispose();
      },
      [ringGeometry, ringMaterial]
   );

   useFrame(() => {
      spring(look.recoil, 0, RECOIL.stiffness, -1, time.delta);
      const g = body.current;
      if (g) {
         cannonMatrix(aim.yaw, aim.elevation, look.recoil.x, g.matrix);
         g.matrixWorldNeedsUpdate = true;
      }
      launchState(aim.yaw, aim.elevation, preview);
      windParams(run, params);
      // the reload ring: an arc that fills over the reload, gold when the cannon is ready
      const progress = 1 - run.reload / CANNON.reloadS;
      ringGeometry.setDrawRange(0, Math.max(1, Math.round(progress * RING_SEGMENTS)) * 6);
      ringMaterial.color.copy(progress >= 1 ? ready : loading);
      // the landing ring under the preview's last point (0.8 s into the flight)
      const l = landing.current;
      if (l) {
         ballAt(scratch.ball, PREVIEW.step * (PREVIEW.count - 1), scratch.buf, scratch.at);
         l.position.set(scratch.at.x, 0.08, scratch.at.z);
         const pulse = 1 + 0.08 * Math.sin(time.now * 5);
         l.scale.set(pulse, pulse, pulse);
      }
   });

   const placeBall = (i: number, m: Matrix4) => {
      const b = run.balls[i];
      if (!b.active) return false;
      m.makeTranslation(b.x, b.y, b.z);
   };

   return (
      <group name="cannon">
         {/* the turntable ring on the platform, the reload arc around it */}
         <mesh position={[CANNON.x, CANNON.platformY + 0.02, CANNON.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.95, 1.2, 40]} />
            <meshStandardMaterial color="#57534e" roughness={0.7} metalness={0.2} />
         </mesh>
         <mesh position={[CANNON.x, CANNON.platformY + 0.03, CANNON.z]} rotation={[-Math.PI / 2, 0, 0]} geometry={ringGeometry} material={ringMaterial} />
         <group ref={body} matrixAutoUpdate={false}>
            <Model asset={ASSETS.cannon} fallback={<CannonPrimitive />} />
         </group>
         <TrajectoryDots projectile={preview} params={params} count={PREVIEW.count} step={PREVIEW.step} fraction={1} radius={0.12} opacity={0.9} endOpacity={0.15} endScale={0.5} color={COLORS.dots} />
         <mesh ref={landing} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.7, 0.95, 32]} />
            <meshBasicMaterial color={COLORS.dots} transparent opacity={0.55} depthWrite={false} />
         </mesh>
         <DynamicInstanced count={run.balls.length} update={placeBall} parts={ballParts} name="balls" />
      </group>
   );
}
