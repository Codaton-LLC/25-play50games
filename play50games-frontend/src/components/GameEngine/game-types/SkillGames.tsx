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
import OneHandMode from './skillgames-parts/OneHandMode';
import CursorMaze from './skillgames-parts/CursorMaze';

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
    
    const gameType = config.gameType;
    
    // Check if gameType is empty string or invalid
    if (gameType && gameType.trim() !== "") {
      setCurrentGame(gameType);
    } else {
      // Default fallback
      setCurrentGame('ball-balance');
    }
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
    'one-hand-mode': <OneHandMode config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'cursor-maze': <CursorMaze config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
  };

  return gameComponents[currentGame] || <div>Skill game "{currentGame}" not found.</div>;
}
