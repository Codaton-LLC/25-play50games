"use client";

// The boss health bar for a game HUD: the name and phase, the health with a trailing drain, the phase
// marks, a flash on a hit, and a pulse while the boss is open (vulnerable). Display only: the game
// passes the numbers from its BossState (store stats or a ref).
import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./BossHealthBar.module.css";

export interface BossHealthBarProps {
   name: string;
   phaseName?: string;
   hp: number;
   maxHp: number;
   /** phaseMarks(cfg) */
   marks?: readonly number[];
   /** the boss is open for hits */
   vulnerable?: boolean;
   /** the hit flash is on (BossState.flashMs > 0) */
   flash?: boolean;
   accent?: string;
}

export default function BossHealthBar({ name, phaseName, hp, maxHp, marks = [], vulnerable, flash, accent }: BossHealthBarProps) {
   const frac = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
   // the trailing bar catches up with the health after a short wait
   const [trail, setTrail] = useState(frac);
   const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
   useEffect(() => {
      if (frac >= trail) {
         setTrail(frac);
         return;
      }
      timer.current = setTimeout(() => setTrail(frac), 380);
      return () => {
         if (timer.current) clearTimeout(timer.current);
      };
   }, [frac, trail]);
   const style = { "--hp": frac, "--trail": trail, ...(accent ? { "--m2-accent": accent } : {}) } as CSSProperties;
   return (
      <div className={`${styles.bar} ${vulnerable ? styles.open : ""} ${flash ? styles.flash : ""}`} style={style} data-arcade-safe-area="">
         <div className={styles.head}>
            <span className={styles.name}>{name}</span>
            {phaseName && <span className={styles.phase}>{phaseName}</span>}
         </div>
         <div className={styles.track} role="meter" aria-label={`${name} health`} aria-valuemin={0} aria-valuemax={maxHp} aria-valuenow={Math.ceil(hp)}>
            <span className={styles.trail} />
            <span className={styles.fill} />
            {marks.map((m) => (
               <span key={m} className={styles.mark} style={{ left: `${m * 100}%` }} />
            ))}
         </div>
      </div>
   );
}
