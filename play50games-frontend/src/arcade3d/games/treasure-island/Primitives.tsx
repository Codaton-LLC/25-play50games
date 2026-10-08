"use client";

// Treasure Island stand-ins (drawn while a GLB is missing or broken) and the procedural pieces: the
// explorer hat (on the head anchor of the rigged runner; the stand-in wears its own), the coin and
// crab pool parts. Island-specific: the reusable pattern is in Scene.tsx.
import { useEffect, useMemo, type RefObject } from "react";
import { CylinderGeometry, LatheGeometry, Matrix4, MeshStandardMaterial, SphereGeometry, Vector2, type Group } from "three";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { COIN_SIZE, CRATE_SIZE, CRAB_WIDTH, PALM_SIZE, UMBRELLA_HEIGHT } from "./assets";

export const COLORS = {
   sand: "#f2d7a6",
   wetSand: "#c9a877",
   grass: "#65a30d",
   grassDark: "#4d7c0f",
   sea: "#2dd4bf",
   deep: "#0e7490",
   foam: "#f0fdfa",
   rock: "#78716c",
   palm: "#4d7c0f",
   trunk: "#a16207",
   wood: "#92400e",
   woodLight: "#b45309",
   deck: "#d6a46a",
   hull: "#e0b27a",
   hat: "#c8a165",
   hatBand: "#5b3a1e",
   shirt: "#0f766e",
   skin: "#f5c9a0",
   gold: "#fbbf24",
   chest: "#8b5a2b",
   gull: "#f8fafc",
   crab: "#ef4444",
   hole: "#5b4630",
} as const;

// ---------- the explorer hat ----------

/** Hat profile (m, about the head anchor at the top of the head): a brim 0.36 across, a crown above. */
export const HAT = { brim: 0.18, crown: 0.12, brimY: -0.075, top: 0.05 } as const;

let hatGeometry: { shell: LatheGeometry; band: CylinderGeometry } | null = null;

/** Built once per page (the hat is on one explorer at a time); never disposed (a few hundred vertices). */
function hatParts() {
   if (!hatGeometry) {
      const { brim, crown, brimY, top } = HAT;
      const profile = [
         new Vector2(0, brimY - 0.004),
         new Vector2(brim, brimY - 0.006),
         new Vector2(brim + 0.004, brimY),
         new Vector2(crown + 0.01, brimY + 0.012),
         new Vector2(crown, brimY + 0.02),
         new Vector2(crown * 0.96, top - 0.025),
         new Vector2(crown * 0.75, top - 0.004),
         new Vector2(crown * 0.35, top),
         new Vector2(0, top),
      ];
      hatGeometry = {
         shell: new LatheGeometry(profile, 24),
         band: new CylinderGeometry(crown + 0.004, crown + 0.008, 0.03, 24, 1, true),
      };
   }
   return hatGeometry;
}

/** The explorer's hat: origin on the crown (the head anchor), brim level in x/z. */
export function ExplorerHat() {
   const parts = hatParts();
   return (
      <group name="explorer-hat">
         <mesh geometry={parts.shell}>
            <meshStandardMaterial color={COLORS.hat} roughness={0.85} />
         </mesh>
         <mesh geometry={parts.band} position-y={HAT.brimY + 0.035}>
            <meshStandardMaterial color={COLORS.hatBand} roughness={0.8} />
         </mesh>
      </group>
   );
}

/** The stand-in explorer (1.55 m): body capsule, head, and the hat. */
export function ExplorerPrimitive({ body }: { body?: RefObject<Group> }) {
   return (
      <group ref={body}>
         <mesh position-y={0.62}>
            <capsuleGeometry args={[0.24, 0.62, 6, 14]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.7} />
         </mesh>
         <mesh position-y={1.33}>
            <sphereGeometry args={[0.17, 18, 14]} />
            <meshStandardMaterial color={COLORS.skin} roughness={0.8} />
         </mesh>
         <group position-y={1.5}>
            <ExplorerHat />
         </group>
      </group>
   );
}

// ---------- props (InstancedModel fallbacks) ----------

/** Palm stand-ins: trunk and a flattened crown, at the same spots as the GLB copies. */
export function PalmPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const crowns = useMemo(() => spots.map((s) => ({ ...s, y: s.y + PALM_SIZE.height * 0.82, sy: (s.scale ?? 1) * 0.45 })), [spots]);
   const trunks = useMemo(() => spots.map((s) => ({ ...s, y: s.y + PALM_SIZE.height * 0.4 })), [spots]);
   return (
      <>
         <Instanced spots={trunks} name="palm-trunks">
            <cylinderGeometry args={[0.16, 0.26, PALM_SIZE.height * 0.8, 8]} />
            <meshStandardMaterial color={COLORS.trunk} roughness={0.9} />
         </Instanced>
         <Instanced spots={crowns} name="palm-crowns">
            <sphereGeometry args={[PALM_SIZE.crown / 2, 10, 8]} />
            <meshStandardMaterial color={COLORS.palm} roughness={0.8} flatShading />
         </Instanced>
      </>
   );
}

/** Rock stand-ins: flattened spheres, one unit across at scale 1 (the rock asset's default fit). */
export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const lifted = useMemo(() => spots.map((s) => ({ ...s, y: s.y + 0.18 * (s.scale ?? 1), sy: 0.45 * (s.scale ?? 1) })), [spots]);
   return (
      <Instanced spots={lifted} name="rock-standins">
         <sphereGeometry args={[0.5, 9, 7]} />
         <meshStandardMaterial color={COLORS.rock} roughness={0.95} flatShading />
      </Instanced>
   );
}

export function CratePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const lifted = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (CRATE_SIZE * 0.71) / 2 })), [spots]);
   return (
      <Instanced spots={lifted} name="crate-standins">
         <boxGeometry args={[CRATE_SIZE, CRATE_SIZE * 0.71, CRATE_SIZE * 0.96]} />
         <meshStandardMaterial color={COLORS.woodLight} roughness={0.85} />
      </Instanced>
   );
}

export function UmbrellaPrimitive() {
   return (
      <group>
         <mesh position-y={UMBRELLA_HEIGHT * 0.45}>
            <cylinderGeometry args={[0.03, 0.03, UMBRELLA_HEIGHT * 0.9, 8]} />
            <meshStandardMaterial color="#e5e7eb" />
         </mesh>
         <mesh position-y={UMBRELLA_HEIGHT * 0.78}>
            <coneGeometry args={[1.3, 0.5, 12, 1, true]} />
            <meshStandardMaterial color="#f43f5e" side={2} roughness={0.7} />
         </mesh>
      </group>
   );
}

export function ChestPrimitive() {
   return (
      <group>
         <mesh position-y={0.2}>
            <boxGeometry args={[0.9, 0.4, 0.6]} />
            <meshStandardMaterial color={COLORS.chest} roughness={0.8} />
         </mesh>
         <mesh position-y={0.47} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={COLORS.chest} roughness={0.8} />
         </mesh>
         <mesh position={[0, 0.36, 0.305]}>
            <boxGeometry args={[0.14, 0.16, 0.02]} />
            <meshStandardMaterial color={COLORS.gold} metalness={0.6} roughness={0.35} />
         </mesh>
      </group>
   );
}

export function GullPrimitive() {
   return (
      <group>
         <mesh position-y={0.2} scale={[0.6, 0.6, 1]}>
            <sphereGeometry args={[0.25, 12, 10]} />
            <meshStandardMaterial color={COLORS.gull} roughness={0.7} />
         </mesh>
         <mesh position-y={0.24} scale={[1, 0.12, 0.45]}>
            <sphereGeometry args={[0.45, 12, 6]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
         </mesh>
      </group>
   );
}

// ---------- pool parts (DynamicInstancedModel fallbackParts; metres, placed by the pool's update) ----------

/** A coin stand-in: a gold disc COIN_SIZE across, centred on its origin and facing +z like the GLB. */
export function useCoinParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const geometry = new CylinderGeometry(COIN_SIZE / 2, COIN_SIZE / 2, 0.06, 16);
      geometry.rotateX(Math.PI / 2);
      return [{ geometry, material: new MeshStandardMaterial({ color: COLORS.gold, metalness: 0.6, roughness: 0.35 }) }];
   }, []);
   useDisposeParts(parts);
   return parts;
}

/** A crab stand-in: a flattened red body with two claws. */
export function useCrabParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const geometry = new SphereGeometry(0.5, 10, 8);
      const w = CRAB_WIDTH;
      const at = (x: number, y: number, sx: number, sy: number, sz: number) => new Matrix4().makeScale(sx, sy, sz).setPosition(x, y, 0);
      return [
         {
            geometry,
            material: new MeshStandardMaterial({ color: COLORS.crab, roughness: 0.6 }),
            locals: [at(0, 0.1 * w, 0.6 * w, 0.35 * w, 0.45 * w), at(0.38 * w, 0.14 * w, 0.22 * w, 0.18 * w, 0.2 * w), at(-0.38 * w, 0.14 * w, 0.22 * w, 0.18 * w, 0.2 * w)],
         },
      ];
   }, []);
   useDisposeParts(parts);
   return parts;
}

function useDisposeParts(parts: readonly InstancePart[]): void {
   useEffect(
      () => () => {
         for (const p of parts) {
            p.geometry.dispose();
            (Array.isArray(p.material) ? p.material : [p.material]).forEach((m) => m.dispose());
         }
      },
      [parts]
   );
}
