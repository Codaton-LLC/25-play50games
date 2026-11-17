"use client";

// Hands the browser the games' scoring metas (metaSource.ts) before anything under it renders, so the
// /3d grid's best scores and score sync read them without importing the registry (and with it every
// game's meta and rules code) into the page's first-load JS. A parent renders before its children.
import { useState, type ReactNode } from "react";
import { provideGameMetas } from "../metaSource";
import type { GameScoringMeta } from "../types";

export default function GameMetas({ metas, children }: { metas: readonly GameScoringMeta[]; children: ReactNode }) {
   useState(() => {
      provideGameMetas(metas);
      return true;
   });
   return <>{children}</>;
}
