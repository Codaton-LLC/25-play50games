// Multiplayer runs never go into the solo leaderboard (framework "Leaderboards"). A game hands
// GameShell `runPlayers: sessionRunPlayers`: while multiplayer runs are on it returns the number of
// players, GameShell then treats the run as unranked (isRankedRun(rules, reason, players) is false,
// nothing saved or sent) and marks the FinishedRun with `players`, and core submitScore refuses
// any run so marked. Own multiplayer boards (co-op best time, versus wins) come later.
import { isMultiplayerActive, playersStore, type PlayersState } from "./players";

/** GameDefinition.runPlayers: the session's player count while multiplayer runs are on, else 1. */
export function sessionRunPlayers(state: Pick<PlayersState, "phase" | "players"> = playersStore.getState()): number {
   return isMultiplayerActive(state) ? Math.max(1, state.players.length) : 1;
}
