"use client";

// The Color Shell Ninja: the m2Hero GLB with a red eye mask fitted to its head in code (mask.ts) and
// two fluttering tails, animated as a whole body (the GLB stands with its arms down, not in a T-pose,
// so the core auto-rig cannot skin it: README "Hero"): it runs with a bob and a lean, stretches into a
// jump, tucks at the apex, front-flips off a bounce pad, squashes on landing, tumbles when it falls
// and pops back in on its checkpoint. A blob shadow sits on the platform under it.
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
   BufferAttribute,
   BufferGeometry,
   DoubleSide,
   MeshBasicMaterial,
   MeshStandardMaterial,
   type Group,
   type Mesh,
} from "three";
import { modelParts, useModel } from "@/arcade3d/core/assets";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { turnTowards } from "@/arcade3d/core/math";
import { ASSETS, HERO_SCALE } from "./assets";
import { COLORS, maskTexture } from "./look";
import { MASK, fitMaskBand, knotPoint, maskBandMesh } from "./mask";
import { V_JUMP, V_RUN, arcVy, supportX, supportZ, type SkyRun } from "./rules";

/** Moments the Scene stamps (useGameTime().now) for the body animation. */
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

/** The intro's drop: the hero falls this far onto the start platform. */
export const INTRO_DROP = 24;

const TAIL_SEG = 7;
const TAIL_LEN = 0.78;
const TAIL_W = 0.075;

function MaskAndTails({ positions, motion }: { positions: Float32Array; motion: MutableRefObject<{ speed: number; vy: number; t: number }> }) {
   const radii = useMemo(() => fitMaskBand(positions), [positions]);
   const band = useMemo(() => {
      const m = maskBandMesh(radii);
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(m.positions, 3));
      g.setAttribute("uv", new BufferAttribute(m.uvs, 2));
      g.setIndex(new BufferAttribute(m.indices, 1));
      g.computeVertexNormals();
      return g;
   }, [radii]);
   const map = useMemo(() => maskTexture(), []);
   const material = useMemo(() => new MeshStandardMaterial({ map, alphaTest: 0.5, side: DoubleSide, roughness: 0.65, emissive: COLORS.mask, emissiveIntensity: 0.12 }), [map]);
   const knot = useMemo(() => knotPoint(radii), [radii]);
   const tails = useMemo(() => {
      const g = new BufferGeometry();
      const verts = 2 * (TAIL_SEG + 1) * 2;
      g.setAttribute("position", new BufferAttribute(new Float32Array(verts * 3), 3));
      const idx: number[] = [];
      for (let t = 0; t < 2; t++) {
         const o = t * (TAIL_SEG + 1) * 2;
         for (let i = 0; i < TAIL_SEG; i++) {
            const a = o + i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
         }
      }
      g.setIndex(idx);
      return g;
   }, []);
   const tailMat = useMemo(() => new MeshStandardMaterial({ color: COLORS.mask, side: DoubleSide, roughness: 0.7, emissive: COLORS.mask, emissiveIntensity: 0.12 }), []);
   useEffect(
      () => () => {
         band.dispose();
         map.dispose();
         material.dispose();
         tails.dispose();
         tailMat.dispose();
      },
      [band, map, material, tails, tailMat],
   );
   const tailMesh = useRef<Mesh>(null);
   useFrame(() => {
      const { speed, vy, t } = motion.current;
      const pos = tails.getAttribute("position") as BufferAttribute;
      const arr = pos.array as Float32Array;
      // the flow: hanging down at rest, streaming back with speed, lifting while falling
      const flow = Math.min(1.45, 0.35 + speed * 0.13 + Math.max(0, -vy) * 0.05);
      for (let k = 0; k < 2; k++) {
         const side = k === 0 ? -1 : 1;
         let x = side * 0.03;
         let y = knot.y;
         let z = knot.z - 0.02;
         const base = k * (TAIL_SEG + 1) * 2;
         for (let i = 0; i <= TAIL_SEG; i++) {
            const f = i / TAIL_SEG;
            const wave = Math.sin(t * (9 + speed) - f * 5 + k * 1.7) * (0.08 + speed * 0.012) * f;
            const angle = flow * (0.55 + f * 0.6); // from straight down (0) towards straight back (π/2)
            if (i > 0) {
               const step = TAIL_LEN / TAIL_SEG;
               x += (side * 0.12 + wave) * step;
               y -= Math.cos(angle) * step;
               z -= Math.sin(angle) * step;
            }
            const w = TAIL_W * (1 - f * 0.35);
            const v = base + i * 2;
            arr[v * 3] = x - w * 0.5 * side * 0.2;
            arr[v * 3 + 1] = y + w * 0.5;
            arr[v * 3 + 2] = z;
            arr[(v + 1) * 3] = x + w * 0.5 * side * 0.2;
            arr[(v + 1) * 3 + 1] = y - w * 0.5;
            arr[(v + 1) * 3 + 2] = z;
         }
      }
      pos.needsUpdate = true;
      tails.computeVertexNormals();
   });
   return (
      <>
         <mesh geometry={band} material={material} />
         <mesh position={[0, knot.y, knot.z - 0.01]} scale={[0.07, 0.06, 0.05]} material={tailMat}>
            <sphereGeometry args={[1, 10, 8]} />
         </mesh>
         <mesh ref={tailMesh} geometry={tails} material={tailMat} frustumCulled={false} />
      </>
   );
}

function HeroModel({ motion }: { motion: MutableRefObject<{ speed: number; vy: number; t: number }> }) {
   const { scene, failed } = useModel(ASSETS.hero);
   const positions = useMemo(() => {
      if (!scene) return null;
      const parts = modelParts(scene, {});
      const out: number[] = [];
      for (const part of parts) {
         const p = part.geometry.getAttribute("position");
         const e = part.matrix.elements;
         for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const y = p.getY(i);
            const z = p.getZ(i);
            out.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
         }
      }
      return new Float32Array(out);
   }, [scene]);
   if (failed || !scene || !positions) {
      return (
         <mesh position={[0, 0.6, 0]}>
            <capsuleGeometry args={[0.32, 0.55, 6, 12]} />
            <meshStandardMaterial color="#4ade80" />
         </mesh>
      );
   }
   return (
      <group scale={HERO_SCALE}>
         <primitive object={scene} />
         <MaskAndTails positions={positions} motion={motion} />
      </group>
   );
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export function Hero({ run, anim, ground }: { run: SkyRun; anim: HeroAnim; ground: MutableRefObject<number> }) {
   const time = useGameTime();
   const root = useRef<Group>(null);
   const pivot = useRef<Group>(null);
   const body = useRef<Group>(null);
   const shadow = useRef<Mesh>(null);
   const motion = useRef({ speed: 0, vy: 0, t: 0 });
   const state = useRef({ yaw: Math.PI, phase: 0 });

   useFrame(() => {
      const g = root.current;
      const p = pivot.current;
      const b = body.current;
      if (!g || !p || !b) return;
      const h = run.hero;
      const now = time.now;
      const dt = time.delta;
      const ms = run.simMs;
      const speed = Math.sqrt(h.vx * h.vx + h.vz * h.vz);
      const vy = h.grounded ? 0 : arcVy(h, ms);
      motion.current.speed = speed;
      motion.current.vy = vy;
      motion.current.t = now;

      let y = h.y;
      let visible = true;
      let sx = 1;
      let sy = 1;
      let rx = 0;
      let rz = 0;
      let lift = 0;

      // the intro's drop onto the start platform
      if (!Number.isNaN(anim.intro)) {
         const k = anim.intro;
         if (k <= 0.001) visible = false;
         y += INTRO_DROP * (1 - k) * (1 - k);
         if (k < 1) rx = -0.3 * (1 - k);
      }

      // facing: towards the stick's velocity
      if (speed > 0.6 && h.state === "play") state.current.yaw = turnTowards(state.current.yaw, Math.atan2(h.vx, h.vz), Math.min(1, dt * 14));

      if (h.state === "lost") {
         const t = now - anim.lostAt;
         rz = t * 7;
         rx = t * 4;
         const k = Math.max(0, 1 - t / 0.8);
         sx = sy = k;
      } else if (h.state === "spawn") {
         const t = Math.min(1, (now - anim.spawnAt) / 0.45);
         const pop = t < 1 ? Math.sin(t * Math.PI * 0.5) * (1 + 0.25 * Math.sin(t * Math.PI)) : 1;
         sx = sy = pop;
      } else if (h.grounded) {
         // run bob + lean, landing squash, idle breath
         state.current.phase += speed * dt * 2.3;
         lift = Math.abs(Math.sin(state.current.phase)) * 0.07 * Math.min(1, speed / 3);
         rx = Math.min(0.22, (speed / V_RUN) * 0.22);
         rz = Math.sin(state.current.phase) * 0.05 * Math.min(1, speed / 3);
         const tl = now - anim.landAt;
         if (tl < 0.2) {
            const k = 1 - tl / 0.2;
            sy = 1 - 0.2 * k;
            sx = 1 + 0.12 * k;
         } else if (speed < 0.3) {
            sy = 1 + Math.sin(now * 2.4) * 0.012;
         }
      } else {
         // air: stretch on the way up, tuck near the apex, a front flip after a bounce pad
         const rising = Math.max(-1, Math.min(1, vy / V_JUMP));
         sy = 1 + 0.1 * Math.max(0, rising) - 0.04 * Math.max(0, -rising);
         sx = 1 - 0.05 * Math.max(0, rising);
         rx = 0.32 * (1 - Math.abs(rising));
         const tb = now - anim.bounceAt;
         if (tb < 0.75) rx += Math.PI * 2 * easeOut(tb / 0.75);
      }
      // a hop and a spin on the win
      const tw = now - anim.winAt;
      if (tw >= 0 && tw < 3) {
         lift += Math.abs(Math.sin(tw * 5)) * 0.4 * Math.max(0, 1 - tw / 3);
         state.current.yaw += dt * 6 * Math.max(0, 1 - tw / 2);
      }

      g.visible = visible;
      g.position.set(h.x, y + lift, h.z);
      g.rotation.y = state.current.yaw;
      // flips and tilts turn about the hips (0.55 m up), squash scales from the feet
      p.position.y = 0.55;
      p.rotation.set(rx, 0, rz);
      b.position.y = -0.55;
      g.scale.set(sx, sy, sx);

      // blob shadow on the platform under the hero
      const s = shadow.current;
      if (s) {
         const top = ground.current;
         const above = y - top;
         s.visible = visible && h.state !== "lost" && Number.isFinite(top) && above < 14;
         s.position.set(h.x, top + 0.03, h.z);
         const k = Math.max(0.35, 1 - above / 10);
         s.scale.set(k, k, k);
         (s.material as MeshBasicMaterial).opacity = 0.38 * k;
      }
   });

   return (
      <>
         <group ref={root} rotation-y={Math.PI}>
            <group ref={pivot}>
               <group ref={body}>
                  <HeroModel motion={motion} />
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
