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
 * This checks localStorage for auth status
 */
export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const authStatus = localStorage.getItem('play50games_auth_status');
  return authStatus === 'authenticated';
}

/**
 * Set authentication status in localStorage
 */
export function setAuthStatus(authenticated: boolean): void {
  if (typeof window === 'undefined') return;
  if (authenticated) {
    localStorage.setItem('play50games_auth_status', 'authenticated');
  } else {
    localStorage.removeItem('play50games_auth_status');
  }
}

/**
 * Clear all progress and guest data from localStorage (used after login/register to start fresh)
 * This prevents new users from seeing previous user's progress
 */
export function clearLocalProgress(): void {
  if (typeof window === 'undefined') return;
  
  // Remove progress
  localStorage.removeItem(STORAGE_KEY);
  
  // Remove guest ID (from previous guest session)
  localStorage.removeItem(GUEST_ID_KEY);
  
  // Remove auth status (will be set again after login/register)
  localStorage.removeItem('play50games_auth_status');
  
  // Note: JWT token is kept because it's for the new logged-in user
  // It will be set by the login/register function
  
}

/**
 * Save progress (localStorage for guests, API for logged-in users)
 */
export async function saveProgress(
  gameId: number,
  score: number,
  completed: boolean,
  isAuthenticated?: boolean
): Promise<void> {
  // Check authentication status - prioritize passed parameter, then check localStorage
  const authStatusFromStorage = isLoggedIn();
  const loggedIn = isAuthenticated !== undefined ? isAuthenticated : authStatusFromStorage;
  
  // Also check if JWT token exists (more reliable indicator)
  const jwtToken = typeof window !== 'undefined' ? localStorage.getItem('play50games_jwt_token') : null;
  const hasJwtToken = !!jwtToken;
  
  // User is considered logged in if they have JWT token OR auth status
  const isUserLoggedIn = loggedIn || hasJwtToken;
  
  if (isUserLoggedIn) {
    // Save to API (server) - this will save to user meta and custom post type
    // IMPORTANT: Don't pass guestId when user is logged in
    try {
      const result = await saveProgressAPI(gameId, score, completed); // No guestId for logged-in users
      
      // Check if server saved to database or just locally
      if (result && result.success) {
        if (!result.data) {
          throw new Error('Server did not save progress successfully');
        }
      } else {
        throw new Error('Server did not save progress successfully');
      }
      
      // Dispatch event to notify other components (even without localStorage)
      if (typeof window !== 'undefined') {
        const progress: GameProgress = {
          game_id: gameId,
          score,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
          attempts: 1,
          best_score: score,
          last_played: new Date().toISOString(),
        };
        window.dispatchEvent(new CustomEvent('play50games_progress_updated', {
          detail: { gameId, progress }
        }));
      }
    } catch (error) {
      // Fallback: save to localStorage if API fails
      // Continue to guest save logic below
      const guestId = getGuestId();
      const allProgress = getAllProgressSync(); // Use sync version for guest fallback
      const existingProgress = allProgress[gameId];
      
      const wasCompleted = existingProgress?.completed || false;
      const isNowCompleted = completed || wasCompleted;
      
      let completedAt: string | null = null;
      if (isNowCompleted) {
        if (wasCompleted && existingProgress?.completed_at) {
          completedAt = existingProgress.completed_at;
        } else if (completed) {
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
      
      allProgress[gameId] = progress;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('play50games_progress_updated', {
          detail: { gameId, progress }
        }));
      }
    }
  } else {
    // Save to localStorage
    const guestId = getGuestId();
    const allProgress = getAllProgressSync(); // Use sync version for guests
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
    }
  }
}

/**
 * Get progress for a specific game
 * For logged-in users, this returns from localStorage (which should be synced from server)
 * For guests, returns from localStorage
 */
export function getProgress(gameId: number, isAuthenticated?: boolean): GameProgress | null {
  const loggedIn = isAuthenticated !== undefined ? isAuthenticated : isLoggedIn();
  
  // For sync access, use localStorage only (for guests or immediate access)
  // For logged-in users, use getAllProgress() async version in components
  const allProgress = getAllProgressSync();
    return allProgress[gameId] || null;
}

/**
 * Load progress from server (async)
 * Use this when you need fresh data from server
 */
export async function loadProgressFromServer(): Promise<Record<number, GameProgress>> {
  try {
    const serverProgress = await getProgressAPI() as Record<number, GameProgress>;
    
    // For logged-in users, DO NOT save to localStorage - keep it only on server
    // This prevents localStorage from accumulating data across different users
    
    // Dispatch event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('play50games_progress_loaded', {
        detail: { progress: serverProgress }
      }));
    }
    
    return serverProgress;
  } catch (error) {
    // Return empty object as fallback (don't use localStorage for logged-in users)
    return {};
  }
}

/**
 * Get all progress (from localStorage for guests, from server for logged-in users)
 */
export async function getAllProgress(): Promise<Record<number, GameProgress>> {
  if (typeof window === 'undefined') return {};
  
  // Check if user is logged in (has JWT token)
  const jwtToken = localStorage.getItem('play50games_jwt_token');
  const isLoggedIn = !!jwtToken;
  
  if (isLoggedIn) {
    // For logged-in users, ALWAYS get progress from server (even if localStorage exists)
    // This ensures we always have the latest data from server
    try {
      const serverProgress = await getProgressAPI() as Record<number, GameProgress>;
      return serverProgress || {};
    } catch (error) {
      // If server fails, check localStorage as fallback (but don't save to it)
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const result: Record<number, GameProgress> = {};
          for (const [key, value] of Object.entries(parsed)) {
            result[parseInt(key, 10)] = value as GameProgress;
          }
          return result;
        } catch (parseError) {
          // Failed to parse fallback
        }
      }
      return {};
    }
  } else {
    // For guests, get progress from localStorage only
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
      return {};
    }
  }
}

/**
 * Get all progress synchronously (from localStorage only - for backwards compatibility)
 * Use this only for guest users or when you need immediate access without async
 */
export function getAllProgressSync(): Record<number, GameProgress> {
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
 * Also loads progress from server and merges it with local progress
 * This syncs ALL progress from localStorage, especially completed games
 */
export async function syncProgressToAPI(): Promise<void> {
  // First, sync ALL local progress to server (including old/completed games)
  // Use sync version since we're syncing from localStorage (guest progress)
  const allProgress = getAllProgressSync();
  
  // Don't send guestId when user is logged in - backend will use user_id from session
  const guestId = undefined; // Remove guestId for logged-in users
  
  // Sync each game's progress to server
  for (const [gameId, progress] of Object.entries(allProgress)) {
    try {
      const gameIdNum = parseInt(gameId);
      
      // Always sync, especially if game is completed
      // Use best_score and completed status from localStorage
      await saveProgressAPI(
        gameIdNum,
        progress.best_score || progress.score || 0, // Use best_score if available, fallback to score
        progress.completed || false, // Always sync completed status
        guestId // Will be ignored for logged-in users
      );
    } catch (error) {
      // Continue with other games even if one fails
    }
  }
  
  // Then, load progress from server and merge with local
  // Wait a bit to ensure server has processed all saves
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const serverProgress = await getProgressAPI() as Record<number, GameProgress>;
    
    // Merge server progress with local progress intelligently
    // For logged-in users, server is source of truth, but preserve local completed games
    const mergedProgress: Record<number, GameProgress> = {};
    
    // First, add all server progress
    for (const [gameId, serverProg] of Object.entries(serverProgress)) {
      const gameIdNum = parseInt(gameId);
      if (serverProg) {
        mergedProgress[gameIdNum] = { ...serverProg };
      }
    }
    
    // Then, merge local progress (especially completed games that might not be on server yet)
    for (const [gameId, localProg] of Object.entries(allProgress)) {
      const gameIdNum = parseInt(gameId);
      const serverProg = serverProgress[gameIdNum];
      
      if (serverProg) {
        // Merge: keep best of both
        mergedProgress[gameIdNum] = {
          ...serverProg,
          // Keep the best score from both
          best_score: Math.max(
            serverProg.best_score || serverProg.score || 0,
            localProg.best_score || localProg.score || 0
          ),
          // If either is completed, mark as completed
          completed: serverProg.completed || localProg.completed || false,
          // Keep the earliest completed_at
          completed_at: serverProg.completed_at || localProg.completed_at || null,
          // Use max attempts (server should have the sum)
          attempts: Math.max(serverProg.attempts || 0, localProg.attempts || 0),
        };
      } else {
        // Local progress not on server yet - add it (especially important for completed games)
        if (localProg.completed || localProg.best_score > 0) {
          mergedProgress[gameIdNum] = { ...localProg };
        }
      }
    }
    
    // Save merged progress to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedProgress));
    
    // Dispatch event to notify components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('play50games_progress_synced', {
        detail: { progress: mergedProgress }
      }));
    }
  } catch (error) {
    // Don't throw - we still want to use local progress
    // But at least we've synced local to server
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

