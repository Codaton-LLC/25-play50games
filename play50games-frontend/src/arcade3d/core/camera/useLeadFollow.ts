"use client";
// A live follow point for CameraRig on a portrait screen: the hero plus a look-ahead (leadPoint),
// written every frame after the simulation and before CameraRig. Landscape gets the hero itself.
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import { FRAME_PRIORITY } from "../frameLoop";
import type { Vec3Like } from "../collision";
import { leadPoint, type Offset } from "./portraitFollow";

export function useLeadFollow(hero: Vec3Like, offset: Offset, lead: number, lift: number, active: boolean): Vec3Like {
   const [point] = useState(() => ({ x: hero.x, y: hero.y, z: hero.z }));
   leadPoint(hero, offset, active ? lead : 0, active ? lift : 0, point);
   useFrame(() => {
      leadPoint(hero, offset, active ? lead : 0, active ? lift : 0, point);
   }, FRAME_PRIORITY.camera - 0.01);
   return active ? point : hero;
}
