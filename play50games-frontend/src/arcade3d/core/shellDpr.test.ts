import { describe, expect, it } from "vitest";
import { QUALITY, qualityFor } from "./quality";
import { canvasDprCap, nextMonitorDpr, SHELL_DECLINE_LOCK, SHELL_LOW_DPR, SHELL_MONITOR_DPR } from "./shellDpr";

describe("canvasDprCap", () => {
   it("uses the tier cap from the first frame, while the monitor is still at the desktop step", () => {
      expect(canvasDprCap(QUALITY.high.maxDpr, SHELL_MONITOR_DPR)).toBe(1.75);
      expect(canvasDprCap(QUALITY.mid.maxDpr, SHELL_MONITOR_DPR)).toBe(1.5);
      expect(canvasDprCap(QUALITY.low.maxDpr, SHELL_MONITOR_DPR)).toBe(1);
   });
   it("is 1.5 on a coarse pointer and 1.75 on a desktop before any decline", () => {
      const phone = qualityFor({ declines: 0, coarsePointer: true });
      const desktop = qualityFor({ declines: 0, coarsePointer: false });
      expect(phone.tier).toBe("mid");
      expect(canvasDprCap(phone.maxDpr, SHELL_MONITOR_DPR)).toBe(1.5);
      expect(canvasDprCap(desktop.maxDpr, SHELL_MONITOR_DPR)).toBe(1.75);
   });
   it("a decline forces 1 on every tier", () => {
      expect(nextMonitorDpr(0, "decline")).toBe(SHELL_LOW_DPR);
      expect(canvasDprCap(QUALITY.high.maxDpr, SHELL_LOW_DPR)).toBe(1);
      expect(canvasDprCap(QUALITY.mid.maxDpr, SHELL_LOW_DPR)).toBe(1);
      expect(canvasDprCap(QUALITY.low.maxDpr, SHELL_LOW_DPR)).toBe(1);
   });
   it("an incline restores the monitor step but cannot climb past the tier cap", () => {
      const restored = nextMonitorDpr(1, "incline");
      expect(restored).toBe(SHELL_MONITOR_DPR);
      // one decline is mid; two is low. The monitor asks for 1.75 and the tier keeps it down.
      const mid = qualityFor({ declines: 1, coarsePointer: false });
      const low = qualityFor({ declines: 2, coarsePointer: false });
      expect(canvasDprCap(mid.maxDpr, restored!)).toBe(1.5);
      expect(canvasDprCap(low.maxDpr, nextMonitorDpr(2, "incline")!)).toBe(1);
      expect(canvasDprCap(QUALITY.high.maxDpr, restored!)).toBe(1.75);
   });
});

describe("nextMonitorDpr", () => {
   it("inclines back to the desktop step before the lock", () => {
      expect(nextMonitorDpr(0, "incline")).toBe(1.75);
      expect(nextMonitorDpr(SHELL_DECLINE_LOCK - 1, "incline")).toBe(1.75);
      expect(nextMonitorDpr(1, "decline")).toBe(1);
   });
   it("stops restoring once declines reach the lock", () => {
      expect(nextMonitorDpr(SHELL_DECLINE_LOCK, "incline")).toBeNull();
      expect(nextMonitorDpr(SHELL_DECLINE_LOCK + 4, "incline")).toBeNull();
   });
});
