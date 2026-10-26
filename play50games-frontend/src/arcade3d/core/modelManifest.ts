// The GLB files that really exist under public/models/3d. Owned by Claude: every assets PR adds
// one line per GLB it commits (modelManifest.test.ts fails when this list and the folder differ).
// useModel / <Model> only fetch a url listed here. Any other url goes straight to its primitive,
// so a game whose models are not generated yet makes no .glb requests (no 404s, no waiting).
// Plain data, server-safe.

export const MODEL_MANIFEST: readonly string[] = [
   // batch 1 (2026-10-05): Hyper3D Rodin Gen-2.5-Medium, 1500 tris, optimized with tools/hyper3d
   "/models/3d/shared/battery.glb",
   "/models/3d/shared/crate.glb",
   "/models/3d/robot-collector/barrel.glb",
   // robot (2026-10-05): image-to-3D from the ChatGPT concept, Gen-2.5-Medium, 18k tris
   "/models/3d/shared/robot.glb",
   // group A props (2026-10-06): text-to-3D, Gen-2.5-Medium, 1500-3000 tris
   "/models/3d/shared/tinCan.glb",
   "/models/3d/shared/banana.glb",
   "/models/3d/shared/desk.glb",
   "/models/3d/shared/chair.glb",
   "/models/3d/office-escape/printer.glb",
   "/models/3d/office-escape/coffeeCart.glb",
   "/models/3d/office-escape/waterCooler.glb",
   "/models/3d/food-catcher/apple.glb",
   "/models/3d/food-catcher/burger.glb",
   "/models/3d/food-catcher/sock.glb",
   "/models/3d/warehouse-rush/shelfRack.glb",
   "/models/3d/warehouse-rush/pallet.glb",
   "/models/3d/obstacle-race/finishArch.glb",
   // group B characters (2026-10-06): image-to-3D from the ChatGPT concepts (tools/hyper3d/concepts),
   // Gen-2.5-Medium, static T-pose meshes (18k tris, the pigeon 12k), animated by the core auto-rig
   "/models/3d/shared/runner.glb",
   "/models/3d/food-catcher/chef.glb",
   "/models/3d/penalty-hero/striker.glb",
   "/models/3d/penalty-hero/keeper.glb",
   "/models/3d/pigeon-crossing/pigeon.glb",
   // group C props (2026-10-07): text-to-3D, Gen-2.5-Medium, 1500-2500 tris
   "/models/3d/pigeon-crossing/car.glb",
   "/models/3d/pigeon-crossing/taxi.glb",
   "/models/3d/pigeon-crossing/van.glb",
   "/models/3d/clean-city/bottle.glb",
   "/models/3d/clean-city/bag.glb",
   "/models/3d/escape-room/key.glb",
   "/models/3d/escape-room/book.glb",
   "/models/3d/escape-room/door.glb",
   "/models/3d/tower-climb/checkpoint-flag.glb",
   // group D props (2026-10-07): image-to-3D from concepts (tools/hyper3d/concepts), Gen-2.5-Medium,
   // 1000-3000 tris. finishArch.glb (listed above) is replaced in place by the single-arch v2. The
   // penalty-hero ball GLB was removed (2026-10-08): neither generation had black panels, the game
   // draws its BallPrimitive.
   "/models/3d/shared/coin.glb",
   "/models/3d/clean-city/bin.glb",
   "/models/3d/clean-city/bench.glb",
   "/models/3d/clean-city/palm.glb",
   "/models/3d/clean-city/umbrella.glb",
   "/models/3d/clean-city/lamp.glb",
   // clean-city's own character (2026-10-08): image-to-3D, Gen-2.5-Medium, static T-pose, 18k tris,
   // animated by the core auto-rig
   "/models/3d/clean-city/cleaner.glb",
   // expansion batch 1 (2026-10-08): Rodin Gen-2.5-Medium (image-to-3D from concepts or
   // text-to-3D, catalog §E.5), optimized with tools/hyper3d to the catalog's caps (1500-3000 tris;
   // monster and penguin 8k with 1024 px textures); default fits in sharedAssets EXPANSION_ASSETS
   "/models/3d/shared/chest.glb",
   "/models/3d/shared/cannon.glb",
   "/models/3d/shared/rock.glb",
   "/models/3d/shared/fish.glb",
   "/models/3d/shared/pineTree.glb",
   "/models/3d/shared/penguin.glb",
   "/models/3d/pirate-cannons/ship.glb",
   "/models/3d/shopping-cart/cart.glb",
   "/models/3d/luggage-rush/suitcase.glb",
   "/models/3d/monster-kitchen/monster.glb",
   "/models/3d/monster-kitchen/cauldron.glb",
   // expansion batch 2-3 (2026-10-08): the non-humanoid models, Rodin Gen-2.5-Medium, optimized to the
   // catalog's caps (1500-3000 tris; the solid dino 12k and panda 10k with 1024 px textures)
   "/models/3d/shared/dino.glb",
   "/models/3d/shared/leafyTree.glb",
   "/models/3d/shared/castleTower.glb",
   "/models/3d/delivery-drone/drone.glb",
   "/models/3d/rocket-landing/rocket.glb",
   "/models/3d/mini-golf/windmill.glb",
   "/models/3d/ghost-vacuum/ghost.glb",
   "/models/3d/ghost-vacuum/vacuum.glb",
   "/models/3d/knight-arena/dummy.glb",
   "/models/3d/castle-defender/goblin.glb",
   "/models/3d/alien-farm/glowPod.glb",
   "/models/3d/zoo-escape/panda.glb",
   // expansion tier 3 (2026-10-08): class E decor, Rodin Gen-2.5-Medium text-to-3D, 1500-3000 tris, 512 px
   // (shared rock and luggage-rush suitcase were regenerated as v2 in place, same urls)
   "/models/3d/museum-guard/bust.glb",
   "/models/3d/shared/mushroom.glb",
   "/models/3d/luggage-rush/plane.glb",
   "/models/3d/treasure-island/crab.glb",
   "/models/3d/alien-farm/gourd.glb",
   // expansion batch 2-3 characters (2026-10-08): image-to-3D T-pose humanoids, 18k tris, 1024 px,
   // auto-rigged with their committed landmarks (sharedAssets EXPANSION_CHARACTERS)
   "/models/3d/shared/knight.glb",
   "/models/3d/snowball-battle/snowKid.glb",
   "/models/3d/space-repair/astronaut.glb",
   "/models/3d/alien-farm/alien.glb",
   "/models/3d/zoo-escape/keeper.glb",
   // expansion shoppers (2026-10-08): shopping-cart's three faceless shoppers, image-to-3D T-pose
   // humanoids, 18k tris, 1024 px, auto-rigged with their committed landmarks (EXPANSION_CHARACTERS)
   "/models/3d/shopping-cart/shopperA.glb",
   "/models/3d/shopping-cart/shopperB.glb",
   "/models/3d/shopping-cart/shopperC.glb",
   // batch 5 (2026-10-24): text-to-3D, Gen-2.5-Medium, 1500-3000 tris, approved by the user in chat;
   // downloaded and optimized, not adopted by any game yet (each game swaps its primitive in assets.ts)
   "/models/3d/castle-defender/stoneWall.glb",
   "/models/3d/castle-defender/siegeLadder.glb",
   "/models/3d/knight-arena/sword.glb",
   "/models/3d/knight-arena/shield.glb",
   "/models/3d/alien-farm/ufo.glb",
   "/models/3d/space-repair/stationModule.glb",
   "/models/3d/shared/snowman.glb",
   "/models/3d/dino-egg-rescue/volcano.glb",
   "/models/3d/treasure-island/shovel.glb",
   "/models/3d/zoo-escape/bamboo.glb",
   "/models/3d/construction-worker/cementMixer.glb",
   // ghost-vacuum hunter (2026-10-24): image-to-3D from the user's own concept (their face, kept outside git),
   // Gen-2.5-Medium, 18k tris, static T-pose for the core auto-rig
   "/models/3d/ghost-vacuum/hunter.glb",
   "/models/3d/ghost-vacuum/candelabra.glb",
   "/models/3d/rocket-landing/landingPad.glb",
   // zoo-escape props (2026-10-25): batch 5 part A adoptions, Gen-2.5-Medium, 1500-3000 tris,
   // optimized with tools/hyper3d (kiosk and tower bake in their canopy / platform railing)
   "/models/3d/zoo-escape/zooKiosk.glb",
   "/models/3d/zoo-escape/leafyBush.glb",
   "/models/3d/zoo-escape/woodenFootbridge.glb",
   "/models/3d/zoo-escape/searchlightTower.glb",
   "/models/3d/zoo-escape/bambooSnack.glb",
   // P-121 dev adoptions (2026-10-25): V2 replacements and Group D variety whose QA verdict
   // starts with OK. Optimized GLBs copied in; not re-optimized. Live games are untouched.
   "/models/3d/shopping-cart/supermarketShelfV2.glb",
   "/models/3d/shopping-cart/bakeryStand.glb",
   "/models/3d/pirate-cannons/lighthouseV2.glb",
   "/models/3d/delivery-drone/cityBrickApartment.glb",
   "/models/3d/delivery-drone/cityGlassOffice.glb",
   "/models/3d/luggage-rush/duffelBag.glb",
   "/models/3d/luggage-rush/hardCaseTeal.glb",
   "/models/3d/zoo-escape/zooRocks.glb",
   "/models/3d/treasure-island/beachRocks.glb",
   "/models/3d/penguin-slide/iceArch.glb",
   "/models/3d/mini-golf/golfCastle.glb",
   // Menu 1 haunted-mansion-keys (2026-10-25): the ready menu1-haunted-mansion-keys GLBs (wallLeverV2,
   // not wallLever), plus the shared ready furniture; fits measured in
   // games/haunted-mansion-keys/assets.ts. The detective is auto-rigged.
   "/models/3d/haunted-mansion-keys/charDetective.glb",
   "/models/3d/haunted-mansion-keys/skeletonKey.glb",
   "/models/3d/haunted-mansion-keys/mansionDoor.glb",
   "/models/3d/haunted-mansion-keys/wallLeverV2.glb",
   "/models/3d/haunted-mansion-keys/grandfatherClock.glb",
   "/models/3d/haunted-mansion-keys/paintingFrame.glb",
   "/models/3d/haunted-mansion-keys/armourStand.glb",
   "/models/3d/shared/woodenChair.glb",
   "/models/3d/shared/table.glb",
   "/models/3d/shared/bookshelf.glb",
   // Menu 1 beach-lifeguard (2026-10-25): the ready menu1-beach-lifeguard GLBs, copied as optimized.
   // No surfboard (surfboard / surfboardV2 / surfboardLong are a disc, broken or square) and no alertBuoy
   // (the alert stays the spec's code torus); fits in games/beach-lifeguard/assets.ts
   "/models/3d/beach-lifeguard/charLifeguard.glb",
   "/models/3d/beach-lifeguard/lifeguardTower.glb",
   "/models/3d/beach-lifeguard/rescueFloat.glb",
   "/models/3d/beach-lifeguard/beachChair.glb",
   "/models/3d/beach-lifeguard/beachCooler.glb",
   "/models/3d/beach-lifeguard/beachgoerNpc.glb",
   "/models/3d/beach-lifeguard/beachHut.glb",
   "/models/3d/beach-lifeguard/sandcastle.glb",
   "/models/3d/beach-lifeguard/rescueJetSki.glb",
   // Menu 1 pizza-kitchen-3d (2026-10-25): the ready menu1-pizza-kitchen-3d GLBs (mushroomBowlR, prepCounterR,
   // pizzaPeelClean, pizzaBoxClosed; not mushroomBowl / prepCounter / pizzaPeel / pizzaBox / pizzaBoxV2),
   // copied as optimized; fits measured in games/pizza-kitchen-3d/assets.ts
   "/models/3d/pizza-kitchen-3d/pizzaBase.glb",
   "/models/3d/pizza-kitchen-3d/sauceBowl.glb",
   "/models/3d/pizza-kitchen-3d/cheeseBowl.glb",
   "/models/3d/pizza-kitchen-3d/mushroomBowlR.glb",
   "/models/3d/pizza-kitchen-3d/oliveBowl.glb",
   "/models/3d/pizza-kitchen-3d/pepperoni.glb",
   "/models/3d/pizza-kitchen-3d/tomato.glb",
   "/models/3d/pizza-kitchen-3d/onion.glb",
   "/models/3d/pizza-kitchen-3d/pizzaOven.glb",
   "/models/3d/pizza-kitchen-3d/pizzaPeelClean.glb",
   "/models/3d/pizza-kitchen-3d/prepCounterR.glb",
   "/models/3d/pizza-kitchen-3d/pizzaBoxClosed.glb",
   // Menu 1 burger-delivery-scooter (2026-10-25): the ready menu1-burger-delivery-scooter GLBs (V2 box and
   // food; burgerShopI = the text-free shop), copied as optimized; fits in games/burger-delivery-scooter/assets.ts.
   "/models/3d/burger-delivery-scooter/charScooterRider.glb",
   "/models/3d/burger-delivery-scooter/deliveryScooter.glb",
   "/models/3d/burger-delivery-scooter/deliveryBoxV2.glb",
   "/models/3d/burger-delivery-scooter/burgerBag.glb",
   "/models/3d/burger-delivery-scooter/foodBoxV2.glb",
   "/models/3d/burger-delivery-scooter/restaurantCounter.glb",
   "/models/3d/burger-delivery-scooter/burgerShopI.glb",
   "/models/3d/burger-delivery-scooter/roadBarrier.glb",
   "/models/3d/shared/trafficCone.glb",
   // Menu 1 bee-garden (2026-10-25): the ready menu1-bee-garden GLBs (branchV2, not branch), copied as
   // optimized; fits measured in games/bee-garden/assets.ts. The garden mushroom is shared decor.
   "/models/3d/bee-garden/bee.glb",
   "/models/3d/bee-garden/beehive.glb",
   "/models/3d/bee-garden/flowerA.glb",
   "/models/3d/bee-garden/flowerB.glb",
   "/models/3d/bee-garden/flowerC.glb",
   "/models/3d/bee-garden/nectarOrb.glb",
   "/models/3d/bee-garden/bigLeaf.glb",
   "/models/3d/bee-garden/branchV2.glb",
   "/models/3d/bee-garden/spiderWeb.glb",
   "/models/3d/bee-garden/vegetablePlanter.glb",
   "/models/3d/bee-garden/wateringCan.glb",
   "/models/3d/shared/gardenMushroom.glb",
   // hotel-bellboy-rush (2026-10-25): the Hyper3D ready set (menu1-hotel-bellboy-rush/, ledger OK or
   // adopted as the spec says), optimized GLBs copied in, not re-optimized; the bellboy is a static
   // T-pose for the core auto-rig. sofa and travellerNpc are the shared ready set (also for 31 / 44).
   "/models/3d/hotel-bellboy-rush/charBellboy.glb",
   "/models/3d/hotel-bellboy-rush/bellboyTrolley.glb",
   "/models/3d/hotel-bellboy-rush/elevatorDoorV2.glb",
   "/models/3d/hotel-bellboy-rush/hotelRoomDoor.glb",
   "/models/3d/hotel-bellboy-rush/keyCard.glb",
   "/models/3d/hotel-bellboy-rush/receptionDesk.glb",
   "/models/3d/hotel-bellboy-rush/serviceBellV2.glb",
   "/models/3d/hotel-bellboy-rush/lobbyPlanterR.glb",
   "/models/3d/shared/sofa.glb",
   "/models/3d/shared/travellerNpc.glb",
   // submarine-treasure-dive (gate, 2026-10-25): menu1 ready set, optimized
   "/models/3d/submarine-treasure-dive/miniSubmarine.glb",
   "/models/3d/submarine-treasure-dive/amphora.glb",
   "/models/3d/submarine-treasure-dive/anchor.glb",
   "/models/3d/submarine-treasure-dive/pearlShellV2.glb",
   "/models/3d/submarine-treasure-dive/rockArch.glb",
   "/models/3d/submarine-treasure-dive/ruinColumn.glb",
   "/models/3d/submarine-treasure-dive/shipwreckI.glb",
   "/models/3d/submarine-treasure-dive/jellyfish.glb",
   "/models/3d/submarine-treasure-dive/subDock.glb",
   "/models/3d/submarine-treasure-dive/coralI.glb",
   "/models/3d/submarine-treasure-dive/coralBranch.glb",
   "/models/3d/submarine-treasure-dive/seaweedKelp.glb",
   "/models/3d/submarine-treasure-dive/tropicalFish.glb",
   "/models/3d/submarine-treasure-dive/aquariumRock.glb",
   // Menu 1 jungle-bridge-run (2026-10-25): the ready menu1-jungle-bridge-run GLBs (templePillarV2 and
   // ruinGateR, not the V1s; jungleLogSingle, jungleFern and volcanoBackdrop from the still-needed list are
   // in the ready folder now), copied as optimized; fits in games/jungle-bridge-run/assets.ts. The explorer
   // is a static T-pose for the core auto-rig. jungleLog (two logs) and junglePlant (potted) are not used.
   "/models/3d/jungle-bridge-run/charExplorer.glb",
   "/models/3d/jungle-bridge-run/woodenBridge.glb",
   "/models/3d/jungle-bridge-run/ropeBridge.glb",
   "/models/3d/jungle-bridge-run/jungleRock.glb",
   "/models/3d/jungle-bridge-run/templePillarV2.glb",
   "/models/3d/jungle-bridge-run/waterfallCliff.glb",
   "/models/3d/jungle-bridge-run/ruinGateR.glb",
   "/models/3d/jungle-bridge-run/jungleLogSingle.glb",
   "/models/3d/jungle-bridge-run/jungleFern.glb",
   "/models/3d/jungle-bridge-run/volcanoBackdrop.glb",
   "/models/3d/jungle-bridge-run/hangingVine.glb",
   // Menu 1 taxi-rush-3d (2026-10-25): the ready menu1-taxi-rush-3d GLBs and the shared traffic light and
   // cone, copied as optimized; fits measured in games/taxi-rush-3d/assets.ts.
   "/models/3d/taxi-rush-3d/taxiCab.glb",
   "/models/3d/taxi-rush-3d/townhouseBlock.glb",
   "/models/3d/taxi-rush-3d/cornerShop.glb",
   "/models/3d/taxi-rush-3d/busStop.glb",
   "/models/3d/shared/trafficLight.glb",
];

const LISTED: ReadonlySet<string> = new Set(MODEL_MANIFEST);

/** Is there a GLB at this url (public/models/3d/...)? */
export function hasModel(url: string): boolean {
   return LISTED.has(url);
}
