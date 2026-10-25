"use client";

// Alien Farm stand-ins (drawn while a GLB is missing or broken) and procedural props: the
// farmer, the saucer, both crop pools' parts, the basket, rocks and crates.
// Deliberate 2-3 tones each, bevelled/rounded shapes, never a raw grey box.
import { useEffect, useMemo } from "react";
import {
   CylinderGeometry,
   DodecahedronGeometry,
   LatheGeometry,
   Matrix4,
   MeshStandardMaterial,
   SphereGeometry,
   Vector2,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { ALIEN_HEIGHT, CRATE_WIDTH, ROCK_WIDTH, UFO_DIAMETER } from "./assets";
import { COLORS } from "./looks";

// ---------- the farmer ----------

/** A 1.3 m mint alien in blue overalls: bevelled boots, overalls with straps, glowing antennae. */
export function AlienPrimitive() {
   const h = ALIEN_HEIGHT / 1.3;
   const geo = useMemo(() => {
      // Bevelled boot upper + sole
      const upper = new RoundedBoxGeometry(0.14, 0.09, 0.22, 2, 0.02).translate(0, 0.075, 0.03);
      const sole = new RoundedBoxGeometry(0.15, 0.03, 0.24, 2, 0.01).translate(0, 0.015, 0.03);
      return { upper, sole };
   }, []);

   useEffect(() => () => {
      geo.upper.dispose();
      geo.sole.dispose();
   }, [geo]);

   return (
      <group scale={h}>
         {/* Legs and bevelled boots */}
         {[-1, 1].map((s) => (
            <group key={s} position={[0.11 * s, 0, 0]}>
               <mesh geometry={geo.sole}>
                  <meshStandardMaterial color={COLORS.hullDark} roughness={0.8} />
               </mesh>
               <mesh geometry={geo.upper}>
                  <meshStandardMaterial color={COLORS.boot} roughness={0.65} />
               </mesh>
               <mesh position={[0, 0.32, 0]}>
                  <capsuleGeometry args={[0.07, 0.28, 4, 10]} />
                  <meshStandardMaterial color={COLORS.overalls} roughness={0.7} />
               </mesh>
            </group>
         ))}

         {/* Overalls body */}
         <mesh position={[0, 0.72, 0]}>
            <capsuleGeometry args={[0.2, 0.28, 6, 14]} />
            <meshStandardMaterial color={COLORS.overalls} roughness={0.7} />
         </mesh>

         {/* Shirt collar & bib accent */}
         <mesh position={[0, 0.86, 0.02]}>
            <sphereGeometry args={[0.19, 16, 12]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.75} />
         </mesh>
         {[-1, 1].map((s) => (
            <mesh key={s} position={[0.07 * s, 0.83, 0.18]}>
               <sphereGeometry args={[0.022, 8, 6]} />
               <meshStandardMaterial color={COLORS.gold} metalness={0.4} roughness={0.3} />
            </mesh>
         ))}

         {/* Arms with shirt cuffs */}
         {[-1, 1].map((s) => (
            <group key={s} position={[0.25 * s, 0.7, 0]} rotation={[0, 0, 0.12 * s]}>
               <mesh position={[0, 0.08, 0]}>
                  <capsuleGeometry args={[0.06, 0.12, 4, 8]} />
                  <meshStandardMaterial color={COLORS.shirt} roughness={0.75} />
               </mesh>
               <mesh position={[0, -0.06, 0]}>
                  <capsuleGeometry args={[0.052, 0.22, 4, 8]} />
                  <meshStandardMaterial color={COLORS.alien} roughness={0.55} />
               </mesh>
            </group>
         ))}

         {/* Big head */}
         <mesh position={[0, 1.08, 0]}>
            <sphereGeometry args={[0.23, 20, 16]} />
            <meshStandardMaterial
               color={COLORS.alien}
               roughness={0.45}
               emissive={COLORS.alien}
               emissiveIntensity={0.08}
            />
         </mesh>

         {/* Large glossy alien eyes */}
         {[-1, 1].map((s) => (
            <mesh key={s} position={[0.09 * s, 1.1, 0.19]} scale={[1, 1.3, 0.6]}>
               <sphereGeometry args={[0.06, 14, 12]} />
               <meshStandardMaterial color="#090d16" roughness={0.15} metalness={0.2} />
            </mesh>
         ))}

         {/* Cute antennae with glowing mint bulbs */}
         {[-1, 1].map((s) => (
            <group key={s} position={[0.1 * s, 1.27, 0]} rotation={[0, 0, -0.35 * s]}>
               <mesh position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.012, 0.016, 0.14, 6]} />
                  <meshStandardMaterial color={COLORS.alien} roughness={0.6} />
               </mesh>
               <mesh position={[0, 0.15, 0]}>
                  <sphereGeometry args={[0.038, 12, 8]} />
                  <meshStandardMaterial
                     color={COLORS.mint}
                     emissive={COLORS.mint}
                     emissiveIntensity={1.4}
                  />
               </mesh>
            </group>
         ))}
      </group>
   );
}

// ---------- the harvest basket ----------

/** The woven harvest basket with a darker rim accent (built once per mount). */
export function Basket() {
   const geo = useMemo(() => {
      const body = new LatheGeometry(
         [
            new Vector2(0, 0),
            new Vector2(0.11, 0.005),
            new Vector2(0.14, 0.06),
            new Vector2(0.155, 0.13),
            new Vector2(0.145, 0.135),
            new Vector2(0.13, 0.07),
            new Vector2(0, 0.02),
         ],
         16
      );
      const rim = new LatheGeometry(
         [
            new Vector2(0.14, 0.125),
            new Vector2(0.165, 0.13),
            new Vector2(0.16, 0.145),
            new Vector2(0.138, 0.14),
         ],
         16
      );
      return { body, rim };
   }, []);

   useEffect(() => () => {
      geo.body.dispose();
      geo.rim.dispose();
   }, [geo]);

   return (
      <group>
         <mesh geometry={geo.body}>
            <meshStandardMaterial color={COLORS.basket} roughness={0.8} />
         </mesh>
         <mesh geometry={geo.rim}>
            <meshStandardMaterial color={COLORS.basketDark} roughness={0.85} />
         </mesh>
      </group>
   );
}

// ---------- the saucer ----------

/** A 2.8 m saucer: bevelled lathe hull, darker undercarriage, glass dome and cyan beam ring. */
export function SaucerPrimitive() {
   const geo = useMemo(() => {
      const r = UFO_DIAMETER / 2;
      const hull = new LatheGeometry(
         [
            new Vector2(0, 0.1),
            new Vector2(0.4, 0.08),
            new Vector2(0.8, 0.22),
            new Vector2(r, 0.52),
            new Vector2(r * 0.96, 0.66),
            new Vector2(r * 0.52, 0.85),
            new Vector2(0, 0.88),
         ],
         32
      );
      const underRim = new LatheGeometry(
         [
            new Vector2(0.2, 0.02),
            new Vector2(r * 0.82, 0.28),
            new Vector2(r * 0.86, 0.38),
            new Vector2(0.2, 0.06),
         ],
         24
      );
      const dome = new SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      return { hull, underRim, dome };
   }, []);

   useEffect(() => () => {
      geo.hull.dispose();
      geo.underRim.dispose();
      geo.dome.dispose();
   }, [geo]);

   return (
      <group>
         <mesh geometry={geo.hull}>
            <meshStandardMaterial color={COLORS.hull} metalness={0.4} roughness={0.35} />
         </mesh>
         <mesh geometry={geo.underRim}>
            <meshStandardMaterial color={COLORS.hullDark} metalness={0.5} roughness={0.5} />
         </mesh>
         <mesh geometry={geo.dome} position={[0, 0.84, 0]} scale={[1, 0.8, 1]}>
            <meshStandardMaterial
               color={COLORS.dome}
               transparent
               opacity={0.78}
               roughness={0.1}
               emissive={COLORS.beam}
               emissiveIntensity={0.3}
            />
         </mesh>
         <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.45, 24]} />
            <meshBasicMaterial color={COLORS.beam} />
         </mesh>
      </group>
   );
}

// ---------- crop pool parts ----------

/** Stand-in parts for a crop pool at maturity (1.0 m): fluted glowing bulb or spiral gourd over leaves. */
export function useCropParts(kind: "glowPod" | "gourd"): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const bulbColor = kind === "glowPod" ? "#bbf7d0" : "#a5f3fc";
      const glow = kind === "glowPod" ? COLORS.mint : COLORS.cyan;
      const profile =
         kind === "glowPod"
            ? [
                 new Vector2(0, 0),
                 new Vector2(0.06, 0.05),
                 new Vector2(0.08, 0.3),
                 new Vector2(0.26, 0.48),
                 new Vector2(0.32, 0.68),
                 new Vector2(0.24, 0.9),
                 new Vector2(0.08, 1),
                 new Vector2(0, 1),
              ]
            : [
                 new Vector2(0, 0),
                 new Vector2(0.07, 0.06),
                 new Vector2(0.36, 0.3),
                 new Vector2(0.4, 0.5),
                 new Vector2(0.28, 0.72),
                 new Vector2(0.14, 0.88),
                 new Vector2(0.06, 1),
                 new Vector2(0, 1),
              ];
      const bulb = new LatheGeometry(profile, kind === "glowPod" ? 18 : 12);
      const leaf = new SphereGeometry(0.22, 10, 6).scale(1.1, 0.28, 0.6);
      const leaves = [0, 1, 2].map((i) => {
         const a = (i / 3) * Math.PI * 2 + 0.4;
         return new Matrix4()
            .makeRotationY(a)
            .multiply(new Matrix4().makeTranslation(0.22, 0.08, 0));
      });
      return [
         {
            geometry: bulb,
            material: new MeshStandardMaterial({
               color: bulbColor,
               roughness: 0.5,
               emissive: glow,
               emissiveIntensity: 0.4,
            }),
         },
         {
            geometry: leaf,
            material: new MeshStandardMaterial({ color: COLORS.bed, roughness: 0.8 }),
            locals: leaves,
         },
      ];
   }, [kind]);

   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (p.material as MeshStandardMaterial).dispose();
         }
      },
      [parts]
   );

   return parts;
}

// ---------- decor ----------

export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const base = new DodecahedronGeometry(ROCK_WIDTH / 2, 0).scale(1, 0.58, 0.92).translate(0, ROCK_WIDTH * 0.22, 0);
      const crest = new DodecahedronGeometry(ROCK_WIDTH * 0.25, 0).scale(0.8, 0.6, 0.8).translate(0, ROCK_WIDTH * 0.42, 0);
      const rock = mergeGeometries([base, crest]);
      base.dispose();
      crest.dispose();
      if (!rock) throw new Error("alien-farm look: rock");
      return rock;
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="rocks">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color={COLORS.rock} roughness={0.88} flatShading />
      </Instanced>
   );
}

export function CratePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => {
      const box = new RoundedBoxGeometry(
         CRATE_WIDTH,
         CRATE_WIDTH * 0.7,
         CRATE_WIDTH,
         2,
         0.06
      ).translate(0, CRATE_WIDTH * 0.35, 0);
      const band = new RoundedBoxGeometry(
         CRATE_WIDTH + 0.02,
         CRATE_WIDTH * 0.15,
         CRATE_WIDTH + 0.02,
         1,
         0.01
      ).translate(0, CRATE_WIDTH * 0.35, 0);
      const crate = mergeGeometries([box, band]);
      box.dispose();
      band.dispose();
      if (!crate) throw new Error("alien-farm look: crate");
      return crate;
   }, []);

   useEffect(() => () => geo.dispose(), [geo]);

   return (
      <Instanced spots={spots} name="crates">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color={COLORS.basketDark} roughness={0.75} />
      </Instanced>
   );
}
