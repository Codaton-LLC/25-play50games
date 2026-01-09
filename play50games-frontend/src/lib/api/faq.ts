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

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface FAQGroup {
  group_title: string | null;
  faqs: FAQ[];
}

export async function getFAQs(): Promise<FAQGroup[]> {
  const apiBase = getApiBase();
  
  try {
    const response = await fetch(`${apiBase}/faq`, {
      headers: getApiHeaders(),
      // Add cache for server-side
      ...(typeof window === 'undefined' && { next: { revalidate: 3600 } }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FAQ API Error:', response.status, errorText);
      throw new Error(`Failed to fetch FAQs: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('FAQ fetch error:', error);
    throw error;
  }
}
