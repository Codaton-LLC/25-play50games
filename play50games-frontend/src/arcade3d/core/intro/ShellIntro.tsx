"use client";

// The shell's side of the opt-in intro (core/README.md "Game intro (opt-in)", "Shell wiring").
// A game sets `GameDefinition.intro: true`. Play on the start card then mounts <ShellIntroDriver>
// instead of calling start(): the run stays in "ready" (elapsedMs 0) while the intro plays, and
// `onDone` starts the run (the 3-2-1 countdown). The driver publishes the session through
// IntroContext, which the Canvas bridges, so the Scene renders <GameIntro> with its own keyframes:
//
//    const intro = useShellIntro();
//    {intro?.session && !intro.ready && <GameIntro session={intro.session} keyframes={KEYS} playCamera={PLAY} hero={intro.hero} />}
import { createContext, useContext, useEffect, type MutableRefObject } from "react";
import type { ArcadeGameMeta, LevelId } from "../../types";
import { GameIntroOverlay } from "./GameIntroOverlay";
import { useGameIntro } from "./useGameIntro";
import type { IntroSession } from "./introMachine";

export interface ShellIntroState {
   /** null until the hook's mount effect has read the storage (first render) */
   session: IntroSession | null;
   ready: boolean;
   /** the landing timeline 0..1 (GameIntro writes it every frame); the game moves its hero by it */
   hero: MutableRefObject<number>;
}

export const IntroContext = createContext<ShellIntroState | null>(null);

/** The running intro, or null (no intro, or none playing). Inside the Scene or the game HUD. */
export function useShellIntro(): ShellIntroState | null {
   return useContext(IntroContext);
}

/** "Level 1 — Training Sky" from meta.levels (whatever the levels flag), "" for a game without levels. */
export function introLevelName(meta: Pick<ArcadeGameMeta, "levels">, level: LevelId): string {
   const entry = meta.levels?.find((l) => l.id === level);
   return entry ? `Level ${level} — ${entry.title}` : "";
}

export interface ShellIntroDriverProps {
   slug: string;
   level: LevelId;
   title: string;
   levelName: string;
   hero: MutableRefObject<number>;
   onState: (state: ShellIntroState | null) => void;
   onDone: () => void;
}

/** Mounted from the Play handler while the intro plays: the hook, the DOM overlay, the published state. */
export function ShellIntroDriver({ slug, level, title, levelName, hero, onState, onDone }: ShellIntroDriverProps) {
   const intro = useGameIntro({ slug, level, title, levelName, onDone });
   const { session, ready } = intro;
   useEffect(() => {
      onState({ session, ready, hero });
   }, [session, ready, hero, onState]);
   useEffect(() => () => onState(null), [onState]);
   if (!intro.session || intro.ready) return null;
   return <GameIntroOverlay title={intro.title} levelName={intro.levelName} showsTitle={intro.showsTitle} onSkip={intro.skip} />;
}
