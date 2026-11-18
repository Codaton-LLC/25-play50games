"use client";

// Canvas textures drawn once per mount (each component disposes its own): the cumulus puff of the
// cloud sea, a soft glow, a spark, a smoke puff. White on transparent where a material tints them.
import { CanvasTexture, SRGBColorSpace } from "three";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
   const c = document.createElement("canvas");
   c.width = w;
   c.height = h;
   return [c, c.getContext("2d")!];
}

function done(c: HTMLCanvasElement, srgb = true): CanvasTexture {
   const t = new CanvasTexture(c);
   if (srgb) t.colorSpace = SRGBColorSpace;
   t.needsUpdate = true;
   return t;
}

/** A soft cumulus puff: a lit white top, a shaded belly, feathered edges. */
export function cloudTexture(variant: number, shade: string): CanvasTexture {
   const [c, g] = canvas(256, 160);
   let s = 1234 + variant * 977;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   const blobs: Array<[number, number, number]> = [];
   for (let i = 0; i < 12; i++) {
      const x = 56 + rnd() * 144;
      const y = 96 + (rnd() - 0.5) * 22 - Math.sin(((x - 56) / 144) * Math.PI) * 30;
      blobs.push([x, y, 20 + rnd() * 24]);
   }
   for (const [x, y, r] of blobs) {
      const grad = g.createRadialGradient(x, y + 10, r * 0.2, x, y + 10, r);
      grad.addColorStop(0, shade);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.globalAlpha = 0.9;
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y + 10, r, 0, Math.PI * 2);
      g.fill();
   }
   g.globalAlpha = 1;
   for (const [x, y, r] of blobs) {
      const grad = g.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r * 0.95);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.6, "rgba(250,252,255,0.85)");
      grad.addColorStop(1, "rgba(240,246,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r * 0.95, 0, Math.PI * 2);
      g.fill();
   }
   return done(c);
}

/** A round soft glow (white; the material tints it). */
export function glowTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
   grad.addColorStop(0, "rgba(255,255,255,1)");
   grad.addColorStop(0.22, "rgba(255,255,255,0.6)");
   grad.addColorStop(0.6, "rgba(255,255,255,0.12)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(0, 0, 128, 128);
   return done(c, false);
}

/** A forked spark: a bright core and jagged white arcs (tinted violet by the material). */
export function sparkTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   let s = 77;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   const core = g.createRadialGradient(64, 64, 0, 64, 64, 30);
   core.addColorStop(0, "rgba(255,255,255,1)");
   core.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = core;
   g.fillRect(0, 0, 128, 128);
   g.strokeStyle = "rgba(255,255,255,0.95)";
   g.lineWidth = 3;
   g.shadowColor = "rgba(255,255,255,1)";
   g.shadowBlur = 8;
   for (let k = 0; k < 6; k++) {
      let x = 64;
      let y = 64;
      const a = (k / 6) * Math.PI * 2 + rnd();
      g.beginPath();
      g.moveTo(x, y);
      for (let n = 0; n < 5; n++) {
         x += Math.cos(a + (rnd() - 0.5) * 1.4) * 11;
         y += Math.sin(a + (rnd() - 0.5) * 1.4) * 11;
         g.lineTo(x, y);
      }
      g.stroke();
   }
   return done(c, false);
}

/** A rolling smoke puff (soft grey, darker core edge). */
export function smokeTexture(): CanvasTexture {
   const [c, g] = canvas(128, 128);
   let s = 31;
   const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
   for (let i = 0; i < 9; i++) {
      const x = 34 + rnd() * 60;
      const y = 34 + rnd() * 60;
      const r = 18 + rnd() * 20;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.75)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
   }
   return done(c, false);
}

/** Wind streaks: thin white dashes on transparent (level 4's gusts). */
export function streakTexture(): CanvasTexture {
   const [c, g] = canvas(256, 32);
   const grad = g.createLinearGradient(0, 0, 256, 0);
   grad.addColorStop(0, "rgba(255,255,255,0)");
   grad.addColorStop(0.5, "rgba(255,255,255,0.9)");
   grad.addColorStop(1, "rgba(255,255,255,0)");
   g.fillStyle = grad;
   g.fillRect(0, 13, 256, 6);
   return done(c, false);
}
