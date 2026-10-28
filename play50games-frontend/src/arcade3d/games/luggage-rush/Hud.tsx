"use client";

import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";

/** The one hint line: which diverter the front bag needs, then its chute. The strikes and combo are the shell's chips. */
export default function Hud() {
   return <HintLine signal={GUIDE} />;
}
