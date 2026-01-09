import { Certificate } from '@/types/game';
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

export async function generateCertificate(
  playerName: string,
  guestId?: string
): Promise<{ success: boolean; certificate_id: string; data: Certificate }> {
  const body: any = {
    player_name: playerName,
  };
  
  if (guestId) {
    body.guest_id = guestId;
  }
  
  const response = await fetch(`${API_BASE}/certificate/generate`, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to generate certificate');
  }
  
  return response.json();
}

export async function getCertificate(certificateId: string): Promise<Certificate> {
  const response = await fetch(`${API_BASE}/certificate/${certificateId}`, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch certificate');
  }
  
  return response.json();
}

export async function getUserCertificate(): Promise<Certificate | null> {
  const response = await fetch(`${API_BASE}/certificate/user`, {
    headers: getApiHeaders(),
  });
  
  if (!response.ok) {
    if (response.status === 404) {
      return null; // No certificate found
    }
    throw new Error('Failed to fetch certificate');
  }
  
  return response.json();
}
