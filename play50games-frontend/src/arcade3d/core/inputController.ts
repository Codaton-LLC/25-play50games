// DOM-free input state machine behind useInput(). Owned by Claude.
// InputProvider (input.tsx) feeds it real keyboard/pointer events; tests drive it directly.
//
// - Held input (moveX/moveY, jump, action, pointer) is sampled once per frame by latch().
// - One-frame events (jumpPressed, actionPressed, pressed.*, swipe, tap, tapDown) are latched when
//   the event happens and published by the next latch(), so a key tapped between two frames is
//   never lost. A direction press comes from a new keydown of an arrow / WASD key (not
//   auto-repeat) or from a swipe in that direction.
// - pointerDown reports tapDown at once (before the gesture is known). A swipe fires during the
//   gesture, as soon as the pointer has travelled SWIPE_MIN_PX within SWIPE_MAX_MS (once per
//   gesture; pointerUp then reports nothing). pointerUp still reports a flick whose moves were not
//   seen, and a short press without travel is a tap.
// - createCanvasPointers decides which DOM pointer is the canvas pointer (one at a time, never one
//   that starts on the touch controls), so multi-touch is testable without a DOM.
import type { MutableRefObject } from "react";
import type { DirectionPresses, InputState } from "./types";

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

export type SwipeDirection = NonNullable<InputState["swipe"]>;

export interface InputController {
   /** the ref games read (same object for the whole session) */
   state: MutableRefObject<InputState>;
   /** returns true when the key is a game key (the caller may preventDefault) */
   keyDown(code: string, repeat?: boolean): boolean;
   keyUp(code: string): void;
   /** joystick vector, each axis -1..1 (up = -1) */
   setJoystick(x: number, y: number): void;
   setButton(button: TouchButton, down: boolean): void;
   /**
    * The canvas pointer went down (reports tapDown). x/y: normalised canvas coordinates; px/py:
    * screen pixels (for swipe distance)
    */
   pointerDown(x: number, y: number, px: number, py: number, timeMs: number): void;
   /**
    * x/y: normalised canvas coordinates. With the screen pixels and the time it also commits a
    * swipe as soon as the gesture has travelled SWIPE_MIN_PX within SWIPE_MAX_MS.
    */
   pointerMove(x: number, y: number, px?: number, py?: number, timeMs?: number): void;
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

/** The swipe a pointer travel of (dx, dy) screen px makes: by the dominant axis (a tie is vertical). */
export function swipeDirection(dx: number, dy: number): SwipeDirection {
   return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

const noPresses = (p: DirectionPresses) => {
   p.left = false;
   p.right = false;
   p.up = false;
   p.down = false;
};

/** DOM-free input state machine (unit-testable). InputProvider wires it to real events. */
export function createInputController(): InputController {
   const state: InputState = {
      moveX: 0,
      moveY: 0,
      jump: false,
      action: false,
      jumpPressed: false,
      actionPressed: false,
      pressed: { left: false, right: false, up: false, down: false },
      swipe: null,
      tap: null,
      tapDown: null,
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
   const pendingPress: DirectionPresses = { left: false, right: false, up: false, down: false };
   let pendingSwipe: InputState["swipe"] = null;
   let pendingTap: InputState["tap"] = null;
   let pendingTapDown: InputState["tapDown"] = null;
   /** the pointer gesture in progress; `swiped` once it has committed its swipe */
   let gesture: { x: number; y: number; px: number; py: number; t: number; swiped: boolean } | null = null;

   const swipe = (direction: SwipeDirection) => {
      pendingSwipe = direction;
      pendingPress[direction] = true;
   };

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
            if (LEFT.has(code)) pendingPress.left = true;
            if (RIGHT.has(code)) pendingPress.right = true;
            if (UP.has(code)) pendingPress.up = true;
            if (DOWN.has(code)) pendingPress.down = true;
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
         gesture = { x, y, px, py, t: timeMs, swiped: false };
         // on the press itself, whatever the gesture becomes (two downs in one frame: the latest)
         pendingTapDown = { x, y };
      },

      pointerMove(x, y, px, py, timeMs) {
         state.pointer.x = x;
         state.pointer.y = y;
         if (!gesture || gesture.swiped || px === undefined || py === undefined || timeMs === undefined) return;
         // commit the swipe the moment it is one (not on release): a lane change or a hop starts
         // while the finger is still moving
         const dx = px - gesture.px;
         const dy = py - gesture.py;
         if (Math.hypot(dx, dy) >= SWIPE_MIN_PX && timeMs - gesture.t <= SWIPE_MAX_MS) {
            gesture.swiped = true;
            swipe(swipeDirection(dx, dy));
         }
      },

      pointerUp(px, py, timeMs) {
         state.pointer.down = false;
         if (!gesture) return;
         const dx = px - gesture.px;
         const dy = py - gesture.py;
         const dist = Math.hypot(dx, dy);
         const dt = timeMs - gesture.t;
         // a swipe already reported while moving is not reported again, and is never a tap
         if (!gesture.swiped) {
            if (dist >= SWIPE_MIN_PX && dt <= SWIPE_MAX_MS) swipe(swipeDirection(dx, dy));
            else if (dist <= TAP_MAX_PX && dt <= TAP_MAX_MS) pendingTap = { x: gesture.x, y: gesture.y };
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
         const pressed = state.pressed;
         pressed.left = pendingPress.left;
         pressed.right = pendingPress.right;
         pressed.up = pendingPress.up;
         pressed.down = pendingPress.down;
         state.swipe = pendingSwipe;
         state.tap = pendingTap;
         state.tapDown = pendingTapDown;
         pendingJump = false;
         pendingAction = false;
         noPresses(pendingPress);
         pendingSwipe = null;
         pendingTap = null;
         pendingTapDown = null;
      },

      clearEvents() {
         pendingJump = false;
         pendingAction = false;
         noPresses(pendingPress);
         pendingSwipe = null;
         pendingTap = null;
         pendingTapDown = null;
         state.jumpPressed = false;
         state.actionPressed = false;
         noPresses(state.pressed);
         state.swipe = null;
         state.tap = null;
         state.tapDown = null;
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

/** The part of a DOM PointerEvent the canvas input reads (a PointerEvent fits as is). */
export interface CanvasPointerEvent {
   pointerId: number;
   /** "mouse" | "pen" | "touch" */
   pointerType: string;
   /** for a mouse, 0 = the main button */
   button: number;
   /** screen px (swipe and tap distance) */
   clientX: number;
   clientY: number;
   timeStamp: number;
}

export interface CanvasPointerOptions<E extends CanvasPointerEvent> {
   /** normalised -1..1 canvas coordinates of the event (y up), like InputState.pointer */
   toCanvas(event: E): readonly [number, number];
   /** true when the event is on the touch controls (joystick, Jump, Action) */
   onControls(event: E): boolean;
}

export interface CanvasPointers<E extends CanvasPointerEvent> {
   down(event: E): void;
   move(event: E): void;
   up(event: E): void;
   cancel(event: E): void;
}

/**
 * Routes canvas pointer events to the controller. InputProvider feeds it real PointerEvents.
 * The canvas follows one pointer at a time, its primary pointer: the first one that goes down on
 * the canvas while no other is followed (for a mouse, only the main button). A pointer that
 * starts on the touch controls never counts, so a finger holding the joystick or a button does
 * not block a tap beside it. The followed pointer's down is tapDown and its gesture is the
 * swipe or tap. Other fingers that land while it is down report nothing.
 */
export function createCanvasPointers<E extends CanvasPointerEvent>(
   controller: InputController,
   options: CanvasPointerOptions<E>,
): CanvasPointers<E> {
   let active: number | null = null;
   return {
      down(event) {
         if (active !== null || options.onControls(event)) return;
         if (event.pointerType === "mouse" && event.button !== 0) return;
         active = event.pointerId;
         const [x, y] = options.toCanvas(event);
         controller.pointerDown(x, y, event.clientX, event.clientY, event.timeStamp);
      },
      move(event) {
         if (options.onControls(event)) return;
         if (active !== null && event.pointerId !== active) return;
         const [x, y] = options.toCanvas(event);
         // screen px + time: the swipe fires mid-gesture, once it has travelled far enough
         controller.pointerMove(x, y, event.clientX, event.clientY, event.timeStamp);
      },
      up(event) {
         if (event.pointerId !== active) return;
         active = null;
         controller.pointerUp(event.clientX, event.clientY, event.timeStamp);
      },
      cancel(event) {
         if (event.pointerId !== active) return;
         active = null;
         controller.pointerCancel();
      },
   };
}
