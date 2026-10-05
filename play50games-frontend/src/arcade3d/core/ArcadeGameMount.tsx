"use client";

// Loads one game's code (and three.js) on the client only, then renders it in GameShell.
// The game module and the shell chunk are fetched in parallel; nothing 3D is in the page bundle.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { ArcadeSlug } from "../types";
import type { GameDefinition } from "./types";
import { GAME_LOADERS } from "../loaders";
import { getGameMeta } from "../registry";
import ErrorBoundary from "./ErrorBoundary";
import styles from "./ArcadeGameMount.module.css";

/** Warms the shell chunk while the game module loads (same chunk as the dynamic import below). */
const loadShell = () => import("./GameShell");

function MountLoading({ title }: { title: string }) {
   return (
      <div className={styles.screen} role="status" aria-live="polite">
         <span className={styles.spinner} aria-hidden="true" />
         <p className={styles.text}>Loading {title}…</p>
      </div>
   );
}

function MountError({ title, onRetry }: { title: string; onRetry: () => void }) {
   return (
      <div className={styles.screen} role="alert">
         <h1 className={styles.title}>{title} could not be loaded</h1>
         <p className={styles.text}>Check your connection and try again.</p>
         <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={onRetry}>
               Try again
            </button>
            <Link href="/3d" className={styles.secondary}>
               Back to the 3D Arcade
            </Link>
         </div>
      </div>
   );
}

const GameShell = dynamic(() => import("./GameShell"), {
   ssr: false,
   loading: () => <MountLoading title="the game" />,
});

export default function ArcadeGameMount({ slug }: { slug: ArcadeSlug }) {
   const meta = getGameMeta(slug);
   const title = meta?.title ?? "the game";
   const [definition, setDefinition] = useState<GameDefinition | null>(null);
   const [failed, setFailed] = useState(false);
   const [attempt, setAttempt] = useState(0);

   useEffect(() => {
      let cancelled = false;
      setDefinition(null);
      setFailed(false);
      Promise.all([GAME_LOADERS[slug](), loadShell()])
         .then(([game]) => {
            if (!cancelled) setDefinition(game.default);
         })
         .catch(() => {
            if (!cancelled) setFailed(true);
         });
      return () => {
         cancelled = true;
      };
   }, [slug, attempt]);

   if (!meta || failed) {
      return <MountError title={meta?.title ?? "This game"} onRetry={() => setAttempt((n) => n + 1)} />;
   }
   if (!definition) return <MountLoading title={title} />;

   return (
      <ErrorBoundary
         fallback={() => <MountError title={meta.title} onRetry={() => window.location.reload()} />}
      >
         <GameShell meta={meta} definition={definition} />
      </ErrorBoundary>
   );
}
