"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { WarehouseLevel } from "./levels";

/** The level the player picked (core useLevel, wrapped once). */
export const useWarehouseLevel = () => useLevel<WarehouseLevel>();
