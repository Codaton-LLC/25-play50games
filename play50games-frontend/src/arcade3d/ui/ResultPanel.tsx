"use client";

// The result card. Its overlay fills the box it is given (GameShell's .resultWrap ends above the
// cookie banner) and never scrolls: the card is at most that tall and scrolls inside itself, so its
// frame stays whole. Its actions (Log in / Save, Retry, Exit) sit in a bar that sticks to the card's
// bottom edge while they would be below it and to its top edge once the top 10 is scrolled up, so
// on any screen they are on view and tappable, never under the banner. Where everything fits the
// card looks as before (short landscape screens get tighter spacing and one row of buttons). The
// wheel over the backdrop scrolls the card (scrollPanelFromBackdrop).
import { useRef, type ReactNode } from "react";
import type { ScoringRules } from "../types";
import type { SubmitStatus } from "../core/scores";
import { formatScore } from "../core/format";
import { scrollPanelFromBackdrop } from "../core/overlayScroll";
import styles from "./ResultPanel.module.css";

export interface ResultPanelProps {
   title: string;
   score: number;
   durationMs?: number | null;
   best: number;
   /** duration of the best run; time games show it instead of the score */
   bestDurationMs?: number | null;
   isNewBest: boolean;
   /** null while the score is still being submitted */
   status: SubmitStatus | null;
   scoring: ScoringRules;
   onRetry: () => void;
   onExit: () => void;
   /** shown for guests when status is "login-required" */
   onLogin?: () => void;
   /** shown after an in-page login, to save this run to the account */
   onSaveToAccount?: () => void;
   /** e.g. the leaderboard */
   children?: ReactNode;
   rank?: number | null;
}

/** The big figure. An unranked time run has no finish time, so it must not show the clock. */
export function resultScoreText(
   score: number,
   scoring: ScoringRules,
   durationMs: number | null | undefined,
   status: SubmitStatus | null,
): string {
   if (scoring.display === "time" && status === "unranked") return "Not ranked";
   return formatScore(score, scoring, durationMs);
}

/** "Best 1:23.45", or "No best yet" when a time game has nothing stored. Points games keep the number. */
export function resultBestText(
   best: number,
   scoring: ScoringRules,
   durationMs: number | null | undefined,
   bestDurationMs: number | null | undefined,
   isNewBest: boolean,
): string {
   if (scoring.display === "time") {
      const shown = isNewBest ? durationMs : bestDurationMs;
      if (shown == null) return "No best yet";
      return `Best ${formatScore(best, scoring, shown)}`;
   }
   return `Best ${formatScore(best, scoring, isNewBest ? durationMs : bestDurationMs)}`;
}

function submitMessage(status: SubmitStatus | null, rank?: number | null): string {
   switch (status) {
      case "synced":
         return rank != null ? `Saved to the leaderboard. Rank #${rank}.` : "Saved to the leaderboard.";
      case "saved-local":
      case "leaderboard-off":
         return "Saved on this device.";
      case "login-required":
         return "Log in to put this on the leaderboard.";
      case "rate-limited":
         return "Too many scores in a row. Saved on this device, try again in a minute.";
      case "rejected":
         return "This score could not be verified. Saved on this device.";
      case "banned":
         return "This account cannot post to the leaderboard.";
      case "offline":
         return "You are offline. Saved on this device.";
      case "config-error":
         return "The leaderboard is unavailable right now. Saved on this device.";
      case "unranked":
         return "Finish the course to set a time. This run was not saved.";
      case "ranking-unavailable":
         return "Saved on this device. This run could not be ranked; play again to rank.";
      default:
         return "Saving…";
   }
}

export default function ResultPanel(props: ResultPanelProps) {
   const {
      title,
      score,
      durationMs,
      best,
      bestDurationMs,
      isNewBest,
      status,
      scoring,
      onRetry,
      onExit,
      onLogin,
      onSaveToAccount,
      children,
      rank,
   } = props;
   const cardRef = useRef<HTMLDivElement>(null);

   return (
      <div
         className={styles.overlay}
         role="dialog"
         aria-label={title}
         aria-modal="true"
         onWheel={(event) => scrollPanelFromBackdrop(event, event.currentTarget, cardRef.current)}
      >
         <div ref={cardRef} className={styles.card}>
            <h2 className={styles.title}>{title}</h2>
            <p className={styles.score}>{resultScoreText(score, scoring, durationMs, status)}</p>
            {isNewBest ? <p className={styles.newBest}>New best!</p> : null}
            <p className={styles.best}>{resultBestText(best, scoring, durationMs, bestDurationMs, isNewBest)}</p>
            {rank != null ? <p className={styles.rank}>Rank #{rank}</p> : null}
            <p className={styles.message} aria-live="polite" data-status={status ?? "saving"}>
               {submitMessage(status, rank)}
            </p>
            <div className={styles.actions}>
               {status === "login-required" && onLogin ? (
                  <button type="button" className={styles.primary} onClick={onLogin}>
                     Log in
                  </button>
               ) : null}
               {status === "login-required" && onSaveToAccount ? (
                  <button type="button" className={styles.secondary} onClick={onSaveToAccount}>
                     Save this score to my account
                  </button>
               ) : null}
               <button type="button" className={styles.primary} onClick={onRetry}>
                  Retry
               </button>
               <button type="button" className={styles.secondary} onClick={onExit}>
                  Exit
               </button>
            </div>
            {children ? <div className={styles.extra}>{children}</div> : null}
         </div>
      </div>
   );
}
