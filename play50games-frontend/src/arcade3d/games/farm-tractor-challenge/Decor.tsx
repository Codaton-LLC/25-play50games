"use client";

// Apron scenery outside the fenced yard (looks.scenerySpots). Visual only: never solids.
import { useMemo } from "react";
import { Instanced } from "@/arcade3d/core/render";
import { Model } from "@/arcade3d/core/assets";
import { ASSETS } from "./assets";
import type { FarmLevel } from "./levels";
import { COLORS, lookFor, scenerySpots } from "./looks";
import { ScarecrowPrimitive, SiloPrimitive, TroughPrimitive } from "./Primitives";

/** Frames the yard without standing in the play area. Palette follows the level theme. */
export default function Decor({ level }: { level: FarmLevel }) {
   const look = lookFor(level);
   const spots = useMemo(() => scenerySpots(level), [level]);
   const blossom = look.scenery === "orchard" || look.scenery === "mega";

   return (
      <group name="farm-apron">
         {spots.wheatStems.length > 0 ? (
            <Instanced spots={spots.wheatStems} name="wheat-stems">
               <cylinderGeometry args={[0.5, 0.55, 1, 6]} />
               <meshStandardMaterial color={COLORS.wheatStem} roughness={0.85} />
            </Instanced>
         ) : null}
         {spots.wheatHeads.length > 0 ? (
            <Instanced spots={spots.wheatHeads} name="wheat-heads">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.wheat} roughness={0.7} />
            </Instanced>
         ) : null}
         {spots.trees.length > 0 ? (
            <>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: 0.7 * (t.scale ?? 1), z: t.z, rotY: t.rotY ?? 0,
                     sx: 0.4 * (t.scale ?? 1), sy: 1.4 * (t.scale ?? 1), sz: 0.4 * (t.scale ?? 1),
                  }))}
                  name="apron-trunks"
               >
                  <cylinderGeometry args={[0.5, 0.55, 1, 8]} />
                  <meshStandardMaterial color={COLORS.trunk} roughness={0.85} />
               </Instanced>
               <Instanced
                  spots={spots.trees.map((t) => ({
                     x: t.x, y: 2.1 * (t.scale ?? 1), z: t.z, rotY: t.rotY ?? 0,
                     sx: 1.5 * (t.scale ?? 1), sy: 1.8 * (t.scale ?? 1), sz: 1.5 * (t.scale ?? 1),
                  }))}
                  name="apron-canopies"
               >
                  <sphereGeometry args={[0.5, 10, 8]} />
                  <meshStandardMaterial color={look.leaf} roughness={0.72} />
               </Instanced>
               {blossom ? (
                  <Instanced
                     spots={spots.trees.map((t) => ({
                        x: t.x + 0.35, y: 2.35 * (t.scale ?? 1), z: t.z + 0.2, rotY: t.rotY ?? 0,
                        sx: 0.55 * (t.scale ?? 1), sy: 0.5 * (t.scale ?? 1), sz: 0.55 * (t.scale ?? 1),
                     }))}
                     name="apron-blossoms"
                  >
                     <sphereGeometry args={[0.5, 8, 6]} />
                     <meshStandardMaterial color={COLORS.blossom} roughness={0.55} />
                  </Instanced>
               ) : null}
            </>
         ) : null}
         {spots.hayStacks.length > 0 ? (
            <Instanced spots={spots.hayStacks} name="apron-hay">
               <cylinderGeometry args={[0.5, 0.55, 1, 10]} />
               <meshStandardMaterial color={COLORS.hay} roughness={0.8} />
            </Instanced>
         ) : null}
         {spots.crates.length > 0 ? (
            <Instanced spots={spots.crates} name="apron-crates">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.crate} roughness={0.65} />
            </Instanced>
         ) : null}
         {spots.planks.length > 0 ? (
            <Instanced spots={spots.planks} name="apron-planks">
               <boxGeometry args={[1, 1, 1]} />
               <meshStandardMaterial color={COLORS.fencePost} roughness={0.8} />
            </Instanced>
         ) : null}
         {spots.silos.map((s, i) => (
            <Model key={`apron-silo-${i}`} asset={ASSETS.silo} position={[s.x, 0, s.z]} scale={s.scale ?? 1} fallback={<SiloPrimitive />} />
         ))}
         {spots.scarecrows.map((s, i) => (
            <Model key={`apron-scare-${i}`} asset={ASSETS.scarecrow} position={[s.x, 0, s.z]} scale={s.scale ?? 1} fallback={<ScarecrowPrimitive />} />
         ))}
         {spots.troughs.map((s, i) => (
            <Model key={`apron-trough-${i}`} asset={ASSETS.trough} position={[s.x, 0, s.z]} scale={s.scale ?? 1} fallback={<TroughPrimitive />} />
         ))}
      </group>
   );
}
