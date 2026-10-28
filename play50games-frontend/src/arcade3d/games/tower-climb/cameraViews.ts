import type { ViewId } from "@/arcade3d/core/camera/views";

export const CAMERA_VIEWS: readonly ViewId[] = ["default", "top"];

/** The small climber needs a closer portrait camera than the whole-column fit. */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   const scale = aspect < 1 ? 2.6 / Math.hypot(...offset) : 1;
   return [offset[0] * scale, offset[1] * scale, offset[2] * scale];
}
