"use client";

// The height of a fixed bar covering the bottom edge of the screen (the cookie banner until the player
// answers it), kept in a CSS variable on the element `ref` points at, so sticky controls can sit just
// above it (GameEngine.module.css). Light: one elementFromPoint per poll, only while mounted.
import { useEffect, type RefObject } from "react";

/** px of a fixed, mostly full-width bar anchored to the bottom edge (0 when none or no DOM). */
export function bottomBarHeight(): number {
   if (typeof window === "undefined" || typeof document.elementFromPoint !== "function") return 0;
   const W = window.innerWidth;
   const H = window.innerHeight;
   let el = document.elementFromPoint(W / 2, H - 2) as HTMLElement | null;
   for (let depth = 0; el && el !== document.body && depth < 12; depth++, el = el.parentElement) {
      if (window.getComputedStyle(el).position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.bottom >= H - 2 && r.width >= W * 0.6 && r.height < H * 0.6) return Math.round(H - r.top);
      return 0;
   }
   return 0;
}

/**
 * Writes --p50-bottom-bar (px) on the element while `active`. With `padPage`, the page itself gets that
 * much room at its end (body padding-bottom, and scroll-padding-bottom for focus / scrollIntoView) so
 * its last content scrolls clear of the bar; both are put back on unmount, so only this page has them.
 */
export function useBottomBar(ref: RefObject<HTMLElement>, active = true, padPage = false): void {
   useEffect(() => {
      if (!active || typeof window === "undefined") return;
      const body = document.body;
      const html = document.documentElement;
      const before = { pad: body.style.paddingBottom, scroll: html.style.scrollPaddingBottom };
      let last = -1;
      const measure = () => {
         const v = bottomBarHeight();
         // the start and play views are different elements: (re)write the var on whichever is mounted
         const el = ref.current;
         if (el && el.style.getPropertyValue("--p50-bottom-bar") !== `${v}px`) el.style.setProperty("--p50-bottom-bar", `${v}px`);
         if (v === last) return;
         last = v;
         if (padPage) {
            body.style.paddingBottom = v > 0 ? `${v}px` : before.pad;
            html.style.scrollPaddingBottom = v > 0 ? `${v}px` : before.scroll;
         }
      };
      measure();
      const id = window.setInterval(measure, 700);
      window.addEventListener("resize", measure);
      return () => {
         window.clearInterval(id);
         window.removeEventListener("resize", measure);
         if (padPage) {
            body.style.paddingBottom = before.pad;
            html.style.scrollPaddingBottom = before.scroll;
         }
      };
   }, [ref, active, padPage]);
}
