"use client";

// Shared by the Skill games: a short ring where the player touched or clicked a play area (visual only).
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import touch from "./skillTouch.module.css";

type Ripple = { id: number; x: number; y: number; color?: string };

export function useRipples() {
   const [ripples, setRipples] = useState<Ripple[]>([]);
   const timers = useRef<number[]>([]);
   useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

   /** Adds a ring at a pointer event, inside the element that handles it (the play area). */
   const addRipple = useCallback((e: ReactPointerEvent<HTMLElement>, color?: string) => {
      const r = e.currentTarget.getBoundingClientRect();
      const id = performance.now() + Math.random();
      setRipples((p) => [...p.slice(-5), { id, x: e.clientX - r.left, y: e.clientY - r.top, color }]);
      timers.current.push(window.setTimeout(() => setRipples((p) => p.filter((q) => q.id !== id)), 460));
   }, []);

   const rippleLayer = ripples.map((q) => (
      <span
         key={q.id}
         className={touch.ripple}
         style={{ left: q.x, top: q.y, ...(q.color ? { borderColor: q.color } : null) }}
         aria-hidden="true"
      />
   ));

   return { addRipple, rippleLayer };
}
