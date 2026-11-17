"use client";
import { create } from "zustand";
import type { Run } from "./rules";
// Read-only HUD snapshot bridge; reset by Scene on every mount. No game rules live here.
export const useKitchenHud = create<{ run: Run | null; revision: number; publish: (run: Run) => void }>(set => ({
   run: null, revision: 0, publish: run => set(s => ({ run, revision: s.revision + 1 })),
}));
