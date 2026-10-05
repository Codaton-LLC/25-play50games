// STUB (Phase 0). Owner: Cursor (K2). Keep the props exactly as typed; add a .module.css next to this file.
import type { ScoringRules } from "../types";
import type { ArcadeLeaderboardEntry } from "@/lib/api/arcade";
import { formatScore } from "../core/format";

export interface LeaderboardTableProps {
   entries: ArcadeLeaderboardEntry[];
   /** the logged-in player's rank, also when outside the shown entries */
   me: { rank: number; best_score: number } | null;
   loading: boolean;
   error: string | null;
   scoring: ScoringRules;
   onRetry?: () => void;
}

export default function LeaderboardTable({ entries, me, loading, error, scoring, onRetry }: LeaderboardTableProps) {
   if (loading) return <p>Loading leaderboard…</p>;
   if (error) {
      return (
         <p>
            {error} {onRetry && <button onClick={onRetry}>Retry</button>}
         </p>
      );
   }
   if (entries.length === 0) return <p>No scores yet. Be the first!</p>;
   return (
      <table>
         <tbody>
            {entries.map((entry) => (
               <tr key={entry.rank}>
                  <td>{entry.rank}</td>
                  <td>{entry.name}</td>
                  <td>{formatScore(entry.score, scoring, entry.duration_ms)}</td>
               </tr>
            ))}
            {me && !entries.some((entry) => entry.is_me) && (
               <tr>
                  <td>{me.rank}</td>
                  <td>You</td>
                  <td>{me.best_score}</td>
               </tr>
            )}
         </tbody>
      </table>
   );
}
