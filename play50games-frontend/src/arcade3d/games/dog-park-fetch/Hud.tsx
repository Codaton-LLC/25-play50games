"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

/** The game has no HUD of its own (the shell's chips carry everything); the Hud adds only the core
 * 📷 camera-view button (core/camera), bottom-right above the touch Jump. */
export default function Hud() {
   return <CameraViewButton />;
}
