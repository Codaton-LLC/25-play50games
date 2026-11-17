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
import styles from "./Hud.module.css";

const MP_HEROES: readonly MpHero[] = HEROES.map((h) => ({ id: h.id, name: h.name, color: h.color, powerLabel: h.powerLabel }));
const HERO_IDS = MP_HEROES.map((h) => h.id);

/** A player's standing: rounds have no finish, the score ranks them (progress carries the score). */
export function standingOf(p: PlayerState): Standing {
   return { index: p.index, finished: false, timeMs: null, score: p.score, progress: p.score };
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
   const endReason = useArcadeStore((s) => s.endReason);
   const placed = useMemo(() => rankRace(players.map(standingOf)), [players]);
   if (phase === "lobby") {
      return (
         <JoinScreen
            heroes={MP_HEROES}
            title="Gem Collector 3D"
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
      return { ...s, heroId: p.heroId, detail: `${p.score} pts` };
   });
   const coop = mode === "coop";
   const total = players.reduce((sum, p) => sum + p.score, 0);
   const team = coop ? { ...teamResult(players.map(standingOf)), cleared: endReason === "win" } : null;
   const top = entries.find((e) => e.place === 1);
   const title = team ? (team.cleared ? "Team target reached!" : "Out of time") : top ? `P${top.index + 1} wins!` : "Round over";
   return (
      <>
         <PlayerHud heroes={MP_HEROES} stat={(p) => `${p.score} pts`} place={() => null} />
         {shown ? (
            <Podium
               heroes={MP_HEROES}
               entries={entries}
               team={team ? { ...team, text: `Team score ${total}` } : null}
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
