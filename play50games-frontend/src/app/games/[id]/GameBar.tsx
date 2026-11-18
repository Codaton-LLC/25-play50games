"use client";

// The slim top bar of a classic game page: the way back to the Classic 50 path, the game's category,
// and the account. It replaces the legacy site header inside GameEngine (siteHeader={false}).
// It scrolls away with the page, like the header it replaces, so the play view keeps its height.
// No "game 7 of 50" here: the API's game_order has a gap (0 to 50 for 50 games), and the number
// the path shows is the game's place in the sorted list, which this page does not load.
import Link from "next/link";
import type { Game } from "@/types/game";
import { ArrowLeftIcon, BrandMark } from "@/components/Site/icons";
import { initialsOf } from "@/components/Site/siteData";
import ui from "@/components/Site/ui.module.css";
import styles from "./GameBar.module.css";

const CATEGORY: Record<Game["game_type"], string> = {
   logic: "Logic",
   memory: "Memory",
   speed: "Speed",
   skill: "Skill",
   final: "Final",
};

type BarUser = { first_name?: string; last_name?: string; display_name?: string; email?: string };

export interface GameBarProps {
   /** null while the game loads, or when it could not be loaded */
   game: Game | null;
   user: BarUser | null;
   onLogin: () => void;
}

export default function GameBar({ game, user, onLogin }: GameBarProps) {
   return (
      <header className={styles.bar}>
         <div className={styles.inner}>
            <Link href="/classic" className={`${ui.iconBtn} ${styles.back}`} aria-label="Back to Classic 50">
               <ArrowLeftIcon />
            </Link>
            <Link href="/classic" className={styles.world}>
               <BrandMark className={styles.mark} />
               <span className={styles.worldName}>Classic 50</span>
            </Link>
            {game && <span className={styles.chip}>{CATEGORY[game.game_type] ?? "Game"}</span>}
            <span className={styles.spacer} />
            {user ? (
               <Link href="/progress" className={styles.avatar} aria-label="My progress">
                  {initialsOf(user)}
               </Link>
            ) : (
               <button type="button" className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm} ${styles.login}`} onClick={onLogin}>
                  Log in
               </button>
            )}
         </div>
      </header>
   );
}
