// Stand-ins (drawn only while a GLB is missing) and the procedural pieces: the eyeball and slime
// ingredient pools (one InstancedMesh per part), the monsters' headgear, and the DOM order icons.
// All visible pieces are crafted with 2-3 deliberate tones from the single COLORS palette in looks.ts.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   Color,
   CylinderGeometry,
   Matrix4,
   MeshStandardMaterial,
   SphereGeometry,
   TorusGeometry,
} from "three";
import type { InstancePart } from "@/arcade3d/core/render";
import { COLORS } from "./looks";
import type { IngredientKind, MonsterType } from "./rules";

export const TYPE_TINT: Record<MonsterType, string> = {
   jolly: "#a78bfa",
   greedy: "#4ade80",
   grumpy: "#f472b6",
};

export const KIND_COLOR: Record<IngredientKind, string> = {
   apple: "#ef4444",
   banana: "#facc15",
   burger: "#d97706",
   sock: "#a78bfa",
   tinCan: "#94a3b8",
   fish: "#f97316",
   eyeball: "#e2e8f0",
   slime: "#22c55e",
};

/** The chef's stand-in: a deliberate cartoon cook with uniform, apron, buttons and toque. */
export function ChefPrimitive() {
   return (
      <group name="chef-standin">
         {/* Tunic body */}
         <mesh position-y={0.55}>
            <capsuleGeometry args={[0.3, 0.5, 6, 12]} />
            <meshStandardMaterial color={COLORS.chefTunic} roughness={0.6} />
         </mesh>
         {/* Apron front */}
         <mesh position={[0, 0.48, 0.22]}>
            <boxGeometry args={[0.38, 0.46, 0.04]} />
            <meshStandardMaterial color={COLORS.chefApron} roughness={0.7} />
         </mesh>
         {/* Brass tunic buttons */}
         <mesh position={[-0.08, 0.65, 0.26]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.8} roughness={0.25} />
         </mesh>
         <mesh position={[0.08, 0.65, 0.26]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color={COLORS.brass} metalness={0.8} roughness={0.25} />
         </mesh>
         {/* Head */}
         <mesh position-y={1.22}>
            <sphereGeometry args={[0.2, 16, 12]} />
            <meshStandardMaterial color={COLORS.chefSkin} roughness={0.6} />
         </mesh>
         {/* Chef toque: band + puffed crown */}
         <mesh position-y={1.42}>
            <cylinderGeometry args={[0.17, 0.17, 0.08, 16]} />
            <meshStandardMaterial color={COLORS.chefHatBand} roughness={0.55} />
         </mesh>
         <mesh position-y={1.54}>
            <sphereGeometry args={[0.22, 16, 12]} />
            <meshStandardMaterial color={COLORS.chefHat} roughness={0.6} />
         </mesh>
      </group>
   );
}

/** A monster's stand-in: a friendly cartoon blob with belly patch and expressive eyes. */
export function MonsterPrimitive({ tint }: { tint: string }) {
   return (
      <group name="monster-standin">
         {/* Body */}
         <mesh position-y={0.62}>
            <capsuleGeometry args={[0.55, 0.35, 8, 16]} />
            <meshStandardMaterial color={tint} roughness={0.55} />
         </mesh>
         {/* Lighter belly oval */}
         <mesh position={[0, 0.52, 0.38]}>
            <sphereGeometry args={[0.28, 12, 10]} />
            <meshStandardMaterial color={COLORS.monsterBelly} roughness={0.6} />
         </mesh>
         {/* Left eye: white + pupil */}
         <mesh position={[-0.18, 0.85, 0.42]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color={COLORS.eyeballWhite} roughness={0.3} />
         </mesh>
         <mesh position={[-0.18, 0.85, 0.5]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color={COLORS.eyeballPupil} roughness={0.2} />
         </mesh>
         {/* Right eye: white + pupil */}
         <mesh position={[0.18, 0.85, 0.42]}>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color={COLORS.eyeballWhite} roughness={0.3} />
         </mesh>
         <mesh position={[0.18, 0.85, 0.5]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color={COLORS.eyeballPupil} roughness={0.2} />
         </mesh>
      </group>
   );
}

/** The cauldron's stand-in: rounded iron pot with copper rolled lip and tripod feet. */
export function CauldronPrimitive() {
   return (
      <group name="cauldron-standin">
         <mesh position-y={0.32}>
            <sphereGeometry args={[0.42, 16, 14]} />
            <meshStandardMaterial color={COLORS.cauldronIron} roughness={0.7} />
         </mesh>
         <mesh position-y={0.52} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.38, 0.032, 10, 24]} />
            <meshStandardMaterial color={COLORS.copperHighlight} metalness={0.75} roughness={0.3} />
         </mesh>
      </group>
   );
}

/**
 * The eyeball pool's parts: smooth pearly white (0.36 m across, >= 24 CSS px on phone),
 * vibrant cyan iris disc, midnight pupil, and glossy highlight dot.
 */
export function useEyeballParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const irisLocal = new Matrix4().makeTranslation(0, 0.18, 0.14);
      irisLocal.multiply(new Matrix4().makeRotationX(Math.PI / 2));

      const pupilLocal = new Matrix4().makeTranslation(0, 0.18, 0.155);
      pupilLocal.multiply(new Matrix4().makeRotationX(Math.PI / 2));

      const shineLocal = new Matrix4().makeTranslation(0.04, 0.22, 0.155);

      return [
         // Sclera: white eyeball sphere
         {
            geometry: new SphereGeometry(0.18, 18, 14),
            material: new MeshStandardMaterial({ color: COLORS.eyeballWhite, roughness: 0.28 }),
            locals: [new Matrix4().makeTranslation(0, 0.18, 0)],
         },
         // Iris: striking cyan disc
         {
            geometry: new CylinderGeometry(0.078, 0.078, 0.012, 16),
            material: new MeshStandardMaterial({ color: COLORS.eyeballIris, roughness: 0.35 }),
            locals: [irisLocal],
         },
         // Pupil: midnight pupil cylinder
         {
            geometry: new CylinderGeometry(0.042, 0.042, 0.016, 14),
            material: new MeshStandardMaterial({ color: COLORS.eyeballPupil, roughness: 0.2 }),
            locals: [pupilLocal],
         },
         // Specular highlight: glossy cartoon gleam
         {
            geometry: new SphereGeometry(0.022, 8, 8),
            material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.1 }),
            locals: [shineLocal],
         },
      ];
   }, []);

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

/**
 * The slime cube pool's parts: translucent wobbly jelly cube (0.34 m wide, >= 24 CSS px on phone)
 * with a glowing inner nucleus for a deliberate, appetizing cartoon jelly look.
 */
export function useSlimeParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      return [
         // Outer translucent jelly cube
         {
            geometry: new BoxGeometry(0.34, 0.3, 0.34),
            material: new MeshStandardMaterial({
               color: COLORS.slimeBase,
               roughness: 0.18,
               transparent: true,
               opacity: 0.84,
            }),
            locals: [new Matrix4().makeTranslation(0, 0.15, 0)],
         },
         // Inner glowing core
         {
            geometry: new BoxGeometry(0.16, 0.14, 0.16),
            material: new MeshStandardMaterial({
               color: COLORS.slimeCore,
               emissive: "#16a34a",
               emissiveIntensity: 0.7,
               roughness: 0.3,
            }),
            locals: [new Matrix4().makeTranslation(0, 0.15, 0)],
         },
      ];
   }, []);

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

/** One warm Colour per burst/prop use, built once (no per-frame Color.set in the Scene). */
export const WARM_GLOW = new Color(COLORS.fireGlow);

// ---------- Monster Headgear (children at the measured head anchor) ----------

export function PartyHat() {
   return (
      <group position-y={0.09}>
         {/* Main festive cone */}
         <mesh>
            <coneGeometry args={[0.12, 0.26, 14]} />
            <meshStandardMaterial color={COLORS.partyHat} roughness={0.45} />
         </mesh>
         {/* Gold rim trim */}
         <mesh position-y={-0.11} rotation-x={Math.PI / 2}>
            <torusGeometry args={[0.115, 0.016, 8, 16]} />
            <meshStandardMaterial
               color={COLORS.partyHatTrim}
               metalness={0.7}
               roughness={0.3}
            />
         </mesh>
         {/* Fluffy cyan pom-pom sphere on top */}
         <mesh position-y={0.14}>
            <sphereGeometry args={[0.038, 10, 8]} />
            <meshStandardMaterial color={COLORS.partyHatBall} roughness={0.6} />
         </mesh>
      </group>
   );
}

export function TopHat() {
   return (
      <group position-y={0.03}>
         {/* Crown cylinder */}
         <mesh position-y={0.12}>
            <cylinderGeometry args={[0.1, 0.1, 0.22, 16]} />
            <meshStandardMaterial color={COLORS.topHat} roughness={0.5} />
         </mesh>
         {/* Brim disc */}
         <mesh position-y={0.02}>
            <cylinderGeometry args={[0.18, 0.18, 0.025, 16]} />
            <meshStandardMaterial color={COLORS.topHat} roughness={0.5} />
         </mesh>
         {/* Crimson ribbon band */}
         <mesh position-y={0.055}>
            <cylinderGeometry args={[0.104, 0.104, 0.045, 16]} />
            <meshStandardMaterial color={COLORS.topHatBand} roughness={0.4} />
         </mesh>
         {/* Gold buckle */}
         <mesh position={[0, 0.055, 0.108]}>
            <boxGeometry args={[0.042, 0.038, 0.012]} />
            <meshStandardMaterial
               color={COLORS.topHatBuckle}
               metalness={0.8}
               roughness={0.25}
            />
         </mesh>
      </group>
   );
}

export function Horns() {
   return (
      <group position-y={0.04}>
         {/* Left horn: ivory body + golden tip + bronze base ridge */}
         <group position={[-0.14, 0.08, 0]} rotation-z={0.5}>
            <mesh>
               <coneGeometry args={[0.05, 0.2, 10]} />
               <meshStandardMaterial color={COLORS.hornBase} roughness={0.5} />
            </mesh>
            <mesh position-y={0.07}>
               <coneGeometry args={[0.026, 0.07, 10]} />
               <meshStandardMaterial color={COLORS.hornTip} roughness={0.4} />
            </mesh>
            <mesh position-y={-0.08} rotation-x={Math.PI / 2}>
               <torusGeometry args={[0.048, 0.01, 6, 12]} />
               <meshStandardMaterial color={COLORS.hornRing} roughness={0.6} />
            </mesh>
         </group>

         {/* Right horn */}
         <group position={[0.14, 0.08, 0]} rotation-z={-0.5}>
            <mesh>
               <coneGeometry args={[0.05, 0.2, 10]} />
               <meshStandardMaterial color={COLORS.hornBase} roughness={0.5} />
            </mesh>
            <mesh position-y={0.07}>
               <coneGeometry args={[0.026, 0.07, 10]} />
               <meshStandardMaterial color={COLORS.hornTip} roughness={0.4} />
            </mesh>
            <mesh position-y={-0.08} rotation-x={Math.PI / 2}>
               <torusGeometry args={[0.048, 0.01, 6, 12]} />
               <meshStandardMaterial color={COLORS.hornRing} roughness={0.6} />
            </mesh>
         </group>
      </group>
   );
}

export function Headgear({ type }: { type: MonsterType }) {
   if (type === "jolly") return <PartyHat />;
   if (type === "greedy") return <TopHat />;
   return <Horns />;
}

// ---------- DOM Order Icons (colour + silhouette + outline ring) ----------

/** The ingredient names on the HUD hand card. */
export const KIND_LABEL: Record<IngredientKind, string> = {
   apple: "Apple",
   banana: "Banana",
   burger: "Burger",
   sock: "Sock",
   tinCan: "Tin can",
   fish: "Fish",
   eyeball: "Eyeball",
   slime: "Slime cube",
};

export function KindIcon({ kind, size = 22 }: { kind: IngredientKind; size?: number }) {
   const ring = KIND_COLOR[kind];
   return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
         <circle cx="12" cy="12" r="10.5" fill="rgba(11,16,32,0.55)" stroke={ring} strokeWidth="1.6" />
         {iconShape(kind)}
      </svg>
   );
}

function iconShape(kind: IngredientKind) {
   switch (kind) {
      case "apple":
         return (
            <g>
               <circle cx="12" cy="13.5" r="5.6" fill={KIND_COLOR.apple} />
               <path d="M12 8 q1 -3 3 -3.5" stroke="#854d0e" strokeWidth="1.4" fill="none" />
            </g>
         );
      case "banana":
         return <path d="M6 5 q4 10 13 9 q-9 4 -13 -9 z" fill={KIND_COLOR.banana} />;
      case "burger":
         return (
            <g>
               <rect x="6" y="7.5" width="12" height="4" rx="2" fill="#f59e0b" />
               <rect x="6.5" y="12" width="11" height="2.4" rx="1.2" fill="#84cc16" />
               <rect x="6" y="15" width="12" height="3" rx="1.5" fill={KIND_COLOR.burger} />
            </g>
         );
      case "sock":
         return (
            <path
               d="M9 5 h4.5 v7 l3.5 3.5 q1.4 1.4 0 2.8 l-1.2 1.2 q-1.4 1.4 -2.8 0 l-4 -4 z"
               fill={KIND_COLOR.sock}
            />
         );
      case "tinCan":
         return (
            <g>
               <rect x="7.5" y="6.5" width="9" height="11" rx="1" fill={KIND_COLOR.tinCan} />
               <ellipse cx="12" cy="6.5" rx="4.5" ry="1.5" fill="#cbd5e1" />
            </g>
         );
      case "fish":
         return (
            <g>
               <ellipse cx="11" cy="12" rx="5.4" ry="3.2" fill={KIND_COLOR.fish} />
               <path d="M15.8 12 l3.6 -2.8 v5.6 z" fill={KIND_COLOR.fish} />
               <circle cx="8.6" cy="11.4" r="0.8" fill="#0f172a" />
            </g>
         );
      case "eyeball":
         return (
            <g>
               <circle cx="12" cy="12" r="5.6" fill={KIND_COLOR.eyeball} />
               <circle cx="12" cy="12" r="2.6" fill="#38bdf8" />
               <circle cx="12" cy="12" r="1.2" fill="#0f172a" />
            </g>
         );
      case "slime":
         return (
            <g>
               <rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill={KIND_COLOR.slime} />
               <circle cx="10" cy="10" r="1.4" fill="#86efac" />
            </g>
         );
   }
}
