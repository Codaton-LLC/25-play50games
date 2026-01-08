import { MetadataRoute } from 'next';

// Helper function to get site URL
function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://play50games.com';
}

// Helper function to get API base URL (same logic as games.ts)
function getApiBase(): string {
  // Server-side: prefer server env var, then public env var
  if (process.env.WORDPRESS_API_URL) {
    return process.env.WORDPRESS_API_URL;
  }
  if (process.env.NEXT_PUBLIC_WORDPRESS_API_URL) {
    return process.env.NEXT_PUBLIC_WORDPRESS_API_URL;
  }
  
  // Try to detect from SITE_URL if available
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    // If site is on play50.games, API might be on cms.play50.games
    if (siteUrl.includes('play50.games')) {
      return 'https://cms.play50.games/wp-json/play50/v1';
    }
    if (siteUrl.includes('play50.game')) {
      return 'https://cms.play50.game/wp-json/play50/v1';
    }
  }
  
  // Default to live API
  return 'https://cms.play50.games/wp-json/play50/v1';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE_URL = getSiteUrl();
  const currentDate = new Date();

  // Static pages - these are always included
  // Note: Login and Register are modals (not separate pages), so they don't need to be in sitemap
  // Note: /diagnostics is a debugging page and is disallowed in robots.txt, so it's not included
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0, // Homepage has highest priority
    },
    {
      url: `${SITE_URL}/progress`,
      lastModified: currentDate,
      changeFrequency: 'weekly', // User progress changes weekly
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/certificate`,
      lastModified: currentDate,
      changeFrequency: 'monthly', // Certificate page rarely changes
      priority: 0.7,
    },
  ];

  // Try to fetch games from API, fallback to static list
  let gamePages: MetadataRoute.Sitemap = [];
  
  try {
    const API_BASE = getApiBase();
    
    const response = await fetch(`${API_BASE}/games`, {
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 1 hour - sitemap should update regularly but not too frequently
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const games = await response.json();
      
      // Google allows max 50,000 URLs per sitemap
      const maxUrls = 50000;
      const gamesToInclude = games.slice(0, maxUrls - staticPages.length);
      
      gamePages = gamesToInclude.map((game: { 
        id: number; 
        title: string; 
        game_type: string;
        updated_at?: string;
        created_at?: string;
      }) => {
        // Use updated_at if available, otherwise use created_at, otherwise use current date
        let lastModified = currentDate;
        if (game.updated_at) {
          lastModified = new Date(game.updated_at);
        } else if (game.created_at) {
          lastModified = new Date(game.created_at);
        }
        
        // Determine priority and changeFrequency based on game type
        let priority = 0.9;
        let changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never' = 'weekly';
        
        if (game.game_type === 'final') {
          priority = 0.95; // Final games are more important
          changeFrequency = 'weekly';
        } else if (game.game_type === 'logic' || game.game_type === 'memory') {
          priority = 0.9;
          changeFrequency = 'weekly';
        } else {
          priority = 0.85;
          changeFrequency = 'weekly';
        }
        
        return {
          url: `${SITE_URL}/games/${game.id}`,
          lastModified,
          changeFrequency,
          priority,
        };
      });
      
    } else {
      // Fallback to static list if API fails
      throw new Error('API fetch failed');
    }
  } catch (error: any) {
    // Fallback: Use static game IDs (1-50) if API fails
    gamePages = Array.from({ length: 50 }, (_, i) => i + 1).map((gameId) => ({
      url: `${SITE_URL}/games/${gameId}`,
      lastModified: currentDate,
      changeFrequency: 'weekly' as const,
      priority: gameId >= 46 ? 0.95 : 0.9, // Final games have higher priority
    }));
  }

  const allPages = [...staticPages, ...gamePages];
  
  return allPages;
}
