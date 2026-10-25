"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { GhostLevel } from "./levels";

export const useGhostLevel = () => useLevel<GhostLevel>();
