import { useCallback, useEffect, useRef } from "react";

/**
 * Delayed onComplete for the final games: it fires at most once per run and
 * never after the game has unmounted (exit), so the parent is not notified
 * twice or after leaving. `rearm()` lets a replay complete again; a completion
 * that is already pending still fires once.
 */
export function useCompleteOnce() {
   const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
   const doneRef = useRef(false);
   const mountedRef = useRef(true);

   useEffect(() => {
      mountedRef.current = true;
      const timers = timersRef.current;
      return () => {
         mountedRef.current = false;
         timers.forEach((t) => clearTimeout(t));
         timers.clear();
      };
   }, []);

   const completeLater = useCallback((fn: () => void, delayMs: number) => {
      if (doneRef.current || !mountedRef.current) return;
      doneRef.current = true;
      const t = setTimeout(() => {
         timersRef.current.delete(t);
         if (mountedRef.current) fn();
      }, delayMs);
      timersRef.current.add(t);
   }, []);

   const rearm = useCallback(() => {
      doneRef.current = false;
   }, []);

   return { completeLater, rearm };
}
