"use client";

import { useLevel } from "@/arcade3d/core/level";
import type { MuseumLevel } from "./levels";

export const useMuseumLevel = () => useLevel<MuseumLevel>();
