"use client";

// Where UI covers the canvas, so a Scene can keep gameplay out from under it. Owned by Claude.
// GameShell measures and publishes; games read it (also inside the Canvas):
//
//    const { hud, controls, obstructions } = useSafeArea();   // ScreenRects in CSS px from the canvas top-left
//
// - hud: the shell's score/time/stats chips and mute/pause buttons (one rect per group), plus every
//   element of the game's own `definition.Hud` marked `data-arcade-safe-area` (SAFE_AREA_ATTR),
//   e.g. an inventory panel. Measured in every phase (both HUDs are laid out, hidden, before the
//   run starts), so a fit does not jump when the countdown begins.
// - controls: the touch joystick and buttons where they sit while the run is played, including
//   the lift above the cookie banner while it is open. Empty on desktop (no touch controls).
// - obstructions: page UI over the bottom of the canvas (the cookie banner) while it is open.
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
   /** page UI over the canvas (the cookie banner strip at the bottom); empty when nothing covers it */
   obstructions: ScreenRect[];
}

/**
 * Marks an element GameShell measures: a touch control on its layout probe, or a panel of the
 * game's own HUD (`<div data-arcade-safe-area>` inside definition.Hud) the camera fit must avoid.
 */
export const SAFE_AREA_ATTR = "data-arcade-safe-area";

const EMPTY: SafeArea = { width: 0, height: 0, hud: [], controls: [], obstructions: [] };

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
   return (
      near(prev.width, next.width) &&
      near(prev.height, next.height) &&
      sameRects(prev.hud, next.hud) &&
      sameRects(prev.controls, next.controls) &&
      sameRects(prev.obstructions ?? [], next.obstructions ?? [])
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

/** The strip `bottom` px tall at the bottom of the window, on the canvas (none when it misses it). */
export function bottomStrip(base: Pick<DOMRect, "top" | "width" | "height">, windowHeight: number, bottom: number): ScreenRect[] {
   if (!(bottom > 0)) return [];
   const top = Math.max(0, windowHeight - bottom - base.top);
   return top < base.height ? [{ left: 0, top, right: base.width, bottom: base.height }] : [];
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
   const measureRef = useRef(() => {});
   measureRef.current = () => {
      const wrap = canvas.current;
      if (!wrap) return;
      const base = wrap.getBoundingClientRect();
      const { gameHud, bottomObstruction = 0 } = sourcesRef.current;
      store.set({
         width: base.width,
         height: base.height,
         hud: [...(hud.current ? rectsOf(base, hud.current.children) : []), ...rectsOf(base, marked(gameHud?.current ?? null))],
         controls: probe.current ? rectsOf(base, marked(probe.current)) : [],
         obstructions: bottomStrip(base, window.innerHeight, bottomObstruction),
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
