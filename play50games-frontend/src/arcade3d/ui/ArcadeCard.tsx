// STUB (Phase 0). Owner: Cursor (K2). Keep the props exactly as typed; add a .module.css next to this file.
import Link from "next/link";
import type { ArcadeGameMeta } from "../types";
import type { LocalScoreEntry } from "../core/scores";
import { formatScore } from "../core/format";

export interface ArcadeCardProps {
   meta: ArcadeGameMeta;
   best: LocalScoreEntry | null;
}

export default function ArcadeCard({ meta, best }: ArcadeCardProps) {
   const body = (
      <>
         <h3>{meta.title}</h3>
         <p>{meta.tagline}</p>
         {meta.status === "soon" && <span>Soon</span>}
         {best && <span>Best: {formatScore(best.best, meta.scoring, best.bestDurationMs)}</span>}
      </>
   );
   return meta.status === "live" ? <Link href={`/3d/${meta.slug}`}>{body}</Link> : <div>{body}</div>;
}
