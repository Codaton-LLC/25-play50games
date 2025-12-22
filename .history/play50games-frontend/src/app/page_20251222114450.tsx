'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Game } from '@/types/game';
import { getAllGames } from '@/lib/api/games';
import { getGuestId } from '@/lib/storage/progressStorage';
import UnlockSystem from '@/components/UnlockSystem/UnlockSystem';

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestId] = useState(() => getGuestId());

  useEffect(() => {
    loadGames();
  }, []);

  const [error, setError] = useState<string | null>(null);

  const loadGames = async () => {
    try {
      const gamesData = await getAllGames(guestId);
      setGames(gamesData);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load games:', error);
      setError(error.message || 'Failed to load games. Please check your WordPress API connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading games...</div>;
  }

  if (error) {
    return (
      <div className="home-page">
        <header>
          <h1>Play50Games</h1>
        </header>
        <div className="error-message">
          <h2>Connection Error</h2>
          <p>{error}</p>
          <p className="error-hint">
            <strong>To fix this:</strong><br />
            1. Make sure WordPress is running<br />
            2. Create a <code>.env.local</code> file with:<br />
            <code>NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1</code><br />
            3. Restart the Next.js dev server
          </p>
          <button onClick={loadGames} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <header>
        <h1>Play50Games</h1>
        <p>Complete all games to earn your certificate!</p>
      </header>

      <nav className="main-nav">
        <Link href="/progress">View Progress</Link>
        <Link href="/certificate">Certificate</Link>
      </nav>

      {games.length === 0 ? (
        <div className="no-games">
          <p>No games found. Please create games in WordPress Admin.</p>
        </div>
      ) : (
        <div className="games-grid">
          {games.map((game) => (
          <div key={game.id} className={`game-card ${!game.is_unlocked ? 'locked' : ''}`}>
            <UnlockSystem game={game} />
            {game.is_unlocked ? (
              <Link href={`/games/${game.id}`}>
                <h3>{game.title}</h3>
                <p>{game.description}</p>
                <div className="game-meta">
                  <span>Type: {game.game_type}</span>
                  <span>Difficulty: {'★'.repeat(game.difficulty)}</span>
                  <span>Time: {game.time_limit}s</span>
                </div>
              </Link>
            ) : (
              <div>
                <h3>{game.title}</h3>
                <p className="locked-message">Complete previous games to unlock</p>
              </div>
            )}
          </div>
        ))}
        </div>
      )}
    </div>
  );
}

