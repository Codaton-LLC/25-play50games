// The list of 3D Arcade games. Server-safe: imports only plain-data meta files.
// Owned by Claude. Game owners change their own meta.ts, never this file.
import type { ArcadeCollection, ArcadeGameMeta, ArcadeSlug } from "./types";
import { ARCADE_COLLECTIONS } from "./types";
import { ARCADE_PREVIEW } from "./flags";
import { robotCollectorMeta } from "./games/robot-collector/meta";
import { foodCatcherMeta } from "./games/food-catcher/meta";
import { officeEscapeMeta } from "./games/office-escape/meta";
import { pigeonCrossingMeta } from "./games/pigeon-crossing/meta";
import { penaltyHeroMeta } from "./games/penalty-hero/meta";
import { warehouseRushMeta } from "./games/warehouse-rush/meta";
import { towerClimbMeta } from "./games/tower-climb/meta";
import { cleanCityMeta } from "./games/clean-city/meta";
import { escapeRoomMeta } from "./games/escape-room/meta";
import { obstacleRaceMeta } from "./games/obstacle-race/meta";
import { treasureIslandMeta } from "./games/treasure-island/meta";
import { museumGuardMeta } from "./games/museum-guard/meta";
import { luggageRushMeta } from "./games/luggage-rush/meta";
import { dinoEggRescueMeta } from "./games/dino-egg-rescue/meta";
import { deliveryDroneMeta } from "./games/delivery-drone/meta";
import { shoppingCartMeta } from "./games/shopping-cart/meta";
import { snowballBattleMeta } from "./games/snowball-battle/meta";
import { ghostVacuumMeta } from "./games/ghost-vacuum/meta";
import { constructionWorkerMeta } from "./games/construction-worker/meta";
import { alienFarmMeta } from "./games/alien-farm/meta";
import { miniGolfMeta } from "./games/mini-golf/meta";
import { robotFactoryMeta } from "./games/robot-factory/meta";
import { pirateCannonsMeta } from "./games/pirate-cannons/meta";
import { castleDefenderMeta } from "./games/castle-defender/meta";
import { penguinSlideMeta } from "./games/penguin-slide/meta";
import { spaceRepairMeta } from "./games/space-repair/meta";
import { monsterKitchenMeta } from "./games/monster-kitchen/meta";
import { knightArenaMeta } from "./games/knight-arena/meta";
import { zooEscapeMeta } from "./games/zoo-escape/meta";
import { rocketLandingMeta } from "./games/rocket-landing/meta";
import { firefighterRescueMeta } from "./games/firefighter-rescue/meta";
import { taxiRush3dMeta } from "./games/taxi-rush-3d/meta";
import { burgerDeliveryScooterMeta } from "./games/burger-delivery-scooter/meta";
import { beachLifeguardMeta } from "./games/beach-lifeguard/meta";
import { farmTractorChallengeMeta } from "./games/farm-tractor-challenge/meta";
import { catVsRobotVacuumMeta } from "./games/cat-vs-robot-vacuum/meta";
import { hotelBellboyRushMeta } from "./games/hotel-bellboy-rush/meta";
import { wizardPotionLabMeta } from "./games/wizard-potion-lab/meta";
import { hauntedMansionKeysMeta } from "./games/haunted-mansion-keys/meta";
import { beeGardenMeta } from "./games/bee-garden/meta";
import { dogParkFetchMeta } from "./games/dog-park-fetch/meta";
import { submarineTreasureDiveMeta } from "./games/submarine-treasure-dive/meta";
import { marsRoverMissionMeta } from "./games/mars-rover-mission/meta";
import { trainStationRushMeta } from "./games/train-station-rush/meta";
import { pizzaKitchen3dMeta } from "./games/pizza-kitchen-3d/meta";
import { jungleBridgeRunMeta } from "./games/jungle-bridge-run/meta";
import { magicCarpetRideMeta } from "./games/magic-carpet-ride/meta";
import { toyStoreNightShiftMeta } from "./games/toy-store-night-shift/meta";
import { aquariumCleanerMeta } from "./games/aquarium-cleaner/meta";
import { postman3dMeta } from "./games/postman-3d/meta";
import { skyTowerJumpMeta } from "./games/sky-tower-jump/meta";
import { rooftopRollClimbMeta } from "./games/rooftop-roll-climb/meta";
import { floodedRuinsEscapeMeta } from "./games/flooded-ruins-escape/meta";
import { lavaPillarJumpMeta } from "./games/lava-pillar-jump/meta";
import { ziplineRushMeta } from "./games/zipline-rush/meta";
import { colorDoorSprintMeta } from "./games/color-door-sprint/meta";
import { cloudHopperMeta } from "./games/cloud-hopper/meta";
import { plateSurfMeta } from "./games/plate-surf/meta";
import { ringJumpChallengeMeta } from "./games/ring-jump-challenge/meta";
import { windTunnelEscapeMeta } from "./games/wind-tunnel-escape/meta";
import { rollCannonJumpMeta } from "./games/roll-cannon-jump/meta";
import { templeLanternJumpMeta } from "./games/temple-lantern-jump/meta";
import { dragonCaveRushMeta } from "./games/dragon-cave-rush/meta";
import { skyHookSwingMeta } from "./games/sky-hook-swing/meta";
import { spinPoleClimbMeta } from "./games/spin-pole-climb/meta";

export const ARCADE_GAMES: ArcadeGameMeta[] = [
   robotCollectorMeta,
   foodCatcherMeta,
   officeEscapeMeta,
   pigeonCrossingMeta,
   penaltyHeroMeta,
   warehouseRushMeta,
   towerClimbMeta,
   cleanCityMeta,
   escapeRoomMeta,
   obstacleRaceMeta,
   treasureIslandMeta,
   museumGuardMeta,
   luggageRushMeta,
   dinoEggRescueMeta,
   deliveryDroneMeta,
   shoppingCartMeta,
   snowballBattleMeta,
   ghostVacuumMeta,
   constructionWorkerMeta,
   alienFarmMeta,
   miniGolfMeta,
   robotFactoryMeta,
   pirateCannonsMeta,
   castleDefenderMeta,
   penguinSlideMeta,
   spaceRepairMeta,
   monsterKitchenMeta,
   knightArenaMeta,
   zooEscapeMeta,
   rocketLandingMeta,
   firefighterRescueMeta,
   taxiRush3dMeta,
   burgerDeliveryScooterMeta,
   beachLifeguardMeta,
   farmTractorChallengeMeta,
   catVsRobotVacuumMeta,
   hotelBellboyRushMeta,
   wizardPotionLabMeta,
   hauntedMansionKeysMeta,
   beeGardenMeta,
   dogParkFetchMeta,
   submarineTreasureDiveMeta,
   marsRoverMissionMeta,
   trainStationRushMeta,
   pizzaKitchen3dMeta,
   jungleBridgeRunMeta,
   magicCarpetRideMeta,
   toyStoreNightShiftMeta,
   aquariumCleanerMeta,
   postman3dMeta,
   skyTowerJumpMeta,
   rooftopRollClimbMeta,
   floodedRuinsEscapeMeta,
   lavaPillarJumpMeta,
   cloudHopperMeta,
   plateSurfMeta,
   ziplineRushMeta,
   ringJumpChallengeMeta,
   windTunnelEscapeMeta,
   rollCannonJumpMeta,
   templeLanternJumpMeta,
   dragonCaveRushMeta,
   colorDoorSprintMeta,
   skyHookSwingMeta,
   spinPoleClimbMeta,
].sort((a, b) => a.order - b.order);

export function getGameMeta(slug: string): ArcadeGameMeta | undefined {
   return ARCADE_GAMES.find((game) => game.slug === slug);
}

export function getLiveGames(): ArcadeGameMeta[] {
   return ARCADE_GAMES.filter((game) => game.status === "live");
}

/** A "dev" game exists only on preview builds (NEXT_PUBLIC_ARCADE_PREVIEW): no card, no route, no sitemap. */
export function isGameVisible(game: ArcadeGameMeta, preview: boolean = ARCADE_PREVIEW): boolean {
   return game.status !== "dev" || preview;
}

/** The games /3d, the hub teaser and the counts show. */
export function getVisibleGames(preview: boolean = ARCADE_PREVIEW): ArcadeGameMeta[] {
   return ARCADE_GAMES.filter((game) => isGameVisible(game, preview));
}

export function gameCollection(game: ArcadeGameMeta): ArcadeCollection {
   return game.collection ?? "originals";
}

/** The visible games grouped by collection, in ARCADE_COLLECTIONS order; empty sections are left out. */
export function getVisibleSections(
   preview: boolean = ARCADE_PREVIEW,
): Array<{ id: ArcadeCollection; title: string; games: ArcadeGameMeta[] }> {
   const visible = getVisibleGames(preview);
   return ARCADE_COLLECTIONS.map((section) => ({
      ...section,
      games: visible.filter((game) => gameCollection(game) === section.id),
   })).filter((section) => section.games.length > 0);
}

export { isLevelId, levelCount, levelMetaFor, levelMetaProblems, levelsOf, maxTotal, scoringFor } from "./levelMeta";

export type { ArcadeGameMeta, ArcadeSlug };
