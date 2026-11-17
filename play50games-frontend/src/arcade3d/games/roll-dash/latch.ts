// A tag chosen outside the canvas loop (the HUD's portrait strip) waits here until the Simulation
// (Scene.tsx / MultiScene.tsx) hands it to the rules: 1-5 (HERO_IDS order), 0 = none.
export const tagLatch = { tag: 0 };
