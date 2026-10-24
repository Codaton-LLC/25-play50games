"use client";

// The level the player picked, for the Scene, the game HUD and the rules (core/README.md "Levels").
// GameShell provides it around the stage (R3F bridges the context into the Canvas, like the safe
// area) and the game HUD. A game wraps the hook once with its own config type:
//    export const useCastleLevel = () => useLevel<CastleLevel>();
// The Scene remounts per run (runId), so it reads the config once per run:
//    const { config } = useCastleLevel();
//    const run = useMemo(() => createRun(seed, config), [runId]);
// Frame loops read useArcadeStore.getState().levelId only if they really must.
import { createContext, useContext, type ReactNode } from "react";
import type { ActiveLevel } from "./levels";

const LevelContext = createContext<ActiveLevel<unknown> | null>(null);

export function LevelProvider({ value, children }: { value: ActiveLevel<unknown>; children: ReactNode }) {
   return <LevelContext.Provider value={value}>{children}</LevelContext.Provider>;
}

/**
 * The active level: its id, its LevelMeta, its LevelSpec (null for a game without levels) and the
 * spec's typed config. Throws outside GameShell (a game component always renders inside it).
 */
export function useLevel<C = unknown>(): ActiveLevel<C> {
   const level = useContext(LevelContext);
   if (!level) throw new Error("useLevel() must be used inside GameShell");
   return level as ActiveLevel<C>;
}
