"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { CraneLevel } from "./levels";

export const useCraneLevel = () => useLevel<CraneLevel>();
