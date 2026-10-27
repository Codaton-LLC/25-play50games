// Menu 2 juice (menu2/juice/README.md): particles, popups, camera kick and shake, hit-stop, squash.
export {
   GLOW_CAPACITY,
   JUICE_DRAW_CALLS,
   JuiceLayer,
   SOFT_CAPACITY,
   createJuiceEmitter,
   useHasJuice,
   useJuice,
   type JuiceApi,
   type JuiceEmitter,
   type PopupOptions,
} from "./JuiceLayer";
export { JUICE_KINDS, JUICE_STYLES, createJuicePool, emitJuice, stepJuice, type EmitOptions, type JuiceKind, type JuiceStyle } from "./particles";
export { POPUP_LIFE, POPUP_MAX_CHARS, POPUP_SLOTS, createPopupPool, emitPopup, popupLook, stepPopups } from "./popups";
export { createCameraKick, kickCamera, shakeCamera, stepCameraKick, type CameraKick } from "./cameraKick";
export { HIT_STOP_MAX_MS, HIT_STOP_SCALE, createHitStop, hitStop, stepHitStop, type HitStop } from "./hitStop";
export { airStretch, createSpring, forwardStretch, kickSpring, landSquash, popScale, stepSpring, volumeScale, type Scale3, type Spring } from "./squash";
