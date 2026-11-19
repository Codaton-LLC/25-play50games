import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          // a prefix: covers /diagnostics and everything under it
          '/diagnostics',
          '/games/*/api',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
