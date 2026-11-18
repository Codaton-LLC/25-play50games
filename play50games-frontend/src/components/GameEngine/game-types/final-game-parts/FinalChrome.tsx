"use client";

// Shared, display-only pieces of the five Final games (look only: no rule, score, timing or unlock
// lives here). Styles: finalChrome.module.css (gold on a final page through the stage tokens).

import type { ComponentType, ReactNode, SVGProps } from "react";
import {
   ArrowPathIcon,
   ArrowPathRoundedSquareIcon,
   CheckCircleIcon,
   LockClosedIcon,
   PlayIcon,
   ShareIcon,
   TrophyIcon,
   XCircleIcon,
} from "@heroicons/react/24/outline";
import c from "./finalChrome.module.css";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export { c as chrome };

export function Progress({ value }: { value: number }) {
   const v = Math.max(0, Math.min(100, value));
   return (
      <div
         className={c.progress}
         role="progressbar"
         aria-valuemin={0}
         aria-valuemax={100}
         aria-valuenow={Math.round(v)}
      >
         <div
            className={c.progressFill}
            style={{ transform: `scaleX(${v / 100})` }}
         />
      </div>
   );
}

/** Title, optional subtitle, stat chips and a progress bar. */
export function FinalHead({
   title,
   subtitle,
   chips,
   progress,
}: {
   title: string;
   subtitle?: ReactNode;
   chips: { icon?: Icon; label: ReactNode }[];
   progress: number;
}) {
   return (
      <div className={c.head}>
         <h2 className={c.title}>
            <TrophyIcon className={c.titleIcon} aria-hidden="true" />
            {title}
         </h2>
         {subtitle && <p className={c.subtitle}>{subtitle}</p>}
         <div className={c.chips}>
            {chips.map((chip, i) => {
               const ChipIcon = chip.icon;
               return (
                  <span key={i} className={c.chip}>
                     {ChipIcon && <ChipIcon className={c.chipIcon} aria-hidden="true" />}
                     {chip.label}
                  </span>
               );
            })}
         </div>
         <Progress value={progress} />
      </div>
   );
}

/** The round / score line and progress at the top of a final mini-game. */
export function MiniHead({
   unit = "Round",
   current,
   total,
   score,
   progress,
   extra,
}: {
   unit?: string;
   current: number;
   total: number;
   score: number;
   progress: number;
   extra?: ReactNode;
}) {
   return (
      <div className={`${c.panel} ${c.miniHead}`}>
         <div className={c.miniStats}>
            <span className={c.miniStat}>
               <ArrowPathIcon className={c.chipIcon} aria-hidden="true" />
               {unit} {current} / {total}
            </span>
            <span className={c.miniStat}>
               <TrophyIcon className={c.chipIcon} aria-hidden="true" />
               Score: {score} / 100
            </span>
            {extra}
         </div>
         <Progress value={progress} />
      </div>
   );
}

export type StepState = "locked" | "waiting" | "active" | "done";

/** One challenge of a ladder: its head always shows; the body only while it is playable. */
export function ChallengeStep({
   index,
   total,
   name,
   state,
   lockedNote,
   interactive,
   children,
}: {
   index: number;
   total: number;
   name: string;
   state: StepState;
   lockedNote: string;
   interactive: boolean;
   children?: ReactNode;
}) {
   const stateClass =
      state === "locked" ? c.locked : state === "done" ? c.done : state === "active" ? c.active : "";
   return (
      <section
         className={`${c.step} ${stateClass}`}
         aria-label={`${name} (${index + 1}/${total})`}
      >
         <div className={c.stepHead}>
            <span className={c.stepNum}>{index + 1}</span>
            <h4 className={c.stepName}>
               {name} <span className={c.stepCount}>({index + 1}/{total})</span>
            </h4>
            <span className={c.stepState}>
               {state === "locked" ? (
                  <>
                     <LockClosedIcon className={c.stepStateIcon} aria-hidden="true" />
                     Locked
                  </>
               ) : state === "done" ? (
                  <>
                     <CheckCircleIcon className={c.stepStateIcon} aria-hidden="true" />
                     Completed
                  </>
               ) : (
                  <>
                     <PlayIcon className={c.stepStateIcon} aria-hidden="true" />
                     {state === "active" ? "Now" : "Next"}
                  </>
               )}
            </span>
         </div>
         {state === "locked" && <p className={c.stepNote}>{lockedNote}</p>}
         {(state === "active" || state === "waiting") && (
            <div
               className={c.stepBody}
               style={{ pointerEvents: interactive ? "auto" : "none" }}
            >
               {children}
            </div>
         )}
      </section>
   );
}

export function Feedback({
   ok,
   children,
}: {
   ok: boolean;
   children: ReactNode;
}) {
   return (
      <div
         role="status"
         className={`${c.feedback} ${ok ? c.feedbackOk : c.feedbackBad}`}
      >
         {ok ? (
            <CheckCircleIcon className={c.feedbackIcon} aria-hidden="true" />
         ) : (
            <XCircleIcon className={c.feedbackIcon} aria-hidden="true" />
         )}
         <span>{children}</span>
      </div>
   );
}

/** A "Complete" sheet: a gold badge, a line, and optional actions. */
export function DoneSheet({
   badge,
   icon = "trophy",
   text,
   children,
}: {
   badge: ReactNode;
   icon?: "trophy" | "check";
   text: ReactNode;
   children?: ReactNode;
}) {
   const BadgeIcon = icon === "check" ? CheckCircleIcon : TrophyIcon;
   return (
      <div className={`${c.panel} ${c.sheet}`}>
         <span className={c.badge}>
            <BadgeIcon className={c.badgeIcon} aria-hidden="true" />
            {badge}
         </span>
         <p className={c.sheetText}>{text}</p>
         {children}
      </div>
   );
}

/** Replay / share bar with its two notes (texts unchanged from the games). */
export function ReplayShareBar({
   shareSuccess,
   unlimitedActivated,
   maxReplays,
   replaysUsed,
   onReplay,
   onShare,
}: {
   shareSuccess: boolean;
   unlimitedActivated: boolean;
   maxReplays: number;
   replaysUsed: number;
   onReplay: () => void;
   onShare: () => void;
}) {
   const replaysOut = maxReplays > 0 && replaysUsed >= maxReplays;
   return (
      <div className={c.actions}>
         {shareSuccess && !unlimitedActivated && (
            <div className={c.note} role="status">
               <CheckCircleIcon className={c.noteIcon} aria-hidden="true" />
               <span>
                  Link copied! Unlimited replay will unlock when someone opens
                  your link!
               </span>
            </div>
         )}
         {unlimitedActivated && (
            <div className={c.note} role="status">
               <CheckCircleIcon className={c.noteIcon} aria-hidden="true" />
               <span>
                  Someone opened your link! Unlimited replay is now active for
                  15 minutes!
               </span>
            </div>
         )}
         <button
            type="button"
            onClick={onReplay}
            disabled={replaysOut}
            className={c.pill}
         >
            <ArrowPathRoundedSquareIcon className={c.pillIcon} aria-hidden="true" />
            Replay
            {maxReplays > 0 && ` (${maxReplays - replaysUsed} left)`}
         </button>
         <button type="button" onClick={onShare} className={c.pill}>
            <ShareIcon className={c.pillIcon} aria-hidden="true" />
            <span>Share for unlimited</span>
         </button>
      </div>
   );
}
