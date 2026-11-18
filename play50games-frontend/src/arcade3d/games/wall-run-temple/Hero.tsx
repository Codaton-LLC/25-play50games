"use client";

// The picked hero on menu2/heroAnim. On a wall the run animation plays with the body tipped 35° off the
// wall (feet on the stone, head toward the corridor); a roll curls into the armoured ball; a kick
// springs off with the takeoff; a column whip leans into the column with the near arm reaching for it.
// Dust puffs from the feet on the wall (Scene's juice). Visual only: nothing here feeds the rules.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { BONE, POSE_MASK, aimArm, blendPoses, createPose, restPose, turnBone, type HumanoidPose } from "@/arcade3d/core/rig";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { AnimatedHero, createHeroMotion, useHeroAnimator, type HeroMotion } from "@/arcade3d/menu2/heroAnim";
import { heroById } from "./heroes";
import { V_JUMP, V_RUN, rolled, type WallRun } from "./rules";

export interface HeroAnim {
   landAt: number;
   jumpAt: number;
   airJumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, jumpAt: -9, airJumpAt: -9, lostAt: -9, spawnAt: -9, winAt: Number.POSITIVE_INFINITY, intro: Number.NaN };
}

interface Memo {
   jumpAt: number;
   airJumpAt: number;
   landAt: number;
   lostAt: number;
}

export function createMotionMemo(): Memo {
   return { jumpAt: -9, airJumpAt: -9, landAt: -9, lostAt: -9 };
}

/** How far the body tips off the wall while running on it (rad). */
export const WALL_TILT = 0.6;

/** The animator's motion for this frame. Pure aside from the motion object it fills. */
export function writeHeroMotion(m: HeroMotion, memo: Memo, run: WallRun, anim: HeroAnim, now: number): void {
   const h = run.hero;
   const ms = run.simMs;
   const onWall = h.mode === "wall";
   m.vx = h.vx;
   m.vy = onWall ? 0 : h.vy;
   m.vz = h.vz;
   // a wall-run reads as a run: the animator plants the feet on the wall's plane (the group is tipped)
   m.grounded = h.mode === "ground" || (onWall && Math.hypot(h.vx, h.vz) > 1);
   const dashing = h.dashUntil >= ms;
   m.power = dashing ? "dash" : h.shieldUntil >= ms ? "shield" : h.magnetUntil >= ms ? "magnet" : h.phaseUntil >= ms ? "phase" : null;
   m.rolling = rolled(h, ms) || h.mode === "lost" || (!Number.isNaN(anim.intro) && anim.intro < 0.97);
   m.celebrating = now - anim.winAt >= 0 && now - anim.winAt < 2.6;
   m.defeated = false;
   if (anim.airJumpAt !== memo.airJumpAt) {
      memo.airJumpAt = anim.airJumpAt;
      m.events.airJumped = true;
   }
   if (anim.jumpAt !== memo.jumpAt) {
      memo.jumpAt = anim.jumpAt;
      m.events.jumped = true;
   }
   if (anim.landAt !== memo.landAt) {
      memo.landAt = anim.landAt;
      m.events.landed = true;
      m.events.landSpeed = 6;
   }
   if (anim.lostAt !== memo.lostAt) {
      memo.lostAt = anim.lostAt;
      m.events.hurt = true;
      m.events.hurtX = -h.faceX;
      m.events.hurtZ = -h.faceZ;
   }
}

/** The whip pose: the near arm reaching to the column, the body leaning in, legs swept. Pure. */
export function whipPose(side: 1 | -1, out: HumanoidPose): HumanoidPose {
   restPose(out);
   out.ground = 0;
   out.lift = 0;
   // the near arm straight out to the column (the hero's left = +x in its own frame)
   aimArm(out, side, 1, 0.25, 0.1, 0, 0.2, 1);
   aimArm(out, side === 1 ? -1 : 1, -0.4, -0.5, -0.4, 0, 0, 1);
   turnBone(out, BONE.upperLegL, -0.5, 0, 0.1);
   turnBone(out, BONE.lowerLegL, 0.9, 0, 0);
   turnBone(out, BONE.upperLegR, 0.2, 0, -0.1);
   turnBone(out, BONE.lowerLegR, 0.4, 0, 0);
   turnBone(out, BONE.spine, 0.15, 0, side * 0.2);
   return out;
}

const AXIS = new Vector3();
const TIP = new Quaternion();
const NONE_Q = new Quaternion();

export function Hero({ run, anim, accent }: { run: WallRun; anim: HeroAnim; accent?: string }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const tilt = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useMemo(createHeroMotion, []);
   const memo = useMemo(createMotionMemo, []);
   const animator = useHeroAnimator(run.heroId, motion, { topSpeed: V_RUN, jumpSpeed: V_JUMP, yaw: Math.PI / 2 });
   const posed = useMemo(createPose, []);
   const st = useMemo(() => ({ wall: 0, whip: 0, yaw: 0, nx: 0, nz: 1, side: 1 as 1 | -1 }), []);
   const color = accent ?? heroById(run.heroId).color;
   const fallback = useMemo(
      () => (
         <mesh position={[0, 0.75, 0]}>
            <capsuleGeometry args={[0.28, 0.7, 6, 10]} />
            <meshStandardMaterial color={color} roughness={0.45} />
         </mesh>
      ),
      [color],
   );

   useFrame(() => {
      writeHeroMotion(motion, memo, run, anim, time.now);
      const h = run.hero;
      const sp = Math.hypot(h.vx, h.vz);
      if (sp > 0.6 && h.mode !== "ground") st.yaw = Math.atan2(h.vx, h.vz);
      else if (h.mode === "ground") st.yaw = Math.atan2(h.faceX, h.faceZ);
      animator.body.yaw = st.yaw;
   }, FRAME_PRIORITY.camera + 0.1);

   // the wall tip and the whip pose, over the animator's pose
   useFrame(() => {
      const h = run.hero;
      const dt = Math.min(0.05, time.delta);
      const onWall = h.mode === "wall" && !rolled(h, run.simMs);
      st.wall += ((onWall ? 1 : 0) - st.wall) * Math.min(1, dt * 14);
      st.whip += ((h.mode === "whip" ? 1 : 0) - st.whip) * Math.min(1, dt * 16);
      if (h.mode === "wall") {
         const w = run.course.walls[h.wall];
         if (w) {
            st.nx = w.axis === "x" ? 0 : w.n;
            st.nz = w.axis === "x" ? w.n : 0;
         }
      }
      const t = tilt.current;
      if (t) {
         // tip the body away from the wall: rotate about the run axis so "up" leans into the corridor
         AXIS.set(st.nz, 0, -st.nx);
         TIP.setFromAxisAngle(AXIS.normalize(), WALL_TILT * st.wall);
         t.quaternion.copy(NONE_Q).multiply(TIP);
      }
      if (h.mode === "whip") {
         st.side = h.colDir > 0 ? 1 : -1;
      }
      if (st.whip > 0.01) {
         whipPose(st.side, posed);
         blendPoses(animator.pose, posed, st.whip * 0.9, animator.pose, POSE_MASK.all);
         animator.body.ball = 0;
         animator.body.shell = 0;
      }
   }, FRAME_PRIORITY.pose + 0.005);

   useFrame(() => {
      const g = root.current;
      if (!g) return;
      const h = run.hero;
      const now = time.now;
      let y = h.y;
      let visible = h.mode !== "lost";
      let s = 1;
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += 14 * (1 - k) * (1 - k);
      }
      if (h.mode === "spawn") s = Math.sin(Math.min(1, (now - anim.spawnAt) / 0.4) * Math.PI * 0.5);
      g.visible = visible && s > 0.02;
      // on a wall the feet sit on the face: shift the drawn body toward the wall by the tip
      const lean = st.wall * 0.35;
      g.position.set(h.x - st.nx * lean, y, h.z - st.nz * lean);
      g.scale.setScalar(Math.max(0.02, s));
      const sh = shadow.current;
      if (sh) {
         const pad = run.course.pads[h.support];
         const top = pad ? pad.y : h.y;
         const above = y - top;
         sh.visible = visible && h.mode === "ground" ? true : visible && above < 6 && above > -0.2 && h.mode !== "wall";
         sh.position.set(h.x, top + 0.04, h.z);
         const k = Math.max(0.35, 1 - above / 6);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.3 * k;
      }
   });

   return (
      <>
         <group ref={root}>
            <group ref={tilt}>
               <AnimatedHero animator={animator} fallback={fallback} />
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.5, 16]} />
            <meshBasicMaterial color="#0f172a" transparent opacity={0.3} depthWrite={false} />
         </mesh>
      </>
   );
}
