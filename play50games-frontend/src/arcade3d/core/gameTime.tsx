"use client";

// Pause-safe animation time for one run. ShellStage wraps the Scene in <GameTimeProvider key={runId}>,
// so every run starts at 0. Games read it inside useFrame:
//
//    const time = useGameTime();
//    useFrame(() => { coin.current.rotation.y = time.now * 2; });
//
// Never use state.clock.elapsedTime instead: GameShell pauses by switching the R3F frameloop, and
// R3F resets that clock on every switch (a pop-in that started at t = 30 would wait for 30 s again).
import { createContext, useContext, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { arcadeStore } from "./useArcadeStore";
import { FRAME_PRIORITY, advanceGameTime, createGameTime, type GameTime } from "./frameLoop";

export { MAX_ANIM_DT, type GameTime } from "./frameLoop";

const GameTimeContext = createContext<GameTime | null>(null);

/** Rendered by ShellStage around the Scene (keyed by runId). Games never render it. */
export function GameTimeProvider({ children }: { children: ReactNode }) {
   const [time] = useState(createGameTime);
   useFrame((_state, delta) => {
      const { phase, elapsedMs } = arcadeStore.getState();
      advanceGameTime(time, phase, delta, elapsedMs);
   }, FRAME_PRIORITY.gameTime);
   return <GameTimeContext.Provider value={time}>{children}</GameTimeContext.Provider>;
}

/**
 * This run's clocks (one object, mutated every frame before any game callback):
 * `now` animation seconds (stops while paused), `delta` this frame's step of `now`,
 * `play` play seconds (only while "playing"). See GameTime in core/frameLoop.ts.
 */
export function useGameTime(): GameTime {
   const time = useContext(GameTimeContext);
   if (!time) throw new Error("useGameTime must be used inside a GameShell Scene.");
   return time;
}
