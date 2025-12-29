'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Game } from '@/types/game';
import { getGame } from '@/lib/api/games';
import { getGuestId } from '@/lib/storage/progressStorage';
import GameEngine from '@/components/GameEngine/GameEngine';

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = parseInt(params.id as string);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestId] = useState(() => getGuestId());

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
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        minHeight: "100vh",
        width: "100%"
      }}>
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
      <GameEngine game={game} onComplete={handleComplete} onExit={handleExit} />
    </div>
  );
}

