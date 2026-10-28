"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";

export default function Hud() {
   return <><CameraViewButton /><HintLine signal={GUIDE} /></>;
}
