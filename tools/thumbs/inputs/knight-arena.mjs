// Thumbnail action script for knight-arena (tools/thumbs/capture.mjs).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tap(page, code, holdMs = 60) {
   await page.keyboard.down(code);
   await sleep(holdMs);
   await page.keyboard.up(code);
}

export default async function knightArenaThumbInput(page) {
   // Beat 0 is at 1500 ms; strike on-beat so the knight is mid-slash with sword trail and sparks.
   await sleep(1420);
   await tap(page, "ArrowUp", 70);
   await sleep(120);
}
