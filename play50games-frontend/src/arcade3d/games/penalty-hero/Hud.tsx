"use client";

// The shell shows score and the Shots count. This Hud adds goals, streak, the ten shot dots, the
// aim deadline and the GOAL / SAVED feedback. Scene.tsx writes every value as a store stat.
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { SHOTS } from "./rules";
import styles from "./Hud.module.css";

/** Values of the "feedback" stat. */
export const FEEDBACK = { none: 0, goal: 1, saved: 2, wide: 3, timeout: 4 } as const;

const FEEDBACK_TEXT: Record<number, { title: string; detail: string } | undefined> = {
   [FEEDBACK.goal]: { title: "GOAL!", detail: "" },
   [FEEDBACK.saved]: { title: "SAVED", detail: "The keeper guessed right" },
   [FEEDBACK.wide]: { title: "SAVED", detail: "Wide – shoot inside the band" },
   [FEEDBACK.timeout]: { title: "SAVED", detail: "Too slow – 20 s per shot" },
};

const DOTS = Array.from({ length: SHOTS }, (_v, i) => i);
/** The aim deadline shows for the last seconds of the 20 s per shot. */
const DEADLINE_FROM_S = 5;

export default function PenaltyHud() {
   const shots = useArcadeStore((s) => s.stats.shots ?? 0);
   const goals = useArcadeStore((s) => s.stats.goals ?? 0);
   const streak = useArcadeStore((s) => s.stats.streak ?? 0);
   const goalMask = useArcadeStore((s) => s.stats.goalMask ?? 0);
   const feedback = useArcadeStore((s) => s.stats.feedback ?? 0);
   const aimLeft = useArcadeStore((s) => s.stats.aimLeft ?? 0);
   const shown = FEEDBACK_TEXT[feedback];

   return (
      <>
         <div className={styles.tally} data-arcade-safe-area>
            <span>
               Goals <strong>{goals}</strong>
            </span>
            <span>
               Streak <strong>{streak}</strong>
            </span>
         </div>

         <div className={styles.feedback} aria-live="polite" role="status">
            {shown ? (
               <p key={`${shots}-${feedback}`} className={feedback === FEEDBACK.goal ? styles.goal : styles.miss}>
                  <span className={styles.title}>{shown.title}</span>
                  {shown.detail ? <span className={styles.detail}>{shown.detail}</span> : null}
               </p>
            ) : aimLeft > 0 && aimLeft <= DEADLINE_FROM_S ? (
               // keyed by the second, so it pops once per second
               <p
                  key={`aim-${shots}-${aimLeft}`}
                  className={`${styles.deadline} ${aimLeft <= 2 ? styles.deadlineUrgent : ""}`}
               >
                  <span className={styles.deadlineLabel}>Shoot!</span>{" "}
                  <span className={styles.deadlineValue}>{aimLeft}</span>{" "}
                  <span className={styles.deadlineUnit}>s</span>
               </p>
            ) : null}
         </div>

         <div className={styles.bottom} data-arcade-safe-area>
            <ol className={styles.dots} aria-label={`Shots: ${shots} of ${SHOTS}, ${goals} goals`}>
               {DOTS.map((i) => {
                  const done = i < shots;
                  const scored = done && (goalMask & (1 << i)) !== 0;
                  const state = !done ? "pending" : scored ? "goal" : "miss";
                  const look = !done ? styles.dotPending : scored ? styles.dotGoal : styles.dotMiss;
                  return (
                     <li key={i} className={`${styles.dot} ${look}`} title={`Shot ${i + 1}: ${state}`}>
                        {done ? (scored ? "✓" : "✕") : ""}
                     </li>
                  );
               })}
            </ol>
            <p className={styles.hint}>Shoot when the ring is inside the white band</p>
         </div>
      </>
   );
}
