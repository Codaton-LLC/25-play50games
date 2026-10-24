"use client";

// The start card's level picker (docs/arcade-levels.md §2.1; core/README.md "Levels"): five tiles
// in a radio group (arrow keys, Home/End and the digits 1-5 move the choice; one tab stop), each
// with its number, title, best on that level and a check (cleared) or a lock (locked). A locked
// tile can be picked to read how it unlocks; Play stays disabled on it (StartCard). Under the row:
// the picked level's description or its unlock hint, then the total and how many levels are
// cleared. On a phone the row scrolls sideways inside the card (no page scroll); tiles are at
// least 44 px.
import { useEffect, useRef, type KeyboardEvent } from "react";
import { CheckIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import type { ArcadeGameMeta, LevelId } from "../types";
import { levelsOf } from "../levelMeta";
import { levelBestText, levelClearedText, levelTotalText, type LevelProgressSummary } from "./levelProgress";
import { focusWithoutScroll } from "./overlayFocus";
import styles from "./LevelTiles.module.css";

export interface LevelTilesProps {
   meta: ArcadeGameMeta;
   progress: LevelProgressSummary;
   selected: LevelId;
   /** the picked level's LevelSpec.description */
   description?: string;
   onSelect: (id: LevelId) => void;
}

function isEditable(target: EventTarget | null): boolean {
   if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
   return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
}

/** The unlock hint of a locked level: "Clear level 2 to unlock". */
export const unlockHint = (id: LevelId): string => `Clear level ${id - 1} to unlock`;

export default function LevelTiles({ meta, progress, selected, description, onSelect }: LevelTilesProps) {
   const tileRefs = useRef<Array<HTMLButtonElement | null>>([]);
   const ids = progress.levels.map((level) => level.id);
   const current = progress.levels.find((level) => level.id === selected) ?? progress.levels[0];
   const scorings = levelsOf(meta);
   const onSelectRef = useRef(onSelect);
   onSelectRef.current = onSelect;
   const idKey = ids.join(",");

   // digits 1-5 pick a level while the start card is up (never while typing)
   useEffect(() => {
      const onKey = (event: globalThis.KeyboardEvent) => {
         if (event.altKey || event.ctrlKey || event.metaKey || isEditable(event.target)) return;
         const match = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
         const id = match ? Number(match[1]) : NaN;
         if (!idKey.split(",").map(Number).includes(id)) return;
         event.preventDefault();
         onSelectRef.current(id as LevelId);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
   }, [idKey]);

   const move = (event: KeyboardEvent<HTMLDivElement>) => {
      const index = ids.indexOf(selected);
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % ids.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = ids.length - 1;
      else return;
      event.preventDefault();
      onSelect(ids[next]);
      focusWithoutScroll(tileRefs.current[next] ?? null);
   };

   return (
      <section className={styles.levels} aria-label="Levels">
         <div className={styles.row} role="radiogroup" aria-label="Choose a level" onKeyDown={move}>
            {progress.levels.map((level, index) => {
               const isSelected = level.id === selected;
               const scoring = scorings[index]?.scoring ?? meta.scoring;
               const state = !level.unlocked ? "locked" : level.cleared ? "cleared" : "open";
               return (
                  <button
                     key={level.id}
                     ref={(node) => {
                        tileRefs.current[index] = node;
                     }}
                     type="button"
                     role="radio"
                     aria-checked={isSelected}
                     aria-label={`Level ${level.id}, ${level.title}${state === "locked" ? ", locked" : state === "cleared" ? ", cleared" : ""}`}
                     tabIndex={isSelected ? 0 : -1}
                     className={`${styles.tile} ${isSelected ? styles.selected : ""}`}
                     data-state={state}
                     onClick={() => onSelect(level.id)}
                  >
                     <span className={styles.top}>
                        <span className={styles.number}>{level.id}</span>
                        {state === "cleared" ? <CheckIcon className={styles.icon} aria-hidden="true" /> : null}
                        {state === "locked" ? <LockClosedIcon className={styles.icon} aria-hidden="true" /> : null}
                     </span>
                     <span className={styles.title}>{level.title}</span>
                     <span className={styles.best}>{levelBestText(level, scoring)}</span>
                  </button>
               );
            })}
         </div>
         <p className={styles.description} aria-live="polite">
            {current && !current.unlocked ? unlockHint(current.id) : description}
         </p>
         <p className={styles.total}>
            {levelTotalText(meta, progress)} · {levelClearedText(progress)}
         </p>
      </section>
   );
}
