"use client";

// Camera views (README.md), inside a game's Scene (in the Canvas), next to its existing CameraRig:
//
//    const cam = useCameraViews({
//       slug: "postman-3d", subject: "character", steering: "camera", defaultYaw: view.yaw,
//       target: (out) => { out.x = h.x; out.y = 1.1; out.z = h.z; out.heading = h.yaw; out.vx = h.vx; out.vz = h.vz; },
//    });
//    useRunFrame(() => step(run, { ...input, yaw: cam.yaw() }, dt));   // the drawn camera's yaw
//
// and <CameraViewButton /> in the game's Hud. The game's CameraRig keeps running untouched: in the
// "default" view nothing here writes the camera, and the rules get exactly `defaultYaw`, so a run in
// the default view is the run it was before. In the other views this hook writes the camera after
// the rig (FRAME_PRIORITY.camera + 0.005) and puts the rig's own pose back before the rig's next
// frame (camera - 0.005), so the rig never eases from a pose it did not write and a switch back to
// "default" lands exactly on it. Switches blend round the hero (views.ts blendPose) in 0.65 s.
//
// Input (only while the run can be turned: countdown, playing, the result delay): C / T or the 📷
// button cycle; a drag (mouse, one finger on empty canvas, or two fingers) or the turn keys switch to
// "free" from wherever the camera is and turn it; the wheel / pinch zoom the current view; V
// recenters the free view behind the hero. The joystick and buttons are other elements
// ([data-arcade-controls]), so they are never taken.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import type { AABB } from "../collision";
import { FRAME_PRIORITY } from "../frameLoop";
import { CONTROLS_ATTR } from "../input";
import { useSafeArea } from "../safeArea";
import { arcadeStore } from "../useArcadeStore";
import { setLensShift } from "../view";
import { createOrbit, orbitDirection, orbitRecenter, orbitSnap, orbitZoom, stepOrbit, wrapAngle, yawBehind, type OrbitState } from "./orbit";
import { clipOrbitDistance, stepOrbitClip, type ClipOptions } from "./orbitCollision";
import { applyOrbitInput, createGestureFrame, createOrbitGestures, type OrbitGestures, type OrbitKeys, type OrbitPointerKind } from "./orbitGestures";
import { cameraPrefs, cameraRecenterRequests, noteCameraTurned, publishViews, saveView, savedView, viewCycleRequests } from "./cameraPrefs";
import {
   VIEW_BLEND_S,
   VIEW_KEYS,
   blendEase,
   blendPose,
   cameraYawOf,
   copyPose,
   createPose,
   isViewKey,
   nextView,
   normalizeViews,
   poseFromCamera,
   startView,
   viewFraming,
   viewOrbitSettings,
   viewStartYaw,
   viewTravel,
   type ViewFraming,
   type ViewFramingOverrides,
   type ViewId,
   type ViewPose,
   type ViewSteering,
   type ViewSubject,
} from "./views";

/** After CameraRig (which writes at FRAME_PRIORITY.camera), before poses and visuals. */
export const CAMERA_VIEWS_PRIORITY = FRAME_PRIORITY.camera + 0.005;
/** Puts the rig's pose back, after the simulation and before CameraRig. */
export const CAMERA_VIEWS_RESTORE_PRIORITY = FRAME_PRIORITY.camera - 0.005;
/** The views' collision: a box right beside the hero never pulls the camera into its head. */
export const VIEW_COLLISION: ClipOptions = { radius: 0.3, minDistance: 2.2, ignoreNear: 1 };
/** Most boxes the collision considers per frame. */
export const VIEW_SOLIDS_MAX = 256;

export interface CameraViewsTarget {
   /** the pivot: the hero's chest / the vehicle's centre (world m) */
   x: number;
   y: number;
   z: number;
   /** the facing (rad): forward = (sin heading, cos heading) */
   heading: number;
   /** horizontal velocity (m/s, world) */
   vx: number;
   vz: number;
}

export interface CameraViewsOptions {
   /** the game's slug: the player's last view is remembered per game */
   slug: string;
   subject: ViewSubject;
   steering: ViewSteering;
   /** the views offered (default all five); "default" is always in, the order is VIEW_ORDER */
   views?: readonly ViewId[];
   framing?: ViewFramingOverrides;
   /** the fitted view's yaw (useFittedView `yaw`): what the rules get in the default view, the top view's yaw */
   defaultYaw: number;
   /** writes this frame's pivot and heading; return false to hold the last one */
   target: (out: CameraViewsTarget) => boolean | void;
   /** fills `out` with solid boxes that may block the view, returns how many; omitted = no camera collision */
   solids?: (out: AABB[]) => number;
   collision?: ClipOptions;
   /** pivot easing (1/s). Default 8 */
   pivotDamping?: number;
   /** one finger on empty canvas turns the free view (default true); false for games that read canvas swipes */
   oneFinger?: boolean;
   /** the cycle keys (default C and T); pass others when the game uses C or T */
   keys?: readonly string[];
   /** the free view's turn keys (default orbitGestures ORBIT_KEYS: Q/Z, X, R/F, V) */
   orbitKeys?: OrbitKeys;
}

export interface CameraViewsHandle {
   /** the drawn camera's yaw for inputToWorld (exactly `defaultYaw` while the default view is settled) */
   yaw(): number;
   /** the current view */
   view(): ViewId;
}

type OwnView = Exclude<ViewId, "default">;
const OWN: readonly OwnView[] = ["chase", "front", "top", "free"];

function turnable(): boolean {
   const phase = arcadeStore.getState().phase;
   return phase === "playing" || phase === "countdown" || phase === "over";
}

function isEditable(target: EventTarget | null): boolean {
   if (!(target instanceof HTMLElement)) return false;
   const tag = target.tagName;
   return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** The DOM side: canvas pointers (pointer capture), the wheel, the context menu, the keys. */
function useViewInput(element: HTMLElement, gestures: OrbitGestures, keys: readonly string[], cycle: { pending: number }): void {
   const keyList = keys.join(",");
   useEffect(() => {
      const cycleKeys = keyList.split(",");
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
      const onWheel = (e: WheelEvent) => {
         if (!turnable()) return;
         e.preventDefault();
         const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
         gestures.wheel(e.deltaY * scale);
      };
      const onContext = (e: Event) => e.preventDefault();
      const onKey = (down: boolean) => (e: KeyboardEvent) => {
         if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return;
         if (isViewKey(e.code, cycleKeys)) {
            if (down && !e.repeat && turnable()) {
               cycle.pending++;
               e.preventDefault();
            }
            return;
         }
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
      element.addEventListener("lostpointercapture", onUp);
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
         element.removeEventListener("lostpointercapture", onUp);
         element.removeEventListener("wheel", onWheel);
         element.removeEventListener("contextmenu", onContext);
         window.removeEventListener("keydown", onKeyDown);
         window.removeEventListener("keyup", onKeyUp);
         window.removeEventListener("blur", onBlur);
         onBlur();
      };
   }, [element, gestures, keyList, cycle]);
}

export function useCameraViews(options: CameraViewsOptions): CameraViewsHandle {
   const { slug, subject, steering, framing: overrides, oneFinger = true, keys = VIEW_KEYS, orbitKeys } = options;
   const opts = useRef(options);
   opts.current = options;
   const camera = useThree((s) => s.camera) as PerspectiveCamera;
   const element = useThree((s) => s.gl.domElement);
   const viewKey = (options.views ?? []).join(",");
   const list = useMemo(() => normalizeViews(viewKey ? (viewKey.split(",") as ViewId[]) : undefined), [viewKey]);

   const framings = useMemo(() => {
      const out = {} as Record<OwnView, ViewFraming>;
      for (const v of OWN) out[v] = viewFraming(subject, v, overrides);
      return out;
      // the overrides are a literal in most games: compare by value
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [subject, JSON.stringify(overrides ?? {})]);
   const orbits = useMemo(() => {
      const out = {} as Record<OwnView, OrbitState>;
      for (const v of OWN) out[v] = createOrbit({ yaw: 0, ...viewOrbitSettings(v, subject, steering, framings[v]) });
      return out;
   }, [subject, steering, framings]);

   const gestures = useMemo(() => createOrbitGestures({ oneFinger, keys: orbitKeys }), [oneFinger, orbitKeys]);
   const cycle = useMemo(() => ({ pending: 0 }), []);
   useViewInput(element, gestures, keys, cycle);

   const s = useMemo(
      () => ({
         view: startView(list, savedView(slug)) as ViewId,
         blendT: 1,
         from: createPose(),
         target: createPose(),
         drawn: createPose(),
         rig: createPose(),
         hero: { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0 } as CameraViewsTarget,
         pivot: { x: 0, y: 0, z: 0 },
         placed: false,
         started: false,
         wrote: false,
         clip: Number.NaN,
         yaw: options.defaultYaw,
         rigPos: new Vector3(),
         rigQuat: new Quaternion(),
         /** the rig's lens (view offset), put back with its pose */
         rigLens: { on: false, fw: 1, fh: 1, ox: 0, oy: 0, w: 1, h: 1 },
         fwd: new Vector3(),
         dir: { x: 0, y: 0, z: 0 },
         travel: { x: 0, z: 0 },
         frame: createGestureFrame(),
         handledCycle: viewCycleRequests(),
         handledRecenter: cameraRecenterRequests(),
         boxes: [] as AABB[],
      }),
      // one state per mount (a run): the list and slug are fixed for it
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
   );

   const cover = useSafeArea((a) => {
      let c = 0;
      for (const r of a.obstructions) c = Math.max(c, a.height - r.top);
      return Math.round(Math.max(0, Math.min(a.height * 0.5, c)));
   });
   const coverRef = useRef(cover);
   coverRef.current = cover;

   // the 📷 button and the hint read the live list and view
   useEffect(() => {
      publishViews({ list, current: s.view, key: keys[0]?.replace(/^Key/, "") ?? "C", oneFinger });
   });
   useEffect(() => () => publishViews(null), []);

   /** Enters `view` this frame: the blend starts from the drawn pose, the view's orbit from its start pose. */
   const enter = (view: ViewId, blend: boolean) => {
      const o = opts.current;
      if (view !== "default") {
         const orbit = orbits[view];
         if (view === "free") {
            // from wherever the camera is (the zoom range grows to hold a far fitted camera)
            orbit.settings.maxDistance = Math.max(orbit.settings.maxDistance, s.drawn.distance);
            orbitSnap(orbit, s.drawn.yaw, s.drawn.pitch, s.drawn.distance);
         }
         else orbitSnap(orbit, viewStartYaw(view, s.hero.heading, o.defaultYaw), framings[view].pitch, orbit.distance);
      }
      copyPose(s.drawn, s.from);
      s.blendT = blend ? 0 : 1;
      s.clip = Number.NaN;
      if (s.view !== view) {
         s.view = view;
         saveView(slug, view);
         publishViews({ list, current: view, key: keys[0]?.replace(/^Key/, "") ?? "C", oneFinger });
      }
   };

   // the rig's pose back before the rig runs, so it eases from its own last pose
   const restore = () => {
      if (!s.wrote) return;
      camera.position.copy(s.rigPos);
      camera.quaternion.copy(s.rigQuat);
      const lens = s.rigLens;
      if (lens.on) camera.setViewOffset(lens.fw, lens.fh, lens.ox, lens.oy, lens.w, lens.h);
      else camera.clearViewOffset();
      s.wrote = false;
   };
   useFrame(restore, CAMERA_VIEWS_RESTORE_PRIORITY);
   // a remount (Retry) or an exit hands the camera back as the rig left it
   // eslint-disable-next-line react-hooks/exhaustive-deps
   useEffect(() => () => restore(), []);

   useFrame((state, delta) => {
      const o = opts.current;
      const dt = Math.min(0.1, Math.max(0, delta));
      const w = state.size.width;
      const h = state.size.height;

      // the hero and the eased pivot
      const fresh = o.target(s.hero) !== false;
      if (!s.placed) {
         s.pivot.x = s.hero.x;
         s.pivot.y = s.hero.y;
         s.pivot.z = s.hero.z;
         s.placed = true;
      } else if (fresh) {
         const k = 1 - Math.exp(-(o.pivotDamping ?? 8) * dt);
         s.pivot.x += (s.hero.x - s.pivot.x) * k;
         s.pivot.y += (s.hero.y - s.pivot.y) * k;
         s.pivot.z += (s.hero.z - s.pivot.z) * k;
      }
      const p = s.pivot;

      // the rig's pose this frame (CameraRig has just written it)
      s.rigPos.copy(camera.position);
      s.rigQuat.copy(camera.quaternion);
      camera.getWorldDirection(s.fwd);
      poseFromCamera(p.x, p.y, p.z, camera.position.x, camera.position.y, camera.position.z, s.fwd.x, s.fwd.y, s.fwd.z, s.rig);
      const v = camera.view;
      const lens = s.rigLens;
      lens.on = !!v && v.enabled;
      if (v && lens.on) {
         lens.fw = v.fullWidth;
         lens.fh = v.fullHeight;
         lens.ox = v.offsetX;
         lens.oy = v.offsetY;
         lens.w = v.width;
         lens.h = v.height;
      }
      s.rig.shiftX = v && v.enabled && v.fullWidth > 0 ? (-2 * v.offsetX) / v.fullWidth : 0;
      s.rig.shiftY = v && v.enabled && v.fullHeight > 0 ? (2 * v.offsetY) / v.fullHeight : 0;

      if (!s.started) {
         // the first frame: the saved view at once, no blend
         copyPose(s.rig, s.drawn);
         s.started = true;
         if (s.view !== "default") enter(s.view, false);
      }

      // input
      gestures.consume(s.frame);
      const f = s.frame;
      const live = turnable();
      if (!live) {
         f.dragX = f.dragY = f.wheel = f.keyYaw = f.keyPitch = 0;
         f.zoom = 1;
         f.recenter = false;
         cycle.pending = 0;
         s.handledCycle = viewCycleRequests();
      }
      const requests = viewCycleRequests();
      if (cycle.pending > 0 || requests !== s.handledCycle) {
         const n = cycle.pending + (requests - s.handledCycle);
         cycle.pending = 0;
         s.handledCycle = requests;
         let next = s.view;
         for (let i = 0; i < n % Math.max(1, list.length); i++) next = nextView(list, next);
         if (next !== s.view) {
            enter(next, true);
            noteCameraTurned();
         }
      }
      const turning = f.dragX !== 0 || f.dragY !== 0 || f.keyYaw !== 0 || f.keyPitch !== 0;
      if (turning && s.view !== "free" && list.includes("free")) enter("free", true);
      if (s.view === "free") {
         if (applyOrbitInput(orbits.free, f, dt) && orbits.free.manualTurns > 0) noteCameraTurned();
      } else if (s.view !== "default") {
         const zoom = f.zoom * Math.exp(f.wheel * orbits[s.view].settings.wheelZoomPerPx);
         if (zoom !== 1) orbitZoom(orbits[s.view], zoom);
      }
      const recenters = cameraRecenterRequests();
      if (f.recenter || recenters !== s.handledRecenter) {
         s.handledRecenter = recenters;
         if (s.view === "free") orbitRecenter(orbits.free, yawBehind(Math.sin(s.hero.heading), Math.cos(s.hero.heading)));
      }

      // the target pose
      if (s.view === "default") copyPose(s.rig, s.target);
      else {
         const orbit = orbits[s.view];
         viewTravel(s.view, o.steering, s.hero.heading, s.hero.vx, s.hero.vz, s.travel);
         const auto = orbit.settings.autoFollow && (s.view !== "free" || cameraPrefs().autoFollow);
         if (s.view === "top") orbit.yaw = wrapAngle(o.defaultYaw);
         stepOrbit(orbit, dt, s.travel.x, s.travel.z, auto);
         const t = s.target;
         t.yaw = orbit.viewYaw;
         t.pitch = orbit.viewPitch;
         t.distance = orbit.viewDistance;
         t.lookX = 0;
         t.lookY = framings[s.view].lookUp;
         t.lookZ = 0;
         t.shiftX = 0;
         t.shiftY = coverRef.current / Math.max(1, h);
      }
      if (s.blendT < 1) {
         s.blendT = Math.min(1, s.blendT + dt / VIEW_BLEND_S);
         blendPose(s.from, s.target, blendEase(s.blendT), s.drawn);
      } else copyPose(s.target, s.drawn);

      // the default view, settled: the rig owns the camera, the rules get the fitted yaw
      if (s.view === "default" && s.blendT >= 1) {
         s.yaw = o.defaultYaw;
         s.clip = Number.NaN;
         return;
      }

      // collision: a solid between the pivot and the camera pulls it in (not in the default view, nor
      // in the top view, which looks down past every wall)
      orbitDirection(s.drawn.yaw, s.drawn.pitch, s.dir);
      let d = s.drawn.distance;
      if (o.solids && s.view !== "default" && s.view !== "top") {
         if (s.boxes.length === 0) for (let i = 0; i < VIEW_SOLIDS_MAX; i++) s.boxes.push({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } });
         const n = Math.min(VIEW_SOLIDS_MAX, o.solids(s.boxes));
         const clipped = clipOrbitDistance(p.x, p.y, p.z, s.dir.x, s.dir.y, s.dir.z, d, s.boxes, n, o.collision ?? VIEW_COLLISION);
         s.clip = Number.isFinite(s.clip) ? stepOrbitClip(s.clip, clipped, dt) : clipped;
         d = Math.min(d, s.clip);
      }
      camera.position.set(p.x + s.dir.x * d, p.y + s.dir.y * d, p.z + s.dir.z * d);
      const lx = p.x + s.drawn.lookX;
      const ly = p.y + s.drawn.lookY;
      const lz = p.z + s.drawn.lookZ;
      camera.lookAt(lx, ly, lz);
      setLensShift(camera, s.drawn.shiftX, s.drawn.shiftY, w, h);
      s.wrote = true;
      s.yaw = cameraYawOf(camera.position.x, camera.position.z, lx, lz, o.defaultYaw);
   }, CAMERA_VIEWS_PRIORITY);

   return useMemo<CameraViewsHandle>(() => ({ yaw: () => s.yaw, view: () => s.view }), [s]);
}
