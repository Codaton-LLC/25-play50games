import { useLevel } from "@/arcade3d/core/level";
import type { DroneLevel } from "./levels";

export const useDeliveryLevel = () => useLevel<DroneLevel>();
