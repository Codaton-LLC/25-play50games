// STUB (Phase 0). Owner: Cursor (K2). Keep the props exactly as typed; add a .module.css next to this file.
import type { ReactNode } from "react";
import type { ScoringRules } from "../types";
import type { SubmitStatus } from "../core/scores";
import { formatScore } from "../core/format";

export interface ResultPanelProps {
   title: string;
   score: number;
   durationMs?: number | null;
   best: number;
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
}

export default function ResultPanel(props: ResultPanelProps) {
   const { title, score, durationMs, best, isNewBest, status, scoring, onRetry, onExit, onLogin, onSaveToAccount, children } = props;
   return (
      <div role="dialog" aria-label={title}>
         <h2>{title}</h2>
         <p>{formatScore(score, scoring, durationMs)}</p>
         {isNewBest ? <p>New best!</p> : <p>Best: {formatScore(best, scoring)}</p>}
         {status && <p data-status={status}>{status}</p>}
         {status === "login-required" && onLogin && <button onClick={onLogin}>Log in to join the leaderboard</button>}
         {onSaveToAccount && <button onClick={onSaveToAccount}>Save this score to my account</button>}
         {children}
         <button onClick={onRetry}>Play again</button>
         <button onClick={onExit}>Back to 3D Arcade</button>
      </div>
   );
}
