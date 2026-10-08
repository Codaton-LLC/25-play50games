"use client";

// Where UI covers the canvas, so a Scene can keep gameplay out from under it. Owned by Claude.
// GameShell measures and publishes; games read it (also inside the Canvas):
//
//    const { hud, controls, obstructions } = useSafeArea();   // ScreenRects in CSS px from the canvas top-left
//    const top = useSafeArea((area) => hudBottom(area));       // a selector: re-renders only when it changes
//
// - hud: the shell's score/time/stats chips and mute/pause buttons (one rect per group), plus every
//   element of the game's own `definition.Hud` marked `data-arcade-safe-area` (SAFE_AREA_ATTR),
//   e.g. an inventory panel. Measured in every phase (both HUDs are laid out, hidden, before the
//   run starts), so a fit does not jump when the countdown begins.
// - controls: the touch joystick and buttons where they sit while the run is played, including
//   the lift above the cookie banner while it is open. Empty on desktop (no touch controls).
// - obstructions: what covers the bottom of the canvas: the cookie banner while it is open, and on
//   phones without a home button the home-indicator strip (env(safe-area-inset-bottom), measured
//   with a hidden probe), whichever is taller. insetBottom has the inset alone (px).
// Updates live on resize, rotation, the banner opening/closing and HUD size changes.
// useFittedView (core/useFittedView.ts) already avoids all three; most games never read this directly.
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import type { ScreenRect } from "./view";

export type { ScreenRect } from "./view";

export interface SafeArea {
   /** canvas size, CSS px */
   width: number;
   height: number;
   /** shell HUD groups and the game HUD's marked elements (SAFE_AREA_ATTR) */
   hud: ScreenRect[];
   /** touch controls (joystick, buttons); empty without touch controls */
   controls: ScreenRect[];
   /**
    * what covers the bottom of the canvas: the cookie banner strip, or the home-indicator inset
    * (env(safe-area-inset-bottom)) when that is taller; empty when nothing covers it
    */
   obstructions: ScreenRect[];
   /** env(safe-area-inset-bottom) in CSS px (0 on desktop, absent in layouts built by hand) */
   insetBottom?: number;
}

/**
 * Marks an element GameShell measures: a touch control on its layout probe, or a panel of the
 * game's own HUD (`<div data-arcade-safe-area>` inside definition.Hud) the camera fit must avoid.
 */
export const SAFE_AREA_ATTR = "data-arcade-safe-area";

const EMPTY: SafeArea = { width: 0, height: 0, hud: [], controls: [], obstructions: [], insetBottom: 0 };

export interface SafeAreaStore {
   get(): SafeArea;
   set(next: SafeArea): void;
   subscribe(listener: () => void): () => void;
}

const near = (a: number, b: number) => Math.abs(a - b) < 0.5;
const sameRects = (a: readonly ScreenRect[], b: readonly ScreenRect[]) =>
   a.length === b.length &&
   a.every((r, i) => near(r.left, b[i].left) && near(r.top, b[i].top) && near(r.right, b[i].right) && near(r.bottom, b[i].bottom));

/** Two rect lists within half a px of each other: an `isEqual` for useSafeArea selectors that return rects. */
export function sameScreenRects(a: readonly ScreenRect[], b: readonly ScreenRect[]): boolean {
   return sameRects(a, b);
}

/** Is `next` the same layout as `prev` (within half a px)? */
export function sameSafeArea(prev: SafeArea, next: SafeArea): boolean {
   return (
      near(prev.width, next.width) &&
      near(prev.height, next.height) &&
      sameRects(prev.hud, next.hud) &&
      sameRects(prev.controls, next.controls) &&
      sameRects(prev.obstructions ?? [], next.obstructions ?? []) &&
      near(prev.insetBottom ?? 0, next.insetBottom ?? 0)
   );
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

export type SafeAreaSelector<T> = (area: SafeArea) => T;
export type SafeAreaEquality<T> = (a: T, b: T) => boolean;

/**
 * The memo behind useSafeArea(selector): the same layout and selector give the same value without
 * calling the selector again, and a new layout whose selection `isEqual` to the last one gives the
 * last value back (same identity), so React does not re-render. No allocation per call.
 */
export function createSafeAreaSelection<T>(): (area: SafeArea, selector: SafeAreaSelector<T>, isEqual: SafeAreaEquality<T>) => T {
   let has = false;
   let lastArea: SafeArea | null = null;
   let lastSelector: SafeAreaSelector<T> | null = null;
   let lastValue = undefined as T;
   return (area, selector, isEqual) => {
      if (has && area === lastArea && selector === lastSelector) return lastValue;
      const next = selector(area);
      if (!has || !isEqual(lastValue, next)) lastValue = next;
      has = true;
      lastArea = area;
      lastSelector = selector;
      return lastValue;
   };
}

/**
 * The live safe-area rects (an empty layout outside GameShell). Re-renders only when they change.
 *
 * With a selector it re-renders only when the selected value changes (`isEqual`, default
 * Object.is), not for every HUD chip that grows with the score:
 *
 *    const insetTop = useSafeArea((area) => Math.max(0, ...area.hud.map((r) => r.bottom)));
 *    const controls = useSafeArea((area) => area.controls, sameScreenRects);
 *
 * Objects built in the selector need an `isEqual` (e.g. `shallow` from "zustand/shallow").
 */
export function useSafeArea(): SafeArea;
export function useSafeArea<T>(selector: SafeAreaSelector<T>, isEqual?: SafeAreaEquality<T>): T;
export function useSafeArea<T>(selector?: SafeAreaSelector<T>, isEqual: SafeAreaEquality<T> = Object.is): SafeArea | T {
   const store = useContext(SafeAreaContext);
   const [select] = useState(() => createSafeAreaSelection<T>());
   const get = store?.get ?? empty;
   const getSnapshot = selector ? () => select(get(), selector, isEqual) : get;
   const getServerSnapshot = selector ? () => select(EMPTY, selector, isEqual) : empty;
   return useSyncExternalStore<SafeArea | T>(store?.subscribe ?? noSubscribe, getSnapshot, getServerSnapshot);
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

/** The strip `bottom` px tall at the bottom of the window, on the canvas (none when it misses it). */
export function bottomStrip(base: Pick<DOMRect, "top" | "width" | "height">, windowHeight: number, bottom: number): ScreenRect[] {
   if (!(bottom > 0)) return [];
   const top = Math.max(0, windowHeight - bottom - base.top);
   return top < base.height ? [{ left: 0, top, right: base.width, bottom: base.height }] : [];
}

/**
 * How much of the window's bottom is covered (px): the page UI there (the cookie banner) or the
 * home-indicator inset, whichever is taller (the banner sits over the inset, not above it).
 */
export function bottomCover(bottomObstruction: number, insetBottom: number): number {
   const a = bottomObstruction > 0 ? bottomObstruction : 0;
   const b = insetBottom > 0 ? insetBottom : 0;
   return Math.max(a, b);
}

/** A hidden element as tall as env(safe-area-inset-bottom): the inset in px, read by layout. */
function createInsetProbe(): HTMLDivElement {
   const probe = document.createElement("div");
   probe.setAttribute("aria-hidden", "true");
   probe.setAttribute("data-arcade-inset-probe", "");
   probe.style.cssText =
      "position:fixed;left:0;bottom:0;width:0;height:0;padding:0 0 env(safe-area-inset-bottom,0px) 0;" +
      "visibility:hidden;pointer-events:none;";
   document.body.appendChild(probe);
   return probe;
}

const marked = (root: HTMLElement | null) => (root ? Array.from(root.querySelectorAll(`[${SAFE_AREA_ATTR}]`)) : []);

export interface SafeAreaSources {
   /** the wrapper around the game's own definition.Hud: its SAFE_AREA_ATTR elements join `hud` */
   gameHud?: RefObject<HTMLElement>;
   /** px of the window's bottom covered by page UI (useBottomObstruction): `obstructions` */
   bottomObstruction?: number;
}

/**
 * GameShell: keeps `store` in sync with the canvas wrapper, the HUD (its child groups), the game
 * HUD's marked elements, the touch-controls layout probe (elements marked SAFE_AREA_ATTR) and the
 * bottom obstruction. `deps` re-measure on changes no observer sees (the banner lifting the
 * controls, the HUD appearing).
 */
export function useSafeAreaTracker(
   store: SafeAreaStore,
   canvas: RefObject<HTMLElement>,
   hud: RefObject<HTMLElement>,
   probe: RefObject<HTMLElement>,
   deps: readonly unknown[],
   sources: SafeAreaSources = {}
): void {
   const [observer, setObserver] = useState<ResizeObserver | null>(null);
   const sourcesRef = useRef(sources);
   sourcesRef.current = sources;
   const insetProbeRef = useRef<HTMLDivElement | null>(null);
   const measureRef = useRef(() => {});
   measureRef.current = () => {
      const wrap = canvas.current;
      if (!wrap) return;
      const base = wrap.getBoundingClientRect();
      const { gameHud, bottomObstruction = 0 } = sourcesRef.current;
      const insetBottom = insetProbeRef.current ? Math.round(insetProbeRef.current.getBoundingClientRect().height) : 0;
      store.set({
         width: base.width,
         height: base.height,
         hud: [...(hud.current ? rectsOf(base, hud.current.children) : []), ...rectsOf(base, marked(gameHud?.current ?? null))],
         controls: probe.current ? rectsOf(base, marked(probe.current)) : [],
         obstructions: bottomStrip(base, window.innerHeight, bottomCover(bottomObstruction, insetBottom)),
         insetBottom,
      });
   };

   useEffect(() => {
      // the home-indicator inset changes only with the layout (rotation), measured with the rest
      const insetProbe = typeof document !== "undefined" ? createInsetProbe() : null;
      insetProbeRef.current = insetProbe;
      measureRef.current();
      const cleanupProbe = () => {
         insetProbe?.remove();
         if (insetProbeRef.current === insetProbe) insetProbeRef.current = null;
      };
      if (typeof ResizeObserver === "undefined") return cleanupProbe;
      const ro = new ResizeObserver(() => measureRef.current());
      setObserver(ro);
      const onResize = () => measureRef.current();
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      return () => {
         ro.disconnect();
         window.removeEventListener("resize", onResize);
         window.removeEventListener("orientationchange", onResize);
         cleanupProbe();
      };
   }, [measureRef]);

   // (re)observe the elements and measure whenever the layout inputs change
   useEffect(() => {
      measureRef.current();
      if (!observer) return;
      const gameHud = sourcesRef.current.gameHud?.current ?? null;
      const targets = new Set<Element>();
      const observe = () => {
         const next = [canvas.current, hud.current, ...(hud.current ? Array.from(hud.current.children) : []), ...marked(gameHud)];
         for (const el of next) {
            if (el && !targets.has(el)) {
               targets.add(el);
               observer.observe(el);
            }
         }
      };
      observe();
      // the game HUD may add or remove marked panels at any time (coalesced to one measure per frame)
      let queued = 0;
      const mutations =
         gameHud && typeof MutationObserver !== "undefined"
            ? new MutationObserver(() => {
                 if (queued) return;
                 queued = requestAnimationFrame(() => {
                    queued = 0;
                    observe();
                    measureRef.current();
                 });
              })
            : null;
      mutations?.observe(gameHud as HTMLElement, { childList: true, subtree: true, attributes: true, attributeFilter: [SAFE_AREA_ATTR] });
      return () => {
         mutations?.disconnect();
         if (queued) cancelAnimationFrame(queued);
         targets.forEach((el) => observer.unobserve(el));
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [observer, canvas, hud, probe, sources.bottomObstruction, ...deps]);
}
