"use client";

// The "How to play" walkthrough (core/README.md "How to play"): a modal sheet over the start card,
// one step at a time (the game's HowTo.steps: goal, move, main action, avoid / win, tips), each
// lighting its keys or touch controls in the illustration. Next / Back, step dots, Skip; on a
// phone a horizontal swipe turns the page; ← / → / Enter / Esc on a keyboard. The focus stays
// inside the sheet (Tab wraps) and goes back to the opener when it closes. Keys are caught in the
// capture phase so nothing behind the sheet sees them (the level tiles' digits, the shell's Esc).
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { focusWithoutScroll, useInitialFocus } from "../overlayFocus";
import type { HowTo } from "./howTo";
import { KeyboardDeck, PhoneDeck } from "./HowToVisuals";
import { ModeToggle, type HowToMode } from "./ControlsPanel";
import styles from "./HowTo.module.css";

export interface HowToWizardProps {
   title: string;
   howTo: HowTo;
   labels?: { jump?: string; action?: string };
   mode: HowToMode;
   onMode: (mode: HowToMode) => void;
   portrait?: boolean;
   /** closes the sheet (Skip, Esc, Done) */
   onClose: () => void;
}

const SWIPE_PX = 48;

export default function HowToWizard({ title, howTo, labels, mode, onMode, portrait, onClose }: HowToWizardProps) {
   const steps = howTo.steps;
   const [index, setIndex] = useState(0);
   const [dir, setDir] = useState<"next" | "back">("next");
   const sheetRef = useRef<HTMLDivElement>(null);
   const nextRef = useRef<HTMLButtonElement>(null);
   const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
   useInitialFocus(nextRef);

   const last = index === steps.length - 1;
   const step = steps[index];

   const go = (to: number) => {
      const clamped = Math.max(0, Math.min(steps.length - 1, to));
      if (clamped === index) return;
      setDir(clamped > index ? "next" : "back");
      setIndex(clamped);
   };
   const next = () => (last ? onClose() : go(index + 1));

   const state = useRef({ index, next, go, onClose });
   state.current = { index, next, go, onClose };

   useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
         const sheet = sheetRef.current;
         if (!sheet) return;
         const { index: at, next: forward, go: goTo, onClose: close } = state.current;
         const target = event.target as HTMLElement | null;
         const onControl = !!target && sheet.contains(target) && /^(BUTTON|A)$/.test(target.tagName);
         if (event.key === "Tab") {
            const items = Array.from(sheet.querySelectorAll<HTMLElement>("button:not([disabled]), [href]")).filter(
               (el) => el.offsetParent !== null
            );
            if (items.length === 0) return;
            const first = items[0];
            const end = items[items.length - 1];
            const active = document.activeElement as HTMLElement | null;
            if (event.shiftKey && (active === first || !sheet.contains(active))) {
               event.preventDefault();
               focusWithoutScroll(end);
            } else if (!event.shiftKey && (active === end || !sheet.contains(active))) {
               event.preventDefault();
               focusWithoutScroll(first);
            }
         } else if (event.key === "Escape") {
            event.preventDefault();
            close();
         } else if (event.key === "ArrowRight") {
            event.preventDefault();
            forward();
         } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            goTo(at - 1);
         } else if (event.key === "Enter" && !onControl) {
            event.preventDefault();
            forward();
         }
         // nothing behind the sheet reacts while it is open (digits pick levels, Esc / P pause)
         event.stopPropagation();
      };
      window.addEventListener("keydown", onKey, true);
      return () => window.removeEventListener("keydown", onKey, true);
   }, []);

   const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse") return;
      swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
   };
   const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = swipe.current;
      swipe.current = null;
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if (dx < 0) next();
      else go(index - 1);
   };

   const lit = mode === "keyboard" ? step.keys ?? [] : step.touch ?? [];
   const text = mode === "touch" ? step.touchText ?? step.text : step.text;

   return (
      <div
         className={styles.wizard}
         role="dialog"
         aria-modal="true"
         aria-labelledby="howto-title"
         aria-describedby="howto-text"
         // the start card's backdrop would scroll the card behind the sheet
         onWheel={(event) => event.stopPropagation()}
      >
         <div
            ref={sheetRef}
            className={styles.sheet}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
               swipe.current = null;
            }}
         >
            <div className={styles.sheetTop}>
               <span className={styles.progress} aria-hidden="true">
                  <span className={styles.progressFill} style={{ transform: `scaleX(${(index + 1) / steps.length})` }} />
               </span>
               <span className={styles.counter}>
                  {index + 1} / {steps.length}
               </span>
               <ModeToggle mode={mode} onMode={onMode} />
               <button type="button" className={styles.skip} onClick={onClose}>
                  {last ? "Close" : "Skip"}
               </button>
            </div>

            <div className={styles.sheetBody}>
               <p className={styles.sheetGame}>How to play · {title}</p>

               <div className={styles.stage}>
                  {mode === "keyboard" ? (
                     <KeyboardDeck keys={howTo.keys} lit={lit} large />
                  ) : (
                     <PhoneDeck touch={howTo.touch} labels={labels} lit={lit} portrait={portrait} />
                  )}
               </div>

               <div key={`${index}-${mode}`} className={`${styles.step} ${styles.stepIn}`} data-dir={dir} aria-live="polite">
                  <span className={styles.stepNumber} aria-hidden="true">
                     {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 id="howto-title" className={styles.stepTitle}>
                     {step.title}
                  </h2>
                  <p id="howto-text" className={styles.stepText}>
                     {text}
                  </p>
               </div>
            </div>

            <div className={styles.sheetFoot}>
               <button type="button" className={`${styles.navButton} ${styles.back}`} onClick={() => go(index - 1)} disabled={index === 0} aria-label="Back">
                  <ArrowLeftIcon aria-hidden="true" /> <span className={styles.navText}>Back</span>
               </button>
               <div className={styles.dots}>
                  {steps.map((s, i) => (
                     <button
                        key={s.title + i}
                        type="button"
                        className={styles.dot}
                        aria-label={`Step ${i + 1}: ${s.title}`}
                        aria-current={i === index ? "step" : undefined}
                        onClick={() => go(i)}
                     />
                  ))}
               </div>
               <button ref={nextRef} type="button" className={`${styles.navButton} ${styles.next}`} onClick={next}>
                  {last ? "Got it" : "Next"} {!last && <ArrowRightIcon aria-hidden="true" />}
               </button>
            </div>
            <p className={styles.keyHint} aria-hidden="true">
               <kbd>←</kbd> <kbd>→</kbd> to move · <kbd>Esc</kbd> to close
            </p>
         </div>
      </div>
   );
}
