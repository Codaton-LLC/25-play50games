"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

/** Bee Garden has no game HUD of its own (the shell's stat chips carry everything); this adds the core 📷 camera-view button (core/camera). */
export default function Hud() {
   return <CameraViewButton />;
}
