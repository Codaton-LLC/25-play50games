'use client';

import { useState, useEffect } from 'react';

interface LogicGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: () => void;
  isPlaying: boolean;
}

export default function LogicGames({ config, onScoreUpdate, onComplete, isPlaying }: LogicGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const maxRounds = config.rounds || 5;

  useEffect(() => {
    if (!isPlaying) return;
    
    // Determine which logic game to play based on config
    const gameType = config.gameType || 'match-shapes';
    
    if (gameType === 'match-shapes') {
      setCurrentGame('match-shapes');
    } else if (gameType === 'color-sequence') {
      setCurrentGame('color-sequence');
    } else {
      setCurrentGame('match-shapes'); // Default
    }
    
    setRound(0);
    setScore(0);
  }, [isPlaying, config]);

  useEffect(() => {
    if (round >= maxRounds && isPlaying) {
      // Calculate final score
      const finalScore = Math.round((score / maxRounds) * 100);
      onScoreUpdate(finalScore);
      onComplete();
    }
  }, [round, maxRounds, score, isPlaying, onScoreUpdate, onComplete]);

  if (currentGame === 'match-shapes') {
    return <MatchShapes config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />;
  }
  
  if (currentGame === 'color-sequence') {
    return <ColorSequence config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />;
  }

  return <div>Loading game...</div>;
}

// Match the Shapes Game
function MatchShapes({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [shapes] = useState(config.shapes || ['circle', 'square', 'triangle']);
  const [targetShape, setTargetShape] = useState('');
  const [selectedShape, setSelectedShape] = useState('');
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    // Set random target shape
    const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
    setTargetShape(randomShape);
    setSelectedShape('');
    setCorrect(null);
  }, []);

  const handleShapeClick = (shape: string) => {
    setSelectedShape(shape);
    const isCorrect = shape === targetShape;
    setCorrect(isCorrect);
    
    setTimeout(() => {
      onScoreUpdate(isCorrect ? 20 : 0);
      // Reset for next round
      const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
      setTargetShape(randomShape);
      setSelectedShape('');
      setCorrect(null);
    }, 1000);
  };

  return (
    <div className="match-shapes-game">
      <h3>Match the Shape</h3>
      <div className="target-shape">
        <div className={`shape ${targetShape}`}></div>
      </div>
      <div className="shape-options">
        {shapes.map((shape: string) => (
          <button
            key={shape}
            onClick={() => handleShapeClick(shape)}
            className={`shape-button ${selectedShape === shape ? (correct ? 'correct' : 'incorrect') : ''}`}
            disabled={selectedShape !== ''}
          >
            <div className={`shape ${shape}`}></div>
          </button>
        ))}
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Try again!'}
        </p>
      )}
    </div>
  );
}

// Color Sequence Game
function ColorSequence({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const colors = ['red', 'blue', 'green', 'yellow'];
  const [sequence, setSequence] = useState<string[]>([]);
  const [playerSequence, setPlayerSequence] = useState<string[]>([]);
  const [showingSequence, setShowingSequence] = useState(true);
  const [level, setLevel] = useState(1);

  useEffect(() => {
    startNewLevel();
  }, []);

  const startNewLevel = () => {
    const newSequence = [];
    for (let i = 0; i < level; i++) {
      newSequence.push(colors[Math.floor(Math.random() * colors.length)]);
    }
    setSequence(newSequence);
    setPlayerSequence([]);
    setShowingSequence(true);
    
    // Show sequence
    setTimeout(() => {
      setShowingSequence(false);
    }, 2000);
  };

  const handleColorClick = (color: string) => {
    if (showingSequence) return;
    
    const newPlayerSequence = [...playerSequence, color];
    setPlayerSequence(newPlayerSequence);
    
    // Check if correct
    if (newPlayerSequence.length === sequence.length) {
      const isCorrect = newPlayerSequence.every((c, i) => c === sequence[i]);
      if (isCorrect) {
        onScoreUpdate(20 * level);
        setLevel(level + 1);
        setTimeout(() => startNewLevel(), 1000);
      } else {
        onScoreUpdate(0);
        setLevel(1);
        setTimeout(() => startNewLevel(), 1000);
      }
    }
  };

  return (
    <div className="color-sequence-game">
      <h3>Color Sequence - Level {level}</h3>
      {showingSequence ? (
        <div className="sequence-display">
          {sequence.map((color, index) => (
            <div key={index} className={`color-box ${color}`} style={{ animationDelay: `${index * 0.5}s` }}></div>
          ))}
          <p>Watch the sequence...</p>
        </div>
      ) : (
        <div className="color-options">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorClick(color)}
              className={`color-button ${color}`}
            >
              {color}
            </button>
          ))}
          <p>Repeat the sequence</p>
        </div>
      )}
    </div>
  );
}

