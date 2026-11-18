// Plain data shared by the site chrome (header, menus, search) and the hub. Server-safe.
import type { ArcadeGameMeta } from "@/arcade3d/types";
import { formatDuration } from "@/arcade3d/core/format";

/** The page a header is shown on; decides the resting position of the world switcher. */
export type SiteSection = "home" | "classic" | "arcade" | "squad" | "leaderboards" | "other";

export type WorldId = "classic" | "arcade" | "squad";

export interface World {
   id: WorldId;
   /** short name in the switcher and the phone tab bar */
   label: string;
   title: string;
   /** the glyph on the world's plate */
   plate: string;
   href: string;
   text: string;
}

export const WORLDS: Record<WorldId, World> = {
   classic: {
      id: "classic",
      label: "Classic 50",
      title: "Classic 50",
      plate: "50",
      href: "/classic",
      text: "Fifty brain games. Each one unlocks the next, and all fifty earn your certificate.",
   },
   arcade: {
      id: "arcade",
      label: "3D Arcade",
      title: "3D Arcade",
      plate: "3D",
      href: "/3d",
      text: "Quick 3D mini-games for keyboard and touch. Every game keeps its own best score and leaderboard.",
   },
   squad: {
      id: "squad",
      label: "Pangoroll Worlds",
      title: "Pangoroll Worlds",
      plate: "5",
      href: "/pangoroll-worlds",
      text: "Five pangolin heroes who roll into a ball. Each one has its own colour and its own power.",
   },
};

/**
 * The five heroes of Pangoroll Worlds (Menu 2): pangolins who roll into a ball. Names, colours and
 * powers are the user's; the colours are content and never colour buttons, links or headings.
 */
export const SQUAD = [
   { name: "Riko", ability: "Dash", color: "#EF4444" },
   { name: "Nyla", ability: "Double Jump", color: "#2563EB" },
   { name: "Kiro", ability: "Shield", color: "#22C55E" },
   { name: "Zuno", ability: "Coin Magnet", color: "#FACC15" },
   { name: "Vexa", ability: "Phase", color: "#8B5CF6" },
] as const;

/**
 * The group picture of the five heroes: one image of the squad together, made and approved by
 * the user (2026-11-17), never a collage of the T-pose concepts. It is the art of the world
 * wherever it shows. null draws the five as balls in CSS instead (components/Site/SquadArt).
 */
export const SQUAD_PICTURE: string | null = "/images/worlds/scale-squad.webp";

/** What the header, the menus and the search need to know about a game: a slim copy of its meta. */
export interface SiteGame {
   slug: string;
   title: string;
   tagline: string;
   thumbnail: string | null;
   status: ArcadeGameMeta["status"];
   order: number;
   unitLabel: string;
   display: "int" | "time";
}

export function toSiteGame(meta: ArcadeGameMeta): SiteGame {
   return {
      slug: meta.slug,
      title: meta.title,
      tagline: meta.tagline,
      thumbnail: meta.thumbnail,
      status: meta.status,
      order: meta.order,
      unitLabel: meta.scoring.unitLabel,
      display: meta.scoring.display,
   };
}

/** A game the player can open (a "soon" game has a card but no page yet). */
export const isPlayable = (game: Pick<SiteGame, "status">): boolean => game.status === "live" || game.status === "dev";

/** "1,412 pts" or "0:21.37"; null when there is nothing to show yet. */
export function bestText(
   game: Pick<SiteGame, "unitLabel" | "display">,
   entry: { best: number; bestDurationMs: number | null } | null | undefined,
): string | null {
   if (!entry) return null;
   if (game.display === "time") return entry.bestDurationMs !== null ? formatDuration(entry.bestDurationMs) : null;
   return `${entry.best.toLocaleString("en-US")} ${game.unitLabel}`;
}

/** Initials for the avatar chip: "Dren Pasha" -> "DP". */
export function initialsOf(user: { first_name?: string; last_name?: string; display_name?: string; email?: string }): string {
   const first = (user.first_name || user.display_name || user.email || "").trim();
   const last = (user.last_name || "").trim();
   const a = Array.from(first)[0] ?? "";
   const b = Array.from(last)[0] ?? Array.from(first.split(/\s+/)[1] ?? "")[0] ?? "";
   return (a + b).toUpperCase() || "P";
}

/** The public leaderboard name, "First L." (the server builds the real one; this is the menu's preview). */
export function publicName(user: { first_name?: string; last_name?: string; display_name?: string; email?: string }): string {
   const first = (user.first_name || "").trim();
   if (!first) return user.display_name || user.email || "Player";
   const initial = Array.from((user.last_name || "").trim())[0];
   return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/** Fired by any page to open the login modal that lives in the site header. */
export const LOGIN_EVENT = "play50games_open_login";

/** Opens the header's login sheet, or its register sheet. */
export function openLogin(sheet: "login" | "register" = "login"): void {
   window.dispatchEvent(new CustomEvent(LOGIN_EVENT, { detail: sheet }));
}
