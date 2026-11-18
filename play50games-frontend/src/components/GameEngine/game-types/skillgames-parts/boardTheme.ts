// The stage's theme, for the canvas games (a canvas cannot read var()).
// The game page's stage (app/games/[id]/page.module.css) sets --board-ov: "255, 255, 255" in the dark
// (the white the boards' overlays were drawn with) and the Day Deck ink in the light. Outside the
// stage it is not set: the canvas keeps its dark look.

import { useEffect } from "react";

/** The overlay colour as "r, g, b": white on the dark stage, ink navy on the light one. */
export function boardOv(el: Element | null): string {
   if (!el) return "255, 255, 255";
   const v = getComputedStyle(el).getPropertyValue("--board-ov").trim();
   return v || "255, 255, 255";
}

/** True when the stage around `el` is on the light theme. */
export function isLightBoard(el: Element | null): boolean {
   return boardOv(el).replace(/\s/g, "") !== "255,255,255";
}

/** A CSS variable of the element, or the fallback (the dark value the canvas was drawn with). */
export function cssVar(el: Element | null, name: string, fallback: string): string {
   if (!el) return fallback;
   return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/**
 * Calls `onChange` when the page's theme flips (the theme switch sets data-theme on <html>; "System"
 * follows prefers-color-scheme), so a canvas that is not redrawn every frame repaints at once.
 */
export function useThemeChange(onChange: () => void): void {
   useEffect(() => {
      if (typeof window === "undefined") return;
      const run = () => requestAnimationFrame(() => onChange());
      const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
      mq?.addEventListener?.("change", run);
      const mo = new MutationObserver(run);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
         mq?.removeEventListener?.("change", run);
         mo.disconnect();
      };
   }, [onChange]);
}
