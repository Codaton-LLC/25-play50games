"use client";

import CameraViewButton from "@/arcade3d/core/camera/CameraViewButton";
import { HintLine } from "@/arcade3d/core/hud/HintLine";
import { useLevel } from "@/arcade3d/core/level";
import { useArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { hintFor } from "./guide";
import type { IslandLevel } from "./levels";

/** The core 📷 camera-view button plus the hint line: the detector ring, then the finds, the gates and the map. */
export default function Hud() {
   const { treasures: total, map } = useLevel<IslandLevel>().config;
   const found = useArcadeStore((s) => s.stats.treasures ?? 0);
   const hint = hintFor(found, total, map);
   return (
      <>
         <CameraViewButton />
         <HintLine text={hint.text} tone={hint.tone} />
      </>
   );
}
