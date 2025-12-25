'use client';

import { useState, useEffect } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

interface MemoryGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: (finalScore?: number) => void;
  isPlaying: boolean;
}

export default function MemoryGames({ config, onScoreUpdate, onComplete, isPlaying }: MemoryGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'card-flip';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  const gameComponents: Record<string, JSX.Element> = {
    'card-flip': <CardFlipMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'sound-memory': <SoundMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'emoji-memory': <EmojiMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'number-recall': <NumberRecall config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'image-recall': <ImageRecall config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'path-memory': <PathMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'word-memory': <WordMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'face-memory': <FaceMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'color-grid-memory': <ColorGridMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
    'symbol-stack': <SymbolStack config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />,
  };

  return gameComponents[currentGame] || <div>Memory game "{currentGame}" not found.</div>;
}

// Card Flip Memory Game
function CardFlipMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 4;
  const pairs = config.pairs || 8;
  const [cards, setCards] = useState<Array<{ id: number; value: number; flipped: boolean; matched: boolean }>>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [matches, setMatches] = useState(0);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    initializeCards();
  }, []);

  useEffect(() => {
    if (matches === pairs) {
      const score = Math.max(0, 100 - (moves - pairs) * 5);
      onScoreUpdate(score);
      setTimeout(() => onComplete(score), 1000);
    }
  }, [matches, pairs, moves, onScoreUpdate, onComplete]);

  const initializeCards = () => {
    const cardValues: number[] = [];
    for (let i = 1; i <= pairs; i++) {
      cardValues.push(i, i); // Each pair appears twice
    }
    
    // Shuffle
    for (let i = cardValues.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cardValues[i], cardValues[j]] = [cardValues[j], cardValues[i]];
    }
    
    const newCards = cardValues.map((value, index) => ({
      id: index,
      value,
      flipped: false,
      matched: false,
    }));
    
    setCards(newCards);
    setMatches(0);
    setMoves(0);
    setFlippedCards([]);
  };

  const handleCardClick = (cardId: number) => {
    const card = cards[cardId];
    if (card.flipped || card.matched || flippedCards.length >= 2) return;

    const newCards = [...cards];
    newCards[cardId].flipped = true;
    setCards(newCards);
    
    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [firstId, secondId] = newFlipped;
      const firstCard = newCards[firstId];
      const secondCard = newCards[secondId];

      if (firstCard.value === secondCard.value) {
        // Match!
        newCards[firstId].matched = true;
        newCards[secondId].matched = true;
        setCards(newCards);
        setMatches(matches + 1);
        setFlippedCards([]);
      } else {
        // No match, flip back
        setTimeout(() => {
          const resetCards = [...newCards];
          resetCards[firstId].flipped = false;
          resetCards[secondId].flipped = false;
          setCards(resetCards);
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const totalCards = gridSize * gridSize;
  const cardSize = `${100 / gridSize}%`;

  return (
    <div className="card-flip-memory-game">
      <h3>Card Flip Memory</h3>
      <div className="game-stats">
        <span>Matches: {matches}/{pairs}</span>
        <span>Moves: {moves}</span>
      </div>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {cards.slice(0, totalCards).map((card) => (
          <button
            key={card.id}
            className={`memory-card ${card.flipped || card.matched ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
            onClick={() => handleCardClick(card.id)}
            style={{ width: cardSize, paddingBottom: cardSize }}
          >
            <div className="card-front">?</div>
            <div className="card-back">{card.value}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Sound Memory Game (17)
function SoundMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const rounds = config.rounds || 5;
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerSequence, setPlayerSequence] = useState<number[]>([]);
  const [showingSequence, setShowingSequence] = useState(true);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (level > rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startNewLevel();
  }, [level, rounds, score, onScoreUpdate, onComplete]);

  const startNewLevel = () => {
    const newSequence = Array.from({ length: level }, () => Math.floor(Math.random() * 4) + 1);
    setSequence(newSequence);
    setPlayerSequence([]);
    setShowingSequence(true);
    
    setTimeout(() => {
      setShowingSequence(false);
    }, level * 1000);
  };

  const playSound = (tone: number) => {
    // Visual feedback for sound
    console.log(`Playing tone ${tone}`);
  };

  useEffect(() => {
    if (showingSequence && sequence.length > 0) {
      sequence.forEach((tone, i) => {
        setTimeout(() => playSound(tone), i * 1000);
      });
    }
  }, [showingSequence, sequence]);

  const handleToneClick = (tone: number) => {
    if (showingSequence) return;
    
    const newPlayerSequence = [...playerSequence, tone];
    setPlayerSequence(newPlayerSequence);
    
    if (newPlayerSequence.length === sequence.length) {
      const isCorrect = newPlayerSequence.every((t, i) => t === sequence[i]);
      if (isCorrect) {
        setScore(score + 20);
        setLevel(level + 1);
      } else {
        onScoreUpdate(score);
        setTimeout(() => onComplete(score), 1000);
      }
    }
  };

  return (
    <div className="sound-memory-game">
      <h3>Sound Memory - Level {level}</h3>
      {showingSequence ? (
        <div>
          <p>Listen to the sequence...</p>
          <div className="sound-display">
            {sequence.map((tone, i) => (
              <span key={i} className="tone-indicator">♪</span>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Repeat the sequence</p>
          <div className="tone-buttons">
            {[1, 2, 3, 4].map(tone => (
              <button key={tone} onClick={() => handleToneClick(tone)} className="tone-btn">
                Tone {tone}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Emoji Memory Game (18)
function EmojiMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 3;
  const rounds = config.rounds || 3;
  const [emojis, setEmojis] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startRound();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const startRound = () => {
    const emojiList = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊'];
    const selectedEmojis = emojiList.slice(0, gridSize * gridSize).sort(() => Math.random() - 0.5);
    setEmojis(selectedEmojis);
    setSelected([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 3000);
  };

  const handleCellClick = (index: number) => {
    if (showing) return;
    if (selected.includes(index)) return;
    
    const newSelected = [...selected, index];
    setSelected(newSelected);
    
    if (newSelected.length === emojis.length) {
      const isCorrect = newSelected.every((idx, i) => emojis[idx] === emojis[i]);
      if (isCorrect) {
        setScore(score + 33);
      }
      setRound(round + 1);
    }
  };

  return (
    <div className="emoji-memory-game">
      <h3>Emoji Memory - Round {round + 1}</h3>
      <div className="emoji-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {emojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => handleCellClick(i)}
            className={`emoji-cell ${selected.includes(i) ? 'selected' : ''}`}
            disabled={showing || selected.includes(i)}
          >
            {showing || selected.includes(i) ? emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}

// Number Recall Game (19)
function NumberRecall({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const digits = config.digits || 4;
  const rounds = config.rounds || 3;
  const [sequence, setSequence] = useState<string>('');
  const [input, setInput] = useState('');
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startRound();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const startRound = () => {
    const newSequence = Array.from({ length: digits }, () => Math.floor(Math.random() * 10)).join('');
    setSequence(newSequence);
    setInput('');
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 3000);
  };

  const handleSubmit = () => {
    if (input === sequence) {
      setScore(score + 33);
    }
    setRound(round + 1);
  };

  return (
    <div className="number-recall-game">
      <h3>Number Recall - Round {round + 1}</h3>
      {showing ? (
        <div>
          <p>Remember this number:</p>
          <div className="number-display">{sequence}</div>
        </div>
      ) : (
        <div>
          <p>Type the number you saw:</p>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
            maxLength={digits}
            className="number-input"
          />
          <button onClick={handleSubmit}>Submit</button>
        </div>
      )}
    </div>
  );
}

// Image Recall Game (20)
function ImageRecall({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const images = config.images || 5;
  const [imageSequence, setImageSequence] = useState<number[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<number[]>([]);
  const [showing, setShowing] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const sequence = Array.from({ length: images }, (_, i) => i).sort(() => Math.random() - 0.5);
    setImageSequence(sequence);
    setSelectedOrder([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 5000);
  }, []);

  useEffect(() => {
    if (!showing && selectedOrder.length === images) {
      const isCorrect = selectedOrder.every((img, i) => img === imageSequence[i]);
      const finalScore = isCorrect ? 100 : 0;
      setScore(finalScore);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
    }
  }, [selectedOrder, imageSequence, images, showing, onScoreUpdate, onComplete]);

  const handleImageSelect = (imgIndex: number) => {
    if (showing || selectedOrder.includes(imgIndex)) return;
    setSelectedOrder([...selectedOrder, imgIndex]);
  };

  return (
    <div className="image-recall-game">
      <h3>Image Recall</h3>
      {showing ? (
        <div>
          <p>Remember the order of these images:</p>
          <div className="image-sequence">
            {imageSequence.map((img, i) => (
              <div key={i} className="image-item">
                Image {img + 1}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Click images in the order you saw them:</p>
          <div className="image-options">
            {Array.from({ length: images }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleImageSelect(i)}
                className={`image-btn ${selectedOrder.includes(i) ? 'selected' : ''}`}
                disabled={selectedOrder.includes(i)}
              >
                Image {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Path Memory Game (21)
function PathMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const rounds = config.rounds || 3;
  const [path, setPath] = useState<number[]>([]);
  const [playerPath, setPlayerPath] = useState<number[]>([]);
  const [showing, setShowing] = useState(true);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const gridSize = 3;

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startRound();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const startRound = () => {
    const newPath = Array.from({ length: round + 3 }, () => Math.floor(Math.random() * gridSize * gridSize));
    setPath(newPath);
    setPlayerPath([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 3000);
  };

  useEffect(() => {
    if (!showing && playerPath.length === path.length) {
      const isCorrect = playerPath.every((cell, i) => cell === path[i]);
      if (isCorrect) {
        setScore(score + 33);
      }
      setRound(round + 1);
    }
  }, [playerPath, path, showing, round, score]);

  const handleCellClick = (index: number) => {
    if (showing) return;
    setPlayerPath([...playerPath, index]);
  };

  return (
    <div className="path-memory-game">
      <h3>Path Memory - Round {round + 1}</h3>
      {showing ? (
        <div>
          <p>Watch the path:</p>
          <div className="path-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
              <div
                key={i}
                className={`path-cell ${path.includes(i) ? 'highlighted' : ''}`}
              >
                {path.includes(i) && '●'}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Recreate the path:</p>
          <div className="path-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
            {Array.from({ length: gridSize * gridSize }).map((_, i) => (
              <button
                key={i}
                onClick={() => handleCellClick(i)}
                className={`path-cell ${playerPath.includes(i) ? 'selected' : ''}`}
              >
                {playerPath.includes(i) && '●'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Word Memory Game (22)
function WordMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const words = config.words || 5;
  const [wordList, setWordList] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [showing, setShowing] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const allWords = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew'];
    const selected = allWords.slice(0, words).sort(() => Math.random() - 0.5);
    setWordList(selected);
    setSelectedWords([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 5000);
  }, []);

  useEffect(() => {
    if (!showing && selectedWords.length === words) {
      const isCorrect = selectedWords.every(word => wordList.includes(word)) && 
                       selectedWords.length === wordList.length;
      const finalScore = isCorrect ? 100 : 0;
      setScore(finalScore);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
    }
  }, [selectedWords, wordList, words, showing, onScoreUpdate, onComplete]);

  const handleWordClick = (word: string) => {
    if (showing || selectedWords.includes(word)) return;
    setSelectedWords([...selectedWords, word]);
  };

  return (
    <div className="word-memory-game">
      <h3>Word Memory</h3>
      {showing ? (
        <div>
          <p>Remember these words:</p>
          <div className="word-list">
            {wordList.map((word, i) => (
              <div key={i} className="word-item">{word}</div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Select the words you saw:</p>
          <div className="word-options">
            {['apple', 'banana', 'cherry', 'date', 'elderberry', 'fig', 'grape', 'honeydew'].map(word => (
              <button
                key={word}
                onClick={() => handleWordClick(word)}
                className={`word-btn ${selectedWords.includes(word) ? 'selected' : ''}`}
                disabled={selectedWords.includes(word)}
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Face Memory Game (23)
function FaceMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const faces = config.faces || 4;
  const [facePairs, setFacePairs] = useState<Array<{ face: string; name: string }>>([]);
  const [selectedFaces, setSelectedFaces] = useState<string[]>([]);
  const [showing, setShowing] = useState(true);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    const faceEmojis = ['😀', '😃', '😄', '😁', '😆', '😅'];
    const pairs = Array.from({ length: faces }, (_, i) => ({
      face: faceEmojis[i],
      name: names[i],
    }));
    setFacePairs(pairs);
    setSelectedFaces([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 5000);
  }, []);

  useEffect(() => {
    if (!showing && selectedFaces.length === faces) {
      const isCorrect = selectedFaces.every((name, i) => name === facePairs[i].name);
      const finalScore = isCorrect ? 100 : 0;
      setScore(finalScore);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
    }
  }, [selectedFaces, facePairs, faces, showing, onScoreUpdate, onComplete]);

  const handleNameSelect = (name: string, faceIndex: number) => {
    if (showing) return;
    const newSelected = [...selectedFaces];
    newSelected[faceIndex] = name;
    setSelectedFaces(newSelected);
  };

  return (
    <div className="face-memory-game">
      <h3>Face Memory</h3>
      {showing ? (
        <div>
          <p>Remember the faces and names:</p>
          <div className="face-list">
            {facePairs.map((pair, i) => (
              <div key={i} className="face-item">
                <span className="face-emoji">{pair.face}</span>
                <span className="face-name">{pair.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Match names to faces:</p>
          <div className="face-matching">
            {facePairs.map((pair, i) => (
              <div key={i} className="face-match-item">
                <span className="face-emoji">{pair.face}</span>
                <select
                  value={selectedFaces[i] || ''}
                  onChange={(e) => handleNameSelect(e.target.value, i)}
                >
                  <option value="">Select name</option>
                  {facePairs.map((p, idx) => (
                    <option key={idx} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Color Grid Memory Game (24)
function ColorGridMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const gridSize = config.gridSize || 3;
  const rounds = config.rounds || 3;
  const [highlighted, setHighlighted] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [showing, setShowing] = useState(true);

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startRound();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const startRound = () => {
    const total = gridSize * gridSize;
    const highlightCount = Math.floor(total * 0.4);
    const newHighlighted = new Set<number>();
    while (newHighlighted.size < highlightCount) {
      newHighlighted.add(Math.floor(Math.random() * total));
    }
    setHighlighted(newHighlighted);
    setSelected(new Set());
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 3000);
  };

  useEffect(() => {
    if (!showing && selected.size === highlighted.size) {
      const isCorrect = Array.from(selected).every(cell => highlighted.has(cell));
      if (isCorrect) {
        setScore(score + 33);
      }
      setRound(round + 1);
    }
  }, [selected, highlighted, showing, round, score]);

  const handleCellClick = (index: number) => {
    if (showing) return;
    const newSelected = new Set(selected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelected(newSelected);
  };

  return (
    <div className="color-grid-memory-game">
      <h3>Color Grid Memory - Round {round + 1}</h3>
      <div className="color-grid" style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}>
        {Array.from({ length: gridSize * gridSize }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleCellClick(i)}
            className={`color-cell ${highlighted.has(i) && showing ? 'highlighted' : ''} ${selected.has(i) ? 'selected' : ''}`}
            disabled={showing}
          >
            {selected.has(i) && <CheckCircleIcon style={{ width: 20, height: 20 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// Symbol Stack Game (25)
function SymbolStack({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: (finalScore?: number) => void }) {
  const rounds = config.rounds || 3;
  const [stack, setStack] = useState<string[]>([]);
  const [playerStack, setPlayerStack] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [showing, setShowing] = useState(true);
  const symbols = ['★', '◆', '●', '▲', '■'];

  useEffect(() => {
    if (round >= rounds) {
      const finalScore = Math.round((score / rounds) * 100);
      onScoreUpdate(finalScore);
      setTimeout(() => onComplete(finalScore), 1000);
      return;
    }
    startRound();
  }, [round, rounds, score, onScoreUpdate, onComplete]);

  const startRound = () => {
    const newStack = Array.from({ length: round + 3 }, () => 
      symbols[Math.floor(Math.random() * symbols.length)]
    );
    setStack(newStack);
    setPlayerStack([]);
    setShowing(true);
    
    setTimeout(() => {
      setShowing(false);
    }, 3000);
  };

  useEffect(() => {
    if (!showing && playerStack.length === stack.length) {
      const isCorrect = playerStack.every((sym, i) => sym === stack[i]);
      if (isCorrect) {
        setScore(score + 33);
      }
      setRound(round + 1);
    }
  }, [playerStack, stack, showing, round, score]);

  const handleSymbolClick = (symbol: string) => {
    if (showing) return;
    setPlayerStack([...playerStack, symbol]);
  };

  return (
    <div className="symbol-stack-game">
      <h3>Symbol Stack - Round {round + 1}</h3>
      {showing ? (
        <div>
          <p>Remember the stack order:</p>
          <div className="stack-display">
            {stack.map((sym, i) => (
              <div key={i} className="stack-item">{sym}</div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p>Rebuild the stack:</p>
          <div className="stack-display">
            {playerStack.map((sym, i) => (
              <div key={i} className="stack-item">{sym}</div>
            ))}
          </div>
          <div className="symbol-options">
            {symbols.map(sym => (
              <button key={sym} onClick={() => handleSymbolClick(sym)} className="symbol-btn">
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

