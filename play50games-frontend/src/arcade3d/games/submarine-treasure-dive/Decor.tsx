"use client";

// Apron scenery outside the playable reef (looks.ts decorSpots). Visual only — never solid.
import { useMemo } from "react";
import { InstancedModel, Model } from "@/arcade3d/core/assets";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import type { LevelId } from "@/arcade3d/types";
import { ASSETS } from "./assets";
import { COLORS, LOOKS, decorSpots } from "./looks";
import { LEVELS } from "./levels";
import { ColumnPrimitive } from "./Primitives";

function take(list: readonly InstanceSpot[], n: number): InstanceSpot[] {
   return list.slice(0, Math.max(0, n));
}

/** Frames the reef without standing in the play box. Palette follows the level theme. */
export default function Decor({ id }: { id: LevelId }) {
   const quality = useQuality();
   const look = LOOKS[LEVELS[id].theme];
   const raw = useMemo(() => decorSpots(id), [id]);
   const rocks = useMemo(() => take(raw.rocks, scaledCount(raw.rocks.length, quality.decor)), [raw, quality.decor]);
   const coral = useMemo(() => take(raw.coral, scaledCount(raw.coral.length, quality.decor)), [raw, quality.decor]);
   const kelp = useMemo(() => take(raw.kelp, scaledCount(raw.kelp.length, quality.decor)), [raw, quality.decor]);
   const arches = useMemo(() => take(raw.arches, scaledCount(raw.arches.length, quality.decor)), [raw, quality.decor]);
   const wrecks = useMemo(() => take(raw.wrecks, scaledCount(raw.wrecks.length, quality.decor)), [raw, quality.decor]);
   const anchors = useMemo(() => take(raw.anchors, scaledCount(raw.anchors.length, quality.decor)), [raw, quality.decor]);
   const columns = raw.columns;

   return (
      <group name="reef-apron">
         {rocks.length > 0 && (
            <InstancedModel
               asset={ASSETS.aquariumRock}
               spots={rocks}
               fallback={
                  <Instanced spots={rocks} name="apron-rocks">
                     <sphereGeometry args={[0.5, 10, 8]} />
                     <meshStandardMaterial color={look.rock} roughness={0.88} />
                  </Instanced>
               }
            />
         )}
         {coral.length > 0 && (
            <InstancedModel
               asset={ASSETS.coral}
               spots={coral}
               fallback={
                  <Instanced spots={coral} name="apron-coral">
                     <sphereGeometry args={[0.5, 8, 6]} />
                     <meshStandardMaterial color={look.coral} roughness={0.55} />
                  </Instanced>
               }
            />
         )}
         {kelp.length > 0 && (
            <InstancedModel
               asset={ASSETS.seaweed}
               spots={kelp}
               fallback={
                  <Instanced spots={kelp} name="apron-kelp">
                     <cylinderGeometry args={[0.5, 0.35, 1, 6]} />
                     <meshStandardMaterial color={look.kelp} roughness={0.7} />
                  </Instanced>
               }
            />
         )}
         {arches.length > 0 && (
            <InstancedModel
               asset={ASSETS.rockArch}
               spots={arches}
               fallback={
                  <Instanced spots={arches} name="apron-arches">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={look.rockDark} roughness={0.82} />
                  </Instanced>
               }
            />
         )}
         {wrecks.length > 0 && (
            <InstancedModel
               asset={ASSETS.wreck}
               spots={wrecks}
               fallback={
                  <Instanced spots={wrecks} name="apron-wrecks">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.wreck} roughness={0.78} />
                  </Instanced>
               }
            />
         )}
         {anchors.length > 0 && (
            <InstancedModel
               asset={ASSETS.anchor}
               spots={anchors}
               fallback={
                  <Instanced spots={anchors} name="apron-anchors">
                     <boxGeometry args={[1, 1, 1]} />
                     <meshStandardMaterial color={COLORS.anchor} roughness={0.45} metalness={0.35} />
                  </Instanced>
               }
            />
         )}
         {columns.map((spot, index) => (
            <group key={index} position={[spot.x, spot.y ?? 0.44, spot.z]} rotation-y={spot.rotY ?? 0}>
               <group rotation-z={Math.PI / 2}>
                  <Model asset={ASSETS.ruinColumn} fallback={<ColumnPrimitive />} />
               </group>
            </group>
         ))}
      </group>
   );
}
