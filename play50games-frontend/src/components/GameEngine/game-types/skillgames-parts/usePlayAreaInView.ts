"use client";

// Shared by the Skill games: when a round starts or ends, scroll the page so the game's panel and
// its play area (or its level card) are on screen together, above any fixed overlay docked at the
// bottom of the viewport (the cookie banner, a browser's bottom bar). It only scrolls when something
// is cut off, so a layout that already fits (desktop) never moves. The game is the last thing on the
// page, so the hook also returns a bottom spacer as tall as the overlay that would otherwise sit on
// the game's last rows; it drops to 0 once the overlay goes away. Game sizes and rules are untouched.
import { useEffect, useState, type RefObject } from "react";

/** The y of the top of the fixed overlay docked at the bottom of the viewport (else the viewport bottom). */
export function visibleBottom(): number {
   const vh = window.visualViewport?.height ?? window.innerHeight;
   const vw = window.innerWidth;
   let bottom = vh;
   for (const fx of [0.25, 0.5, 0.75]) {
      for (const el of document.elementsFromPoint(vw * fx, vh - 2)) {
         for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
            const pos = getComputedStyle(n).position;
            if (pos !== "fixed" && pos !== "sticky") continue;
            const r = n.getBoundingClientRect();
            // docked at the bottom, wide, and not a full-screen layer (modals cover everything on purpose)
            if (r.width >= vw * 0.6 && r.bottom >= vh - 2 && r.top > vh * 0.3) bottom = Math.min(bottom, r.top);
            break;
         }
      }
   }
   return bottom;
}

/** Scroll by the least amount that shows `bottomEl` above the bottom overlay, never pushing `topEl` off the top. */
export function bringIntoView(topEl: HTMLElement, bottomEl: HTMLElement = topEl, margin = 8): void {
   const t = topEl.getBoundingClientRect();
   const b = bottomEl.getBoundingClientRect();
   const limit = visibleBottom() - margin;
   let dy = 0;
   if (b.bottom > limit) dy = b.bottom - limit;
   if (t.top - dy < margin) dy = t.top - margin;
   if (Math.abs(dy) < 2) return;
   const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
   window.scrollBy({ top: dy, behavior: reduced ? "auto" : "smooth" });
}

/**
 * Height of the spacer (rendered inside `root`, at its end) that lets the page scroll the game's
 * last row out from under the bottom overlay: the overlay's height minus the page content below the game.
 */
function overlayPad(root: HTMLElement): number {
   const vh = window.visualViewport?.height ?? window.innerHeight;
   const overlay = Math.max(0, vh - visibleBottom());
   if (overlay === 0) return 0;
   const docH = document.documentElement.scrollHeight;
   const below = docH - (root.getBoundingClientRect().bottom + window.scrollY); // page content under the game
   return Math.max(0, Math.ceil(overlay - below));
}

/**
 * Brings the play area into view whenever `active` turns on or `key` changes (pass the game state
 * and level, so the round, the level card and the result all come into view). `bottomRef` falls back
 * to `topRef` while it is not mounted. Returns the height of a spacer to render at the end of the
 * game's root (`<div style={{ height: pad }} aria-hidden="true" />`).
 */
export function usePlayAreaInView(
   topRef: RefObject<HTMLElement>,
   bottomRef: RefObject<HTMLElement> | null,
   active: boolean,
   key?: unknown
): number {
   const [pad, setPad] = useState(0);

   // keep the spacer in step with the overlay (the cookie banner closes, the bar hides)
   useEffect(() => {
      let current = 0;
      const update = () => {
         const root = topRef.current;
         if (!root) return;
         const next = overlayPad(root);
         if (Math.abs(next - current) > 2) {
            current = next;
            setPad(next);
         }
      };
      update();
      const id = window.setInterval(update, 1000);
      window.addEventListener("resize", update);
      return () => {
         window.clearInterval(id);
         window.removeEventListener("resize", update);
      };
   }, [topRef]);

   useEffect(() => {
      if (!active) return;
      // After layout (the play area mounts in the same commit that starts the round), and again
      // shortly after: the game shell focuses its container at the start, and that focus scroll can
      // cancel a smooth scroll. Each pass is a no-op once everything is on screen.
      const ids = [60, 350, 800].map((ms) =>
         window.setTimeout(() => {
            const top = topRef.current;
            if (top) bringIntoView(top, bottomRef?.current ?? top);
         }, ms)
      );
      return () => ids.forEach((id) => window.clearTimeout(id));
   }, [active, key]); // the refs are stable; re-run only when a round starts or the level changes

   return pad;
}
