"use client";

// The shared Menu 2 hero picker (README.md), rendered by a game's Hud. Reachable between runs: on
// the start card, on the result screen and in the pause menu (never during play: the pick is the
// next run's option). Portaled to the page above the shell's overlays, top-right.
// - Wide screens: the row of heroes (name + power) is always open.
// - Phones / narrow windows: a "change hero" chip (the current hero) opens a sheet of 44 px+ cards.
// Esc or a tap outside closes the sheet; a pick closes it too.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { isResultShown } from "@/arcade3d/core/frameLoop";
import type { M2HeroId } from "../heroModels";
import styles from "./HeroPicker.module.css";

export interface HeroOption {
   id: M2HeroId;
   name: string;
   color: string;
   /** short power label ("Dash") */
   powerLabel: string;
}

export interface HeroPickerProps {
   heroes: readonly HeroOption[];
   value: M2HeroId;
   onPick: (id: M2HeroId) => void;
   /** hide it (e.g. while a local multiplayer lobby or race is up) */
   hidden?: boolean;
   /** shown after the heroes (e.g. the start card's "2-4 players" button) */
   extra?: ReactNode;
}

/** Between runs: the start card, the pause menu, or the result screen. */
export function useBetweenRuns(): { open: boolean; next: boolean } {
   const phase = useArcadeStore((s) => s.phase);
   const result = useArcadeStore((s) => isResultShown(s));
   const open = phase === "ready" || phase === "paused" || result;
   return { open, next: phase === "paused" || result };
}

export default function HeroPicker({ heroes, value, onPick, hidden = false, extra }: HeroPickerProps) {
   const { open, next } = useBetweenRuns();
   const [sheet, setSheet] = useState(false);
   const root = useRef<HTMLDivElement>(null);
   const current = heroes.find((h) => h.id === value) ?? heroes[0];

   useEffect(() => {
      if (!sheet) return;
      const onDown = (e: PointerEvent) => {
         if (root.current && e.target instanceof Node && !root.current.contains(e.target)) setSheet(false);
      };
      const onKey = (e: KeyboardEvent) => {
         if (e.key === "Escape") setSheet(false);
      };
      window.addEventListener("pointerdown", onDown, true);
      window.addEventListener("keydown", onKey, true);
      return () => {
         window.removeEventListener("pointerdown", onDown, true);
         window.removeEventListener("keydown", onKey, true);
      };
   }, [sheet]);
   useEffect(() => {
      if (!open) setSheet(false);
   }, [open]);

   if (!open || hidden || typeof document === "undefined" || !current) return null;
   return createPortal(
      <div ref={root} className={`${styles.picker} ${sheet ? styles.sheetOpen : ""}`} data-hero-picker="">
         <button
            type="button"
            className={styles.chip}
            aria-expanded={sheet}
            aria-label={`Change hero: ${current.name}, ${current.powerLabel}`}
            onClick={() => setSheet((v) => !v)}
         >
            <span className={styles.swatch} style={{ background: current.color }} aria-hidden="true" />
            <span className={styles.chipText}>
               <span className={styles.chipLabel}>{next ? "Next hero" : "Hero"}</span>
               <span className={styles.chipName}>{current.name}</span>
            </span>
            <svg className={styles.caret} viewBox="0 0 12 12" aria-hidden="true">
               <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
         </button>
         <div className={styles.row} role="group" aria-label={next ? "Choose your hero for the next run" : "Choose your hero"}>
            <span className={styles.label}>{next ? "Next run" : "Hero"}</span>
            {heroes.map((h) => (
               <button
                  key={h.id}
                  type="button"
                  className={h.id === value ? styles.heroOn : styles.hero}
                  aria-label={`${h.name}, ${h.powerLabel}`}
                  aria-pressed={h.id === value}
                  onClick={() => {
                     onPick(h.id);
                     setSheet(false);
                  }}
               >
                  <span className={styles.swatch} style={{ background: h.color }} aria-hidden="true" />
                  <span className={styles.name}>{h.name}</span>
                  <span className={styles.power}>{h.powerLabel}</span>
               </button>
            ))}
            {extra}
         </div>
      </div>,
      document.body,
   );
}
