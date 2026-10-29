"use client";

import { useMemo } from "react";
import { useArcadeStore, arcadeStore } from "@/arcade3d/core/useArcadeStore";
import { isResultShown } from "@/arcade3d/core/frameLoop";
import { JoinScreen, type MpHero } from "@/arcade3d/menu2/multiplayer/JoinScreen";
import { PlayerHud } from "@/arcade3d/menu2/multiplayer/PlayerHud";
import { Podium, type PodiumEntry } from "@/arcade3d/menu2/multiplayer/Podium";
import { playersStore, usePlayers, type PlayerState } from "@/arcade3d/menu2/multiplayer/players";
import { rankRace, teamResult, type Standing } from "@/arcade3d/menu2/multiplayer/results";
import { useMultiplayerAllowed } from "@/arcade3d/menu2/multiplayer/useMultiplayerAllowed";
import { HEROES } from "./heroes";
import { runTimeMs } from "./rules";
import styles from "./Hud.module.css";

const MP_HEROES: readonly MpHero[] = HEROES.map((h) => ({ id: h.id, name: h.name, color: h.color, powerLabel: h.powerLabel }));
const HERO_IDS = MP_HEROES.map((h) => h.id);

function seconds(ms: number): string {
   return `${(ms / 1000).toFixed(1)} s`;
}

export function standingOf(p: PlayerState): Standing {
   return {
      index: p.index,
      finished: p.finished,
      timeMs: p.finished && p.finishMs !== null ? runTimeMs(p.finishMs, p.score) : null,
      score: p.score,
      progress: p.progress,
   };
}

export function MultiplayerButton() {
   const allowed = useMultiplayerAllowed();
   if (!allowed) return null;
   return (
      <button type="button" className={styles.mpBtn} onClick={() => playersStore.getState().openLobby(HERO_IDS)}>
         2-4 players
      </button>
   );
}

export function MultiplayerHud() {
   const phase = usePlayers((s) => s.phase);
   const mode = usePlayers((s) => s.mode);
   const players = usePlayers((s) => s.players);
   const shown = useArcadeStore((s) => isResultShown(s));
   const placed = useMemo(() => rankRace(players.map(standingOf)), [players]);
   const finishPlace = (p: PlayerState) => {
      if (mode !== "versus" || !p.finished) return null;
      return placed.find((q) => q.index === p.index)?.place ?? null;
   };
   if (phase === "lobby") {
      return (
         <JoinScreen
            heroes={MP_HEROES}
            title="Color City Sprint"
            onStart={() => {
               if (arcadeStore.getState().phase === "ready") arcadeStore.getState().start();
            }}
            onClose={() => playersStore.getState().endSession()}
         />
      );
   }
   if (phase !== "playing") return null;
   const entries: PodiumEntry[] = placed.map((s) => {
      const p = players.find((q) => q.index === s.index)!;
      return {
         ...s,
         heroId: p.heroId,
         detail: s.finished ? `${seconds(s.timeMs ?? 0)} · ${p.score} gems` : `${p.progress} beacons · ${p.score} gems`,
      };
   });
   const team = mode === "coop" ? teamResult(players.map(standingOf)) : null;
   const winner = entries.find((e) => e.place === 1 && e.finished);
   const title = team ? (team.cleared ? "Team painted the city!" : "Out of time") : winner ? `P${winner.index + 1} wins!` : "No one finished the route";
   return (
      <>
         <PlayerHud heroes={MP_HEROES} stat={(p) => `${p.score} · ${p.progress}`} place={finishPlace} />
         {shown ? (
            <Podium
               heroes={MP_HEROES}
               entries={entries}
               team={team ? { ...team, text: team.cleared ? `Team time ${seconds(team.timeMs ?? 0)}` : `${team.finishers} of ${players.length} finished` } : null}
               title={title}
               onAgain={() => arcadeStore.getState().restart()}
               onLobby={() => {
                  arcadeStore.getState().menu();
                  playersStore.getState().openLobby(HERO_IDS);
               }}
               onSolo={() => {
                  playersStore.getState().endSession();
                  arcadeStore.getState().menu();
               }}
            />
         ) : null}
      </>
   );
}
