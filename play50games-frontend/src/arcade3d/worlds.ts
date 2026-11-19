// Which site world a 3D game belongs to. Server-safe: plain data, no imports but types.
// The 3D games all live at /3d/[slug] (their URLs and leaderboards never move), but the site shows
// them as two worlds: the 3D Arcade (originals, adventure, skill) and Pangoroll Worlds (Menu 2,
// the "rollheroes" collection in code).
import type { ArcadeCollection } from "./types";

export type ArcadeWorld = "arcade" | "squad";

/** The collection that makes up Pangoroll Worlds. */
export const PANGOROLL_COLLECTION: ArcadeCollection = "rollheroes";

export interface WorldHome {
   href: string;
   name: string;
}

/** The home page and public name of each 3D world. */
export const WORLD_HOME: Record<ArcadeWorld, WorldHome> = {
   arcade: { href: "/3d", name: "3D Arcade" },
   squad: { href: "/pangoroll-worlds", name: "Pangoroll Worlds" },
};

export function worldOf(game: { collection?: ArcadeCollection }): ArcadeWorld {
   return game.collection === PANGOROLL_COLLECTION ? "squad" : "arcade";
}

/** Where "back" goes from a game page, and what it is called. */
export function worldHomeOf(game: { collection?: ArcadeCollection }): WorldHome {
   return WORLD_HOME[worldOf(game)];
}
