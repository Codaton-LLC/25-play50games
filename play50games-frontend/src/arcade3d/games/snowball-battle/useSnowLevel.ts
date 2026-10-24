"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { SnowLevel } from "./levels";

export const useSnowLevel = () => useLevel<SnowLevel>();
