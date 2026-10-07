"use client";

// First focus for the shell's overlays (start card, pause, error, result). React's autoFocus calls
// focus() without options, and the browser then scrolls the overlay to bring the button into view:
// on a landscape phone the start card opened ~300 px down, its title and instructions off screen.
// These focus without scrolling anything; the overlay's layout keeps the button on screen instead
// (GameShell.module.css: the panel never outgrows the free area, the start card pins Play).
import { useEffect, type RefObject } from "react";

export interface Focusable {
   focus(options?: FocusOptions): void;
}

/** Focuses `target` without scrolling any of its ancestors. false when there is nothing to focus. */
export function focusWithoutScroll(target: Focusable | null | undefined): boolean {
   if (!target) return false;
   target.focus({ preventScroll: true });
   return true;
}

/** Focuses the element once when it mounts, without scrolling (use instead of autoFocus). */
export function useInitialFocus(ref: RefObject<Focusable | null>): void {
   useEffect(() => {
      focusWithoutScroll(ref.current);
   }, [ref]);
}
