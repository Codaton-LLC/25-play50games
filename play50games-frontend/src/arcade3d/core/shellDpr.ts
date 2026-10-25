// Canvas pixel ratio for ShellStage. The tier cap (quality.maxDpr) applies from the first frame.
// PerformanceMonitor still steps afterwards: a decline forces 1, an incline restores the monitor's
// desktop step (1.75) until three declines lock it, and the canvas never exceeds the tier cap, so a
// phone (mid, 1.5) does not climb back to the desktop grid.

/** Monitor step before any decline, and the value an incline restores. High tier's cap. */
export const SHELL_MONITOR_DPR = 1.75;
/** Canvas cap while a decline is in effect. */
export const SHELL_LOW_DPR = 1;
/**
 * After this many slow periods an incline no longer raises the monitor step.
 * Counted in ShellStage because drei's `flipflops` also counts inclines.
 */
export const SHELL_DECLINE_LOCK = 3;

/**
 * Upper bound for `<Canvas dpr={[1, cap]}>`.
 * `tierMaxDpr` is `quality.maxDpr` (1.75 / 1.5 / 1). `monitorDpr` is the PerformanceMonitor step
 * (`SHELL_MONITOR_DPR` or `SHELL_LOW_DPR`). The tier wins when it is the lower of the two, so the
 * first frame on a coarse pointer is already 1.5 and a later incline cannot pass the tier.
 */
export function canvasDprCap(tierMaxDpr: number, monitorDpr: number): number {
   return Math.min(tierMaxDpr, monitorDpr);
}

/**
 * The next monitor step. A decline always drops to 1. An incline restores the desktop step while
 * `declines` is still under the lock, and returns null once locked (ShellStage leaves the cap as it is).
 */
export function nextMonitorDpr(declines: number, step: "decline" | "incline"): number | null {
   if (step === "decline") return SHELL_LOW_DPR;
   if (declines >= SHELL_DECLINE_LOCK) return null;
   return SHELL_MONITOR_DPR;
}
