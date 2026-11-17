"use client";

// The camera views' HUD part, rendered by a game's Hud (outside the Canvas) next to useCameraViews
// in its Scene (README.md):
// - the 📷 button (44 px, touch and desktop) that cycles the views; its tooltip names the key (C).
//   It sits on the right, above the touch Jump / Action buttons on touch and in the bottom-right
//   corner on desktop, both riding the cookie banner's lift (--arcade-bottom-obstruction). It is a
//   safe-area panel (fitted views keep clear of it) and a touch control (core input skips it).
// - a short label with the new view's name after each switch;
// - once ever (cameraPrefs `hintSeen`), a hint while the first run plays:
//   "📷 / C: change view; drag to look around". It hides after HINT_MS or on the first switch or turn.
//   It sits at the top right under the shell chips (hintSpot.ts), stepping past HUD panels and touch
//   controls, never over the middle of the screen where the hero is.
// Nothing is shown while no Scene uses camera views, so a game can render it unconditionally.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { useArcadeStore } from "../useArcadeStore";
import { useCoarsePointer } from "../TouchControls";
import { CONTROLS_ATTR } from "../input";
import { SAFE_AREA_ATTR, useSafeArea } from "../safeArea";
import { cameraHintSpot } from "./hintSpot";
import { cameraPrefs, cameraTurned, liveViews, markCameraHintSeen, requestViewCycle, serverLiveViews, subscribeLiveViews } from "./cameraPrefs";
import { VIEW_LABELS, nextView } from "./views";
import styles from "./CameraViewButton.module.css";

/** How long the first-time hint stays up (ms of a playing run). */
export const HINT_MS = 7000;
/** How long the view's name shows after a switch (ms). */
export const LABEL_MS = 1400;

export function hintText(touch: boolean, key: string, oneFinger: boolean, leftDrag = true): string {
   if (touch) return oneFinger ? "📷: change view; drag to look around" : "📷: change view; two fingers to look around";
   return `📷 / ${key}: change view; ${leftDrag ? "drag" : "right-drag"} to look around`;
}

function Hint({ touch, keyName, oneFinger, leftDrag }: { touch: boolean; keyName: string; oneFinger: boolean; leftDrag: boolean }) {
   const turned = useSyncExternalStore(subscribeLiveViews, cameraTurned, () => 0);
   const playing = useArcadeStore((s) => s.phase === "playing");
   const expired = useArcadeStore((s) => s.phase === "playing" && s.elapsedMs >= HINT_MS);
   const [stage, setStage] = useState<"idle" | "on" | "done">("idle");
   useEffect(() => {
      if (stage !== "idle" || !playing) return;
      // seen as soon as it is up: shown once, never again
      if (cameraPrefs().hintSeen) setStage("done");
      else {
         markCameraHintSeen();
         setStage("on");
      }
   }, [stage, playing]);
   useEffect(() => {
      if (stage === "on" && (turned > 0 || expired)) setStage("done");
   }, [stage, turned, expired]);
   if (!(stage === "on" && playing && turned === 0 && !expired)) return null;
   return <HintChip text={hintText(touch, keyName, oneFinger, leftDrag)} />;
}

/** The chip, placed by hintSpot.ts from the live safe area and its own measured size. */
function HintChip({ text }: { text: string }) {
   const area = useSafeArea();
   const ref = useRef<HTMLDivElement>(null);
   const [size, setSize] = useState({ w: 0, h: 0 });
   useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const w = Math.ceil(el.offsetWidth);
      const h = Math.ceil(el.offsetHeight);
      if (w !== size.w || h !== size.h) setSize({ w, h });
   });
   const spot = cameraHintSpot(area, size.w, size.h);
   return (
      <div
         ref={ref}
         className={styles.hint}
         style={{ left: spot.left, top: spot.top, visibility: size.w > 0 ? "visible" : "hidden" }}
         role="status"
         aria-live="polite"
      >
         {text}
      </div>
   );
}

export interface CameraViewButtonProps {
   /** extra placement for a game whose HUD sits where the button would (e.g. `{ bottom: "..." }`) */
   style?: CSSProperties;
   /** show the first-time hint (default true) */
   hint?: boolean;
}

export default function CameraViewButton({ style, hint = true }: CameraViewButtonProps) {
   const views = useSyncExternalStore(subscribeLiveViews, liveViews, serverLiveViews);
   const touch = useCoarsePointer();
   const live = useArcadeStore((s) => s.phase === "playing" || s.phase === "countdown");
   const [label, setLabel] = useState<string | null>(null);
   const last = useRef(views.current);
   useEffect(() => {
      if (views.current === last.current) return;
      last.current = views.current;
      setLabel(VIEW_LABELS[views.current]);
      const t = window.setTimeout(() => setLabel(null), LABEL_MS);
      return () => window.clearTimeout(t);
   }, [views.current]);
   if (views.list.length < 2 || !live) return null;
   const next = VIEW_LABELS[nextView(views.list, views.current)];
   const title = `Change view (${views.key}): ${VIEW_LABELS[views.current]}, next ${next}`;
   return (
      <>
         <button
            type="button"
            className={touch ? `${styles.button} ${styles.touch}` : styles.button}
            style={style}
            aria-label={title}
            title={title}
            tabIndex={-1}
            {...{ [CONTROLS_ATTR]: "", [SAFE_AREA_ATTR]: "", "data-camera-views": views.current }}
            onPointerDown={(e) => {
               e.preventDefault();
               e.stopPropagation();
               requestViewCycle();
            }}
            onContextMenu={(e) => e.preventDefault()}
         >
            {/* drawn, not the emoji glyph: some phones and headless browsers have no colour emoji font */}
            <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
               <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.3-2h6l1.3 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
               <circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
            </svg>
         </button>
         {label && (
            <div className={touch ? `${styles.label} ${styles.touchLabel}` : styles.label} aria-hidden="true">
               {label}
            </div>
         )}
         {hint && <Hint touch={touch} keyName={views.key} oneFinger={views.oneFinger} leftDrag={views.leftDrag ?? true} />}
      </>
   );
}
