// One palette, the follow camera and the lawn decor. Pure: no React, no three.js.
// Decor is built at unit size and scaled per spot (InstanceSpot), so one geometry serves every piece.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type DogLevel } from "./levels";
import { blanketOf, type Prop } from "./rules";

export const COLORS = {
   lawn: "#65a30d",
   stripe: "#84cc16",
   path: "#d6d3d1",
   blanket: "#f59e0b",
   blanketEdge: "#fde68a",
   sand: "#f2d7a6",
   fence: "#f5f5f4",
   fenceCap: "#d6d3d1",
   dog: "#d6a15b",
   dogDark: "#92400e",
   dogNose: "#1c1917",
   owner: "#e7e5e4",
   ball: "#d9f99d",
   ballLine: "#f8fafc",
   stick: "#a16207",
   frisbee: "#f97316",
   frisbeeRim: "#fdba74",
   mower: "#dc2626",
   mowerDark: "#7f1d1d",
   fountain: "#cbd5e1",
   fountainWater: "#7dd3fc",
   bench: "#92400e",
   tree: "#166534",
   trunk: "#78350f",
   target: "#fbbf24",
} as const;

export const PITCH = (55 * Math.PI) / 180;
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 46;
export const FOLLOW = 0.6;
export const LOOK_AHEAD = 2;
export const DAMPING = 4;

export function lawnBox(level: DogLevel): AABB {
   return {
      min: { x: -level.width / 2 - 0.4, y: 0, z: -level.depth / 2 - 0.4 },
      max: { x: level.width / 2 + 0.4, y: 2.5, z: level.depth / 2 + 0.4 },
   };
}

export function lookAtFor(level: DogLevel): [number, number, number] {
   return [0, 0.4, blanketOf(level).z / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The whole lawn in frame on level 1, the dog and its blanket in view on the bigger ones. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = lawnBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.03, right: 0.02, bottom: 0.05, left: 0.02 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** The picket fence: one instanced picket every metre and a half around the lawn. */
export function fenceSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const h = 1.1;
   const hw = level.width / 2;
   const hd = level.depth / 2;
   const step = 1.2;
   const add = (x: number, z: number) => spots.push({ x, y: h / 2, z, sx: 0.08, sy: h, sz: 0.08 });
   for (let x = -hw; x <= hw + 1e-9; x += step) {
      add(x, -hd);
      add(x, hd);
   }
   for (let z = -hd; z <= hd + 1e-9; z += step) {
      add(-hw, z);
      add(hw, z);
   }
   return spots;
}

/** Mowing stripes: thin lighter strips along z, one per two metres. */
export function stripeSpots(level: DogLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let x = -level.width / 2 + 1; x < level.width / 2; x += 2) {
      spots.push({ x, y: 0.004, z: 0, sx: 0.9, sy: 0.008, sz: level.depth });
   }
   return spots;
}

/** The sand strip along the south edge on the beach park (L4). */
export function sandSpots(level: DogLevel): InstanceSpot[] {
   return [{ x: 0, y: 0.006, z: level.depth / 2 - 0.9, sx: level.width, sy: 0.012, sz: 1.8 }];
}

/** A flat blanket disc at the south centre, drawn as a unit cylinder scaled to the pad. */
export function blanketSpot(level: DogLevel): InstanceSpot {
   const b = blanketOf(level);
   return { x: b.x, y: 0.01, z: b.z, sx: 1.5 * 2, sy: 0.02, sz: 1.5 * 2 };
}

export function propSpots(props: readonly Prop[]): InstanceSpot[] {
   return props.map((p) => ({ x: p.x, y: 0, z: p.z, sx: p.r * 2, sy: 0.6, sz: p.r * 2 }));
}
