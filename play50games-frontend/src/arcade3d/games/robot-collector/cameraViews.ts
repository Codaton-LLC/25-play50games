/** A close portrait follow camera, with the original fitted landscape overview. */
export function phoneOffset(offset: [number, number, number], aspect: number): [number, number, number] {
   const scale = aspect < 1 ? 4 / Math.hypot(...offset) : 1;
   return [offset[0] * scale, offset[1] * scale, offset[2] * scale];
}
