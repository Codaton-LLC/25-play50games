"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { ZooLevel } from "./levels";

export const useZooLevel = () => useLevel<ZooLevel>();
