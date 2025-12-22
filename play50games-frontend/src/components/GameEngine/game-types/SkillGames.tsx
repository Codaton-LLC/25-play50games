'use client';

import { useState, useEffect, useRef } from 'react';

interface SkillGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: () => void;
  isPlaying: boolean;
}

export default function SkillGames({ config, onScoreUpdate, onComplete, isPlaying }: SkillGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'ball-balance';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  if (currentGame === 'ball-balance') {
    return <BallBalance config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />;
  }

  return <div>Loading skill game...</div>;
}

// Ball Balance Game
function BallBalance({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: () => void }) {
  const [ballPosition, setBallPosition] = useState({ x: 50, y: 50 });
  const [platformAngle, setPlatformAngle] = useState(0);
  const [score, setScore] = useState(0);
  const [timeInCenter, setTimeInCenter] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setBallPosition((prev) => {
        // Update ball position based on platform angle
        const gravity = 0.5;
        const newX = prev.x + Math.sin(platformAngle * Math.PI / 180) * 2;
        const newY = prev.y + Math.cos(platformAngle * Math.PI / 180) * 2 + gravity;
        
        // Keep ball in bounds
        const clampedX = Math.max(10, Math.min(90, newX));
        const clampedY = Math.max(10, Math.min(90, newY));
        
        // Check if ball is in center (scoring zone)
        const centerX = 50;
        const centerY = 50;
        const distance = Math.sqrt(Math.pow(clampedX - centerX, 2) + Math.pow(clampedY - centerY, 2));
        
        if (distance < 15) {
          setTimeInCenter((prev) => prev + 1);
          setScore((prev) => {
            const newScore = prev + 1;
            onScoreUpdate(newScore);
            return newScore;
          });
        }
        
        return { x: clampedX, y: clampedY };
      });
    }, 50);

    return () => clearInterval(interval);
  }, [platformAngle, isPlaying, onScoreUpdate]);

  useEffect(() => {
    if (timeInCenter >= 100) {
      onComplete();
    }
  }, [timeInCenter, onComplete]);

  const handleKeyPress = (e: any) => {
    if (e.key === 'ArrowLeft') {
      setPlatformAngle(Math.max(-30, platformAngle - 2));
    } else if (e.key === 'ArrowRight') {
      setPlatformAngle(Math.min(30, platformAngle + 2));
    }
  };

  return (
    <div 
      className="ball-balance-game" 
      ref={gameAreaRef}
      onKeyDown={(e) => handleKeyPress(e.nativeEvent)}
      tabIndex={0}
    >
      <h3>Ball Balance</h3>
      <p>Use ← → arrow keys to balance the ball in the center</p>
      <div className="game-stats">
        <span>Time in Center: {timeInCenter}/100</span>
        <span>Score: {score}</span>
      </div>
      <div className="balance-area">
        <div 
          className="platform" 
          style={{ transform: `rotate(${platformAngle}deg)` }}
        ></div>
        <div 
          className="ball" 
          style={{ 
            left: `${ballPosition.x}%`, 
            top: `${ballPosition.y}%` 
          }}
        ></div>
        <div className="center-zone"></div>
      </div>
    </div>
  );
}

