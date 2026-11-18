"use client";

// One game's leaderboard on the hub and on /leaderboards: loads the board and draws it with
// BoardList (hairline rows, shields for ranks 1 to 3, the visitor's own row washed in coral).
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { useAuth } from "@/contexts/AuthContext";
import { useLeaderboard } from "@/arcade3d/core/useLeaderboard";
import BoardList from "./BoardList";
import ui from "./ui.module.css";

export interface BoardRowsProps {
   game: ArcadeGameMeta;
   /** rows to load (the API clamps to 1..50) */
   limit: number;
}

export default function BoardRows({ game, limit }: BoardRowsProps) {
   const { user } = useAuth();
   const board = useLeaderboard(game.slug, { limit, refreshKey: user?.id ?? null });

   if (!board.enabled) return null;

   return (
      <BoardList
         scoring={game.scoring}
         entries={board.data?.entries ?? []}
         me={board.data?.me ?? null}
         loading={board.loading}
         error={board.error}
         onRetry={board.retry}
         skeletonRows={Math.min(limit, 5)}
         empty={
            <>
               <p>No scores yet. Play one round to take first place.</p>
               <Link href={`/3d/${game.slug}`} className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}>
                  Play {game.title}
               </Link>
            </>
         }
      />
   );
}
