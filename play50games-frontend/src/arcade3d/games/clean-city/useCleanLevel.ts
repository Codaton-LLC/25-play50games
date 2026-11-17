"use client";
import { useLevel } from "../../core/level";
import type { CleanLevel } from "./levels";
export const useCleanLevel = () => useLevel<CleanLevel>();
