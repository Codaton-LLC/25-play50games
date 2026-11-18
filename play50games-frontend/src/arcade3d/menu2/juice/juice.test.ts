// Menu 2 juice, the pure parts: pooled particles, glyph popups, the camera kick, hit-stop and the
// squash helpers.
import { describe, expect, it } from "vitest";
import { JUICE_KINDS, JUICE_STYLES, clearJuice, createJuicePool, emitCount, emitJuice, juiceKindIndex, juiceSize, parseColor, stepJuice } from "./particles";
import {
   ATLAS_COLS,
   ATLAS_ROWS,
   GLYPH_ASPECT,
   GLYPH_COUNT,
   POPUP_LIFE,
   POPUP_MAX_CHARS,
   POPUP_RISE,
   POPUP_SLOTS,
   createPopupPool,
   emitPopup,
   glyphCell,
   glyphIndex,
   liveGlyphs,
   popupLook,
   stepPopups,
} from "./popups";
import { KICK_MAX, cameraKickActive, clearCameraKick, createCameraKick, kickCamera, shakeCamera, stepCameraKick } from "./cameraKick";
import { HIT_STOP_MAX_MS, HIT_STOP_SCALE, createHitStop, hitStop, hitStopScale, stepHitStop } from "./hitStop";
import { airStretch, createSpring, forwardStretch, kickSpring, landSquash, popScale, stepSpring, volumeScale } from "./squash";

describe("particles", () => {
   it("six kinds, each in one of the two looks (the two draw calls)", () => {
      expect(JUICE_KINDS).toEqual(["pickup", "dust", "trail", "checkpoint", "hit", "aura"]);
      for (const k of JUICE_KINDS) expect(["glow", "soft"]).toContain(JUICE_STYLES[k].look);
      expect(JUICE_STYLES.dust.look).toBe("soft");
   });

   it("emits into the pool, packs alive ones at the front, and reuses the oldest when full", () => {
      const pool = createJuicePool(16, 7);
      expect(emitJuice(pool, "pickup", 1, 2, 3, 10)).toBe(10);
      expect(pool.count).toBe(10);
      for (let i = 0; i < 10; i++) {
         expect(Math.hypot(pool.px[i] - 1, pool.py[i] - 2, pool.pz[i] - 3)).toBeLessThanOrEqual(JUICE_STYLES.pickup.jitter + 1e-6);
         expect(pool.kind[i]).toBe(juiceKindIndex("pickup"));
      }
      emitJuice(pool, "dust", 0, 0, 0, 10);
      expect(pool.count).toBe(16);
      expect(pool.cursor).toBe(4);
      expect(emitJuice(pool, "dust", 0, 0, 0, 100)).toBe(16);
   });

   it("a given colour paints every particle; otherwise the style's palette", () => {
      const pool = createJuicePool(8);
      emitJuice(pool, "aura", 0, 0, 0, 8, { color: "#2563eb" });
      for (let i = 0; i < 8; i++) {
         expect(pool.r[i]).toBeCloseTo(0x25 / 255, 6);
         expect(pool.g[i]).toBeCloseTo(0x63 / 255, 6);
         expect(pool.b[i]).toBeCloseTo(0xeb / 255, 6);
      }
      expect(parseColor("#fff")).toBe(0xffffff);
      expect(parseColor("#ef4444")).toBe(0xef4444);
   });

   it("dust rolls out flat; a checkpoint fountains up; inherited velocity is added", () => {
      const pool = createJuicePool(64, 3);
      emitJuice(pool, "dust", 0, 0, 0, 20);
      for (let i = 0; i < 20; i++) expect(Math.abs(pool.vy[i])).toBeLessThan(0.5);
      clearJuice(pool);
      emitJuice(pool, "checkpoint", 0, 0, 0, 20);
      for (let i = 0; i < 20; i++) expect(pool.vy[i]).toBeGreaterThan(0);
      clearJuice(pool);
      emitJuice(pool, "trail", 0, 0, 0, 10, { vx: 5 });
      for (let i = 0; i < 10; i++) expect(pool.vx[i]).toBeGreaterThan(4.5);
   });

   it("steps each kind by its own gravity and drag, drops the dead, freezes at dt 0, allocates nothing", () => {
      const pool = createJuicePool(32, 9);
      const arrays = [pool.px, pool.vx, pool.age, pool.kind];
      emitJuice(pool, "checkpoint", 0, 0, 0, 8);
      emitJuice(pool, "aura", 0, 0, 0, 8);
      const y = Array.from(pool.py.slice(0, 16));
      stepJuice(pool, 0);
      expect(Array.from(pool.py.slice(0, 16))).toEqual(y);
      for (let k = 0; k < 10; k++) stepJuice(pool, 1 / 60);
      expect(pool.count).toBe(16);
      for (let k = 0; k < 200; k++) stepJuice(pool, 1 / 60);
      expect(pool.count).toBe(0);
      expect([pool.px, pool.vx, pool.age, pool.kind]).toEqual(arrays);
   });

   it("sizes grow or shrink over the life and end at 0", () => {
      for (const k of JUICE_KINDS) {
         const i = juiceKindIndex(k);
         expect(juiceSize(i, 0)).toBeCloseTo(JUICE_STYLES[k].size[0], 9);
         expect(juiceSize(i, 1)).toBe(0);
      }
   });

   it("a steady emitter emits rate x time in whole particles, carrying the fraction", () => {
      const carry = { left: 0 };
      let n = 0;
      for (let k = 0; k < 60; k++) n += emitCount(carry, 25, 1 / 60);
      expect(n).toBeGreaterThanOrEqual(24);
      expect(n).toBeLessThanOrEqual(25);
      expect(emitCount(carry, 25, 0)).toBe(0);
   });
});

describe("popups", () => {
   it("the atlas holds printable ASCII; anything else draws as '?'", () => {
      expect(ATLAS_COLS * ATLAS_ROWS).toBeGreaterThanOrEqual(GLYPH_COUNT);
      expect(glyphIndex(" ".charCodeAt(0))).toBe(0);
      expect(glyphIndex("~".charCodeAt(0))).toBe(94);
      expect(glyphIndex(0x00e9)).toBe(glyphIndex("?".charCodeAt(0)));
      expect(glyphCell(17, { col: 0, row: 0 })).toEqual({ col: 1, row: 1 });
   });

   it("lays out a text centred on its anchor, cut at 16 characters", () => {
      const pool = createPopupPool();
      const i = emitPopup(pool, 1, 2, 3, "+200", 0xffd257, 0.06);
      const slot = pool.slots[i];
      expect(slot.length).toBe(4);
      expect(slot.offsets[0]).toBeCloseTo(-1.5 * GLYPH_ASPECT, 6);
      expect(slot.offsets[3]).toBeCloseTo(1.5 * GLYPH_ASPECT, 6);
      expect(slot.r).toBeCloseTo(0xff / 255, 6);
      emitPopup(pool, 0, 0, 0, "a very long checkpoint message", 0xffffff, 0.06);
      expect(liveGlyphs(pool)).toBe(4 + POPUP_MAX_CHARS);
      // per-glyph advances (measured from the font) are honoured
      const adv = new Float32Array(GLYPH_COUNT).fill(0.5);
      const j = emitPopup(pool, 0, 0, 0, "ab", 0xffffff, 0.06, adv);
      expect(pool.slots[j].offsets[0]).toBeCloseTo(-0.25, 6);
   });

   it("reuses the oldest slot when all 12 are busy, and frees them after their life", () => {
      const pool = createPopupPool();
      for (let k = 0; k < POPUP_SLOTS; k++) emitPopup(pool, 0, 0, 0, `${k}`, 0xffffff, 0.06);
      const again = emitPopup(pool, 0, 0, 0, "new", 0xffffff, 0.06);
      expect(again).toBe(0);
      for (let k = 0; k < 60; k++) stepPopups(pool, 1 / 60);
      expect(liveGlyphs(pool)).toBe(0);
   });

   it("rises with an ease-out, pops 0.6 -> 1.2 -> 1, fades in the last 40 %", () => {
      const look = { rise: 0, opacity: 0, pop: 0 };
      popupLook(0, look);
      expect(look.rise).toBe(0);
      expect(look.pop).toBeCloseTo(0.6, 6);
      popupLook(0.1 * POPUP_LIFE, look);
      expect(look.pop).toBeCloseTo(1.2, 6);
      popupLook(0.5 * POPUP_LIFE, look);
      expect(look.pop).toBe(1);
      expect(look.opacity).toBe(1);
      popupLook(POPUP_LIFE, look);
      expect(look.rise).toBeCloseTo(POPUP_RISE, 6);
      expect(look.opacity).toBe(0);
   });
});

describe("camera kick and shake", () => {
   it("a kick shoves the camera along its direction, overshoots a little and settles back to 0", () => {
      const k = createCameraKick();
      kickCamera(k, 0, -2, 0, 4);
      let low = 0;
      let high = 0;
      for (let i = 0; i < 120; i++) {
         stepCameraKick(k, 1 / 60);
         low = Math.min(low, k.offset.y);
         high = Math.max(high, k.offset.y);
         expect(Math.abs(k.offset.y)).toBeLessThanOrEqual(KICK_MAX);
         expect(k.offset.x).toBe(0);
      }
      expect(low).toBeLessThan(-0.05);
      expect(high).toBeGreaterThan(0);
      expect(high).toBeLessThan(-low * 0.3);
      expect(Math.abs(k.offset.y)).toBeLessThan(1e-3);
   });

   it("a shake wobbles along the camera's right and up and decays; reduced motion turns both off", () => {
      const k = createCameraKick();
      shakeCamera(k, 0.5);
      stepCameraKick(k, 1 / 60);
      expect(Math.abs(k.shakeRight) + Math.abs(k.shakeUp)).toBeGreaterThan(0);
      for (let i = 0; i < 60; i++) stepCameraKick(k, 1 / 60);
      expect(k.shakeRight).toBe(0);
      expect(cameraKickActive(k)).toBe(false);
      const r = createCameraKick();
      kickCamera(r, 1, 0, 0, 5, true);
      shakeCamera(r, 1, true);
      stepCameraKick(r, 1 / 60);
      expect(cameraKickActive(r)).toBe(false);
      kickCamera(r, 1, 0, 0, 5);
      clearCameraKick(r);
      expect(cameraKickActive(r)).toBe(false);
   });

   it("dt 0 keeps the offset (a paused game holds still)", () => {
      const k = createCameraKick();
      kickCamera(k, 1, 0, 0, 5);
      stepCameraKick(k, 1 / 60);
      const x = k.offset.x;
      stepCameraKick(k, 0);
      expect(k.offset.x).toBe(x);
   });
});

describe("hit-stop", () => {
   it("dips the visual dt to 6 %, eases back in its last 40 ms and ends after its length in real time", () => {
      const h = createHitStop();
      hitStop(h, 100);
      const dt = 1 / 120;
      let visual = 0;
      let real = 0;
      while (h.leftMs > 0) {
         visual += stepHitStop(h, dt);
         real += dt;
      }
      expect(Math.abs(real - 0.1)).toBeLessThanOrEqual(dt + 1e-9);
      expect(visual).toBeLessThan(real * 0.5);
      expect(visual).toBeGreaterThan(real * HIT_STOP_SCALE * 0.99);
      expect(stepHitStop(h, dt)).toBe(dt);
      expect(hitStopScale(0)).toBe(1);
      expect(hitStopScale(100)).toBe(HIT_STOP_SCALE);
   });

   it("is capped, takes the longer of two requests, is off with reduced motion, and frozen at dt 0", () => {
      const h = createHitStop();
      hitStop(h, 5000);
      expect(h.leftMs).toBe(HIT_STOP_MAX_MS);
      hitStop(h, 20);
      expect(h.leftMs).toBe(HIT_STOP_MAX_MS);
      expect(stepHitStop(h, 0)).toBe(0);
      expect(h.leftMs).toBe(HIT_STOP_MAX_MS);
      const r = createHitStop();
      r.reducedMotion = true;
      hitStop(r, 100);
      expect(r.leftMs).toBe(0);
   });

   it("never touches the rules' dt: the run clock's frames sum the same with any number of hit-stops", () => {
      // the rules step by the frame dt; only the visuals read stepHitStop's result
      const h = createHitStop();
      let rules = 0;
      let visual = 0;
      for (let i = 0; i < 600; i++) {
         if (i % 50 === 0) hitStop(h, 120);
         const dt = 1 / 60;
         visual += stepHitStop(h, dt);
         rules += dt;
      }
      expect(rules).toBeCloseTo(10, 9);
      expect(visual).toBeLessThan(rules);
   });
});

describe("squash and stretch", () => {
   it("volumeScale and forwardStretch keep the volume", () => {
      const s = { x: 0, y: 0, z: 0 };
      for (const v of [0.7, 1, 1.25]) {
         volumeScale(v, s);
         expect(s.x * s.y * s.z).toBeCloseTo(1, 9);
         forwardStretch(v, s);
         expect(s.x * s.y * s.z).toBeCloseTo(1, 9);
         expect(s.z).toBeCloseTo(v, 9);
      }
   });

   it("a spring settles on its target, is stable on a long frame, and a kick swings it", () => {
      const s = createSpring();
      kickSpring(s, -3);
      for (let i = 0; i < 120; i++) stepSpring(s, 0, 6, 0.4, 1 / 60);
      expect(Math.abs(s.x)).toBeLessThan(1e-3);
      stepSpring(s, 1, 6, 0.4, 0.25);
      expect(Number.isFinite(s.x)).toBe(true);
      expect(Math.abs(s.x)).toBeLessThan(2);
   });

   it("air stretch grows with speed (capped), the land squash dips and settles, the pop overshoots then rests at 1", () => {
      expect(airStretch(0)).toBe(1);
      expect(airStretch(10)).toBeCloseTo(1.1, 9);
      expect(airStretch(100)).toBeCloseTo(1.14, 9);
      expect(landSquash(0, 1)).toBeCloseTo(0.72, 9);
      expect(landSquash(0.6, 1)).toBeGreaterThan(0.99);
      expect(landSquash(0, 0)).toBe(1);
      expect(popScale(0)).toBe(0);
      expect(popScale(0.15)).toBeCloseTo(1.18, 6);
      expect(popScale(0.25)).toBe(1);
   });
});
