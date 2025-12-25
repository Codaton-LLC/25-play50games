'use client';

import { Game } from '@/types/game';
import { isUnlocked } from '@/lib/storage/progressStorage';
import { LockClosedIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface UnlockSystemProps {
  game: Game;
}

export default function UnlockSystem({ game }: UnlockSystemProps) {
  // The unlock status is already calculated server-side and passed in game.is_unlocked
  // This component just provides visual feedback
  
  if (!game.is_unlocked) {
    return (
      <div className="unlock-system locked">
        <div className="lock-icon">
          <LockClosedIcon style={{ width: 24, height: 24 }} />
        </div>
        {game.unlock_requirement > 0 && (
          <p className="unlock-message">
            Complete Game #{game.unlock_requirement} to unlock
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="unlock-system unlocked">
      <div className="unlock-icon">
        <CheckCircleIcon style={{ width: 20, height: 20 }} />
      </div>
    </div>
  );
}

