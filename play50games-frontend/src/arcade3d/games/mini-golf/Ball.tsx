"use client";

// The ball (drawn 1.5x, dimpled, rolling with its speed), its blob shadow, the aim preview (core
// TrajectoryDots along a straight line of exactly the previewLength) and the power ring around the
// ball (filled to the power; grey while the 0.5 s ready gap fills). Reads the run and the aim in
// useFrame; no allocation per frame.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Group, type InstancedMesh, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { BlobShadow, TrajectoryDots, useCanvasTexture, useInstanceMatrices, type InstanceSpot } from "@/arcade3d/core/render";
import type { Projectile } from "@/arcade3d/core/ballistics";
import { heightAt } from "./course";
import { COLORS, holeZ } from "./looks";
import { BALL } from "./physics";
import { TICK, currentHole, readiness, type RunState } from "./rules";

/** Shared between the Scene (writes, in useRunFrame) and the ball's visuals (read in useFrame). */
export interface AimView {
   /** the preview is shown (aiming, ball at rest) */
   on: boolean;
   /** world direction and length of the preview, the power */
   dx: number;
   dz: number;
   length: number;
   power: number;
}

export const DOTS = { count: 12, step: 0.1 } as const;
const RING_DASHES = 24;
const PARAMS = { gravity: 0, wind: { x: 0, z: 0 } };

function drawDimples(ctx: CanvasRenderingContext2D, w: number, h: number) {
   ctx.fillStyle = "#ffffff";
   ctx.fillRect(0, 0, w, h);
   ctx.fillStyle = "#e2e8f0";
   for (let y = 4; y < h; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < w; x += 8) ctx.beginPath(), ctx.arc(x, y, 1.6, 0, Math.PI * 2), ctx.fill();
}

const AXIS = new Vector3();
const SPIN = new Quaternion();

export function GolfBall({ run, aim }: { run: RunState; aim: AimView }) {
   const group = useRef<Group>(null);
   const body = useRef<Mesh>(null);
   const ring = useRef<InstancedMesh>(null);
   const ringMat = useRef<MeshBasicMaterial>(null);
   const time = useGameTime();
   const map = useCanvasTexture(64, 32, drawDimples);
   const shot = useMemo<Projectile>(() => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }), []);
   const dots = useRef({ visible: false, groundY: -1 });
   const dashes = useMemo<InstanceSpot[]>(
      () => Array.from({ length: RING_DASHES }, (_v, i) => {
         // clockwise from the top of the screen-ish (-z), around the ball
         const a = (i / RING_DASHES) * Math.PI * 2;
         return { x: Math.sin(a) * 0.2, y: 0, z: -Math.cos(a) * 0.2, rotY: -a };
      }),
      []
   );

   useInstanceMatrices(ring, dashes);

   useFrame(() => {
      const g = group.current;
      if (!g) return;
      const b = run.ball;
      const hole = currentHole(run);
      const z0 = holeZ(hole.index);
      // drop into the cup over TICK.drop seconds, then gone
      let y = b.y - BALL.radius + BALL.drawnRadius;
      let shown = b.mode !== "pipe";
      if (b.mode === "cup") {
         const t = run.phase === "holeOut" ? run.outTicks / TICK.hz : TICK.drop;
         y = (heightAt(hole, b.x, b.z) ?? 0) + BALL.drawnRadius - Math.min(1, t / 0.3) * 0.2;
         shown = t < 0.3;
      }
      g.visible = shown;
      g.position.set(b.x, y, z0 + b.z);
      // roll: turn about the axis across the motion by distance / radius
      const v = Math.hypot(b.vx, b.vz);
      if (body.current && v > 1e-4 && b.mode === "roll") {
         AXIS.set(b.vz / v, 0, -b.vx / v);
         SPIN.setFromAxisAngle(AXIS, (v * time.delta) / BALL.drawnRadius);
         body.current.quaternion.premultiply(SPIN);
      }
      // the preview: 12 dots, the last exactly at the preview length (velocity = L / (11 step))
      const k = aim.length / ((DOTS.count - 1) * DOTS.step);
      const felt = b.y - BALL.radius;
      shot.x = b.x;
      shot.y = felt + BALL.radius;
      shot.z = z0 + b.z;
      shot.vx = aim.dx * k;
      shot.vy = 0;
      shot.vz = aim.dz * k;
      dots.current.visible = aim.on;
      dots.current.groundY = felt - 0.1;
      // the ring: power while ready, the ready gap filling in grey
      const ready = readiness(run);
      const fill = ready < 1 ? ready : aim.power;
      if (ring.current) {
         ring.current.count = Math.round(fill * RING_DASHES);
         ring.current.visible = run.phase === "aim" && shown;
      }
      ringMat.current?.color.set(ready < 1 ? COLORS.ringWait : COLORS.ring);
   });

   return (
      <>
         <group ref={group} name="ball">
            <mesh ref={body}>
               <sphereGeometry args={[BALL.drawnRadius, 18, 12]} />
               <meshStandardMaterial map={map} roughness={0.35} color={COLORS.ball} />
            </mesh>
            <group position-y={-BALL.drawnRadius + 0.006}>
               <BlobShadow radius={BALL.drawnRadius * 1.1} y={0} opacity={0.35} />
            </group>
            <group position-y={-BALL.drawnRadius + 0.012}>
               <instancedMesh ref={ring} args={[undefined, undefined, RING_DASHES]} name="power-ring">
                  <boxGeometry args={[0.035, 0.006, 0.014]} />
                  <meshBasicMaterial ref={ringMat} color={COLORS.ring} />
               </instancedMesh>
            </group>
         </group>
         <DotsLink shot={shot} dots={dots} />
      </>
   );
}

/** The preview dots (reads the visibility the ball's frame wrote). */
function DotsLink({ shot, dots }: { shot: Projectile; dots: { current: { visible: boolean; groundY: number } } }) {
   const ref = useRef<Group>(null);
   useFrame(() => {
      if (ref.current) ref.current.visible = dots.current.visible;
   });
   return (
      <group ref={ref}>
         <TrajectoryDots projectile={shot} params={PARAMS} count={DOTS.count} step={DOTS.step} groundY={-100} radius={0.03} endScale={0.6} color={COLORS.dots} opacity={0.95} endOpacity={0.35} />
      </group>
   );
}
