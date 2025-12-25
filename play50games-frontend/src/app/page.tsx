'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Game } from '@/types/game';
import { getAllGames } from '@/lib/api/games';
import { getGuestId, getAllProgress } from '@/lib/storage/progressStorage';
import UnlockSystem from '@/components/UnlockSystem/UnlockSystem';
import { getGameInstructions } from '@/lib/utils/gameInstructions';
import { 
  TrophyIcon, 
  CheckBadgeIcon, 
  InformationCircleIcon, 
  ClockIcon, 
  StarIcon,
  PuzzlePieceIcon,
  BoltIcon,
  SparklesIcon,
  FireIcon,
  LightBulbIcon
} from '@heroicons/react/24/outline';

type GameCategory = 'all' | 'logic' | 'memory' | 'speed' | 'skill' | 'final';

export default function HomePage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestId] = useState(() => getGuestId());
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('all');
  const [gameProgress, setGameProgress] = useState<Record<number, { completed: boolean }>>({});

  useEffect(() => {
    loadGames();
    loadProgress();
    
    // Refresh progress when returning to home page
    const handleStorageChange = () => {
      loadProgress();
    };
    
    const handleProgressUpdate = () => {
      loadProgress();
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Listen for custom progress update events (for same-tab updates)
    window.addEventListener('play50games_progress_updated', handleProgressUpdate);
    // Also check on focus (when user returns to tab)
    window.addEventListener('focus', loadProgress);
    
    // Periodically check for progress updates (in case localStorage changes in same tab)
    const progressInterval = setInterval(() => {
      loadProgress();
    }, 2000); // Check every 2 seconds instead of 5
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('play50games_progress_updated', handleProgressUpdate);
      window.removeEventListener('focus', loadProgress);
      clearInterval(progressInterval);
    };
  }, []);

  const loadProgress = () => {
    const allProgress = getAllProgress();
    const progressMap: Record<number, { completed: boolean }> = {};
    Object.entries(allProgress).forEach(([gameId, progress]) => {
      progressMap[parseInt(gameId)] = { completed: progress.completed };
    });
    setGameProgress(progressMap);
  };

  const [error, setError] = useState<string | null>(null);

  const loadGames = async () => {
    try {
      const gamesData = await getAllGames(guestId);
      setGames(gamesData);
      setError(null);
    } catch (error: any) {
      console.error('Failed to load games:', error);
      const errorMessage = error.message || 'Failed to load games. Please check your WordPress API connection.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Filter games by category
  const filteredGames = useMemo(() => {
    if (selectedCategory === 'all') {
      return games;
    }
    return games.filter(game => game.game_type === selectedCategory);
  }, [games, selectedCategory]);

  // Group games by category for display
  const gamesByCategory = useMemo(() => {
    const grouped: Record<string, Game[]> = {
      logic: [],
      memory: [],
      speed: [],
      skill: [],
      final: [],
    };

    games.forEach(game => {
      if (grouped[game.game_type]) {
        grouped[game.game_type].push(game);
      }
    });

    return grouped;
  }, [games]);

  const categoryLabels: Record<GameCategory, { label: string; icon: React.ReactNode }> = {
    all: { label: 'All Games', icon: null },
    logic: { label: 'Logic & Puzzle', icon: <PuzzlePieceIcon style={{ width: 18, height: 18, display: 'inline', marginRight: 6 }} /> },
    memory: { label: 'Memory', icon: <SparklesIcon style={{ width: 18, height: 18, display: 'inline', marginRight: 6 }} /> },
    speed: { label: 'Speed & Reaction', icon: <BoltIcon style={{ width: 18, height: 18, display: 'inline', marginRight: 6 }} /> },
    skill: { label: 'Skill & Coordination', icon: <FireIcon style={{ width: 18, height: 18, display: 'inline', marginRight: 6 }} /> },
    final: { label: 'Final Games', icon: <TrophyIcon style={{ width: 18, height: 18, display: 'inline', marginRight: 6 }} /> },
  };

  if (loading) {
    return <div className="loading">Loading games...</div>;
  }

  // if (error) {
  //   return (
  //     <div className="home-page">
  //       <header>
  //         <h1>Play50Games</h1>
  //       </header>
  //       <div className="error-message">
  //         <h2>Connection Error</h2>
  //         <p>{error}</p>
  //         <p className="error-hint">
  //           <strong>To fix this:</strong><br />
  //           1. Make sure WordPress is running<br />
  //           2. Create a <code>.env.local</code> file with:<br />
  //           <code>NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1</code><br />
  //           3. Restart the Next.js dev server
  //         </p>
  //         <button onClick={loadGames} className="retry-button">Retry</button>
  //       </div>
  //     </div>
  //   );
  // }

  return (
    <div className="home-page">
      <header>
        <h1>Play50Games</h1>
        <p>Complete all games to earn your certificate!</p>
      </header>

      <nav className="main-nav">
        <Link href="/progress">
          <TrophyIcon className="nav-icon" />
          View Progress
        </Link>
        <Link href="/certificate">
          <CheckBadgeIcon className="nav-icon" />
          Certificate
        </Link>
        <Link href="/diagnostics">
          <InformationCircleIcon className="nav-icon" />
          Diagnostics
        </Link>
      </nav>

      {error && (
        <div style={{
          margin: '1rem auto',
          maxWidth: '800px',
          padding: '1rem',
          backgroundColor: '#fee',
          border: '2px solid #fcc',
          borderRadius: '8px',
          color: '#c33'
        }}>
          <h2 style={{ marginTop: 0 }}>Connection Error</h2>
          <p style={{ whiteSpace: 'pre-line' }}>{error}</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={loadGames}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginRight: '0.5rem'
              }}
            >
              Retry
            </button>
            <Link
              href="/diagnostics"
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#28a745',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                display: 'inline-block'
              }}
            >
              Run Diagnostics
            </Link>
          </div>
        </div>
      )}

      {games.length === 0 ? (
        <div className="no-games">
          <p>No games found. Please create games in WordPress Admin.</p>
        </div>
      ) : (
        <>
          {/* Category Filter Tabs */}
          <div className="category-filter">
            {(Object.keys(categoryLabels) as GameCategory[]).map((category) => {
              const count = category === 'all' 
                ? games.length 
                : gamesByCategory[category]?.length || 0;
              
              const categoryInfo = categoryLabels[category];
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
                >
                  {categoryInfo.icon}
                  {categoryInfo.label}
                  {count > 0 && <span className="category-count">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Games Display */}
          {selectedCategory === 'all' ? (
            // Show all games grouped by category
            <div className="games-by-category">
              {(Object.keys(gamesByCategory) as GameCategory[]).map((category) => {
                if (category === 'all' || !gamesByCategory[category]?.length) return null;
                
                return (
                  <div key={category} className="category-section">
                    <h2 className="category-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {categoryLabels[category].icon}
                      {categoryLabels[category].label}
                    </h2>
                    <div className="games-grid">
                      {gamesByCategory[category].map((game) => {
                        const gameType = game.game_config?.gameType || '';
                        const instructions = getGameInstructions(gameType, game.title);
                        const displayDescription = game.description || instructions.description;
                        
                        const isCompleted = gameProgress[game.id]?.completed || false;
                        
                        return (
                          <div key={game.id} className={`game-card ${!game.is_unlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}>
                            <UnlockSystem game={game} />
                            {isCompleted && (
                              <div className="completion-badge">
                                <CheckBadgeIcon style={{ width: 16, height: 16, marginRight: 4 }} />
                                Complete
                              </div>
                            )}
                            {game.is_unlocked ? (
                              <Link href={`/games/${game.id}`}>
                                <h3>{game.title}</h3>
                                <p className="game-description">{displayDescription}</p>
                                <div className="game-instructions">
                                  <p className="instructions-text">{instructions.instructions}</p>
                                  {instructions.tips && (
                                    <p className="game-tips" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <LightBulbIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                      {instructions.tips}
                                    </p>
                                  )}
                                </div>
                                <div className="game-meta">
                                  <span>
                                    <StarIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                                    Difficulty: {'★'.repeat(game.difficulty)}
                                  </span>
                                  <span>
                                    <ClockIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                                    Time: {game.time_limit}s
                                  </span>
                                  <span>Target: {game.passing_score}%</span>
                                </div>
                              </Link>
                            ) : (
                              <div>
                                <h3>{game.title}</h3>
                                <p className="locked-message">Complete previous games to unlock</p>
                                <div className="game-meta">
                                  <span>Difficulty: {'★'.repeat(game.difficulty)}</span>
                                  <span>Time: {game.time_limit}s</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Show filtered games for selected category
            <div className="games-grid">
              {filteredGames.length === 0 ? (
                <div className="no-games">
                  <p>No {categoryLabels[selectedCategory]} games found.</p>
                </div>
              ) : (
                filteredGames.map((game) => {
                  const gameType = game.game_config?.gameType || '';
                  const instructions = getGameInstructions(gameType, game.title);
                  const displayDescription = game.description || instructions.description;
                  const isCompleted = gameProgress[game.id]?.completed || false;
                  
                  return (
                    <div key={game.id} className={`game-card ${!game.is_unlocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}>
                      <UnlockSystem game={game} />
                      {isCompleted && (
                        <div className="completion-badge">
                          <CheckBadgeIcon style={{ width: 16, height: 16, marginRight: 4 }} />
                          Complete
                        </div>
                      )}
                      {game.is_unlocked ? (
                        <Link href={`/games/${game.id}`}>
                          <h3>{game.title}</h3>
                          <p className="game-description">{displayDescription}</p>
                          <div className="game-instructions">
                            <p className="instructions-text">{instructions.instructions}</p>
                            {instructions.tips && (
                              <p className="game-tips" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <LightBulbIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
                                {instructions.tips}
                              </p>
                            )}
                          </div>
                          <div className="game-meta">
                            <span>
                              <StarIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                              Difficulty: {'★'.repeat(game.difficulty)}
                            </span>
                            <span>
                              <ClockIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                              Time: {game.time_limit}s
                            </span>
                            <span>Target: {game.passing_score}%</span>
                          </div>
                        </Link>
                      ) : (
                        <div>
                          <h3>{game.title}</h3>
                          <p className="locked-message">Complete previous games to unlock</p>
                          <div className="game-meta">
                            <span>
                              <StarIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                              Difficulty: {'★'.repeat(game.difficulty)}
                            </span>
                            <span>
                              <ClockIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
                              Time: {game.time_limit}s
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

