"use client";

// The Menu 2 hero on the course: the asset slot ASSETS.hero (the Hyper3D armadillo hero GLB once it
// exists; until then the code stand-in, Armadillo.tsx), placed and posed from the run every frame.
// It runs with a stride, a bob and a lean, tucks into a jump, curls into its ball of plates on a
// bounce pad and when it falls (spinning), squashes on landing, pops back in on its checkpoint and
// cheers with a hop and a spin at the gate. A blob shadow sits on the platform under it.
import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type Mesh, type MeshBasicMaterial } from "three";
import { Model } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { ASSETS } from "./assets";
import { ARMADILLO, ArmadilloStandIn, createArmadilloPose, type ArmadilloPose } from "./Armadillo";
import { V_BOUNCE, V_JUMP, V_RUN, arcVy, supportX, supportZ, type SkyRun } from "./rules";

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

/** The pose for one frame (pure apart from the eased fields it keeps in `pose`). */
export function stepHeroPose(pose: ArmadilloPose, run: SkyRun, anim: HeroAnim, now: number, dt: number): void {
   const h = run.hero;
   const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
   const vy = h.grounded ? 0 : arcVy(h, run.simMs);
   pose.time = now;
   let roll = 0;
   let tuck = 0;
   let runAmount = 0;
   if (h.state === "lost") roll = 1;
   else if (!Number.isNaN(anim.intro) && anim.intro < 0.97) roll = 1;
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
   pose.phase += speed * dt * 2.6;
   // the ball spins forward with the speed it travels (vertical included)
   pose.spin += (Math.sqrt(speed * speed + vy * vy) / ARMADILLO.ballRadius) * dt * (pose.roll > 0.05 ? 1 : 0);
   const tw = now - anim.winAt;
   pose.cheer = approach(pose.cheer, tw >= 0 && tw < 3 ? 1 : 0, 10, dt);
}

export function Hero({ run, anim, ground }: { run: SkyRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const pivot = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const pose = useRef<ArmadilloPose>(createArmadilloPose());
   const state = useRef({ yaw: Math.PI, bob: 0 });
   const standIn = useMemo(() => <ArmadilloStandIn pose={pose} />, []);

   useFrame(() => {
      const g = root.current;
      const p = pivot.current;
      const b = body.current;
      if (!g || !p || !b) return;
      const h = run.hero;
      const now = time.now;
      const dt = time.delta;
      const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
      stepHeroPose(pose.current, run, anim, now, dt);

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
               <group ref={body}>
                  <Model asset={ASSETS.hero} fallback={standIn} />
               </group>
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
export function groundUnder(run: SkyRun, x: number, z: number, feet: number, ms: number): number {
   let best = -Infinity;
   for (const s of run.course.supports) {
      if (s.top > feet + 0.05 || s.top <= best) continue;
      if (Math.abs(x - supportX(s, ms)) <= s.hw && Math.abs(z - supportZ(s, ms)) <= s.hd) best = s.top;
   }
   return best;
}
