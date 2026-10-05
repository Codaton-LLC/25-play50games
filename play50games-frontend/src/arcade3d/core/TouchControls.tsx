"use client";

// On-screen controls for phones and tablets: a virtual joystick plus Jump / Action buttons,
// rendered per GameDefinition.touchControls. Only on coarse pointers (JS check + CSS media query).
// "swipe" and "tap" need no buttons: InputProvider reads them from the canvas.
import {
   useEffect,
   useRef,
   useState,
   useSyncExternalStore,
   type PointerEvent as ReactPointerEvent,
   type RefObject,
} from "react";
import type { TouchControl } from "./types";
import { CONTROLS_ATTR, useInputController, type TouchButton } from "./input";
import { SAFE_AREA_ATTR } from "./safeArea";
import styles from "./TouchControls.module.css";

const COARSE_QUERY = "(pointer: coarse)";

function subscribeCoarse(onChange: () => void): () => void {
   if (typeof window === "undefined" || !window.matchMedia) return () => {};
   const query = window.matchMedia(COARSE_QUERY);
   query.addEventListener?.("change", onChange);
   return () => query.removeEventListener?.("change", onChange);
}

function readCoarse(): boolean {
   return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(COARSE_QUERY).matches;
}

/** true on touch-first devices (phones, tablets); false on desktop and during SSR. */
export function useCoarsePointer(): boolean {
   return useSyncExternalStore(subscribeCoarse, readCoarse, () => false);
}

/**
 * Height (px) of anything fixed to the bottom of the viewport above the game, i.e. the
 * cookie banner (PrivacyConsent) while it is open. GameShell exposes it as the CSS variable
 * --arcade-bottom-obstruction so the touch controls and overlays stay above the banner.
 */
export function useBottomObstruction(): number {
   const [height, setHeight] = useState(0);
   useEffect(() => {
      const measure = () => {
         let found = 0;
         const link = document.querySelector('a[href="/privacy-policy"]');
         for (let el = link?.parentElement ?? null; el && el !== document.body; el = el.parentElement) {
            if (getComputedStyle(el).position === "fixed") {
               const rect = el.getBoundingClientRect();
               found = Math.max(0, Math.round(window.innerHeight - rect.top));
               break;
            }
         }
         setHeight((prev) => (prev === found ? prev : found));
      };
      measure();
      const timer = window.setInterval(measure, 1000);
      window.addEventListener("resize", measure);
      return () => {
         window.clearInterval(timer);
         window.removeEventListener("resize", measure);
      };
   }, []);
   return height;
}

/** Max knob travel from the centre, in px. */
const JOY_RADIUS = 46;
const DEAD_ZONE = 0.12;

function Joystick() {
   const controller = useInputController();
   const baseRef = useRef<HTMLDivElement>(null);
   const knobRef = useRef<HTMLDivElement>(null);
   const pointerId = useRef<number | null>(null);

   const update = (event: ReactPointerEvent<HTMLDivElement>) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > JOY_RADIUS) {
         dx = (dx / dist) * JOY_RADIUS;
         dy = (dy / dist) * JOY_RADIUS;
      }
      let x = dx / JOY_RADIUS;
      let y = dy / JOY_RADIUS;
      if (Math.hypot(x, y) < DEAD_ZONE) {
         x = 0;
         y = 0;
      }
      controller.setJoystick(x, y);
      if (knobRef.current) knobRef.current.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
   };

   const release = () => {
      pointerId.current = null;
      controller.setJoystick(0, 0);
      if (knobRef.current) knobRef.current.style.transform = "translate3d(0, 0, 0)";
   };

   useEffect(() => () => controller.setJoystick(0, 0), [controller]);

   return (
      <div
         ref={baseRef}
         className={styles.joystick}
         role="presentation"
         aria-hidden="true"
         onPointerDown={(event) => {
            if (pointerId.current !== null) return;
            pointerId.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            update(event);
         }}
         onPointerMove={(event) => {
            if (event.pointerId === pointerId.current) update(event);
         }}
         onPointerUp={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
         onPointerCancel={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
         onLostPointerCapture={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
      >
         <div ref={knobRef} className={styles.knob} />
      </div>
   );
}

function HoldButton({ button, label }: { button: TouchButton; label: string }) {
   const controller = useInputController();
   const [down, setDown] = useState(false);
   const pointerId = useRef<number | null>(null);

   const release = () => {
      pointerId.current = null;
      setDown(false);
      controller.setButton(button, false);
   };

   useEffect(() => () => controller.setButton(button, false), [controller, button]);

   return (
      <button
         type="button"
         className={`${styles.button} ${down ? styles.buttonDown : ""}`}
         aria-label={label}
         onPointerDown={(event) => {
            if (pointerId.current !== null) return;
            pointerId.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDown(true);
            controller.setButton(button, true);
         }}
         onPointerUp={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
         onPointerCancel={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
         onLostPointerCapture={(event) => {
            if (event.pointerId === pointerId.current) release();
         }}
         onContextMenu={(event) => event.preventDefault()}
      >
         {label}
      </button>
   );
}

export interface TouchControlsProps {
   controls: TouchControl[];
}

/**
 * An invisible copy of the controls' layout (same CSS, no handlers), always mounted so GameShell
 * can measure where the controls sit (core/safeArea.tsx) before and between runs, when the real
 * controls are not rendered. Hidden elements are never hit-tested, so it never takes input.
 */
export function TouchControlsProbe({ controls, probeRef }: TouchControlsProps & { probeRef: RefObject<HTMLDivElement> }) {
   const joystick = controls.includes("joystick");
   const jump = controls.includes("jump");
   const action = controls.includes("action");
   const mark = { [SAFE_AREA_ATTR]: "" };
   return (
      <div ref={probeRef} className={styles.controls} style={{ visibility: "hidden" }} aria-hidden="true">
         {joystick && <div className={styles.joystick} {...mark} />}
         {(jump || action) && (
            <div className={styles.buttons} {...mark}>
               {action && <span className={styles.button} />}
               {jump && <span className={styles.button} />}
            </div>
         )}
      </div>
   );
}

export default function TouchControls({ controls }: TouchControlsProps) {
   const coarse = useCoarsePointer();
   const joystick = controls.includes("joystick");
   const jump = controls.includes("jump");
   const action = controls.includes("action");

   if (!coarse || (!joystick && !jump && !action)) return null;

   return (
      <div className={styles.controls} {...{ [CONTROLS_ATTR]: "" }}>
         {joystick && <Joystick />}
         {(jump || action) && (
            <div className={styles.buttons}>
               {action && <HoldButton button="action" label="Action" />}
               {jump && <HoldButton button="jump" label="Jump" />}
            </div>
         )}
      </div>
   );
}
