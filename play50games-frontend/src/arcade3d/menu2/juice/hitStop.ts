// Hit-stop: a short dip of the VISUAL time scale on an impact (a hit, a boss blow, a big landing),
// the "freeze frame" of action games. Visual only: it slows the hero's animation, the particles,
// the popups and the camera kick (everything that reads useJuice().visualDt), never the run clock,
// the rules' dt or the input. The rules keep stepping by useRunFrame's dt, so a run's time and score
// are the same with or without it (fair on one leaderboard). Pure and allocation-free.
//
//    const stop = createHitStop();
//    hitStop(stop, 80);                         // on a hit
//    const vdt = stepHitStop(stop, dt);         // every frame: the visual dt
//    // the rules: step(run, dt * 1000)         <- dt, never vdt

/** The longest dip (ms); a longer request is cut to this. */
export const HIT_STOP_MAX_MS = 140;
/** The time scale during a dip (0.05 = nearly frozen). */
export const HIT_STOP_SCALE = 0.06;
/** The dip eases back to full speed over its last part (ms). */
const RECOVER_MS = 40;

export interface HitStop {
   /** ms of the dip left (real time) */
   leftMs: number;
   /** the dip's full length, for the ease-out */
   lengthMs: number;
   /** the time scale of the last step 0..1 */
   scale: number;
   reducedMotion: boolean;
}

export function createHitStop(): HitStop {
   return { leftMs: 0, lengthMs: 0, scale: 1, reducedMotion: false };
}

/** Starts (or extends to the longer of the two) a dip of `ms` (cut to HIT_STOP_MAX_MS). Off with reduced motion. */
export function hitStop(h: HitStop, ms: number): void {
   if (h.reducedMotion || !(ms > 0)) return;
   const len = Math.min(HIT_STOP_MAX_MS, ms);
   if (len > h.leftMs) {
      h.leftMs = len;
      h.lengthMs = len;
   }
}

/** The time scale `leftMs` before the dip ends: HIT_STOP_SCALE, easing back to 1 over the last 40 ms. */
export function hitStopScale(leftMs: number): number {
   if (!(leftMs > 0)) return 1;
   if (leftMs >= RECOVER_MS) return HIT_STOP_SCALE;
   const k = 1 - leftMs / RECOVER_MS;
   return HIT_STOP_SCALE + (1 - HIT_STOP_SCALE) * k * k;
}

/**
 * Advances the dip by the real frame `dt` (s) and returns the visual dt (dt x the time scale). The
 * dip runs in real time, so it always ends after its length, paused frames (dt 0) aside.
 */
export function stepHitStop(h: HitStop, dt: number): number {
   if (!(dt > 0)) return 0;
   h.scale = hitStopScale(h.leftMs);
   h.leftMs = Math.max(0, h.leftMs - dt * 1000);
   return dt * h.scale;
}
