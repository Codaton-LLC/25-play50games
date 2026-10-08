/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // AVIF first (smaller), WebP for browsers without AVIF
    formats: ['image/avif', 'image/webp'],
  },
  env: {
    WORDPRESS_API_URL: process.env.WORDPRESS_API_URL || 'http://localhost/wp-json',
  },
}

module.exports = nextConfig

