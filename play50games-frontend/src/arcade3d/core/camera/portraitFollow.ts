// The portrait (phone) follow camera's offset: behind the hero on the fitted view's own horizontal
// direction (so "ahead" on screen stays the level's main play axis), at a set distance and a set
// downward pitch. Landscape keeps the fitted overview offset unchanged. Pure math.

export type Offset = [number, number, number];

/**
 * `fitted` is useFittedView's offset (camera minus look-at point). On a portrait screen (aspect < 1)
 * returns the rig offset of a camera that sits `distance` metres from the hero, `pitchDeg` degrees
 * above the horizontal, on the same compass heading as `fitted` (straight +z when `fitted` is
 * near-vertical), while it aims at leadPoint(hero, ..., lead, lift): the offset is measured from that
 * aim point, so the look-ahead turns the view forward without moving the camera nearer the hero.
 * Otherwise returns `fitted`.
 */
export function portraitFollowOffset(fitted: Offset, aspect: number, distance: number, pitchDeg: number, lead = 0, lift = 0): Offset {
   if (!(aspect < 1)) return fitted;
   const flat = Math.hypot(fitted[0], fitted[2]);
   const dx = flat > 1e-6 ? fitted[0] / flat : 0;
   const dz = flat > 1e-6 ? fitted[2] / flat : 1;
   const pitch = (pitchDeg * Math.PI) / 180;
   const h = Math.cos(pitch) * distance + lead;
   return [dx * h, Math.sin(pitch) * distance - lift, dz * h];
}

/** The pitch (degrees above the horizontal) of an offset. */
export function offsetPitchDeg(offset: Offset): number {
   return (Math.atan2(offset[1], Math.hypot(offset[0], offset[2])) * 180) / Math.PI;
}

/**
 * The point a portrait follow camera aims at: `lead` metres past the hero, away from the camera
 * along `offset`'s compass heading, and `lift` metres up. The hero then sits low on screen with
 * the level ahead of it above. Writes and returns `out`.
 */
export function leadPoint(
   hero: { x: number; y: number; z: number },
   offset: Offset,
   lead: number,
   lift: number,
   out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
   const flat = Math.hypot(offset[0], offset[2]);
   const dx = flat > 1e-6 ? offset[0] / flat : 0;
   const dz = flat > 1e-6 ? offset[2] / flat : 0;
   out.x = hero.x - dx * lead;
   out.y = hero.y + lift;
   out.z = hero.z - dz * lead;
   return out;
}
