// Stand-ins (drawn only while a GLB is missing) and the procedural pieces: the eyeball and slime
// ingredient pools (one InstancedMesh per part), the monsters' headgear, and the DOM order icons.
// Palette notes: the cave is dark (environment #3f3f46), so surfaces lean warm and props carry the
// accent #f472b6 (grumpy) against jolly lilac and greedy green.
import { useEffect, useMemo } from "react";
import { BoxGeometry, Color, Matrix4, MeshStandardMaterial, SphereGeometry } from "three";
import type { InstancePart } from "@/arcade3d/core/render";
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

/** The chef's stand-in: a white-uniformed cook. */
export function ChefPrimitive() {
   return (
      <group name="chef-standin">
         <mesh position-y={0.55}>
            <capsuleGeometry args={[0.3, 0.5, 6, 12]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
         </mesh>
         <mesh position-y={1.25}>
            <sphereGeometry args={[0.21, 16, 12]} />
            <meshStandardMaterial color="#f1c27d" roughness={0.6} />
         </mesh>
         <mesh position-y={1.44}>
            <cylinderGeometry args={[0.16, 0.16, 0.18, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.6} />
         </mesh>
      </group>
   );
}

/** A monster's stand-in: a tinted blob with eyes. */
export function MonsterPrimitive({ tint }: { tint: string }) {
   return (
      <group name="monster-standin">
         <mesh position-y={0.62}>
            <capsuleGeometry args={[0.55, 0.35, 8, 16]} />
            <meshStandardMaterial color={tint} roughness={0.55} />
         </mesh>
         <mesh position={[-0.18, 0.85, 0.42]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#fefce8" roughness={0.4} />
         </mesh>
         <mesh position={[0.18, 0.85, 0.42]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshStandardMaterial color="#fefce8" roughness={0.4} />
         </mesh>
      </group>
   );
}

/** The cauldron's stand-in. */
export function CauldronPrimitive() {
   return (
      <mesh position-y={0.3} name="cauldron-standin">
         <cylinderGeometry args={[0.42, 0.34, 0.6, 20]} />
         <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
   );
}

/** The eyeball pool's parts: the white (0.36 m across, >= 24 CSS px on a 390x844 phone) and the iris. */
export function useEyeballParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(() => {
      const irisLocal = new Matrix4().makeTranslation(0, 0.18, 0.13);
      return [
         {
            geometry: new SphereGeometry(0.18, 16, 12),
            material: new MeshStandardMaterial({ color: "#f8fafc", roughness: 0.35 }),
            locals: [new Matrix4().makeTranslation(0, 0.18, 0)],
         },
         {
            geometry: new SphereGeometry(0.072, 10, 8),
            material: new MeshStandardMaterial({ color: "#0f172a", roughness: 0.3 }),
            locals: [irisLocal],
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

/** The slime cube pool's part: one wobbly green block (0.34 m wide, >= 24 CSS px on a phone) for all copies. */
export function useSlimeParts(): readonly InstancePart[] {
   const parts = useMemo<InstancePart[]>(
      () => [
         {
            geometry: new BoxGeometry(0.34, 0.3, 0.34),
            material: new MeshStandardMaterial({ color: "#22c55e", roughness: 0.25 }),
            locals: [new Matrix4().makeTranslation(0, 0.15, 0)],
         },
      ],
      [],
   );
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
export const WARM_GLOW = new Color("#fb923c");

// ---------- the monsters' headgear (children at the measured head anchor) ----------

export function PartyHat() {
   return (
      <mesh position-y={0.09}>
         <coneGeometry args={[0.12, 0.26, 14]} />
         <meshStandardMaterial color="#f472b6" roughness={0.5} />
      </mesh>
   );
}

export function TopHat() {
   return (
      <group position-y={0.03}>
         <mesh position-y={0.12}>
            <cylinderGeometry args={[0.1, 0.1, 0.22, 14]} />
            <meshStandardMaterial color="#1f2937" roughness={0.5} />
         </mesh>
         <mesh position-y={0.02}>
            <cylinderGeometry args={[0.17, 0.17, 0.03, 14]} />
            <meshStandardMaterial color="#1f2937" roughness={0.5} />
         </mesh>
      </group>
   );
}

export function Horns() {
   return (
      <group position-y={0.04}>
         <mesh position={[-0.14, 0.08, 0]} rotation-z={0.5}>
            <coneGeometry args={[0.05, 0.2, 10]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.5} />
         </mesh>
         <mesh position={[0.14, 0.08, 0]} rotation-z={-0.5}>
            <coneGeometry args={[0.05, 0.2, 10]} />
            <meshStandardMaterial color="#fef3c7" roughness={0.5} />
         </mesh>
      </group>
   );
}

export function Headgear({ type }: { type: MonsterType }) {
   if (type === "jolly") return <PartyHat />;
   if (type === "greedy") return <TopHat />;
   return <Horns />;
}

// ---------- the DOM order icons: colour + silhouette + an outline ring ----------

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
         return <path d="M9 5 h4.5 v7 l3.5 3.5 q1.4 1.4 0 2.8 l-1.2 1.2 q-1.4 1.4 -2.8 0 l-4 -4 z" fill={KIND_COLOR.sock} />;
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
               <rect x="6.5" y="8" width="11" height="8.5" rx="3" fill={KIND_COLOR.slime} />
               <circle cx="9.5" cy="17" r="1.3" fill={KIND_COLOR.slime} />
               <circle cx="13.5" cy="17.6" r="1" fill={KIND_COLOR.slime} />
            </g>
         );
   }
}
