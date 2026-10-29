"use client";

// useCameraZoom: the player zooms a follow camera with the mouse wheel, a two-finger pinch on the
// canvas or the + / - keys. Owned by Claude. Hand the ref to CameraRig:
//
//    const zoom = useCameraZoom({ min: 0.5, max: 1.6 });
//    <CameraRig ... offset={view.offset} zoom={zoom} />
//
// - The ref's value is the factor on the camera offset (1 = the fitted view); CameraRig reads it
//   every frame and eases the camera to it, so nothing re-renders while zooming.
// - The wheel is taken only over the canvas (the page does not scroll under it). A pinch needs two
//   fingers on the canvas; one finger stays the game's (joystick, swipes, taps).
// - The value survives Retry (one per mounted Scene component: keep it in the Scene).
import { useEffect, useRef, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { keyZoom, pinchZoom, wheelZoom, type ZoomLimits } from "./cameraZoom";

export interface CameraZoomOptions extends Partial<ZoomLimits> {
   /** the starting factor (default 1) */
   initial?: number;
}

export function useCameraZoom({ initial = 1, min = 0.5, max = 1.6 }: CameraZoomOptions = {}): MutableRefObject<number> {
   const zoom = useRef(initial);
   const element = useThree((state) => state.gl.domElement);
   useEffect(() => {
      const limits = { min, max };
      const pinch = { active: false, startZoom: 1, startDistance: 0 };
      const spread = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
      const onWheel = (event: WheelEvent) => {
         event.preventDefault();
         zoom.current = wheelZoom(zoom.current, event.deltaY, event.deltaMode, limits);
      };
      const onTouchStart = (event: TouchEvent) => {
         if (event.touches.length !== 2) return;
         pinch.active = true;
         pinch.startZoom = zoom.current;
         pinch.startDistance = spread(event.touches);
      };
      const onTouchMove = (event: TouchEvent) => {
         if (!pinch.active || event.touches.length !== 2) return;
         event.preventDefault();
         zoom.current = pinchZoom(pinch.startZoom, pinch.startDistance, spread(event.touches), limits);
      };
      const onTouchEnd = (event: TouchEvent) => {
         if (event.touches.length < 2) pinch.active = false;
      };
      const onKey = (event: KeyboardEvent) => {
         if (event.ctrlKey || event.metaKey || event.altKey) return;
         if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") zoom.current = keyZoom(zoom.current, "in", limits);
         else if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") zoom.current = keyZoom(zoom.current, "out", limits);
      };
      element.addEventListener("wheel", onWheel, { passive: false });
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchmove", onTouchMove, { passive: false });
      element.addEventListener("touchend", onTouchEnd, { passive: true });
      element.addEventListener("touchcancel", onTouchEnd, { passive: true });
      window.addEventListener("keydown", onKey);
      return () => {
         element.removeEventListener("wheel", onWheel);
         element.removeEventListener("touchstart", onTouchStart);
         element.removeEventListener("touchmove", onTouchMove);
         element.removeEventListener("touchend", onTouchEnd);
         element.removeEventListener("touchcancel", onTouchEnd);
         window.removeEventListener("keydown", onKey);
      };
   }, [element, min, max]);
   return zoom;
}
