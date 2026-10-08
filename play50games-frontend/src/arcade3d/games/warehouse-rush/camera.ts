// Warehouse Rush's static fitted camera (README "Scene and camera"): plain data, no three.js or
// React, so Scene.tsx and marker.test.ts (which projects the order markers through it) share it.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";

/** Camera tilt above the floor: a three-quarter top-down view (as robot-collector). */
export const PITCH = (56 * Math.PI) / 180;
/** The canvas camera's vertical fov (index.tsx `camera.fov`), which the fit uses. */
export const FOV = 45;
export const LOOK_AT: [number, number, number] = [0, 0, 0];
/** floor + walls; y up to 1.2 covers the racks (1.1) and the robot (1.2) */
export const WAREHOUSE: AABB = { min: { x: -10.4, y: 0, z: -6.4 }, max: { x: 10.4, y: 1.2, z: 6.4 } };
/**
 * Static fitted camera: the whole warehouse on screen for the whole run, clear of the shell HUD,
 * the order panel, the joystick, the Action button and the cookie banner (8 px). A portrait phone
 * turns the camera so the 20 m side runs up the screen; the lens shift lets the floor sit off-centre
 * in the free space.
 */
export const VIEW: FittedViewOptions = {
   area: WAREHOUSE,
   pitch: PITCH,
   yaws: [0, Math.PI / 2],
   focus: [{ x: 0, y: 0, z: 0 }],
   margin: { top: 0.02, bottom: 0.03, left: 0.02, right: 0.02 },
   padding: 8,
   shift: true,
};
