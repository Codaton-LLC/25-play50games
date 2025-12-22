'use client';

import { useState, useEffect } from 'react';

interface MemoryGamesProps {
  config: Record<string, any>;
  onScoreUpdate: (score: number) => void;
  onComplete: () => void;
  isPlaying: boolean;
}

export default function MemoryGames({ config, onScoreUpdate, onComplete, isPlaying }: MemoryGamesProps) {
  const [currentGame, setCurrentGame] = useState<string>('');

  useEffect(() => {
    if (!isPlaying) return;
    
    const gameType = config.gameType || 'card-flip';
    setCurrentGame(gameType);
  }, [isPlaying, config]);

  if (currentGame === 'card-flip') {
    return <CardFlipMemory config={config} onScoreUpdate={onScoreUpdate} onComplete={onComplete} />;
  }

  return <div>Loading memory game...</div>;
}

// Card Flip Memory Game
function CardFlipMemory({ config, onScoreUpdate, onComplete }: { config: Record<string, any>; onScoreUpdate: (score: number) => void; onComplete: () => void }) {
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
      setTimeout(() => onComplete(), 1000);
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

