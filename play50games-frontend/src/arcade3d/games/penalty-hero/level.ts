"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { PenaltyLevel } from "./levels";

/** The picked level, shared by the Canvas scene and the DOM HUD. */
export const usePenaltyLevel = () => useLevel<PenaltyLevel>();
