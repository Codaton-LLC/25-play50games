// The orbit camera (menu2/camera): its default pose is the card's table view, behind the drain and high
// over the flippers (yaw 0 looks up the table, toward -z), and the pivot slides a little after the ball
// so the whole table stays in view. Drag (two fingers on a phone, the right mouse button), pinch, Q / C
// turn and zoom it; the recenter button returns to the table view. Portrait phones sit higher and
// further back. The intro circles the table from the top arc down to the flippers.
import type { IntroKeyframe } from "@/arcade3d/core/intro";
import { orbitPosition, type OrbitSettings } from "@/arcade3d/menu2/camera/orbit";
import { tableToWorld, type Table } from "./table";

const DEG = Math.PI / 180;

export const TABLE_ORBIT: Partial<OrbitSettings> = {
   yaw: 0,
   pitch: 46 * DEG,
   distance: 19,
   minDistance: 8,
   maxDistance: 34,
   autoFollow: false,
};

export const FOV = 52;
export const FOV_PORTRAIT = 66;

export function portraitness(aspect: number): number {
   return Math.max(0, Math.min(1, (1.2 - aspect) / 0.7));
}

export function orbitScale(aspect: number): number {
   return 1 + 0.55 * portraitness(aspect);
}

/** How far the pivot follows the ball (0 = the table's middle, 1 = the ball). */
export const FOLLOW = 0.35;
/** The table point the pivot rests on. */
export const REST = { x: 0, z: -12 } as const;

/** The pivot (world): between the table's middle and the ball. */
export function orbitPivot(bx: number, bz: number, bh: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const x = REST.x + (bx - REST.x) * FOLLOW;
   const z = REST.z + (bz - REST.z) * FOLLOW;
   return tableToWorld(x, Math.min(bh, 1.6) * 0.4, z, out);
}

export function playCamera(_table: Table, aspect: number): IntroKeyframe {
   const p = orbitPivot(0, REST.z, 0, { x: 0, y: 0, z: 0 });
   const c = orbitPosition(p.x, p.y, p.z, TABLE_ORBIT.yaw ?? 0, TABLE_ORBIT.pitch ?? 0, (TABLE_ORBIT.distance ?? 19) * orbitScale(aspect), { x: 0, y: 0, z: 0 });
   return { position: [c.x, c.y, c.z], lookAt: [p.x, p.y, p.z] };
}

/** Round the table: the top arc, the bumpers from the side, then down over the flippers. */
export function introKeyframes(_table: Table): IntroKeyframe[] {
   const top = tableToWorld(0, 0, -22, { x: 0, y: 0, z: 0 });
   const mid = tableToWorld(0, 0, -14, { x: 0, y: 0, z: 0 });
   const low = tableToWorld(0, 0, -4, { x: 0, y: 0, z: 0 });
   return [
      { position: [top.x + 8, top.y + 7, top.z - 9], lookAt: [top.x, top.y, top.z] },
      { position: [mid.x - 12, mid.y + 6, mid.z + 2], lookAt: [mid.x, mid.y, mid.z] },
      { position: [low.x + 6, low.y + 6, low.z + 8], lookAt: [low.x, low.y, low.z] },
   ];
}

/** The shared multiplayer camera's yaw (behind the drain). */
export const MP_YAW = 0;
