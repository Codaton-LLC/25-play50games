'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GameProgress } from '@/types/game';
import { getAllProgress } from '@/lib/storage/progressStorage';
import { getAllGames } from '@/lib/api/games';
import { Game } from '@/types/game';
import { getGuestId } from '@/lib/storage/progressStorage';
import { ArrowLeftIcon, CheckCircleIcon, CircleStackIcon } from '@heroicons/react/24/outline';

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
    return gameProgress && gameProgress.completed === true;
  });

  const totalScore = Object.values(progress).reduce((sum, p) => sum + (p.best_score || 0), 0);
  const completionPercentage = games.length > 0 
    ? Math.round((completedGames.length / games.length) * 100) 
    : 0;

  if (loading) {
    return <div className="loading">Loading progress...</div>;
  }

  return (
    <div className="progress-page">
      <header>
        <h1>Your Progress</h1>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeftIcon style={{ width: 16, height: 16 }} />
          Back to Games
        </Link>
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
        <div 
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "20px",
            marginTop: "24px"
          }}
        >
          {games.map((game) => {
            const gameProgress = progress[game.id];
            const isCompleted = gameProgress?.completed === true;
            const bestScore = gameProgress?.best_score || 0;
            
            return (
              <Link 
                key={game.id} 
                href={`/games/${game.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit"
                }}
              >
                <div 
                  className="progress-item"
                  style={{
                    background: "var(--card)",
                    border: isCompleted 
                      ? "2px solid var(--ok)" 
                      : bestScore > 0 
                      ? "2px solid var(--accent)" 
                      : "2px solid var(--stroke)",
                    borderRadius: "16px",
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    position: "relative",
                    boxShadow: isCompleted 
                      ? "0 8px 24px rgba(134, 239, 172, 0.2)" 
                      : "0 4px 12px rgba(0, 0, 0, 0.1)",
                    height: "100%",
                    minHeight: "280px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = isCompleted 
                      ? "0 12px 32px rgba(134, 239, 172, 0.3)" 
                      : "0 8px 20px rgba(125, 211, 252, 0.3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = isCompleted 
                      ? "0 8px 24px rgba(134, 239, 172, 0.2)" 
                      : "0 4px 12px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  {/* Completion Badge */}
                  {isCompleted && (
                    <div
                      style={{
                        position: "absolute",
                        top: "12px",
                        right: "12px",
                        background: "var(--ok)",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(134, 239, 172, 0.4)"
                      }}
                    >
                      <CheckCircleIcon style={{ width: 20, height: 20, color: "white" }} />
                    </div>
                  )}

                  {/* Game Info */}
                  <div className="progress-info" style={{ flex: "1 1 auto" }}>
                    <h3
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 700,
                        margin: 0,
                        marginBottom: "12px",
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px"
                      }}
                    >
                      <span
                        style={{
                          background: "rgba(125, 211, 252, 0.2)",
                          borderRadius: "8px",
                          padding: "4px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--accent)",
                          minWidth: "32px",
                          textAlign: "center"
                        }}
                      >
                        #{game.game_order || game.id}
                      </span>
                      {game.title}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "var(--muted)",
                        margin: 0,
                        lineHeight: "1.5",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}
                    >
                      {game.description}
                    </p>
                  </div>

                  {/* Progress Details */}
                  <div className="progress-details" style={{ flex: "0 0 auto", marginTop: "auto" }}>
                    {gameProgress ? (
                      <>
                        <div 
                          style={{
                            width: "100%",
                            height: "8px",
                            background: "rgba(255, 255, 255, 0.1)",
                            borderRadius: "4px",
                            overflow: "hidden",
                            marginBottom: "12px"
                          }}
                        >
                          <div 
                            className="progress-fill" 
                            style={{ 
                              width: `${Math.min(100, bestScore)}%`,
                              height: "100%",
                              background: isCompleted
                                ? "linear-gradient(90deg, var(--ok) 0%, rgba(134, 239, 172, 0.8) 100%)"
                                : "linear-gradient(90deg, var(--accent) 0%, rgba(125, 211, 252, 0.8) 100%)",
                              borderRadius: "4px",
                              transition: "width 0.3s ease",
                              boxShadow: isCompleted
                                ? "0 0 10px rgba(134, 239, 172, 0.5)"
                                : "0 0 10px rgba(125, 211, 252, 0.5)"
                            }}
                          ></div>
                        </div>
                        <div 
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            fontSize: "0.875rem"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                            <span style={{ color: "var(--muted)" }}>Score:</span>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{bestScore} / 100</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                            <span style={{ color: "var(--muted)" }}>Attempts:</span>
                            <span style={{ fontWeight: 600, color: "var(--text)" }}>{gameProgress.attempts || 0}</span>
                          </div>
                          <div 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "6px",
                              justifyContent: "center",
                              marginTop: "4px",
                              padding: "6px 12px",
                              background: isCompleted 
                                ? "rgba(134, 239, 172, 0.1)" 
                                : "rgba(125, 211, 252, 0.1)",
                              borderRadius: "8px",
                              fontSize: "0.8rem",
                              fontWeight: 600,
                              color: isCompleted ? "var(--ok)" : "var(--accent)"
                            }}
                          >
                            {isCompleted ? (
                              <>
                                <CheckCircleIcon style={{ width: 16, height: 16 }} />
                                <span>Completed</span>
                              </>
                            ) : bestScore > 0 ? (
                              <>
                                <CircleStackIcon style={{ width: 16, height: 16 }} />
                                <span>In Progress</span>
                              </>
                            ) : (
                              <>
                                <CircleStackIcon style={{ width: 16, height: 16 }} />
                                <span>Not Started</span>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "20px",
                          color: "var(--muted)",
                          fontSize: "0.875rem"
                        }}
                      >
                        <CircleStackIcon style={{ width: 32, height: 32, marginBottom: "8px", opacity: 0.5 }} />
                        <span>Not started</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

