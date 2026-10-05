"use client";

// Loads one game's code (and three.js) on the client only, then renders it in GameShell.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ArcadeSlug } from "../types";
import type { GameDefinition } from "./types";
import { GAME_LOADERS } from "../loaders";
import { getGameMeta } from "../registry";

const GameShell = dynamic(() => import("./GameShell"), { ssr: false });

export default function ArcadeGameMount({ slug }: { slug: ArcadeSlug }) {
   const [definition, setDefinition] = useState<GameDefinition | null>(null);
   const [failed, setFailed] = useState(false);
   const meta = getGameMeta(slug);

   useEffect(() => {
      let cancelled = false;
      setDefinition(null);
      setFailed(false);
      GAME_LOADERS[slug]()
         .then((mod) => {
            if (!cancelled) setDefinition(mod.default);
         })
         .catch(() => {
            if (!cancelled) setFailed(true);
         });
      return () => {
         cancelled = true;
      };
   }, [slug]);

   if (!meta || failed) {
      return <div className="error">Could not load this game. Please reload the page.</div>;
   }
   if (!definition) {
      return (
         <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
            <span className="loader"></span>
         </div>
      );
   }
   return <GameShell meta={meta} definition={definition} />;
}
