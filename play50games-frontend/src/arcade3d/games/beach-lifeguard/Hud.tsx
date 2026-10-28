"use client";

// The hint line (guide.ts: what to do now, towing, hurry) and the core 📷 camera-view button. Saved
// and Alert are the shell's stat chips, not a second clock.
import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";

export default function Hud() {
   return (
      <>
         <CameraViewButton />
         <HintLine signal={GUIDE} />
      </>
   );
}
