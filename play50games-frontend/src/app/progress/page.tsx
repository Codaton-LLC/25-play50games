'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GameProgress } from '@/types/game';
import { getAllProgress } from '@/lib/storage/progressStorage';
import { getAllGames } from '@/lib/api/games';
import { Game } from '@/types/game';
import { getGuestId } from '@/lib/storage/progressStorage';

export default function ProgressPage() {
  const [progress, setProgress] = useState<Record<number, GameProgress>>({});
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestId] = useState(() => getGuestId());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [progressData, gamesData] = await Promise.all([
        Promise.resolve(getAllProgress()),
        getAllGames(guestId),
      ]);
      setProgress(progressData);
      setGames(gamesData);
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedGames = games.filter(game => {
    const gameProgress = progress[game.id];
    return gameProgress && gameProgress.completed;
  });

  const totalScore = Object.values(progress).reduce((sum, p) => sum + (p.best_score || 0), 0);
  const completionPercentage = Math.round((completedGames.length / games.length) * 100);

  if (loading) {
    return <div className="loading">Loading progress...</div>;
  }

  return (
    <div className="progress-page">
      <header>
        <h1>Your Progress</h1>
        <Link href="/">← Back to Games</Link>
      </header>

      <div className="progress-stats">
        <div className="stat-card">
          <h3>Completion</h3>
          <p className="big-number">{completionPercentage}%</p>
          <p>{completedGames.length} of {games.length} games completed</p>
        </div>
        <div className="stat-card">
          <h3>Total Score</h3>
          <p className="big-number">{totalScore}</p>
          <p>Best scores combined</p>
        </div>
      </div>

      <div className="progress-list">
        <h2>Game Progress</h2>
        {games.map((game) => {
          const gameProgress = progress[game.id];
          return (
            <div key={game.id} className="progress-item">
              <div className="progress-info">
                <h3>{game.title}</h3>
                <p>{game.description}</p>
              </div>
              <div className="progress-details">
                {gameProgress ? (
                  <>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${Math.min(100, (gameProgress.best_score / 100) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="progress-stats">
                      <span>Best Score: {gameProgress.best_score}</span>
                      <span>Attempts: {gameProgress.attempts}</span>
                      <span className={gameProgress.completed ? 'completed' : 'incomplete'}>
                        {gameProgress.completed ? '✓ Completed' : '○ In Progress'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="not-started">Not started</p>
                )}
              </div>
              {gameProgress && !gameProgress.completed && (
                <Link href={`/games/${game.id}`} className="continue-button">
                  Continue Playing
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

