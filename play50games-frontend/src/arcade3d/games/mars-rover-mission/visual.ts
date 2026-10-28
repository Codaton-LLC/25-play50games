// The Scene's per-run visual state: written by the run frame (events) and the visuals, read by the rover,
// the sites and the HUD effects. Pure data, no three.js.
import type { SpringState } from "@/arcade3d/core/motion";

export interface Vis {
   /** smoothed stick: steer (-1 left .. 1 right) and throttle (-1 brake .. 1 drive) */
   steer: number;
   throttle: number;
   /** the site being drilled / scanned / repaired (-1: none) and its progress 0..1 */
   active: number;
   progress: number;
   /** a finished crystal flying from its deposit to the tray: 0..1 (-1: none) */
   flyT: number;
   flySite: number;
   /** samples on the deck */
   carried: number;
   /** seconds since the win (-1: not won) */
   winT: number;
   /** seconds since a life was lost (blink), large when none */
   hitT: number;
   /** smoothed terrain tilt */
   pitch: number;
   roll: number;
   bob: SpringState;
   /** the beam's target this frame (world) */
   beamX: number;
   beamY: number;
   beamZ: number;
}

export function createVis(): Vis {
   return { steer: 0, throttle: 0, active: -1, progress: 0, flyT: -1, flySite: -1, carried: 0, winT: -1, hitT: 99, pitch: 0, roll: 0, bob: { x: 0, v: 0 }, beamX: 0, beamY: 0, beamZ: 0 };
}
