// The Menu 2 orbit camera: state (clamps, smoothing, recenter, auto-follow, manual wins), the
// camera-relative contract with core inputToWorld, the collision pull-in, the gesture router
// (mouse, one / two fingers, pinch, wheel, keys that never clash with the game's) and the prefs.
import { beforeEach, describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createInputController } from "@/arcade3d/core/inputController";
import { KEYBOARD_LAYOUTS } from "@/arcade3d/menu2/multiplayer/playerInput";
import type { AABB } from "@/arcade3d/core/collision";
import {
   DEFAULT_ORBIT,
   ORBIT_MAX_PITCH,
   ORBIT_MIN_PITCH,
   createOrbit,
   orbitDirection,
   orbitPoseOf,
   orbitPosition,
   orbitRecenter,
   orbitRotate,
   orbitSnap,
   orbitZoom,
   stepOrbit,
   wrapAngle,
   yawBehind,
} from "./orbit";
import { clipOrbitDistance, rayBoxDistance, stepOrbitClip } from "./orbitCollision";
import { MOUSE_DEAD_PX, ORBIT_KEYS, TOUCH_DEAD_PX, applyOrbitInput, createGestureFrame, createOrbitGestures } from "./orbitGestures";
import {
   ORBIT_PREFS_KEY,
   markOrbitHintSeen,
   memoryOrbitStorage,
   noteOrbitTurned,
   orbitPrefs,
   orbitRecenterRequests,
   orbitTurned,
   parseOrbitPrefs,
   requestOrbitRecenter,
   resetOrbitSignals,
   setOrbitAutoFollow,
   setOrbitPrefsStorage,
} from "./orbitPrefs";

const DEG = Math.PI / 180;
const settle = (o: ReturnType<typeof createOrbit>, seconds = 3, vx = 0, vz = 0, auto?: boolean) => {
   for (let t = 0; t < seconds; t += 1 / 60) stepOrbit(o, 1 / 60, vx, vz, auto);
};

describe("orbit state", () => {
   it("yaw is free all round; pitch is clamped to -5°..80°; distance to the game's range", () => {
      const o = createOrbit({ minDistance: 4, maxDistance: 12 });
      for (let i = 0; i < 40; i++) orbitRotate(o, 0.3, 0);
      expect(o.yaw).toBeCloseTo(wrapAngle(12), 9); // 40 x 0.3 rad: more than one full turn, wrapped
      orbitRotate(o, 0, 10);
      expect(o.pitch).toBe(ORBIT_MAX_PITCH);
      expect(ORBIT_MAX_PITCH).toBeCloseTo(80 * DEG, 9);
      orbitRotate(o, 0, -10);
      expect(o.pitch).toBe(ORBIT_MIN_PITCH);
      expect(ORBIT_MIN_PITCH).toBeCloseTo(-5 * DEG, 9);
      orbitZoom(o, 100);
      expect(o.distance).toBe(12);
      orbitZoom(o, 0.001);
      expect(o.distance).toBe(4);
   });

   it("the view eases to the target the short way round (no 350° spin across ±180°)", () => {
      const o = createOrbit({ yaw: 170 * DEG });
      orbitRotate(o, 20 * DEG, 0); // target -170°
      stepOrbit(o, 1 / 60);
      // the first step moves towards +180, not back through 0
      expect(Math.abs(o.viewYaw)).toBeGreaterThan(170 * DEG);
      settle(o, 2);
      expect(o.viewYaw).toBeCloseTo(-170 * DEG, 3);
   });

   it("recenter swings behind the hero at the start pitch and keeps the player's zoom", () => {
      const o = createOrbit();
      orbitRotate(o, 2, 0.6);
      orbitZoom(o, 1.5);
      settle(o);
      const zoom = o.distance;
      orbitRecenter(o, yawBehind(1, 0)); // the hero runs towards +x: the camera goes to -x
      expect(o.recentering).toBe(true);
      settle(o, 3, 0, 0, false);
      expect(o.viewYaw).toBeCloseTo(-Math.PI / 2, 3);
      expect(o.viewPitch).toBeCloseTo(DEFAULT_ORBIT.pitch, 3);
      expect(o.distance).toBe(zoom);
      expect(o.recentering).toBe(false);
   });

   it("auto-follow swings slowly behind the travel only after the delay, and manual input always wins", () => {
      const o = createOrbit({ autoFollowDelay: 2 });
      orbitRotate(o, 0.8, 0); // a manual turn: the camera now looks 0.8 rad off the travel (-z)
      settle(o, 1.5, 0, -6);
      expect(o.yaw).toBeCloseTo(0.8, 9); // still inside the delay: untouched
      settle(o, 1, 0, -6);
      expect(o.yaw).toBeLessThan(0.8); // past the delay: swinging back behind
      expect(o.yaw).toBeGreaterThan(0.2); // gently, not a snap
      settle(o, 6, 0, -6);
      expect(o.yaw).toBeCloseTo(0, 2);
      // a manual turn resets the delay at once
      orbitRotate(o, 0.5, 0);
      const turned = o.yaw;
      settle(o, 1.9, 0, -6);
      expect(o.yaw).toBe(turned);
   });

   it("auto-follow off, too slow, or running towards the camera: no swing", () => {
      const off = createOrbit({ autoFollow: false, yaw: 0.6 });
      settle(off, 8, 0, -6);
      expect(off.yaw).toBe(0.6);
      const slow = createOrbit({ yaw: 0.6 });
      settle(slow, 8, 0, -1);
      expect(slow.yaw).toBe(0.6);
      const back = createOrbit({ yaw: 0 });
      settle(back, 8, 0, 6); // straight at the camera: never turns the view round
      expect(back.yaw).toBe(0);
   });

   it("orbitPosition / orbitPoseOf invert each other; the camera sits where fitView puts yaw", () => {
      const p = orbitPosition(1, 2, 3, 0.7, 0.4, 9, { x: 0, y: 0, z: 0 });
      const pose = orbitPoseOf(1, 2, 3, p.x, p.y, p.z);
      expect(pose.yaw).toBeCloseTo(0.7, 9);
      expect(pose.pitch).toBeCloseTo(0.4, 9);
      expect(pose.distance).toBeCloseTo(9, 9);
      const o = createOrbit();
      orbitSnap(o, 1, 0.3, 6);
      expect([o.viewYaw, o.viewPitch, o.viewDistance]).toEqual([1, 0.3, 6]);
   });

   it("camera-relative: for any yaw, stick up (inputToWorld) moves straight away from the camera", () => {
      const dir = { x: 0, y: 0, z: 0 };
      for (let yaw = -3; yaw <= 3; yaw += 0.25) {
         orbitDirection(yaw, 0.3, dir); // pivot -> camera
         const up = inputToWorld(0, -1, yaw);
         const flat = Math.hypot(dir.x, dir.z);
         expect(up.x).toBeCloseTo(-dir.x / flat, 9);
         expect(up.z).toBeCloseTo(-dir.z / flat, 9);
         // stick right is the camera's right
         const right = inputToWorld(1, 0, yaw);
         expect(right.x * up.x + right.z * up.z).toBeCloseTo(0, 9);
         expect(up.x * right.z - up.z * right.x).toBeCloseTo(1, 9); // right of "forward" seen from above (y up)
      }
   });
});

describe("orbit collision", () => {
   const wall: AABB = { min: { x: -2, y: 0, z: 3 }, max: { x: 2, y: 4, z: 3.5 } };

   it("a box between the pivot and the camera pulls the camera in front of it", () => {
      // pivot at the origin, camera 8 m back along +z: the wall at z 3 blocks it
      const d = clipOrbitDistance(0, 1, 0, 0, 0, 1, 8, [wall], 1, { radius: 0.3, minDistance: 1 });
      expect(d).toBeCloseTo(3 - 0.3, 9);
      // looking over the wall (from high up) it does not block
      const dir = orbitDirection(0, 70 * DEG, { x: 0, y: 0, z: 0 });
      expect(clipOrbitDistance(0, 1, 0, dir.x, dir.y, dir.z, 8, [wall], 1)).toBe(8);
   });

   it("boxes beside the ray, behind the pivot or around the pivot never pull in; never under minDistance", () => {
      expect(rayBoxDistance(0, 1, 0, 0, 0, 1, 8, { min: { x: 5, y: 0, z: 0 }, max: { x: 6, y: 4, z: 8 } }, 0.3)).toBe(-1);
      expect(rayBoxDistance(0, 1, 0, 0, 0, 1, 8, { min: { x: -1, y: 0, z: -5 }, max: { x: 1, y: 4, z: -4 } }, 0.3)).toBe(-1);
      expect(rayBoxDistance(0, 1, 0, 0, 0, 1, 8, { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 4, z: 1 } }, 0.3)).toBe(-1);
      const near: AABB = { min: { x: -2, y: 0, z: 0.5 }, max: { x: 2, y: 4, z: 1 } };
      expect(clipOrbitDistance(0, 1, 0, 0, 0, 1, 8, [near], 1, { radius: 0.3, minDistance: 1.2 })).toBe(1.2);
      // count limits the boxes read
      expect(clipOrbitDistance(0, 1, 0, 0, 0, 1, 8, [wall], 0)).toBe(8);
   });

   it("in at once, out slowly", () => {
      expect(stepOrbitClip(8, 3, 1 / 60)).toBe(3);
      const out = stepOrbitClip(3, 8, 1 / 60);
      expect(out).toBeGreaterThan(3);
      expect(out).toBeLessThan(3.3);
   });
});

describe("gesture router", () => {
   it("left or right mouse drag turns after the dead zone; the middle button does not", () => {
      const g = createOrbitGestures();
      expect(g.down(1, 100, 100, "mouse", 1)).toBe(false);
      expect(g.down(1, 100, 100, "mouse", 0)).toBe(true);
      g.move(1, 100 + MOUSE_DEAD_PX - 1, 100);
      expect(g.consume().dragX).toBe(0);
      g.move(1, 140, 120);
      const f = g.consume();
      expect(f.dragX).toBe(40 - (MOUSE_DEAD_PX - 1));
      expect(f.dragY).toBe(20);
      expect(f.dragging).toBe(true);
      g.up(1);
      expect(g.down(2, 0, 0, "mouse", 2)).toBe(true);
      expect(g.consume().dragging).toBe(false);
   });

   it("two fingers: the mid-point turns (x = yaw, y = pitch), the spread zooms", () => {
      const g = createOrbitGestures({ oneFinger: false });
      g.down(1, 100, 300, "touch");
      g.down(2, 200, 300, "touch");
      g.move(1, 130, 280);
      g.move(2, 230, 280);
      let f = g.consume();
      expect(f.dragX).toBeCloseTo(30, 9);
      expect(f.dragY).toBeCloseTo(-20, 9);
      expect(f.dragging).toBe(true);
      // pinch apart: 100 px -> 200 px spread = half the distance
      g.move(1, 80, 280);
      g.move(2, 280, 280);
      f = g.consume();
      expect(f.zoom).toBeCloseTo(0.5, 6);
      expect(f.dragX).toBeCloseTo(0, 9);
   });

   it("one finger turns only when allowed, after the tap dead zone; a third finger is ignored", () => {
      const off = createOrbitGestures({ oneFinger: false });
      off.down(1, 0, 0, "touch");
      off.move(1, 80, 0);
      expect(off.consume().dragX).toBe(0);
      const on = createOrbitGestures();
      on.down(1, 0, 0, "touch");
      on.move(1, TOUCH_DEAD_PX - 1, 0);
      expect(on.consume().dragX).toBe(0); // a tap stays a tap
      on.move(1, 60, 0);
      expect(on.consume().dragX).toBe(60 - (TOUCH_DEAD_PX - 1));
      on.down(2, 100, 0, "touch");
      expect(on.down(3, 200, 0, "touch")).toBe(false);
      expect(on.count()).toBe(2);
      // the second finger lifts: the first carries on from where it is, no jump
      on.up(2);
      on.consume();
      on.move(1, 70, 0);
      expect(on.consume().dragX).toBe(10);
   });

   it("the wheel zooms; applyOrbitInput turns the orbit the way the finger goes", () => {
      const g = createOrbitGestures();
      const o = createOrbit();
      g.wheel(100);
      g.down(1, 0, 0, "mouse", 0);
      g.move(1, 50, 0); // drag right
      const f = g.consume(createGestureFrame());
      expect(applyOrbitInput(o, f, 1 / 60)).toBe(true);
      expect(o.distance).toBeGreaterThan(DEFAULT_ORBIT.distance); // wheel down = farther
      expect(o.yaw).toBeLessThan(0); // drag right: the camera swings left round the hero
      expect(o.idle).toBe(0);
      g.move(1, 50, 40); // drag down: the camera rises
      const before = o.pitch;
      applyOrbitInput(o, g.consume(), 1 / 60);
      expect(o.pitch).toBeGreaterThan(before);
   });

   it("camera keys: Q/Z left, C/X right, R/F tilt, V recenters; none is a game key, P2 key or pause key", () => {
      const g = createOrbitGestures();
      expect(g.key("KeyQ", true)).toBe(true);
      expect(g.consume().keyYaw).toBe(-1);
      g.key("KeyQ", false);
      g.key("KeyX", true);
      expect(g.consume().keyYaw).toBe(1);
      g.releaseKeys();
      g.key("KeyR", true);
      expect(g.consume().keyPitch).toBe(1);
      g.key("KeyR", false);
      g.key("KeyF", true);
      expect(g.consume().keyPitch).toBe(-1);
      g.key("KeyV", true);
      expect(g.consume().recenter).toBe(true);
      expect(g.consume().recenter).toBe(false);
      expect(g.key("KeyW", true)).toBe(false);
      expect(g.key("KeyE", true)).toBe(false);
      const core = createInputController();
      const p2 = Object.values(KEYBOARD_LAYOUTS.kb2).flat();
      for (const code of Object.values(ORBIT_KEYS).flat()) {
         expect(core.keyDown(code)).toBe(false); // not WASD, arrows, Space, E, Enter, digits
         expect(p2).not.toContain(code);
         expect(["Escape", "KeyP"]).not.toContain(code);
      }
      // P1 (kb1) owns WASD / Space / E: the camera keys sit beside them, never on them
      const p1 = Object.values(KEYBOARD_LAYOUTS.kb1).flat();
      for (const code of Object.values(ORBIT_KEYS).flat()) expect(p1).not.toContain(code);
   });
});

describe("orbit prefs and signals", () => {
   beforeEach(() => {
      setOrbitPrefsStorage(memoryOrbitStorage());
      resetOrbitSignals();
   });

   it("defaults: hint not seen, auto-follow on; bad data falls back", () => {
      expect(orbitPrefs()).toEqual({ hintSeen: false, autoFollow: true });
      expect(parseOrbitPrefs("{nope")).toEqual({ hintSeen: false, autoFollow: true });
      expect(parseOrbitPrefs('{"autoFollow":false}')).toEqual({ hintSeen: false, autoFollow: false });
   });

   it("the hint is stored once under its own key, through the adapter only", () => {
      const store = memoryOrbitStorage();
      setOrbitPrefsStorage(store);
      const first = orbitPrefs();
      markOrbitHintSeen();
      expect(orbitPrefs()).not.toBe(first);
      expect(JSON.parse(store.items[ORBIT_PREFS_KEY])).toEqual({ hintSeen: true, autoFollow: true });
      setOrbitAutoFollow(false);
      setOrbitPrefsStorage(store); // a reload
      expect(orbitPrefs()).toEqual({ hintSeen: true, autoFollow: false });
   });

   it("recenter requests count up; the first turn is reported once", () => {
      const before = orbitRecenterRequests();
      requestOrbitRecenter();
      expect(orbitRecenterRequests()).toBe(before + 1);
      noteOrbitTurned();
      noteOrbitTurned();
      expect(orbitTurned()).toBe(1);
   });
});
