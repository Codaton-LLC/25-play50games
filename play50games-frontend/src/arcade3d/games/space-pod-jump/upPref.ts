// The camera's "up" preference (the card's motion-sickness option): roll with the local down (default)
// or keep the screen's up fixed. Session state only (this file never touches storage).
let fixed = false;
const listeners = new Set<() => void>();

export function upFixed(): boolean {
   return fixed;
}

export function setUpFixed(v: boolean): void {
   fixed = v;
   listeners.forEach((l) => l());
}

export function subscribeUp(fn: () => void): () => void {
   listeners.add(fn);
   return () => listeners.delete(fn);
}
