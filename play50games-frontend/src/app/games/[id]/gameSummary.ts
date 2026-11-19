// What the server needs of one classic game: the metadata (layout.tsx), the page's h1 and its
// JSON-LD (page.tsx). Both read through getGame, whose fetch Next caches for an hour and shares
// within a request.
import { getGame } from "@/lib/api/games";

export interface GameSummary {
   id: number;
   title: string;
   /** as the CMS has it; may be empty */
   description: string;
   game_type: string;
}

const TYPE_LABELS: Record<string, string> = {
   logic: "Logic Game",
   memory: "Memory Game",
   speed: "Speed Game",
   skill: "Skill Game",
   final: "Final Challenge",
};

/** "Logic Game", "Final Challenge", ... ("Game" for an unknown type). */
export function gameTypeLabel(gameType: string): string {
   return TYPE_LABELS[gameType] ?? "Game";
}

/** The game, or null when the id is not a number, the game does not exist or the API is down. */
export async function loadGameSummary(gameId: number): Promise<GameSummary | null> {
   if (!Number.isInteger(gameId) || gameId < 1) return null;
   try {
      // no guest id: this is the public view of the game
      const game = await getGame(gameId);
      if (!game?.title) return null;
      return {
         id: gameId,
         title: game.title,
         description: (game.description ?? "").trim(),
         game_type: game.game_type || "logic",
      };
   } catch {
      return null;
   }
}
