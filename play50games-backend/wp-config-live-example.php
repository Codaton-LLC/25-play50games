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
define('DB_NAME', 'put-your-db-name-here');

/** MySQL database username */
define('DB_USER',       'put-your-db-user-here');

/** MySQL database password */
define('DB_PASSWORD',       'put-your-db-password-here');

/** MySQL hostname */
define('DB_HOST', 'put-your-db-host-here');

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
define('AUTH_KEY',       'put-your-auth-key-here');
define('SECURE_AUTH_KEY',       'put-your-secure-auth-key-here');
define('LOGGED_IN_KEY',       'put-your-logged-in-key-here');
define('NONCE_KEY',       'put-your-nonce-key-here');
define('AUTH_SALT',       'put-your-auth-salt-here');
define('SECURE_AUTH_SALT',       'put-your-secure-auth-salt-here');
define('LOGGED_IN_SALT',       'put-your-logged-in-salt-here');
define('NONCE_SALT',       'put-your-nonce-salt-here');
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
    define('WP_ENVIRONMENT_TYPE', 'production');
    define('PLAY50_CORS_ORIGIN', 'https://play50.games');
    // Nëse ke multiple domains, përdor:
    // define('PLAY50_CORS_ORIGIN', 'https://play50.games,https://www.play50.games');
}
// ============================================

/* That's all, stop editing! Happy blogging. */

/** Absolute path to the WordPress directory. */
if ( !defined('ABSPATH') )
	define('ABSPATH', dirname(__FILE__) . '/');

/** Sets up WordPress vars and included files. */
require_once(ABSPATH . 'wp-settings.php');

define( 'WP_ALLOW_MULTISITE', true );

define ('FS_METHOD', 'direct');

