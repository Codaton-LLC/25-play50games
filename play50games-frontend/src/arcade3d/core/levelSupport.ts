// Does the server know levels? (docs/arcade-levels.md §7 R5.) A v3 server ignores `level` and
// would store a level-5 score as the game's best, so the client plays levels 2-5 against the
// leaderboard only once GET /arcade/games advertises `features.levels`. One cached read per page
// load; a failed read is not cached (the next caller retries) and counts as "no" meanwhile. With
// the leaderboard off nothing is sent, so levels work locally without asking.
import { ARCADE_LEADERBOARD } from "../flags";
import { arcadeApi } from "@/lib/api/arcade";

let known: boolean | null = null;
let pending: Promise<boolean> | null = null;

/** true when levels 2-5 may be played and sent; resolves false on a server without levels or an error */
export function serverSupportsLevels(): Promise<boolean> {
   if (!ARCADE_LEADERBOARD) return Promise.resolve(true);
   if (known !== null) return Promise.resolve(known);
   if (!pending) {
      pending = arcadeApi.games().then(
         (response) => {
            known = response?.features?.levels === true;
            return known;
         },
         () => {
            pending = null;
            return false;
         }
      );
   }
   return pending;
}

/** the answer when it is already known (true with the leaderboard off), else null */
export function knownLevelSupport(): boolean | null {
   return ARCADE_LEADERBOARD ? known : true;
}

/** tests only */
export function resetLevelSupport(): void {
   known = null;
   pending = null;
}
