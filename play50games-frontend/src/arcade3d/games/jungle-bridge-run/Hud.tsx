"use client";

// The obstacle hint line (guide.ts): what is coming and what to press. Section and Gems are the
// shell's chips; the runner has no touch buttons (swipes), so the line sits above the bottom edge.
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { GUIDE } from "./guide";

export default function Hud() {
   return <HintLine signal={GUIDE} />;
}
