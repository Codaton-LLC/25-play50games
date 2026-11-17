"use client";

// Recipe rows. The shell draws Score, Time and (from level 2) Lives. Shapes match the shelf meshes.
import { useSyncExternalStore } from "react";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";
import { INGREDIENT_LOOK } from "./looks";
import type { Ingredient, Run } from "./rules";
import styles from "./Hud.module.css";

interface HudRow { steps: readonly Ingredient[]; at: number }

const TYPE_I: Record<Ingredient, number> = {
   mushroom: 1, crystal: 2, berry: 3, flower: 4, herb: 5, bottle: 6,
};

const rows: HudRow[] = [{ steps: [], at: 0 }, { steps: [], at: 0 }];
let rowCount = 0;
let carried: Ingredient | null = null;
let version = 0;
let lastSig = -2;
const listeners = new Set<() => void>();

function notify(): void {
   version += 1;
   for (const listener of listeners) listener();
}

/** Scene calls this every played frame. Re-renders the card only when the rows change. */
export function publishLab(run: Run | null): void {
   if (!run) {
      if (lastSig === -1) return;
      rowCount = 0;
      carried = null;
      lastSig = -1;
      notify();
      return;
   }
   let sig = run.carried ? TYPE_I[run.carried] : 0;
   let n = 0;
   for (let i = 0; i < run.recipes.length && n < 2; i++) {
      const recipe = run.recipes[i];
      if (!recipe.open || recipe.done) continue;
      sig = sig * 23 + (i + 1) * 8 + recipe.at + 1;
      n += 1;
   }
   sig = sig * 5 + n;
   if (sig === lastSig) return;
   lastSig = sig;
   carried = run.carried;
   rowCount = 0;
   for (let i = 0; i < run.recipes.length && rowCount < 2; i++) {
      const recipe = run.recipes[i];
      if (!recipe.open || recipe.done) continue;
      rows[rowCount].steps = recipe.steps;
      rows[rowCount].at = recipe.at;
      rowCount += 1;
   }
   notify();
}

const subscribe = (listener: () => void) => {
   listeners.add(listener);
   return () => listeners.delete(listener);
};
const snapshot = () => version;

function Shape({ type, now }: { type: Ingredient; now?: boolean }) {
   const look = INGREDIENT_LOOK[type];
   const cls = `${styles.swatch} ${styles[look.shape]}${now ? ` ${styles.now}` : ""}`;
   return <span className={cls} style={{ ["--swatch" as string]: look.color }} role="img" aria-label={type} />;
}

function Card() {
   useSyncExternalStore(subscribe, snapshot, snapshot);
   const open: HudRow[] = [];
   for (let i = 0; i < rowCount; i++) open.push(rows[i]);
   return (
      <div className={styles.card} data-arcade-safe-area>
         {open.map((row, index) => (
            <div className={styles.row} key={index}>
               <span className={styles.label}>{open.length > 1 ? `Recipe ${index + 1}` : "Next"}</span>
               <span className={styles.steps}>
                  {row.steps.slice(row.at).map((type, step) => (
                     <Shape key={`${type}-${step}`} type={type} now={step === 0} />
                  ))}
               </span>
            </div>
         ))}
         <div className={styles.row}>
            <span className={styles.label}>Carry</span>
            {carried ? <Shape type={carried} /> : <span className={styles.empty}>empty</span>}
         </div>
      </div>
   );
}

/** The recipe card, the hint line (guide.ts) and the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <Card />
         <HintLine signal={GUIDE} />
      </>
   );
}
