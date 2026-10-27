"use client";

// The join screen: "Press A / Space to join". Up to four players join with their own device
// (either keyboard half or a gamepad), pick a hero (unique in co-op, free in versus), pick the
// mode and ready up. When everyone (2+) is ready a short countdown starts the runs (onStart).
// Mouse / touch work too: every control is also a button. Rendered by the game's HUD in a portal
// while the shell shows its start card; phones never see it (device.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLobbyFrame, useConnectedPads, playerInputHub } from "./MultiplayerInput";
import { KEYBOARD_DEVICES, deviceControls, deviceLabel, type DeviceId } from "./playerInput";
import { MAX_PLAYERS, PLAYER_COLORS, heroTaken, playersStore, startBlocker, usePlayers, type PlayerState } from "./players";
import { MODES, MODE_IDS } from "./modes";
import styles from "./JoinScreen.module.css";

export interface MpHero {
   id: string;
   name: string;
   color: string;
   /** the power's short name */
   powerLabel: string;
}

export interface JoinScreenProps {
   heroes: readonly MpHero[];
   /** the game's title on the screen */
   title: string;
   /** everyone is ready: start the runs (the store is already in "playing") */
   onStart(): void;
   /** Back: close the join screen (the session ends) */
   onClose(): void;
}

/** ms from "everyone ready" to the start (any unready cancels it) */
export const START_DELAY_MS = 1200;

export function JoinScreen({ heroes, title, onStart, onClose }: JoinScreenProps) {
   const players = usePlayers((s) => s.players);
   const mode = usePlayers((s) => s.mode);
   const blocker = usePlayers(startBlocker);
   const pads = useConnectedPads();
   const rootRef = useRef<HTMLDivElement>(null);
   const [startAt, setStartAt] = useState<number | null>(null);
   const onStartRef = useRef(onStart);
   onStartRef.current = onStart;

   useEffect(() => {
      playersStore.getState().openLobby(heroes.map((h) => h.id));
      rootRef.current?.focus({ preventScroll: true });
   }, [heroes]);

   useLobbyFrame(() => {
      const s = playersStore.getState();
      for (const d of KEYBOARD_DEVICES) s.lobbyInput(d, playerInputHub.device(d));
      for (const d of playerInputHub.connectedPads()) s.lobbyInput(d, playerInputHub.device(d));
   });

   useEffect(() => {
      setStartAt(blocker === null ? performance.now() + START_DELAY_MS : null);
   }, [blocker]);
   useEffect(() => {
      if (startAt === null) return;
      const id = window.setTimeout(() => {
         if (playersStore.getState().beginRun()) onStartRef.current();
      }, Math.max(0, startAt - performance.now()));
      return () => window.clearTimeout(id);
   }, [startAt]);

   const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
   const freeKeyboard = KEYBOARD_DEVICES.find((d) => !players.some((p) => p.device === d));
   const slots = Array.from({ length: MAX_PLAYERS }, (_v, i) => players.find((p) => p.index === i) ?? null);
   const unique = MODES[mode].uniqueHeroes;

   if (typeof document === "undefined") return null;
   return createPortal(
      <div className={styles.backdrop}>
         <div ref={rootRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={`${title}: local multiplayer`} tabIndex={-1}>
            <header className={styles.head}>
               <div>
                  <p className={styles.kicker}>{title}</p>
                  <h2 className={styles.title}>Local multiplayer</h2>
               </div>
               <div className={styles.modes} role="radiogroup" aria-label="Mode">
                  {MODE_IDS.map((id) => (
                     <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={mode === id}
                        className={mode === id ? styles.modeOn : styles.mode}
                        onClick={() => playersStore.getState().setMode(id)}
                     >
                        {MODES[id].label}
                     </button>
                  ))}
               </div>
            </header>
            <p className={styles.blurb}>{MODES[mode].blurb}</p>

            <ol className={styles.slots}>
               {slots.map((p, i) => (
                  <li key={i} className={p ? styles.slot : styles.slotEmpty} style={{ ["--tag" as string]: PLAYER_COLORS[i] }}>
                     <span className={styles.tag}>P{i + 1}</span>
                     {p ? (
                        <JoinedSlot player={p} hero={byId.get(p.heroId) ?? heroes[0]} heroes={heroes} unique={unique} />
                     ) : (
                        <div className={styles.joinHint}>
                           <p className={styles.press}>
                              Press <kbd>A</kbd> / <kbd>Space</kbd> to join
                           </p>
                           <p className={styles.small}>P2 on the keyboard: Enter</p>
                           {freeKeyboard && i === players.length && (
                              <button type="button" className={styles.secondary} onClick={() => playersStore.getState().join(freeKeyboard)}>
                                 Join with {deviceLabel(freeKeyboard).toLowerCase()}
                              </button>
                           )}
                        </div>
                     )}
                  </li>
               ))}
            </ol>

            <footer className={styles.foot}>
               <p className={styles.status} role="status" aria-live="polite">
                  {startAt !== null ? "Everyone ready. Starting..." : blocker}
                  <span className={styles.small}> · Gamepads: {pads.length}</span>
               </p>
               <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={onClose}>
                     Back
                  </button>
               </div>
            </footer>
         </div>
      </div>,
      document.body,
   );
}

function JoinedSlot({ player, hero, heroes, unique }: { player: PlayerState; hero: MpHero; heroes: readonly MpHero[]; unique: boolean }) {
   const store = playersStore.getState;
   const s = usePlayers((st) => st);
   return (
      <div className={styles.joined}>
         <p className={styles.device}>{deviceLabel(player.device as DeviceId)}</p>
         <div className={styles.hero} style={{ ["--hero" as string]: hero.color }}>
            <button type="button" className={styles.arrow} aria-label="Previous hero" disabled={player.ready} onClick={() => store().cycleHero(player.index, -1)}>
               ‹
            </button>
            <div className={styles.heroCard}>
               <span className={styles.swatch} aria-hidden="true" />
               <span className={styles.heroName}>{hero.name}</span>
               <span className={styles.power}>{hero.powerLabel}</span>
            </div>
            <button type="button" className={styles.arrow} aria-label="Next hero" disabled={player.ready} onClick={() => store().cycleHero(player.index, 1)}>
               ›
            </button>
         </div>
         <div className={styles.dots} role="group" aria-label="Heroes">
            {heroes.map((h) => {
               const taken = unique && heroTaken(s, h.id, player.index);
               return (
                  <button
                     key={h.id}
                     type="button"
                     className={h.id === player.heroId ? styles.dotOn : styles.dot}
                     style={{ background: h.color }}
                     aria-label={`${h.name}${taken ? " (taken)" : ""}`}
                     aria-pressed={h.id === player.heroId}
                     disabled={taken || player.ready}
                     onClick={() => store().pickHero(player.index, h.id)}
                  />
               );
            })}
         </div>
         <p className={styles.small}>{deviceControls(player.device)}</p>
         <div className={styles.slotActions}>
            <button
               type="button"
               className={player.ready ? styles.readyOn : styles.ready}
               aria-pressed={player.ready}
               onClick={() => store().setReady(player.index, !player.ready)}
            >
               {player.ready ? "Ready!" : "Ready up"}
            </button>
            <button type="button" className={styles.leave} aria-label={`P${player.index + 1} leave`} onClick={() => store().leave(player.index)}>
               ×
            </button>
         </div>
      </div>
   );
}
