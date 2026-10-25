"use client";

// Treasure Island stand-ins (drawn while a GLB is missing or broken) and the procedural pieces: the
// explorer hat (on the head anchor of the rigged runner; the stand-in wears its own), the coin and
// crab pool parts. Deliberate, bevelled/rounded shapes with 2-3 tones from COLORS, flat-shaded low-poly.
import { useEffect, useMemo, type RefObject } from "react";
import {
   BoxGeometry,
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   LatheGeometry,
   Matrix4,
   MeshStandardMaterial,
   SphereGeometry,
   Vector2,
   type Group,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { COIN_SIZE, CRATE_SIZE, CRAB_WIDTH, PALM_SIZE, SHOVEL_LENGTH, UMBRELLA_HEIGHT } from "./assets";
import { COLORS } from "./looks";

export { COLORS };

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

/**
 * The shovel's stand-in (SHOVEL_LENGTH tall, the GLB's frame: the blade's edge on the origin, up the
 * shaft to the grip): a bevelled steel blade with dark collar, rich wooden stick and sculpted D-grip.
 */
export function ShovelPrimitive() {
   return (
      <group name="shovel-primitive">
         {/* Bevelled steel blade */}
         <mesh position-y={0.19}>
            <boxGeometry args={[0.3, 0.38, 0.03]} />
            <meshStandardMaterial color={COLORS.shovelSteel} metalness={0.55} roughness={0.45} />
         </mesh>
         {/* Steel socket collar */}
         <mesh position-y={0.36}>
            <cylinderGeometry args={[0.028, 0.034, 0.08, 8]} />
            <meshStandardMaterial color={COLORS.shovelSteelDark} metalness={0.65} roughness={0.4} />
         </mesh>
         {/* Oiled wood shaft */}
         <mesh position-y={SHOVEL_LENGTH * 0.62}>
            <cylinderGeometry args={[0.022, 0.022, SHOVEL_LENGTH * 0.76, 8]} />
            <meshStandardMaterial color={COLORS.woodLight} roughness={0.85} />
         </mesh>
         {/* Sculpted D-grip */}
         <mesh position-y={SHOVEL_LENGTH - 0.025} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
            <meshStandardMaterial color={COLORS.woodDark} roughness={0.85} />
         </mesh>
      </group>
   );
}

/** The stand-in explorer (1.55 m): deliberate body with boots, shorts, shirt, head, hat, and shovel. */
export function ExplorerPrimitive({ body }: { body?: RefObject<Group> }) {
   return (
      <group ref={body}>
         <group position={[0, 0.5, -0.3]} rotation={[0, 0, 0.5]}>
            <ShovelPrimitive />
         </group>
         {/* Boots */}
         <mesh position={[-0.1, 0.12, 0]}>
            <boxGeometry args={[0.14, 0.24, 0.2]} />
            <meshStandardMaterial color={COLORS.hatBand} roughness={0.9} />
         </mesh>
         <mesh position={[0.1, 0.12, 0]}>
            <boxGeometry args={[0.14, 0.24, 0.2]} />
            <meshStandardMaterial color={COLORS.hatBand} roughness={0.9} />
         </mesh>
         {/* Shorts */}
         <mesh position-y={0.42}>
            <cylinderGeometry args={[0.22, 0.23, 0.32, 10]} />
            <meshStandardMaterial color={COLORS.hat} roughness={0.85} />
         </mesh>
         {/* Shirt torso capsule */}
         <mesh position-y={0.78}>
            <capsuleGeometry args={[0.22, 0.44, 6, 14]} />
            <meshStandardMaterial color={COLORS.shirt} roughness={0.7} />
         </mesh>
         {/* Head */}
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

/** Palm stand-ins: curved segmented trunk and a lush tiered tropical crown, 2 tones each. */
export function PalmPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const trunks = useMemo(
      () => spots.map((s) => ({ ...s, y: s.y + PALM_SIZE.height * 0.4 })),
      [spots]
   );
   const crownsLower = useMemo(
      () => spots.map((s) => ({ ...s, y: s.y + PALM_SIZE.height * 0.8, sy: (s.scale ?? 1) * 0.45 })),
      [spots]
   );
   const crownsUpper = useMemo(
      () => spots.map((s) => ({ ...s, y: s.y + PALM_SIZE.height * 0.94, sy: (s.scale ?? 1) * 0.38, rotY: (s.rotY ?? 0) + 0.4 })),
      [spots]
   );

   return (
      <>
         <Instanced spots={trunks} name="palm-trunks">
            <cylinderGeometry args={[0.16, 0.26, PALM_SIZE.height * 0.8, 8]} />
            <meshStandardMaterial color={COLORS.palmTrunk} roughness={0.9} />
         </Instanced>
         <Instanced spots={crownsLower} name="palm-crowns-lower">
            <coneGeometry args={[PALM_SIZE.crown * 0.52, 0.7, 8]} />
            <meshStandardMaterial color={COLORS.palm} roughness={0.8} flatShading />
         </Instanced>
         <Instanced spots={crownsUpper} name="palm-crowns-upper">
            <coneGeometry args={[PALM_SIZE.crown * 0.4, 0.65, 8]} />
            <meshStandardMaterial color={COLORS.palmLeafSun} roughness={0.8} flatShading />
         </Instanced>
      </>
   );
}

/** Rock stand-ins: faceted low-poly boulders with sunlit highlights and shaded base. */
export function RockPrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const lifted = useMemo(
      () => spots.map((s) => ({ ...s, y: s.y + 0.22 * (s.scale ?? 1), sy: 0.62 * (s.scale ?? 1) })),
      [spots]
   );
   return (
      <Instanced spots={lifted} name="rock-standins">
         <dodecahedronGeometry args={[0.5, 0]} />
         <meshStandardMaterial color={COLORS.rockSun} roughness={0.9} flatShading />
      </Instanced>
   );
}

/** Crate stand-ins: warm wood planks with dark outer framing/iron corner brackets (2 tones). */
export function CratePrimitives({ spots }: { spots: readonly InstanceSpot[] }) {
   const lifted = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (CRATE_SIZE * 0.71) / 2 })), [spots]);
   const frames = useMemo(() => spots.map((s) => ({ ...s, y: s.y + (CRATE_SIZE * 0.71) / 2, sx: (s.scale ?? 1) * 1.02, sy: (s.scale ?? 1) * 1.02, sz: (s.scale ?? 1) * 1.02 })), [spots]);

   return (
      <>
         <Instanced spots={lifted} name="crate-body-standins">
            <boxGeometry args={[CRATE_SIZE * 0.98, CRATE_SIZE * 0.7, CRATE_SIZE * 0.94]} />
            <meshStandardMaterial color={COLORS.woodLight} roughness={0.85} />
         </Instanced>
         <Instanced spots={frames} name="crate-brackets-standins">
            <boxGeometry args={[CRATE_SIZE * 1.01, CRATE_SIZE * 0.16, CRATE_SIZE * 0.97]} />
            <meshStandardMaterial color={COLORS.woodDark} roughness={0.9} />
         </Instanced>
      </>
   );
}

/** Beach umbrella stand-in: teak pole, brass finial, striped coral & cream canopy. */
export function UmbrellaPrimitive() {
   return (
      <group name="umbrella-standin">
         {/* Teak pole */}
         <mesh position-y={UMBRELLA_HEIGHT * 0.45}>
            <cylinderGeometry args={[0.035, 0.035, UMBRELLA_HEIGHT * 0.9, 8]} />
            <meshStandardMaterial color={COLORS.wood} roughness={0.85} />
         </mesh>
         {/* Brass canopy hub */}
         <mesh position-y={UMBRELLA_HEIGHT * 0.88}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color={COLORS.gold} metalness={0.7} roughness={0.3} />
         </mesh>
         {/* Striped canopy */}
         <mesh position-y={UMBRELLA_HEIGHT * 0.78}>
            <coneGeometry args={[1.3, 0.5, 12, 1, true]} />
            <meshStandardMaterial color={COLORS.umbrellaRed} side={2} roughness={0.75} />
         </mesh>
      </group>
   );
}

/** Pirate chest stand-in: dark mahogany body, black iron reinforcing straps, polished gold lock. */
export function ChestPrimitive() {
   return (
      <group name="chest-standin">
         {/* Mahogany wooden body */}
         <mesh position-y={0.2}>
            <boxGeometry args={[0.9, 0.4, 0.6]} />
            <meshStandardMaterial color={COLORS.chestWood} roughness={0.8} />
         </mesh>
         {/* Arched lid */}
         <mesh position-y={0.47} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={COLORS.chestWood} roughness={0.8} />
         </mesh>
         {/* Iron reinforcing straps */}
         <mesh position={[-0.3, 0.32, 0]}>
            <boxGeometry args={[0.06, 0.48, 0.62]} />
            <meshStandardMaterial color={COLORS.chestIron} metalness={0.7} roughness={0.4} />
         </mesh>
         <mesh position={[0.3, 0.32, 0]}>
            <boxGeometry args={[0.06, 0.48, 0.62]} />
            <meshStandardMaterial color={COLORS.chestIron} metalness={0.7} roughness={0.4} />
         </mesh>
         {/* Heavy brass lock */}
         <mesh position={[0, 0.36, 0.305]}>
            <boxGeometry args={[0.14, 0.16, 0.03]} />
            <meshStandardMaterial color={COLORS.gold} metalness={0.7} roughness={0.3} />
         </mesh>
      </group>
   );
}

/** Seagull stand-in: aerodynamic body, slate-tipped wings, golden beak. */
export function GullPrimitive() {
   return (
      <group name="gull-standin">
         {/* White body */}
         <mesh position-y={0.2} scale={[0.6, 0.6, 1]}>
            <sphereGeometry args={[0.25, 12, 10]} />
            <meshStandardMaterial color={COLORS.gull} roughness={0.7} />
         </mesh>
         {/* Wings with slate tips */}
         <mesh position-y={0.24} scale={[1, 0.12, 0.45]}>
            <sphereGeometry args={[0.45, 12, 6]} />
            <meshStandardMaterial color={COLORS.gullWing} roughness={0.7} />
         </mesh>
         {/* Golden beak */}
         <mesh position={[0, 0.18, 0.3]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.04, 0.14, 5]} />
            <meshStandardMaterial color={COLORS.gullBeak} roughness={0.5} />
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
      return [{ geometry, material: new MeshStandardMaterial({ color: COLORS.gold, metalness: 0.7, roughness: 0.3 }) }];
   }, []);
   useDisposeParts(parts);
   return parts;
}

/** A crab stand-in: a rounded carapace with two sculpted claws (2 tones). */
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
