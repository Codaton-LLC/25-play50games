"use client";

// The orbit camera's HUD parts, rendered by a game's Hud (outside the Canvas):
// - on touch, a small "recenter camera" button above the Jump / Power buttons, clear of the cookie
//   banner (it rides the shell's --arcade-bottom-obstruction like the touch controls);
// - once ever (orbitPrefs `hintSeen`), a hint while the first run plays: "Drag to look around" on
//   desktop, "Two fingers to rotate" on touch. It hides after HINT_MS or on the first manual turn.
// Neither takes input meant for the game: the button is marked as touch controls (core input skips
// it), the hint lets every pointer through.
import { useEffect, useState, useSyncExternalStore } from "react";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { CONTROLS_ATTR } from "@/arcade3d/core/input";
import { SAFE_AREA_ATTR } from "@/arcade3d/core/safeArea";
import { markOrbitHintSeen, orbitPrefs, orbitTurned, requestOrbitRecenter, subscribeOrbitTurned } from "./orbitPrefs";
import styles from "./OrbitHud.module.css";

/** How long the first-time hint stays up (ms of a playing run). */
export const HINT_MS = 6000;

export const HINT_TEXT = {
   desktop: { title: "Drag to look around", detail: "Mouse wheel zooms · Q / C turn · R / F tilt · V recenters" },
   touch: { title: "Two fingers to rotate", detail: "Drag the view to look around · pinch to zoom" },
} as const;

function RecenterButton() {
   return (
      <button
         type="button"
         className={styles.recenter}
         aria-label="Recenter camera"
         title="Recenter camera"
         tabIndex={-1}
         {...{ [CONTROLS_ATTR]: "", [SAFE_AREA_ATTR]: "" }}
         onPointerDown={(e) => {
            e.preventDefault();
            requestOrbitRecenter();
         }}
         onContextMenu={(e) => e.preventDefault()}
      >
         <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
            <path d="M12 4a8 8 0 1 1-7.4 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M3 4.5 L4.6 9.6 L9.4 7.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="2.6" fill="currentColor" />
         </svg>
      </button>
   );
}

function Hint({ touch }: { touch: boolean }) {
   const turned = useSyncExternalStore(subscribeOrbitTurned, orbitTurned, () => 0);
   const playing = useArcadeStore((s) => s.phase === "playing");
   const expired = useArcadeStore((s) => s.phase === "playing" && s.elapsedMs >= HINT_MS);
   // "idle" until the first playing frame; "on" when this is the first time ever; "done" after it hid
   const [stage, setStage] = useState<"idle" | "on" | "done">("idle");
   useEffect(() => {
      if (stage !== "idle" || !playing) return;
      // the hint counts as seen as soon as it is up: it is shown once, never again
      if (orbitPrefs().hintSeen) setStage("done");
      else {
         markOrbitHintSeen();
         setStage("on");
      }
   }, [stage, playing]);
   const show = stage === "on" && playing && turned === 0 && !expired;
   useEffect(() => {
      if (stage === "on" && (turned > 0 || expired)) setStage("done");
   }, [stage, turned, expired]);
   if (!show) return null;
   const text = touch ? HINT_TEXT.touch : HINT_TEXT.desktop;
   return (
      <div className={styles.hint} role="status" aria-live="polite">
         <span className={styles.hintTitle}>{text.title}</span>
         <span className={styles.hintDetail}>{text.detail}</span>
      </div>
   );
}

export interface OrbitHudProps {
   /** show the recenter button on touch (default true) */
   recenter?: boolean;
   /** show the first-time hint (default true) */
   hint?: boolean;
}

export default function OrbitHud({ recenter = true, hint = true }: OrbitHudProps) {
   const touch = useCoarsePointer();
   const live = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   return (
      <>
         {recenter && touch && live && <RecenterButton />}
         {hint && <Hint touch={touch} />}
      </>
   );
}
