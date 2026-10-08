// The order markers (looks only, README "Order markers"): which pallets show them, how high the
// arrow floats for the camera, how it bounces and tucks away, how the floor frame pulses. Pure, no
// three.js or React, so Scene.tsx, Primitives.tsx (the textures) and marker.test.ts share it. The
// rules never read it.
import { BOX, LID_LETTER } from "./assets";
import { NONE, PALLET_HALF, PALLET_HEIGHT, inReach, type WarehouseRun } from "./rules";

/** The top of a box's lid on its pallet (m). */
export const LID_TOP = PALLET_HEIGHT + BOX.height;
/** A pallet's box is turned by at most this much (rad, Scene.tsx BOX_TURN), so it does not look machine-placed. */
export const BOX_TURN_MAX = 0.09;

/**
 * The arrow: a bold down arrow with a dark outline on a camera-facing quad (a billboard), in the
 * order colour. Its anchor is the tip (the middle of the quad's bottom edge), straight over the
 * pallet's centre, as low as the camera allows while the whole arrow stays above the box
 * (`clearTipY`). The pop-in scales box and arrow together about the pallet's top, so the arrow
 * rises out of its box; tucking away shrinks the arrow into its tip.
 */
export const ARROW = {
   /** quad size, m (the texture has the same aspect, Primitives.tsx ARROW_TEXTURE) */
   width: 0.85,
   height: 0.8,
   /** the gap on screen between the box (its lid letter included) and the arrow at the bottom of its bounce, m at the box */
   gap: 0.12,
   /** bounce height (m) and bounces per second */
   bounce: 0.12,
   rate: 1.25,
   /** seconds to tuck away (or come back) when the robot enters (or leaves) the pallet's reach */
   tuckS: 0.15,
} as const;

/**
 * The arrow's shape on its texture (Primitives.tsx drawArrow), so marker.test.ts can project the
 * arrow itself rather than its whole quad: outline width and shaft half-width as fractions of the
 * texture's width, the neck (where the head starts) as a fraction of its height from the top.
 */
export const ARROW_SHAPE = { line: 0.12, shaft: 0.18, neck: 0.46 } as const;

/** The floor frame: a rounded square ring around the pallet, over its bay marks. */
export const RING = {
   /** outer half-size (m): 0.4 beyond the pallet's edge, past its 0.85 bay corner marks */
   half: PALLET_HALF + 0.4,
   /** band width (m), dark edges included */
   band: 0.28,
   /** over the floor (the blob shadow is at 0.012), under every prop */
   y: 0.018,
   /** opacity at the tap and at the top of the bounce */
   opacityTap: 1,
   opacityRest: 0.7,
   /** extra scale at the tap */
   swell: 0.05,
} as const;

/**
 * Does pallet `i` show the order markers? Only while the robot is empty-handed, and only over a box
 * of the order colour (so never over an empty pallet).
 */
export function marked(run: WarehouseRun, i: number): boolean {
   if (run.carrying !== NONE) return false;
   const box = run.pallets[i].box;
   return box !== NONE && box === run.order;
}

/** Is the robot in pallet `i`'s reach (the rules' own test: an Action now picks its box)? The arrow tucks away then. */
export function robotAtPallet(run: WarehouseRun, i: number): boolean {
   return inReach(run.robot.x, run.robot.z, run.pallets[i].bounds);
}

/**
 * The robot as the arrow could cover it (m): a column 1.2 m tall whose body and hanging arms lie
 * within 0.3 m of its centre, and the lead: the arrow tucks away while the robot is within this much
 * of a spot where it would be covered (at 6 m/s the robot crosses 0.3 m in 0.05 s, a third of the tuck).
 */
export const ROBOT_COLUMN = { radius: 0.3, height: 1.2, lead: 0.3 } as const;

/**
 * Would pallet (palletX, palletZ)'s arrow, its tip at `clearY` (clearTipY) anywhere in its bounce, be
 * drawn over the robot at (robotX, robotZ)? The arrow is a billboard over the pallet's centre: nearer
 * the camera than a robot just behind the box, and drawn later, so it covers the robot wherever their
 * outlines meet on screen with the robot farther away. In landscape that is the central aisle between
 * the racks and the near row, the main path and the way to a near-row box. Screen rectangles in
 * slopes ((p · right, p · up) / (p · forward)): the arrow's quad over its whole bounce, and the robot's
 * column grown by its radius and ROBOT_COLUMN.lead at its nearest depth. marker.test.ts projects the
 * drawn arrow and the column's true outline through every fitted camera and checks that every spot
 * where they meet, and everything within the lead of it, is flagged. No allocation.
 */
export function robotBehindArrow(
   cam: CameraAxes,
   palletX: number,
   palletZ: number,
   clearY: number,
   robotX: number,
   robotZ: number
): boolean {
   // the camera's right axis: forward x up
   const rx = cam.fy * cam.uz - cam.fz * cam.uy;
   const ry = cam.fz * cam.ux - cam.fx * cam.uz;
   const rz = cam.fx * cam.uy - cam.fy * cam.ux;
   // the arrow at the tap and at the top of its bounce
   const ax = palletX - cam.px;
   const az = palletZ - cam.pz;
   let ay = clearY - cam.py;
   const d0 = ax * cam.fx + ay * cam.fy + az * cam.fz;
   const x0 = (ax * rx + ay * ry + az * rz) / d0;
   const y0 = (ax * cam.ux + ay * cam.uy + az * cam.uz) / d0;
   ay += ARROW.bounce;
   const d1 = ax * cam.fx + ay * cam.fy + az * cam.fz;
   const x1 = (ax * rx + ay * ry + az * rz) / d1;
   const y1 = (ax * cam.ux + ay * cam.uy + az * cam.uz) / d1 + ARROW.height / d1;
   const half = ARROW.width / 2 / Math.min(d0, d1);
   // the robot's column: its axis at the floor and at its top, grown by radius + lead
   const bx = robotX - cam.px;
   const bz = robotZ - cam.pz;
   let by = -cam.py;
   const e0 = bx * cam.fx + by * cam.fy + bz * cam.fz;
   const u0 = (bx * rx + by * ry + bz * rz) / e0;
   const v0 = (bx * cam.ux + by * cam.uy + bz * cam.uz) / e0;
   by += ROBOT_COLUMN.height;
   const e1 = bx * cam.fx + by * cam.fy + bz * cam.fz;
   const u1 = (bx * rx + by * ry + bz * rz) / e1;
   const v1 = (bx * cam.ux + by * cam.uy + bz * cam.uz) / e1;
   const reach = ROBOT_COLUMN.radius + ROBOT_COLUMN.lead;
   // nearer than the arrow everywhere: the robot (depth tested, drawn first) covers the arrow instead
   if (Math.max(e0, e1) + reach <= Math.min(d0, d1)) return false;
   const grow = reach / Math.min(e0, e1);
   return (
      Math.max(u0, u1) + grow > Math.min(x0, x1) - half &&
      Math.min(u0, u1) - grow < Math.max(x0, x1) + half &&
      Math.max(v0, v1) + grow > y0 &&
      Math.min(v0, v1) - grow < y1
   );
}

/** Moves the tuck amount (1 = shown, 0 = tucked away) towards `target` over ARROW.tuckS. dt 0 (paused) changes nothing. */
export function tuckStep(current: number, target: number, dt: number): number {
   const step = dt > 0 ? dt / ARROW.tuckS : 0;
   if (current < target) return Math.min(target, current + step);
   if (current > target) return Math.max(target, current - step);
   return current;
}

// ---------- how high the arrow floats ----------

/** The camera in world space: its position, its screen-up axis and its view direction (unit vectors). */
export interface CameraAxes {
   px: number;
   py: number;
   pz: number;
   ux: number;
   uy: number;
   uz: number;
   fx: number;
   fy: number;
   fz: number;
}

/** The highest thing on a box seen from above: the lid letter, just over the lid. */
const TOP_Y = PALLET_HEIGHT + LID_LETTER.y;
const HALF_W = BOX.width / 2;
const HALF_D = BOX.depth / 2;
const CORNER_X = [-HALF_W, HALF_W, -HALF_W, HALF_W];
const CORNER_Z = [-HALF_D, -HALF_D, HALF_D, HALF_D];

/** Screen height of a point as the camera sees it: its slope (p · up) / (p · forward), p = point - camera. */
function slope(cam: CameraAxes, x: number, y: number, z: number): number {
   const dx = x - cam.px;
   const dy = y - cam.py;
   const dz = z - cam.pz;
   return (dx * cam.ux + dy * cam.uy + dz * cam.uz) / (dx * cam.fx + dy * cam.fy + dz * cam.fz);
}

/**
 * The arrow tip's height over the floor (at the bottom of its bounce, the box at full size) that
 * puts the arrow ARROW.gap above the box on pallet (x, z), turned by `turn`, on screen. A
 * billboard's bottom edge faces the camera, so it is on screen where its tip is. The box's
 * highest point on screen is a corner of its top (raised to the lid letter, which lies inside it).
 * The tip's slope rises with its height (the camera looks down), so the height for a slope has a
 * closed form. From the steep camera the lid covers most of the box's height on screen, so the tip
 * floats 0.6 to 1.4 m over the lid in world space, highest over the near row of a close camera.
 * No allocation (called for every arrow, every frame).
 */
export function clearTipY(cam: CameraAxes, x: number, z: number, turn: number): number {
   const c = Math.cos(turn);
   const s = Math.sin(turn);
   let top = -Infinity;
   for (let k = 0; k < 4; k++) {
      const lx = CORNER_X[k];
      const lz = CORNER_Z[k];
      top = Math.max(top, slope(cam, x + c * lx + s * lz, TOP_Y, z - s * lx + c * lz));
   }
   // the gap as a slope at the box's depth
   const depth = (x - cam.px) * cam.fx + (TOP_Y - cam.py) * cam.fy + (z - cam.pz) * cam.fz;
   const target = top + ARROW.gap / depth;
   // the tip at height y: slope = (a + y·uy) / (b + y·fy), with a, b its parts at y = 0
   const ax = x - cam.px;
   const ay = -cam.py;
   const az = z - cam.pz;
   const a = ax * cam.ux + ay * cam.uy + az * cam.uz;
   const b = ax * cam.fx + ay * cam.fy + az * cam.fz;
   const y = (target * b - a) / (cam.uy - target * cam.fy);
   // a camera that does not look down (never the game's) keeps the arrow just over the lid
   return Number.isFinite(y) && y > TOP_Y ? y : TOP_Y;
}

/** The bounce at animation time t: 0 when the arrow taps down (t = 0, 0.8 s, ...), 1 at the top. */
export function beat(t: number): number {
   return Math.abs(Math.sin(Math.PI * ARROW.rate * t));
}

/**
 * The arrow tip's height over the floor at time t, from its clear height `clearY` (clearTipY), while
 * its box pops in at scale `pop`: box and arrow scale together about the pallet's top, so the arrow
 * rises out of the box. Never below `clearY` at full size.
 */
export function arrowTipAt(clearY: number, t: number, pop: number): number {
   return PALLET_HEIGHT + (clearY + ARROW.bounce * beat(t) - PALLET_HEIGHT) * pop;
}

/** The floor frame's opacity at time t: brightest when the arrow taps down. */
export function ringOpacity(t: number): number {
   const b = beat(t);
   return RING.opacityTap + (RING.opacityRest - RING.opacityTap) * b;
}

/** The floor frame's scale at time t: a small swell when the arrow taps down. */
export function ringScale(t: number): number {
   return 1 + RING.swell * (1 - beat(t)) ** 2;
}

/** Overshoots a little, then settles: the refill pop-in of a box and its markers (k = 0..1). */
export function easeOutBack(k: number): number {
   return 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
}

/** The largest scale the pop-in reaches (its overshoot), for the clearance test. */
export const POP_MAX = (() => {
   let best = 0;
   for (let k = 0; k <= 1000; k++) best = Math.max(best, easeOutBack(k / 1000));
   return best;
})();
