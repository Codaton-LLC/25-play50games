// Menu 2 free orbit camera (menu2/camera/README.md). Pure parts first; the R3F / DOM parts are
// "use client" modules (OrbitCamera.tsx inside the Canvas, OrbitHud.tsx in the game's Hud).
export {
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
   type OrbitSettings,
   type OrbitState,
} from "./orbit";
export { clipOrbitDistance, rayBoxDistance, stepOrbitClip, type ClipOptions } from "./orbitCollision";
export {
   MOUSE_DEAD_PX,
   ORBIT_KEYS,
   TOUCH_DEAD_PX,
   applyOrbitInput,
   createGestureFrame,
   createOrbitGestures,
   type OrbitGestureFrame,
   type OrbitGestureOptions,
   type OrbitGestures,
   type OrbitPointerKind,
} from "./orbitGestures";
export {
   ORBIT_PREFS_KEY,
   markOrbitHintSeen,
   memoryOrbitStorage,
   orbitPrefs,
   parseOrbitPrefs,
   requestOrbitRecenter,
   setOrbitAutoFollow,
   setOrbitPrefsStorage,
   subscribeOrbitPrefs,
   type OrbitPrefs,
   type OrbitPrefsStorage,
} from "./orbitPrefs";
