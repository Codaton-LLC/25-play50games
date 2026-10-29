"use client";
import { useArcadeStore, arcadeStore } from "../../core/useArcadeStore";
import { isResultShown } from "../../core/frameLoop";
import { JoinScreen } from "../../menu2/multiplayer/JoinScreen";
import { PlayerHud } from "../../menu2/multiplayer/PlayerHud";
import { Podium } from "../../menu2/multiplayer/Podium";
import { playersStore, usePlayers } from "../../menu2/multiplayer/players";
import { rankRace, teamResult } from "../../menu2/multiplayer/results";
import { useMultiplayerAllowed } from "../../menu2/multiplayer/useMultiplayerAllowed";
import { HEROES } from "./heroes";
import styles from "./Hud.module.css";
const ids = HEROES.map((h) => h.id);
export function MultiplayerButton() {
   const allowed = useMultiplayerAllowed();
   return allowed ? <button className={styles.button} onClick={() => playersStore.getState().openLobby(ids)}>2–4 players</button> : null;
}
export function MultiplayerHud() {
   const session = usePlayers((s) => s), shown = useArcadeStore((s) => isResultShown(s));
   if (session.phase === "lobby") return <JoinScreen heroes={HEROES} title="Mine Tunnel Run" onStart={() => arcadeStore.getState().start()} onClose={() => session.endSession()} />;
   if (session.phase !== "playing") return null;
   const standings = session.players.map((p) => ({ index: p.index, finished: p.finished, timeMs: p.finishMs, score: p.score, progress: p.progress }));
   const placed = rankRace(standings);
   const entries = placed.map((s) => ({ ...s, heroId: session.players.find((p) => p.index === s.index)!.heroId, detail: s.finished ? `${((s.timeMs ?? 0) / 1000).toFixed(1)} s` : `${s.progress} m deep` }));
   return <>
      <PlayerHud heroes={HEROES} stat={(p) => `${p.progress} m deep`} />
      {shown && <Podium heroes={HEROES} entries={entries} team={session.mode === "coop" ? { ...teamResult(standings), text: "Dug through together" } : null} title={session.mode === "coop" ? "Mine cleared" : "Dig race"}
         onAgain={() => arcadeStore.getState().restart()} onLobby={() => { arcadeStore.getState().menu(); session.openLobby(ids); }} onSolo={() => { session.endSession(); arcadeStore.getState().menu(); }} />}
   </>;
}
