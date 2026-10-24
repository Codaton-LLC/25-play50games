"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { KitchenLevel } from "./levels";

export const useKitchenLevel = () => useLevel<KitchenLevel>();
