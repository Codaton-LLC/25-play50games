"use client";

// The Menu 2 hero's stand-in (CLAUDE.md decision 5, redesigned 2026-10-25): an original armadillo /
// pangolin-style hero with an armoured shell of overlapping plates in Riko red, glowing lines between
// the plates, an open helmet with a clear visor, a charcoal suit, and a plated tail (CLAUDE.md decision 5:
// no TMNT-like elements). Built from rounded shapes and rigged the simplest way: one group per joint (hips, legs,
// shoulders, arms, head, tail) turned by a pose the Scene writes every frame, plus a ball of plates the
// hero rolls into (bounce pads, falls). It stands in the asset slot ASSETS.hero (assets.ts): when the
// Hyper3D armadillo GLB exists, its url joins the manifest and replaces this.
//
// Size: 1.45 m tall (ARMADILLO.height), feet on y = 0, facing +z (like a Rodin character).
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
   CapsuleGeometry,
   Color,
   DoubleSide,
   MeshStandardMaterial,
   SphereGeometry,
   TorusGeometry,
   type Group,
   type Mesh,
} from "three";

export const ARMADILLO = {
   height: 1.45,
   hipY: 0.56,
   shoulderY: 1.03,
   headY: 1.26,
   ballRadius: 0.5,
} as const;

/** What the Scene writes every frame (Hero.tsx). */
export interface ArmadilloPose {
   /** 0 standing .. 1 full run */
   run: number;
   /** the stride phase (rad) */
   phase: number;
   /** 0 .. 1: legs and arms tucked (a jump) */
   tuck: number;
   /** 0 .. 1: curled up into the ball of plates */
   roll: number;
   /** the ball's spin (rad) */
   spin: number;
   /** idle breathing time (s) */
   time: number;
   /** 0 .. 1: arms up (the win) */
   cheer: number;
}

export function createArmadilloPose(): ArmadilloPose {
   return { run: 0, phase: 0, tuck: 0, roll: 0, spin: 0, time: 0, cheer: 0 };
}

export const HERO_COLORS = {
   plate: "#ef4444",
   plateDark: "#a51d1d",
   glow: "#ff8a4c",
   suit: "#2b2f3a",
   skin: "#d9b48a",
   skinLight: "#f0d6b2",
   boot: "#1f232c",
   visor: "#9be7ff",
   eye: "#ffffff",
   pupil: "#1b1b24",
} as const;

function useLooks() {
   const looks = useMemo(
      () => ({
         plate: new MeshStandardMaterial({ color: HERO_COLORS.plate, roughness: 0.38, metalness: 0.15 }),
         plateDark: new MeshStandardMaterial({ color: HERO_COLORS.plateDark, roughness: 0.45, metalness: 0.1 }),
         glow: new MeshStandardMaterial({ color: HERO_COLORS.glow, emissive: new Color(HERO_COLORS.glow), emissiveIntensity: 1.8, roughness: 0.4 }),
         suit: new MeshStandardMaterial({ color: HERO_COLORS.suit, roughness: 0.75 }),
         skin: new MeshStandardMaterial({ color: HERO_COLORS.skin, roughness: 0.65 }),
         skinLight: new MeshStandardMaterial({ color: HERO_COLORS.skinLight, roughness: 0.6 }),
         boot: new MeshStandardMaterial({ color: HERO_COLORS.boot, roughness: 0.55 }),
         visor: new MeshStandardMaterial({ color: HERO_COLORS.visor, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3, side: DoubleSide, depthWrite: false }),
         eye: new MeshStandardMaterial({ color: HERO_COLORS.eye, roughness: 0.3 }),
         pupil: new MeshStandardMaterial({ color: HERO_COLORS.pupil, roughness: 0.2 }),
      }),
      [],
   );
   useEffect(() => () => Object.values(looks).forEach((m) => m.dispose()), [looks]);
   return looks;
}

function useShapes() {
   const shapes = useMemo(() => {
      // three's sphere: phi = π/2 faces +z (the front), π..2π is the back (z < 0); the shell wraps a little past the sides
      const back = (r: number, t0: number, t1: number) => new SphereGeometry(r, 28, 6, Math.PI * 0.85, Math.PI * 1.3, t0, t1 - t0);
      return {
         torso: new CapsuleGeometry(0.25, 0.2, 8, 18),
         belly: new SphereGeometry(0.2, 18, 12),
         limb: new CapsuleGeometry(0.075, 0.26, 6, 12),
         leg: new CapsuleGeometry(0.088, 0.3, 6, 12),
         ball: new SphereGeometry(1, 20, 14),
         belt: new TorusGeometry(0.255, 0.032, 8, 28),
         // the back shell: five overlapping bands, each a slice of a sphere around the back
         bands: [0, 1, 2, 3, 4].map((i) => back(0.36 + i * 0.012, 0.35 + i * 0.36, 0.35 + (i + 1) * 0.36 + 0.06)),
         // glowing lines between the bands
         lines: [1, 2, 3, 4].map((i) => back(0.372 + i * 0.012, 0.35 + i * 0.36 - 0.012, 0.35 + i * 0.36 + 0.018)),
         headCap: new SphereGeometry(0.235, 24, 10, 0, Math.PI * 2, 0, 1.05),
         helmetRim: new TorusGeometry(0.236, 0.026, 8, 30),
         visor: new SphereGeometry(0.27, 24, 8, Math.PI / 2 - 1.05, 2.1, 1.12, 0.5),
         tailSeg: new SphereGeometry(1, 14, 10),
         ballBand: new TorusGeometry(1, 0.06, 6, 30),
      };
   }, []);
   useEffect(
      () => () => {
         for (const v of Object.values(shapes)) {
            if (Array.isArray(v)) v.forEach((g) => g.dispose());
            else v.dispose();
         }
      },
      [shapes],
   );
   return shapes;
}

export function ArmadilloStandIn({ pose }: { pose: MutableRefObject<ArmadilloPose> }) {
   const m = useLooks();
   const g = useShapes();
   const body = useRef<Group>(null);
   const legL = useRef<Group>(null);
   const legR = useRef<Group>(null);
   const armL = useRef<Group>(null);
   const armR = useRef<Group>(null);
   const head = useRef<Group>(null);
   const tail = useRef<Group>(null);
   const ball = useRef<Group>(null);
   const ballGlow = useRef<Mesh>(null);

   useFrame(() => {
      const p = pose.current;
      const swing = Math.sin(p.phase) * 0.85 * p.run;
      const tuck = p.tuck;
      if (legL.current) legL.current.rotation.x = swing - tuck * 0.9;
      if (legR.current) legR.current.rotation.x = -swing - tuck * 0.9;
      const armSwing = Math.sin(p.phase) * 0.7 * p.run;
      // arms: hang, swing against the legs, lift a little in a jump, up in a cheer
      if (armL.current) {
         armL.current.rotation.x = -armSwing - tuck * 0.5 - p.cheer * 2.6;
         armL.current.rotation.z = 0.12 + tuck * 0.5 + p.cheer * 0.3;
      }
      if (armR.current) {
         armR.current.rotation.x = armSwing - tuck * 0.5 - p.cheer * 2.6;
         armR.current.rotation.z = -0.12 - tuck * 0.5 - p.cheer * 0.3;
      }
      if (head.current) {
         head.current.rotation.x = 0.05 * Math.sin(p.time * 2) * (1 - p.run) - p.run * 0.12;
         head.current.position.y = ARMADILLO.headY + Math.sin(p.time * 2.4) * 0.006;
      }
      if (tail.current) tail.current.rotation.y = Math.sin(p.phase * 0.5 + p.time) * 0.25 * (0.3 + p.run);
      // the curl: the body shrinks into the ball of plates
      const r = p.roll;
      if (body.current) {
         const k = Math.max(0.001, 1 - r);
         body.current.scale.setScalar(k);
         body.current.position.y = ARMADILLO.ballRadius * r;
         body.current.visible = r < 0.98;
      }
      if (ball.current) {
         const k = Math.max(0.001, r);
         ball.current.scale.setScalar(k);
         ball.current.visible = r > 0.02;
         ball.current.rotation.x = p.spin;
      }
      if (ballGlow.current) (ballGlow.current.material as MeshStandardMaterial).emissiveIntensity = 1.4 + Math.sin(p.time * 10) * 0.5;
   });

   const shellCentre: [number, number, number] = [0, 0.86, -0.02];
   return (
      <group>
         <group ref={body}>
            {/* legs: hip joints, the suit leg, the boot with a red toe plate */}
            {[
               [legL, 1],
               [legR, -1],
            ].map(([ref, side]) => (
               <group key={side as number} ref={ref as MutableRefObject<Group>} position={[0.15 * (side as number), ARMADILLO.hipY, 0]}>
                  <mesh geometry={g.leg} material={m.suit} position={[0, -0.24, 0]} />
                  <mesh geometry={g.ball} material={m.boot} position={[0, -0.5, 0.04]} scale={[0.11, 0.07, 0.16]} />
                  <mesh geometry={g.ball} material={m.plate} position={[0, -0.47, 0.11]} scale={[0.09, 0.05, 0.07]} />
               </group>
            ))}
            {/* torso, belly scales, belt */}
            <mesh geometry={g.torso} material={m.suit} position={[0, 0.84, 0]} />
            <mesh geometry={g.belly} material={m.skinLight} position={[0, 0.82, 0.12]} scale={[0.95, 1.2, 0.6]} />
            <mesh geometry={g.belt} material={m.plateDark} position={[0, 0.63, 0]} rotation-x={Math.PI / 2} />
            {/* the back shell: overlapping red bands and glowing lines */}
            {g.bands.map((geo, i) => (
               <mesh key={`b${i}`} geometry={geo} material={i % 2 ? m.plateDark : m.plate} position={shellCentre} scale={[1.02, 1.12, 0.9]} />
            ))}
            {g.lines.map((geo, i) => (
               <mesh key={`l${i}`} geometry={geo} material={m.glow} position={shellCentre} scale={[1.02, 1.12, 0.9]} />
            ))}
            {/* arms: a red shoulder plate, the sleeve, the hand */}
            {[
               [armL, 1],
               [armR, -1],
            ].map(([ref, side]) => (
               <group key={side as number} ref={ref as MutableRefObject<Group>} position={[0.32 * (side as number), ARMADILLO.shoulderY, 0]}>
                  <mesh geometry={g.ball} material={m.plate} position={[0.02 * (side as number), 0.02, 0]} scale={[0.12, 0.09, 0.12]} />
                  <mesh geometry={g.limb} material={m.suit} position={[0, -0.2, 0]} />
                  <mesh geometry={g.ball} material={m.skin} position={[0, -0.42, 0.01]} scale={0.08} />
               </group>
            ))}
            {/* head: skull, snout and nose, ears, eyes, the red head plates, the open helmet and its visor */}
            <group ref={head} position={[0, ARMADILLO.headY, 0.03]}>
               <mesh geometry={g.ball} material={m.skin} scale={[0.22, 0.21, 0.22]} />
               <mesh geometry={g.ball} material={m.skinLight} position={[0, -0.06, 0.19]} scale={[0.11, 0.09, 0.14]} />
               <mesh geometry={g.ball} material={m.pupil} position={[0, -0.04, 0.32]} scale={[0.035, 0.028, 0.025]} />
               {[1, -1].map((side) => (
                  <group key={side}>
                     <mesh geometry={g.ball} material={m.skin} position={[0.15 * side, 0.15, -0.04]} scale={[0.06, 0.09, 0.03]} rotation-z={-0.4 * side} />
                     <mesh geometry={g.ball} material={m.eye} position={[0.085 * side, 0.03, 0.18]} scale={0.048} />
                     <mesh geometry={g.ball} material={m.pupil} position={[0.09 * side, 0.032, 0.222]} scale={0.024} />
                  </group>
               ))}
               <mesh geometry={g.headCap} material={m.plate} rotation-x={-0.35} />
               <mesh geometry={g.helmetRim} material={m.plateDark} position={[0, 0.06, -0.01]} rotation-x={Math.PI / 2 - 0.35} />
               <mesh geometry={g.visor} material={m.visor} position={[0, -0.02, 0]} />
            </group>
            {/* the plated tail */}
            <group ref={tail} position={[0, 0.56, -0.26]}>
               {[0, 1, 2].map((i) => (
                  <mesh key={i} geometry={g.tailSeg} material={i % 2 ? m.plateDark : m.plate} position={[0, -0.05 * i, -0.1 - 0.12 * i]} scale={[0.09 - i * 0.022, 0.08 - i * 0.018, 0.1 - i * 0.015]} />
               ))}
            </group>
         </group>
         {/* the ball of plates (curled up), centred above the feet */}
         <group ref={ball} position={[0, ARMADILLO.ballRadius, 0]}>
            <mesh geometry={g.ball} material={m.plate} scale={ARMADILLO.ballRadius} />
            {[0, 1, 2].map((i) => (
               <mesh
                  key={i}
                  ref={i === 1 ? ballGlow : undefined}
                  geometry={g.ballBand}
                  material={i === 1 ? m.glow : m.plateDark}
                  rotation-y={Math.PI / 2}
                  scale={ARMADILLO.ballRadius * (i === 1 ? 1.0 : 0.94)}
                  rotation-x={(i - 1) * 0.6}
               />
            ))}
         </group>
      </group>
   );
}
