"use client";

import type { ReactNode } from "react";
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { PIECE_NAME } from "./rules";
import { markerColor, RATING_NAME } from "./dropGuide";
import styles from "./Hud.module.css";

const BUILDING = ["House", "Shop", "Tower"];

function useStat(key: string, fallback = 0): number {
   return useArcadeStore((s) => s.stats[key] ?? fallback);
}

/**
 * The blueprint line: what to do now. Line 1 names the step (pick this pile / carry it to the
 * slot); line 2 is the next action (move over the pile, press, hold still, swing out, drop).
 * The shell draws time, stability, building and swing. Scene writes the hidden stats it reads.
 */
function GameHud() {
   const piece = useStat("piece", 1);
   const building = useStat("building", 1);
   const carry = useStat("carry");
   const hover = useStat("hover");
   const armed = useStat("armed");
   const gate = useStat("gate");
   const rate = useStat("rate", 3);
   const lock = useStat("lock");
   const cheer = useStat("cheer");
   const kind = Math.min(4, Math.max(0, piece - 1));
   const name = PIECE_NAME[kind] ?? "Slab";
   const site = BUILDING[Math.min(2, Math.max(0, building - 1))] ?? "House";

   let tone = styles.pill;
   let head: ReactNode;
   let tip: ReactNode;
   if (cheer) {
      tone = `${styles.pill} ${styles.good}`;
      head = <span>Building done! +500</span>;
      tip = <span className={styles.tip}>Next: {site}</span>;
   } else if (lock && !carry) {
      tone = `${styles.pill} ${styles.bad}`;
      head = <span>Wrong pile! -1 s</span>;
      tip = (
         <span className={styles.tip}>
            Pick <span className={styles.name}>{name}</span> (key {kind + 1})
         </span>
      );
   } else if (carry) {
      const carried = PIECE_NAME[Math.min(4, carry - 1)] ?? name;
      head = (
         <span>
            Carrying <span className={styles.name}>{carried}</span> → swing to the glowing slot
         </span>
      );
      tip = gate ? (
         <span className={styles.ready}>
            Drop ready (Space / Action) ·{" "}
            <span style={{ color: markerColor(rate) }}>{RATING_NAME[rate] ?? "Miss"}</span>
         </span>
      ) : (
         <span className={styles.tip}>Move out to the slot</span>
      );
   } else {
      head = (
         <span>
            {site} · Pick: <span className={styles.name}>{name}</span> (key {kind + 1})
         </span>
      );
      if (hover === kind + 1) {
         tip = armed ? (
            <span className={styles.ready}>Grabbing… hold the hook still</span>
         ) : (
            <span className={styles.ready}>Press {kind + 1} or Action to grab</span>
         );
      } else if (hover > 0) {
         tip = <span className={styles.warn}>Wrong pile: move to the glowing one</span>;
      } else {
         tip = <span className={styles.tip}>Move the hook over the glowing pile {kind + 1}</span>;
      }
   }

   return (
      <div className={styles.slot} data-arcade-safe-area>
         <p className={tone}>
            {head}
            {tip}
         </p>
      </div>
   );
}

export function Hud() {
   return (
      <>
         <CameraViewButton />
         <GameHud />
      </>
   );
}
