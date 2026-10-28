"use client";

// The hint line (guide.ts: where to fly, how much is carried, bank it) and the core 📷 camera-view
// button. Nectar and Stamina are the shell's stat chips, not a second clock.
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
