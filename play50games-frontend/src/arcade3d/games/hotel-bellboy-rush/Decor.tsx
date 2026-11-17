"use client";

// Per-theme set pieces (looks.setPieceSpots). Visual only: never solids, never in the play lane.
import { useMemo } from "react";
import { Instanced } from "@/arcade3d/core/render";
import type { HotelLevel } from "./levels";
import { lookFor, setPieceSpots } from "./looks";

/** Frames the lobby to match the level name without standing in the walk lane. */
export default function Decor({ level }: { level: HotelLevel }) {
   const look = lookFor(level);
   const spots = useMemo(() => setPieceSpots(level), [level]);
   return (
      <group name={`hotel-decor-${level.theme}`}>
         {spots.chandeliers.length > 0 && (
            <Instanced spots={spots.chandeliers} name="chandeliers">
               <cylinderGeometry args={[0.35, 0.55, 1, 16]} />
               <meshStandardMaterial color={look.brass} metalness={0.75} roughness={0.28} emissive={look.glow} emissiveIntensity={0.45} />
            </Instanced>
         )}
         {spots.columns.length > 0 && (
            <Instanced spots={spots.columns} name="columns">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={look.marble} roughness={0.35} metalness={0.08} />
            </Instanced>
         )}
         {spots.panels.length > 0 && (
            <Instanced spots={spots.panels} name="glass-panels">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={look.glow} transparent opacity={0.35} roughness={0.15} metalness={0.4} depthWrite={false} />
            </Instanced>
         )}
         {spots.boards.length > 0 && (
            <Instanced spots={spots.boards} name="directory">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={look.wainscot} roughness={0.55} />
            </Instanced>
         )}
         {spots.strips.length > 0 && (
            <Instanced spots={spots.strips} name="light-strips">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={look.glow} emissive={look.glow} emissiveIntensity={level.lighting === "night" ? 2.4 : 1.4} />
            </Instanced>
         )}
      </group>
   );
}
