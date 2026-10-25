"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { SlideLevel } from "./levels";

export const useSlideLevel = () => useLevel<SlideLevel>();
