import { getApiBase } from './apiBase';
import { getApiHeaders } from './apiUtils';

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
