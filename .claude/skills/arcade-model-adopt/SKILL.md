---
name: arcade-model-adopt
description: Fit a newly imported GLB into the 3D Arcade (scale, stretch, rotationY, yOffset, material, collision-consistent size test) and, for humanoid characters, measure and commit auto-rig landmarks with a character test. Use right after a GLB is optimized and listed in core/modelManifest.ts.
---

# Arcade model adoption

## Inputs
The GLB (listed in `core/modelManifest.ts`), its row in `05-hyper3d-catalog.md` §E.4 (target size, orientation, collision) and §E.5 (fit and checks), the game's rules constants (collision radii, slot sizes).

## Props and solid creatures
1. Read the GLB bounds (node transforms applied): `rig/robotGlb.ts` `readCharacterGlb(url)` or a throwaway `@gltf-transform` script.
2. `scale` = target size / measured size on the axis that matters (height for characters and trees, length for vehicles); `stretch` (near 1) only to fix Rodin's proportions; `rotationY` so the front faces +z; `yOffset` so the base sits on y = 0.
3. Where the catalog says so: `material` override or a per-copy tint check (light base).
4. Measure the points the game needs (muzzle, hook, rotor centres, leg tips, tunnel opening, egg surface) and put them in the game's `assets.ts` as named constants with a comment "measured from <file> <date>".
5. Size test (`<asset>.test.ts` in the game, or `sharedAssets` test for shared): rendered bounds within 2 % of the target, facing +z, base on the floor, inside the collision shape the rules use (or the documented visual-only overhang).
6. Screenshot under the game's lighting preset next to its primitive stand-in.

## Humanoids (auto-rig)
Follow `core/README.md` "Landmarks, and measuring a character" exactly:
1. Positions → height profile per 2 cm band.
2. `estimateHumanoidLandmarks` for a start.
3. Posed preview in a scratch page outside the repo (rest, arms down, walk at 4 phases side view, carry, cheer, reach; front, side, close-up).
4. Tune by eye with the known fixes: sleeves → `armRadius`; helmets and big heads → `headY` at the top of the neck + `neckBlend`; boots → `ankleY` above the boot top; tabards/aprons above the knee → `hemY` (skirt weights); joggers/shorts reading as a hem → `hemY = crotchY`; sparse shoulders → set `shoulderX`.
5. Commit `<NAME>_LANDMARKS` on the asset, comment every field set by eye.
6. Character test with `rig/characterChecks.ts` `describeCharacter`: bind pose = static GLB, hands beside the hips with the arms down, nothing below the floor, planted foot within 1 cm through a walk, head rigid, skirt stretch < 2× if any.
7. Height in GLB units → each game's `scale` for its target height; a test pins the drawn height in metres.

## Validation checklist
- [ ] No game logic changed; only `assets.ts` / `sharedAssets.ts` and tests.
- [ ] The primitive fallback still works (unlisted URL test or manifest gating).
- [ ] Screenshots attached; numbers in comments, not magic.

## Reuse
Every GLB of the expansion (27 + tier 3).
