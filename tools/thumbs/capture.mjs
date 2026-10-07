// Capture real in-game thumbnails for the 10 3D Arcade games.
// Launches Chrome headless, drives it over the DevTools protocol (ws, no puppeteer),
// plays each game a few seconds with a per-game input script, hides the HTML overlays,
// screenshots the canvas, post-processes with sharp (16:9, 640x360, webp <= 60 KB).
//
// Usage:
//   node capture.mjs [--base-url http://localhost:3100] [--slugs a,b,c] [--out dir] [--write]
// Exit code = number of failed games.

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import WebSocket from "ws";
import { INPUT_SCRIPTS } from "./inputs.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PUBLIC = path.resolve(HERE, "../../play50games-frontend/public");

const DEFAULT_SLUGS = [
   "robot-collector",
   "food-catcher",
   "office-escape",
   "pigeon-crossing",
   "penalty-hero",
   "warehouse-rush",
   "tower-climb",
   "clean-city",
   "escape-room",
   "obstacle-race",
];

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const MAX_BYTES = 60 * 1024;
const PER_GAME_TIMEOUT_MS = 90_000;
const VIEW_W = 1280;
const VIEW_H = 720;

function argValue(name, fallback) {
   const i = process.argv.indexOf(name);
   return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE_URL = argValue("--base-url", "http://localhost:3100").replace(/\/$/, "");
const SLUGS = argValue("--slugs", DEFAULT_SLUGS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
const OUT_DIR = path.resolve(HERE, argValue("--out", "out"));
const WRITE = process.argv.includes("--write");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withTimeout(promise, ms, slug) {
   let timer;
   try {
      return await Promise.race([
         promise,
         new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${slug}: per-game timeout (${ms} ms)`)), ms);
         }),
      ]);
   } finally {
      clearTimeout(timer);
   }
}

async function freePort() {
   const server = createServer();
   await new Promise((r) => server.listen(0, "127.0.0.1", r));
   const port = server.address().port;
   server.close();
   return port;
}

// --- Minimal CDP client -----------------------------------------------------

class Cdp {
   constructor(wsUrl) {
      this.ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
      this.nextId = 1;
      this.pending = new Map();
      this.ws.on("message", (raw) => {
         const msg = JSON.parse(raw.toString());
         if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
         }
      });
   }

   async ready() {
      if (this.ws.readyState === WebSocket.OPEN) return;
      await new Promise((r, j) => {
         this.ws.once("open", r);
         this.ws.once("error", j);
      });
   }

   send(method, params = {}, sessionId = undefined) {
      const id = this.nextId++;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      return new Promise((resolve, reject) => {
         this.pending.set(id, { resolve, reject });
         this.ws.send(JSON.stringify(payload));
      });
   }

   close() {
      try { this.ws.close(); } catch { /* ignore */ }
   }
}

// --- Page helpers -----------------------------------------------------------

async function evaluate(cdp, sessionId, expression) {
   const res = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
   }, sessionId);
   if (res.exceptionDetails) throw new Error(`page JS error: ${JSON.stringify(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text)}`);
   return res.result.value;
}

async function waitFor(fn, timeoutMs, label) {
   const start = Date.now();
   for (;;) {
      if (await fn()) return;
      if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
      await sleep(250);
   }
}

const CLICK_BUTTON_JS = (label) => `(() => {
   const b = [...document.querySelectorAll("button")].find(
      (x) => x.offsetParent !== null && x.textContent.trim() === ${JSON.stringify(label)},
   );
   if (b) { b.click(); return true; }
   return false;
})()`;

const HAS_BUTTON_JS = (label) => `(() => {
   return [...document.querySelectorAll("button")].some(
      (x) => x.offsetParent !== null && x.textContent.trim() === ${JSON.stringify(label)},
   );
})()`;

const HIDE_OVERLAYS_JS = `(() => {
   const canvas = document.querySelector("canvas");
   if (!canvas) return false;
   const keep = new Set();
   let el = canvas;
   while (el) { keep.add(el); el = el.parentElement; }
   document.querySelectorAll("body *").forEach((n) => {
      if (!keep.has(n)) n.style.visibility = "hidden";
   });
   document.documentElement.style.background = "#000";
   document.body.style.background = "#000";
   return true;
})()`;

const CANVAS_RECT_JS = `(() => {
   const r = document.querySelector("canvas").getBoundingClientRect();
   return { x: r.x, y: r.y, width: r.width, height: r.height };
})()`;

const KEYS = {
   ArrowLeft: { code: "ArrowLeft", key: "ArrowLeft", vk: 37 },
   ArrowUp: { code: "ArrowUp", key: "ArrowUp", vk: 38 },
   ArrowRight: { code: "ArrowRight", key: "ArrowRight", vk: 39 },
   ArrowDown: { code: "ArrowDown", key: "ArrowDown", vk: 40 },
   Space: { code: "Space", key: " ", vk: 32 },
   KeyE: { code: "KeyE", key: "e", vk: 69 },
   Enter: { code: "Enter", key: "Enter", vk: 13 },
};

async function keyEvent(cdp, sessionId, type, keyName) {
   const k = KEYS[keyName];
   if (!k) throw new Error(`unknown key ${keyName}`);
   await cdp.send("Input.dispatchKeyEvent", {
      type,
      code: k.code,
      key: k.key,
      windowsVirtualKeyCode: k.vk,
      nativeVirtualKeyCode: k.vk,
   }, sessionId);
}

async function mouseTap(cdp, sessionId, x, y) {
   for (const [type, buttons] of [["mousePressed", 1], ["mouseReleased", 0]]) {
      await cdp.send("Input.dispatchMouseEvent", {
         type, x, y, button: "left", buttons, clickCount: 1,
      }, sessionId);
   }
}

// Runs the per-game input script after the countdown.
async function playScript(cdp, sessionId, slug) {
   const steps = INPUT_SCRIPTS[slug] ?? [];
   const rect = await evaluate(cdp, sessionId, CANVAS_RECT_JS);
   for (const step of steps) {
      if (step.wait) {
         await sleep(step.wait);
         continue;
      }
      if (step.tap) {
         await keyEvent(cdp, sessionId, "rawKeyDown", step.tap);
         await sleep(60);
         await keyEvent(cdp, sessionId, "keyUp", step.tap);
         continue;
      }
      if (step.hold) {
         await keyEvent(cdp, sessionId, "rawKeyDown", step.hold);
         await sleep(step.ms ?? 500);
         await keyEvent(cdp, sessionId, "keyUp", step.hold);
         continue;
      }
      if (step.click) {
         await mouseTap(
            cdp,
            sessionId,
            Math.round(rect.x + rect.width * step.click[0]),
            Math.round(rect.y + rect.height * step.click[1]),
         );
      }
   }
}

// --- One game ---------------------------------------------------------------

async function captureGame(cdp, sessionId, slug) {
   const startedAt = Date.now();
   const url = `${BASE_URL}/3d/${slug}`;

   await cdp.send("Page.enable", {}, sessionId);
   await cdp.send("Runtime.enable", {}, sessionId);
   await cdp.send("Page.navigate", { url }, sessionId);
   await sleep(1500);

   // Decline the cookie banner (best effort: it may be absent or already answered).
   try {
      await waitFor(() => evaluate(cdp, sessionId, CLICK_BUTTON_JS("Not Accept")), 6_000, "cookie banner");
   } catch {
      /* no banner */
   }

   // Wait for the start screen's Play button (assets may load for a while).
   await waitFor(() => evaluate(cdp, sessionId, HAS_BUTTON_JS("Play")), 60_000, "Play button");
   await sleep(400);
   await evaluate(cdp, sessionId, CLICK_BUTTON_JS("Play"));

   // 3-2-1 countdown, then play the scripted inputs.
   await sleep(3_400);
   await playScript(cdp, sessionId, slug);
   await sleep(150);

   // Hide every HTML overlay above the canvas and shoot just the canvas.
   await evaluate(cdp, sessionId, HIDE_OVERLAYS_JS);
   await sleep(150);
   const rect = await evaluate(cdp, sessionId, CANVAS_RECT_JS);
   const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
   }, sessionId);
   const png = Buffer.from(shot.data, "base64");

   // Crop/resize to 16:9 640x360, webp, tune quality down until <= 60 KB.
   let webp = null;
   for (let quality = 82; quality >= 20; quality -= 8) {
      webp = await sharp(png)
         .resize(640, 360, { fit: "cover" })
         .webp({ quality })
         .toBuffer();
      if (webp.byteLength <= MAX_BYTES) break;
   }

   const outPath = path.join(OUT_DIR, `${slug}.webp`);
   await writeFile(outPath, webp);
   if (WRITE) {
      await copyFile(outPath, path.join(FRONTEND_PUBLIC, "images", "3d", `${slug}.webp`));
   }
   return { outPath, kb: (webp.byteLength / 1024).toFixed(1), ms: Date.now() - startedAt };
}

// --- Main -------------------------------------------------------------------

async function main() {
   await mkdir(OUT_DIR, { recursive: true });
   const debugPort = await freePort();
   const userDataDir = path.join(os.tmpdir(), `p50-thumbs-${Date.now()}`);
   const chrome = spawn(CHROME, [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      "--use-angle=d3d11",
      `--window-size=${VIEW_W},${VIEW_H}`,
      `--user-data-dir=${userDataDir}`,
      "--mute-audio",
      "--no-first-run",
      "about:blank",
   ], { stdio: "ignore" });

   const results = [];
   let cdp = null;
   try {
      // Wait for the DevTools endpoint.
      let version = null;
      const deadline = Date.now() + 30_000;
      for (;;) {
         try {
            const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
            version = await res.json();
            break;
         } catch {
            if (Date.now() > deadline) throw new Error("Chrome DevTools endpoint never came up");
            await sleep(300);
         }
      }

      cdp = new Cdp(version.webSocketDebuggerUrl);
      await cdp.ready();

      for (const slug of SLUGS) {
         const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
         const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
         try {
            const row = await withTimeout(captureGame(cdp, sessionId, slug), PER_GAME_TIMEOUT_MS, slug);
            results.push({ slug, ok: true, ...row });
            console.log(`OK   ${slug}  ${row.kb} KB  (${row.ms} ms)`);
         } catch (err) {
            results.push({ slug, ok: false, error: err.message });
            console.log(`FAIL ${slug}  ${err.message}`);
         } finally {
            await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
         }
      }
   } finally {
      if (cdp) cdp.close();
      chrome.kill("SIGKILL");
   }

   console.log("\nslug                status   KB     path");
   console.log("------------------  -------  -----  ----");
   for (const r of results) {
      console.log(
         `${r.slug.padEnd(18)}  ${(r.ok ? "ok" : "FAIL").padEnd(5)}  ${String(r.ok ? r.kb : "-").padEnd(5)}  ${r.ok ? r.outPath : r.error}`,
      );
   }
   const failures = results.filter((r) => !r.ok).length;
   console.log(`\n${SLUGS.length - failures}/${SLUGS.length} captured${WRITE ? " + written to public/images/3d" : ""}.`);
   process.exit(failures);
}

main().catch((err) => {
   console.error(err);
   process.exit(99);
});
