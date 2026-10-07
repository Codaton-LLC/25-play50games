// Capture real in-game thumbnails for the 10 3D Arcade games.
// Launches Chrome headless, drives it over the DevTools protocol (ws, no puppeteer),
// plays each game a few seconds with a per-game input script, hides the HTML overlays,
// screenshots the canvas, post-processes with sharp (16:9, 640x360, webp <= 60 KB).
//
// Usage (from the repo root or anywhere):
//   node tools/thumbs/capture.mjs [--base-url http://localhost:3100] [--slugs a,b,c] [--out dir]
//                                 [--chrome path] [--write]
// Only a local server is accepted (localhost, 127.0.0.1, [::1], *.localhost): the tool plays
// real runs. Nothing is written outside --out (default tools/thumbs/out) unless --write is given.
// Exit code = number of failed games (99 = setup error, 130 = interrupted).

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile, copyFile } from "node:fs/promises";
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

const DEFAULT_CHROME = {
   win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
   darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
   linux: "/usr/bin/google-chrome",
};
const MAX_BYTES = 60 * 1024;
const PER_GAME_TIMEOUT_MS = 90_000;
const COMMAND_TIMEOUT_MS = 30_000;
const ATTEMPTS = 2; // a run that ended or paused before the shot is played once more
const VIEW_W = 1280;
const VIEW_H = 720;
const OUT_W = 640;
const OUT_H = 360;

function argValue(name, fallback) {
   const i = process.argv.indexOf(name);
   if (i < 0) return fallback;
   const value = process.argv[i + 1];
   if (!value || value.startsWith("--")) {
      console.error(`${name} needs a value`);
      process.exit(99);
   }
   return value;
}

const BASE_URL = argValue("--base-url", "http://localhost:3100").replace(/\/+$/, "");
const SLUGS = argValue("--slugs", DEFAULT_SLUGS.join(",")).split(",").map((s) => s.trim()).filter(Boolean);
// --out is relative to the current directory, like any CLI path; the default lives next to this file
const OUT_DIR = path.resolve(argValue("--out", path.join(HERE, "out")));
const CHROME = argValue("--chrome", process.env.CHROME_PATH || DEFAULT_CHROME[process.platform] || "google-chrome");
const WRITE = process.argv.includes("--write");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** An error that ends the attempt at once (waitFor does not swallow it). */
class FatalError extends Error {}

function checkArgs() {
   const args = process.argv.slice(2);
   for (let i = 0; i < args.length; i++) {
      if (["--base-url", "--slugs", "--out", "--chrome"].includes(args[i])) i++;
      else if (args[i] !== "--write") throw new FatalError(`unknown argument ${args[i]} (usage: top of capture.mjs)`);
   }
   let url;
   try {
      url = new URL(BASE_URL);
   } catch {
      throw new FatalError(`--base-url is not a URL: ${BASE_URL}`);
   }
   const host = url.hostname;
   const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
   if (!local) {
      throw new FatalError(
         `--base-url must be a local server (localhost / 127.0.0.1 / [::1]), not ${host}: the tool plays real runs`,
      );
   }
   const unknown = SLUGS.filter((s) => !DEFAULT_SLUGS.includes(s));
   if (unknown.length > 0) throw new FatalError(`unknown slug(s): ${unknown.join(", ")}`);
   if (SLUGS.length === 0) throw new FatalError("no slugs to capture");
   if (!existsSync(CHROME)) throw new FatalError(`Chrome not found at ${CHROME} (pass --chrome <path> or set CHROME_PATH)`);
}

/** Every game page must answer 200 before Chrome starts (a build without the arcade flag gives 404). */
async function checkServer() {
   for (const slug of SLUGS) {
      const url = `${BASE_URL}/3d/${slug}`;
      let res;
      try {
         res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
         await res.arrayBuffer();
      } catch (err) {
         throw new FatalError(`cannot reach ${url}: ${err.cause?.message ?? err.message} (is the server running?)`);
      }
      if (res.status === 404) {
         throw new FatalError(`${url} is 404: build the frontend with NEXT_PUBLIC_ARCADE_ENABLED=1 (see README)`);
      }
      if (res.status !== 200) throw new FatalError(`${url} answered HTTP ${res.status}`);
   }
}

async function withTimeout(promise, ms, label) {
   let timer;
   try {
      return await Promise.race([
         promise,
         new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label}: timeout (${ms} ms)`)), ms);
         }),
      ]);
   } finally {
      clearTimeout(timer);
   }
}

// --- Minimal CDP client -----------------------------------------------------

class Cdp {
   constructor(wsUrl) {
      this.ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
      this.nextId = 1;
      this.pending = new Map();
      this.closedWith = null;
      this.opened = new Promise((resolve, reject) => {
         this.ws.once("open", resolve);
         this.ws.once("close", () => reject(new Error("DevTools connection closed before it opened")));
      });
      this.opened.catch(() => {});
      this.ws.on("message", (raw) => {
         let msg;
         try {
            msg = JSON.parse(raw.toString());
         } catch {
            return;
         }
         const entry = msg.id ? this.pending.get(msg.id) : undefined;
         if (!entry) return;
         this.pending.delete(msg.id);
         clearTimeout(entry.timer);
         if (msg.error) entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
         else entry.resolve(msg.result);
      });
      // a dead socket fails every pending command at once instead of leaving it hanging
      this.ws.on("error", (err) => this.failAll(err));
      this.ws.on("close", () => this.failAll(new Error("DevTools connection closed")));
   }

   failAll(err) {
      this.closedWith ??= err;
      for (const entry of this.pending.values()) {
         clearTimeout(entry.timer);
         entry.reject(err);
      }
      this.pending.clear();
   }

   send(method, params = {}, sessionId = undefined, timeoutMs = COMMAND_TIMEOUT_MS) {
      if (this.closedWith) return Promise.reject(this.closedWith);
      const id = this.nextId++;
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      return new Promise((resolve, reject) => {
         const timer = setTimeout(() => {
            this.pending.delete(id);
            reject(new Error(`${method}: no reply in ${timeoutMs} ms`));
         }, timeoutMs);
         this.pending.set(id, { resolve, reject, timer, method });
         this.ws.send(JSON.stringify(payload), (err) => {
            if (!err) return;
            this.pending.delete(id);
            clearTimeout(timer);
            reject(err);
         });
      });
   }

   close() {
      try {
         this.ws.close();
      } catch {
         /* ignore */
      }
   }
}

// --- Chrome -----------------------------------------------------------------

const chrome = { proc: null, exited: null, userDataDir: null, cdp: null };
let cleanupPromise = null;

async function launchChrome() {
   chrome.userDataDir = await mkdtemp(path.join(os.tmpdir(), "p50-thumbs-"));
   const args = [
      "--headless=new",
      "--remote-debugging-port=0", // Chrome picks a free port and writes it to DevToolsActivePort
      `--user-data-dir=${chrome.userDataDir}`,
      `--window-size=${VIEW_W},${VIEW_H}`,
      "--ignore-gpu-blocklist",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
   ];
   if (process.platform === "win32") args.splice(1, 0, "--use-angle=d3d11");
   let spawnError = null;
   chrome.proc = spawn(CHROME, args, { stdio: "ignore" });
   chrome.exited = new Promise((resolve) => chrome.proc.once("exit", resolve));
   chrome.proc.once("error", (err) => {
      spawnError = err;
   });

   const portFile = path.join(chrome.userDataDir, "DevToolsActivePort");
   const deadline = Date.now() + 30_000;
   for (;;) {
      if (spawnError) throw new FatalError(`Chrome did not start: ${spawnError.message}`);
      if (chrome.proc.exitCode !== null) throw new FatalError(`Chrome exited at start (code ${chrome.proc.exitCode})`);
      try {
         const [port, wsPath] = (await readFile(portFile, "utf8")).split(/\r?\n/);
         if (port && wsPath) return `ws://127.0.0.1:${port.trim()}${wsPath.trim()}`;
      } catch {
         /* not written yet */
      }
      if (Date.now() > deadline) throw new FatalError("Chrome DevTools endpoint never came up");
      await sleep(200);
   }
}

/** Closes Chrome (politely, then the whole process tree) and removes its temp profile. Idempotent. */
function cleanup() {
   cleanupPromise ??= (async () => {
      const { proc, cdp } = chrome;
      const running = () => proc && proc.pid && proc.exitCode === null && proc.signalCode === null;
      if (cdp) {
         if (running()) await cdp.send("Browser.close", {}, undefined, 3_000).catch(() => {});
         cdp.close();
      }
      if (running()) {
         const closed = await Promise.race([chrome.exited.then(() => true), sleep(5_000).then(() => false)]);
         if (!closed) {
            // the browser's GPU / renderer / crashpad children go with it
            if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
            else proc.kill("SIGKILL");
            await Promise.race([chrome.exited, sleep(3_000)]);
         }
      }
      if (chrome.userDataDir) {
         // children may hold profile files for a moment after the browser exits
         await rm(chrome.userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch((err) =>
            console.warn(`could not remove the temp Chrome profile ${chrome.userDataDir}: ${err.message}`),
         );
      }
   })();
   return cleanupPromise;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
   process.once(signal, () => {
      console.error(`\n${signal}: closing Chrome`);
      cleanup().finally(() => process.exit(130));
   });
}

// --- Page helpers -----------------------------------------------------------

async function evaluate(cdp, sessionId, expression) {
   const res = await cdp.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
   }, sessionId);
   if (res.exceptionDetails) {
      throw new Error(`page JS error: ${res.exceptionDetails.exception?.description ?? res.exceptionDetails.text}`);
   }
   return res.result.value;
}

/** Polls fn until it returns true. Errors while polling (a page still navigating) only retry; FatalError ends it. */
async function waitFor(fn, timeoutMs, label) {
   const start = Date.now();
   let lastError = null;
   for (;;) {
      try {
         if (await fn()) return;
         lastError = null;
      } catch (err) {
         if (err instanceof FatalError) throw err;
         lastError = err;
      }
      if (Date.now() - start > timeoutMs) {
         throw new Error(`timeout waiting for ${label}${lastError ? ` (${lastError.message})` : ""}`);
      }
      await sleep(200);
   }
}

// Visible = laid out and not visibility:hidden (offsetParent is null for position:fixed nodes).
const PAGE_STATE_JS = `(() => {
   const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
   const buttons = [...document.querySelectorAll("button")].filter(visible).map((b) => b.textContent.trim());
   const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(visible).map((d) => d.getAttribute("aria-label") || "");
   return {
      ready: document.readyState === "complete",
      path: location.pathname.replace(/\\/+$/, ""),
      banner: buttons.includes("Not Accept"),
      play: buttons.includes("Play"),
      retry: buttons.includes("Retry"),
      countdown: !!document.querySelector('[role="status"][aria-live="assertive"]'),
      dialogs,
   };
})()`;

// Dialogs that end the attempt: the shell's error / no-WebGL / context-lost / paused / rotate overlays.
const BAD_DIALOGS = ["Game error", "3D is not available", "Graphics stopped", "Paused", "Rotate your device"];
const badDialog = (state) => state.dialogs.find((d) => BAD_DIALOGS.includes(d)) ?? null;

const CLICK_BUTTON_JS = (label) => `(() => {
   const b = [...document.querySelectorAll("button")].find(
      (x) => x.getClientRects().length > 0 && x.textContent.trim() === ${JSON.stringify(label)},
   );
   if (b) { b.click(); return true; }
   return false;
})()`;

// The largest canvas is the game view (helpers may create small ones).
const GAME_CANVAS_JS = `[...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0]`;

const HIDE_OVERLAYS_JS = `(() => {
   const canvas = ${GAME_CANVAS_JS};
   if (!canvas) return false;
   const keep = new Set();
   let el = canvas;
   while (el) { keep.add(el); el = el.parentElement; }
   document.querySelectorAll("body *").forEach((n) => {
      if (!keep.has(n)) n.style.setProperty("visibility", "hidden", "important");
   });
   document.documentElement.style.background = "#000";
   document.body.style.background = "#000";
   return true;
})()`;

const CANVAS_RECT_JS = `(() => {
   const canvas = ${GAME_CANVAS_JS};
   if (!canvas) return null;
   const r = canvas.getBoundingClientRect();
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
   if (!k) throw new FatalError(`unknown key ${keyName} in inputs.mjs`);
   await cdp.send("Input.dispatchKeyEvent", {
      type,
      code: k.code,
      key: k.key,
      windowsVirtualKeyCode: k.vk,
      nativeVirtualKeyCode: k.vk,
   }, sessionId);
}

async function mouseTap(cdp, sessionId, x, y) {
   await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y }, sessionId);
   for (const [type, buttons] of [["mousePressed", 1], ["mouseReleased", 0]]) {
      await cdp.send("Input.dispatchMouseEvent", {
         type, x, y, button: "left", buttons, clickCount: 1,
      }, sessionId);
   }
}

// Runs the per-game input script after the countdown. Keys pressed with { down } stay held
// (so the shot catches the character mid-move); they are returned for release after the shot.
async function playScript(cdp, sessionId, slug, rect) {
   const steps = INPUT_SCRIPTS[slug] ?? [];
   const held = new Set();
   for (const step of steps) {
      if (step.wait) {
         await sleep(step.wait);
      } else if (step.tap) {
         await keyEvent(cdp, sessionId, "rawKeyDown", step.tap);
         await sleep(60);
         await keyEvent(cdp, sessionId, "keyUp", step.tap);
      } else if (step.hold) {
         await keyEvent(cdp, sessionId, "rawKeyDown", step.hold);
         await sleep(step.ms ?? 500);
         await keyEvent(cdp, sessionId, "keyUp", step.hold);
      } else if (step.down) {
         await keyEvent(cdp, sessionId, "rawKeyDown", step.down);
         held.add(step.down);
      } else if (step.up) {
         await keyEvent(cdp, sessionId, "keyUp", step.up);
         held.delete(step.up);
      } else if (step.click) {
         await mouseTap(
            cdp,
            sessionId,
            Math.round(rect.x + rect.width * step.click[0]),
            Math.round(rect.y + rect.height * step.click[1]),
         );
      } else {
         throw new FatalError(`${slug}: unknown step ${JSON.stringify(step)} in inputs.mjs`);
      }
   }
   return held;
}

// --- One game ---------------------------------------------------------------

async function captureGame(cdp, sessionId, slug) {
   const startedAt = Date.now();
   const route = `/3d/${slug}`;
   const state = () => evaluate(cdp, sessionId, PAGE_STATE_JS);

   const nav = await cdp.send("Page.navigate", { url: `${BASE_URL}${route}` }, sessionId);
   if (nav.errorText) throw new FatalError(`cannot open ${BASE_URL}${route}: ${nav.errorText} (is the server running?)`);
   await waitFor(async () => {
      const s = await state();
      return s.ready && s.path === route;
   }, 30_000, "page load");

   // Decline the cookie banner ("Not Accept" is not remembered, so it shows on every visit;
   // the camera fit avoids it while it is up), then wait for the start screen's Play button.
   let playSeenAt = 0;
   await waitFor(async () => {
      const s = await state();
      const bad = badDialog(s);
      if (bad) throw new FatalError(`the game shows "${bad}"`);
      if (s.banner) {
         await evaluate(cdp, sessionId, CLICK_BUTTON_JS("Not Accept"));
         return false;
      }
      if (!s.play) return false;
      playSeenAt ||= Date.now();
      return Date.now() - playSeenAt > 500; // give a late banner a moment to show up
   }, 60_000, "Play button");
   await evaluate(cdp, sessionId, CLICK_BUTTON_JS("Play"));

   // The 3-2-1 countdown, then the run is playing.
   await waitFor(async () => (await state()).countdown, 5_000, "countdown");
   await waitFor(async () => {
      const s = await state();
      const bad = badDialog(s);
      if (bad) throw new FatalError(`the game shows "${bad}"`);
      return !s.countdown;
   }, 8_000, "end of the countdown");

   const rect = await evaluate(cdp, sessionId, CANVAS_RECT_JS);
   if (!rect || rect.width < 100 || rect.height < 100) throw new Error("no game canvas on the page");
   const held = await playScript(cdp, sessionId, slug, rect);

   // The run must still be on: no result panel, no pause / error overlay.
   const s = await state();
   if (s.retry) throw new Error("the run ended before the shot (tune inputs.mjs)");
   const bad = badDialog(s);
   if (bad) throw new Error(`the game shows "${bad}" at the shot`);

   // Hide every HTML overlay above the canvas and shoot just the canvas.
   await evaluate(cdp, sessionId, HIDE_OVERLAYS_JS);
   await sleep(120);
   const shotRect = await evaluate(cdp, sessionId, CANVAS_RECT_JS);
   const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: shotRect.x, y: shotRect.y, width: shotRect.width, height: shotRect.height, scale: 1 },
   }, sessionId);
   for (const key of held) await keyEvent(cdp, sessionId, "keyUp", key);
   const png = Buffer.from(shot.data, "base64");

   // A WebGL canvas that did not draw comes out as one flat colour.
   const { channels } = await sharp(png).stats();
   if (channels.slice(0, 3).every((c) => c.stdev < 3)) throw new Error("the canvas is blank (WebGL did not draw)");

   // Crop/resize to 16:9 640x360, webp, tune quality down until <= 60 KB.
   let webp = null;
   for (let quality = 82; quality >= 20; quality -= 8) {
      webp = await sharp(png)
         .resize(OUT_W, OUT_H, { fit: "cover" })
         .webp({ quality, effort: 6 })
         .toBuffer();
      if (webp.byteLength <= MAX_BYTES) break;
   }
   if (webp.byteLength > MAX_BYTES) throw new Error(`webp is ${(webp.byteLength / 1024).toFixed(1)} KB even at low quality`);

   const outPath = path.join(OUT_DIR, `${slug}.webp`);
   await writeFile(outPath, webp);
   if (WRITE) {
      const publicDir = path.join(FRONTEND_PUBLIC, "images", "3d");
      await mkdir(publicDir, { recursive: true });
      await copyFile(outPath, path.join(publicDir, `${slug}.webp`));
   }
   return { outPath, kb: (webp.byteLength / 1024).toFixed(1), ms: Date.now() - startedAt };
}

/** One attempt in a fresh tab (fresh page state), closed afterwards whatever happens. */
async function attempt(cdp, slug) {
   const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
   try {
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      // a desktop layout at 2x: the shell renders at its max DPR, the 640x360 downscale is supersampled
      await cdp.send("Emulation.setDeviceMetricsOverride", {
         width: VIEW_W, height: VIEW_H, deviceScaleFactor: 2, mobile: false,
      }, sessionId);
      // the shell pauses on window blur: keep the page focused whatever tab Chrome thinks is active
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);
      return await withTimeout(captureGame(cdp, sessionId, slug), PER_GAME_TIMEOUT_MS, slug);
   } finally {
      await cdp.send("Target.closeTarget", { targetId }, undefined, 5_000).catch(() => {});
   }
}

// --- Main -------------------------------------------------------------------

async function main() {
   checkArgs();
   await checkServer();
   await mkdir(OUT_DIR, { recursive: true });

   const results = [];
   try {
      const wsUrl = await launchChrome();
      chrome.cdp = new Cdp(wsUrl);
      await withTimeout(chrome.cdp.opened, 10_000, "DevTools connection");

      for (const slug of SLUGS) {
         let row = null;
         let error = null;
         for (let i = 1; i <= ATTEMPTS && !row; i++) {
            try {
               row = await attempt(chrome.cdp, slug);
            } catch (err) {
               error = err;
               console.log(`     ${slug}: attempt ${i} failed: ${err.message}`);
               if (err instanceof FatalError || chrome.cdp.closedWith) break;
            }
         }
         if (row) {
            results.push({ slug, ok: true, ...row });
            console.log(`OK   ${slug}  ${row.kb} KB  (${row.ms} ms)`);
         } else {
            results.push({ slug, ok: false, error: error?.message ?? "unknown error" });
            console.log(`FAIL ${slug}  ${error?.message}`);
            if (chrome.cdp.closedWith) throw new FatalError(`Chrome went away: ${chrome.cdp.closedWith.message}`);
         }
      }
   } finally {
      await cleanup();
   }

   console.log("\nslug                status  KB     path");
   console.log("------------------  ------  -----  ----");
   for (const r of results) {
      console.log(
         `${r.slug.padEnd(18)}  ${(r.ok ? "ok" : "FAIL").padEnd(6)}  ${String(r.ok ? r.kb : "-").padEnd(5)}  ${r.ok ? r.outPath : r.error}`,
      );
   }
   const failures = SLUGS.length - results.filter((r) => r.ok).length;
   console.log(`\n${SLUGS.length - failures}/${SLUGS.length} captured${WRITE ? " + written to public/images/3d" : ""}.`);
   return failures;
}

// exitCode, not process.exit(): exiting while fetch's sockets close trips a libuv assertion on Windows
main().then(
   (failures) => {
      process.exitCode = failures;
   },
   async (err) => {
      console.error(err instanceof FatalError ? `error: ${err.message}` : err);
      await cleanup();
      process.exitCode = 99;
   },
);
