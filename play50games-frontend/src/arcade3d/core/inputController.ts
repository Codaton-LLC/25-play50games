// DOM-free input state machine behind useInput(). Owned by Claude.
// InputProvider (input.tsx) feeds it real keyboard/pointer events; tests drive it directly.
import type { MutableRefObject } from "react";
import type { InputState } from "./types";

export type TouchButton = "jump" | "action";

const UP = new Set(["KeyW", "ArrowUp"]);
const DOWN = new Set(["KeyS", "ArrowDown"]);
const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);
const JUMP = new Set(["Space"]);
const ACTION = new Set(["KeyE", "Enter", "NumpadEnter"]);
const GAME_KEYS = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT, ...JUMP, ...ACTION]);

/** A swipe needs at least this many px within SWIPE_MAX_MS. */
export const SWIPE_MIN_PX = 30;
export const SWIPE_MAX_MS = 700;
/** A tap moves at most this many px and lasts at most TAP_MAX_MS. */
export const TAP_MAX_PX = 12;
export const TAP_MAX_MS = 350;

export interface InputController {
   /** the ref games read (same object for the whole session) */
   state: MutableRefObject<InputState>;
   /** returns true when the key is a game key (the caller may preventDefault) */
   keyDown(code: string, repeat?: boolean): boolean;
   keyUp(code: string): void;
   /** joystick vector, each axis -1..1 (up = -1) */
   setJoystick(x: number, y: number): void;
   setButton(button: TouchButton, down: boolean): void;
   /** x/y: normalised canvas coordinates; px/py: screen pixels (for swipe distance) */
   pointerDown(x: number, y: number, px: number, py: number, timeMs: number): void;
   pointerMove(x: number, y: number): void;
   pointerUp(px: number, py: number, timeMs: number): void;
   pointerCancel(): void;
   /** once per frame, before game logic: publishes held input and this frame's one-shot events */
   latch(): void;
   /** drops pending one-shot events (phase changes) */
   clearEvents(): void;
   /** releases everything that is held (blur, tab hidden, unmount) */
   release(): void;
}

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

/** DOM-free input state machine (unit-testable). InputProvider wires it to real events. */
export function createInputController(): InputController {
   const state: InputState = {
      moveX: 0,
      moveY: 0,
      jump: false,
      action: false,
      jumpPressed: false,
      actionPressed: false,
      swipe: null,
      tap: null,
      pointer: { x: 0, y: 0, down: false },
   };
   const ref: MutableRefObject<InputState> = { current: state };

   const keys = new Set<string>();
   let joyX = 0;
   let joyY = 0;
   let touchJump = false;
   let touchAction = false;
   let pendingJump = false;
   let pendingAction = false;
   let pendingSwipe: InputState["swipe"] = null;
   let pendingTap: InputState["tap"] = null;
   let gesture: { x: number; y: number; px: number; py: number; t: number } | null = null;

   const anyKey = (set: Set<string>) => {
      for (const code of set) if (keys.has(code)) return true;
      return false;
   };

   const controller: InputController = {
      state: ref,

      keyDown(code, repeat = false) {
         if (!GAME_KEYS.has(code)) return false;
         const wasDown = keys.has(code);
         keys.add(code);
         if (!wasDown && !repeat) {
            if (JUMP.has(code)) pendingJump = true;
            if (ACTION.has(code)) pendingAction = true;
         }
         return true;
      },

      keyUp(code) {
         keys.delete(code);
      },

      setJoystick(x, y) {
         joyX = clamp1(x);
         joyY = clamp1(y);
      },

      setButton(button, down) {
         if (button === "jump") {
            if (down && !touchJump) pendingJump = true;
            touchJump = down;
         } else {
            if (down && !touchAction) pendingAction = true;
            touchAction = down;
         }
      },

      pointerDown(x, y, px, py, timeMs) {
         state.pointer.x = x;
         state.pointer.y = y;
         state.pointer.down = true;
         gesture = { x, y, px, py, t: timeMs };
      },

      pointerMove(x, y) {
         state.pointer.x = x;
         state.pointer.y = y;
      },

      pointerUp(px, py, timeMs) {
         state.pointer.down = false;
         if (!gesture) return;
         const dx = px - gesture.px;
         const dy = py - gesture.py;
         const dist = Math.hypot(dx, dy);
         const dt = timeMs - gesture.t;
         if (dist >= SWIPE_MIN_PX && dt <= SWIPE_MAX_MS) {
            pendingSwipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
         } else if (dist <= TAP_MAX_PX && dt <= TAP_MAX_MS) {
            pendingTap = { x: gesture.x, y: gesture.y };
         }
         gesture = null;
      },

      pointerCancel() {
         state.pointer.down = false;
         gesture = null;
      },

      latch() {
         let x = joyX + (anyKey(RIGHT) ? 1 : 0) - (anyKey(LEFT) ? 1 : 0);
         let y = joyY + (anyKey(DOWN) ? 1 : 0) - (anyKey(UP) ? 1 : 0);
         x = clamp1(x);
         y = clamp1(y);
         // diagonal keys must not be faster than straight ones
         const len = Math.hypot(x, y);
         if (len > 1) {
            x /= len;
            y /= len;
         }
         state.moveX = x;
         state.moveY = y;
         state.jump = anyKey(JUMP) || touchJump;
         state.action = anyKey(ACTION) || touchAction;
         state.jumpPressed = pendingJump;
         state.actionPressed = pendingAction;
         state.swipe = pendingSwipe;
         state.tap = pendingTap;
         pendingJump = false;
         pendingAction = false;
         pendingSwipe = null;
         pendingTap = null;
      },

      clearEvents() {
         pendingJump = false;
         pendingAction = false;
         pendingSwipe = null;
         pendingTap = null;
         state.jumpPressed = false;
         state.actionPressed = false;
         state.swipe = null;
         state.tap = null;
      },

      release() {
         keys.clear();
         joyX = 0;
         joyY = 0;
         touchJump = false;
         touchAction = false;
         gesture = null;
         state.moveX = 0;
         state.moveY = 0;
         state.jump = false;
         state.action = false;
         state.pointer.down = false;
         controller.clearEvents();
      },
   };
   return controller;
}
