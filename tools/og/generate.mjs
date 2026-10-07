// Builds the static Open Graph cards (1200x630) into play50games-frontend/public/images/og.
// Sharp is a tool dependency only. Do not add it to play50games-frontend.
// Run from the repo root: node tools/og/generate.mjs
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "play50games-frontend/public/images/og");
const W = 1200;
const H = 630;
const BG = "#0b1020";
const ACCENT = "#7dd3fc";
const TEXT = "rgba(255,255,255,0.92)";
const MUTED = "rgba(255,255,255,0.70)";
const FONT = "Segoe UI, Arial, sans-serif";
const MAX_BYTES = 200 * 1024;

const GAMES = [
   { slug: "robot-collector", title: "Robot Collector" },
   { slug: "food-catcher", title: "Food Catcher 3D" },
   { slug: "office-escape", title: "Office Escape" },
   { slug: "pigeon-crossing", title: "Pigeon Crossing" },
   { slug: "penalty-hero", title: "Penalty Hero" },
   { slug: "warehouse-rush", title: "Warehouse Rush" },
   { slug: "tower-climb", title: "Tower Climb" },
   { slug: "clean-city", title: "Clean the City" },
   { slug: "escape-room", title: "Tiny Escape Room" },
   { slug: "obstacle-race", title: "Obstacle Race" },
];

const FRAME = { x: 48, y: 48, w: 534, h: 534, r: 28 };

function esc(value) {
   return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
}

function svg(body) {
   return Buffer.from(
      `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
   );
}

function wordmark(x, y, size = 22) {
   return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="600">
      <tspan fill="${ACCENT}">3D Arcade</tspan>
      <tspan fill="rgba(255,255,255,0.45)">  |  </tspan>
      <tspan fill="${TEXT}">Play50Games</tspan>
   </text>`;
}

function background() {
   return svg(`
      <rect width="${W}" height="${H}" fill="${BG}"/>
      <radialGradient id="glow" cx="18%" cy="0%" r="70%">
         <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.16"/>
         <stop offset="70%" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ACCENT}"/>
   `);
}

function titleSize(title) {
   const width = title.length * 0.56;
   if (width * 52 <= 500) return 52;
   if (width * 44 <= 500) return 44;
   return 38;
}

function gameOverlay(title) {
   const size = titleSize(title);
   const x = FRAME.x + FRAME.w + 48;
   return svg(`
      <rect x="${FRAME.x}" y="${FRAME.y}" width="${FRAME.w}" height="${FRAME.h}" rx="${FRAME.r}" fill="none" stroke="${ACCENT}" stroke-opacity="0.55" stroke-width="2"/>
      <text x="${x}" y="250" fill="${TEXT}" font-family="${FONT}" font-size="${size}" font-weight="700">${esc(title)}</text>
      <rect x="${x}" y="274" width="72" height="4" rx="2" fill="${ACCENT}"/>
      ${wordmark(x, 330)}
   `);
}

function towerArt() {
   const { x, y, w, h, r } = FRAME;
   const bars = [
      [70, 430, 250],
      [150, 360, 220],
      [90, 290, 260],
      [180, 220, 200],
      [110, 150, 240],
      [200, 80, 180],
   ];
   const platforms = bars.map(([bx, by, bw], i) => {
      const fill = i % 2 === 0 ? ACCENT : "rgba(255,255,255,0.88)";
      return `<rect x="${x + bx}" y="${y + by}" width="${bw}" height="16" rx="8" fill="${fill}"/>`;
   }).join("");
   return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#12182c" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
      ${platforms}
      <circle cx="${x + 250}" cy="${y + 64}" r="14" fill="${ACCENT}"/>
   `;
}

function hubSvg() {
   return svg(`
      <rect width="${W}" height="${H}" fill="${BG}"/>
      <radialGradient id="glow" cx="80%" cy="20%" r="65%">
         <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.18"/>
         <stop offset="75%" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <text x="72" y="210" fill="${ACCENT}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3">PLAY50GAMES</text>
      <text x="72" y="300" fill="${TEXT}" font-family="${FONT}" font-size="64" font-weight="700">Classic brain games</text>
      <text x="72" y="376" fill="${TEXT}" font-family="${FONT}" font-size="64" font-weight="700">and a 3D Arcade</text>
      <text x="72" y="440" fill="${MUTED}" font-family="${FONT}" font-size="26" font-weight="600">50 classic games. 10 mini-games. Free in your browser.</text>
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ACCENT}"/>
   `);
}

function classicSvg() {
   return svg(`
      <rect width="${W}" height="${H}" fill="${BG}"/>
      <radialGradient id="glow" cx="0%" cy="100%" r="70%">
         <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.14"/>
         <stop offset="70%" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <text x="72" y="150" fill="${ACCENT}" font-family="${FONT}" font-size="22" font-weight="600" letter-spacing="3">PLAY50GAMES</text>
      <text x="72" y="390" fill="${ACCENT}" font-family="${FONT}" font-size="220" font-weight="700">50</text>
      <text x="430" y="300" fill="${TEXT}" font-family="${FONT}" font-size="54" font-weight="700">Play Classic</text>
      <text x="430" y="370" fill="${TEXT}" font-family="${FONT}" font-size="54" font-weight="700">50 Games</text>
      <text x="430" y="430" fill="${MUTED}" font-family="${FONT}" font-size="26" font-weight="600">Unlock them one by one. Earn your certificate.</text>
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ACCENT}"/>
   `);
}

function arcadeSvg() {
   return svg(`
      <rect width="${W}" height="${H}" fill="${BG}"/>
      <radialGradient id="glow" cx="100%" cy="0%" r="70%">
         <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.18"/>
         <stop offset="70%" stop-color="${ACCENT}" stop-opacity="0"/>
      </radialGradient>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      ${wordmark(72, 150, 26)}
      <text x="72" y="320" fill="${TEXT}" font-family="${FONT}" font-size="84" font-weight="700">3D Arcade</text>
      <rect x="72" y="348" width="72" height="4" rx="2" fill="${ACCENT}"/>
      <text x="72" y="420" fill="${MUTED}" font-family="${FONT}" font-size="28" font-weight="600">10 mini-games. No unlocks. Your own best score.</text>
      <rect x="0" y="${H - 6}" width="${W}" height="6" fill="${ACCENT}"/>
   `);
}

function thumbPath(slug) {
   return path.join(ROOT, "play50games-frontend/public/images/3d", `${slug}.webp`);
}

function readThumb(slug) {
   const file = thumbPath(slug);
   if (existsSync(file)) return readFileSync(file);
   const ref = `origin/cursor/game-${slug}-scene:play50games-frontend/public/images/3d/${slug}.webp`;
   return execFileSync("git", ["show", ref], { cwd: ROOT, maxBuffer: 20_000_000 });
}

async function roundedThumb(input) {
   const mask = Buffer.from(
      `<svg width="${FRAME.w}" height="${FRAME.h}" xmlns="http://www.w3.org/2000/svg"><rect width="${FRAME.w}" height="${FRAME.h}" rx="${FRAME.r}" fill="#fff"/></svg>`,
   );
   return sharp(input)
      .resize(FRAME.w, FRAME.h, { fit: "cover", position: "centre" })
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();
}

async function flatten(layers) {
   const base = await sharp(background()).png().toBuffer();
   return sharp(base).composite(layers).png().toBuffer();
}

async function writeCard(name, pixels) {
   const dest = path.join(OUT, name);
   mkdirSync(path.dirname(dest), { recursive: true });
   let chosen = null;
   for (const colors of [128, 96, 64, 48]) {
      const buf = await sharp(pixels)
         .png({ compressionLevel: 9, palette: true, quality: 80, effort: 10, colors })
         .toBuffer();
      if (buf.length <= MAX_BYTES) {
         chosen = buf;
         break;
      }
   }
   if (!chosen) throw new Error(`${name} is over ${MAX_BYTES} bytes`);
   writeFileSync(dest, chosen);
   const meta = await sharp(chosen).metadata();
   if (meta.width !== W || meta.height !== H) throw new Error(`${name} is ${meta.width}x${meta.height}`);
   console.log(`${name}  ${meta.width}x${meta.height}  ${(chosen.length / 1024).toFixed(1)} KB`);
}

async function gameCard(game) {
   const layers = [];
   if (game.slug === "tower-climb") {
      layers.push({ input: svg(towerArt()), left: 0, top: 0 });
   } else {
      const thumb = await roundedThumb(readThumb(game.slug));
      layers.push({ input: thumb, left: FRAME.x, top: FRAME.y });
   }
   layers.push({ input: gameOverlay(game.title), left: 0, top: 0 });
   await writeCard(path.join("3d", `${game.slug}.png`), await flatten(layers));
}

async function main() {
   await writeCard("hub.png", await sharp(hubSvg()).png().toBuffer());
   await writeCard("classic.png", await sharp(classicSvg()).png().toBuffer());
   await writeCard("arcade.png", await sharp(arcadeSvg()).png().toBuffer());
   for (const game of GAMES) await gameCard(game);
}

main().catch((error) => {
   console.error(error);
   process.exit(1);
});
