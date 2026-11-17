"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { PirateLevel } from "./levels";

export const usePirateLevel = () => useLevel<PirateLevel>();
