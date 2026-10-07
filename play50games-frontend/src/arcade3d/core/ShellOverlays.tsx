"use client";

// The shell's overlay frame and its start card. Owned by Claude; GameShell renders them.
// - Overlay: a full-screen dialog whose panel never outgrows the free area (the overlay's padding
//   keeps the notch and the cookie banner clear), so a tall panel scrolls inside itself and its
//   frame and buttons stay on screen. The mouse wheel over the backdrop beside it scrolls the panel.
// - StartCard: back link, title, tagline, instructions, controls, best score, Play, top 10. On a
//   short screen (a landscape phone, a portrait phone under the cookie banner) the card scrolls and
//   Play stays pinned to its bottom, above the banner. It opens scrolled to the top (title first);
//   Play takes the focus without scrolling the card (FocusButton, not autoFocus).
// - HudButtons: the HUD's Mute and Pause. Pause is shown (and in the tab order) only while the run
//   can be paused, so the start card's Play is the first focus and nothing is tabbable behind it.
import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from "@heroicons/react/24/solid";
import type { ArcadeGameMeta } from "../types";
import type { GameDefinition } from "./types";
import type { LeaderboardState } from "./useLeaderboard";
import { useInitialFocus } from "./overlayFocus";
import BestScoreBadge from "../ui/BestScoreBadge";
import LeaderboardTable from "../ui/LeaderboardTable";
import styles from "./GameShell.module.css";

export interface BackdropWheel {
   target: unknown;
   currentTarget: unknown;
   deltaY: number;
   /** WheelEvent.deltaMode: 0 pixels, 1 lines, 2 pages */
   deltaMode: number;
   ctrlKey: boolean;
}

export interface ScrollBox {
   scrollHeight: number;
   clientHeight: number;
   scrollBy(options: ScrollToOptions): void;
}

/** px per wheel line (deltaMode 1, Firefox) */
const WHEEL_LINE_PX = 16;

/**
 * The wheel over the backdrop beside a panel scrolls the panel, as it scrolled the whole overlay
 * before the panel scrolled itself (a desktop start card with its top 10 is taller than the
 * screen). false, and nothing scrolls, when the wheel is over the panel (it scrolls natively),
 * zooms (ctrl), the overlay can scroll itself, or the panel has nothing to scroll.
 */
export function scrollPanelFromBackdrop(event: BackdropWheel, overlay: ScrollBox, panel: ScrollBox | null): boolean {
   if (!panel || event.ctrlKey || event.deltaY === 0 || event.target !== event.currentTarget) return false;
   if (overlay.scrollHeight > overlay.clientHeight + 1 || panel.scrollHeight <= panel.clientHeight + 1) return false;
   const unit = event.deltaMode === 1 ? WHEEL_LINE_PX : event.deltaMode === 2 ? panel.clientHeight : 1;
   panel.scrollBy({ top: event.deltaY * unit });
   return true;
}

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

         {/* sticky: pinned to the bottom of the card while the card scrolls */}
         <div className={styles.startAction}>
            <FocusButton className={styles.primary} onClick={onPlay}>
               Play
            </FocusButton>
         </div>

         <LeaderboardBlock leaderboard={leaderboard} meta={meta} />
      </Overlay>
   );
}
