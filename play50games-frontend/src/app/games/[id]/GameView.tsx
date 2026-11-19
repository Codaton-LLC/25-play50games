"use client";

// The classic game page's client part: loads the game, checks the unlock chain and runs GameEngine.
// The site header and footer around it come from page.tsx (a server component).
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Game } from "@/types/game";
import { getGame } from "@/lib/api/games";
import { getGuestId } from "@/lib/storage/progressStorage";
import GameEngine from "@/components/GameEngine/GameEngine";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { ArrowLeftIcon, LockIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./page.module.css";

const CATEGORY: Record<Game["game_type"], string> = {
   logic: "Logic",
   memory: "Memory",
   speed: "Speed",
   skill: "Skill",
   final: "Final",
};

export interface GameViewProps {
   /** the game title from the server: the h1 of the page while the game loads and plays */
   heading: string;
}

export default function GameView({ heading }: GameViewProps) {
   const params = useParams();
   const router = useRouter();
   const gameId = parseInt(params.id as string);
   const [game, setGame] = useState<Game | null>(null);
   const [loading, setLoading] = useState(true);
   const [guestId] = useState(() => getGuestId());
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);
   const { login, register } = useAuth();

   // Add final-game class to body only for specific games: mixed-quiz, survival-mode, boss-puzzle
   // Add it during loading based on gameId (46, 47, 48) so loading is yellow
   useEffect(() => {
      // Always remove final-game class first
      document.body.classList.remove("final-game");

      // Allowed game IDs: 46 (mixed-quiz), 47 (survival-mode), 48 (boss-puzzle)
      const allowedGameIds = [54, 55, 56, 57, 58];
      const isAllowedById = allowedGameIds.includes(gameId);

      // If game is loaded, check by gameType; otherwise check by gameId during loading
      if (game) {
         const gameType = game.game_config?.gameType || "";
         const allowedGames = [
            "mixed-quiz",
            "survival-mode",
            "boss-puzzle",
            "time-challenge",
            "final-test",
         ];
         const shouldAdd = allowedGames.includes(gameType);

         if (shouldAdd) {
            document.body.classList.add("final-game");
         }
      } else if (isAllowedById) {
         // During loading, add class based on gameId
         document.body.classList.add("final-game");
      }

      return () => {
         document.body.classList.remove("final-game");
      };
   }, [gameId, game]);

   useEffect(() => {
      loadGame();
   }, [gameId]);

   const loadGame = async () => {
      try {
         const gameData = await getGame(gameId, guestId);
         setGame(gameData);
      } catch (error) {
         // Failed to load game
      } finally {
         setLoading(false);
      }
   };

   const retry = () => {
      setLoading(true);
      loadGame();
   };

   const handleComplete = (score: number) => {
      // Progress is already saved by GameEngine
   };

   const handleExit = () => {
      router.push("/classic");
   };

   let body: ReactNode;
   if (loading) {
      // the start screen's outline: title, description, the How to Play card
      body = (
         <div className={styles.stage} aria-busy="true" aria-label="Loading the game">
            <div className={styles.state}>
               <div className={styles.skeleton}>
                  <div className={`${styles.bone} ${styles.boneTitle}`} />
                  <div className={`${styles.bone} ${styles.boneLine}`} />
                  <div className={`${styles.bone} ${styles.boneCard}`} />
               </div>
            </div>
         </div>
      );
   } else if (!game) {
      body = (
         <div className={styles.state}>
            <span className={`${ui.plate} ${ui.plateLg}`} aria-hidden="true">
               50
            </span>
            <h1 className={styles.stateTitle}>This game did not load</h1>
            <p className={styles.stateText}>
               The link may be old, or the connection dropped. Your progress is safe.
            </p>
            <div className={styles.stateActions}>
               <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={retry}>
                  Try again
               </button>
               <Link href="/classic" className={`${ui.btn} ${ui.btnQuiet}`}>
                  Back to Classic 50
               </Link>
            </div>
         </div>
      );
   } else if (!game.is_unlocked) {
      body = (
         <div className={styles.state}>
            <span className={styles.stateIcon} aria-hidden="true">
               <LockIcon />
            </span>
            <h1 className={styles.stateTitle}>This game is still locked</h1>
            <p className={styles.stateText}>Pass the games before it on the path and this one opens.</p>
            <div className={styles.stateActions}>
               <Link href="/classic" className={`${ui.btn} ${ui.btnPrimary}`}>
                  Back to the path
               </Link>
            </div>
         </div>
      );
   } else {
      // the stage: the game, on the theme's values (page.module.css)
      body = (
         <div className={styles.stage}>
            <GameEngine
               game={game}
               onComplete={handleComplete}
               onExit={handleExit}
               onShowLoginModal={() => setShowLoginModal(true)}
               onShowRegisterModal={() => setShowRegisterModal(true)}
               siteHeader={false}
            />
         </div>
      );
   }

   return (
      <main className={styles.main}>
         <nav className={styles.crumbs} aria-label="Breadcrumb">
            <Link href="/classic" className={styles.back}>
               <ArrowLeftIcon />
               Classic 50
            </Link>
            {game && <span className={styles.chip}>{CATEGORY[game.game_type] ?? "Game"}</span>}
         </nav>
         {/* The not-loaded and locked states carry their own h1. Hidden from sight only: the start
             screen shows the title itself and the layout of the board must not move. */}
         {loading || game?.is_unlocked ? <h1 className={ui.srOnly}>{game?.title ?? heading}</h1> : null}
         {body}
         <LoginModal
            isOpen={showLoginModal}
            onClose={() => setShowLoginModal(false)}
            onLogin={login}
            onSwitchToRegister={() => {
               setShowLoginModal(false);
               setShowRegisterModal(true);
            }}
         />
         <RegisterModal
            isOpen={showRegisterModal}
            onClose={() => setShowRegisterModal(false)}
            onRegister={register}
            onSwitchToLogin={() => {
               setShowRegisterModal(false);
               setShowLoginModal(true);
            }}
         />
      </main>
   );
}
