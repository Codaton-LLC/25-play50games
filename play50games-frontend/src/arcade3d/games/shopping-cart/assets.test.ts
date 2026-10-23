import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { ASSETS, PRODUCT_KINDS, RUNNER_SCALE } from "./assets";

describe("shopping-cart model assets", () => {
   it("all models used by the game exist in the model manifest", () => {
      for (const [name, asset] of Object.entries(ASSETS)) {
         expect(hasModel(asset.url), `${name}: ${asset.url}`).toBe(true);
      }
   });

   it("has valid scale configuration for pusher runner", () => {
      expect(RUNNER_SCALE).toBeCloseTo(0.825, 3);
      expect(ASSETS.pusher.scale).toBe(RUNNER_SCALE);
      expect(ASSETS.pusher.humanoid).toBeDefined();
   });

   it("contains all 10 product kinds with valid model URLs", () => {
      expect(PRODUCT_KINDS).toHaveLength(10);
      for (const kind of PRODUCT_KINDS) {
         expect(ASSETS[kind]).toBeDefined();
         expect(typeof ASSETS[kind].url).toBe("string");
         expect(ASSETS[kind].url.length).toBeGreaterThan(0);
         expect(hasModel(ASSETS[kind].url)).toBe(true);
      }
   });

   it("defines all shopper NPC characters and cart", () => {
      expect(hasModel(ASSETS.cart.url)).toBe(true);
      expect(hasModel(ASSETS.shopperA.url)).toBe(true);
      expect(hasModel(ASSETS.shopperB.url)).toBe(true);
      expect(hasModel(ASSETS.shopperC.url)).toBe(true);
   });
});
