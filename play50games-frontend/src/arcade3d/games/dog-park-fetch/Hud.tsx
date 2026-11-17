"use client";

// The hint line (guide.ts: run to the toy, catch the frisbee, bring it back) and the core 📷
// camera-view button (core/camera), bottom-right above the touch Jump. Fetched is the shell's chip.
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
