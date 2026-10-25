# Menu 1 games 31–50: Hyper3D models still needed

Status: 2026-10-25. The union of the "Hyper3D still needed" lists in `specs-31-40.md` and `specs-41-50.md`: props (and two characters) the games need that are not usable in `%USERPROFILE%\.play50\hyper3d\ready\` yet. Checked against the ready folders and the review notes in `%USERPROFILE%\.play50\hyper3d\archive2\LEDGER.md`. An item marked "regen" exists on disk but is wrong (text on it, a baked-in animal, the wrong object, a broken mesh); every other item is new.

Every game builds without these: each has a deliberate bevelled two-tone code stand-in (`<Model fallback>`) until the GLB lands. Credits are spent only after the user approves a batch in chat (CLAUDE.md standing decision 6).

How to generate (CLAUDE.md "Hyper3D (Rodin) pipeline"): props text-to-3D, Gen-2.5-Medium, Raw, `quality_override` 1500 (3000 for buildings and large set pieces); characters image-to-3D from a concept image, 18000. Output to `ready/menu1-<slug>/<id>.glb` (shared items to `ready/shared/`). Append this style to every prop prompt: "premium stylized mobile game prop, rounded bevelled edges, clean silhouette, matte / satin materials, no text, no logos, no characters or animals on it, plain light-grey background". Characters: "full body, clean T-pose, arms straight and level, legs apart, nothing touching the body, plain light-grey background".

51 items: 47 props, 2 creatures, 2 characters. 32 are regenerations of a file that is on disk but wrong; 19 are new.

| # | id | game(s) | kind | prompt idea |
|---|---|---|---|---|
| 1 | `exitSignFigure` | firefighter-rescue | regen (prop) | Green emergency exit sign box, a white running-figure pictogram and an arrow, thick lightbox body, wall bracket. |
| 2 | `fallingDebris` | firefighter-rescue | prop | A charred ceiling beam with a broken plaster chunk, short and chunky, reads as debris sliding across a hall. |
| 3 | `passengerNpc` | taxi-rush-3d, hotel-bellboy-rush, train-station-rush | character (image-to-3D) | Stylised friendly traveller with a small backpack, casual coat, clearly cartoon-proportioned (not photoreal), T-pose. |
| 4 | `scooterDeliveryBox` | burger-delivery-scooter | regen (prop) | Square insulated food delivery box for a scooter rear rack, lid closed, side vents, a mounting plate underneath, no wheels, no handle. |
| 5 | `foodBoxClosed` | burger-delivery-scooter | regen (prop) | Closed cardboard burger clamshell box, lid shut, a simple burger icon embossed, nothing spilling out. |
| 6 | `burgerShopPlain` | burger-delivery-scooter | regen (prop) | Small corner burger restaurant building, awning, big window, a 3D burger sculpture on the roof instead of any lettering. |
| 7 | `restaurantCounterPlain` | burger-delivery-scooter | regen (prop) | Takeaway service counter with a till and a pick-up shelf, plain sign panel without letters. |
| 8 | `surfboardLong` | beach-lifeguard | regen (prop) | One long single surfboard, pointed nose, a centre stripe and a fin, solid thickness (not paper thin), lying flat. |
| 9 | `alertBuoy` | beach-lifeguard | prop | Floating red-and-white ring buoy on a short bobbing float with a small warning flag, reads from above as an alert marker. |
| 10 | `hayBaleBound` | farm-tractor-challenge | regen (prop) | Round hay bale with smooth rolled straw and two visible twine bands, clean surface (no crumpled facets). |
| 11 | `grainSiloGround` | farm-tractor-challenge | regen (prop) | Corrugated metal grain silo standing directly on a concrete ring base (no legs, no stilts), conical cap, side ladder. |
| 12 | `scarecrowPost` | farm-tractor-challenge | regen (prop) | Scarecrow on a wooden cross post, arms straight out on the crossbar, straw hat, patched shirt, no legs. |
| 13 | `catTreatFish` | cat-vs-robot-vacuum | regen (prop) | A small fish-shaped cat treat biscuit, chunky, clearly a fish silhouette (tail and head). |
| 14 | `catToyPlush` | cat-vs-robot-vacuum | regen (prop) | Soft plush mouse cat toy, simple felt shape with stitched ears and a short thick tail, no face details. |
| 15 | `elevatorDoorsSliding` | hotel-bellboy-rush | regen (prop) | Pair of brass hotel elevator sliding doors in a frame, closed, a floor indicator above and a call button panel beside, thick frame. |
| 16 | `keyCardPlain` | hotel-bellboy-rush | regen (prop) | Hotel key card, plain coloured face with a simple stripe and chip, no text or symbols, slight thickness. |
| 17 | `bellboyTrolleyV2` | hotel-bellboy-rush | regen (prop) | Classic brass hotel luggage trolley, a clean arched hanging rail, red carpeted base, four wheels, solid bars (not wiry). |
| 18 | `bookshelfFull` | cat-vs-robot-vacuum, wizard-potion-lab, haunted-mansion-keys | regen (prop, shared) | Wooden bookshelf filled with rows of books, a few lying flat, every shelf full. |
| 19 | `wallLeverArm` | haunted-mansion-keys | regen (prop) | Antique iron wall lever: a back plate with a long lever arm and a round handle knob, arm tilted up, clearly pullable. |
| 20 | `spiderWebFrame` | bee-garden | regen (prop) | A clean round spider web strung inside a twig ring, intact radial threads and spiral, readable from above. |
| 21 | `charDogOwner` | dog-park-fetch | character (image-to-3D) | Friendly park visitor in a hoodie and sneakers holding nothing, stylised proportions, T-pose (the owner who throws). |
| 22 | `parkBush` | dog-park-fetch | prop | Rounded leafy park bush, dense foliage, a few small flowers, low and wide. |
| 23 | `dogHouseEmpty` | dog-park-fetch | regen (prop) | Wooden dog kennel with a pitched roof and an empty arched doorway, no dog inside or near it. |
| 24 | `lawnMower` | dog-park-fetch | prop | Ride-on lawn mower, chunky and toy-like, bright green body, big rear wheels, no driver. |
| 25 | `festivalTent` | dog-park-fetch | prop | Small striped festival gazebo tent with bunting along the edge, open sides. |
| 26 | `coralBranch` | submarine-treasure-dive, aquarium-cleaner | regen (prop, shared) | Branching coral with smooth rounded tubes, pink and orange, on a small rock base (no shards). |
| 27 | `seaweedKelp` | submarine-treasure-dive, aquarium-cleaner | regen (prop, shared) | A cluster of tall wavy kelp strands with broad soft blades, rooted on a stone. |
| 28 | `shipwreckSideways` | submarine-treasure-dive | regen (prop) | Old wooden shipwreck hull lying on its side on the sand, broken planks and a hole, a snapped mast. |
| 29 | `subDock` | submarine-treasure-dive | prop | Underwater docking station: a round platform with guide lights, a short pylon and a charging arm. |
| 30 | `jellyfish` | submarine-treasure-dive | creature | Translucent-looking stylised jellyfish, domed bell, short soft tentacles, one solid mesh. |
| 31 | `marsBoulder` | mars-rover-mission | prop | Round rust-red Mars boulder, roughly spherical so it reads as rolling, cratered surface. |
| 32 | `ancientMarsRuin` | mars-rover-mission | prop | Weathered alien stone pillars in a half ring, eroded glyph-free carvings, rust-red dust on top. |
| 33 | `marsMesaTall` | mars-rover-mission | prop | Flat-topped layered Mars mesa, tall cliff sides, rust and ochre strata. |
| 34 | `locomotiveFront` | train-station-rush | prop | One modern passenger train engine car only (no carriages attached), rounded nose, windows, matching a long low carriage. |
| 35 | `ticketMachineClean` | train-station-rush | regen (prop) | Navy station ticket machine with a blank glowing screen, a card slot and buttons, no text or logos. |
| 36 | `pizzaBoxClosed` | pizza-kitchen-3d | regen (prop) | Flat closed cardboard pizza box, lid fully shut, no pizza visible. |
| 37 | `pizzaPeelClean` | pizza-kitchen-3d | regen (prop) | Plain wooden pizza peel with a long handle and a bevelled blade, nothing on it. |
| 38 | `jungleLogSingle` | jungle-bridge-run | regen (prop) | One single round mossy jungle log with cut ends, reads as rolling. |
| 39 | `hangingVineV2` | jungle-bridge-run | regen (prop) | A thick twisted rope vine hanging in a shallow U between two points, leaves along it (no shards). |
| 40 | `jungleFern` | jungle-bridge-run | prop | A wild broad-leaf jungle fern cluster growing from the ground, no pot. |
| 41 | `volcanoBackdrop` | jungle-bridge-run | prop | Stylised jungle volcano with a glowing orange crater and lava streaks, green slopes at the base. |
| 42 | `floatingRockV3` | magic-carpet-ride | regen (prop) | Floating island rock: flat grassy top, pointed rocky underside like an inverted cone, nothing on top. |
| 43 | `toyShelfEmpty` | toy-store-night-shift | regen (prop) | Bright toy-store shelf unit with three empty shelves and a header panel, nothing on the shelves. |
| 44 | `toyBlocksPlain` | toy-store-night-shift | regen (prop) | A neat stack of four wooden toy blocks in primary colours, plain faces with no letters. |
| 45 | `toyBinPlush` | toy-store-night-shift | regen (prop) | Round toy bin overflowing with soft plush toys, nothing scattered around the base. |
| 46 | `filterMachineV3` | aquarium-cleaner | regen (prop) | Chunky aquarium filter machine: a box unit with two pipes into the sand, a round pressure gauge and a green status light. |
| 47 | `bubbleStationV3` | aquarium-cleaner | regen (prop) | Aquarium air station: a stone air-stone base with a hose running to a small pump, no dome. |
| 48 | `scubaTank` | aquarium-cleaner | prop | Single yellow scuba air tank with a valve and harness straps, to wear on the back. |
| 49 | `shark` | aquarium-cleaner | creature | Friendly stylised shark, rounded body, closed smile, one solid mesh, swimming pose. |
| 50 | `trashBasket` | aquarium-cleaner | prop | Underwater mesh collection basket with a rigid rim and a handle, empty. |
| 51 | `holidayTree` | postman-3d | prop | Small decorated street holiday tree in a planter, round ornaments and a star, light strings. |

Creatures (`jellyfish`, `shark`) are unrigged `<Model>`s driven by `core/motion`. `passengerNpc` and `charDogOwner` are image-to-3D from a ChatGPT concept (3/4 front, T-pose, light-grey background, 1024 × 1024); neither shows the user's face, so their concepts may be committed to `tools/hyper3d/concepts/`.

Also on disk and better than what the 31–40 asset index adopts (no generation needed, the assets PR just picks the newer file): `catTreeR.glb` (no cats baked in) over `catTree.glb`; `lobbyPlanterR.glb` (a rectangular wooden planter) over `lobbyPlanter.glb`; `grainSiloR.glb` is closer than `grainSilo.glb` until `grainSiloGround` exists.
