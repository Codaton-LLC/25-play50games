// Share tracking API client
import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

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
      // Include status code in error for better error handling
      const statusCode = response.status;
      const errorText = await response.text().catch(() => '');
      const errorMessage = statusCode === 404 
        ? `Share link not found (404)` 
        : `Failed to get share status (${statusCode})`;
      const error = new Error(errorMessage);
      (error as any).status = statusCode;
      throw error;
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

