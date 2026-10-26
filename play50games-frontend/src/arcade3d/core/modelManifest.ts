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
   // space-repair decor (2026-10-25): comms dish prop for levels 4-5 (External Platform /
   // Station Emergency), drawn by games/space-repair only there; 1500 tris
   "/models/3d/space-repair/satelliteDish.glb",
   "/models/3d/shared/snowman.glb",
   "/models/3d/dino-egg-rescue/volcano.glb",
   "/models/3d/treasure-island/shovel.glb",
   "/models/3d/zoo-escape/bamboo.glb",
   "/models/3d/construction-worker/cementMixer.glb",
   // ghost-vacuum hunter (2026-10-24): image-to-3D from the user's own concept (their face, kept outside git),
   // Gen-2.5-Medium, 18k tris, static T-pose for the core auto-rig
   "/models/3d/ghost-vacuum/hunter.glb",
   "/models/3d/ghost-vacuum/candelabra.glb",
   // ghost-vacuum attic trunk (2026-10-25): K-g2 decor for levels 4-5 (Attic / Whole Mansion)
   "/models/3d/ghost-vacuum/atticTrunk.glb",
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
   "/models/3d/treasure-island/jungleTotem.glb",
   "/models/3d/penguin-slide/iceArch.glb",
   // penguin-slide level 4-5 decor (2026-10-25): Group D adoptions, Gen-2.5-Medium, 1500-3000 tris,
   // optimized with tools/hyper3d; drawn only on Aurora Run (4) and Glacier Sprint (5)
   "/models/3d/penguin-slide/auroraCrystal.glb",
   "/models/3d/penguin-slide/glacierChunk.glb",
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
   // postman-3d (2026-10-26): the ready menu1-postman-3d set (holidayTree included, now ready), copied as
   // optimized; the postman is a static T-pose for the core auto-rig. trafficLight is the
   // shared ready set, the dog is menu1-dog-park-fetch's (shared with dog-park-fetch).
   "/models/3d/postman-3d/charPostman.glb",
   "/models/3d/postman-3d/letter.glb",
   "/models/3d/postman-3d/mailbag.glb",
   "/models/3d/postman-3d/mailbox.glb",
   "/models/3d/postman-3d/houseA.glb",
   "/models/3d/postman-3d/houseB.glb",
   "/models/3d/postman-3d/houseC.glb",
   "/models/3d/postman-3d/postOffice.glb",
   "/models/3d/postman-3d/postVan.glb",
   "/models/3d/postman-3d/streetLampVictorian.glb",
   "/models/3d/postman-3d/bicycle.glb",
   "/models/3d/postman-3d/holidayTree.glb",
   "/models/3d/shared/trafficLight.glb",
   "/models/3d/shared/dog.glb",
   // aquarium-cleaner (2026-10-25): menu1 ready set + shared coralI, optimized, character 18k tris
   "/models/3d/aquarium-cleaner/charDiver.glb",
   "/models/3d/aquarium-cleaner/aquariumScrubber.glb",
   "/models/3d/aquarium-cleaner/plasticBottle.glb",
   "/models/3d/aquarium-cleaner/tropicalFish.glb",
   "/models/3d/aquarium-cleaner/aquariumCastle.glb",
   "/models/3d/aquarium-cleaner/aquariumRock.glb",
   "/models/3d/aquarium-cleaner/filterMachineV3.glb",
   "/models/3d/aquarium-cleaner/scubaTank.glb",
   "/models/3d/aquarium-cleaner/shark.glb",
   "/models/3d/aquarium-cleaner/trashBasket.glb",
   "/models/3d/aquarium-cleaner/coralI.glb",
   // train-station-rush (2026-10-25): the Hyper3D ready set (menu1-train-station-rush/, the V2
   // carriage), optimized GLBs copied in, not re-optimized; the worker is a static T-pose for the core
   // auto-rig. Left out: trainCar.glb (tram proportions), locomotive.glb (a whole train set).
   "/models/3d/train-station-rush/charStationWorker.glb",
   "/models/3d/train-station-rush/trainCarV2.glb",
   "/models/3d/train-station-rush/platformCanopy.glb",
   "/models/3d/train-station-rush/platformSign.glb",
   "/models/3d/train-station-rush/stationBench.glb",
   "/models/3d/train-station-rush/stationClock.glb",
   "/models/3d/train-station-rush/stationTrolley.glb",
   "/models/3d/train-station-rush/backpack.glb",
   "/models/3d/train-station-rush/ticketMachine.glb",
   // toy-store-night-shift (2026-10-25): menu1 ready set, optimized, characters 18k tris
   "/models/3d/toy-store-night-shift/charNightGuard.glb",
   "/models/3d/toy-store-night-shift/toyShelfSolidT.glb",
   "/models/3d/toy-store-night-shift/teddyBear.glb",
   "/models/3d/toy-store-night-shift/toyCar.glb",
   "/models/3d/toy-store-night-shift/toyAirplane.glb",
   "/models/3d/toy-store-night-shift/toyBall.glb",
   "/models/3d/toy-store-night-shift/toyBlocksPlainT.glb",
   "/models/3d/toy-store-night-shift/toyTrain.glb",
   "/models/3d/toy-store-night-shift/toyRobotProp.glb",
   "/models/3d/toy-store-night-shift/toyRobot.glb",
   "/models/3d/toy-store-night-shift/toyBin.glb",
   "/models/3d/toy-store-night-shift/toyBinPlush.glb",
   // Menu 1 cat-vs-robot-vacuum (2026-10-25): the ready menu1-cat-vs-robot-vacuum set (catTreeR, and the
   // regenerated catTreatFish / catToyPlush instead of the flagged originals) plus the shared furniture
   // (bed, table, bookshelfFull, woodenChair); optimized GLBs copied in, fits in the game's assets.ts.
   "/models/3d/cat-vs-robot-vacuum/cat.glb",
   "/models/3d/cat-vs-robot-vacuum/robotVacuum.glb",
   "/models/3d/cat-vs-robot-vacuum/catTreatFish.glb",
   "/models/3d/cat-vs-robot-vacuum/catToyPlush.glb",
   "/models/3d/cat-vs-robot-vacuum/catBox.glb",
   "/models/3d/cat-vs-robot-vacuum/catTreeR.glb",
   "/models/3d/shared/bed.glb",
   "/models/3d/shared/bookshelfFull.glb",
   // Menu 1 mars-rover-mission (2026-10-25): the ready menu1-mars-rover-mission GLBs (ledger OK; not marsRoverV2,
   // groundSolarPanel or the broken ancientMarsRuin), copied as optimized; fits measured in its assets.ts.
   // The astronaut is a static T-pose for the core auto-rig (ASTRONAUT_LANDMARKS).
   "/models/3d/mars-rover-mission/marsRover.glb",
   "/models/3d/mars-rover-mission/marsBase.glb",
   "/models/3d/mars-rover-mission/commsAntenna.glb",
   "/models/3d/mars-rover-mission/groundSolarPanelV2.glb",
   "/models/3d/mars-rover-mission/chargingStation.glb",
   "/models/3d/mars-rover-mission/sampleRock.glb",
   "/models/3d/mars-rover-mission/beaconLight.glb",
   "/models/3d/mars-rover-mission/researchCrate.glb",
   "/models/3d/mars-rover-mission/landingCapsule.glb",
   "/models/3d/mars-rover-mission/charAstronaut.glb",
   "/models/3d/mars-rover-mission/marsMesaRock.glb",
   "/models/3d/mars-rover-mission/marsBoulder.glb",
   "/models/3d/mars-rover-mission/marsMesaTall.glb",
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
   // wizard-potion-lab (gate, 2026-10-25): menu1 ready set, optimized
   "/models/3d/wizard-potion-lab/charWizard.glb",
   "/models/3d/wizard-potion-lab/alchemyTable.glb",
   "/models/3d/wizard-potion-lab/magicCrystal.glb",
   "/models/3d/wizard-potion-lab/berryBunch.glb",
   "/models/3d/wizard-potion-lab/magicFlower.glb",
   "/models/3d/wizard-potion-lab/herbBundle.glb",
   "/models/3d/wizard-potion-lab/potionBottle.glb",
   "/models/3d/wizard-potion-lab/spellBook.glb",
   "/models/3d/wizard-potion-lab/candle.glb",
   "/models/3d/wizard-potion-lab/crystalBall.glb",
   "/models/3d/wizard-potion-lab/bookshelfFull.glb",
   // magic-carpet-ride (gate, 2026-10-25): menu1 ready set, optimized
   "/models/3d/magic-carpet-ride/charCarpetRider.glb",
   "/models/3d/magic-carpet-ride/magicCarpet.glb",
   "/models/3d/magic-carpet-ride/flyingRing.glb",
   "/models/3d/magic-carpet-ride/palaceTower.glb",
   "/models/3d/magic-carpet-ride/desertRooftopV2.glb",
   "/models/3d/magic-carpet-ride/cloud.glb",
   "/models/3d/magic-carpet-ride/hangingLantern.glb",
   "/models/3d/magic-carpet-ride/canyonMesa.glb",
   "/models/3d/magic-carpet-ride/floatingPalaceR.glb",
   "/models/3d/magic-carpet-ride/floatingRockV3.glb",
   "/models/3d/magic-carpet-ride/star.glb",
   // farm-tractor-challenge (gate, 2026-10-25): menu1 ready set, optimized
   "/models/3d/farm-tractor-challenge/charFarmer.glb",
   "/models/3d/farm-tractor-challenge/tractor.glb",
   "/models/3d/farm-tractor-challenge/farmTrailer.glb",
   "/models/3d/farm-tractor-challenge/hayBaleBound.glb",
   "/models/3d/farm-tractor-challenge/appleCrate.glb",
   "/models/3d/farm-tractor-challenge/barn.glb",
   "/models/3d/farm-tractor-challenge/farmFence.glb",
   "/models/3d/farm-tractor-challenge/farmGate.glb",
   "/models/3d/farm-tractor-challenge/scarecrowPost.glb",
   "/models/3d/farm-tractor-challenge/grainSiloGroundT.glb",
   "/models/3d/farm-tractor-challenge/waterTrough.glb",
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
   // snowball-battle village decor (2026-10-25): extra Hyper3D props drawn only on levels 4-5
   // (Ice Village, Championship Arena), behind the yard's far fence
   "/models/3d/snowball-battle/igloo.glb",
   "/models/3d/snowball-battle/snowmanBig.glb",
   // dino-egg-rescue lava rock (2026-10-25): batch-5 companion decor (Hyper3D), drawn only on
   // the volcanic levels 4-5 (Volcanic Pass / Dino Sanctuary) outside the play bounds
   "/models/3d/dino-egg-rescue/lavaRock.glb",
   // rocket-landing habitat dome (2026-10-25): batch 5 adoption, Gen-2.5-Medium, ~5.8k tris;
   // outpost decor drawn only on levels 4-5 (rocket-landing HABITAT_DOME_SPOTS)
   "/models/3d/rocket-landing/habitatDome.glb",
   // shopping-cart props (2026-10-25): batch 5 part A adoptions, Gen-2.5-Medium, 1500-3000 tris,
   // optimized GLBs copied in, not re-optimized; the floor scrubber is level 4-5 decor only
   "/models/3d/shopping-cart/floorScrubber.glb",
   // monster-kitchen slimeCake (2026-10-25): extra floor decor drawn only on levels 4 and 5
   // (Dinner Rush / Grand Feast), Gen-2.5-Medium, optimized with tools/hyper3d
   "/models/3d/monster-kitchen/slimeCake.glb",
   // robot-factory (2026-10-25): powerCore decor on levels 4 and 5
   "/models/3d/robot-factory/powerCore.glb",
   // zoo-escape extra decor (levels 4-5)
   "/models/3d/zoo-escape/zooFountain.glb",
];

const LISTED: ReadonlySet<string> = new Set(MODEL_MANIFEST);

/** Is there a GLB at this url (public/models/3d/...)? */
export function hasModel(url: string): boolean {
   return LISTED.has(url);
}
