import { useLevel } from "@/arcade3d/core/level";
import type { RocketLevel } from "./levels";

export const useRocketLevel = () => useLevel<RocketLevel>();
