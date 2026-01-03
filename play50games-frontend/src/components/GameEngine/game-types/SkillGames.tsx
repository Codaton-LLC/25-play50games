'use client';

import { useState, useEffect } from 'react';
import BallBalance from './skillgames-parts/BallBalance';
import TargetAim from './skillgames-parts/TargetAim';
import LineTracer from './skillgames-parts/LineTracer';

interface SkillGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore?: number) => void;
  isPlaying: boolean;
}

export default function SkillGames({ config, onScoreUpdate, onComplete, isPlaying }: SkillGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'ball-balance';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  const gameComponents: Record<string, JSX.Element> = {
    'ball-balance': <BallBalance config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'target-aim': <TargetAim config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'line-tracer': <LineTracer config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'timing-bar': <TimingBar config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'stack-blocks': <StackBlocks config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'precision-drop': <PrecisionDrop config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'drag-sort': <DragSort config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'speed-drawing': <SpeedDrawing config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'one-hand': <OneHand config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'cursor-maze': <CursorMaze config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
  };

  return gameComponents[currentGame] || <div>Skill game "{currentGame}" not found.</div>;
}



// Timing Bar Game (39)
function TimingBar({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 5;
  const [barPosition, setBarPosition] = useState(0);
  const [targetZone, setTargetZone] = useState({ start: 40, end: 60 });
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    setTargetZone({
      start: 30 + Math.random() * 20,
      end: 50 + Math.random() * 20,
    });
    setBarPosition(0);
    setStopped(false);
    
    const interval = setInterval(() => {
      if (!stopped) {
        setBarPosition(prev => (prev + 2) % 100);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [round, rounds, stopped, score, onScoreUpdate, onComplete]);

  const handleStop = () => {
    if (stopped) return;
    setStopped(true);
    const inZone = barPosition >= targetZone.start && barPosition <= targetZone.end;
    if (inZone) {
      setScore(score + 20);
    }
    setTimeout(() => setRound(round + 1), 1000);
  };

  return (
    <div className="timing-bar-game">
      <h3>Timing Bar - Round {round + 1}/{rounds}</h3>
      <div className="bar-container">
        <div className="target-zone" style={{ left: `${targetZone.start}%`, width: `${targetZone.end - targetZone.start}%` }}></div>
        <div className="moving-bar" style={{ left: `${barPosition}%` }}></div>
      </div>
      <button onClick={handleStop} disabled={stopped}>Stop</button>
    </div>
  );
}

// Stack Blocks Game (40)
function StackBlocks({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const blocks = config.blocks || 10;
  const [stack, setStack] = useState<Array<{ width: number; x: number }>>([]);
  const [currentBlock, setCurrentBlock] = useState({ width: 50, x: 50 });
  const [blockCount, setBlockCount] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (blockCount >= blocks) {
      const avgOffset = stack.reduce((sum, block) => sum + Math.abs(block.x - 50), 0) / stack.length;
      const finalScore = Math.max(0, 100 - avgOffset * 2);
      setScore(finalScore);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    setCurrentBlock({
      width: 50 - blockCount * 2,
      x: 50,
    });
  }, [blockCount, blocks, stack, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentBlock(prev => ({
        ...prev,
        x: (prev.x + 1) % 100,
      }));
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, blockCount]);

  const handlePlace = () => {
    setStack([...stack, currentBlock]);
    setBlockCount(blockCount + 1);
  };

  return (
    <div className="stack-blocks-game">
      <h3>Stack Blocks - {blockCount}/{blocks}</h3>
      <div className="stack-area">
        {stack.map((block, i) => (
          <div
            key={i}
            className="stacked-block"
            style={{
              width: `${block.width}%`,
              left: `${block.x}%`,
            }}
          ></div>
        ))}
        <div
          className="current-block"
          style={{
            width: `${currentBlock.width}%`,
            left: `${currentBlock.x}%`,
          }}
        ></div>
      </div>
      <button onClick={handlePlace}>Place Block</button>
    </div>
  );
}

// Precision Drop Game (41)
function PrecisionDrop({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 5;
  const [objectPos, setObjectPos] = useState({ x: 50, y: 0 });
  const [targetPos] = useState({ x: 50, y: 80 });
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [dropped, setDropped] = useState(false);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    setObjectPos({ x: 50, y: 0 });
    setDropped(false);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (!isPlaying || dropped) return;
    
    const interval = setInterval(() => {
      setObjectPos(prev => {
        if (prev.y >= 100) {
          const distance = Math.abs(prev.x - targetPos.x);
          const roundScore = Math.max(0, 100 - distance * 2);
          setScore(score + roundScore);
          setDropped(true);
          setTimeout(() => setRound(round + 1), 1000);
          return prev;
        }
        return { ...prev, y: prev.y + 2 };
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, dropped, targetPos, round, score, onScoreUpdate, onComplete]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (dropped) return;
    if (e.key === 'ArrowLeft') setObjectPos(prev => ({ ...prev, x: Math.max(0, prev.x - 5) }));
    if (e.key === 'ArrowRight') setObjectPos(prev => ({ ...prev, x: Math.min(100, prev.x + 5) }));
  };

  return (
    <div className="precision-drop-game" onKeyDown={handleKeyPress} tabIndex={0}>
      <h3>Precision Drop - Round {round + 1}/{rounds}</h3>
      <div className="drop-area">
        <div className="target-zone" style={{ left: `${targetPos.x - 5}%`, top: `${targetPos.y}%` }}></div>
        <div className="falling-object" style={{ left: `${objectPos.x}%`, top: `${objectPos.y}%` }}>●</div>
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
        Use <ArrowLeftIcon style={{ width: 16, height: 16, display: 'inline' }} /> <ArrowRightIcon style={{ width: 16, height: 16, display: 'inline' }} /> to guide the object to the target
      </p>
    </div>
  );
}

// Drag & Drop Sort Game (42)
function DragSort({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const items = config.items || 8;
  const [categories, setCategories] = useState<{ [key: string]: number[] }>({
    'A': [],
    'B': [],
    'C': [],
  });
  const [itemList, setItemList] = useState<Array<{ id: number; value: number; category: string }>>([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    const newItems = Array.from({ length: items }, (_, i) => ({
      id: i,
      value: i + 1,
      category: ['A', 'B', 'C'][Math.floor((i + 1) / 3)],
    })).sort(() => Math.random() - 0.5);
    setItemList(newItems);
  }, []);

  useEffect(() => {
    const allSorted = Object.values(categories).every(cat => 
      cat.length > 0 && cat.every((val, i) => i === 0 || val > cat[i - 1])
    );
    if (allSorted && itemList.length === 0) {
      onScoreUpdate(100);
      setTimeout(() => onComplete(100), 1000);
    }
  }, [categories, itemList, onScoreUpdate, onComplete]);

  const handleDragStart = (id: number) => {
    setDraggedItem(id);
  };

  const handleDrop = (category: string) => {
    if (draggedItem === null) return;
    const item = itemList.find(i => i.id === draggedItem);
    if (!item) return;
    
    setCategories(prev => ({
      ...prev,
      [category]: [...prev[category], item.value].sort((a, b) => a - b),
    }));
    setItemList(itemList.filter(i => i.id !== draggedItem));
    setDraggedItem(null);
  };

  return (
    <div className="drag-sort-game">
      <h3>Drag & Drop Sort</h3>
      <div className="items-list">
        {itemList.map(item => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(item.id)}
            className="sortable-item"
          >
            {item.value}
          </div>
        ))}
      </div>
      <div className="categories">
        {Object.keys(categories).map(cat => (
          <div
            key={cat}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(cat)}
            className="category-box"
          >
            <h4>Category {cat}</h4>
            {categories[cat].map((val, i) => (
              <div key={i} className="sorted-item">{val}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Speed Drawing Game (43)
function SpeedDrawing({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 3;
  const [targetShape, setTargetShape] = useState<string>('');
  const [playerPath, setPlayerPath] = useState<Array<{ x: number; y: number }>>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const shapes = ['circle', 'square', 'triangle'];
    setTargetShape(shapes[Math.floor(Math.random() * shapes.length)]);
    setPlayerPath([]);
    setTimeLeft(10);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) {
      if (timeLeft <= 0 && round < rounds) {
        setRound(round + 1);
      }
      return;
    }
    
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft, round, rounds]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPlayerPath([...playerPath, { x, y }]);
  };

  const handleSubmit = () => {
    // Simple shape recognition (simplified)
    const roundScore = playerPath.length > 10 ? 50 : 0;
    setScore(score + roundScore);
    setRound(round + 1);
  };

  return (
    <div className="speed-drawing-game">
      <h3>Speed Drawing - Round {round + 1}/{rounds}</h3>
      <p>Time: {timeLeft}s</p>
      <p>Draw a {targetShape}</p>
      <div
        className="drawing-area"
        onMouseDown={() => setIsDrawing(true)}
        onMouseUp={() => setIsDrawing(false)}
        onMouseMove={handleMouseMove}
      >
        <svg className="drawing-svg">
          {playerPath.length > 1 && (
            <path
              d={`M ${playerPath.map(p => `${p.x},${p.y}`).join(' L ')}`}
              stroke="black"
              fill="none"
            />
          )}
        </svg>
      </div>
      <button onClick={handleSubmit} disabled={timeLeft <= 0}>Submit</button>
    </div>
  );
}

// One-Hand Mode Game (44)
function OneHand({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const rounds = config.rounds || 5;
  const [targets, setTargets] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const newTargets = Array.from({ length: 3 }, (_, i) => ({
      id: i,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
    }));
    setTargets(newTargets);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleTargetClick = (id: number) => {
    setTargets(targets.filter(t => t.id !== id));
    setScore(score + 20);
    
    if (targets.length === 1) {
      setRound(round + 1);
    }
  };

  return (
    <div className="one-hand-game">
      <h3>One-Hand Mode - Round {round + 1}/{rounds}</h3>
      <p>Click all targets using only one hand</p>
      <div className="one-hand-area">
        {targets.map(target => (
          <button
            key={target.id}
            onClick={() => handleTargetClick(target.id)}
            className="one-hand-target"
            style={{ left: `${target.x}%`, top: `${target.y}%` }}
          >
            Click
          </button>
        ))}
      </div>
    </div>
  );
}

// Cursor Maze Game (45)
function CursorMaze({ config, onScoreUpdate, onComplete, isPlaying }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void; isPlaying: boolean }) {
  const [cursorPos, setCursorPos] = useState({ x: 10, y: 10 });
  const [walls, setWalls] = useState<Set<string>>(new Set());
  const [exitPos] = useState({ x: 90, y: 90 });
  const [touchingWall, setTouchingWall] = useState(false);

  useEffect(() => {
    const newWalls = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * 10) * 10;
      const y = Math.floor(Math.random() * 10) * 10;
      if (!(x === 10 && y === 10) && !(x === 90 && y === 90)) {
        newWalls.add(`${x},${y}`);
      }
    }
    setWalls(newWalls);
    setCursorPos({ x: 10, y: 10 });
  }, []);

  useEffect(() => {
    if (cursorPos.x === exitPos.x && cursorPos.y === exitPos.y) {
      onScoreUpdate(100);
      setTimeout(() => onComplete(100), 1000);
    }
    
    const isTouching = walls.has(`${Math.floor(cursorPos.x / 10) * 10},${Math.floor(cursorPos.y / 10) * 10}`);
    setTouchingWall(isTouching);
    if (isTouching) {
      setCursorPos({ x: 10, y: 10 });
    }
  }, [cursorPos, exitPos, walls, onScoreUpdate, onComplete]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCursorPos({ x, y });
  };

  return (
    <div className="cursor-maze-game" onMouseMove={handleMouseMove}>
      <h3>Cursor Maze</h3>
      <p>Navigate to the exit (E) without touching walls</p>
      <div className="maze-area">
        {Array.from({ length: 100 }).map((_, i) => {
          const x = (i % 10) * 10;
          const y = Math.floor(i / 10) * 10;
          const isWall = walls.has(`${x},${y}`);
          const isExit = exitPos.x === x && exitPos.y === y;
          
          return (
            <div
              key={i}
              className={`maze-cell ${isWall ? 'wall' : ''} ${isExit ? 'exit' : ''}`}
            >
              {isExit && 'E'}
            </div>
          );
        })}
        <div
          className="cursor"
          style={{ left: `${cursorPos.x}%`, top: `${cursorPos.y}%` }}
        >●</div>
      </div>
      {touchingWall && <p className="error">Wall touched! Reset to start.</p>}
    </div>
  );
}

