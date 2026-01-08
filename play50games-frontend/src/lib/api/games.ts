import { Game } from '@/types/game';
import { getApiHeaders } from './apiUtils';

// Get API base URL - check environment variable first, then try to detect from current location
function getApiBase(): string {
  // Always use the live API URL - never use localhost
  const LIVE_API_URL = 'https://cms.play50.games/wp-json/play50/v1';
  
  if (typeof window !== 'undefined') {
    // Client-side: use NEXT_PUBLIC_ env var or detect from current origin
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl && !envUrl.includes('localhost')) {
      return envUrl;
    }
    
    // Try to detect WordPress URL from current page
    // If frontend is on play50.games or play50.game, WordPress might be on cms.play50.games or cms.play50.game
    const currentOrigin = window.location.origin;
    
    if (currentOrigin.includes('play50.games')) {
      return LIVE_API_URL;
    }
    
    if (currentOrigin.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
    
    // Default to live API
    return LIVE_API_URL;
  }
  
  // Server-side: prefer server env var, then public env var
  // NEVER use localhost - always use live API
  if (process.env.WORDPRESS_API_URL && !process.env.WORDPRESS_API_URL.includes('localhost')) {
    return process.env.WORDPRESS_API_URL;
  }
  if (process.env.NEXT_PUBLIC_WORDPRESS_API_URL && !process.env.NEXT_PUBLIC_WORDPRESS_API_URL.includes('localhost')) {
    return process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
  }
  
  // Try to detect from SITE_URL if available
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl && !siteUrl.includes('localhost')) {
    // If site is on play50.games, API might be on cms.play50.games
    if (siteUrl.includes('play50.games')) {
      return LIVE_API_URL;
    }
    if (siteUrl.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
  }
  
  // Always default to live API (never use localhost)
  return LIVE_API_URL;
}

// Note: Don't use const API_BASE = getApiBase() here
// Call getApiBase() dynamically in each function to ensure correct URL

export async function getAllGames(guestId?: string): Promise<Game[]> {
  // Get API base dynamically
  const apiBase = getApiBase();
  const url = guestId 
    ? `${apiBase}/games?guest_id=${guestId}`
    : `${apiBase}/games`;
  
  const headers = getApiHeaders();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers,
      // Add cache for server-side
      ...(typeof window === 'undefined' && { next: { revalidate: 3600 } }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch games: ${response.status} ${response.statusText}. URL: ${url}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    
    // Provide more specific error messages
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      throw new Error(
        `Cannot connect to WordPress API at ${apiBase}.\n` +
        `Possible causes:\n` +
        `1. CORS issue - check backend CORS settings\n` +
        `2. Network/DNS issue - cannot reach ${apiBase}\n` +
        `3. SSL/Certificate issue - check browser console\n` +
        `4. Firewall blocking the request\n\n` +
        `To fix: Create .env.local file with:\n` +
        `NEXT_PUBLIC_WORDPRESS_API_URL=https://cms.play50.games/wp-json/play50/v1`
      );
    }
    
    throw error;
  }
}

export async function getGame(gameId: number, guestId?: string): Promise<Game> {
  // Get API base dynamically (important for server-side)
  const apiBase = getApiBase();
  const url = guestId
    ? `${apiBase}/games/${gameId}?guest_id=${guestId}`
    : `${apiBase}/games/${gameId}`;
  
  const headers = getApiHeaders();
  
  const response = await fetch(url, {
    headers: headers,
    // Add cache for server-side (metadata generation)
    ...(typeof window === 'undefined' && { next: { revalidate: 3600 } }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch game: ${response.status} ${response.statusText}`);
  }
  
  const game = await response.json();
  
  return game;
}

