"use client";

// The Menu 2 free orbit camera (README.md). Inside a game's Scene (in the Canvas):
//
//    const orbit = useMemo(() => createOrbit(MY_ORBIT), [run]);       // one per run; the rules read orbit.viewYaw
//    <OrbitCamera orbit={orbit} pivot={(out) => { out.x = h.x; out.y = h.y + 1.1; out.z = h.z; }}
//       travel={(out) => { out.x = h.vx; out.z = h.vz; }} solids={fillBoxes} />
//
// Two parts, usable on their own:
// - <OrbitDriver> / useOrbitDriver: the input (canvas pointers, the wheel, the camera keys, the HUD's
//   recenter button) and the orbit's step (smoothing, auto-follow), at FRAME_PRIORITY.camera - 0.01.
//   A multiplayer SharedCamera uses it with its own framing.
// - <OrbitCamera>: the driver plus the pose: the camera sits at the eased pivot + the orbit offset,
//   pulled in when a solid box blocks the view (orbitCollision.ts), and looks at the pivot (+ lookUp).
//   It writes at FRAME_PRIORITY.camera, so the juice kick / shake (menu2/juice) and core FxLayer's shake
//   still go on top, and the core intro (camera + 0.02) still owns the camera while it runs.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import type { AABB, Vec3Like } from "@/arcade3d/core/collision";
import { FRAME_PRIORITY } from "@/arcade3d/core/frameLoop";
import { CONTROLS_ATTR } from "@/arcade3d/core/input";
import { useSafeArea } from "@/arcade3d/core/safeArea";
import { arcadeStore } from "@/arcade3d/core/useArcadeStore";
import { clearLensShift, stepLensShift, type LensState } from "@/arcade3d/core/view";
import { orbitDirection, orbitRecenter, stepOrbit, yawBehind, type OrbitState } from "./orbit";
import { applyOrbitInput, createGestureFrame, createOrbitGestures, type OrbitGestureOptions, type OrbitGestures, type OrbitPointerKind } from "./orbitGestures";
import { clipOrbitDistance, liftOrbitPitch, stepOrbitClip, type ClipOptions } from "./orbitCollision";
import { noteOrbitTurned, orbitPrefs, orbitRecenterRequests } from "./orbitPrefs";

/** The driver runs just before the camera writers (after the simulation, before CameraRig / SharedCamera). */
export const ORBIT_DRIVER_PRIORITY = FRAME_PRIORITY.camera - 0.01;

/** Phases in which the player may turn the camera (not on the start card or the intro, not paused). */
function turnable(): boolean {
   const phase = arcadeStore.getState().phase;
   return phase === "playing" || phase === "countdown" || phase === "over";
}

function isEditable(target: EventTarget | null): boolean {
   if (!(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Wires the DOM to a gesture router: pointers that start ON THE CANVAS (never the joystick or the
 * buttons, which are other elements), with pointer capture so a drag that leaves the canvas keeps
 * turning; the wheel (no page scroll); the context menu off for the right-button drag; camera keys
 * on the window. Off while the run cannot be turned (start card, intro, pause).
 */
export function useOrbitInput(gestures: OrbitGestures, enabled = true): void {
   const element = useThree((s) => s.gl.domElement);
   useEffect(() => {
      if (!enabled) return;
      const kind = (e: PointerEvent): OrbitPointerKind => (e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "pen" : "mouse");
      const onDown = (e: PointerEvent) => {
         if (!turnable()) return;
         if (e.target instanceof Element && e.target.closest(`[${CONTROLS_ATTR}]`)) return;
         if (gestures.down(e.pointerId, e.clientX, e.clientY, kind(e), e.button)) {
            try {
               element.setPointerCapture(e.pointerId);
            } catch {
               // a pointer that is already gone
            }
         }
      };
      const onMove = (e: PointerEvent) => gestures.move(e.pointerId, e.clientX, e.clientY);
      const onUp = (e: PointerEvent) => {
         gestures.up(e.pointerId);
         try {
            if (element.hasPointerCapture(e.pointerId)) element.releasePointerCapture(e.pointerId);
         } catch {
            // already released
         }
      };
      // A capture can be lost while the button is still down (seen in Chrome right after the press,
      // now and then): that is not the end of the drag, the moves keep coming to the canvas. Only a
      // lost capture with nothing pressed ends it; the window's pointerup ends a drag whose release
      // lands on the HUD instead of the canvas.
      const onLost = (e: PointerEvent) => {
         if (e.buttons === 0) onUp(e);
      };
      const onWheel = (e: WheelEvent) => {
         if (!turnable()) return;
         e.preventDefault();
         const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
         gestures.wheel(e.deltaY * scale);
      };
      const onContext = (e: Event) => e.preventDefault();
      const onKey = (down: boolean) => (e: KeyboardEvent) => {
         if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
         if (down && !turnable()) return;
         if (gestures.key(e.code, down) && down && turnable()) e.preventDefault();
      };
      const onKeyDown = onKey(true);
      const onKeyUp = onKey(false);
      const onBlur = () => {
         gestures.cancel();
         gestures.releaseKeys();
      };
      element.addEventListener("pointerdown", onDown);
      element.addEventListener("pointermove", onMove);
      element.addEventListener("pointerup", onUp);
      element.addEventListener("pointercancel", onUp);
      element.addEventListener("lostpointercapture", onLost);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      element.addEventListener("wheel", onWheel, { passive: false });
      element.addEventListener("contextmenu", onContext);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onBlur);
      return () => {
         element.removeEventListener("pointerdown", onDown);
         element.removeEventListener("pointermove", onMove);
         element.removeEventListener("pointerup", onUp);
         element.removeEventListener("pointercancel", onUp);
         element.removeEventListener("lostpointercapture", onLost);
         window.removeEventListener("pointerup", onUp);
         window.removeEventListener("pointercancel", onUp);
         element.removeEventListener("wheel", onWheel);
         element.removeEventListener("contextmenu", onContext);
         window.removeEventListener("keydown", onKeyDown);
         window.removeEventListener("keyup", onKeyUp);
         window.removeEventListener("blur", onBlur);
         onBlur();
      };
   }, [element, gestures, enabled]);
}

export interface OrbitDriverProps {
   orbit: OrbitState;
   /** the hero's horizontal velocity (m/s) for the auto-follow; omitted = no auto-follow */
   travel?: (out: { x: number; z: number }) => void;
   /** the camera yaw "behind the hero" for a recenter; default behind the last travel direction, else the start yaw */
   behind?: () => number | null;
   /** gesture options (`oneFinger: false` for games that read canvas swipes); false = no input at all */
   input?: OrbitGestureOptions | false;
}

/** The orbit's input and step, once per frame at ORBIT_DRIVER_PRIORITY. */
export function useOrbitDriver({ orbit, travel, behind, input }: OrbitDriverProps): void {
   const off = input === false;
   const oneFinger = input ? input.oneFinger ?? true : true;
   const buttons = input && input.mouseButtons ? input.mouseButtons.join(",") : "0,2";
   const gestures = useMemo(
      () => createOrbitGestures({ oneFinger, mouseButtons: buttons.split(",").map(Number) }),
      [oneFinger, buttons],
   );
   useOrbitInput(gestures, !off);
   const frame = useMemo(createGestureFrame, []);
   const vel = useMemo(() => ({ x: 0, z: 0 }), []);
   const lastHeading = useRef<number | null>(null);
   const handled = useRef(orbitRecenterRequests());
   useFrame((_s, delta) => {
      const dt = Math.min(0.1, delta);
      gestures.consume(frame);
      if (!turnable()) {
         // the start card, the intro or a pause: nothing piles up for later
         frame.dragX = frame.dragY = frame.wheel = frame.keyYaw = frame.keyPitch = 0;
         frame.zoom = 1;
         frame.recenter = false;
      }
      if (applyOrbitInput(orbit, frame, dt) && orbit.manualTurns > 0) noteOrbitTurned();
      vel.x = 0;
      vel.z = 0;
      travel?.(vel);
      if (Math.hypot(vel.x, vel.z) > 1) lastHeading.current = yawBehind(vel.x, vel.z);
      const requests = orbitRecenterRequests();
      if (frame.recenter || requests !== handled.current) {
         handled.current = requests;
         const yaw = behind?.() ?? lastHeading.current ?? orbit.settings.yaw;
         orbitRecenter(orbit, yaw);
      }
      const auto = !!travel && orbit.settings.autoFollow && orbitPrefs().autoFollow;
      stepOrbit(orbit, dt, vel.x, vel.z, auto);
   }, ORBIT_DRIVER_PRIORITY);
}

/** The driver as a component (a multiplayer scene with SharedCamera orbit mode). */
export function OrbitDriver(props: OrbitDriverProps) {
   useOrbitDriver(props);
   return null;
}

export interface OrbitCameraProps extends OrbitDriverProps {
   /**
    * Writes this frame's pivot (the follow point: the hero's chest plus any lead towards where it is
    * going). Return false to hold the last one (e.g. while the hero falls out of view).
    */
   pivot: (out: Vec3Like) => boolean | void;
   /** the camera looks this far (m) above the pivot. Default 0 */
   lookUp?: number;
   /** the drawn distance is orbit.viewDistance x this (e.g. farther on a portrait phone). Default 1 */
   distanceScale?: number;
   /** the pivot stays inside these bounds (followFocus-style) */
   bounds?: AABB;
   /** pivot easing rate (1/s). Default 6 */
   pivotDamping?: number;
   /** fills `out` with the solid boxes that may block the view and returns how many; omitted = no collision */
   solids?: (out: AABB[]) => number;
   /** camera radius and the closest it may come (orbitCollision.ts) */
   collision?: ClipOptions;
   /** lift the picture above the cookie banner / home indicator with a lens shift (default true) */
   bottomCover?: boolean;
}

/** Most boxes the collision considers per frame. */
export const ORBIT_SOLIDS_MAX = 256;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function OrbitCamera({ orbit, travel, behind, input, pivot, lookUp = 0, distanceScale = 1, bounds, pivotDamping = 6, solids, collision, bottomCover = true }: OrbitCameraProps) {
   useOrbitDriver({ orbit, travel, behind, input });
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const raw = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const at = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const dir = useMemo(() => ({ x: 0, y: 0, z: 0 }), []);
   const boxes = useMemo<AABB[]>(
      () => Array.from({ length: ORBIT_SOLIDS_MAX }, () => ({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } })),
      [],
   );
   const placed = useRef(false);
   const drawn = useRef(Number.NaN);
   // the extra pitch (radians) a blocked view rises by (collision.liftTo), eased
   const lift = useRef(0);
   const cover = useSafeArea((a) => {
      let c = 0;
      for (const r of a.obstructions) c = Math.max(c, a.height - r.top);
      return Math.round(Math.max(0, Math.min(a.height * 0.5, c)));
   });
   const lens = useMemo<LensState>(() => ({ x: 0, y: 0, set: false }), []);
   useLayoutEffect(() => () => clearLensShift(camera, lens), [camera, lens]);

   useFrame((state, delta) => {
      const dt = Math.min(0.1, delta);
      if (bottomCover) stepLensShift(camera, lens, 0, cover / Math.max(1, state.size.height), state.size.width, state.size.height, 1 - Math.exp(-6 * dt));
      const fresh = pivot(raw) !== false;
      if (bounds) {
         raw.x = clamp(raw.x, bounds.min.x, bounds.max.x);
         raw.y = clamp(raw.y, bounds.min.y, bounds.max.y);
         raw.z = clamp(raw.z, bounds.min.z, bounds.max.z);
      }
      if (!placed.current) {
         at.x = raw.x;
         at.y = raw.y;
         at.z = raw.z;
      } else if (fresh) {
         const k = 1 - Math.exp(-pivotDamping * dt);
         at.x += (raw.x - at.x) * k;
         at.y += (raw.y - at.y) * k;
         at.z += (raw.z - at.z) * k;
      }
      const want = orbit.viewDistance * distanceScale;
      let target = want;
      let pitch = orbit.viewPitch;
      const n = solids ? Math.min(ORBIT_SOLIDS_MAX, solids(boxes)) : 0;
      if (solids && collision?.liftTo !== undefined) {
         // a wall right behind the camera: rise to look over it (up quickly, back down slowly)
         const goal = liftOrbitPitch(at.x, at.y, at.z, orbit.viewYaw, orbit.viewPitch, want, boxes, n, collision) - orbit.viewPitch;
         const rate = goal > lift.current ? 8 : 2;
         lift.current = placed.current ? lift.current + (goal - lift.current) * (1 - Math.exp(-rate * dt)) : goal;
         pitch = orbit.viewPitch + lift.current;
      }
      orbitDirection(orbit.viewYaw, pitch, dir);
      if (solids) target = clipOrbitDistance(at.x, at.y, at.z, dir.x, dir.y, dir.z, want, boxes, n, collision);
      drawn.current = placed.current ? stepOrbitClip(drawn.current, target, dt) : target;
      placed.current = true;
      const d = drawn.current;
      camera.position.set(at.x + dir.x * d, at.y + dir.y * d, at.z + dir.z * d);
      camera.lookAt(at.x, at.y + lookUp, at.z);
   }, FRAME_PRIORITY.camera);
   return null;
}
