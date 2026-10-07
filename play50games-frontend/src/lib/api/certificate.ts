import { Certificate } from '@/types/game';
import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

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
