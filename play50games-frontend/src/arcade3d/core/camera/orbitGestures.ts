// The orbit camera's input router (pure, DOM-free, so multi-touch is testable): which pointers turn
// the camera, the pinch, the wheel and the camera keys. Ported from the Menu 2 orbit camera
// (menu2/camera); CameraViews.tsx feeds it the canvas's pointer events and the window's keys, and
// reads `consume()` once per frame.
//
// - Mouse: the left or the right button dragged on the canvas turns the camera (after a 3 px dead
//   zone, so a click stays a click). The wheel zooms.
// - Touch: two fingers on the canvas turn it (their mid-point: horizontal = yaw, vertical = pitch)
//   and pinch to zoom. One finger on the canvas turns it too when `oneFinger` is on (default), after
//   a 10 px dead zone. The joystick and the Jump / Power buttons are not the canvas: a finger that
//   starts on them never reaches this router (the DOM layer only listens on the canvas, and skips
//   anything inside [data-arcade-controls]), so the joystick is never stolen.
// - Keys (none clash with WASD, the arrows, Space, E, Enter, Esc / P, digits): Q or Z turn left,
//   X turns right, R tilts up (towards top-down), F tilts down, V recenters behind the hero. C (and
//   T) belong to the view switch (views.ts VIEW_KEYS), so C is not a turn key here, unlike Menu 2's
//   first version (Q/Z + C/X); a game can pass its own `keys`.

import { orbitRotate, orbitZoom, type OrbitState } from "./orbit";

export type OrbitPointerKind = "mouse" | "touch" | "pen";

export interface OrbitKeys {
   yawLeft: readonly string[];
   yawRight: readonly string[];
   pitchUp: readonly string[];
   pitchDown: readonly string[];
   recenter: readonly string[];
}

/** The core camera keys (KeyboardEvent.code). */
export const ORBIT_KEYS: OrbitKeys = {
   yawLeft: ["KeyQ", "KeyZ"],
   yawRight: ["KeyX"],
   pitchUp: ["KeyR"],
   pitchDown: ["KeyF"],
   recenter: ["KeyV"],
};

/** Mouse travel (px) before a press becomes a camera drag. */
export const MOUSE_DEAD_PX = 3;
/** One-finger travel (px) before it turns the camera (a tap stays a tap). */
export const TOUCH_DEAD_PX = 10;

export interface OrbitGestureOptions {
   /** a single finger on empty canvas turns the camera (default true). Off for games that read canvas swipes or taps as moves. */
   oneFinger?: boolean;
   /** mouse buttons that drag the camera (default [0, 2]: left and right) */
   mouseButtons?: readonly number[];
   /** the camera keys (default ORBIT_KEYS) */
   keys?: OrbitKeys;
}

/** What a frame takes from the router (reset by consume()). */
export interface OrbitGestureFrame {
   /** drag travel this frame (px): +x = to the right, +y = down */
   dragX: number;
   dragY: number;
   /** zoom factor this frame (> 1 = farther): wheel and pinch */
   zoom: number;
   /** wheel travel (px, +down = out) this frame */
   wheel: number;
   /** held camera keys: -1 / 0 / 1 (yaw: +1 = right; pitch: +1 = up, more top-down) */
   keyYaw: number;
   keyPitch: number;
   /** a recenter key press this frame */
   recenter: boolean;
   /** a drag or a pinch is in progress */
   dragging: boolean;
}

interface Track {
   id: number;
   kind: OrbitPointerKind;
   x: number;
   y: number;
   sx: number;
   sy: number;
   live: boolean;
}

export interface OrbitGestures {
   /** a pointer pressed on the canvas; returns true when the router took it (the DOM layer captures it then) */
   down(id: number, x: number, y: number, kind: OrbitPointerKind, button?: number): boolean;
   move(id: number, x: number, y: number): void;
   up(id: number): void;
   /** every pointer gone (blur, pointercancel of all) */
   cancel(): void;
   /** a wheel step in px (+ = away / zoom out) */
   wheel(deltaPx: number): void;
   /** a key; returns true when it is a camera key */
   key(code: string, down: boolean): boolean;
   /** releases the held keys (blur) */
   releaseKeys(): void;
   /** this frame's input; resets the per-frame parts */
   consume(out?: OrbitGestureFrame): OrbitGestureFrame;
   /** pointers the router holds (tests) */
   count(): number;
}

export function createGestureFrame(): OrbitGestureFrame {
   return { dragX: 0, dragY: 0, zoom: 1, wheel: 0, keyYaw: 0, keyPitch: 0, recenter: false, dragging: false };
}

const has = (list: readonly string[], code: string) => list.includes(code);

export function createOrbitGestures(options: OrbitGestureOptions = {}): OrbitGestures {
   const oneFinger = options.oneFinger ?? true;
   const buttons = options.mouseButtons ?? [0, 2];
   const keys = options.keys ?? ORBIT_KEYS;
   const tracks: Track[] = [];
   let dragX = 0;
   let dragY = 0;
   let zoom = 1;
   let wheelPx = 0;
   let recenter = false;
   const held = new Set<string>();
   // the two-finger baseline (mid-point and spread)
   let pairMx = 0;
   let pairMy = 0;
   let pairSpread = 0;
   let paired = false;

   const touches = () => tracks.filter((t) => t.kind !== "mouse");
   const rebase = () => {
      const t = touches();
      paired = t.length >= 2;
      if (paired) {
         pairMx = (t[0].x + t[1].x) / 2;
         pairMy = (t[0].y + t[1].y) / 2;
         pairSpread = Math.hypot(t[0].x - t[1].x, t[0].y - t[1].y);
      }
      // after a second finger lifts, the one left carries on from where it is
      for (const k of t) {
         k.sx = k.x;
         k.sy = k.y;
      }
   };

   return {
      down(id, x, y, kind, button = 0) {
         if (tracks.some((t) => t.id === id)) return true;
         if (kind === "mouse") {
            if (!buttons.includes(button) || tracks.some((t) => t.kind === "mouse")) return false;
         } else if (touches().length >= 2) {
            return false; // a third finger does nothing
         }
         tracks.push({ id, kind, x, y, sx: x, sy: y, live: false });
         if (kind !== "mouse") {
            rebase();
            if (paired) for (const t of touches()) t.live = true;
         }
         return true;
      },
      move(id, x, y) {
         const t = tracks.find((k) => k.id === id);
         if (!t) return;
         const px = t.x;
         const py = t.y;
         t.x = x;
         t.y = y;
         if (t.kind === "mouse") {
            if (!t.live && Math.hypot(x - t.sx, y - t.sy) >= MOUSE_DEAD_PX) t.live = true;
            if (t.live) {
               dragX += x - px;
               dragY += y - py;
            }
            return;
         }
         const tt = touches();
         if (paired && tt.length >= 2) {
            const mx = (tt[0].x + tt[1].x) / 2;
            const my = (tt[0].y + tt[1].y) / 2;
            const spread = Math.hypot(tt[0].x - tt[1].x, tt[0].y - tt[1].y);
            dragX += mx - pairMx;
            dragY += my - pairMy;
            if (pairSpread > 8 && spread > 8) zoom *= pairSpread / spread;
            pairMx = mx;
            pairMy = my;
            pairSpread = spread;
            return;
         }
         if (!oneFinger) return;
         if (!t.live && Math.hypot(x - t.sx, y - t.sy) >= TOUCH_DEAD_PX) t.live = true;
         if (t.live) {
            dragX += x - px;
            dragY += y - py;
         }
      },
      up(id) {
         const i = tracks.findIndex((k) => k.id === id);
         if (i < 0) return;
         const kind = tracks[i].kind;
         tracks.splice(i, 1);
         if (kind !== "mouse") rebase();
      },
      cancel() {
         tracks.length = 0;
         paired = false;
      },
      wheel(deltaPx) {
         if (!Number.isFinite(deltaPx) || deltaPx === 0) return;
         wheelPx += Math.max(-400, Math.min(400, deltaPx));
      },
      key(code, down) {
         const camera = has(keys.yawLeft, code) || has(keys.yawRight, code) || has(keys.pitchUp, code) || has(keys.pitchDown, code);
         if (camera) {
            if (down) held.add(code);
            else held.delete(code);
            return true;
         }
         if (has(keys.recenter, code)) {
            if (down) recenter = true;
            return true;
         }
         return false;
      },
      releaseKeys() {
         held.clear();
      },
      consume(out = createGestureFrame()) {
         let yaw = 0;
         let pitch = 0;
         for (const code of held) {
            if (has(keys.yawLeft, code)) yaw -= 1;
            else if (has(keys.yawRight, code)) yaw += 1;
            else if (has(keys.pitchUp, code)) pitch += 1;
            else if (has(keys.pitchDown, code)) pitch -= 1;
         }
         out.dragX = dragX;
         out.dragY = dragY;
         out.zoom = zoom;
         out.wheel = wheelPx;
         out.keyYaw = Math.max(-1, Math.min(1, yaw));
         out.keyPitch = Math.max(-1, Math.min(1, pitch));
         out.recenter = recenter;
         out.dragging = paired || tracks.some((t) => t.live);
         dragX = 0;
         dragY = 0;
         zoom = 1;
         wheelPx = 0;
         recenter = false;
         return out;
      },
      count: () => tracks.length,
   };
}

/**
 * Applies one frame of router input to an orbit (manual input: it always wins over the auto-follow).
 * A drag to the right swings the camera to the left round the hero (the world turns with the
 * finger); a drag down raises the camera (towards top-down). `dt` scales the held keys.
 * Returns true when anything turned or zoomed.
 */
export function applyOrbitInput(o: OrbitState, f: OrbitGestureFrame, dt: number): boolean {
   const s = o.settings;
   const dYaw = -f.dragX * s.dragYawPerPx + f.keyYaw * s.keyYawRate * Math.max(0, dt);
   const dPitch = f.dragY * s.dragPitchPerPx + f.keyPitch * s.keyPitchRate * Math.max(0, dt);
   let changed = false;
   if (dYaw !== 0 || dPitch !== 0) {
      orbitRotate(o, dYaw, dPitch);
      changed = true;
   }
   const zoom = f.zoom * Math.exp(f.wheel * s.wheelZoomPerPx);
   if (zoom !== 1) {
      orbitZoom(o, zoom);
      changed = true;
   }
   // holding a drag still counts as manual input: the auto-follow waits until the finger lifts
   if (f.dragging) o.idle = 0;
   return changed;
}
