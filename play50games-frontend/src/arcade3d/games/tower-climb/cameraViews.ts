import type { ViewId } from "@/arcade3d/core/camera/views";
import { portraitFollowOffset } from "@/arcade3d/core/camera/portraitFollow";

export const CAMERA_VIEWS: readonly ViewId[] = ["default", "top"];

/** Portrait follow distance (m) and pitch (degrees down) — see phoneOffset. */
export const PHONE_DISTANCE = 4.5;
export const PHONE_PITCH_DEG = 12;
/** Portrait look-ahead: the camera aims this far past the hero (m) and this far above it (m). */
export const PHONE_LEAD = 0;
export const PHONE_LIFT = 0.8;

/**
 * Portrait follows the small climber nearly level (12 degrees down) and further back than
 * before, so the next platforms above stay on screen; landscape keeps the whole-column fit.
 */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   return portraitFollowOffset(offset, aspect, PHONE_DISTANCE, PHONE_PITCH_DEG, PHONE_LEAD, PHONE_LIFT);
}
