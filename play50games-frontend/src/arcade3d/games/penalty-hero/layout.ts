// Where Penalty Hero's characters stand and how they move as groups (world metres). Looks only:
// rules.ts owns every shot. Plain data and pure functions, no three.js, so Scene.tsx draws from it
// and poses.test.ts checks the kick leg against the ball and the keeper's planted feet.

/** The ball's spot: x = rules.ts BALL_SPOT.x, at this distance from the goal line. */
export const SPOT_Z = 11;
/** The striker's group before the run-up: behind the ball and to its left as seen from behind. */
export const STRIKER_ROOT: [number, number, number] = [-0.65, 0, 11.8];
/**
 * The run-up at its end (e = 1): the group's move towards the ball (m) and its turn (rad). The v2
 * striker's shorter legs swing a shorter arc: 0.65 m (0.6 for the first GLB) brings its laces to the
 * ball at contact again (poses.test.ts).
 */
export const RUNUP = { x: 0.3, z: -0.65, yaw: -0.25 } as const;
/** The GLB striker's run-up: one stride of the walk, the kick's backswing from this share of the run-up on. */
export const BACKSWING_FROM = 0.75;

/** The striker group's place and turn at run-up progress `e` (0..1, eased), into `out`. */
export function strikerPlacement(e: number, out: { x: number; z: number; yaw: number }): { x: number; z: number; yaw: number } {
   out.x = STRIKER_ROOT[0] + RUNUP.x * e;
   out.z = STRIKER_ROOT[2] + RUNUP.z * e;
   out.yaw = RUNUP.yaw * e;
   return out;
}

export const KEEPER_ROOT: [number, number, number] = [0, 0, -0.15];
/**
 * The keeper's side-to-side sway (m) and its rate (rad/s), faded out by the dive. The stand-in
 * slides on its own; the GLB shifts its weight over planted feet (poses.ts keeperReadyPose), so it
 * sways less: its hips stay between its feet.
 */
export const KEEPER_SWAY = { standIn: 0.22, glb: 0.12, rate: 2.2 } as const;
/** The keeper's bounce while the striker aims: the stand-in hops (m), the GLB dips in its knees (GLB units). */
export const KEEPER_BOUNCE = { standIn: 0.04, glb: 0.04, rate: 4.4 } as const;

/** The keeper group's sway (m) at game time `now` (s), before the dive fades it. */
export function keeperSway(now: number, glb: boolean): number {
   return Math.sin(now * KEEPER_SWAY.rate) * (glb ? KEEPER_SWAY.glb : KEEPER_SWAY.standIn);
}

/** The GLB keeper's knee dip (GLB units) at game time `now` (s): its bounce, the feet kept on the grass. */
export function keeperDip(now: number): number {
   return Math.abs(Math.sin(now * KEEPER_BOUNCE.rate)) * KEEPER_BOUNCE.glb;
}

/** The height (m) of the keeper's roll pivot over its group's origin (the grass): a side dive rolls about it. */
export const KEEPER_HIP = 0.95;
/** A side dive: the group's move towards the zone's side (m) and its full roll (rad). */
export const KEEPER_DIVE = { reach: 2.0, roll: (65 * Math.PI) / 180 } as const;

/**
 * The keeper group in a dive at progress `d` (0..1; Scene.tsx diveProgress) towards the zone's
 * `side` (-1 / 0 / 1 along x) and `row` (1 high, 0 low), into `out`: its move along x and its height
 * (m, before the sway) and its roll about the pivot (rad). A side dive rolls about the hip, a high one
 * leaps, a middle one hops. A low side dive: the stand-in drops its hip 0.42 m to keep its body near
 * the grass; the GLB keeper pushes off first (its legs straighten out of the crouch as it leaves the
 * ground) and lands its body only 0.12 m lower, because its near arm reaches down the roll: lower, a
 * boot sinks into the grass mid-dive and the glove at the end (keeper.test.ts checks every dive).
 */
export function keeperDivePlacement(
   d: number,
   side: -1 | 0 | 1,
   row: 0 | 1,
   glb: boolean,
   out: { x: number; y: number; roll: number }
): { x: number; y: number; roll: number } {
   const rise = Math.sin((Math.PI / 2) * d);
   out.x = side * KEEPER_DIVE.reach * d;
   if (side === 0) out.y = (row === 1 ? 0.55 : 0.12) * rise;
   else if (row === 1) out.y = 0.75 * rise;
   else out.y = glb ? 0.12 * Math.sin(Math.PI * d) - 0.12 * d * d : -0.42 * rise;
   out.roll = side === 0 ? 0 : -side * KEEPER_DIVE.roll * (row === 1 ? 1 : 0.95) * d;
   return out;
}
