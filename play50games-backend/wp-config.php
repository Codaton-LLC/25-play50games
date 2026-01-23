<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://codex.wordpress.org/Editing_wp-config.php
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define('DB_NAME', 'wordpress_8');

/** MySQL database username */
define('DB_USER',       'wordpress_c');

/** MySQL database password */
define('DB_PASSWORD',       'Kbz037FH_b');

/** MySQL hostname */
define('DB_HOST', 'localhost:3306');

/** Database Charset to use in creating database tables. */
define('DB_CHARSET', 'utf8');

/** The Database Collate type. Don't change this if in doubt. */
define('DB_COLLATE', '');

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define('AUTH_KEY',       'r&J2kZWjv#8(C2#2K3GlUmBR649bvwzV^qc27XwxYUs0G9A4%CJjbhqHaBZ&Ip!G');
define('SECURE_AUTH_KEY',       'p^a5ErZgEaAI6QtP)85Y%tvCQzy^c*uvY4d@1Nq4JJfKjR1MDecZvT%9YDPhd3Dy');
define('LOGGED_IN_KEY',       'Lqx&I4l^QWVie@iQnFOCD8KdGN73RbXroMlch!IjHx#7IOih310S^LR9ZB*SI%V8');
define('NONCE_KEY',       '@pCrp99snEcc3c*5I4dclfBq20Lz#DVmCyJbpbL^S*o7mFkUXXKr5v&J6H7HKxWl');
define('AUTH_SALT',       '6T@x**UBTUhPzOL0rOag#5a)2q*KnOapUAuD9swhk7JO@l)WWBy^@J&y8n)Z%E*D');
define('SECURE_AUTH_SALT',       'f46%@&Ory7D^nJ9bMqSfDtltKc5ULXMtqskqAx(M7LYBDugd3#2C22onxXT9CNQp');
define('LOGGED_IN_SALT',       'r9FN!@esn51*PlgkvC@BmDs2Gp#h!1f0GoK7J&&Gix!fuZ1NZ1Yc&zG6k1tc0Ylw');
define('NONCE_SALT',       'KmBl786WUipg*9HaSW79G6QB1cdNxO&TU)WaWJjIkadokHUBwfQBWXw#*@9c2Wka');
/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix  = 'wp_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the Codex.
 *
 * @link https://codex.wordpress.org/Debugging_in_WordPress
 */
define('WP_DEBUG', true);        // Enable debug mode
define('WP_DEBUG_LOG', true);    // Save errors to wp-content/debug.log
define('WP_DEBUG_DISPLAY', true); // Hide errors from site visitors
@ini_set('display_errors', 0);

// ============================================
// Play50Games CORS Configuration
// ============================================
// Auto-detect environment and set CORS accordingly
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
if (strpos($host, 'localhost') !== false || strpos($host, '127.0.0.1') !== false || strpos($host, '.local') !== false) {
    // Local development - allow all origins (easier for testing on localhost:3000, 3001, etc.)
    define('WP_ENVIRONMENT_TYPE', 'local');
    define('PLAY50_CORS_ORIGIN', '*');
} else {
    // Production environment - specify your frontend domain
    // Include localhost for development testing
    define('WP_ENVIRONMENT_TYPE', 'production');
    define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://25-play50games.vercel.app,http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000');
    // Nëse ke multiple domains, përdor:
    // define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games,https://25-play50games.vercel.app,http://localhost:3000');
}
// ============================================

// ============================================
// Play50Games JWT Configuration
// ============================================
// JWT Secret Key për JWT Authentication
// Duhet të jetë i njëjtë me secret key që përdor plugin-i JWT Authentication for WP REST API
// IMPORTANT: Duhet të jetë PARA require_once(ABSPATH . 'wp-settings.php');
define('JWT_AUTH_SECRET_KEY', 'play50games251228granit78954561fewtr435gad');
define('JWT_AUTH_CORS_ENABLE', true);
// ============================================

// ============================================
// Play50Games API Key Configuration
// ============================================
// API Key për REST API - duhet të përputhet me NEXT_PUBLIC_PLAY50_API_KEY në frontend
// Gjenero një key të sigurt: openssl rand -hex 32
define('PLAY50_API_KEY', 'play50games251228granit');
// ============================================

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
    define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');

define( 'WP_ALLOW_MULTISITE', true );

define ('FS_METHOD', 'direct');

