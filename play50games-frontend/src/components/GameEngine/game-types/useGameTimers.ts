import { useCallback, useEffect, useRef } from "react";

type Timer = ReturnType<typeof setTimeout>;

/**
 * Timers of a classic game that must not outlive the game (skill games, Reaction Test).
 *
 * `completeLater(fn, ms)`: the delayed onComplete of a finished game. If the
 * game unmounts while it is pending, the completion is delivered right then
 * (once) instead of being dropped, so a player who finished and left during
 * the delay still gets the result saved, and no timer fires after leaving.
 * Each game keeps its own `completionCalledRef` guard for once per run.
 *
 * `expireLater(fn, ms)`: the "unlimited replays" expiry. It is cleared on
 * unmount and not started after unmount; the stored expiry time is checked
 * again on the next mount, so the 15 minute window itself is unchanged.
 */
export function useGameTimers() {
   const mountedRef = useRef(true);
   const completionsRef = useRef<Map<Timer, () => void>>(new Map());
   const expiriesRef = useRef<Set<Timer>>(new Set());

   useEffect(() => {
      mountedRef.current = true;
      const completions = completionsRef.current;
      const expiries = expiriesRef.current;
      return () => {
         mountedRef.current = false;
         expiries.forEach((t) => clearTimeout(t));
         expiries.clear();
         // Deliver a pending completion now: only the latest one, once.
         let last: (() => void) | undefined;
         completions.forEach((fn, t) => {
            clearTimeout(t);
            last = fn;
         });
         completions.clear();
         if (last) last();
      };
   }, []);

   const completeLater = useCallback((fn: () => void, delayMs: number) => {
      if (!mountedRef.current) {
         fn();
         return;
      }
      const t = setTimeout(() => {
         completionsRef.current.delete(t);
         fn();
      }, delayMs);
      completionsRef.current.set(t, fn);
   }, []);

   const expireLater = useCallback((fn: () => void, delayMs: number) => {
      if (!mountedRef.current) return;
      const t = setTimeout(() => {
         expiriesRef.current.delete(t);
         fn();
      }, delayMs);
      expiriesRef.current.add(t);
   }, []);

   return { completeLater, expireLater };
}
