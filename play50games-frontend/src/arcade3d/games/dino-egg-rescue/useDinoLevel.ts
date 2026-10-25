"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { DinoLevel } from "./levels";

export const useDinoLevel = () => useLevel<DinoLevel>();
