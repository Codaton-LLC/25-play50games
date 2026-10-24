// The picked level in the URL (`/3d/<slug>?level=3`) and the last played level per game
// (docs/arcade-levels.md §2.4). The page is static, so only the client reads `?level=`: GameShell
// reads it once when the start card first opens and rewrites it on every tile change (level 1
// removes it). Canonical, OG and JSON-LD stay `/3d/<slug>`. Invalid or locked values fall back
// silently (pickInitialLevel). The last played level is a convenience in localStorage.
import { LEVEL_IDS, type LevelId } from "../types";

const LAST_LEVEL_PREFIX = "play50games_3d_level:";

/** `?level=n` as a number 1..5, else null (missing, junk, out of range). */
export function parseLevelParam(search: string): number | null {
   const value = new URLSearchParams(search).get("level");
   if (value === null || !/^[1-9]$/.test(value)) return null;
   const id = Number(value);
   return id <= LEVEL_IDS.length ? id : null;
}

/** The search string with `level` set to `id` (removed for level 1), other parameters kept. */
export function searchWithLevel(search: string, id: LevelId): string {
   const params = new URLSearchParams(search);
   if (id === 1) params.delete("level");
   else params.set("level", String(id));
   const next = params.toString();
   return next ? `?${next}` : "";
}

/** Rewrites the address bar for the picked level (no navigation, no history entry). */
export function writeLevelToUrl(id: LevelId): void {
   if (typeof window === "undefined") return;
   try {
      const { pathname, search, hash } = window.location;
      const next = searchWithLevel(search, id);
      if (next !== search) window.history.replaceState(window.history.state, "", `${pathname}${next}${hash}`);
   } catch {
      // a sandboxed frame may refuse replaceState: the URL just does not follow
   }
}

export function readLastLevel(slug: string): LevelId | null {
   try {
      const value = Number(window.localStorage.getItem(`${LAST_LEVEL_PREFIX}${slug}`));
      return (LEVEL_IDS as readonly number[]).includes(value) ? (value as LevelId) : null;
   } catch {
      return null;
   }
}

export function writeLastLevel(slug: string, id: LevelId): void {
   try {
      window.localStorage.setItem(`${LAST_LEVEL_PREFIX}${slug}`, String(id));
   } catch {
      // storage blocked: the start card opens on the default level next time
   }
}
