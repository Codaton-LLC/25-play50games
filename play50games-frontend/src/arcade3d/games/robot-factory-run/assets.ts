import type { ModelAsset } from "../../core/types";
import { heroModelAsset } from "../../menu2/heroModels";
export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   conveyor: { id: "m2Conveyor", url: "/models/3d/robot-factory-run/m2Conveyor.glb", scale: 1.052631579, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 152992 } },
   turntable: { id: "m2ConveyorTurntable", url: "/models/3d/robot-factory-run/m2ConveyorTurntable.glb", scale: 1.052077854, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 109152 } },
   crate: { id: "m2FactoryCrate", url: "/models/3d/robot-factory-run/m2FactoryCrate.glb", scale: 0.689655172, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 1500, bytes: 85484 } },
   hall: { id: "m2FactoryHallBg", url: "/models/3d/robot-factory-run/m2FactoryHallBg.glb", scale: 12.506513809, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 150172 } },
   press: { id: "m2HydraulicPress", url: "/models/3d/robot-factory-run/m2HydraulicPress.glb", scale: 1.471361009, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 147604 } },
   laser: { id: "m2LaserGate", url: "/models/3d/robot-factory-run/m2LaserGate.glb", scale: 1.261166579, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 1500, bytes: 85532 } },
   arm: { id: "m2RobotArm", url: "/models/3d/robot-factory-run/m2RobotArm.glb", scale: 1.370585134, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 1500, bytes: 127472 } },
   catwalk: { id: "m2SteelCatwalk", url: "/models/3d/robot-factory-run/m2SteelCatwalk.glb", scale: 1.053740780, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 122208 } },
   tread: { id: "m2TreadBot", url: "/models/3d/robot-factory-run/m2TreadBot.glb", scale: 0.682056663, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 3000, bytes: 189108 } },
   patrol: { id: "m2PatrolBot", url: "/models/3d/robot-factory-run/m2PatrolBot.glb", scale: 0.790722193, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 18000, bytes: 486060 } },
   drone: { id: "m2FactoryDrone", url: "/models/3d/robot-factory-run/m2FactoryDrone.glb", scale: 0.736842105, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 18000, bytes: 521660 } },
   boss: { id: "m2MegaRobotBoss", url: "/models/3d/robot-factory-run/m2MegaRobotBoss.glb", scale: 2.526315789, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 18000, bytes: 577896 } },
   cell: { id: "m2PowerCell", url: "/models/3d/robot-factory-run/m2PowerCell.glb", scale: 0.448548813, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 1500, bytes: 49704 } },
   gem: { id: "m2EnergyGem", url: "/models/3d/robot-factory-run/m2EnergyGem.glb", scale: 0.238221281, fallback: "box", fallbackColor: "#dc6650", budget: { tris: 1500, bytes: 77824 } },
};
