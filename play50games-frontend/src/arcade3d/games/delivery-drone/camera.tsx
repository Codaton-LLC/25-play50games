"use client";
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Fog } from "three";
import { followFocus } from "@/arcade3d/core/view";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { BOUNDS } from "./rules";

export const FOV = 45;
export const PITCH = Math.PI / 3;
export function viewFor(width: number, height: number, coarse = false): FittedViewOptions {
   const portrait = width < height;
   const phone = coarse || width < 600 || height < 500;
   const x = phone ? (portrait ? 3.5 : 6) : (portrait ? 6 : 10);
   const z = phone ? (portrait ? 3.5 : 2.25) : (portrait ? 6 : 4);
   const y = phone ? 2 : 3;
   return {
      area: { min: { x: -x, y: -y, z: -z }, max: { x, y, z } },
      pitch: PITCH, yaws: [0], fov: FOV, padding: phone ? 0.5 : 1, shift: true,
      focus: followFocus({ lookAt: [0, 0, 0], reach: { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 0, z: 2 } }, fraction: 1, bounds: BOUNDS }),
      margin: { top: 0.10, bottom: 0.08, left: 0.03, right: 0.03 },
   };
}
export function FittedFog({ distance }: { distance: number }) {
   const scene = useThree((s) => s.scene);
   const fog = useMemo(() => new Fog("#dbeafe", distance + 10, distance + 40), []);
   useEffect(() => { fog.near = distance + 10; fog.far = distance + 40; }, [distance, fog]);
   useEffect(() => { const previous = scene.fog; scene.fog = fog; return () => { if (scene.fog === fog) scene.fog = previous; }; }, [fog, scene]);
   return null;
}
