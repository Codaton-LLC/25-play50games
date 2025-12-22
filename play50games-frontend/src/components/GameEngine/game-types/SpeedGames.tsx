'use client';

import { useState, useEffect } from 'react';

interface SpeedGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: () => void;
  isPlaying: boolean;
}

export default function SpeedGames({ config, onScoreUpdate, onComplete, isPlaying }: SpeedGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'click-green';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  if (currentGame === 'click-green') {
    return <ClickGreen config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />;
  }

  return <div>Loading speed game...</div>;
}

// Click the Green Game
function ClickGreen({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: () => void; isPlaying: boolean }) {
  const [items, setItems] = useState<Array<{ id: number; color: string; clicked: boolean }>>([]);
  const [score, setScore] = useState(0);
  const [correctClicks, setCorrectClicks] = useState(0);
  const [wrongClicks, setWrongClicks] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    
    generateItems();
    const interval = setInterval(() => {
      generateItems();
    }, 2000);

    return () => clearInterval(interval);
  }, [isPlaying, correctClicks]);

  useEffect(() => {
    // Game ends after 30 seconds or 50 correct clicks
    if (correctClicks >= 50) {
      const finalScore = Math.max(0, 100 - wrongClicks * 2);
      onScoreUpdate(finalScore);
      onComplete();
    }
  }, [correctClicks, wrongClicks, onScoreUpdate, onComplete]);

  const generateItems = () => {
    const colors = ['green', 'red', 'blue', 'yellow'];
    const newItems = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      color: colors[Math.floor(Math.random() * colors.length)],
      clicked: false,
    }));
    setItems(newItems);
  };

  const handleItemClick = (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item || item.clicked) return;

    const newItems = [...items];
    newItems[id].clicked = true;
    setItems(newItems);

    if (item.color === 'green') {
      setCorrectClicks(correctClicks + 1);
      setScore(score + 2);
      onScoreUpdate(score + 2);
    } else {
      setWrongClicks(wrongClicks + 1);
      setScore(Math.max(0, score - 1));
    }
  };

  return (
    <div className="click-green-game">
      <h3>Click the Green!</h3>
      <div className="speed-stats">
        <span>Correct: {correctClicks}</span>
        <span>Wrong: {wrongClicks}</span>
        <span>Score: {score}</span>
      </div>
      <div className="items-grid">
        {items.map((item) => (
          <button
            key={item.id}
            className={`speed-item ${item.color} ${item.clicked ? 'clicked' : ''}`}
            onClick={() => handleItemClick(item.id)}
            disabled={item.clicked}
          >
            {item.clicked ? '✓' : ''}
          </button>
        ))}
      </div>
      <p>Click only the green items!</p>
    </div>
  );
}

