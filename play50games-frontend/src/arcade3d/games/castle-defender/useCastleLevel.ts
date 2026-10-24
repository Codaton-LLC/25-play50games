"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { CastleLevel } from "./levels";

export const useCastleLevel = () => useLevel<CastleLevel>();
