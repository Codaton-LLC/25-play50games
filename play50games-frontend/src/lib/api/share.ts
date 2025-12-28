// Share tracking API client
import { getApiHeaders } from './apiUtils';

// Get API base URL
function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const envUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
    if (envUrl) return envUrl;
    const currentOrigin = window.location.origin;
    if (currentOrigin.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    if (currentOrigin.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
    return 'http://localhost/wp-json/play50/v1';
  }
  return process.env.WORDPRESS_API_URL || 'http://localhost/wp-json/play50/v1';
}

const API_BASE = getApiBase();

export interface ShareStatus {
  success: boolean;
  share_id: string;
  game_type: string;
  clicks: number;
  has_clicks: boolean;
  created_at: string;
  last_click_at: string | null;
}

/**
 * Register a share link in backend
 */
export async function registerShare(shareId: string, gameType: string): Promise<{ success: boolean; share_id: string; clicks: number }> {
  try {
    const response = await fetch(`${API_BASE}/share/register`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        share_id: shareId,
        game_type: gameType,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to register share');
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Track a share click (when someone opens the shared link)
 */
export async function trackShareClick(shareId: string): Promise<{ success: boolean; share_id: string; clicks: number }> {
  try {
    
    const response = await fetch(`${API_BASE}/share/click`, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        share_id: shareId,
      }),
    });

    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to track click: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Get share status (check if share has clicks)
 */
export async function getShareStatus(shareId: string): Promise<ShareStatus> {
  try {
    const response = await fetch(`${API_BASE}/share/status/${shareId}`, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to get share status');
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

