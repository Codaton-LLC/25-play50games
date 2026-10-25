"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { PigeonLevel } from "./levels";

export const usePigeonLevel = () => useLevel<PigeonLevel>();
