"use client";

// Alien Farm stand-ins (drawn while a GLB is missing or broken) and the small procedural props: the
// farmer, the saucer, both crop pools' parts, the basket, rocks and crates. Two or three tones each,
// rounded shapes, never a raw grey box.
import { useEffect, useMemo } from "react";
import { DodecahedronGeometry, LatheGeometry, Matrix4, MeshStandardMaterial, SphereGeometry, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { ALIEN_HEIGHT, CRATE_WIDTH, ROCK_WIDTH, UFO_DIAMETER } from "./assets";
import { COLORS } from "./looks";

// ---------- the farmer ----------

/** A 1.3 m mint alien in blue overalls: big head, two antennae with glowing tips. */
export function AlienPrimitive() {
   const h = ALIEN_HEIGHT / 1.3;
   return (
      <group scale={h}>
         {[-1, 1].map((s) => (
            <group key={s} position={[0.11 * s, 0, 0]}>
               <mesh position={[0, 0.07, 0.03]}>
                  <boxGeometry args={[0.15, 0.12, 0.24]} />
                  <meshStandardMaterial color={COLORS.boot} roughness={0.6} />
               </mesh>
               <mesh position={[0, 0.32, 0]}>
                  <capsuleGeometry args={[0.07, 0.3, 4, 10]} />
                  <meshStandardMaterial color={COLORS.overalls} roughness={0.75} />
               </mesh>
            </group>
         ))}
         <mesh position={[0, 0.72, 0]}>
            <capsuleGeometry args={[0.2, 0.28, 6, 14]} />
            <meshStandardMaterial color={COLORS.overalls} roughness={0.75} />
         </mesh>
         <mesh position={[0, 0.86, 0.02]}>
            <sphereGeometry args={[0.19, 16, 12]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.8} />
         </mesh>
         {[-1, 1].map((s) => (
            <mesh key={s} position={[0.25 * s, 0.7, 0]} rotation={[0, 0, 0.12 * s]}>
               <capsuleGeometry args={[0.055, 0.32, 4, 8]} />
               <meshStandardMaterial color={COLORS.alien} roughness={0.55} />
            </mesh>
         ))}
         <mesh position={[0, 1.08, 0]}>
            <sphereGeometry args={[0.23, 20, 16]} />
            <meshStandardMaterial color={COLORS.alien} roughness={0.5} emissive={COLORS.alien} emissiveIntensity={0.08} />
         </mesh>
         {[-1, 1].map((s) => (
            <mesh key={s} position={[0.09 * s, 1.1, 0.19]} scale={[1, 1.3, 0.6]}>
               <sphereGeometry args={[0.06, 12, 10]} />
               <meshStandardMaterial color="#0f172a" roughness={0.2} />
            </mesh>
         ))}
         {[-1, 1].map((s) => (
            <group key={s} position={[0.1 * s, 1.27, 0]} rotation={[0, 0, -0.35 * s]}>
               <mesh position={[0, 0.07, 0]}>
                  <cylinderGeometry args={[0.012, 0.016, 0.14, 6]} />
                  <meshStandardMaterial color={COLORS.alien} roughness={0.6} />
               </mesh>
               <mesh position={[0, 0.15, 0]}>
                  <sphereGeometry args={[0.035, 10, 8]} />
                  <meshStandardMaterial color={COLORS.mint} emissive={COLORS.mint} emissiveIntensity={1.2} />
               </mesh>
            </group>
         ))}
      </group>
   );
}

let basketGeometry: LatheGeometry | null = null;
/** The woven harvest basket the left hand holds (built once per page). */
export function Basket() {
   if (!basketGeometry) {
      basketGeometry = new LatheGeometry([new Vector2(0, 0), new Vector2(0.11, 0.005), new Vector2(0.14, 0.06), new Vector2(0.155, 0.13), new Vector2(0.145, 0.135), new Vector2(0.13, 0.07), new Vector2(0, 0.02)], 16);
   }
   return (
      <mesh geometry={basketGeometry}>
         <meshStandardMaterial color={COLORS.basket} roughness={0.85} />
      </mesh>
   );
}

// ---------- the saucer ----------

/** A 2.8 m saucer: a lathe hull, a glass dome and a cyan underside ring; feet at y 0 like the GLB. */
export function SaucerPrimitive() {
   const geo = useMemo(() => {
      const r = UFO_DIAMETER / 2;
      const hull = new LatheGeometry(
         [new Vector2(0, 0.05), new Vector2(0.35, 0), new Vector2(0.6, 0.18), new Vector2(r, 0.55), new Vector2(r * 0.95, 0.68), new Vector2(r * 0.55, 0.85), new Vector2(0, 0.88)],
         32,
      );
      const dome = new SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      return { hull, dome };
   }, []);
   useEffect(() => () => {
      geo.hull.dispose();
      geo.dome.dispose();
   }, [geo]);
   return (
      <group>
         <mesh geometry={geo.hull}>
            <meshStandardMaterial color={COLORS.hull} metalness={0.45} roughness={0.35} />
         </mesh>
         <mesh geometry={geo.dome} position={[0, 0.84, 0]} scale={[1, 0.8, 1]}>
            <meshStandardMaterial color={COLORS.dome} transparent opacity={0.75} roughness={0.1} emissive={COLORS.beam} emissiveIntensity={0.25} />
         </mesh>
         <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.36, 24]} />
            <meshBasicMaterial color={COLORS.beam} />
         </mesh>
      </group>
   );
}

// ---------- crop pool parts ----------

/** Stand-in parts for a crop pool at maturity (1.0 m): a glowing bulb (or spiral gourd) over leaves. */
export function useCropParts(kind: "glowPod" | "gourd"): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const bulbColor = kind === "glowPod" ? "#bbf7d0" : "#a5f3fc";
      const glow = kind === "glowPod" ? COLORS.mint : COLORS.cyan;
      const profile =
         kind === "glowPod"
            ? [new Vector2(0, 0), new Vector2(0.05, 0.05), new Vector2(0.06, 0.3), new Vector2(0.24, 0.48), new Vector2(0.3, 0.68), new Vector2(0.22, 0.9), new Vector2(0.06, 1), new Vector2(0, 1)]
            : [new Vector2(0, 0), new Vector2(0.06, 0.06), new Vector2(0.34, 0.3), new Vector2(0.38, 0.5), new Vector2(0.26, 0.72), new Vector2(0.12, 0.88), new Vector2(0.05, 1), new Vector2(0, 1)];
      const bulb = new LatheGeometry(profile, kind === "glowPod" ? 18 : 10);
      const leaf = new SphereGeometry(0.2, 10, 6);
      const leaves = [0, 1, 2].map((i) => {
         const a = (i / 3) * Math.PI * 2 + 0.4;
         return new Matrix4().makeRotationY(a).multiply(new Matrix4().makeTranslation(0.2, 0.08, 0)).multiply(new Matrix4().makeScale(1.1, 0.25, 0.55));
      });
      return [
         { geometry: bulb, material: new MeshStandardMaterial({ color: bulbColor, roughness: 0.55, emissive: glow, emissiveIntensity: 0.35 }) },
         { geometry: leaf, material: new MeshStandardMaterial({ color: "#6d28d9", roughness: 0.8 }), locals: leaves },
      ];
   }, [kind]);
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (p.material as MeshStandardMaterial).dispose();
         }
      },
      [parts],
   );
   return parts;
}

// ---------- decor ----------

export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => new DodecahedronGeometry(ROCK_WIDTH / 2, 0).scale(1, 0.55, 0.9).translate(0, ROCK_WIDTH * 0.2, 0), []);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <Instanced spots={spots} name="rocks">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color={COLORS.rock} roughness={0.9} flatShading />
      </Instanced>
   );
}

export function CratePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const geo = useMemo(() => new RoundedBoxGeometry(CRATE_WIDTH, CRATE_WIDTH * 0.7, CRATE_WIDTH, 2, 0.06).translate(0, CRATE_WIDTH * 0.35, 0), []);
   useEffect(() => () => geo.dispose(), [geo]);
   return (
      <Instanced spots={spots} name="crates">
         <primitive object={geo} attach="geometry" />
         <meshStandardMaterial color={COLORS.basketDark} roughness={0.8} />
      </Instanced>
   );
}
