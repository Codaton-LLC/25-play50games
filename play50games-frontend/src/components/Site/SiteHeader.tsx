// Site header for the redesigned pages. Server component: it slims the arcade registry down to
// what the menus and the search need, so the client bundle never carries the full game metas.
import { ARCADE_ENABLED } from "@/arcade3d/flags";
import { getVisibleGames } from "@/arcade3d/registry";
import SiteHeaderClient from "./SiteHeaderClient";
import { toSiteGame, type SiteSection } from "./siteData";

export interface SiteHeaderProps {
   active: SiteSection;
}

export default function SiteHeader({ active }: SiteHeaderProps) {
   const games = ARCADE_ENABLED ? getVisibleGames().map(toSiteGame) : [];
   return <SiteHeaderClient active={active} games={games} />;
}
