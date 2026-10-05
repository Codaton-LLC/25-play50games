"use client";

// Unified input for 3D Arcade games. Owned by Claude.
// Keyboard (WASD/arrows move, Space jump, E/Enter action), the touch joystick and buttons,
// swipes and taps on the canvas all feed ONE InputState ref. Games read it inside useRunFrame:
//
//    const input = useInput();
//    useRunFrame((_, dt) => { robot.position.x += input.current.moveX * SPEED * dt; });
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
import type { InputState } from "./types";
import { arcadeStore } from "./useArcadeStore";
import { createInputController, type InputController } from "./inputController";

export {
   createInputController,
   SWIPE_MAX_MS,
   SWIPE_MIN_PX,
   TAP_MAX_MS,
   TAP_MAX_PX,
   type InputController,
   type TouchButton,
} from "./inputController";

const InputContext = createContext<InputController | null>(null);

const clamp1 = (v: number) => (v > 1 ? 1 : v < -1 ? -1 : v);

function isEditable(target: EventTarget | null): boolean {
   if (!(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Elements inside this attribute (the touch controls) never count as canvas swipes or taps. */
export const CONTROLS_ATTR = "data-arcade-controls";

export interface InputProviderProps {
   children: ReactNode;
   /** element that receives swipes, taps and pointer moves (the canvas wrapper) */
   target?: RefObject<HTMLElement>;
}

export function InputProvider({ children, target }: InputProviderProps) {
   const [controller] = useState(createInputController);

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

   // swipes, taps and pointer position on the canvas
   useEffect(() => {
      const element = target?.current;
      if (!element) return;
      let activePointer: number | null = null;

      const normalise = (event: PointerEvent): [number, number] => {
         const rect = element.getBoundingClientRect();
         const x = ((event.clientX - rect.left) / (rect.width || 1)) * 2 - 1;
         const y = -(((event.clientY - rect.top) / (rect.height || 1)) * 2 - 1);
         return [clamp1(x), clamp1(y)];
      };
      const fromControls = (event: PointerEvent) =>
         event.target instanceof Element && event.target.closest(`[${CONTROLS_ATTR}]`) !== null;

      const onDown = (event: PointerEvent) => {
         if (activePointer !== null || fromControls(event)) return;
         if (event.pointerType === "mouse" && event.button !== 0) return;
         activePointer = event.pointerId;
         const [x, y] = normalise(event);
         controller.pointerDown(x, y, event.clientX, event.clientY, event.timeStamp);
      };
      const onMove = (event: PointerEvent) => {
         if (fromControls(event)) return;
         if (activePointer !== null && event.pointerId !== activePointer) return;
         const [x, y] = normalise(event);
         controller.pointerMove(x, y);
      };
      const onUp = (event: PointerEvent) => {
         if (event.pointerId !== activePointer) return;
         activePointer = null;
         controller.pointerUp(event.clientX, event.clientY, event.timeStamp);
      };
      const onCancel = (event: PointerEvent) => {
         if (event.pointerId !== activePointer) return;
         activePointer = null;
         controller.pointerCancel();
      };

      element.addEventListener("pointerdown", onDown);
      element.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      return () => {
         element.removeEventListener("pointerdown", onDown);
         element.removeEventListener("pointermove", onMove);
         window.removeEventListener("pointerup", onUp);
         window.removeEventListener("pointercancel", onCancel);
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
export function useInput(): MutableRefObject<InputState> {
   return useInputController().state;
}

/** Rendered once inside the Canvas by GameShell: publishes input before any game frame callback. */
export function InputLatch() {
   const controller = useInputController();
   // negative priority: runs before the default (0) useFrame/useRunFrame callbacks
   useFrame(() => controller.latch(), -2);
   return null;
}
