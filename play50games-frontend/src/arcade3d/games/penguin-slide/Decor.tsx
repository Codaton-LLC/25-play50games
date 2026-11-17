"use client";

import { useEffect, useMemo } from "react";
import {
   ConeGeometry,
   CylinderGeometry,
   DodecahedronGeometry,
   IcosahedronGeometry,
   Matrix4,
   MeshStandardMaterial,
   Quaternion,
   SphereGeometry,
   Vector3,
} from "three";
import { useGameTime } from "@/arcade3d/core/gameTime";
import { scaledCount, useQuality } from "@/arcade3d/core/quality";
import { DynamicInstanced, Instanced, type InstancePart, type InstanceSpot } from "@/arcade3d/core/render";
import { SCENERY, createTrackFrame, groundY, sceneryS, toView, trackEnd, trackFrame, type Point3 } from "./ground";
import { CLOUD_DRIFT, COLORS, THEMES, decorOf, type DecorSpot, type SlideTheme } from "./looks";
import { COURSE, chunkAt, corridorAt, type Run } from "./rules";

function asSpots(list: readonly DecorSpot[]): InstanceSpot[] {
   return list.map((spot) => ({
      x: spot.x,
      y: spot.y,
      z: spot.z,
      rotY: spot.rotY,
      sx: spot.sx,
      sy: spot.sy,
      sz: spot.sz,
   }));
}

interface SceneryScratch {
   frame: ReturnType<typeof createTrackFrame>;
   p: Point3;
   t: Point3;
   q: Point3;
   view: Point3;
   at: Vector3;
   quat: Quaternion;
   scale: Vector3;
   up: Vector3;
}

/**
 * Writes copy `i` of a scrolling scenery pool: spot `i % spots.length`, copy `floor(i / spots.length)`,
 * laid at its track distance (ground.ts sceneryS) and its lateral offset from the corridor, on the
 * snow, turned with the track. False hides a copy past the generated chunks. No allocation.
 */
export function placeScenery(run: Run, spots: readonly DecorSpot[], i: number, m: Matrix4, k: SceneryScratch): boolean {
   const spot = spots[i % spots.length];
   const copy = Math.floor(i / spots.length);
   const s = sceneryS(-spot.z, copy, run.s);
   if (s < run.chunks[0].index * COURSE.chunk || s >= trackEnd(run) - 0.01) return false;
   const frame = trackFrame(run, k.frame, k.p, k.t);
   const c = chunkAt(run, s);
   const local = s - c.index * COURSE.chunk;
   const d = corridorAt(c, local) + spot.x;
   const y = groundY(c, local, d, k.p, k.t, k.q);
   toView(frame, k.p.x, y, k.p.z, k.view);
   const yaw = Math.atan2(k.t.x, k.t.z);
   k.at.set(k.view.x, k.view.y + spot.y, k.view.z);
   k.quat.setFromAxisAngle(k.up, frame.yaw - yaw + spot.rotY);
   k.scale.set(spot.sx, spot.sy, spot.sz);
   m.compose(k.at, k.quat, k.scale);
   return true;
}

/**
 * Instanced arctic decor surrounding the play area:
 * Faceted ice spires, soft snow drifts, snow-capped arctic rocks,
 * distant glacier cliffs, horizon mountain peaks, and drifting arctic clouds.
 * All positioned strictly outside the active play bounds.
 */
export function Decor({ run, reduced, theme = THEMES.snowHill }: { run: Run; reduced: boolean; theme?: SlideTheme }) {
   const quality = useQuality();
   const time = useGameTime();

   const geo = useMemo(() => {
      // 1. Ice spire: faceted crystalline obelisk
      const spire = new CylinderGeometry(0.12, 0.75, 3.2, 5).translate(0, 1.6, 0);

      // 2. Snow drift: low-poly soft mound
      const drift = new SphereGeometry(1, 8, 6).scale(1.4, 0.45, 1).translate(0, 0.45, 0);

      // 3. Rock: low-poly slate boulder + snow cap
      const rock = new DodecahedronGeometry(0.55, 0).translate(0, 0.35, 0);
      const rockSnow = new SphereGeometry(0.38, 7, 5).scale(1.1, 0.45, 1.1).translate(0, 0.68, 0);

      // 4. Distant glacier: towering crystalline ice ridge
      const glacier = new CylinderGeometry(0.55, 1.25, 1.5, 5).translate(0, 0.75, 0);

      // 5. Mountain: dark rock peak + snow top
      const mountain = new ConeGeometry(1.2, 2.2, 4).translate(0, 1.1, 0);
      const mountainSnow = new ConeGeometry(0.65, 1.1, 4).translate(0, 1.65, 0);

      // 6. Cloud: low-poly puffy cloud
      const cloud = new IcosahedronGeometry(1, 0).scale(1.8, 0.7, 1.2);

      return {
         spire,
         drift,
         rock,
         rockSnow,
         glacier,
         mountain,
         mountainSnow,
         cloud,
      };
   }, []);

   // Clean disposal on unmount.
   // Never put dispose={null} on <primitive attach="geometry"> (R3F v8 bug).
   useEffect(() => () => {
      for (const geometry of Object.values(geo)) geometry.dispose();
   }, [geo]);

   // side scenery: scrolls with the track (placeScenery), SCENERY.copies copies of every spot
   const spires = useMemo(() => decorOf("spire").slice(0, scaledCount(decorOf("spire").length, quality.decor)), [quality.decor]);
   const drifts = useMemo(() => decorOf("drift").slice(0, scaledCount(decorOf("drift").length, quality.decor)), [quality.decor]);
   const rocks = useMemo(() => decorOf("rock").slice(0, scaledCount(decorOf("rock").length, quality.decor)), [quality.decor]);
   const scenery = useMemo<SceneryScratch>(() => ({
      frame: createTrackFrame(),
      p: { x: 0, y: 0, z: 0 },
      t: { x: 0, y: 0, z: 0 },
      q: { x: 0, y: 0, z: 0 },
      view: { x: 0, y: 0, z: 0 },
      at: new Vector3(),
      quat: new Quaternion(),
      scale: new Vector3(),
      up: new Vector3(0, 1, 0),
   }), []);
   const materials = useMemo(() => ({
      spire: new MeshStandardMaterial({ color: COLORS.spireBody, flatShading: true, roughness: 0.24, metalness: 0.08 }),
      drift: new MeshStandardMaterial({ color: COLORS.snowSoft, flatShading: true, roughness: 0.9 }),
      rock: new MeshStandardMaterial({ color: COLORS.rockFace, flatShading: true, roughness: 0.85 }),
      rockSnow: new MeshStandardMaterial({ color: COLORS.rockSnow, flatShading: true, roughness: 0.92 }),
   }), []);
   useEffect(() => () => {
      for (const material of Object.values(materials)) material.dispose();
   }, [materials]);
   const spireParts = useMemo<InstancePart[]>(() => [{ geometry: geo.spire, material: materials.spire }], [geo, materials]);
   const driftParts = useMemo<InstancePart[]>(() => [{ geometry: geo.drift, material: materials.drift }], [geo, materials]);
   const rockParts = useMemo<InstancePart[]>(
      () => [{ geometry: geo.rock, material: materials.rock }, { geometry: geo.rockSnow, material: materials.rockSnow }],
      [geo, materials]
   );
   const placeSpire = (i: number, m: Matrix4) => placeScenery(run, spires, i, m, scenery);
   const placeDrift = (i: number, m: Matrix4) => placeScenery(run, drifts, i, m, scenery);
   const placeRock = (i: number, m: Matrix4) => placeScenery(run, rocks, i, m, scenery);
   const glaciers = useMemo(
      () => asSpots(decorOf("glacier").slice(0, scaledCount(decorOf("glacier").length, quality.decor))),
      [quality.decor]
   );
   const mountains = useMemo(
      () => asSpots(decorOf("mountain").slice(0, scaledCount(decorOf("mountain").length, quality.decor))),
      [quality.decor]
   );
   const clouds = useMemo(() => decorOf("cloud"), []);

   const scratch = useMemo(() => ({
      p: new Vector3(),
      q: new Quaternion(),
      s: new Vector3(),
   }), []);

   const placeCloud = (i: number, m: Matrix4) => {
      const c = clouds[i];
      const drift = reduced ? 0 : Math.sin(time.now * 0.12 + i * 1.5) * CLOUD_DRIFT;
      scratch.p.set(c.x + drift, c.y, c.z);
      scratch.q.identity();
      scratch.s.set(c.sx, c.sy, c.sz);
      m.compose(scratch.p, scratch.q, scratch.s);
   };

   return (
      <group name="arctic-decor">
         {/* Ice spires, snow drifts and rocks beside the track: they scroll with it and recycle ahead */}
         {theme.spires && spires.length > 0 && (
            <DynamicInstanced count={spires.length * SCENERY.copies} update={placeSpire} parts={spireParts} name="ice-spires" />
         )}
         {drifts.length > 0 && (
            <DynamicInstanced count={drifts.length * SCENERY.copies} update={placeDrift} parts={driftParts} name="snow-drifts" />
         )}
         {rocks.length > 0 && (
            <DynamicInstanced count={rocks.length * SCENERY.copies} update={placeRock} parts={rockParts} name="arctic-rocks" />
         )}

         {/* Distant glacier ridges */}
         {glaciers.length > 0 && (
            <Instanced spots={glaciers} name="distant-glaciers">
               <primitive object={geo.glacier} attach="geometry" />
               <meshStandardMaterial color={COLORS.glacierIce} flatShading roughness={0.32} metalness={0.06} />
            </Instanced>
         )}

         {/* Horizon mountains: rock face + snow peak */}
         {theme.mountains && mountains.length > 0 && (
            <>
               <Instanced spots={mountains} name="horizon-mountains-rock">
                  <primitive object={geo.mountain} attach="geometry" />
                  <meshStandardMaterial color={COLORS.mountainRock} flatShading roughness={0.95} />
               </Instanced>
               <Instanced spots={mountains} name="horizon-mountains-snow">
                  <primitive object={geo.mountainSnow} attach="geometry" />
                  <meshStandardMaterial color={COLORS.mountainPeak} flatShading roughness={0.9} />
               </Instanced>
            </>
         )}

         {/* Drifting high arctic clouds */}
         {theme.clouds && (
            <DynamicInstanced count={clouds.length} update={placeCloud} name="arctic-clouds">
               <primitive object={geo.cloud} attach="geometry" />
               <meshStandardMaterial color={COLORS.cloud} flatShading roughness={0.95} />
            </DynamicInstanced>
         )}
      </group>
   );
}
