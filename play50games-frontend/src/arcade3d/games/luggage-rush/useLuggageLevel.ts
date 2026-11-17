"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { LuggageLevel } from "./levels";

export const useLuggageLevel = () => useLevel<LuggageLevel>();
