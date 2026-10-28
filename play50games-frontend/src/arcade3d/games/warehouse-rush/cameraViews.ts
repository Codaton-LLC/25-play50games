/** Keep the robot readable on a phone; landscape retains the level overview. */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   const scale = aspect < 1 ? 3.5 / Math.hypot(...offset) : 1;
   return [offset[0] * scale, offset[1] * scale, offset[2] * scale];
}
