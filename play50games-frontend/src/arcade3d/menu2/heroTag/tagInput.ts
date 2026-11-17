// World 6's tag input, shared by every W6 game: keys 1-5 tag that hero in (the Digit or the Numpad
// row, by physical key like core input's `digit`, so any keyboard layout works), T the next one in
// the roster (Shift+T the previous, unless a game turns that off), and the HUD's portrait strip pushes
// the same requests. One request is latched until the Scene takes it (once per frame), so a key pressed
// between frames is never lost and a tap is one request, like a key press (the same timing on touch
// and keyboard). Pure apart from the window listener in useTagKeys; the store is a tiny module
// singleton like the hero pick.
import { useEffect } from "react";
import { TAG_ORDER, type TagHeroId } from "./rules";

export type TagRequest = TagHeroId | "next" | "prev";

let pending: TagRequest | null = null;

/** Queue a tag (the last request in a frame wins). */
export function requestTag(r: TagRequest): void {
   pending = r;
}

/** The request since the last call, or null (clears it). */
export function takeTag(): TagRequest | null {
   const r = pending;
   pending = null;
   return r;
}

export function clearTag(): void {
   pending = null;
}

export interface TagKeyOptions {
   /** Shift+T tags the previous hero (default true); false: Shift+T is T (the next) */
   shiftPrev?: boolean;
}

/**
 * The key's request from its physical code (KeyboardEvent.code): Digit1-5 / Numpad1-5 a hero in
 * TAG_ORDER, KeyT the next (Shift+T the previous when `shiftPrev`); else null.
 */
export function tagForKey(code: string, shift = false, opts: TagKeyOptions = {}): TagRequest | null {
   const m = /^(?:Digit|Numpad)([1-5])$/.exec(code);
   if (m) return TAG_ORDER[Number(m[1]) - 1];
   if (code === "KeyT") return shift && (opts.shiftPrev ?? true) ? "prev" : "next";
   return null;
}

/** A request as a hero index in TAG_ORDER (0-4), or the cycle (+1 next, -1 previous). */
export function tagIndexOf(r: TagRequest): { hero: number; cycle: number } {
   if (r === "next") return { hero: -1, cycle: 1 };
   if (r === "prev") return { hero: -1, cycle: -1 };
   return { hero: TAG_ORDER.indexOf(r), cycle: 0 };
}

/** Listens for the tag keys while `active` (ignores typing in a field, auto-repeat and Ctrl/Alt/Meta). */
export function useTagKeys(active: boolean, opts: TagKeyOptions = {}): void {
   const shiftPrev = opts.shiftPrev ?? true;
   useEffect(() => {
      if (!active || typeof window === "undefined") return;
      const onKey = (e: KeyboardEvent) => {
         if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
         const t = e.target as HTMLElement | null;
         if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
         const r = tagForKey(e.code, e.shiftKey, { shiftPrev });
         if (r) requestTag(r);
      };
      window.addEventListener("keydown", onKey);
      return () => {
         window.removeEventListener("keydown", onKey);
         clearTag();
      };
   }, [active, shiftPrev]);
}
