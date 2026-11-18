"use client";

// Apron scenery outside the walkable station (looks.decorSpots). Visual only: never solids.
import { useMemo } from "react";
import { Instanced } from "@/arcade3d/core/render";
import type { StationLevel } from "./levels";
import { BED_DEPTH, COLORS, decorSpots, lookFor } from "./looks";

/**
 * Apron trees stand beside the platforms, where the only ground is the dark ballast bed (y = -BED_DEPTH,
 * the bed plane sits 0.02 lower). Each tree stands in a raised lawn bed, 2 m x its scale square: stone
 * sides from that ground up to the platform top and a light grass top that shows past the canopy from
 * the high camera; the trunk runs from the grass into the canopy, so no tree floats over the bed. The
 * spots are APRON_GAP (2.2 m) outside the walkable station and a bed reaches at most 1.6 m (scale 1.6).
 */
const TREE_GROUND = -BED_DEPTH - 0.02;
const PLANTER_TOP = 0.05;
const PLANTER = "#78716c";
const GRASS = "#65a30d";
const CROWN_TOP = "#15803d";

/** Frames the station without standing in the play area. Palette follows the level theme. */
export default function Decor({ level }: { level: StationLevel }) {
   const look = lookFor(level);
   const spots = useMemo(() => decorSpots(level), [level]);
   const warm = look.scenery === "sunset" || look.scenery === "hall";
   const building = warm ? COLORS.buildingWarm : COLORS.building;
   const buildingDark = COLORS.buildingDark;

   return (
      <group name="station-apron">
         {spots.buildings.length > 0 ? (
            <Instanced spots={spots.buildings} name="apron-buildings">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={building} roughness={0.85} />
            </Instanced>
         ) : null}
         {spots.buildings.length > 0 ? (
            // darker roof caps (same footprints, shorter, raised)
            <Instanced
               spots={spots.buildings.map((b) => ({
                  ...b,
                  y: (b.sy ?? 1) * 0.92,
                  sy: Math.max(0.25, (b.sy ?? 1) * 0.12),
                  sx: (b.sx ?? 1) * 1.05,
                  sz: (b.sz ?? 1) * 1.05,
               }))}
               name="apron-roofs"
            >
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={buildingDark} roughness={0.9} />
            </Instanced>
         ) : null}
         {spots.trees.length > 0 ? (
            <>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: (TREE_GROUND + PLANTER_TOP) / 2, z: t.z, rotY: t.rotY ?? 0,
                     sx: 2.0 * (t.scale ?? 1), sy: PLANTER_TOP - TREE_GROUND, sz: 2.0 * (t.scale ?? 1),
                  }))}
                  name="apron-planters"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={PLANTER} roughness={0.85} />
               </Instanced>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: PLANTER_TOP + 0.015, z: t.z, rotY: t.rotY ?? 0,
                     sx: 1.86 * (t.scale ?? 1), sy: 0.03, sz: 1.86 * (t.scale ?? 1),
                  }))}
                  name="apron-grass"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={GRASS} roughness={1} />
               </Instanced>
               <Instanced
                  spots={spots.trees.map((t) => {
                     const s = t.scale ?? 1;
                     // from the grass cap up 0.1 into the canopy (its bottom is at 0.85 s)
                     const top = 0.95 * s;
                     return { x: t.x, y: (PLANTER_TOP + top) / 2, z: t.z, rotY: t.rotY ?? 0, sx: 0.26 * s, sy: top - PLANTER_TOP, sz: 0.26 * s };
                  })}
                  name="apron-trunks"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.treeTrunk} roughness={0.95} />
               </Instanced>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: 1.6 * (t.scale ?? 1), z: t.z, rotY: t.rotY ?? 0,
                     sx: 1.4 * (t.scale ?? 1), sy: 1.5 * (t.scale ?? 1), sz: 1.4 * (t.scale ?? 1),
                  }))}
                  name="apron-canopies"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.tree} roughness={0.9} />
               </Instanced>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: 2.5 * (t.scale ?? 1), z: t.z, rotY: (t.rotY ?? 0) + Math.PI / 4,
                     sx: 0.95 * (t.scale ?? 1), sy: 0.7 * (t.scale ?? 1), sz: 0.95 * (t.scale ?? 1),
                  }))}
                  name="apron-crowns"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={CROWN_TOP} roughness={0.9} />
               </Instanced>
            </>
         ) : null}
         {spots.signals.length > 0 ? (
            <>
               <Instanced spots={spots.signals} name="apron-signals">
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color={COLORS.buildingDark} metalness={0.4} roughness={0.45} />
               </Instanced>
               <Instanced
                  spots={spots.signals.map((s) => ({
                     ...s,
                     y: (s.sy ?? 3) * 0.85,
                     sy: 0.28,
                     sx: (s.sx ?? 0.3) * 1.6,
                     sz: (s.sz ?? 0.3) * 1.6,
                  }))}
                  name="apron-signal-lamps"
               >
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial
                     color={COLORS.signal}
                     emissive={COLORS.signal}
                     emissiveIntensity={look.scenery === "city" || look.scenery === "sunset" ? 1.4 : 0.6}
                     roughness={0.4}
                  />
               </Instanced>
            </>
         ) : null}
         {spots.pillars.length > 0 ? (
            <Instanced spots={spots.pillars} name="apron-pillars">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color="#d6d3d1" roughness={0.55} />
            </Instanced>
         ) : null}
         {spots.boards.length > 0 ? (
            <Instanced spots={spots.boards} name="apron-boards">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial
                  color="#0f172a"
                  emissive={look.scenery === "city" ? COLORS.neon : "#1e293b"}
                  emissiveIntensity={look.scenery === "city" ? 0.55 : 0.15}
                  roughness={0.5}
               />
            </Instanced>
         ) : null}
         {spots.neon.length > 0 ? (
            <Instanced spots={spots.neon} name="apron-neon">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.neon} emissive={COLORS.neon} emissiveIntensity={1.8} roughness={0.3} />
            </Instanced>
         ) : null}
      </group>
   );
}
