// Screenshot harness for the 50 classic 2D games of Play50Games (/games/1 .. /games/50).
//
// Usage:
//   node tools/classic-shots/shoot.mjs http://localhost:3250 before
//   node tools/classic-shots/shoot.mjs http://localhost:3460 smoke --ids 1,18,24,41,49
//
// Security & safety:
// - Base URL MUST be http://localhost:<port> (any other host or protocol is refused).
// - All non-GET requests to cms.play50.games are blocked in the browser.
// - All 50 games are marked unlocked in localStorage (play50games_progress) in the test browser only.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_PKG = path.resolve(HERE, "../../play50games-frontend/package.json");

const DEFAULT_CHROME = {
   win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
   darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
   linux: "/usr/bin/google-chrome",
};

const VIEWPORTS = [
   { width: 390, height: 844, mobile: true },
   { width: 360, height: 740, mobile: true },
   { width: 1180, height: 820, mobile: false },
];

const COMMAND_TIMEOUT_MS = 30_000;
const PAGE_TIMEOUT_MS = 45_000;
const START_WAIT_MS = 1_500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ensureDir(dirPath) {
   for (let attempt = 1; attempt <= 4; attempt++) {
      try {
         await mkdir(dirPath, { recursive: true });
         return;
      } catch (err) {
         if (err?.code === "EPERM" && attempt < 4) {
            await sleep(150 * attempt);
            continue;
         }
         throw err;
      }
   }
}

function parseArgs(argv) {
   const positional = [];
   let baseUrl = null;
   let label = null;
   let idsRaw = null;
   let chromePath = process.env.CHROME_PATH || DEFAULT_CHROME[process.platform] || "google-chrome";

   for (let i = 0; i < argv.length; i++) {
      const arg = argv[i];
      if (arg === "--base-url") {
         baseUrl = argv[++i];
      } else if (arg === "--label") {
         label = argv[++i];
      } else if (arg === "--ids" || arg === "--games" || arg === "--only") {
         idsRaw = argv[++i];
      } else if (arg === "--chrome") {
         chromePath = argv[++i];
      } else if (arg.startsWith("--")) {
         throw new Error(`Unknown flag: ${arg}`);
      } else {
         positional.push(arg);
      }
   }

   if (!baseUrl && positional.length > 0) baseUrl = positional.shift();
   if (!label && positional.length > 0) label = positional.shift();
   if (!idsRaw && positional.length > 0) idsRaw = positional.shift();

   if (!baseUrl) {
      throw new Error(
         "Missing base URL. Usage: node tools/classic-shots/shoot.mjs http://localhost:<port> <label> [--ids 1,18,24,41,49]"
      );
   }

   const trimmedUrl = baseUrl.replace(/\/+$/, "");
   if (!/^http:\/\/localhost:\d+$/.test(trimmedUrl)) {
      throw new Error(
         `Refusing base URL "${baseUrl}": base URL MUST be http://localhost:<port> (production must never be scripted).`
      );
   }

   const safeLabel = (label || "before").trim();
   if (!safeLabel || /[\\/:*?"<>|]/.test(safeLabel)) {
      throw new Error(`Invalid label "${safeLabel}".`);
   }

   let ids;
   if (idsRaw) {
      ids = idsRaw
         .split(",")
         .map((s) => Number.parseInt(s.trim(), 10))
         .filter((n) => Number.isInteger(n) && n >= 1 && n <= 50);
      if (ids.length === 0) {
         throw new Error(`No valid game IDs in "${idsRaw}" (expected integers in 1..50).`);
      }
   } else {
      ids = Array.from({ length: 50 }, (_, idx) => idx + 1);
   }

   if (!existsSync(chromePath)) {
      throw new Error(`Chrome executable not found at "${chromePath}". Set CHROME_PATH or pass --chrome <path>.`);
   }

   return {
      baseUrl: trimmedUrl,
      label: safeLabel,
      ids,
      chromePath,
      outDir: path.join(HERE, "out", safeLabel),
   };
}

/**
 * Checks whether puppeteer-core or playwright is present in play50games-frontend/node_modules.
 * Returns the loaded module and kind if installed, or null so we use the built-in CDP client.
 */
async function resolveFrontendAutomation() {
   if (!existsSync(FRONTEND_PKG)) return null;
   const req = createRequire(FRONTEND_PKG);
   for (const name of ["puppeteer-core", "playwright", "playwright-core"]) {
      try {
         const resolved = req.resolve(name);
         const mod = await import(resolved);
         return { name, mod: mod.default ?? mod };
      } catch {
         // not installed in play50games-frontend/node_modules
      }
   }
   return null;
}

/**
 * Builds the init script that unlocks all 50 classic games in localStorage
 * using the exact key ("play50games_progress") and GameProgress shape read by
 * play50games-frontend/src/lib/storage/progressStorage.ts.
 */
function buildUnlockInitScript() {
   return `(() => {
      try {
         const now = "2026-01-01T00:00:00.000Z";
         const progress = {};
         for (let id = 1; id <= 60; id++) {
            progress[id] = {
               game_id: id,
               score: 100,
               completed: true,
               completed_at: now,
               attempts: 1,
               best_score: 100,
               last_played: now,
            };
         }
         localStorage.setItem("play50games_progress", JSON.stringify(progress));
         if (!localStorage.getItem("play50games_guest_id")) {
            localStorage.setItem("play50games_guest_id", "guest_classic_shots");
         }
         localStorage.removeItem("play50games_jwt_token");
         localStorage.removeItem("play50games_auth_status");
      } catch {}
   })();`;
}

// --- Minimal CDP client over built-in WebSocket ------------------------------

class CdpClient {
   constructor(wsUrl) {
      this.ws = new WebSocket(wsUrl);
      this.nextId = 1;
      this.pending = new Map();
      this.listeners = new Map();
      this.closedWith = null;

      this.opened = new Promise((resolve, reject) => {
         this.ws.addEventListener("open", () => resolve(), { once: true });
         this.ws.addEventListener(
            "close",
            () => reject(new Error("DevTools WebSocket closed before opening")),
            { once: true }
         );
         this.ws.addEventListener(
            "error",
            (ev) => reject(ev?.error || new Error("DevTools WebSocket error")),
            { once: true }
         );
      });
      this.opened.catch(() => {});

      this.ws.addEventListener("message", (event) => {
         const raw =
            typeof event.data === "string"
               ? event.data
               : Buffer.from(event.data).toString("utf8");
         let msg;
         try {
            msg = JSON.parse(raw);
         } catch {
            return;
         }
         if (msg.id) {
            const entry = this.pending.get(msg.id);
            if (!entry) return;
            this.pending.delete(msg.id);
            clearTimeout(entry.timer);
            if (msg.error) {
               entry.reject(new Error(`${entry.method}: ${msg.error.message}`));
            } else {
               entry.resolve(msg.result);
            }
            return;
         }
         if (msg.method) {
            const handlers = this.listeners.get(msg.method);
            if (handlers) {
               for (const handler of handlers) {
                  try {
                     handler(msg.params || {}, msg.sessionId);
                  } catch {
                     // ignore listener errors
                  }
               }
            }
         }
      });

      this.ws.addEventListener("error", (ev) => {
         this.failAll(ev?.error || new Error("DevTools WebSocket error"));
      });
      this.ws.addEventListener("close", () => {
         this.failAll(new Error("DevTools WebSocket closed"));
      });
   }

   on(method, handler) {
      if (!this.listeners.has(method)) {
         this.listeners.set(method, new Set());
      }
      this.listeners.get(method).add(handler);
      return () => this.listeners.get(method)?.delete(handler);
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
            reject(new Error(`${method}: timeout after ${timeoutMs} ms`));
         }, timeoutMs);
         this.pending.set(id, { resolve, reject, timer, method });
         try {
            this.ws.send(JSON.stringify(payload));
         } catch (err) {
            this.pending.delete(id);
            clearTimeout(timer);
            reject(err);
         }
      });
   }

   close() {
      try {
         this.ws.close();
      } catch {
         // ignore
      }
   }
}

const chromeState = {
   proc: null,
   exited: null,
   userDataDir: null,
   cdp: null,
};
let cleanupPromise = null;

async function launchChromeCdp(chromePath) {
   chromeState.userDataDir = await mkdtemp(path.join(os.tmpdir(), "p50-classic-shots-"));
   const args = [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${chromeState.userDataDir}`,
      `--window-size=${VIEWPORTS[0].width},${VIEWPORTS[0].height}`,
      "--ignore-gpu-blocklist",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--mute-audio",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
   ];
   if (process.platform === "win32") {
      args.splice(1, 0, "--use-angle=d3d11");
   }

   let spawnError = null;
   chromeState.proc = spawn(chromePath, args, { stdio: "ignore" });
   chromeState.exited = new Promise((resolve) => chromeState.proc.once("exit", resolve));
   chromeState.proc.once("error", (err) => {
      spawnError = err;
   });

   const portFile = path.join(chromeState.userDataDir, "DevToolsActivePort");
   const deadline = Date.now() + 30_000;
   for (;;) {
      if (spawnError) throw new Error(`Failed to start Chrome: ${spawnError.message}`);
      if (chromeState.proc.exitCode !== null) {
         throw new Error(`Chrome exited prematurely with code ${chromeState.proc.exitCode}`);
      }
      try {
         const lines = (await readFile(portFile, "utf8")).split(/\r?\n/);
         if (lines[0] && lines[1]) {
            return `ws://127.0.0.1:${lines[0].trim()}${lines[1].trim()}`;
         }
      } catch {
         // waiting for DevToolsActivePort file
      }
      if (Date.now() > deadline) {
         throw new Error("Timed out waiting for Chrome DevToolsActivePort");
      }
      await sleep(150);
   }
}

function cleanupChrome() {
   cleanupPromise ??= (async () => {
      const { proc, cdp } = chromeState;
      const isRunning = () => proc && proc.pid && proc.exitCode === null && proc.signalCode === null;
      if (cdp) {
         if (isRunning()) {
            await cdp.send("Browser.close", {}, undefined, 3_000).catch(() => {});
         }
         cdp.close();
      }
      if (isRunning()) {
         const closed = await Promise.race([
            chromeState.exited.then(() => true),
            sleep(4_000).then(() => false),
         ]);
         if (!closed) {
            if (process.platform === "win32") {
               spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
            } else {
               proc.kill("SIGKILL");
            }
            await Promise.race([chromeState.exited, sleep(2_000)]);
         }
      }
      if (chromeState.userDataDir) {
         await rm(chromeState.userDataDir, {
            recursive: true,
            force: true,
            maxRetries: 8,
            retryDelay: 250,
         }).catch(() => {});
      }
   })();
   return cleanupPromise;
}

for (const sig of ["SIGINT", "SIGTERM"]) {
   process.once(sig, () => {
      cleanupChrome().finally(() => process.exit(130));
   });
}

async function evaluate(cdp, sessionId, expression) {
   const res = await cdp.send(
      "Runtime.evaluate",
      {
         expression,
         returnByValue: true,
         awaitPromise: true,
      },
      sessionId
   );
   if (res.exceptionDetails) {
      const desc =
         res.exceptionDetails.exception?.description ||
         res.exceptionDetails.text ||
         "Runtime.evaluate failed";
      throw new Error(desc);
   }
   return res.result?.value;
}

const INSPECT_PAGE_JS = `(() => {
   const visible = (el) => {
      if (!el) return false;
      const rects = el.getClientRects();
      if (!rects || rects.length === 0) return false;
      const style = window.getComputedStyle(el);
      return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity || "1") > 0.05;
   };
   const buttons = [...document.querySelectorAll("button")].filter(visible);
   const findBtn = (label) =>
      buttons.find((b) => b.textContent.replace(/\\s+/g, " ").trim() === label) ||
      buttons.find((b) => b.textContent.replace(/\\s+/g, " ").trim().includes(label));

   const acceptBtn = buttons.find((b) => b.textContent.replace(/\\s+/g, " ").trim() === "Accept");
   const startBtn =
      document.querySelector("button.start-button") ||
      findBtn("Start Game");
   const tryAgainBtn = findBtn("Try again");
   const loadingBusy = !!document.querySelector('[aria-busy="true"]');
   const bodyText = document.body ? document.body.innerText : "";
   const notLoaded = bodyText.includes("This game did not load");
   const locked = bodyText.includes("This game is still locked");

   return {
      ready: document.readyState === "complete",
      loadingBusy,
      hasAccept: !!acceptBtn,
      hasStart: !!(startBtn && visible(startBtn)),
      hasTryAgain: !!tryAgainBtn,
      notLoaded,
      locked,
   };
})()`;

const CLICK_ACCEPT_JS = `(() => {
   const buttons = [...document.querySelectorAll("button")];
   const btn = buttons.find((b) => b.textContent.replace(/\\s+/g, " ").trim() === "Accept");
   if (btn) {
      btn.click();
      return true;
   }
   return false;
})()`;

const CLICK_START_JS = `(() => {
   const startBtn =
      document.querySelector("button.start-button") ||
      [...document.querySelectorAll("button")].find((b) =>
         b.textContent.replace(/\\s+/g, " ").trim().includes("Start Game")
      );
   if (startBtn) {
      startBtn.click();
      window.scrollTo(0, 0);
      return true;
   }
   return false;
})()`;

const CLICK_TRY_AGAIN_JS = `(() => {
   const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.replace(/\\s+/g, " ").trim() === "Try again"
   );
   if (btn) {
      btn.click();
      return true;
   }
   return false;
})()`;

async function setViewport(cdp, sessionId, vp) {
   await cdp.send(
      "Emulation.setDeviceMetricsOverride",
      {
         width: vp.width,
         height: vp.height,
         deviceScaleFactor: 1,
         mobile: vp.mobile,
      },
      sessionId
   );
   await evaluate(
      cdp,
      sessionId,
      `new Promise((resolve) => {
         window.scrollTo(0, 0);
         window.dispatchEvent(new Event("resize"));
         requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
      })`
   ).catch(() => {});
}

async function shootGame(cdp, sessionId, baseUrl, outDir, id, gameErrors) {
   const url = `${baseUrl}/games/${id}`;
   await setViewport(cdp, sessionId, VIEWPORTS[0]);

   // Ensure unlock progress is present before navigation
   await evaluate(cdp, sessionId, buildUnlockInitScript()).catch(() => {});

   const nav = await cdp.send("Page.navigate", { url }, sessionId);
   if (nav.errorText) {
      throw new Error(`Navigation to ${url} failed: ${nav.errorText}`);
   }

   const deadline = Date.now() + PAGE_TIMEOUT_MS;
   let retriedLoad = false;
   let startReady = false;

   while (Date.now() < deadline) {
      let state = null;
      try {
         state = await evaluate(cdp, sessionId, INSPECT_PAGE_JS);
      } catch {
         await sleep(150);
         continue;
      }

      if (state?.hasAccept) {
         await evaluate(cdp, sessionId, CLICK_ACCEPT_JS).catch(() => {});
         await sleep(350);
      }

      if (state?.hasStart) {
         // Give the cookie banner's 100ms mount timer a brief window in case this is the first game
         await sleep(200);
         const recheck = await evaluate(cdp, sessionId, INSPECT_PAGE_JS).catch(() => null);
         if (recheck?.hasAccept) {
            await evaluate(cdp, sessionId, CLICK_ACCEPT_JS).catch(() => {});
            await sleep(350);
         }
         startReady = true;
         break;
      }

      if (state?.notLoaded && state?.hasTryAgain && !retriedLoad) {
         retriedLoad = true;
         await evaluate(cdp, sessionId, CLICK_TRY_AGAIN_JS).catch(() => {});
         await sleep(500);
         continue;
      }

      if (state?.notLoaded && retriedLoad && !state?.loadingBusy) {
         gameErrors.push(`Game ${id}: page reported "This game did not load"`);
         break;
      }

      if (state?.locked && !state?.loadingBusy) {
         gameErrors.push(`Game ${id}: page reported "This game is still locked"`);
         break;
      }

      await sleep(150);
   }

   if (!startReady && gameErrors.length === 0) {
      gameErrors.push(`Game ${id}: timed out waiting for "Start Game" button`);
   }

   if (startReady) {
      const clicked = await evaluate(cdp, sessionId, CLICK_START_JS);
      if (!clicked) {
         gameErrors.push(`Game ${id}: could not click "Start Game" button`);
      }
   }

   await sleep(START_WAIT_MS);

   // Check one more time if the cookie banner appeared late
   const afterWait = await evaluate(cdp, sessionId, INSPECT_PAGE_JS).catch(() => null);
   if (afterWait?.hasAccept) {
      await evaluate(cdp, sessionId, CLICK_ACCEPT_JS).catch(() => {});
      await sleep(350);
   }

   for (const vp of VIEWPORTS) {
      await setViewport(cdp, sessionId, vp);
      await sleep(120);
      const shot = await cdp.send(
         "Page.captureScreenshot",
         {
            format: "png",
            captureBeyondViewport: false,
            clip: {
               x: 0,
               y: 0,
               width: vp.width,
               height: vp.height,
               scale: 1,
            },
         },
         sessionId
      );
      const filePath = path.join(outDir, `${id}-${vp.width}x${vp.height}.png`);
      await writeFile(filePath, Buffer.from(shot.data, "base64"));
   }
}

async function main() {
   const config = parseArgs(process.argv.slice(2));
   const detected = await resolveFrontendAutomation();
   await ensureDir(config.outDir);

   console.log(
      `Classic shots: base=${config.baseUrl} label=${config.label} games=${config.ids.length} driver=${detected ? detected.name : "cdp-chrome"}`
   );

   const errorsByGame = {};
   const errorsPath = path.join(config.outDir, "errors.json");

   try {
      const wsUrl = await launchChromeCdp(config.chromePath);
      const cdp = new CdpClient(wsUrl);
      chromeState.cdp = cdp;
      await cdp.opened;

      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", {
         targetId,
         flatten: true,
      });

      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Log.enable", {}, sessionId);
      await cdp.send("Emulation.setFocusEmulationEnabled", { enabled: true }, sessionId);

      // Seed localStorage before any page script executes
      await cdp.send(
         "Page.addScriptToEvaluateOnNewDocument",
         { source: buildUnlockInitScript() },
         sessionId
      );

      // Block every non-GET request to cms.play50.games
      await cdp.send(
         "Fetch.enable",
         {
            patterns: [{ urlPattern: "*cms.play50.games*", requestStage: "Request" }],
         },
         sessionId
      );

      cdp.on("Fetch.requestPaused", (params, evtSessionId) => {
         if (evtSessionId !== sessionId) return;
         const method = (params.request?.method || "GET").toUpperCase();
         if (method !== "GET") {
            cdp.send(
               "Fetch.failRequest",
               { requestId: params.requestId, errorReason: "BlockedByClient" },
               sessionId
            ).catch(() => {});
         } else {
            cdp.send(
               "Fetch.continueRequest",
               { requestId: params.requestId },
               sessionId
            ).catch(() => {});
         }
      });

      let activeGameErrors = [];

      cdp.on("Runtime.consoleAPICalled", (params, evtSessionId) => {
         if (evtSessionId !== sessionId || params.type !== "error") return;
         const text = (params.args || [])
            .map((a) => a.description ?? a.value ?? a.unserializableValue ?? "")
            .filter(Boolean)
            .join(" ");
         if (text) activeGameErrors.push(text);
      });

      cdp.on("Runtime.exceptionThrown", (params, evtSessionId) => {
         if (evtSessionId !== sessionId) return;
         const details = params.exceptionDetails;
         const text =
            details?.exception?.description ||
            details?.text ||
            "Uncaught page exception";
         activeGameErrors.push(text);
      });

      cdp.on("Log.entryAdded", (params, evtSessionId) => {
         if (evtSessionId !== sessionId) return;
         const entry = params.entry;
         if (!entry || entry.level !== "error") return;
         if (
            entry.url?.includes("cms.play50.games") &&
            String(entry.text || "").includes("ERR_BLOCKED_BY_CLIENT")
         ) {
            return;
         }
         const msg = entry.url ? `${entry.text} (${entry.url})` : entry.text;
         if (msg) activeGameErrors.push(msg);
      });

      for (const id of config.ids) {
         activeGameErrors = [];
         errorsByGame[id] = activeGameErrors;
         const started = Date.now();
         try {
            await shootGame(
               cdp,
               sessionId,
               config.baseUrl,
               config.outDir,
               id,
               activeGameErrors
            );
            console.log(
               `OK   game ${String(id).padStart(2, " ")} (${Date.now() - started} ms)${activeGameErrors.length ? ` [${activeGameErrors.length} console error(s)]` : ""}`
            );
         } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            activeGameErrors.push(`Harness error: ${message}`);
            console.error(`FAIL game ${String(id).padStart(2, " ")}: ${message}`);
         }
         await writeFile(errorsPath, JSON.stringify(errorsByGame, null, 3) + "\n", "utf8");
      }

      await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
   } finally {
      await writeFile(errorsPath, JSON.stringify(errorsByGame, null, 3) + "\n", "utf8").catch(
         () => {}
      );
      await cleanupChrome();
   }
}

main().catch(async (err) => {
   console.error(err instanceof Error ? err.message : err);
   await cleanupChrome();
   process.exitCode = 1;
});
