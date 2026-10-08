// How bright Scene.tsx draws the goal's six zone tiles. Looks only: rules.ts owns the zones. Pure, no
// three.js. The tiles lie just in front of the goal plane, so a ball in the net is seen through them:
// the selected tile, bright while it marks the chosen zone (the aim, the run-up and most of the flight,
// with the ball in front of it), fades to the idle level over the end of the flight and stays there
// through the hold. Lit, it tinted the white ball in the net pink and hid its black panels
// (zones.test.ts).
import { FLIGHT_MS, type Phase } from "./rules";

/** The tiles' plane: just in front of the goal plane z = 0 the shots are aimed at. */
export const ZONE_PLANE_Z = 0.02;
/** Every tile but the selected one, and the selected one too once the ball reaches the goal. */
export const ZONE_IDLE_OPACITY = 0.1;
/** The selected tile while it marks the chosen zone, before the aim's pulse. */
export const ZONE_LIT_OPACITY = 0.36;
/** Share of the flight from which the selected tile fades to the idle level (the ball is still 3.3 m out). */
export const ZONE_FADE_FROM = 0.7;

const smooth = (v: number) => {
   const t = v < 0 ? 0 : v > 1 ? 1 : v;
   return t * t * (3 - 2 * t);
};

/** Opacity of one zone tile in `phase` (`phaseMs` into it); `pulse` is the aim's wobble (0 otherwise). */
export function zoneOpacity(phase: Phase, phaseMs: number, selected: boolean, pulse: number): number {
   if (!selected) return ZONE_IDLE_OPACITY;
   const lit =
      phase === "aim" || phase === "runup"
         ? 1
         : phase === "flight"
           ? 1 - smooth((phaseMs / FLIGHT_MS - ZONE_FADE_FROM) / (1 - ZONE_FADE_FROM))
           : 0;
   return ZONE_IDLE_OPACITY + (ZONE_LIT_OPACITY - ZONE_IDLE_OPACITY + pulse) * lit;
}
