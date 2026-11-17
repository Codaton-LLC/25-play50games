// HintLine's pure parts (HintLine.tsx): when the one-line hint is up, and a tiny external store
// (createHudSignal) a Scene writes and a game Hud reads, so the Scene can say what the player is
// doing ("Carrying 2 / 2") without a React render per frame. Three-free; clarity.test.ts pins it.
import type { RunPhase } from "../types";

/** The first hint of a run stays up this long (run ms, from the start of the countdown). */
export const HINT_FIRST_MS = 8000;
/** A new objective's hint stays up this long after it changes (run ms). */
export const HINT_AGAIN_MS = 4000;

export type HintTone = "info" | "carry" | "ready" | "warn";

export interface HintState {
   /** the line; null or "" = nothing to say */
   text: string | null;
   /** what the line is about; a new key shows the line again (default: the text itself) */
   key?: string;
   tone?: HintTone;
   /** keep it up for as long as it is the current hint (a warning, "Hold still…") */
   sticky?: boolean;
}

export interface HintMark {
   key: string;
   runId: number;
   /** run ms the key became current */
   atMs: number;
   /** the run's first key (shown for HINT_FIRST_MS from 0) */
   first: boolean;
}

/** The mark after this render: a new run starts over, a new key restarts the timer. */
export function nextHintMark(prev: HintMark | null, key: string, runId: number, elapsedMs: number): HintMark {
   if (!prev || prev.runId !== runId || elapsedMs < prev.atMs) return { key, runId, atMs: 0, first: true };
   if (prev.key === key) return prev;
   return { key, runId, atMs: elapsedMs, first: false };
}

/** Is the hint shown now? Only while the run can be seen (countdown, playing, paused). */
export function hintVisible(
   phase: RunPhase,
   elapsedMs: number,
   mark: HintMark,
   sticky = false,
   firstMs = HINT_FIRST_MS,
   againMs = HINT_AGAIN_MS
): boolean {
   if (phase !== "countdown" && phase !== "playing" && phase !== "paused") return false;
   if (sticky) return true;
   const age = elapsedMs - mark.atMs;
   if (mark.first) return age < firstMs;
   return age >= 0 && age < againMs;
}

export interface HudSignal<T> {
   get(): T;
   /** replaces the value; listeners run only when `same` says it changed */
   set(value: T): void;
   subscribe(listener: () => void): () => void;
   /** back to the initial value (a Scene's unmount) */
   reset(): void;
}

/** A value a Scene writes every frame and a Hud reads with useHudSignal (HintLine.tsx). */
export function createHudSignal<T>(initial: T, same: (a: T, b: T) => boolean = Object.is): HudSignal<T> {
   let value = initial;
   const listeners = new Set<() => void>();
   const emit = () => listeners.forEach((l) => l());
   return {
      get: () => value,
      set(next) {
         if (same(value, next)) return;
         value = next;
         emit();
      },
      subscribe(listener) {
         listeners.add(listener);
         return () => listeners.delete(listener);
      },
      reset() {
         if (same(value, initial)) return;
         value = initial;
         emit();
      },
   };
}

/** Equality for HintState values (createHudSignal(EMPTY_HINT, sameHint)). */
export function sameHint(a: HintState, b: HintState): boolean {
   return a.text === b.text && a.key === b.key && a.tone === b.tone && a.sticky === b.sticky;
}

export const EMPTY_HINT: HintState = { text: null };
