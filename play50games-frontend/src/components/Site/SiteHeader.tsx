// Site header for the redesigned pages. Server component: it slims the arcade registry down to
// what the menus and the search need, so the client bundle never carries the full game metas.
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import { getVisibleGames, scoringMetas } from "@/arcade3d/registry";
import GameMetas from "@/arcade3d/ui/GameMetas";
import SiteHeaderClient from "./SiteHeaderClient";
import { toSiteGame, type SiteSection } from "./siteData";

export interface SiteHeaderProps {
   active: SiteSection;
   /**
    * Hands the browser the games' scoring metas (arcade3d/ui/GameMetas), which every reader of
    * local scores needs: the menus, the search, the tiles, the hub. Default true; a page that
    * already wraps itself in <GameMetas> (the /3d catalogue) passes false.
    */
   provideMetas?: boolean;
}

export default function SiteHeader({ active, provideMetas = true }: SiteHeaderProps) {
   const games = ARCADE_ENABLED ? getVisibleGames().map(toSiteGame) : [];
   const header = <SiteHeaderClient active={active} games={games} />;
   if (!provideMetas || !ARCADE_ENABLED) return header;
   return <GameMetas metas={scoringMetas()}>{header}</GameMetas>;
}
