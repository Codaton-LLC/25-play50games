"use client";

// The DOM wiring of playerInput.ts: window keys (both keyboard halves) and navigator.getGamepads()
// into the page's one hub. Exactly one driver polls and latches per frame:
// - in the lobby, the join screen's requestAnimationFrame loop (useLobbyFrame);
// - during multiplayer runs, <PlayerInputLatch /> inside the Canvas at FRAME_PRIORITY.input, so a
//   game's useRunFrame reads this frame's input, as with the core useInput().
// The core InputProvider keeps listening too (single player is unchanged); a multiplayer scene
// simply reads the hub instead of useInput(). Esc / P stay the shell's pause; a gamepad's Start
// pauses and resumes through the store.
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { arcadeStore } from "@/arcade3d/core/useArcadeStore";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { createPlayerInputHub, type GamepadLike, type HotplugEvent, type PadDevice, type PlayerInput } from "./playerInput";
import { isMultiplayerActive, playersStore } from "./players";

/** The page's one hub. */
export const playerInputHub = createPlayerInputHub();

let attached = 0;
let detach: (() => void) | null = null;
/** while true, handled keys never scroll the page or press a focused button */
let captureKeys = () => false;
const padListeners = new Set<() => void>();
let padSnapshot: readonly PadDevice[] = [];

function isEditable(target: EventTarget | null): boolean {
   if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function readPads(): ArrayLike<GamepadLike | null> | null {
   try {
      return typeof navigator !== "undefined" && navigator.getGamepads ? (navigator.getGamepads() as unknown as ArrayLike<GamepadLike | null>) : null;
   } catch {
      return null;
   }
}

/** Polls the pads into the hub; a pad unplugged in the lobby takes its player out. */
export function pollPads(): HotplugEvent[] {
   const events = playerInputHub.pollGamepads(readPads());
   if (events.length > 0) {
      const s = playersStore.getState();
      for (const e of events) if (e.type === "disconnected" && s.phase === "lobby") s.dropDevice(e.device);
      padSnapshot = playerInputHub.connectedPads().slice();
      for (const fn of padListeners) fn();
   }
   return events;
}

function attach(): () => void {
   attached++;
   if (attached === 1 && typeof window !== "undefined") {
      let rightCtrl = false;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.code === "ControlRight") rightCtrl = true;
         // Right-Ctrl is P2's jump: an arrow pressed while it is held still counts
         if ((event.ctrlKey && !rightCtrl) || event.metaKey || event.altKey || isEditable(event.target)) return;
         if (playerInputHub.keyDown(event.code, event.repeat) && captureKeys()) event.preventDefault();
      };
      const onKeyUp = (event: KeyboardEvent) => {
         if (event.code === "ControlRight") rightCtrl = false;
         playerInputHub.keyUp(event.code);
         // Space presses a focused button on key up
         if (captureKeys() && event.code === "Space") event.preventDefault();
      };
      const onBlur = () => {
         rightCtrl = false;
         playerInputHub.release();
      };
      const onVisibility = () => {
         if (document.visibilityState === "hidden") onBlur();
      };
      const onPad = () => pollPads();
      window.addEventListener("keydown", onKeyDown, true);
      window.addEventListener("keyup", onKeyUp, true);
      window.addEventListener("blur", onBlur);
      window.addEventListener("gamepadconnected", onPad);
      window.addEventListener("gamepaddisconnected", onPad);
      document.addEventListener("visibilitychange", onVisibility);
      detach = () => {
         window.removeEventListener("keydown", onKeyDown, true);
         window.removeEventListener("keyup", onKeyUp, true);
         window.removeEventListener("blur", onBlur);
         window.removeEventListener("gamepadconnected", onPad);
         window.removeEventListener("gamepaddisconnected", onPad);
         document.removeEventListener("visibilitychange", onVisibility);
         playerInputHub.release();
      };
   }
   return () => {
      attached--;
      if (attached === 0 && detach) {
         detach();
         detach = null;
      }
   };
}

/** Keys are taken over (no scroll, no button press) in the lobby and during a multiplayer run. */
captureKeys = () => {
   const mp = playersStore.getState();
   if (mp.phase === "lobby") return true;
   if (!isMultiplayerActive(mp)) return false;
   const phase = arcadeStore.getState().phase;
   return phase === "playing" || phase === "countdown";
};

/** Listens to the keyboard and the pads while mounted (ref-counted: several users share one listener). */
export function usePlayerInputListeners(): void {
   useEffect(() => attach(), []);
}

/** The gamepads connected right now (re-renders on hot-plug). */
export function useConnectedPads(): readonly PadDevice[] {
   return useSyncExternalStore(
      (fn) => {
         padListeners.add(fn);
         return () => {
            padListeners.delete(fn);
         };
      },
      () => padSnapshot,
      () => padSnapshot,
   );
}

/** The join screen's loop: poll + latch, then `onFrame` (requestAnimationFrame, while mounted). */
export function useLobbyFrame(onFrame: () => void): void {
   usePlayerInputListeners();
   const fn = useRef(onFrame);
   fn.current = onFrame;
   useEffect(() => {
      let id = 0;
      playerInputHub.clearEvents();
      const loop = () => {
         pollPads();
         playerInputHub.latch();
         fn.current();
         id = requestAnimationFrame(loop);
      };
      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
   }, []);
}

/** The input of player slot `index` this frame (idle when the slot is empty). */
export function playerInputFor(index: number): Readonly<PlayerInput> {
   const p = playersStore.getState().players.find((q) => q.index === index);
   return p ? playerInputHub.device(p.device) : IDLE;
}

const IDLE: PlayerInput = {
   moveX: 0,
   moveY: 0,
   jump: false,
   action: false,
   jumpPressed: false,
   actionPressed: false,
   pressed: { left: false, right: false, up: false, down: false },
   pausePressed: false,
};

/**
 * Rendered once inside the Canvas by a multiplayer scene: polls and latches every frame before the
 * run clock and the simulation, and a gamepad's Start pauses / resumes the run.
 */
export function PlayerInputLatch() {
   usePlayerInputListeners();
   useEffect(() => {
      playerInputHub.clearEvents();
      // while paused the shell stops the Canvas loop (frameloop "demand"): a page loop then watches
      // for Start, so a gamepad can resume
      let id = 0;
      const pausedLoop = () => {
         pollPads();
         playerInputHub.latch();
         if (startPressed()) {
            arcadeStore.getState().resume();
            return;
         }
         id = requestAnimationFrame(pausedLoop);
      };
      const unsubscribe = arcadeStore.subscribe((state, prev) => {
         if (state.phase === prev.phase) return;
         // a phase change drops pending one-frame events, as the core input does
         playerInputHub.clearEvents();
         cancelAnimationFrame(id);
         if (state.phase === "paused" && typeof requestAnimationFrame !== "undefined") id = requestAnimationFrame(pausedLoop);
      });
      return () => {
         cancelAnimationFrame(id);
         unsubscribe();
      };
   }, []);
   useFrame(() => {
      const store = arcadeStore.getState();
      if (store.phase === "paused") return;
      pollPads();
      playerInputHub.latch();
      if (startPressed() && (store.phase === "playing" || store.phase === "countdown")) store.pause();
   }, FRAME_PRIORITY.input);
   return null;
}

/** Some player pressed Start this frame. */
function startPressed(): boolean {
   for (const p of playersStore.getState().players) if (playerInputHub.device(p.device).pausePressed) return true;
   return false;
}
