// STUB (Phase 0). Owner: Cursor (K1). Keep the props exactly as typed; add a .module.css next to this file.
import Link from "next/link";
import type { ArcadeGameMeta } from "@/arcade3d/types";

export interface ArcadeTeaserStripProps {
   /** all games; live ones link to /3d/<slug>, the rest show as "soon" */
   games: ArcadeGameMeta[];
}

export default function ArcadeTeaserStrip({ games }: ArcadeTeaserStripProps) {
   const live = games.filter((game) => game.status === "live");
   const soon = games.length - live.length;
   return (
      <div>
         {live.map((game) => (
            <Link key={game.slug} href={`/3d/${game.slug}`}>
               {game.title}
            </Link>
         ))}
         {soon > 0 && <span>{soon} more coming</span>}
      </div>
   );
}
