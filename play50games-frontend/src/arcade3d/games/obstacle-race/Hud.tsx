"use client";

import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";

export default function Hud() {
   return <HintLine signal={GUIDE} />;
}
