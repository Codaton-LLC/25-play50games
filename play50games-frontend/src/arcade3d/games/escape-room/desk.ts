// The two desk stations: 0 is a drawer, 2 a box under the desk. The desk top (the shared desk,
// stretched to the 1.2 x 1.4 body in assets.ts) hides everything under it from the fitted camera,
// so both parts slide out past the desk's room-side edge while they open and show their loot there.
// Plain numbers in the station's frame (x toward the room = `toward` * x): Primitives.tsx draws
// them, look.test.ts ray-tests the same values. Collision never changes: it comes from rules.ts.
import { STATION_BODY } from "./rules";

/** The shared desk's top in a station (a downward ray in the browser hit it at y 0.537). */
export const DESK_TOP_Y = 0.54;
/** The desk's footprint: the station body. */
export const DESK_HALF_X = STATION_BODY.halfX;
export const DESK_HALF_Z = STATION_BODY.halfZ;

export const DRAWER = {
   size: [0.45, 0.16, 0.7] as [number, number, number],
   y: 0.32,
   /** closed: the centre this far toward the room from the body's centre; open: + travel */
   x: 0.45,
   travel: 0.42,
   lootY: 0.14,
} as const;

export const UNDER_DESK = {
   size: [0.4, 0.28, 0.55] as [number, number, number],
   y: 0.16,
   /** closed under the desk; open, the whole box is past the desk's edge (0.6): 0.82 - 0.2 = 0.62 */
   x: 0.2,
   travel: 0.62,
   /** the loot stands on the box's top, where the lid was */
   lootY: 0.14,
   lidThick: 0.04,
   /** the lid's swing about its back edge (away from the camera): a little past upright */
   lidOpen: 1.9,
} as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

/** Share of the box's slide for an open amount 0..1: all of it in the first 60%. */
export function underDeskSlide(open: number): number {
   return smooth(open / 0.6);
}

/** Share of the lid's swing: only once the box is out from under the desk top (the last 40%). */
export function underDeskLid(open: number): number {
   return smooth((open - 0.6) / 0.4);
}

/** The box's centre x (toward the room) for an open amount 0..1. */
export function underDeskX(open: number): number {
   return UNDER_DESK.x + UNDER_DESK.travel * underDeskSlide(open);
}

/** The drawer's centre x (toward the room) for an open amount 0..1. */
export function drawerX(open: number): number {
   return DRAWER.x + DRAWER.travel * clamp01(open);
}
