// The tag request between the HUD's portrait strip / the keys 1-5 and T and the simulation: latched for
// one frame, never lost (the same timing on touch and keyboard: a tap is one request, like a key press).
export const tagLatch = { value: -1 };

export function requestTag(hero: number): void {
   tagLatch.value = hero;
}

/** Reads and clears the request (-1 = none, 0..4 a hero, 5 = the next one). */
export function takeTag(): number {
   const v = tagLatch.value;
   tagLatch.value = -1;
   return v;
}

/** The keyboard: 1-5 pick a hero, T cycles (Q/Z/C/X/R/F/V belong to the orbit camera). Returns the cleanup. */
export function listenTagKeys(): () => void {
   const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = e.code.startsWith("Digit") ? Number(e.code.slice(5)) : NaN;
      if (n >= 1 && n <= 5) requestTag(n - 1);
      else if (e.code === "KeyT") requestTag(5);
   };
   window.addEventListener("keydown", onKey);
   return () => window.removeEventListener("keydown", onKey);
}
