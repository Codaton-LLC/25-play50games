// Camera views (README.md): the pure part. A game declares which views it offers and how each is
// framed; the player cycles them with the 📷 button or C (T too). No three.js, React or DOM, no
// allocation per step.
//
// - "default": the game's own fitted camera (its CameraRig), exactly as before.
// - "chase":   behind the hero / vehicle.
// - "front":   in front of it, looking back.
// - "top":     high, almost top-down, at the default view's yaw (screen-relative input unchanged).
// - "free":    the free orbit (orbit.ts): drag, two fingers, pinch, wheel, keys.
//
// A pose is relative to the pivot (the hero's chest): the camera sits at
// pivot + orbitDirection(yaw, pitch) * distance and looks at pivot + look; `shiftX/Y` is the lens
// shift (view.ts setLensShift). Blending two poses goes round the pivot (yaw the short way, pitch,
// distance), so a chase -> front switch swings round the hero instead of through it.
//
// Fairness: views only move the camera. The rules get the drawn camera yaw in their per-frame input
// (core inputToWorld), like the fitted yaw before, so "up" is still "away from the camera"; bots and
// proofs pass their own yaw and are unchanged.
import { wrapAngle, type OrbitSettings } from "./orbit";

export type ViewId = "default" | "chase" | "front" | "top" | "free";

/** The cycle order of every view list (a game's list is kept in this order). */
export const VIEW_ORDER: readonly ViewId[] = ["default", "chase", "front", "top", "free"];

export const VIEW_LABELS: Record<ViewId, string> = {
   default: "Classic view",
   chase: "Chase view",
   front: "Front view",
   top: "Top view",
   free: "Free view",
};

/** The keys that cycle the views (KeyboardEvent.code). T is the same switch (the old habit). */
export const VIEW_KEYS: readonly string[] = ["KeyC", "KeyT"];

/** All five, for a hero on foot and for a vehicle. */
export const CHARACTER_VIEWS: readonly ViewId[] = VIEW_ORDER;
export const VEHICLE_VIEWS: readonly ViewId[] = VIEW_ORDER;

/** What the framing is sized for. */
export type ViewSubject = "character" | "vehicle";

/**
 * How the game's input is turned:
 * - "camera": the rules map the stick with inputToWorld(moveX, moveY, yaw) (heroes, the submarine).
 *   The chase camera then only drifts behind the travel (it never locks onto the heading, or
 *   steering left would chase its own tail), and the front view is set when it is chosen.
 * - "vehicle": the stick steers the vehicle itself (left / right turn it, up throttles, like the
 *   scooter). Chase and front lock onto the heading; the yaw passed to the rules does not matter.
 */
export type ViewSteering = "camera" | "vehicle";

export interface ViewFraming {
   /** rad above the horizon */
   pitch: number;
   /** m from the pivot */
   distance: number;
   /** the camera looks this far (m) above the pivot */
   lookUp: number;
}

const DEG = Math.PI / 180;

const FRAMING: Record<ViewSubject, Record<Exclude<ViewId, "default">, ViewFraming>> = {
   character: {
      chase: { pitch: 22 * DEG, distance: 6, lookUp: 0.6 },
      front: { pitch: 14 * DEG, distance: 4.8, lookUp: 0.4 },
      top: { pitch: 76 * DEG, distance: 15, lookUp: 0 },
      free: { pitch: 26 * DEG, distance: 7, lookUp: 0.5 },
   },
   vehicle: {
      chase: { pitch: 17 * DEG, distance: 7.5, lookUp: 0.9 },
      front: { pitch: 12 * DEG, distance: 6.5, lookUp: 0.5 },
      top: { pitch: 76 * DEG, distance: 20, lookUp: 0 },
      free: { pitch: 24 * DEG, distance: 9, lookUp: 0.7 },
   },
};

export type ViewFramingOverrides = Partial<Record<Exclude<ViewId, "default">, Partial<ViewFraming>>>;

export function viewFraming(subject: ViewSubject, view: Exclude<ViewId, "default">, overrides?: ViewFramingOverrides): ViewFraming {
   return { ...FRAMING[subject][view], ...overrides?.[view] };
}

/** A game's list, de-duplicated and in VIEW_ORDER; "default" is always in it. */
export function normalizeViews(list: readonly ViewId[] | undefined): ViewId[] {
   const want = new Set<ViewId>(list && list.length ? list : VIEW_ORDER);
   want.add("default");
   return VIEW_ORDER.filter((v) => want.has(v));
}

/** The view after `current` in `list` (wraps; an unknown current goes to the first). */
export function nextView(list: readonly ViewId[], current: ViewId): ViewId {
   if (list.length === 0) return "default";
   const i = list.indexOf(current);
   return list[(i + 1) % list.length];
}

/** The view a run starts in: the player's last choice when the game still offers it. */
export function startView(list: readonly ViewId[], saved: ViewId | null): ViewId {
   return saved && list.includes(saved) ? saved : "default";
}

/** Is a key a view-cycle key that the game does not use itself? */
export function isViewKey(code: string, keys: readonly string[] = VIEW_KEYS): boolean {
   return keys.includes(code);
}

/**
 * The orbit settings a view runs with (its start pose, the follow and the clamps). `defaultYaw` is
 * the fitted view's yaw (top view's yaw, and the start of the others until the hero moves).
 */
export function viewOrbitSettings(view: Exclude<ViewId, "default">, subject: ViewSubject, steering: ViewSteering, framing: ViewFraming): Partial<OrbitSettings> {
   const base: Partial<OrbitSettings> = {
      pitch: framing.pitch,
      distance: framing.distance,
      minDistance: Math.min(framing.distance, subject === "vehicle" ? 3.5 : 2.5),
      maxDistance: Math.max(framing.distance, subject === "vehicle" ? 28 : 22),
      damping: 8,
      recenterDamping: 5,
   };
   if (view === "free") return { ...base, autoFollow: true };
   if (view === "top") return { ...base, autoFollow: false };
   if (steering === "vehicle") {
      // chase and front lock onto the heading: always follow, whatever the speed or the angle
      return { ...base, autoFollow: true, autoFollowDelay: 0, autoFollowRate: 3.2, autoFollowMinSpeed: -1, autoFollowFullSpeed: 0, autoFollowMaxAngle: 4 };
   }
   if (view === "chase") {
      // drifts behind the travel; never swings round when the hero turns back towards the camera
      return { ...base, autoFollow: true, autoFollowDelay: 0, autoFollowRate: 1.4, autoFollowMinSpeed: 0.4, autoFollowFullSpeed: 3, autoFollowMaxAngle: 100 * DEG };
   }
   return { ...base, autoFollow: false }; // camera-steered front: set when chosen, then holds its yaw
}

/** The yaw a view starts at: behind / in front of the heading (`heading`: forward = (sin, cos)), top at the fitted yaw. */
export function viewStartYaw(view: Exclude<ViewId, "default">, heading: number, defaultYaw: number): number {
   if (view === "chase") return wrapAngle(heading + Math.PI);
   if (view === "front") return wrapAngle(heading);
   return wrapAngle(defaultYaw);
}

/**
 * The travel a view's orbit follows this frame (into `out`): vehicle chase / front follow the
 * heading (front the reverse, so the camera sits ahead); camera-steered views and free follow the
 * hero's velocity; front (camera-steered) and top follow nothing.
 */
export function viewTravel(
   view: Exclude<ViewId, "default">,
   steering: ViewSteering,
   heading: number,
   vx: number,
   vz: number,
   out: { x: number; z: number },
): { x: number; z: number } {
   out.x = 0;
   out.z = 0;
   if (view === "top") return out;
   if (steering === "vehicle" && (view === "chase" || view === "front")) {
      const k = view === "chase" ? 10 : -10;
      out.x = Math.sin(heading) * k;
      out.z = Math.cos(heading) * k;
      return out;
   }
   if (view === "front") return out;
   out.x = Number.isFinite(vx) ? vx : 0;
   out.z = Number.isFinite(vz) ? vz : 0;
   return out;
}

// ---------- poses and blending ----------

export interface ViewPose {
   yaw: number;
   pitch: number;
   distance: number;
   /** the look point relative to the pivot */
   lookX: number;
   lookY: number;
   lookZ: number;
   /** lens shift (NDC) */
   shiftX: number;
   shiftY: number;
}

export function createPose(): ViewPose {
   return { yaw: 0, pitch: 0, distance: 1, lookX: 0, lookY: 0, lookZ: 0, shiftX: 0, shiftY: 0 };
}

export function copyPose(from: ViewPose, out: ViewPose): ViewPose {
   out.yaw = from.yaw;
   out.pitch = from.pitch;
   out.distance = from.distance;
   out.lookX = from.lookX;
   out.lookY = from.lookY;
   out.lookZ = from.lookZ;
   out.shiftX = from.shiftX;
   out.shiftY = from.shiftY;
   return out;
}

/** Seconds a view switch takes. */
export const VIEW_BLEND_S = 0.65;

/** Smoothstep of the switch's progress (0..1). */
export function blendEase(t: number): number {
   const x = t <= 0 ? 0 : t >= 1 ? 1 : t;
   return x * x * (3 - 2 * x);
}

/** a -> b by `k` (0..1) round the pivot (the yaw the short way). Into `out` (may be a or b). */
export function blendPose(a: ViewPose, b: ViewPose, k: number, out: ViewPose): ViewPose {
   const yaw = wrapAngle(a.yaw + wrapAngle(b.yaw - a.yaw) * k);
   out.pitch = a.pitch + (b.pitch - a.pitch) * k;
   out.distance = a.distance + (b.distance - a.distance) * k;
   out.lookX = a.lookX + (b.lookX - a.lookX) * k;
   out.lookY = a.lookY + (b.lookY - a.lookY) * k;
   out.lookZ = a.lookZ + (b.lookZ - a.lookZ) * k;
   out.shiftX = a.shiftX + (b.shiftX - a.shiftX) * k;
   out.shiftY = a.shiftY + (b.shiftY - a.shiftY) * k;
   out.yaw = yaw;
   return out;
}

/**
 * A camera at (cx, cy, cz) looking along the unit (fx, fy, fz), as a pose round the pivot: its
 * yaw / pitch / distance from the pivot, and the look point on its view ray at the pivot's
 * distance (so the camera's own orientation is kept). Into `out`. Used for the game's rig camera.
 */
export function poseFromCamera(px: number, py: number, pz: number, cx: number, cy: number, cz: number, fx: number, fy: number, fz: number, out: ViewPose): ViewPose {
   const dx = cx - px;
   const dy = cy - py;
   const dz = cz - pz;
   const d = Math.hypot(dx, dy, dz);
   if (!(d > 1e-6)) {
      out.yaw = 0;
      out.pitch = 0;
      out.distance = 1e-6;
   } else {
      out.yaw = Math.atan2(dx, dz);
      out.pitch = Math.asin(Math.max(-1, Math.min(1, dy / d)));
      out.distance = d;
   }
   out.lookX = cx + fx * d - px;
   out.lookY = cy + fy * d - py;
   out.lookZ = cz + fz * d - pz;
   return out;
}

/** The yaw of a camera at (cx, cz) looking at (lx, lz): what inputToWorld wants (fitView's yaw). */
export function cameraYawOf(cx: number, cz: number, lx: number, lz: number, fallback: number): number {
   const dx = cx - lx;
   const dz = cz - lz;
   if (dx * dx + dz * dz < 1e-8) return fallback;
   return Math.atan2(dx, dz);
}
