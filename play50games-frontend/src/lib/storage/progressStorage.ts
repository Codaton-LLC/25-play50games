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
    
    const progress: GameProgress = {
      game_id: gameId,
      score,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      attempts: (allProgress[gameId]?.attempts || 0) + 1,
      best_score: Math.max(allProgress[gameId]?.best_score || 0, score),
      last_played: new Date().toISOString(),
    };
    
    allProgress[gameId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
    
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
    return JSON.parse(stored);
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

