import { MetadataRoute } from 'next';

// Helper function to get site URL
function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://play50games.com';
}

export default function robots(): MetadataRoute.Robots {
  const SITE_URL = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/diagnostics/',
          '/_next/',
          '/games/*/api',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
