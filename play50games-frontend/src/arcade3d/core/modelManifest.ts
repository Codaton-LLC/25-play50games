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
   // 1000-3000 tris. finishArch.glb (listed above) is replaced in place by the single-arch v2.
   "/models/3d/penalty-hero/ball.glb",
   "/models/3d/shared/coin.glb",
   "/models/3d/clean-city/bin.glb",
   "/models/3d/clean-city/bench.glb",
   "/models/3d/clean-city/palm.glb",
   "/models/3d/clean-city/umbrella.glb",
   "/models/3d/clean-city/lamp.glb",
   // clean-city's own character (2026-10-08): image-to-3D, Gen-2.5-Medium, static T-pose, 18k tris,
   // animated by the core auto-rig
   "/models/3d/clean-city/cleaner.glb",
];

const LISTED: ReadonlySet<string> = new Set(MODEL_MANIFEST);

/** Is there a GLB at this url (public/models/3d/...)? */
export function hasModel(url: string): boolean {
   return LISTED.has(url);
}
