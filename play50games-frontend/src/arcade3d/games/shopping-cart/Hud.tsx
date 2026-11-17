"use client";

// The shopping list (taken items ticked, the beacon's item ringed), the Ride state, the hint line
// (guide.ts) and the core 📷 camera-view button. Score, time and Items are the shell's chips.
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine, useHudSignal } from "@/arcade3d/core/hud/HintLine";
import { useCoarsePointer } from "@/arcade3d/core/TouchControls";
import { GUIDE, LIST, PRODUCT_ICONS, PRODUCT_NAMES } from "./guide";
import styles from "./Hud.module.css";

function ShoppingList() {
   const list = useHudSignal(LIST);
   const touch = useCoarsePointer();
   if (list.kinds.length === 0) return <div className={styles.panel} data-arcade-safe-area="" aria-hidden />;
   return (
      <div className={styles.panel} data-arcade-safe-area="">
         <div className={styles.title}>Shopping list</div>
         <ul className={styles.items} aria-label="Shopping list">
            {list.kinds.map((kind, i) => {
               const taken = (list.taken & (1 << i)) !== 0;
               const next = i === list.next;
               return (
                  <li
                     key={i}
                     className={`${styles.item} ${taken ? styles.taken : ""} ${next ? styles.next : ""}`}
                     title={`${PRODUCT_NAMES[kind]}${taken ? " (in the cart)" : next ? " (next)" : ""}`}
                  >
                     <span aria-hidden="true">{PRODUCT_ICONS[kind]}</span>
                     {taken && <span className={styles.tick} aria-hidden="true">✓</span>}
                     <span className={styles.sr}>{PRODUCT_NAMES[kind]}{taken ? " taken" : ""}</span>
                  </li>
               );
            })}
         </ul>
         <div className={`${styles.ride} ${list.riding ? styles.rideOn : ""}`}>
            {list.riding ? "RIDING: fast, slippery" : touch ? "Hold Ride: go fast" : "Hold Space: ride"}
         </div>
      </div>
   );
}

export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
         <ShoppingList />
      </>
   );
}
