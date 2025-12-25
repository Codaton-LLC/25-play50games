'use client';

import { useState, useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon, ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface SpeedGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore?: number) => void;
  isPlaying: boolean;
}

export default function SpeedGames({ config, onScoreUpdate, onComplete, isPlaying }: SpeedGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'click-green';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  const gameComponents: Record<string, JSX.Element> = {
    'click-green': <ClickGreen config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'avoid-red': <AvoidRed config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'reaction-test': <ReactionTest config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'fast-math': <FastMath config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'whack-shape': <WhackShape config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'typing-sprint': <TypingSprint config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'quick-compare': <QuickCompare config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'falling-objects': <FallingObjects config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'tap-counter': <TapCounter config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'reflex-arrows': <ReflexArrows config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
  };

  return gameComponents[currentGame] || <div>Speed game "{currentGame}" not found.</div>;
}

// Click the Green Game
function ClickGreen({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
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
      onComplete(finalScore);
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
            {item.clicked ? <CheckCircleIcon style={{ width: 20, height: 20 }} /> : ''}
          </button>
        ))}
      </div>
      <p>Click only the green items!</p>
    </div>
  );
}

// Avoid the Red Game (27)
function AvoidRed({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const duration = config.duration || 30;
  const [playerPos, setPlayerPos] = useState({ x: 50, y: 50 });
  const [obstacles, setObstacles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          onScoreUpdate(score);
          setTimeout(() => onComplete(score), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const obstacleTimer = setInterval(() => {
      setObstacles(prev => [...prev, {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 100,
      }].slice(-10));
    }, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(obstacleTimer);
    };
  }, [isPlaying, duration, score, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const checkCollision = () => {
      const collision = obstacles.some(obs => {
        const dist = Math.sqrt(Math.pow(playerPos.x - obs.x, 2) + Math.pow(playerPos.y - obs.y, 2));
        return dist < 10;
      });
      if (collision) {
        onScoreUpdate(score);
        setTimeout(() => onComplete(score), 1000);
      }
    };
    
    const interval = setInterval(checkCollision, 100);
    return () => clearInterval(interval);
  }, [obstacles, playerPos, isPlaying, score, onScoreUpdate, onComplete]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    let newPos = { ...playerPos };
    if (e.key === 'ArrowUp') newPos.y = Math.max(0, newPos.y - 5);
    if (e.key === 'ArrowDown') newPos.y = Math.min(100, newPos.y + 5);
    if (e.key === 'ArrowLeft') newPos.x = Math.max(0, newPos.x - 5);
    if (e.key === 'ArrowRight') newPos.x = Math.min(100, newPos.x + 5);
    setPlayerPos(newPos);
    setScore(score + 1);
  };

  return (
    <div className="avoid-red-game" onKeyDown={handleKeyPress} tabIndex={0}>
      <h3>Avoid the Red</h3>
      <p>Time: {timeLeft}s | Score: {score}</p>
      <div className="avoid-area">
        <div
          className="player"
          style={{ left: `${playerPos.x}%`, top: `${playerPos.y}%` }}
        >P</div>
        {obstacles.map(obs => (
          <div
            key={obs.id}
            className="red-obstacle"
            style={{ left: `${obs.x}%`, top: `${obs.y}%` }}
          ></div>
        ))}
      </div>
      <p>Use arrow keys to avoid red obstacles</p>
    </div>
  );
}

// Reaction Test Game (28)
function ReactionTest({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 10;
  const [waiting, setWaiting] = useState(true);
  const [startTime, setStartTime] = useState(0);
  const [reactionTime, setReactionTime] = useState(0);
  const [round, setRound] = useState(0);
  const [scores, setScores] = useState<number[]>([]);

  useEffect(() => {
    if (round >= rounds) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      onScoreUpdate(avgScore);
      setTimeout(() => onComplete(avgScore), 1000);
      return;
    }
    
    const waitTime = Math.random() * 3000 + 1000;
    const timer = setTimeout(() => {
      setWaiting(false);
      setStartTime(Date.now());
    }, waitTime);

    return () => clearTimeout(timer);
  }, [round, rounds, scores, onScoreUpdate, onComplete]);

  const handleClick = () => {
    if (waiting) {
      onScoreUpdate(0);
      setRound(round + 1);
      setWaiting(true);
      return;
    }
    
    const time = Date.now() - startTime;
    setReactionTime(time);
    const score = Math.max(0, 100 - time / 10);
    setScores([...scores, score]);
    setRound(round + 1);
    setWaiting(true);
  };

  return (
    <div className="reaction-test-game">
      <h3>Reaction Test - Round {round + 1}/{rounds}</h3>
      <div 
        className={`reaction-area ${waiting ? 'waiting' : 'click-now'}`}
        onClick={handleClick}
      >
        {waiting ? 'Wait...' : 'CLICK NOW!'}
      </div>
      {reactionTime > 0 && (
        <p>Reaction time: {reactionTime}ms</p>
      )}
    </div>
  );
}

// Fast Math Game (29)
function FastMath({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 10;
  const [problem, setProblem] = useState<{ a: number; b: number; op: string; answer: number } | null>(null);
  const [input, setInput] = useState('');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    generateProblem();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const generateProblem = () => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const op = Math.random() > 0.5 ? '+' : '-';
    const answer = op === '+' ? a + b : a - b;
    setProblem({ a, b, op, answer });
    setInput('');
  };

  const handleSubmit = () => {
    if (parseInt(input) === problem?.answer) {
      setScore(score + 10);
    }
    setRound(round + 1);
  };

  return (
    <div className="fast-math-game">
      <h3>Fast Math - Round {round + 1}/{rounds}</h3>
      {problem && (
        <div>
          <div className="math-problem">
            {problem.a} {problem.op} {problem.b} = ?
          </div>
          <input
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit()}
            className="math-input"
            autoFocus
          />
          <button onClick={handleSubmit}>Submit</button>
        </div>
      )}
    </div>
  );
}

// Whack-a-Shape Game (30)
function WhackShape({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 20;
  const [targetShape, setTargetShape] = useState<string>('');
  const [shapes, setShapes] = useState<Array<{ id: number; type: string; x: number; y: number }>>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const shapeTypes = ['circle', 'square', 'triangle'];
    const target = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    setTargetShape(target);
    
    const newShapes = Array.from({ length: 9 }, (_, i) => ({
      id: i,
      type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
      x: (i % 3) * 33,
      y: Math.floor(i / 3) * 33,
    }));
    setShapes(newShapes);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleShapeClick = (id: number) => {
    const shape = shapes.find(s => s.id === id);
    if (shape?.type === targetShape) {
      setScore(score + 5);
      setRound(round + 1);
    } else {
      setScore(Math.max(0, score - 2));
    }
  };

  return (
    <div className="whack-shape-game">
      <h3>Whack-a-Shape - Round {round + 1}/{rounds}</h3>
      <p>Click the {targetShape}!</p>
      <div className="whack-grid">
        {shapes.map(shape => (
          <button
            key={shape.id}
            onClick={() => handleShapeClick(shape.id)}
            className={`whack-item ${shape.type}`}
          >
            <div className={`shape ${shape.type}`}></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Typing Sprint Game (31)
function TypingSprint({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const words = config.words || 10;
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [score, setScore] = useState(0);
  const wordList = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew', 'kiwi', 'lemon'];

  useEffect(() => {
    if (wordIndex >= words) {
      const finalScore = Math.round((score / words) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    setCurrentWord(wordList[wordIndex % wordList.length]);
    setInput('');
  }, [wordIndex, words, score, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (input === currentWord && currentWord) {
      setScore(score + 10);
      setWordIndex(wordIndex + 1);
    }
  }, [input, currentWord, wordIndex, score]);

  return (
    <div className="typing-sprint-game">
      <h3>Typing Sprint - Word {wordIndex + 1}/{words}</h3>
      <div className="word-display">{currentWord}</div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="typing-input"
        autoFocus
      />
      <p>Type the word as fast as you can!</p>
    </div>
  );
}

// Quick Compare Game (32)
function QuickCompare({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 15;
  const [numbers, setNumbers] = useState<{ a: number; b: number } | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    setNumbers({
      a: Math.floor(Math.random() * 100),
      b: Math.floor(Math.random() * 100),
    });
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleSelect = (choice: 'greater' | 'less' | 'equal') => {
    if (!numbers) return;
    
    let isCorrect = false;
    if (choice === 'greater') isCorrect = numbers.a > numbers.b;
    else if (choice === 'less') isCorrect = numbers.a < numbers.b;
    else isCorrect = numbers.a === numbers.b;
    
    if (isCorrect) {
      setScore(score + 6);
    }
    setRound(round + 1);
  };

  return (
    <div className="quick-compare-game">
      <h3>Quick Compare - Round {round + 1}/{rounds}</h3>
      {numbers && (
        <div>
          <div className="compare-numbers">
            <div className="number">{numbers.a}</div>
            <div className="vs">vs</div>
            <div className="number">{numbers.b}</div>
          </div>
          <div className="compare-options">
            <button onClick={() => handleSelect('greater')}>A &gt; B</button>
            <button onClick={() => handleSelect('equal')}>A = B</button>
            <button onClick={() => handleSelect('less')}>A &lt; B</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Falling Objects Game (33)
function FallingObjects({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const duration = config.duration || 30;
  const [objects, setObjects] = useState<Array<{ id: number; type: 'good' | 'bad'; y: number }>>([]);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          const finalScore = Math.max(0, 100 - missed * 5);
          onScoreUpdate(finalScore);
          setTimeout(() => onComplete(finalScore), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const objectTimer = setInterval(() => {
      setObjects(prev => [...prev, {
        id: Date.now(),
        type: Math.random() > 0.5 ? 'good' : 'bad',
        y: 0,
      }]);
    }, 1000);

    const fallTimer = setInterval(() => {
      setObjects(prev => prev.map(obj => ({ ...obj, y: obj.y + 2 })).filter(obj => {
        if (obj.y > 100) {
          if (obj.type === 'good') setMissed(missed + 1);
          return false;
        }
        return true;
      }));
    }, 50);

    return () => {
      clearInterval(timer);
      clearInterval(objectTimer);
      clearInterval(fallTimer);
    };
  }, [isPlaying, duration, missed, onScoreUpdate, onComplete]);

  const handleObjectClick = (id: number, type: 'good' | 'bad') => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (type === 'good') {
      setScore(score + 5);
    } else {
      setScore(Math.max(0, score - 3));
    }
  };

  return (
    <div className="falling-objects-game">
      <h3>Falling Objects</h3>
      <p>Time: {timeLeft}s | Score: {score}</p>
      <div className="falling-area">
        {objects.map(obj => (
          <button
            key={obj.id}
            onClick={() => handleObjectClick(obj.id, obj.type)}
            className={`falling-object ${obj.type}`}
            style={{ top: `${obj.y}%`, left: `${Math.random() * 80 + 10}%` }}
          >
            {obj.type === 'good' ? <CheckCircleIcon style={{ width: 20, height: 20 }} /> : <XCircleIcon style={{ width: 20, height: 20 }} />}
          </button>
        ))}
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        Catch good items (<CheckCircleIcon style={{ width: 16, height: 16, display: 'inline' }} />), avoid bad ones (<XCircleIcon style={{ width: 16, height: 16, display: 'inline' }} />)
      </p>
    </div>
  );
}

// Tap Counter Game (34)
function TapCounter({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const duration = config.duration || 10;
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) {
          const finalScore = Math.min(100, taps * 2);
          onScoreUpdate(finalScore);
          setTimeout(() => onComplete(finalScore), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, duration, taps, onScoreUpdate, onComplete]);

  const handleTap = () => {
    setTaps(taps + 1);
  };

  return (
    <div className="tap-counter-game">
      <h3>Tap Counter</h3>
      <p>Time: {timeLeft}s</p>
      <div className="tap-area" onClick={handleTap}>
        <div className="tap-count">{taps}</div>
        <p>Tap as fast as you can!</p>
      </div>
    </div>
  );
}

// Reflex Arrows Game (35)
function ReflexArrows({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 15;
  const [targetArrow, setTargetArrow] = useState<string>('');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const arrow = arrows[Math.floor(Math.random() * arrows.length)];
    setTargetArrow(arrow);
    setStartTime(Date.now());
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === targetArrow) {
      const reactionTime = Date.now() - startTime;
      const roundScore = Math.max(0, 100 - reactionTime / 10);
      setScore(score + roundScore);
      setRound(round + 1);
    }
  };

  const arrowSymbols: Record<string, string> = {
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
  };

  return (
    <div className="reflex-arrows-game" onKeyDown={handleKeyPress} tabIndex={0}>
      <h3>Reflex Arrows - Round {round + 1}/{rounds}</h3>
      <div className="arrow-display">
        <div className="target-arrow">{arrowSymbols[targetArrow]}</div>
      </div>
      <p>Press the arrow key shown!</p>
    </div>
  );
}

