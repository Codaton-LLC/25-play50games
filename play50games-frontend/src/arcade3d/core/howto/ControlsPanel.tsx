"use client";

// The start card's controls block (core/README.md "How to play"): a Keyboard | Touch switch, the
// matching illustration (KeyboardDeck / PhoneDeck) and the "How to play" button that opens the
// wizard. Touch devices open on Touch, everything else on Keyboard; the switch changes both the
// card and the wizard. Menu 2 mounts the same component with its own HowToSource.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon, PlayCircleIcon } from "@heroicons/react/24/solid";
import { focusWithoutScroll } from "../overlayFocus";
import { resolveHowTo, type HowToSource } from "./howTo";
import { KeyboardDeck, PhoneDeck } from "./HowToVisuals";
import HowToWizard from "./HowToWizard";
import styles from "./HowTo.module.css";

export type HowToMode = "keyboard" | "touch";

/** The default view: Touch on a coarse pointer (phones, tablets), Keyboard otherwise. */
export const defaultMode = (coarse: boolean): HowToMode => (coarse ? "touch" : "keyboard");

function KeyboardIcon() {
   return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
         <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
         <path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8" strokeLinecap="round" />
      </svg>
   );
}

function PhoneIcon() {
   return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
         <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
         <path d="M10.5 18.5h3" strokeLinecap="round" />
      </svg>
   );
}

export function ModeToggle({ mode, onMode }: { mode: HowToMode; onMode: (mode: HowToMode) => void }) {
   return (
      <div className={styles.toggle} role="group" aria-label="Show controls for" data-mode={mode}>
         <button type="button" className={styles.toggleButton} aria-pressed={mode === "keyboard"} aria-label="Keyboard" onClick={() => onMode("keyboard")}>
            <KeyboardIcon />
            <span>Keyboard</span>
         </button>
         <button type="button" className={styles.toggleButton} aria-pressed={mode === "touch"} aria-label="Touch" onClick={() => onMode("touch")}>
            <PhoneIcon />
            <span>Touch</span>
         </button>
      </div>
   );
}

export interface ControlsPanelProps {
   title: string;
   source: HowToSource;
   coarse: boolean;
   /** meta.orientation === "portrait": the phone is drawn upright */
   portrait?: boolean;
}

export default function ControlsPanel({ title, source, coarse, portrait }: ControlsPanelProps) {
   const howTo = useMemo(() => resolveHowTo(source), [source]);
   const [picked, setPicked] = useState<HowToMode | null>(null);
   const [open, setOpen] = useState(false);
   const openerRef = useRef<HTMLButtonElement>(null);
   const wasOpen = useRef(false);
   const mode = picked ?? defaultMode(coarse);

   // back to the opener once the wizard closes
   useEffect(() => {
      if (wasOpen.current && !open) focusWithoutScroll(openerRef.current);
      wasOpen.current = open;
   }, [open]);

   const firstSteps = howTo.steps.map((step) => step.title).slice(0, 3).join(" · ");

   return (
      <section className={styles.block} aria-label="Controls">
         <div className={styles.head}>
            <h2 className={styles.eyebrow}>Controls</h2>
            <ModeToggle mode={mode} onMode={setPicked} />
         </div>
         <div key={mode} className={`${styles.stage} ${styles.stageIn}`}>
            {mode === "keyboard" ? (
               <KeyboardDeck keys={howTo.keys} />
            ) : (
               <PhoneDeck touch={howTo.touch} labels={source.touchLabels} portrait={portrait} />
            )}
         </div>
         <button ref={openerRef} type="button" className={styles.howButton} onClick={() => setOpen(true)} aria-haspopup="dialog">
            <span className={styles.howIcon}>
               <PlayCircleIcon aria-hidden="true" />
            </span>
            <span className={styles.howText}>
               <span className={styles.howTitle}>How to play</span>
               <span className={styles.howSub}>
                  {howTo.steps.length} steps · {firstSteps}
               </span>
            </span>
            <ChevronRightIcon className={styles.howArrow} aria-hidden="true" />
         </button>
         {open && (
            <HowToWizard
               title={title}
               howTo={howTo}
               labels={source.touchLabels}
               mode={mode}
               onMode={setPicked}
               portrait={portrait}
               onClose={() => setOpen(false)}
            />
         )}
      </section>
   );
}
