'use client';

import { useState, useEffect, useCallback } from 'react';
import { Game } from '@/types/game';
import { saveProgress } from '@/lib/storage/progressStorage';
import LogicGames from './game-types/LogicGames';
import MemoryGames from './game-types/MemoryGames';
import SpeedGames from './game-types/SpeedGames';
import SkillGames from './game-types/SkillGames';

interface GameEngineProps {
  game: Game;
  onComplete: (score: number) => void;
  onExit: () => void;
}

export default function GameEngine({ game, onComplete, onExit }: GameEngineProps) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(game.time_limit);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isPlaying || isCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleGameEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, isCompleted]);

  const handleGameEnd = useCallback(async () => {
    if (isCompleted) return;
    
    setIsCompleted(true);
    setIsPlaying(false);
    
    const completed = score >= game.passing_score;
    
    // Save progress
    await saveProgress(game.id, score, completed);
    
    // Call completion callback
    onComplete(score);
  }, [score, game, isCompleted, onComplete]);

  const startGame = () => {
    setIsPlaying(true);
    setTimeLeft(game.time_limit);
    setScore(0);
    setIsCompleted(false);
  };

  const updateScore = (newScore: number) => {
    setScore(newScore);
  };

  const renderGame = () => {
    const gameConfig = game.game_config || {};
    
    switch (game.game_type) {
      case 'logic':
        return (
          <LogicGames
            config={gameConfig}
            onScoreUpdate={updateScore}
            onComplete={handleGameEnd}
            isPlaying={isPlaying}
          />
        );
      case 'memory':
        return (
          <MemoryGames
            config={gameConfig}
            onScoreUpdate={updateScore}
            onComplete={handleGameEnd}
            isPlaying={isPlaying}
          />
        );
      case 'speed':
        return (
          <SpeedGames
            config={gameConfig}
            onScoreUpdate={updateScore}
            onComplete={handleGameEnd}
            isPlaying={isPlaying}
          />
        );
      case 'skill':
        return (
          <SkillGames
            config={gameConfig}
            onScoreUpdate={updateScore}
            onComplete={handleGameEnd}
            isPlaying={isPlaying}
          />
        );
      default:
        return <div>Unknown game type</div>;
    }
  };

  if (!isPlaying && !isCompleted) {
    return (
      <div className="game-start-screen">
        <h2>{game.title}</h2>
        <p>{game.description}</p>
        <div className="game-info">
          <p>Time Limit: {game.time_limit} seconds</p>
          <p>Passing Score: {game.passing_score}</p>
        </div>
        <button onClick={startGame} className="start-button">
          Start Game
        </button>
        <button onClick={onExit} className="exit-button">
          Exit
        </button>
      </div>
    );
  }

  return (
    <div className="game-engine">
      <div className="game-header">
        <div className="game-title">{game.title}</div>
        <div className="game-stats">
          <div className="stat">
            <span>Score:</span>
            <strong>{score}</strong>
          </div>
          <div className="stat">
            <span>Time:</span>
            <strong>{timeLeft}s</strong>
          </div>
          <div className="stat">
            <span>Target:</span>
            <strong>{game.passing_score}</strong>
          </div>
        </div>
        <button onClick={onExit} className="exit-button-small">
          ×
        </button>
      </div>
      
      <div className="game-content">
        {renderGame()}
      </div>
      
      {isCompleted && (
        <div className="game-complete-overlay">
          <div className="completion-message">
            <h2>Game Complete!</h2>
            <p>Final Score: {score}</p>
            <p className={score >= game.passing_score ? 'success' : 'failure'}>
              {score >= game.passing_score ? '✓ Passed!' : '✗ Try Again'}
            </p>
            <button onClick={onExit}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}

