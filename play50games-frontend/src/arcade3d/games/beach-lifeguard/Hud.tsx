"use client";

// The game's own HUD is the shell's stat chips (Saved, Alert); this adds only the core 📷
// camera-view button (core/camera). Saved and Alert are the shell's chips, not a second clock.
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";

export default function Hud() {
   return <CameraViewButton />;
}
