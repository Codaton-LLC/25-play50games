"use client";
import { useLevel } from "../../core/level";
import type { MiniGolfLevel } from "./levels";
export const useMiniGolfLevel = () => useLevel<MiniGolfLevel>();
