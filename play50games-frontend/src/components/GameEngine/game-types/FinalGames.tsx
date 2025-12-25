'use client';

import { useState, useEffect } from 'react';
import LogicGames from './LogicGames';
import MemoryGames from './MemoryGames';
import SpeedGames from './SpeedGames';
import SkillGames from './SkillGames';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface FinalGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore?: number) => void;
  isPlaying: boolean;
}

export default function FinalGames({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'mixed-quiz';
    setCurrentGame(gameType);
    setRound(0);
    setScore(0);
  }, [isPlaying, config]);

  const gameComponents: Record<string, JSX.Element> = {
    'mixed-quiz': <MixedQuiz config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'survival-mode': <SurvivalMode config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'boss-puzzle': <BossPuzzle config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'time-challenge': <TimeChallenge config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
    'final-test': <FinalTest config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} isPlaying={isPlaying} />,
  };

  return gameComponents[currentGame] || <div>Final game "{currentGame}" not found.</div>;
}

// Mixed Quiz Game (46)
function MixedQuiz({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const rounds = config.rounds || 5;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [currentMiniGame, setCurrentMiniGame] = useState<string>('');

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const gameTypes = ['logic', 'memory', 'speed', 'skill'];
    const randomType = gameTypes[Math.floor(Math.random() * gameTypes.length)];
    setCurrentMiniGame(randomType);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleMiniGameComplete = (miniScore: number) => {
    setScore(score + miniScore);
    setRound(round + 1);
  };

  const miniGameConfigs: Record<string, Record<string, any>> = {
    'logic': { gameType: 'number-order', numbers: 5 },
    'memory': { gameType: 'number-recall', digits: 4 },
    'speed': { gameType: 'fast-math', rounds: 3 },
    'skill': { gameType: 'target-aim', targets: 5 },
  };

  const renderMiniGame = () => {
    const miniConfig = miniGameConfigs[currentMiniGame];
    if (!miniConfig) return <div>Loading...</div>;
    
    switch (currentMiniGame) {
      case 'logic':
        return <LogicGames config={miniConfig} onScoreUpdate={() => {}} onComplete={(s) => handleMiniGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'memory':
        return <MemoryGames config={miniConfig} onScoreUpdate={() => {}} onComplete={(s) => handleMiniGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'speed':
        return <SpeedGames config={miniConfig} onScoreUpdate={() => {}} onComplete={(s) => handleMiniGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'skill':
        return <SkillGames config={miniConfig} onScoreUpdate={() => {}} onComplete={(s) => handleMiniGameComplete(s || 0)} isPlaying={isPlaying} />;
      default:
        return <div>Unknown game type</div>;
    }
  };

  return (
    <div className="mixed-quiz-game">
      <h3>Mixed Quiz - Round {round + 1}/{rounds}</h3>
      {renderMiniGame()}
    </div>
  );
}

// Survival Mode Game (47)
function SurvivalMode({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const games = config.games || 5;
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [failed, setFailed] = useState(false);

  const gameSequence = [
    { type: 'logic', config: { gameType: 'number-order', numbers: 5 } },
    { type: 'memory', config: { gameType: 'card-flip', gridSize: 3, pairs: 4 } },
    { type: 'speed', config: { gameType: 'fast-math', rounds: 5 } },
    { type: 'skill', config: { gameType: 'target-aim', targets: 5 } },
    { type: 'logic', config: { gameType: 'balance-scale' } },
  ];

  const handleGameComplete = (gameScore: number) => {
    if (gameScore < 70) {
      setFailed(true);
      onScoreUpdate(score);
      setTimeout(() => onComplete(score), 1000);
      return;
    }
    
    setScore(score + gameScore);
    if (currentGameIndex < games - 1) {
      setCurrentGameIndex(currentGameIndex + 1);
    } else {
      onScoreUpdate(score + gameScore);
      setTimeout(() => onComplete(score + gameScore), 1000);
    }
  };

  if (failed) {
    return (
      <div className="survival-mode-game">
        <h3>Survival Mode - Failed!</h3>
        <p>You didn't pass round {currentGameIndex + 1}</p>
        <p>Final Score: {score}</p>
      </div>
    );
  }

  const currentGame = gameSequence[currentGameIndex % gameSequence.length];
  
  const renderGame = () => {
    switch (currentGame.type) {
      case 'logic':
        return <LogicGames config={currentGame.config} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'memory':
        return <MemoryGames config={currentGame.config} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'speed':
        return <SpeedGames config={currentGame.config} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'skill':
        return <SkillGames config={currentGame.config} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      default:
        return <div>Unknown game</div>;
    }
  };

  return (
    <div className="survival-mode-game">
      <h3>Survival Mode - Game {currentGameIndex + 1}/{games}</h3>
      {renderGame()}
    </div>
  );
}

// Boss Puzzle Game (48)
function BossPuzzle({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const [puzzleState, setPuzzleState] = useState({
    logic: false,
    memory: false,
    speed: false,
    skill: false,
  });
  const [score, setScore] = useState(0);

  useEffect(() => {
    const allComplete = Object.values(puzzleState).every(complete => complete);
    if (allComplete) {
      onScoreUpdate(100);
      setTimeout(() => onComplete(100), 1000);
    }
  }, [puzzleState, onScoreUpdate, onComplete]);

  const handlePuzzleComplete = (type: keyof typeof puzzleState) => {
    setPuzzleState(prev => ({ ...prev, [type]: true }));
    setScore(score + 25);
  };

  return (
    <div className="boss-puzzle-game">
      <h3>Boss Puzzle</h3>
      <p>Complete all 4 challenges</p>
      <div className="puzzle-grid">
        <div className="puzzle-challenge">
          <h4>Logic Challenge</h4>
          {!puzzleState.logic ? (
            <LogicGames
              config={{ gameType: 'tile-slider', gridSize: 3 }}
              onScoreUpdate={() => {}}
              onComplete={(s) => s && s >= 70 && handlePuzzleComplete('logic')}
              isPlaying={isPlaying}
            />
          ) : (
            <div className="completed" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Completed
            </div>
          )}
        </div>
        <div className="puzzle-challenge">
          <h4>Memory Challenge</h4>
          {!puzzleState.memory ? (
            <MemoryGames
              config={{ gameType: 'card-flip', gridSize: 4, pairs: 8 }}
              onScoreUpdate={() => {}}
              onComplete={(s) => s && s >= 70 && handlePuzzleComplete('memory')}
              isPlaying={isPlaying}
            />
          ) : (
            <div className="completed" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Completed
            </div>
          )}
        </div>
        <div className="puzzle-challenge">
          <h4>Speed Challenge</h4>
          {!puzzleState.speed ? (
            <SpeedGames
              config={{ gameType: 'reaction-test', rounds: 5 }}
              onScoreUpdate={() => {}}
              onComplete={(s) => s && s >= 70 && handlePuzzleComplete('speed')}
              isPlaying={isPlaying}
            />
          ) : (
            <div className="completed" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Completed
            </div>
          )}
        </div>
        <div className="puzzle-challenge">
          <h4>Skill Challenge</h4>
          {!puzzleState.skill ? (
            <SkillGames
              config={{ gameType: 'target-aim', targets: 10 }}
              onScoreUpdate={() => {}}
              onComplete={(s) => s && s >= 70 && handlePuzzleComplete('skill')}
              isPlaying={isPlaying}
            />
          ) : (
            <div className="completed" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircleIcon style={{ width: 18, height: 18 }} />
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Time Challenge Game (49)
function TimeChallenge({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const duration = config.duration || 60;
  const [timeLeft, setTimeLeft] = useState(duration);
  const [currentGame, setCurrentGame] = useState<string>('');
  const [score, setScore] = useState(0);
  const [gamesCompleted, setGamesCompleted] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          const finalScore = Math.round((score / gamesCompleted) || 0);
          onScoreUpdate(finalScore);
          setTimeout(() => onComplete(finalScore), 1000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPlaying, duration, score, gamesCompleted, onScoreUpdate, onComplete]);

  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) return;
    
    const gameTypes = ['number-order', 'card-flip', 'fast-math', 'target-aim'];
    const randomGame = gameTypes[Math.floor(Math.random() * gameTypes.length)];
    setCurrentGame(randomGame);
  }, [isPlaying, timeLeft, gamesCompleted]);

  const handleGameComplete = (gameScore: number) => {
    setScore(score + gameScore);
    setGamesCompleted(gamesCompleted + 1);
  };

  const getGameComponent = () => {
    switch (currentGame) {
      case 'number-order':
        return <LogicGames config={{ gameType: 'number-order', numbers: 5 }} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'card-flip':
        return <MemoryGames config={{ gameType: 'card-flip', gridSize: 3, pairs: 4 }} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'fast-math':
        return <SpeedGames config={{ gameType: 'fast-math', rounds: 3 }} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      case 'target-aim':
        return <SkillGames config={{ gameType: 'target-aim', targets: 3 }} onScoreUpdate={() => {}} onComplete={(s) => handleGameComplete(s || 0)} isPlaying={isPlaying} />;
      default:
        return <div>Loading challenge...</div>;
    }
  };

  return (
    <div className="time-challenge-game">
      <h3>Time Challenge</h3>
      <p>Time: {timeLeft}s | Completed: {gamesCompleted}</p>
      {getGameComponent()}
    </div>
  );
}

// Final Certification Test (50)
function FinalTest({ config, onScoreUpdate, onComplete, isPlaying }: FinalGamesProps) {
  const rounds = config.rounds || 10;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [currentChallenge, setCurrentChallenge] = useState<{ type: string; config: Record<string, any> } | null>(null);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    
    const challenges = [
      { type: 'logic', config: { gameType: 'tile-slider', gridSize: 3 } },
      { type: 'memory', config: { gameType: 'color-sequence', rounds: 5 } },
      { type: 'speed', config: { gameType: 'reaction-test', rounds: 5 } },
      { type: 'skill', config: { gameType: 'ball-balance' } },
      { type: 'logic', config: { gameType: 'sudoku-4x4' } },
      { type: 'memory', config: { gameType: 'card-flip', gridSize: 4, pairs: 8 } },
      { type: 'speed', config: { gameType: 'fast-math', rounds: 5 } },
      { type: 'skill', config: { gameType: 'target-aim', targets: 10 } },
      { type: 'logic', config: { gameType: 'balance-scale' } },
      { type: 'memory', config: { gameType: 'number-recall', digits: 5 } },
    ];
    
    setCurrentChallenge(challenges[round % challenges.length]);
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const handleChallengeComplete = (challengeScore: number) => {
    setScore(score + challengeScore);
    setRound(round + 1);
  };

  const renderChallenge = () => {
    if (!currentChallenge) return <div>Loading...</div>;
    
    switch (currentChallenge.type) {
      case 'logic':
        return <LogicGames config={currentChallenge.config} onScoreUpdate={() => {}} onComplete={(s) => handleChallengeComplete(s || 0)} isPlaying={isPlaying} />;
      case 'memory':
        return <MemoryGames config={currentChallenge.config} onScoreUpdate={() => {}} onComplete={(s) => handleChallengeComplete(s || 0)} isPlaying={isPlaying} />;
      case 'speed':
        return <SpeedGames config={currentChallenge.config} onScoreUpdate={() => {}} onComplete={(s) => handleChallengeComplete(s || 0)} isPlaying={isPlaying} />;
      case 'skill':
        return <SkillGames config={currentChallenge.config} onScoreUpdate={() => {}} onComplete={(s) => handleChallengeComplete(s || 0)} isPlaying={isPlaying} />;
      default:
        return <div>Unknown challenge</div>;
    }
  };

  return (
    <div className="final-test-game">
      <h3>Final Certification Test</h3>
      <p>Round {round + 1}/{rounds}</p>
      {renderChallenge()}
    </div>
  );
}

