"use client";

// Canvas textures for the terrain cells (browser only): soft soil, packed soil, rock, ore, cracked
// rock, ghost rock, gas, rubble, bedrock and the tunnel back wall. Seeded, so every visit looks the
// same; 128 px, drawn once per mount and disposed by the owner.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { MineLook } from "./look";

function rng(seed: number) {
   let s = seed >>> 0 || 1;
   return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function canvas(size = 128): [HTMLCanvasElement, CanvasRenderingContext2D] {
   const c = document.createElement("canvas");
   c.width = size;
   c.height = size;
   return [c, c.getContext("2d")!];
}

function finish(c: HTMLCanvasElement, srgb = true): CanvasTexture {
   const t = new CanvasTexture(c);
   if (srgb) t.colorSpace = SRGBColorSpace;
   t.wrapS = t.wrapT = RepeatWrapping;
   t.anisotropy = 4;
   t.needsUpdate = true;
   return t;
}

function grain(g: CanvasRenderingContext2D, r: () => number, base: string, dark: string, n: number, size: [number, number]) {
   g.fillStyle = base;
   g.fillRect(0, 0, 128, 128);
   for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.15 + r() * 0.35;
      g.fillStyle = r() < 0.5 ? dark : "#ffffff";
      const s = size[0] + r() * (size[1] - size[0]);
      g.beginPath();
      g.arc(r() * 128, r() * 128, s, 0, Math.PI * 2);
      g.fill();
   }
   g.globalAlpha = 1;
}

/** A bevelled rim: light on the top-left, shade on the bottom-right (sells the chunky cube). */
function rim(g: CanvasRenderingContext2D, light = 0.22, shade = 0.35) {
   const grad = g.createLinearGradient(0, 0, 128, 128);
   grad.addColorStop(0, `rgba(255,255,255,${light})`);
   grad.addColorStop(0.18, "rgba(255,255,255,0)");
   grad.addColorStop(0.82, "rgba(0,0,0,0)");
   grad.addColorStop(1, `rgba(0,0,0,${shade})`);
   g.fillStyle = grad;
   g.fillRect(0, 0, 128, 128);
   g.strokeStyle = `rgba(0,0,0,${shade * 0.8})`;
   g.lineWidth = 4;
   g.strokeRect(2, 2, 124, 124);
}

function pebbles(g: CanvasRenderingContext2D, r: () => number, color: string, n: number) {
   for (let i = 0; i < n; i++) {
      const x = r() * 128;
      const y = r() * 128;
      const s = 3 + r() * 6;
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.beginPath();
      g.ellipse(x - s * 0.3, y - s * 0.3, s * 0.35, s * 0.25, 0, 0, Math.PI * 2);
      g.fill();
   }
}

function stones(g: CanvasRenderingContext2D, r: () => number, base: string, dark: string, line: string) {
   g.fillStyle = dark;
   g.fillRect(0, 0, 128, 128);
   // irregular stone blocks
   const rows = 3;
   for (let y = 0; y < rows; y++) {
      let x = -r() * 30;
      const h = 128 / rows;
      while (x < 128) {
         const wdt = 34 + r() * 30;
         g.fillStyle = base;
         g.globalAlpha = 0.85 + r() * 0.15;
         const pad = 3;
         g.beginPath();
         g.roundRect(x + pad, y * h + pad, wdt - pad * 2, h - pad * 2, 8);
         g.fill();
         g.globalAlpha = 0.35;
         g.fillStyle = line;
         g.beginPath();
         g.roundRect(x + pad + 3, y * h + pad + 2, wdt - pad * 2 - 6, 5, 3);
         g.fill();
         g.globalAlpha = 1;
         x += wdt;
      }
   }
}

function cracks(g: CanvasRenderingContext2D, r: () => number, color: string, width: number, n: number) {
   g.strokeStyle = color;
   g.lineWidth = width;
   g.lineCap = "round";
   for (let k = 0; k < n; k++) {
      let x = 20 + r() * 88;
      let y = 20 + r() * 88;
      g.beginPath();
      g.moveTo(x, y);
      for (let i = 0; i < 6; i++) {
         x += (r() - 0.5) * 46;
         y += (r() - 0.5) * 46;
         g.lineTo(Math.max(4, Math.min(124, x)), Math.max(4, Math.min(124, y)));
      }
      g.stroke();
   }
}

export interface TerrainTextures {
   soft: CanvasTexture;
   packed: CanvasTexture;
   rock: CanvasTexture;
   ore: CanvasTexture;
   oreGlow: CanvasTexture;
   cracked: CanvasTexture;
   crackedGlow: CanvasTexture;
   ghost: CanvasTexture;
   gas: CanvasTexture;
   rubble: CanvasTexture;
   bedrock: CanvasTexture;
   back: CanvasTexture;
   dispose(): void;
}

export function terrainTextures(look: MineLook, seed = 7): TerrainTextures {
   const r = rng(seed);
   const make = (draw: (g: CanvasRenderingContext2D) => void, srgb = true) => {
      const [c, g] = canvas();
      draw(g);
      return finish(c, srgb);
   };
   const soft = make((g) => {
      grain(g, r, look.soil.soft, look.soil.softDark, 260, [1, 3]);
      pebbles(g, r, look.soil.softDark, 7);
      rim(g, 0.18, 0.3);
   });
   const packed = make((g) => {
      grain(g, r, look.soil.packed, look.soil.packedDark, 200, [1, 2.5]);
      // compressed strata
      for (let i = 0; i < 6; i++) {
         g.strokeStyle = i % 2 ? look.soil.packedDark : "rgba(255,255,255,0.12)";
         g.lineWidth = 2 + r() * 3;
         g.beginPath();
         const y = 10 + i * 20 + r() * 6;
         g.moveTo(0, y);
         for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + (r() - 0.5) * 6);
         g.stroke();
      }
      pebbles(g, r, look.rock.dark, 4);
      rim(g, 0.15, 0.4);
   });
   const rock = make((g) => {
      stones(g, r, look.rock.base, look.rock.dark, look.rock.line);
      cracks(g, r, "rgba(0,0,0,0.35)", 2, 2);
      rim(g, 0.2, 0.45);
   });
   const oreVeins = (g: CanvasRenderingContext2D, color: string, w: number) => {
      const rr = rng(seed + 99);
      cracks(g, rr, color, w, 3);
      for (let i = 0; i < 6; i++) {
         g.fillStyle = color;
         g.beginPath();
         g.arc(20 + rr() * 88, 20 + rr() * 88, 3 + rr() * 5, 0, Math.PI * 2);
         g.fill();
      }
   };
   const ore = make((g) => {
      stones(g, r, look.rock.dark, "#1c1716", look.rock.base);
      oreVeins(g, "#7a1408", 6);
      oreVeins(g, look.ore, 3);
      rim(g, 0.15, 0.45);
   });
   const oreGlow = make((g) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, 128, 128);
      oreVeins(g, look.ore, 4);
   });
   const cracked = make((g) => {
      stones(g, r, look.rock.base, look.rock.dark, look.rock.line);
      cracks(g, rng(seed + 5), "#1a1412", 5, 4);
      rim(g, 0.2, 0.45);
   });
   const crackedGlow = make((g) => {
      g.fillStyle = "#000";
      g.fillRect(0, 0, 128, 128);
      cracks(g, rng(seed + 5), "#ff7a2a", 2, 4);
   });
   const ghost = make((g) => {
      stones(g, r, "#3b2f4f", "#211a2e", "#6b5a8a");
      cracks(g, rng(seed + 11), "#c084fc", 2.5, 5);
      rim(g, 0.15, 0.4);
   });
   const gas = make((g) => {
      grain(g, r, "#3f4a2c", "#25301a", 150, [1, 3]);
      for (let i = 0; i < 9; i++) {
         const grd = g.createRadialGradient(0, 0, 0, 0, 0, 10);
         const x = 14 + r() * 100;
         const y = 14 + r() * 100;
         g.save();
         g.translate(x, y);
         grd.addColorStop(0, "rgba(190,255,90,0.9)");
         grd.addColorStop(1, "rgba(120,200,40,0)");
         g.fillStyle = grd;
         g.beginPath();
         g.arc(0, 0, 10, 0, Math.PI * 2);
         g.fill();
         g.restore();
      }
      rim(g, 0.12, 0.4);
   });
   const rubble = make((g) => {
      g.fillStyle = "#4a4441";
      g.fillRect(0, 0, 128, 128);
      pebbles(g, r, "#77706b", 22);
      pebbles(g, r, "#2f2a28", 10);
      rim(g, 0.1, 0.5);
   });
   const bedrock = make((g) => {
      stones(g, r, "#2c2827", "#151312", "#3c3735");
      rim(g, 0.08, 0.5);
   });
   const back = make((g) => {
      grain(g, r, look.back, "#000000", 300, [1, 4]);
      cracks(g, r, "rgba(0,0,0,0.4)", 2, 3);
   });
   const all = [soft, packed, rock, ore, oreGlow, cracked, crackedGlow, ghost, gas, rubble, bedrock, back];
   return { soft, packed, rock, ore, oreGlow, cracked, crackedGlow, ghost, gas, rubble, bedrock, back, dispose: () => all.forEach((t) => t.dispose()) };
}
