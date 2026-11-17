// The HUD's colour swatches (DOM buttons, outside the canvas) hand their pick to the simulation here; the
// Scene reads and clears it once per frame. Plain module state, no React.
export const colorQueue = { pick: -1 };

export function queueColor(i: number): void {
   colorQueue.pick = i;
}

export function takeQueuedColor(): number {
   const p = colorQueue.pick;
   colorQueue.pick = -1;
   return p;
}
