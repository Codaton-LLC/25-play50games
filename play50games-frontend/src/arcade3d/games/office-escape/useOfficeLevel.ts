import { useLevel } from "@/arcade3d/core/level";
import type { OfficeLevel } from "./levels";

export const useOfficeLevel = () => useLevel<OfficeLevel>();
