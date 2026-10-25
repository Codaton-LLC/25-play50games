"use client";

// Surroundings outside the play area: factory walls, structural pillars, pipes, diagnostic screens,
// stacks of component crates, overhead catwalks, and idle robot arms at side workstations.
// All rendered via core <Instanced> (one draw call per kind). Built once; no per-frame allocations.
import { useEffect, useMemo } from "react";
import {
   BoxGeometry,
   BufferAttribute,
   Color,
   CylinderGeometry,
   SphereGeometry,
   type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { Instanced, type InstanceSpot } from "@/arcade3d/core/render";
import { COLORS, decorOf, type DecorSpot } from "./looks";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotX: spot.rotX,
      rotY: spot.rotY,
      rotZ: spot.rotZ,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

function tone(geometry: BufferGeometry, color: string): BufferGeometry {
   const flat = geometry.index ? geometry.toNonIndexed() : geometry;
   if (flat !== geometry) geometry.dispose();
   const c = new Color(color);
   const n = flat.getAttribute("position").count;
   const colors = new Float32Array(n * 3);
   for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
   flat.setAttribute("color", new BufferAttribute(colors, 3));
   return flat;
}

function buildPillarGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Main vertical column
      tone(new BoxGeometry(0.36, 5.2, 0.36), COLORS.steelDark),
      // Base mounting plate
      tone(new BoxGeometry(0.55, 0.08, 0.55).translate(0, -2.56, 0), COLORS.frame),
      // Mid-level structural bracket
      tone(new BoxGeometry(0.44, 0.12, 0.44).translate(0, 0.2, 0), COLORS.steelMid),
      // Top ceiling beam bracket
      tone(new BoxGeometry(0.52, 0.14, 0.52).translate(0, 2.53, 0), COLORS.steel),
      // Accent beacon housing
      tone(new BoxGeometry(0.12, 0.08, 0.12).translate(0, 1.8, 0.2), COLORS.rim),
   ];
   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

function buildPipeGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Main conduit pipe body
      tone(new CylinderGeometry(0.12, 0.12, 1.0, 18), COLORS.steelMid),
      // Raised connector flange collar
      tone(new CylinderGeometry(0.15, 0.15, 0.08, 18).translate(0, 0.35, 0), COLORS.pipe),
      tone(new CylinderGeometry(0.15, 0.15, 0.08, 18).translate(0, -0.35, 0), COLORS.pipe),
      // Retaining ring
      tone(new CylinderGeometry(0.135, 0.135, 0.04, 18), COLORS.steelDark),
   ];
   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

function buildScreenGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Bevelled monitor housing
      tone(new RoundedBoxGeometry(1.4, 0.85, 0.08, 2, 0.03), COLORS.steelDark),
      // Recessed screen display panel
      tone(new BoxGeometry(1.24, 0.7, 0.02).translate(0, 0, 0.045), COLORS.screen),
      // Top diagnostic graph line (cyan)
      tone(new BoxGeometry(0.9, 0.035, 0.01).translate(-0.1, 0.2, 0.055), COLORS.rim),
      tone(new BoxGeometry(0.2, 0.035, 0.01).translate(0.48, 0.2, 0.055), COLORS.good),
      // Mid telemetry bars
      tone(new BoxGeometry(0.7, 0.04, 0.01).translate(-0.2, 0.06, 0.055), COLORS.steel),
      tone(new BoxGeometry(0.35, 0.04, 0.01).translate(0.38, 0.06, 0.055), COLORS.warn),
      // Bottom data readouts
      tone(new BoxGeometry(0.5, 0.03, 0.01).translate(-0.3, -0.12, 0.055), COLORS.rim),
      tone(new BoxGeometry(0.45, 0.03, 0.01).translate(0.3, -0.12, 0.055), COLORS.screenText),
      // Wall mounting bracket arm
      tone(new BoxGeometry(0.15, 0.2, 0.14).translate(0, 0, -0.1), COLORS.frame),
   ];
   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

function buildCrateGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Main cargo crate body with rounded edges
      tone(new RoundedBoxGeometry(0.72, 0.52, 0.72, 2, 0.03), COLORS.frame),
      // Recessed side panel inserts (darker tone)
      tone(new BoxGeometry(0.56, 0.38, 0.74), COLORS.steelDark),
      tone(new BoxGeometry(0.74, 0.38, 0.56), COLORS.steelDark),
      // Reinforced corner brackets
      tone(new BoxGeometry(0.73, 0.06, 0.73).translate(0, 0.23, 0), COLORS.steel),
      tone(new BoxGeometry(0.73, 0.06, 0.73).translate(0, -0.23, 0), COLORS.steel),
      // Yellow hazard identification stripe
      tone(new BoxGeometry(0.735, 0.05, 0.45).translate(0, 0, 0), COLORS.hazard),
   ];
   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

function buildCatwalkGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Grated deck floor
      tone(new RoundedBoxGeometry(3.95, 0.06, 0.9, 1, 0.015), COLORS.catwalk),
      // Under-deck structural I-beam channel
      tone(new BoxGeometry(3.95, 0.14, 0.06).translate(0, -0.09, -0.4), COLORS.steelDark),
      tone(new BoxGeometry(3.95, 0.14, 0.06).translate(0, -0.09, 0.4), COLORS.steelDark),
      // End cross-supports
      tone(new BoxGeometry(0.06, 0.14, 0.86).translate(-1.95, -0.09, 0), COLORS.steelMid),
      tone(new BoxGeometry(0.06, 0.14, 0.86).translate(1.95, -0.09, 0), COLORS.steelMid),
   ];
   // Front safety railing posts and handrails
   const railZ = 0.42;
   const postCount = 5;
   for (let i = 0; i < postCount; i++) {
      const x = -1.9 + (3.8 * i) / (postCount - 1);
      parts.push(tone(new BoxGeometry(0.035, 0.85, 0.035).translate(x, 0.43, railZ), COLORS.steel));
   }
   // Top handrail (hazard yellow)
   parts.push(tone(new BoxGeometry(3.95, 0.035, 0.035).translate(0, 0.84, railZ), COLORS.hazard));
   // Mid knee-rail
   parts.push(tone(new BoxGeometry(3.95, 0.025, 0.025).translate(0, 0.45, railZ), COLORS.steel));
   // Toe board kick-plate
   parts.push(tone(new BoxGeometry(3.95, 0.08, 0.02).translate(0, 0.07, railZ), COLORS.steelDark));

   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

function buildRobotArmGeometry(): BufferGeometry {
   const parts: BufferGeometry[] = [
      // Heavy pedestal base
      tone(new CylinderGeometry(0.26, 0.3, 0.32, 20).translate(0, 0.16, 0), COLORS.steelDark),
      // Rotating shoulder base ring
      tone(new CylinderGeometry(0.2, 0.2, 0.14, 18).translate(0, 0.39, 0), COLORS.steel),
      // Shoulder pivot joint knuckle
      tone(new SphereGeometry(0.14, 14, 12).translate(0, 0.52, 0), COLORS.steelDark),
      // Lower boom beam (angled up and forward)
      tone(
         new RoundedBoxGeometry(0.11, 0.65, 0.12, 1, 0.02)
            .rotateZ(-0.35)
            .translate(0.12, 0.78, 0),
         COLORS.steelMid
      ),
      // Elbow joint actuator
      tone(new SphereGeometry(0.11, 14, 12).translate(0.25, 1.05, 0), COLORS.joint),
      // Forearm beam (angled down towards workstation)
      tone(
         new RoundedBoxGeometry(0.09, 0.58, 0.1, 1, 0.02)
            .rotateZ(0.55)
            .translate(0.38, 0.85, 0),
         COLORS.steelMid
      ),
      // Wrist collar
      tone(new CylinderGeometry(0.065, 0.065, 0.08, 14).translate(0.52, 0.64, 0), COLORS.steel),
      // End-effector gripper fingers (yellow hazard alert)
      tone(new BoxGeometry(0.035, 0.14, 0.04).translate(0.48, 0.53, 0.04), COLORS.hazard),
      tone(new BoxGeometry(0.035, 0.14, 0.04).translate(0.56, 0.53, -0.04), COLORS.hazard),
      // Status optical sensor
      tone(new SphereGeometry(0.025, 8, 8).translate(0.52, 0.58, 0.06), COLORS.rim),
   ];
   const merged = mergeGeometries(parts, false)!;
   for (const p of parts) p.dispose();
   return merged;
}

export function Decor() {
   const quality = useQuality();
   const geo = useMemo(
      () => ({
         pillar: buildPillarGeometry(),
         pipe: buildPipeGeometry(),
         screen: buildScreenGeometry(),
         crate: buildCrateGeometry(),
         catwalk: buildCatwalkGeometry(),
         robotArm: buildRobotArmGeometry(),
      }),
      []
   );

   // Proper geometry disposal on unmount (no dispose={null} on primitives!)
   useEffect(
      () => () => {
         for (const g of Object.values(geo)) g.dispose();
      },
      [geo]
   );

   const pillars = useMemo(
      () => asSpots(decorOf("pillar").slice(0, scaledCount(decorOf("pillar").length, quality.decor))),
      [quality.decor]
   );
   const pipes = useMemo(
      () => asSpots(decorOf("pipe").slice(0, scaledCount(decorOf("pipe").length, quality.decor))),
      [quality.decor]
   );
   const screens = useMemo(
      () => asSpots(decorOf("screen").slice(0, scaledCount(decorOf("screen").length, quality.decor))),
      [quality.decor]
   );
   const crates = useMemo(
      () => asSpots(decorOf("crate").slice(0, scaledCount(decorOf("crate").length, quality.decor))),
      [quality.decor]
   );
   const catwalks = useMemo(
      () => asSpots(decorOf("catwalk").slice(0, scaledCount(decorOf("catwalk").length, quality.decor))),
      [quality.decor]
   );
   const robotArms = useMemo(
      () => asSpots(decorOf("robotArm").slice(0, scaledCount(decorOf("robotArm").length, quality.decor))),
      [quality.decor]
   );

   return (
      <group name="factory-decor">
         {pillars.length > 0 && (
            <Instanced spots={pillars} name="decor-pillars">
               <primitive object={geo.pillar} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.52} metalness={0.4} />
            </Instanced>
         )}
         {pipes.length > 0 && (
            <Instanced spots={pipes} name="decor-pipes">
               <primitive object={geo.pipe} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.42} metalness={0.45} />
            </Instanced>
         )}
         {screens.length > 0 && (
            <Instanced spots={screens} name="decor-screens">
               <primitive object={geo.screen} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.35} metalness={0.3} />
            </Instanced>
         )}
         {crates.length > 0 && (
            <Instanced spots={crates} name="decor-crates">
               <primitive object={geo.crate} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.48} metalness={0.35} />
            </Instanced>
         )}
         {catwalks.length > 0 && (
            <Instanced spots={catwalks} name="decor-catwalks">
               <primitive object={geo.catwalk} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.55} metalness={0.4} />
            </Instanced>
         )}
         {robotArms.length > 0 && (
            <Instanced spots={robotArms} name="decor-robot-arms">
               <primitive object={geo.robotArm} attach="geometry" />
               <meshStandardMaterial vertexColors roughness={0.42} metalness={0.45} />
            </Instanced>
         )}
      </group>
   );
}
