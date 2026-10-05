"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Game } from "@/types/game";
import { getGame } from "@/lib/api/games";
import { getGuestId } from "@/lib/storage/progressStorage";
import GameEngine from "@/components/GameEngine/GameEngine";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { useAuth } from "@/contexts/AuthContext";

export default function GamePage() {
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

   const handleComplete = (score: number) => {
      // Progress is already saved by GameEngine
   };

   const handleExit = () => {
      router.push("/classic");
   };

   if (loading) {
      return (
         <div
            style={{
               display: "flex",
               justifyContent: "center",
               alignItems: "center",
               minHeight: "100vh",
               width: "100%",
            }}
         >
            <span className="loader"></span>
         </div>
      );
   }

   if (!game) {
      return <div className="error">Game not found</div>;
   }

   if (!game.is_unlocked) {
      return (
         <div className="locked-game">
            <h2>Game Locked</h2>
            <p>Complete previous games to unlock this one.</p>
            <button onClick={handleExit}>Go Back</button>
         </div>
      );
   }

   return (
      <div className="game-page">
         <GameEngine
            game={game}
            onComplete={handleComplete}
            onExit={handleExit}
            onShowLoginModal={() => setShowLoginModal(true)}
            onShowRegisterModal={() => setShowRegisterModal(true)}
         />
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
