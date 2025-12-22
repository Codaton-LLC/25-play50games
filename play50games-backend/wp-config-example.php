<?php
/**
 * Play50Games - CORS Configuration Example
 * 
 * Shto këto rreshta në fund të wp-config.php (para "That's all, stop editing!")
 */

// Define allowed origins based on environment
if (!defined('WP_ENVIRONMENT_TYPE')) {
    // Auto-detect environment
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false || strpos($host, '.local') !== false) {
        define('WP_ENVIRONMENT_TYPE', 'local');
    } else {
        define('WP_ENVIRONMENT_TYPE', 'production');
    }
}

// CORS allowed origins
if (WP_ENVIRONMENT_TYPE === 'local') {
    // Local development - allow all origins
    define('PLAY50_CORS_ORIGIN', '*');
} else {
    // Production - specify your frontend domain
    define('PLAY50_CORS_ORIGIN', 'https://play50.games');
    // Ose për multiple domains:
    // define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games');
}

// Enable REST API
define('REST_REQUEST', true);

/* That's all, stop editing! Happy publishing. */

