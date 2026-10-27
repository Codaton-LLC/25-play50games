"use client";

// The flow meter's HUD pill: the multiplier and a bar that drains over the chain window. Display only:
// the game passes its ComboState numbers (from store stats or a ref it reads each frame).
import type { CSSProperties } from "react";
import styles from "./ComboMeter.module.css";

export interface ComboMeterProps {
   /** events in the chain (0 hides the pill) */
   chain: number;
   multiplier: number;
   /** 0..1 window left (comboFlow) */
   flow: number;
   cap: number;
   accent?: string;
}

export default function ComboMeter({ chain, multiplier, flow, cap, accent }: ComboMeterProps) {
   const maxed = multiplier >= cap;
   const style = { "--flow": Math.max(0, Math.min(1, flow)), ...(accent ? { "--m2-accent": accent } : {}) } as CSSProperties;
   return (
      <div className={`${styles.meter} ${chain > 1 ? styles.live : ""} ${maxed ? styles.maxed : ""}`} style={style} aria-label={chain > 1 ? `Flow x${multiplier.toFixed(2)}, chain ${chain}` : "Flow"}>
         <span className={styles.mult} key={chain}>
            x{multiplier.toFixed(multiplier % 1 === 0 ? 0 : 2)}
         </span>
         <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} />
         </span>
         <span className={styles.chain}>{chain > 1 ? `${chain} chain` : "Flow"}</span>
      </div>
   );
}
