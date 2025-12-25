import { GameProgress } from '@/types/game';
import { saveProgress as saveProgressAPI, getProgress as getProgressAPI } from '@/lib/api/progress';

const STORAGE_KEY = 'play50games_progress';
const GUEST_ID_KEY = 'play50games_guest_id';

/**
 * Generate or retrieve guest ID
 */
export function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

/**
 * Check if user is logged in (WordPress)
 */
export function isLoggedIn(): boolean {
  // This would check for WordPress authentication
  // For now, we'll assume not logged in if no user data exists
  return false; // TODO: Implement WordPress auth check
}

/**
 * Save progress (localStorage for guests, API for logged-in users)
 */
export async function saveProgress(
  gameId: number,
  score: number,
  completed: boolean
): Promise<void> {
  const loggedIn = isLoggedIn();
  
  if (loggedIn) {
    // Save to API
    await saveProgressAPI(gameId, score, completed);
  } else {
    // Save to localStorage
    const guestId = getGuestId();
    const allProgress = getAllProgress();
    const existingProgress = allProgress[gameId];
    
    // If game was already completed, keep it completed even if new score is lower
    // Only set completed to false if it was never completed before
    const wasCompleted = existingProgress?.completed || false;
    const isNowCompleted = completed || wasCompleted;
    
    // Preserve completed_at if game was already completed, otherwise set it if now completed
    let completedAt: string | null = null;
    if (isNowCompleted) {
      if (wasCompleted && existingProgress?.completed_at) {
        // Keep the original completion date
        completedAt = existingProgress.completed_at;
      } else if (completed) {
        // Set new completion date
        completedAt = new Date().toISOString();
      }
    }
    
    const progress: GameProgress = {
      game_id: gameId,
      score,
      completed: isNowCompleted,
      completed_at: completedAt,
      attempts: (existingProgress?.attempts || 0) + 1,
      best_score: Math.max(existingProgress?.best_score || 0, score),
      last_played: new Date().toISOString(),
    };
    
    console.log('Saving progress:', { gameId, score, completed, isNowCompleted, wasCompleted, completedAt });
    
    allProgress[gameId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    
    // Dispatch custom event to notify other components about progress update
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('play50games_progress_updated', {
        detail: { gameId, progress }
      }));
    }
    
    // Also try to save to API (for sync if user logs in later)
    try {
      await saveProgressAPI(gameId, score, completed, guestId);
    } catch (error) {
      // Silently fail - localStorage is primary for guests
      console.warn('Failed to sync progress to API:', error);
    }
  }
}

/**
 * Get progress for a specific game
 */
export function getProgress(gameId: number): GameProgress | null {
  const loggedIn = isLoggedIn();
  
  if (loggedIn) {
    // Would fetch from API
    // For now, return null and let component handle async fetch
    return null;
  } else {
    const allProgress = getAllProgress();
    return allProgress[gameId] || null;
  }
}

/**
 * Get all progress
 */
export function getAllProgress(): Record<number, GameProgress> {
  if (typeof window === 'undefined') return {};
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  
  try {
    const parsed = JSON.parse(stored);
    // Convert string keys to numbers (JSON.parse makes object keys strings)
    const result: Record<number, GameProgress> = {};
    for (const [key, value] of Object.entries(parsed)) {
      result[parseInt(key, 10)] = value as GameProgress;
    }
    return result;
  } catch (error) {
    console.error('Failed to parse progress from localStorage:', error);
    return {};
  }
}

/**
 * Check if game is unlocked
 */
export function isUnlocked(gameId: number, unlockRequirement: number): boolean {
  // First game is always unlocked
  if (unlockRequirement === 0) {
    return true;
  }
  
  const progress = getProgress(unlockRequirement);
  if (!progress) return false;
  
  // Check if required game is completed with passing score
  // We need to get the passing score from the game config
  // For now, assume 70 is the default passing score
  return progress.completed && progress.best_score >= 70;
}

/**
 * Sync localStorage progress to API (when user logs in)
 */
export async function syncProgressToAPI(): Promise<void> {
  const allProgress = getAllProgress();
  const guestId = getGuestId();
  
  for (const [gameId, progress] of Object.entries(allProgress)) {
    try {
      await saveProgressAPI(
        parseInt(gameId),
        progress.best_score,
        progress.completed,
        guestId
      );
    } catch (error) {
      console.warn(`Failed to sync game ${gameId} progress:`, error);
    }
  }
}

/**
 * Clear all progress (for testing/reset)
 */
export function clearProgress(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(GUEST_ID_KEY);
}

