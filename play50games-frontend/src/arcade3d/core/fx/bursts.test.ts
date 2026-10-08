import { describe, expect, it } from "vitest";
import {
   BURST_KINDS,
   BURST_STYLES,
   clearParticles,
   createParticlePool,
   emitBurst,
   particleScale,
   stepParticles,
} from "./bursts";
import { addShake, clearShake, createShake, stepShake, SHAKE_MAX_OFFSET } from "./cameraShake";

describe("particle pools", () => {
   it("has a style for every kind", () => {
      for (const kind of BURST_KINDS) {
         const style = BURST_STYLES[kind];
         expect(style.capacity).toBeGreaterThan(0);
         expect(style.colors.length).toBeGreaterThan(0);
         expect(style.life[0]).toBeLessThanOrEqual(style.life[1]);
      }
   });

   it("emits at the position, packed at the front", () => {
      const pool = createParticlePool(16, 7);
      expect(emitBurst(pool, BURST_STYLES.sparkle, 1, 2, 3, 5)).toBe(5);
      expect(pool.count).toBe(5);
      for (let i = 0; i < 5; i++) {
         expect(Math.hypot(pool.px[i] - 1, pool.py[i] - 2, pool.pz[i] - 3)).toBeLessThanOrEqual(BURST_STYLES.sparkle.jitter + 1e-6);
         expect(pool.life[i]).toBeGreaterThanOrEqual(BURST_STYLES.sparkle.life[0] - 1e-6);
      }
   });

   it("is deterministic for a seed", () => {
      const a = createParticlePool(8, 42);
      const b = createParticlePool(8, 42);
      emitBurst(a, BURST_STYLES.debris, 0, 0, 0, 8);
      emitBurst(b, BURST_STYLES.debris, 0, 0, 0, 8);
      expect(Array.from(a.vx)).toEqual(Array.from(b.vx));
      expect(Array.from(a.color)).toEqual(Array.from(b.color));
   });

   it("never grows past its capacity: a full pool reuses slots", () => {
      const pool = createParticlePool(4);
      emitBurst(pool, BURST_STYLES.puff, 0, 0, 0, 3);
      expect(emitBurst(pool, BURST_STYLES.puff, 5, 0, 0, 10)).toBe(4);
      expect(pool.count).toBe(4);
      expect(pool.px.length).toBe(4);
   });

   it("cone kinds start upwards", () => {
      const pool = createParticlePool(64, 3);
      emitBurst(pool, BURST_STYLES.splash, 0, 0, 0, 64);
      for (let i = 0; i < 64; i++) expect(pool.vy[i]).toBeGreaterThan(0);
   });

   it("steps, applies gravity and drops dead particles", () => {
      const pool = createParticlePool(32, 9);
      emitBurst(pool, BURST_STYLES.debris, 0, 0, 0, 20);
      const vy0 = pool.vy[0];
      stepParticles(pool, BURST_STYLES.debris, 0.1);
      expect(pool.vy[0]).toBeLessThan(vy0);
      expect(pool.count).toBe(20);
      for (let k = 0; k < 20; k++) stepParticles(pool, BURST_STYLES.debris, 0.1);
      expect(pool.count).toBe(0);
   });

   it("is frozen at dt 0 (pause)", () => {
      const pool = createParticlePool(8, 1);
      emitBurst(pool, BURST_STYLES.smoke, 0, 0, 0, 4);
      const x = pool.px[0];
      stepParticles(pool, BURST_STYLES.smoke, 0);
      expect(pool.px[0]).toBe(x);
      expect(pool.age[0]).toBe(0);
   });

   it("keeps every survivor exactly once when some die", () => {
      const pool = createParticlePool(8, 5);
      emitBurst(pool, BURST_STYLES.sparks, 0, 0, 0, 8);
      // make every other particle die on the next step
      for (let i = 0; i < 8; i++) pool.life[i] = i % 2 === 0 ? 0.01 : 10;
      for (let i = 0; i < 8; i++) pool.angle[i] = i;
      stepParticles(pool, { ...BURST_STYLES.sparks, spin: 0 }, 0.05);
      expect(pool.count).toBe(4);
      const kept = Array.from(pool.life.subarray(0, 4)).every((life) => life === 10);
      expect(kept).toBe(true);
      clearParticles(pool);
      expect(pool.count).toBe(0);
   });

   it("scales from the start size and shrinks to 0 at the end", () => {
      const style = BURST_STYLES.smoke;
      expect(particleScale(style, 0)).toBeCloseTo(style.size[0], 6);
      expect(particleScale(style, 1)).toBe(0);
      expect(particleScale(style, 0.5)).toBeGreaterThan(0);
   });
});

describe("camera shake", () => {
   it("adds trauma up to 1 and decays to rest", () => {
      const s = createShake();
      addShake(s, 0.6, false);
      addShake(s, 0.6, false);
      expect(s.trauma).toBe(1);
      stepShake(s, 0.016);
      expect(Math.hypot(s.x, s.y)).toBeLessThanOrEqual(SHAKE_MAX_OFFSET);
      for (let i = 0; i < 100; i++) stepShake(s, 0.016);
      expect(s.trauma).toBe(0);
      expect(s.x).toBe(0);
      expect(s.y).toBe(0);
   });

   it("does nothing with reduced motion or a non-positive amount", () => {
      const s = createShake();
      addShake(s, 1, true);
      addShake(s, -1, false);
      addShake(s, Number.NaN, false);
      expect(s.trauma).toBe(0);
   });

   it("keeps its trauma while frozen", () => {
      const s = createShake();
      addShake(s, 0.5, false);
      stepShake(s, 0);
      expect(s.trauma).toBe(0.5);
      clearShake(s);
      expect(s.trauma).toBe(0);
   });
});
