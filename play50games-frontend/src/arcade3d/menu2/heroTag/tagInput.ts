// World 6's tag input: keys 1-5 tag that hero in, T the next one in the roster, and the HUD's portrait
// strip pushes the same requests. One request is latched until the Scene takes it (once per frame),
// so a key pressed between frames is never lost, like core input's one-frame presses. Pure apart from
// the window listener in useTagKeys; the store is a tiny module singleton like the hero pick.
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

/** The key's request: 1-5 a hero in TAG_ORDER, T the next, Shift+T the previous; else null. */
export function tagForKey(key: string, shift = false): TagRequest | null {
   if (key.length === 1 && key >= "1" && key <= "5") return TAG_ORDER[Number(key) - 1];
   if (key === "t" || key === "T") return shift ? "prev" : "next";
   return null;
}

/** Listens for the tag keys while `active` (ignores typing in a field and auto-repeat). */
export function useTagKeys(active: boolean): void {
   useEffect(() => {
      if (!active || typeof window === "undefined") return;
      const onKey = (e: KeyboardEvent) => {
         if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
         const t = e.target as HTMLElement | null;
         if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
         const r = tagForKey(e.key, e.shiftKey);
         if (r) requestTag(r);
      };
      window.addEventListener("keydown", onKey);
      return () => {
         window.removeEventListener("keydown", onKey);
         clearTag();
      };
   }, [active]);
}
