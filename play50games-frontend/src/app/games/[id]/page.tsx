"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Game } from "@/types/game";
import { getGame } from "@/lib/api/games";
import { getGuestId } from "@/lib/storage/progressStorage";
import GameEngine from "@/components/GameEngine/GameEngine";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { LockIcon } from "@/components/Site/icons";
import ui from "@/components/Site/ui.module.css";
import { useAuth } from "@/contexts/AuthContext";
import GameBar from "./GameBar";
import styles from "./page.module.css";

export default function GamePage() {
   const params = useParams();
   const router = useRouter();
   const gameId = parseInt(params.id as string);
   const [game, setGame] = useState<Game | null>(null);
   const [loading, setLoading] = useState(true);
   const [guestId] = useState(() => getGuestId());
   const [showLoginModal, setShowLoginModal] = useState(false);
   const [showRegisterModal, setShowRegisterModal] = useState(false);
   const { user, login, register } = useAuth();

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
         <main className={styles.state} aria-busy="true" aria-label="Loading the game">
            <div className={styles.skeleton}>
               <div className={`${styles.bone} ${styles.boneTitle}`} />
               <div className={`${styles.bone} ${styles.boneLine}`} />
               <div className={`${styles.bone} ${styles.boneCard}`} />
            </div>
         </main>
      );
   } else if (!game) {
      body = (
         <main className={styles.state}>
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
         </main>
      );
   } else if (!game.is_unlocked) {
      body = (
         <main className={styles.state}>
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
         </main>
      );
   } else {
      body = (
         <GameEngine
            game={game}
            onComplete={handleComplete}
            onExit={handleExit}
            onShowLoginModal={() => setShowLoginModal(true)}
            onShowRegisterModal={() => setShowRegisterModal(true)}
            siteHeader={false}
         />
      );
   }

   // .p50-night: the page is always dark (page.module.css says why), and its sheets follow it
   return (
      <div className={`p50-night game-page ${styles.page}`}>
         <GameBar game={game} user={user} onLogin={() => setShowLoginModal(true)} />
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
      </div>
   );
}
