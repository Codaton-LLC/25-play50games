"use client";

// Shared touch and viewport helpers for the classic Speed games (speedgames-parts only).
// Nothing here changes a game's rules, scoring or timing: these are input plumbing and layout reads.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type RefObject } from "react";

/**
 * The style every tappable play surface gets: no 300 ms tap delay or double-tap zoom
 * (`touch-action: manipulation`), no text selection or long-press callout while mashing,
 * no grey tap flash.
 */
export const TOUCH_SURFACE: CSSProperties = {
   touchAction: "manipulation",
   userSelect: "none",
   WebkitUserSelect: "none",
   WebkitTouchCallout: "none",
   WebkitTapHighlightColor: "transparent",
};

/** The same, for a surface the game drags on (joystick-like areas): no scrolling or pinch at all. */
export const DRAG_SURFACE: CSSProperties = {
   ...TOUCH_SURFACE,
   touchAction: "none",
};

/** The 44 px minimum of a touch target (Apple HIG / WCAG 2.5.8 enhanced). */
export const MIN_TARGET = 44;

export interface Viewport {
   width: number;
   height: number;
   /** phones (< 640 px wide) */
   isMobile: boolean;
   /** tablets (640-1023 px wide) */
   isTablet: boolean;
   /** any coarse-pointer / touch-first device */
   isTouch: boolean;
   /** wider than tall */
   isLandscape: boolean;
   /** a short viewport (landscape phone, tablet with the keyboard up): keep the play area low */
   isShort: boolean;
}

function readViewport(): Viewport {
   if (typeof window === "undefined") return { width: 1024, height: 768, isMobile: false, isTablet: false, isTouch: false, isLandscape: true, isShort: false };
   const width = window.innerWidth;
   const height = window.innerHeight;
   let isTouch = false;
   try {
      isTouch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
   } catch {
      isTouch = false;
   }
   return { width, height, isMobile: width < 640, isTablet: width >= 640 && width < 1024, isTouch, isLandscape: width > height, isShort: height < 560 };
}

/** The live viewport (resize and orientation changes), read once on mount. */
export function useViewport(): Viewport {
   const [vp, setVp] = useState<Viewport>(readViewport);
   useEffect(() => {
      const update = () => setVp(readViewport());
      update();
      window.addEventListener("resize", update);
      window.addEventListener("orientationchange", update);
      return () => {
         window.removeEventListener("resize", update);
         window.removeEventListener("orientationchange", update);
      };
   }, []);
   return vp;
}

/**
 * On touch / narrow / short screens the site header above the engine pushes the game below the fold: when
 * the run starts, bring the engine's score bar (and the play area under it) to the top of the viewport, once.
 */
export function useRevealOnPlay(ref: RefObject<HTMLElement>, isPlaying: boolean): void {
   const done = useRef(false);
   useEffect(() => {
      if (!isPlaying || done.current || typeof window === "undefined") return;
      // a tall desktop window shows the whole game under the site header; everything else (phones, tablets,
      // landscape tablets and laptops under 900 px tall) needs the engine's bar at the top so the play area
      // and the Replay / Share row end above the cookie banner
      if (window.innerWidth >= 1024 && window.innerHeight >= 900) return;
      const root = ref.current;
      const engine = root?.closest(".game-engine");
      const target = (engine?.querySelector(".game-header") as HTMLElement | null) ?? root;
      if (!target) return;
      const reveal = () => {
         // marked done only when a scroll really runs: React's dev StrictMode runs this effect, its cleanup
         // and the effect again before the first frame, which must not count as the reveal
         done.current = true;
         try {
            target.scrollIntoView({ block: "start", behavior: "smooth" });
         } catch {
            target.scrollIntoView();
         }
      };
      const id = window.requestAnimationFrame(reveal);
      // The engine focuses its container on start (an instant scroll) and the board can still grow in the
      // first frames; if the header is not at the top shortly after, scroll again (same target, harmless
      // while the first smooth scroll is still running).
      const timers = [250, 700].map((ms) =>
         window.setTimeout(() => {
            if (Math.abs(target.getBoundingClientRect().top) > 4) reveal();
         }, ms),
      );
      return () => {
         window.cancelAnimationFrame(id);
         timers.forEach((t) => window.clearTimeout(t));
      };
   }, [ref, isPlaying]);
}

/**
 * Instant activation: the handler runs on pointerdown (touch, pen, mouse) instead of the click that
 * follows 100-300 ms later; the matching click is swallowed so nothing fires twice, while a keyboard
 * activation (a click with no pointer first) still works. Spread the result onto the element.
 */
export function useInstantPress<T extends HTMLElement>(handler: (() => void) | undefined, enabled = true) {
   const last = useRef(0);
   const onPointerDown = useCallback(
      (e: PointerEvent<T>) => {
         if (!enabled || !handler) return;
         if (e.pointerType === "mouse" && e.button !== 0) return;
         last.current = performance.now();
         handler();
      },
      [handler, enabled],
   );
   const onClick = useCallback(
      (e: MouseEvent<T>) => {
         if (!enabled || !handler) return;
         if (performance.now() - last.current < 600) {
            e.preventDefault();
            return;
         }
         handler();
      },
      [handler, enabled],
   );
   return { onPointerDown, onClick };
}

/** Stops the browser's default on a pointer event (text selection, image drag, focus scroll) without stopping React. */
export function eatDefault(e: { preventDefault: () => void }): void {
   e.preventDefault();
}
