"use client";

// Where GameShell's own UI covers the canvas, so a Scene can keep gameplay out from under it.
// Owned by Claude. GameShell measures and publishes; games read it (also inside the Canvas):
//
//    const { hud, controls } = useSafeArea();   // ScreenRects in CSS px from the canvas top-left
//
// - hud: the score/time/stats chips and the mute/pause buttons (one rect per group). Measured in
//   every phase (the HUD is laid out, hidden, before the run starts), so a fit does not jump when
//   the countdown begins.
// - controls: the touch joystick and buttons where they sit while the run is played, including
//   the lift above the cookie banner while it is open. Empty on desktop (no touch controls).
// Updates live on resize, rotation, the banner opening/closing and HUD size changes.
// useFittedView (core/useFittedView.ts) already uses both; most games never read this directly.
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import type { ScreenRect } from "./view";

export type { ScreenRect } from "./view";

export interface SafeArea {
   /** canvas size, CSS px */
   width: number;
   height: number;
   /** shell HUD groups (the game's own `definition.Hud` is not included) */
   hud: ScreenRect[];
   /** touch controls (joystick, buttons); empty without touch controls */
   controls: ScreenRect[];
}

/** Marks an element GameShell measures as a touch control (on its layout probe). */
export const SAFE_AREA_ATTR = "data-arcade-safe-area";

const EMPTY: SafeArea = { width: 0, height: 0, hud: [], controls: [] };

export interface SafeAreaStore {
   get(): SafeArea;
   set(next: SafeArea): void;
   subscribe(listener: () => void): () => void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const sameRects = (a: ScreenRect[], b: ScreenRect[]) =>
   a.length === b.length &&
   a.every((r, i) => near(r.left, b[i].left) && near(r.top, b[i].top) && near(r.right, b[i].right) && near(r.bottom, b[i].bottom));

/** Is `next` the same layout as `prev` (within half a px)? */
export function sameSafeArea(prev: SafeArea, next: SafeArea): boolean {
   return near(prev.width, next.width) && near(prev.height, next.height) && sameRects(prev.hud, next.hud) && sameRects(prev.controls, next.controls);
}

/** A tiny external store: GameShell writes, scenes subscribe (no GameShell re-render per change). */
export function createSafeAreaStore(): SafeAreaStore {
   let value = EMPTY;
   const listeners = new Set<() => void>();
   return {
      get: () => value,
      set(next) {
         if (sameSafeArea(value, next)) return;
         value = next;
         listeners.forEach((listener) => listener());
      },
      subscribe(listener) {
         listeners.add(listener);
         return () => listeners.delete(listener);
      },
   };
}

const SafeAreaContext = createContext<SafeAreaStore | null>(null);

export function SafeAreaProvider({ store, children }: { store: SafeAreaStore; children: ReactNode }) {
   return <SafeAreaContext.Provider value={store}>{children}</SafeAreaContext.Provider>;
}

const noSubscribe = () => () => {};
const empty = () => EMPTY;

/** The live safe-area rects (an empty layout outside GameShell). Re-renders only when they change. */
export function useSafeArea(): SafeArea {
   const store = useContext(SafeAreaContext);
   return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.get ?? empty, empty);
}

/** Measures `elements` relative to `base` (zero-size elements, e.g. display: none, are skipped). */
function rectsOf(base: DOMRect, elements: Iterable<Element>): ScreenRect[] {
   const rects: ScreenRect[] = [];
   for (const el of elements) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      rects.push({ left: r.left - base.left, top: r.top - base.top, right: r.right - base.left, bottom: r.bottom - base.top });
   }
   return rects;
}

/**
 * GameShell: keeps `store` in sync with the canvas wrapper, the HUD (its child groups) and the
 * touch-controls layout probe (elements marked SAFE_AREA_ATTR). `deps` re-measure on changes no
 * ResizeObserver sees (the banner lifting the controls, the HUD appearing).
 */
export function useSafeAreaTracker(
   store: SafeAreaStore,
   canvas: RefObject<HTMLElement>,
   hud: RefObject<HTMLElement>,
   probe: RefObject<HTMLElement>,
   deps: readonly unknown[]
): void {
   const [observer, setObserver] = useState<ResizeObserver | null>(null);
   const measureRef = useRef(() => {});
   measureRef.current = () => {
      const wrap = canvas.current;
      if (!wrap) return;
      const base = wrap.getBoundingClientRect();
      store.set({
         width: base.width,
         height: base.height,
         hud: hud.current ? rectsOf(base, hud.current.children) : [],
         controls: probe.current ? rectsOf(base, probe.current.querySelectorAll(`[${SAFE_AREA_ATTR}]`)) : [],
      });
   };

   useEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => measureRef.current());
      setObserver(ro);
      const onResize = () => measureRef.current();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      return () => {
         ro.disconnect();
         window.removeEventListener("resize", onResize);
         window.removeEventListener("orientationchange", onResize);
      };
   }, [measureRef]);

   // (re)observe the elements and measure whenever the layout inputs change
   useEffect(() => {
      measureRef.current();
      if (!observer) return;
      const targets = [canvas.current, hud.current, ...(hud.current ? Array.from(hud.current.children) : [])];
      targets.forEach((el) => el && observer.observe(el));
      return () => targets.forEach((el) => el && observer.unobserve(el));
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [observer, canvas, hud, probe, ...deps]);
}
