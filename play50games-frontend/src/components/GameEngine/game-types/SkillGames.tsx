'use client';

import { useState, useEffect } from 'react';
import BallBalance from './skillgames-parts/BallBalance';
import TargetAim from './skillgames-parts/TargetAim';
import LineTracer from './skillgames-parts/LineTracer';
import TimingBar from './skillgames-parts/TimingBar';
import StackBlocks from './skillgames-parts/StackBlocks';
import PrecisionDrop from './skillgames-parts/PrecisionDrop';
import DragAndDropSort from './skillgames-parts/DragAndDropSort';
import SpeedDrawing from './skillgames-parts/SpeedDrawing';

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
    'drag-sort': <DragAndDropSort config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'speed-drawing': <SpeedDrawing config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'one-hand': <OneHand config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'cursor-maze': <CursorMaze config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
  };

  return gameComponents[currentGame] || <div>Skill game "{currentGame}" not found.</div>;
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

