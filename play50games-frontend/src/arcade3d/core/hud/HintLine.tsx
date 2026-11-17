"use client";

// One contextual hint chip for a game's Hud ("Grab the milk (glowing)", "Carrying, drive to the
// checkout"). It is up for the first HINT_FIRST_MS of a run and again for HINT_AGAIN_MS whenever its
// key changes, then fades out; `sticky` keeps it up (a warning). The slot is a fixed box marked
// data-arcade-safe-area and laid out in every phase, so the camera fit never changes when a hint
// appears or goes: phones above the joystick (clear of it, the Jump / Action buttons and the 📷 button),
// desktop at the bottom centre, clear of the 📷 corner (HintLine.module.css). >= 13 px on phones.
//
//    const GUIDE = createHudSignal<HintState>(EMPTY_HINT, sameHint);   // module level, games/<slug>/guide.ts
//    GUIDE.set({ text: "Grab the glowing key", key: "key-0" });        // in the Scene's useRunFrame
//    <HintLine signal={GUIDE} />                                        // in definition.Hud
//    <HintLine text="Left / right, then Jump" />                        // or a fixed text
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useArcadeStore } from "../useArcadeStore";
import { EMPTY_HINT, hintVisible, nextHintMark, type HintMark, type HintState, type HintTone, type HudSignal } from "./hintTiming";
import styles from "./HintLine.module.css";

const NO_SIGNAL: HudSignal<HintState> = {
   get: () => EMPTY_HINT,
   set() {},
   subscribe: () => () => {},
   reset() {},
};

/** The current value of a HudSignal (re-renders when it changes). */
export function useHudSignal<T>(signal: HudSignal<T>): T {
   return useSyncExternalStore(signal.subscribe, signal.get, signal.get);
}

export interface HintLineProps {
   /** a live hint the Scene writes */
   signal?: HudSignal<HintState>;
   /** or a fixed text (used when there is no signal) */
   text?: string | null;
   tone?: HintTone;
   /** "bottom" (default) or "top": under the shell chips, for a game whose own panels use the bottom */
   placement?: "bottom" | "top";
   firstMs?: number;
   againMs?: number;
}

const TONE_CLASS: Record<HintTone, string> = {
   info: styles.info,
   carry: styles.carry,
   ready: styles.ready,
   warn: styles.warn,
};

export function HintLine({ signal, text, tone, placement = "bottom", firstMs, againMs }: HintLineProps) {
   const live = useHudSignal(signal ?? NO_SIGNAL);
   const hint: HintState = signal ? live : { text: text ?? null, tone };
   const message = hint.text || "";
   const key = hint.key ?? message;
   const runId = useArcadeStore((s) => s.runId);
   const mark = useRef<HintMark | null>(null);
   // the mark only moves forward (new run, new key); computing it in render keeps the first frame right
   const markNow = nextHintMark(mark.current, key, runId, useArcadeStore.getState().elapsedMs);
   useEffect(() => {
      mark.current = markNow;
   });
   const shown = useArcadeStore((s) => message !== "" && hintVisible(s.phase, s.elapsedMs, markNow, hint.sticky, firstMs, againMs));
   const toneClass = TONE_CLASS[hint.tone ?? "info"];
   return (
      <div className={`${styles.slot} ${placement === "top" ? styles.top : ""}`} data-arcade-safe-area="" role="status" aria-live="polite">
         <span className={`${styles.chip} ${toneClass} ${shown ? styles.shown : ""}`} aria-hidden={!shown || undefined}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.text}>{message}</span>
         </span>
      </div>
   );
}
