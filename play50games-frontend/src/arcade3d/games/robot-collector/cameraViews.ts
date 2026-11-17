import { portraitFollowOffset } from "@/arcade3d/core/camera/portraitFollow";

/** Portrait follow distance (m) and pitch (degrees down) — see phoneOffset. */
export const PHONE_DISTANCE = 10;
export const PHONE_PITCH_DEG = 38;
/** Portrait look-ahead: the camera aims this far past the hero (m) and this far above it (m). */
export const PHONE_LEAD = 2.5;
export const PHONE_LIFT = 0;

/**
 * Portrait follows the robot from behind, about 38 degrees down, far enough back that the next
 * batteries show ahead; landscape keeps the fitted overview.
 */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   return portraitFollowOffset(offset, aspect, PHONE_DISTANCE, PHONE_PITCH_DEG, PHONE_LEAD, PHONE_LIFT);
}
