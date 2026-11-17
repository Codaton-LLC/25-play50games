"use client";

// Temple Gong Timing's multiplayer HUD (menu2/multiplayer adoption): the "2-4 players" button on the
// hero row, the join screen while the lobby is open, the per-player chips during the runs, and the
// podium once the result delay is over.
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

/** A player's podium standing: by score (a points game), the accuracy as the progress. */
export function standingOf(p: PlayerState): Standing {
   return { index: p.index, finished: p.finished, timeMs: null, score: p.score, progress: p.progress };
}

/** On the start card's hero row: opens the join screen (desktop and tablet only). */
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
            title="Temple Gong Timing"
            onStart={() => {
               // the intro shows one hero: a multiplayer run starts straight into the countdown
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
         detail: `${p.score} pts · ${p.progress} %`,
      };
   });
   const team = mode === "coop" ? teamResult(players.map(standingOf)) : null;
   const winner = entries.find((e) => e.place === 1 && e.finished);
   const title = team ? (team.cleared ? "The band played it!" : "The band lost the beat") : winner ? `P${winner.index + 1} wins!` : "No one cleared the song";

   return (
      <>
         <PlayerHud heroes={MP_HEROES} stat={(p) => `${p.score} · ${p.progress} %`} place={finishPlace} />
         {shown && (
            <Podium
               heroes={MP_HEROES}
               entries={entries}
               team={team ? { ...team, text: `${team.score} pts together` } : null}
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
         )}
      </>
   );
}
