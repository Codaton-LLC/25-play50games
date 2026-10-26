"use client";

// The Menu 2 hero on the course: m2HeroRiko.glb through the core auto-rig (HumanoidModel), with the
// code stand-in (Armadillo.tsx) as the fallback. Placed and posed from the run every frame. It runs
// with a stride, a bob and a lean, tucks into a jump, curls into its ball of plates on a bounce pad
// and when it falls (spinning), squashes on landing, pops back in on its checkpoint and cheers with
// a hop and a spin at the gate. A blob shadow sits on the platform under it.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import {
   HumanoidModel,
   POSE_MASK,
   blendPoses,
   cheerPose,
   createPose,
   gaitPhaseStep,
   idlePose,
   jumpPose,
   useHumanoidPose,
   walkPose,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { ARMADILLO, ArmadilloBall, ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_BOUNCE, V_JUMP, V_RUN, arcVy, lavaY, supportX, supportZ, type LavaRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the animation. */
export interface HeroAnim {
   landAt: number;
   bounceAt: number;
   jumpAt: number;
   lostAt: number;
   spawnAt: number;
   winAt: number;
   /** the intro's landing timeline 0..1 (1 = standing), NaN when no intro runs */
   intro: number;
}

export function createHeroAnim(): HeroAnim {
   return { landAt: -9, bounceAt: -9, jumpAt: -9, lostAt: -9, spawnAt: -9, winAt: -9, intro: Number.NaN };
}

/** The intro's drop: the hero falls this far onto the start platform, curled up. */
export const INTRO_DROP = 24;

const approach = (from: number, to: number, rate: number, dt: number) => from + (to - from) * (1 - Math.exp(-rate * dt));

/**
 * Strides a second at the fastest. A full run is 6.5 m/s on this hero's own 0.83 m stride, which
 * would be 8 strides a second. The cap holds it at 5: the stride stretches to 1.30 m and the planted
 * foot slides about a third of the step. The short legs would cycle even faster at a jog, so the cap
 * bites there too.
 */
export const HERO_CADENCE = 5;

/** The pose for one frame (pure apart from the eased fields it keeps in `pose`). */
export function stepHeroPose(pose: ArmadilloPose, run: LavaRun, anim: HeroAnim, now: number, dt: number): void {
   const h = run.hero;
   const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
   const vy = h.grounded ? 0 : arcVy(h, run.simMs);
   pose.time = now;
   let roll = 0;
   let tuck = 0;
   let runAmount = 0;
   if (h.state === "lost") roll = 1;
   else if (!Number.isNaN(anim.intro) && anim.intro < 0.97) roll = 1;
   else if (h.dashUntil >= run.simMs) roll = 1;
   else if (h.grounded) runAmount = Math.min(1, speed / V_RUN);
   else {
      // a bounce flight is a ball (from the pad until it lands); a jump tucks near the apex
      const bounced = anim.bounceAt > anim.landAt && h.arcV >= V_BOUNCE - 1e-9;
      if (bounced) roll = 1;
      else tuck = 0.35 + 0.65 * (1 - Math.min(1, Math.abs(vy) / V_JUMP));
   }
   pose.run = approach(pose.run, runAmount, 14, dt);
   pose.tuck = approach(pose.tuck, tuck, 16, dt);
   pose.roll = approach(pose.roll, roll, roll > pose.roll ? 18 : 12, dt);
   // the rig's own stride, capped so a full run does not buzz (bodyLift keeps the sole on the floor)
   pose.phase += gaitPhaseStep(pose.run, HERO_LANDMARKS[run.heroId], HERO_SCALE[run.heroId], speed, dt, HERO_CADENCE);
   // the ball spins forward with the speed it travels (vertical included)
   pose.spin += (Math.sqrt(speed * speed + vy * vy) / ARMADILLO.ballRadius) * dt * (pose.roll > 0.05 ? 1 : 0);
   const tw = now - anim.winAt;
   pose.cheer = approach(pose.cheer, tw >= 0 && tw < 3 ? 1 : 0, 10, dt);
}

const JUMP = createPose();
const IDLE = createPose();
const CHEER = createPose();

/** Run, jump and cheer on the auto-rig. The curl is the ball, not a bone pose. */
function driveRig(arm: ArmadilloPose, out: HumanoidPose): void {
   walkPose(arm.phase, arm.run, out);
   const idle = (1 - arm.run) * (1 - arm.tuck) * (1 - arm.cheer);
   if (idle > 0) blendPoses(out, idlePose(arm.time, IDLE), idle, out, POSE_MASK.upper);
   if (arm.tuck > 0) blendPoses(out, jumpPose(1, JUMP), arm.tuck, out);
   if (arm.cheer > 0) blendPoses(out, cheerPose(arm.time, CHEER), arm.cheer, out, POSE_MASK.upper);
}

export function Hero({ run, anim, ground }: { run: LavaRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const pivot = useRef<Group>(null);
   const rigWrap = useRef<Group>(null);
   const shift = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const pose = useRef<ArmadilloPose>(createArmadilloPose());
   const state = useRef({ yaw: Math.PI, bob: 0 });
   // non-null only while the stand-in is mounted (the GLB failed or is still unlisted)
   const standInMount = useRef<Group>(null);
   const standIn = useMemo(
      () => (
         <group ref={standInMount}>
            <ArmadilloStandIn pose={pose} />
         </group>
      ),
      [],
   );
   // each hero is its own GLB with its own textures (menu2/heroModels.ts): no tinting
   const heroAsset = useMemo(() => heroModelAsset(run.heroId), [run.heroId]);
   const rigPose = useHumanoidPose((p) => {
      stepHeroPose(pose.current, run, anim, time.now, time.delta);
      driveRig(pose.current, p);
   });

   useFrame(() => {
      const g = root.current;
      const p = pivot.current;
      const rig = rigWrap.current;
      if (!g || !p || !rig) return;
      const h = run.hero;
      const now = time.now;
      const dt = time.delta;
      const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
      const arm = pose.current;
      const glb = standInMount.current == null;
      // the GLB's soles sit forward of its origin; the stand-in's feet are already on z = 0
      if (shift.current) shift.current.position.z = glb ? -HERO_SOLE_Z[run.heroId] * HERO_SCALE[run.heroId] : 0;
      if (glb) {
         const r = arm.roll;
         rig.scale.setScalar(Math.max(0.001, 1 - r));
         rig.position.y = ARMADILLO.ballRadius * r;
         rig.visible = r < 0.98;
      } else {
         rig.scale.setScalar(1);
         rig.position.y = 0;
         rig.visible = true;
      }

      let y = h.y;
      let visible = true;
      let s = 1;
      let sy = 1;
      let rx = 0;
      let lift = 0;

      // the intro's drop onto the start platform
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
      }

      if (speed > 0.6 && h.state === "play") state.current.yaw = turnTowards(state.current.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 14));

      if (h.state === "lost") {
         s = Math.max(0, 1 - (now - anim.lostAt) / 0.9);
      } else if (h.state === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         s = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI)) : 1;
      } else if (h.grounded) {
         lift = Math.abs(Math.sin(pose.current.phase)) * 0.06 * pose.current.run;
         rx = pose.current.run * 0.16;
         const tl = now - anim.landAt;
         if (tl < 0.2) sy = 1 - 0.18 * (1 - tl / 0.2);
      }
      // a hop and a spin at the gate
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 3) {
         lift += Math.abs(Math.sin(tw * 5)) * 0.4 * Math.max(0, 1 - tw / 3);
         state.current.yaw += dt * 6 * Math.max(0, 1 - tw / 2);
      }

      g.visible = visible;
      g.position.set(h.x, y + lift, h.z);
      g.rotation.y = state.current.yaw;
      p.rotation.set(rx * (1 - pose.current.roll), 0, 0);
      g.scale.set(s * (2 - sy), s * sy, s * (2 - sy));

      const sh = shadow.current;
      if (sh) {
         const top = ground.current;
         const above = y - top;
         sh.visible = visible && h.state !== "lost" && Number.isFinite(top) && above < 14;
         sh.position.set(h.x, top + 0.03, h.z);
         const k = Math.max(0.35, 1 - above / 10);
         sh.scale.set(k, k, k);
         (sh.material as MeshBasicMaterial).opacity = 0.38 * k;
      }
   });

   return (
      <>
         <group ref={root} rotation-y={Math.PI}>
            <group ref={pivot}>
               <group ref={rigWrap}>
                  <group ref={shift}>
                     <HumanoidModel asset={heroAsset} pose={rigPose} fallback={standIn} />
                  </group>
               </group>
               <ArmadilloBall pose={pose} />
            </group>
         </group>
         <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
            <circleGeometry args={[0.5, 24]} />
            <meshBasicMaterial color="#0b2340" transparent opacity={0.35} depthWrite={false} />
         </mesh>
      </>
   );
}

/** The top of the highest platform under (x, z) at or below the feet (the shadow's floor), -Infinity if none. */
export function groundUnder(run: LavaRun, x: number, z: number, feet: number, ms: number): number {
   let best = -Infinity;
   for (const s of run.course.supports) {
      if (s.top > feet + 0.05 || s.top <= best) continue;
      if (Math.abs(x - supportX(s, ms)) <= s.hw && Math.abs(z - supportZ(s, ms)) <= s.hd) best = s.top;
   }
   const lava = lavaY(run.course, Math.max(0, ms));
   if (lava <= feet + 0.05 && lava > best) best = lava;
   return best;
}
