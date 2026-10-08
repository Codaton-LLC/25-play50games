"use client";

// The shell's overlay frame and its start card. Owned by Claude; GameShell renders them.
// - Overlay: a full-screen dialog whose panel never outgrows the free area (the overlay's padding
//   keeps the notch and the cookie banner clear), so a tall panel scrolls inside itself and its
//   frame and buttons stay on screen. The mouse wheel over the backdrop beside it scrolls the panel.
// - StartCard: back link, title, tagline, instructions, controls, best score, Play, top 10. On a
//   short screen (a landscape phone, a portrait phone under the cookie banner) the card scrolls and
//   Play stays pinned to its bottom, above the banner, or to its top once the top 10 is scrolled up,
//   so Play is always on screen. It opens scrolled to the top (title first); Play takes the focus
//   without scrolling the card (FocusButton, not autoFocus).
// - HudChips: the HUD's score, time, lives and game stats. A time game has no score chip: its rank
//   is the finish time, and a "Score 0" next to the running clock read as a score that never moves.
// - HudButtons: the HUD's Mute and Pause. Pause is shown (and in the tab order) only while the run
//   can be paused, so the start card's Play is the first focus and nothing is tabbable behind it.
import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import type { ArcadeGameMeta, ScoringRules } from "../types";
import type { GameDefinition } from "./types";
import type { LeaderboardState } from "./useLeaderboard";
import { useInitialFocus } from "./overlayFocus";
import { scrollPanelFromBackdrop } from "./overlayScroll";
import BestScoreBadge from "../ui/BestScoreBadge";
import LeaderboardTable from "../ui/LeaderboardTable";
import styles from "./GameShell.module.css";

export { scrollPanelFromBackdrop, type BackdropWheel, type ScrollBox } from "./overlayScroll";

export function Overlay({
   children,
   label,
   className,
   panelClassName,
}: {
   children: ReactNode;
   label: string;
   className?: string;
   panelClassName?: string;
}) {
   const panelRef = useRef<HTMLDivElement>(null);
   return (
      <div
         className={`${styles.overlay} ${className ?? ""}`}
         role="dialog"
         aria-modal="true"
         aria-label={label}
         onWheel={(event) => scrollPanelFromBackdrop(event, event.currentTarget, panelRef.current)}
      >
         <div ref={panelRef} className={`${styles.panel} ${panelClassName ?? ""}`}>
            {children}
         </div>
      </div>
   );
}

/** A button that takes the focus when it mounts, without scrolling its overlay (instead of autoFocus). */
export function FocusButton(props: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "autoFocus">) {
   const ref = useRef<HTMLButtonElement>(null);
   useInitialFocus(ref);
   return <button {...props} ref={ref} type="button" />;
}

/** "1:05": whole seconds as minutes and seconds */
export const hudClock = (seconds: number) => {
   const total = Math.max(0, Math.ceil(seconds));
   return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * The HUD shows a score chip only for points games. A time game (escape-room, obstacle-race) is
 * ranked by its finish time; its store score stays 0 all run, so its HUD is the clock and its stats.
 */
export const hudShowsScore = (kind: ScoringRules["kind"]): boolean => kind !== "time";

export interface HudChipsProps {
   /** meta.scoring as it is: the chips derive the kind themselves, so no caller passes a wrong one */
   scoring: ScoringRules;
   score: number;
   /** whole seconds: left when `timed`, played otherwise */
   time: number;
   /** the run has a time limit (GameDefinition.durationMs) */
   timed: boolean;
   lives: number | null;
   stats: Record<string, number>;
   hudStats?: GameDefinition["hudStats"];
}

/** The HUD's first group: score (points games only), time, lives and the game's stats. */
export function HudChips({ scoring, score, time, timed, lives, stats, hudStats }: HudChipsProps) {
   const low = timed && time <= 10;
   return (
      <div className={styles.hudGroup}>
         {hudShowsScore(scoring.kind) && (
            <span className={styles.chip} role="group" aria-label={`Score ${score}`}>
               <span className={styles.chipLabel}>Score</span>
               <span className={styles.chipValue}>{score.toLocaleString("en-US")}</span>
            </span>
         )}
         <span
            className={`${styles.chip} ${low ? styles.chipWarn : ""}`}
            role="group"
            aria-label={timed ? `${time} seconds left` : `${time} seconds played`}
         >
            <span className={styles.chipLabel}>{timed ? "Time" : "Played"}</span>
            <span className={styles.chipValue}>{hudClock(time)}</span>
         </span>
         {lives !== null && (
            <span className={styles.chip} role="group" aria-label={`${lives} lives left`}>
               <span className={styles.chipLabel}>Lives</span>
               <span className={styles.chipValue} aria-hidden="true">
                  {lives > 0 ? "♥".repeat(Math.min(lives, 5)) : "–"}
                  {lives > 5 ? ` ${lives}` : ""}
               </span>
            </span>
         )}
         {hudStats?.map((stat) => {
            const value = stats[stat.key] ?? 0;
            return (
               <span key={stat.key} className={styles.chip}>
                  <span className={styles.chipLabel}>{stat.label}</span>
                  <span className={styles.chipValue}>
                     {value}
                     {stat.max !== undefined ? `/${stat.max}` : ""}
                  </span>
               </span>
            );
         })}
      </div>
   );
}

export interface HudButtonsProps {
   /** the whole HUD is laid out but hidden (start card, result screen, a crashed stage) */
   hidden: boolean;
   /** the run counts down or is played (frameLoop isPausable) */
   canPause: boolean;
   muted: boolean;
   onToggleMute: () => void;
   onPause: () => void;
}

/**
 * Mute and Pause, the HUD's last group. Both keep their place in every phase (the safe area
 * measures the group, so a camera fit never jumps when the run starts), but only a button that can
 * act is shown and tabbable: Mute whenever the HUD is up, Pause only while the run counts down or
 * is played (hidden on the start card, while paused, during the result delay and on the result
 * screen). Esc / P pause by the same rule (GameShell).
 */
export function HudButtons({ hidden, canPause, muted, onToggleMute, onPause }: HudButtonsProps) {
   return (
      <div className={styles.hudGroup}>
         <button
            type="button"
            className={styles.iconButton}
            onClick={() => onToggleMute()}
            aria-label="Mute sound"
            aria-pressed={muted}
            tabIndex={hidden ? -1 : undefined}
         >
            {muted ? <SpeakerXMarkIcon aria-hidden="true" /> : <SpeakerWaveIcon aria-hidden="true" />}
         </button>
         <button
            type="button"
            className={styles.iconButton}
            onClick={onPause}
            disabled={!canPause}
            aria-label="Pause game"
            aria-keyshortcuts="Escape P"
            tabIndex={hidden || !canPause ? -1 : undefined}
            style={canPause ? undefined : { visibility: "hidden" }}
         >
            <PauseIcon aria-hidden="true" />
         </button>
      </div>
   );
}

export function LeaderboardBlock({ leaderboard, meta }: { leaderboard: LeaderboardState; meta: ArcadeGameMeta }) {
   if (!leaderboard.enabled) return null;
   return (
      <section className={styles.leaderboard} aria-label={`${meta.title} top 10`}>
         <h2 className={styles.sectionTitle}>Top 10</h2>
         <LeaderboardTable
            entries={leaderboard.data?.entries ?? []}
            me={leaderboard.data?.me ?? null}
            loading={leaderboard.loading}
            error={leaderboard.error}
            scoring={meta.scoring}
            onRetry={leaderboard.retry}
         />
      </section>
   );
}

export interface StartCardProps {
   meta: ArcadeGameMeta;
   definition: GameDefinition;
   coarse: boolean;
   exitHref: string;
   leaderboard: LeaderboardState;
   onPlay: () => void;
}

export function StartCard({ meta, definition, coarse, exitHref, leaderboard, onPlay }: StartCardProps) {
   return (
      <Overlay label={`${meta.title}: start`} panelClassName={styles.startPanel}>
         <Link href={exitHref} className={styles.backLink}>
            <ArrowLeftIcon aria-hidden="true" /> 3D Arcade
         </Link>
         <h1 className={styles.title}>{meta.title}</h1>
         <p className={styles.tagline}>{meta.tagline}</p>

         {definition.instructions.length > 0 && (
            <ul className={styles.instructions}>
               {definition.instructions.map((line) => (
                  <li key={line}>{line}</li>
               ))}
            </ul>
         )}

         <dl className={styles.controls}>
            <div className={coarse ? styles.controlDim : undefined}>
               <dt>Keyboard</dt>
               <dd>{meta.controls.keyboard}. Esc or P pauses.</dd>
            </div>
            <div className={coarse ? undefined : styles.controlDim}>
               <dt>Touch</dt>
               <dd>{meta.controls.touch}</dd>
            </div>
         </dl>

         <div className={styles.best}>
            <BestScoreBadge slug={meta.slug} />
         </div>

         {/* sticky: pinned to the card's bottom, or to its top once the top 10 is scrolled up */}
         <div className={styles.startAction}>
            <FocusButton className={styles.primary} onClick={onPlay}>
               Play
            </FocusButton>
         </div>

         <LeaderboardBlock leaderboard={leaderboard} meta={meta} />
      </Overlay>
   );
}
