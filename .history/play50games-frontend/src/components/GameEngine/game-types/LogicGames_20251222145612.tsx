'use client';

import { useState, useEffect } from 'react';

interface LogicGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore?: number) => void;
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
    setCurrentGame(gameType);
    setRound(0);
    setScore(0);
  }, [isPlaying, config]);

  useEffect(() => {
    if (round >= maxRounds && isPlaying) {
      // Calculate final score
      const finalScore = Math.round((score / maxRounds) * 100);
      onScoreUpdate(finalScore);
      // Pass the final score directly to onComplete
      onComplete(finalScore);
    }
  }, [round, maxRounds, score, isPlaying, onScoreUpdate, onComplete]);

  const gameComponents: Record<string, JSX.Element> = {
    'match-shapes': <MatchShapes config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'color-sequence': <ColorSequence config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'number-order': <NumberOrder config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'find-odd-one': <FindOddOne config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'tile-slider': <TileSlider config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} onComplete={onComplete} />,
    'balance-scale': <BalanceScale config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'light-switch': <LightSwitch config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} onComplete={onComplete} />,
    'maze-escape': <MazeEscape config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} onComplete={onComplete} />,
    'pattern-completion': <PatternCompletion config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'sudoku-4x4': <Sudoku4x4 config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} onComplete={onComplete} />,
    'rotate-to-fit': <RotateToFit config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'mirror-match': <MirrorMatch config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'logic-gates': <LogicGates config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'sequence-arrows': <SequenceArrows config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} />,
    'block-fill': <BlockFill config={config} onScoreUpdate={(s) => { setScore(score + s); setRound(round + 1); }} onComplete={onComplete} />,
  };

  return gameComponents[currentGame] || <div>Game "{currentGame}" not found. Loading default...</div>;
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

// Number Order Game (3)
function NumberOrder({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const numbers = config.numbers || 5;
  const [shuffled, setShuffled] = useState<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const nums = Array.from({ length: numbers }, (_, i) => i + 1);
    setShuffled([...nums].sort(() => Math.random() - 0.5));
    setSelected([]);
  }, []);

  const handleNumberClick = (num: number) => {
    if (selected.includes(num)) return;
    const newSelected = [...selected, num];
    setSelected(newSelected);
    
    if (newSelected.length === numbers) {
      const isCorrect = newSelected.every((n, i) => n === i + 1);
      setCorrect(isCorrect);
      onScoreUpdate(isCorrect ? 100 : 0);
    }
  };

  return (
    <div className="number-order-game">
      <h3>Number Order</h3>
      <p>Click numbers from smallest to largest</p>
      <div className="number-grid">
        {shuffled.map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num)}
            className={`number-btn ${selected.includes(num) ? 'selected' : ''}`}
            disabled={selected.includes(num)}
          >
            {num}
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

// Find the Odd One Game (4)
function FindOddOne({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const gridSize = config.gridSize || 3;
  const [items, setItems] = useState<Array<{ id: number; type: string; isOdd: boolean }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const total = gridSize * gridSize;
    const oddIndex = Math.floor(Math.random() * total);
    const baseType = Math.random() > 0.5 ? 'circle' : 'square';
    
    const newItems = Array.from({ length: total }, (_, i) => ({
      id: i,
      type: i === oddIndex ? (baseType === 'circle' ? 'square' : 'circle') : baseType,
      isOdd: i === oddIndex,
    }));
    setItems(newItems);
  }, []);

  const handleClick = (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    
    setSelected(id);
    const isCorrect = item.isOdd;
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="find-odd-one-game">
      <h3>Find the Odd One</h3>
      <div className="odd-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            className={`odd-item ${item.type} ${selected === item.id ? (correct ? 'correct' : 'incorrect') : ''}`}
          >
            <div className={`shape ${item.type}`}></div>
          </button>
        ))}
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Wrong! Try again.'}
        </p>
      )}
    </div>
  );
}

// Tile Slider Game (5)
function TileSlider({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 3;
  const total = gridSize * gridSize;
  const [tiles, setTiles] = useState<number[]>([]);
  const [emptyIndex, setEmptyIndex] = useState(total - 1);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const nums = Array.from({ length: total - 1 }, (_, i) => i + 1);
    setTiles([...nums].sort(() => Math.random() - 0.5));
    setEmptyIndex(total - 1);
    setMoves(0);
  }, []);

  useEffect(() => {
    const isSolved = tiles.every((tile, i) => tile === i + 1);
    if (isSolved && tiles.length === total - 1) {
      const score = Math.max(0, 100 - moves * 2);
      onScoreUpdate(score);
      setTimeout(() => onComplete(score), 1000);
    }
  }, [tiles, moves, total, onScoreUpdate, onComplete]);

  const canMove = (index: number) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;
    const emptyRow = Math.floor(emptyIndex / gridSize);
    const emptyCol = emptyIndex % gridSize;
    return (row === emptyRow && Math.abs(col - emptyCol) === 1) || 
           (col === emptyCol && Math.abs(row - emptyRow) === 1);
  };

  const handleTileClick = (index: number) => {
    if (!canMove(index)) return;
    
    const newTiles = [...tiles];
    newTiles.splice(emptyIndex, 0, tiles[index]);
    newTiles.splice(index, 1);
    setTiles(newTiles);
    setEmptyIndex(index);
    setMoves(moves + 1);
  };

  return (
    <div className="tile-slider-game">
      <h3>Tile Slider Puzzle</h3>
      <p>Moves: {moves}</p>
      <div className="slider-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="slider-cell">
            {i === emptyIndex ? (
              <div className="empty-cell"></div>
            ) : (
              <button
                onClick={() => handleTileClick(i)}
                className={`slider-tile ${canMove(i) ? 'movable' : ''}`}
              >
                {tiles[i]}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Balance the Scale Game (6)
function BalanceScale({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [leftWeight, setLeftWeight] = useState(0);
  const [rightWeight, setRightWeight] = useState(0);
  const [selected, setSelected] = useState<'left' | 'right' | 'equal' | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const left = Math.floor(Math.random() * 10) + 1;
    const right = Math.floor(Math.random() * 10) + 1;
    setLeftWeight(left);
    setRightWeight(right);
    setSelected(null);
    setCorrect(null);
  }, []);

  const handleSelect = (choice: 'left' | 'right' | 'equal') => {
    setSelected(choice);
    let isCorrect = false;
    if (choice === 'left') isCorrect = leftWeight > rightWeight;
    else if (choice === 'right') isCorrect = rightWeight > leftWeight;
    else isCorrect = leftWeight === rightWeight;
    
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="balance-scale-game">
      <h3>Balance the Scale</h3>
      <div className="scale-display">
        <div className="scale-left">
          <div className="weight">{leftWeight}</div>
        </div>
        <div className="scale-beam"></div>
        <div className="scale-right">
          <div className="weight">{rightWeight}</div>
        </div>
      </div>
      <div className="scale-options">
        <button onClick={() => handleSelect('left')} className={selected === 'left' ? (correct ? 'correct' : 'incorrect') : ''}>
          Left is Heavier
        </button>
        <button onClick={() => handleSelect('equal')} className={selected === 'equal' ? (correct ? 'correct' : 'incorrect') : ''}>
          Equal
        </button>
        <button onClick={() => handleSelect('right')} className={selected === 'right' ? (correct ? 'correct' : 'incorrect') : ''}>
          Right is Heavier
        </button>
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Wrong!'}
        </p>
      )}
    </div>
  );
}

// Light Switch Puzzle (7)
function LightSwitch({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 3;
  const [lights, setLights] = useState<boolean[][]>([]);
  const [moves, setMoves] = useState(0);
  const maxMoves = config.maxMoves || 10;

  useEffect(() => {
    const newLights = Array(gridSize).fill(null).map(() => 
      Array(gridSize).fill(false).map(() => Math.random() > 0.5)
    );
    setLights(newLights);
    setMoves(0);
  }, []);

  useEffect(() => {
    const allOff = lights.every(row => row.every(light => !light));
    if (allOff && lights.length > 0) {
      const score = Math.max(0, 100 - moves * 5);
      onScoreUpdate(score);
      setTimeout(() => onComplete(score), 1000);
    }
  }, [lights, moves, onScoreUpdate, onComplete]);

  const toggleLight = (row: number, col: number) => {
    if (moves >= maxMoves) return;
    
    const newLights = lights.map((r, ri) => 
      r.map((light, ci) => {
        if (ri === row && ci === col) return !light;
        if ((ri === row && Math.abs(ci - col) === 1) || (ci === col && Math.abs(ri - row) === 1)) return !light;
        return light;
      })
    );
    setLights(newLights);
    setMoves(moves + 1);
  };

  return (
    <div className="light-switch-game">
      <h3>Light Switch Puzzle</h3>
      <p>Moves: {moves}/{maxMoves}</p>
      <div className="light-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {lights.map((row, ri) => 
          row.map((light, ci) => (
            <button
              key={`${ri}-${ci}`}
              onClick={() => toggleLight(ri, ci)}
              className={`light-cell ${light ? 'on' : 'off'}`}
              disabled={moves >= maxMoves}
            >
              {light ? '●' : '○'}
            </button>
          ))
        )}
      </div>
      <p>Turn all lights off!</p>
    </div>
  );
}

// Maze Escape (8)
function MazeEscape({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const size = config.size || 5;
  const [playerPos, setPlayerPos] = useState({ x: 0, y: 0 });
  const [exitPos] = useState({ x: size - 1, y: size - 1 });
  const [walls, setWalls] = useState<Set<string>>(new Set());

  useEffect(() => {
    const newWalls = new Set<string>();
    for (let i = 0; i < size * size * 0.3; i++) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      if (!(x === 0 && y === 0) && !(x === size - 1 && y === size - 1)) {
        newWalls.add(`${x},${y}`);
      }
    }
    setWalls(newWalls);
    setPlayerPos({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (playerPos.x === exitPos.x && playerPos.y === exitPos.y) {
      onScoreUpdate(100);
      setTimeout(() => onComplete(100), 1000);
    }
  }, [playerPos, exitPos, onScoreUpdate, onComplete]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    let newPos = { ...playerPos };
    if (e.key === 'ArrowUp' && playerPos.y > 0) newPos.y--;
    if (e.key === 'ArrowDown' && playerPos.y < size - 1) newPos.y++;
    if (e.key === 'ArrowLeft' && playerPos.x > 0) newPos.x--;
    if (e.key === 'ArrowRight' && playerPos.x < size - 1) newPos.x++;
    
    if (!walls.has(`${newPos.x},${newPos.y}`)) {
      setPlayerPos(newPos);
    }
  };

  return (
    <div className="maze-escape-game" onKeyDown={handleKeyPress} tabIndex={0}>
      <h3>Maze Escape</h3>
      <p>Use arrow keys to reach the exit (E)</p>
      <div className="maze-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {Array.from({ length: size * size }).map((_, i) => {
          const x = i % size;
          const y = Math.floor(i / size);
          const isWall = walls.has(`${x},${y}`);
          const isPlayer = playerPos.x === x && playerPos.y === y;
          const isExit = exitPos.x === x && exitPos.y === y;
          
          return (
            <div
              key={i}
              className={`maze-cell ${isWall ? 'wall' : ''} ${isPlayer ? 'player' : ''} ${isExit ? 'exit' : ''}`}
            >
              {isPlayer && 'P'}
              {isExit && !isPlayer && 'E'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Pattern Completion (9)
function PatternCompletion({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [pattern, setPattern] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const shapes = ['circle', 'square', 'triangle', 'star'];
    const basePattern = Array.from({ length: 3 }, () => shapes[Math.floor(Math.random() * shapes.length)]);
    const missing = shapes[Math.floor(Math.random() * shapes.length)];
    const allOptions = [...shapes].sort(() => Math.random() - 0.5);
    
    setPattern([...basePattern, '?']);
    setOptions(allOptions);
    setCorrectIndex(allOptions.indexOf(missing));
    setSelected(null);
    setCorrect(null);
  }, []);

  const handleSelect = (index: number) => {
    setSelected(index);
    const isCorrect = index === correctIndex;
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="pattern-completion-game">
      <h3>Pattern Completion</h3>
      <div className="pattern-display">
        {pattern.map((shape, i) => (
          <div key={i} className={`pattern-shape ${shape === '?' ? 'missing' : shape}`}>
            {shape !== '?' && <div className={`shape ${shape}`}></div>}
            {shape === '?' && '?'}
          </div>
        ))}
      </div>
      <div className="pattern-options">
        {options.map((shape, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            className={`option-btn ${selected === i ? (correct ? 'correct' : 'incorrect') : ''}`}
          >
            <div className={`shape ${shape}`}></div>
          </button>
        ))}
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Wrong!'}
        </p>
      )}
    </div>
  );
}

// Simple Sudoku 4x4 (10)
function Sudoku4x4({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const [grid, setGrid] = useState<(number | null)[][]>([]);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    const newGrid: (number | null)[][] = Array(4).fill(null).map(() => Array(4).fill(null));
    newGrid[0][0] = 1; newGrid[0][2] = 3;
    newGrid[1][1] = 4; newGrid[1][3] = 2;
    newGrid[2][0] = 2; newGrid[2][2] = 4;
    newGrid[3][1] = 3; newGrid[3][3] = 1;
    setGrid(newGrid);
  }, []);

  useEffect(() => {
    const isComplete = grid.every(row => row.every(cell => cell !== null));
    if (isComplete && grid.length > 0) {
      let isValid = true;
      for (let i = 0; i < 4; i++) {
        const row = grid[i].filter(c => c !== null);
        const col = grid.map(r => r[i]).filter(c => c !== null);
        if (new Set(row).size !== row.length || new Set(col).size !== col.length) {
          isValid = false;
          break;
        }
      }
      const score = isValid ? 100 : 50;
      onScoreUpdate(score);
      setTimeout(() => onComplete(score), 1000);
    }
  }, [grid, onScoreUpdate, onComplete]);

  const handleCellClick = (row: number, col: number) => {
    if (grid[row][col] !== null) return;
    setSelected({ row, col });
  };

  const handleNumberSelect = (num: number) => {
    if (!selected) return;
    const newGrid = grid.map((r, ri) => 
      r.map((c, ci) => ri === selected.row && ci === selected.col ? num : c)
    );
    setGrid(newGrid);
    setSelected(null);
  };

  return (
    <div className="sudoku-game">
      <h3>Sudoku 4x4</h3>
      <div className="sudoku-grid">
        {grid.map((row, ri) => 
          row.map((cell, ci) => (
            <button
              key={`${ri}-${ci}`}
              onClick={() => handleCellClick(ri, ci)}
              className={`sudoku-cell ${selected?.row === ri && selected?.col === ci ? 'selected' : ''}`}
            >
              {cell || ''}
            </button>
          ))
        )}
      </div>
      {selected && (
        <div className="number-selector">
          {[1, 2, 3, 4].map(num => (
            <button key={num} onClick={() => handleNumberSelect(num)}>
              {num}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Rotate to Fit (11)
function RotateToFit({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [rotation, setRotation] = useState(0);
  const [targetRotation] = useState(Math.floor(Math.random() * 4) * 90);
  const [correct, setCorrect] = useState<boolean | null>(null);

  const handleRotate = () => {
    const newRotation = (rotation + 90) % 360;
    setRotation(newRotation);
    
    if (newRotation === targetRotation) {
      setCorrect(true);
      onScoreUpdate(100);
    } else {
      setCorrect(false);
    }
  };

  return (
    <div className="rotate-to-fit-game">
      <h3>Rotate to Fit</h3>
      <div className="rotation-area">
        <div className="target-outline"></div>
        <div 
          className="rotatable-shape" 
          style={{ transform: `rotate(${rotation}deg)` }}
        ></div>
      </div>
      <button onClick={handleRotate}>Rotate 90°</button>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Perfect fit!' : 'Keep rotating...'}
        </p>
      )}
    </div>
  );
}

// Mirror Match (12)
function MirrorMatch({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [pairs, setPairs] = useState<Array<{ left: string; right: string; isMirror: boolean }>>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const shapes = ['circle', 'square', 'triangle'];
    const newPairs = Array.from({ length: 3 }, () => {
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      const isMirror = Math.random() > 0.5;
      return {
        left: shape,
        right: isMirror ? shape : shapes[Math.floor(Math.random() * shapes.length)],
        isMirror,
      };
    });
    setPairs(newPairs);
    setSelected(null);
    setCorrect(null);
  }, []);

  const handleSelect = (index: number, isMirror: boolean) => {
    setSelected(index);
    const isCorrect = pairs[index].isMirror === isMirror;
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="mirror-match-game">
      <h3>Mirror Match</h3>
      {pairs.map((pair, i) => (
        <div key={i} className="mirror-pair">
          <div className={`shape ${pair.left}`}></div>
          <div className={`shape ${pair.right}`}></div>
          <div className="mirror-options">
            <button onClick={() => handleSelect(i, true)} className={selected === i ? (correct ? 'correct' : '') : ''}>
              Mirror
            </button>
            <button onClick={() => handleSelect(i, false)} className={selected === i ? (!correct ? 'incorrect' : '') : ''}>
              Different
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Logic Gates Lite (13)
function LogicGates({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [gate, setGate] = useState<'AND' | 'OR'>('AND');
  const [input1, setInput1] = useState(0);
  const [input2, setInput2] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const gates: ('AND' | 'OR')[] = ['AND', 'OR'];
    setGate(gates[Math.floor(Math.random() * gates.length)]);
    setInput1(Math.floor(Math.random() * 2));
    setInput2(Math.floor(Math.random() * 2));
    setSelected(null);
    setCorrect(null);
  }, []);

  const getOutput = () => {
    if (gate === 'AND') return input1 && input2 ? 1 : 0;
    return input1 || input2 ? 1 : 0;
  };

  const handleSelect = (output: number) => {
    setSelected(output);
    const isCorrect = output === getOutput();
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="logic-gates-game">
      <h3>Logic Gates</h3>
      <div className="gate-display">
        <div>Input 1: {input1}</div>
        <div>Gate: {gate}</div>
        <div>Input 2: {input2}</div>
        <div>Output: ?</div>
      </div>
      <div className="output-options">
        <button onClick={() => handleSelect(0)} className={selected === 0 ? (correct ? 'correct' : 'incorrect') : ''}>
          0
        </button>
        <button onClick={() => handleSelect(1)} className={selected === 1 ? (correct ? 'correct' : 'incorrect') : ''}>
          1
        </button>
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Wrong!'}
        </p>
      )}
    </div>
  );
}

// Sequence Arrows (14)
function SequenceArrows({ config, onScoreUpdate }: { config: Record<string, any>; onScoreUpdate: (score: number) => void }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    const arrows = ['↑', '↓', '←', '→'];
    const pattern = Array.from({ length: 3 }, () => arrows[Math.floor(Math.random() * arrows.length)]);
    const next = arrows[Math.floor(Math.random() * arrows.length)];
    const allOptions = [...arrows].sort(() => Math.random() - 0.5);
    
    setSequence([...pattern, '?']);
    setOptions(allOptions);
    setCorrectIndex(allOptions.indexOf(next));
    setSelected(null);
    setCorrect(null);
  }, []);

  const handleSelect = (index: number) => {
    setSelected(index);
    const isCorrect = index === correctIndex;
    setCorrect(isCorrect);
    onScoreUpdate(isCorrect ? 100 : 0);
  };

  return (
    <div className="sequence-arrows-game">
      <h3>Sequence Arrows</h3>
      <div className="arrow-sequence">
        {sequence.map((arrow, i) => (
          <span key={i} className="arrow">{arrow === '?' ? '?' : arrow}</span>
        ))}
      </div>
      <div className="arrow-options">
        {options.map((arrow, i) => (
          <button
            key={i}
            onClick={() => handleSelect(i)}
            className={`arrow-btn ${selected === i ? (correct ? 'correct' : 'incorrect') : ''}`}
          >
            {arrow}
          </button>
        ))}
      </div>
      {correct !== null && (
        <p className={correct ? 'correct-message' : 'incorrect-message'}>
          {correct ? 'Correct!' : 'Wrong!'}
        </p>
      )}
    </div>
  );
}

// Block Fill (15)
function BlockFill({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 4;
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [blocks, setBlocks] = useState<Array<{ id: number; shape: number[][] }>>([]);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);

  useEffect(() => {
    const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    setGrid(newGrid);
    
    const blockShapes = [
      [[1, 1], [1, 1]],
      [[1, 1, 1]],
      [[1], [1], [1]],
      [[1, 1], [1, 0]],
    ];
    setBlocks(blockShapes.map((shape, i) => ({ id: i, shape })));
  }, []);

  useEffect(() => {
    const isFilled = grid.every(row => row.every(cell => cell));
    if (isFilled && grid.length > 0 && blocks.length === 0) {
      onScoreUpdate(100);
      setTimeout(() => onComplete(100), 1000);
    }
  }, [grid, blocks, onScoreUpdate, onComplete]);

  const canPlace = (block: number[][], row: number, col: number) => {
    for (let r = 0; r < block.length; r++) {
      for (let c = 0; c < block[r].length; c++) {
        if (block[r][c] && (row + r >= gridSize || col + c >= gridSize || grid[row + r][col + c])) {
          return false;
        }
      }
    }
    return true;
  };

  const placeBlock = (blockId: number, row: number, col: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || !canPlace(block.shape, row, col)) return;
    
    const newGrid = grid.map(r => [...r]);
    for (let r = 0; r < block.shape.length; r++) {
      for (let c = 0; c < block.shape[r].length; c++) {
        if (block.shape[r][c]) {
          newGrid[row + r][col + c] = true;
        }
      }
    }
    setGrid(newGrid);
    setBlocks(blocks.filter(b => b.id !== blockId));
    setSelectedBlock(null);
  };

  return (
    <div className="block-fill-game">
      <h3>Block Fill</h3>
      <div className="blocks-available">
        {blocks.map(block => (
          <button
            key={block.id}
            onClick={() => setSelectedBlock(block.id)}
            className={`block-btn ${selectedBlock === block.id ? 'selected' : ''}`}
          >
            Block {block.id + 1}
          </button>
        ))}
      </div>
      <div className="fill-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {grid.map((row, ri) => 
          row.map((cell, ci) => (
            <div
              key={`${ri}-${ci}`}
              onClick={() => selectedBlock !== null && placeBlock(selectedBlock, ri, ci)}
              className={`fill-cell ${cell ? 'filled' : ''} ${selectedBlock !== null ? 'selectable' : ''}`}
            ></div>
          ))
        )}
      </div>
    </div>
  );
}

