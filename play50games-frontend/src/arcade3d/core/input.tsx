"use client";

// Unified input for 3D Arcade games. Owned by Claude.
// Keyboard (WASD/arrows move, Space jump, E/Enter action), the touch joystick and buttons,
// swipes, taps and presses (tapDown) on the canvas all feed ONE InputState ref. Games read it
// inside useRunFrame:
//
//    const input = useInput();
//    useRunFrame((_, dt) => { robot.position.x += input.current.moveX * SPEED * dt; });
//    useRunFrame(() => { if (input.current.pressed.left) changeLane(-1); });   // discrete moves
//    useRunFrame(() => { if (input.current.tapDown) flap(); });               // on touch, not release
//    useRunFrame(() => { const d = input.current.drag; if (d.released && !d.cancelled) shoot(d); });
//                                                     // aim drag: GameDefinition.input.drag = true
//    useRunFrame(() => { if (input.current.digit) pick(input.current.digit); });   // keys 1-9
//
// Esc / P are not game input: GameShell handles them (pause).
import {
   createContext,
   useContext,
   useEffect,
   useState,
   type MutableRefObject,
   type ReactNode,
   type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import type { LiveInputState } from "./types";
import { arcadeStore } from "./useArcadeStore";
import { FRAME_PRIORITY } from "./frameLoop";
import { createCanvasPointers, createInputController, type InputController } from "./inputController";

/** Screen-relative move input -> world direction for a camera yaw (pure, core/math.ts). */
export { inputToWorld } from "./math";

export {
   AIM_DRAG_FULL_PX,
   AIM_DRAG_MIN_PX,
   createCanvasPointers,
   createInputController,
   idleDrag,
   stepKeyboardAim,
   swipeDirection,
   SWIPE_MAX_MS,
   SWIPE_MIN_PX,
   TAP_MAX_MS,
   TAP_MAX_PX,
   type CanvasPointerEvent,
   type CanvasPointerOptions,
   type CanvasPointers,
   type InputController,
   type KeyboardAim,
   type KeyboardAimOptions,
   type SwipeDirection,
   type TouchButton,
} from "./inputController";

const InputContext = createContext<InputController | null>(null);

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

function isEditable(target: EventTarget | null): boolean {
   if (!(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Elements inside this attribute (the touch controls) never count as canvas swipes, taps or tapDowns. */
export const CONTROLS_ATTR = "data-arcade-controls";

export interface InputProviderProps {
   children: ReactNode;
   /** element that receives swipes, taps, tapDowns and pointer moves (the canvas wrapper) */
   target?: RefObject<HTMLElement>;
   /** aim-drag mode (GameDefinition.input.drag): canvas drags fill `drag` and are never swipes */
   drag?: boolean;
}

export function InputProvider({ children, target, drag = false }: InputProviderProps) {
   const [controller] = useState(createInputController);
   useEffect(() => controller.setDragMode(drag), [controller, drag]);

   // keyboard, focus loss, phase changes
   useEffect(() => {
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) return;
         const handled = controller.keyDown(event.code, event.repeat);
         const phase = arcadeStore.getState().phase;
         // stop arrows/Space from scrolling or pressing a focused button while the game runs
         if (handled && (phase === "playing" || phase === "countdown")) event.preventDefault();
      };
      const onKeyUp = (event: KeyboardEvent) => controller.keyUp(event.code);
      const onBlur = () => controller.release();
      const onVisibility = () => {
         if (document.visibilityState === "hidden") controller.release();
      };
      const unsubscribe = arcadeStore.subscribe((state, prev) => {
         if (state.phase !== prev.phase) controller.clearEvents();
      });

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
         window.removeEventListener("keydown", onKeyDown);
         window.removeEventListener("keyup", onKeyUp);
         window.removeEventListener("blur", onBlur);
         document.removeEventListener("visibilitychange", onVisibility);
         unsubscribe();
         controller.release();
      };
   }, [controller]);

   // swipes, taps, tapDowns and pointer position on the canvas
   useEffect(() => {
      const element = target?.current;
      if (!element) return;

      // which pointer is the canvas pointer (multi-touch, touch controls) is decided by the pure
      // createCanvasPointers (tested in inputController.test.ts); this effect only wires the DOM
      const { down, move, up, cancel } = createCanvasPointers<PointerEvent>(controller, {
         toCanvas(event) {
            const rect = element.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
            const y = -(((event.clientY - rect.top) / (rect.height || 1)) * 2 - 1);
            return [clamp1(x), clamp1(y)];
         },
         onControls: (event) =>
            event.target instanceof Element && event.target.closest(`[${CONTROLS_ATTR}]`) !== null,
      });

      element.addEventListener("pointerdown", down);
      element.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      return () => {
         element.removeEventListener("pointerdown", down);
         element.removeEventListener("pointermove", move);
         window.removeEventListener("pointerup", up);
         window.removeEventListener("pointercancel", cancel);
         controller.pointerCancel();
      };
   }, [controller, target]);

   return <InputContext.Provider value={controller}>{children}</InputContext.Provider>;
}

/** Internal: the controller (TouchControls, InputLatch). Games use useInput(). */
export function useInputController(): InputController {
   const controller = useContext(InputContext);
   if (!controller) throw new Error("useInput must be used inside GameShell (InputProvider).");
   return controller;
}

/** The unified input ref. Read `.current` inside useRunFrame; it never triggers a re-render. */
export function useInput(): MutableRefObject<LiveInputState> {
   return useInputController().state;
}

/** Rendered once inside the Canvas by GameShell: publishes input before any game frame callback. */
export function InputLatch() {
   const controller = useInputController();
   // first in every frame (FRAME_PRIORITY.input): before the run clock, useRunFrame and visuals
   useFrame(() => controller.latch(), FRAME_PRIORITY.input);
   return null;
}
