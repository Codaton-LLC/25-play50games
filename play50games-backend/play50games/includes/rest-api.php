<?php
/**
 * Play50Games REST API Endpoints
 */

/**
 * Get JWT token from Authorization header
 */
function play50_get_jwt_from_header() {
    $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    if (empty($auth_header) && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    }
    
    if (!empty($auth_header) && preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
        return $matches[1];
    }
    
    return null;
}

/**
 * Get user ID from JWT token (custom validation only)
 */
function play50_get_user_id_from_jwt($token) {
    if (empty($token) || !defined('JWT_AUTH_SECRET_KEY')) {
        return 0;
    }
    
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return 0;
    }
    
    list($header, $payload, $signature) = $parts;
    
    // Verify signature
    $expected_signature_raw = hash_hmac('sha256', $header . '.' . $payload, JWT_AUTH_SECRET_KEY, true);
    $expected_signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expected_signature_raw));
    
    if (!hash_equals($signature, $expected_signature)) {
        return 0;
    }
    
    // Decode payload
    $payload_decoded = str_replace(['-', '_'], ['+', '/'], $payload);
    $padding = (4 - strlen($payload_decoded) % 4) % 4;
    if ($padding > 0) {
        $payload_decoded .= str_repeat('=', $padding);
    }
    $decoded_payload = base64_decode($payload_decoded, true);
    
    if ($decoded_payload === false) {
        return 0;
    }
    
    $payload_data = json_decode($decoded_payload, true);
    if (!is_array($payload_data) || !isset($payload_data['user_id'])) {
        return 0;
    }
    
    // Check expiration
    if (isset($payload_data['exp']) && intval($payload_data['exp']) < time()) {
        return 0;
    }
    
    $user_id = intval($payload_data['user_id']);
    return $user_id > 0 ? $user_id : 0;
}

/**
 * Generate JWT token (custom implementation)
 */
function play50_generate_jwt_token($user_id) {
    if (!defined('JWT_AUTH_SECRET_KEY')) {
        return null;
    }
    
    try {
        $header_data = array('typ' => 'JWT', 'alg' => 'HS256');
        $payload_data = array(
            'user_id' => intval($user_id),
            'iat' => time(),
            'exp' => time() + (7 * 24 * 60 * 60), // 7 days
        );
        
        $header_json = json_encode($header_data);
        $payload_json = json_encode($payload_data);
        
        if ($header_json === false || $payload_json === false) {
            return null;
        }
        
        $header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header_json));
        $payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload_json));
        
        if (!function_exists('hash_hmac')) {
            return null;
        }
        
        $signature_raw = hash_hmac('sha256', $header . '.' . $payload, JWT_AUTH_SECRET_KEY, true);
        if ($signature_raw === false) {
            return null;
        }
        
        $signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature_raw));
        
        return $header . '.' . $payload . '.' . $signature;
    } catch (Exception $e) {
        return null;
    } catch (Error $e) {
        return null;
    }
}

// Ensure REST API allows unauthenticated requests
// Note: rest_enabled and rest_jsonp_enabled are deprecated since WordPress 4.7.0
// REST API can no longer be completely disabled, we just need to allow access
add_filter('rest_authentication_errors', function($result) {
    // Allow unauthenticated requests to our endpoints
    if (!empty($result)) {
        return $result;
    }
    return true;
}, 20);

// Ensure WordPress loads user from JWT token or cookies for REST API requests
// Use a static flag to prevent infinite loops
// NOTE: This hook is only for reading user, NOT for login endpoints
add_action('rest_api_init', function() {
    static $user_loaded = false;
    
    // Prevent infinite loops
    if ($user_loaded) {
        return;
    }
    
    // Skip for login/register endpoints to prevent loops
    $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    if (strpos($request_uri, '/auth/login') !== false || strpos($request_uri, '/auth/register') !== false) {
        return;
    }
    
    // Only load user if not already loaded
    if (get_current_user_id() > 0) {
        $user_loaded = true;
        return;
    }
    
    if (!function_exists('wp_validate_auth_cookie')) {
        require_once(ABSPATH . 'wp-includes/pluggable.php');
    }
    
    $user_loaded = true;
    
    // Try JWT token first
    $jwt_token = play50_get_jwt_from_header();
    if ($jwt_token) {
        $user_id = play50_get_user_id_from_jwt($jwt_token);
        if ($user_id > 0) {
            // Only set if user is not already set - DO NOT set auth cookie here to prevent loops
            if (get_current_user_id() === 0) {
                wp_set_current_user($user_id);
            }
            return;
        }
    }
    
    // Fallback to cookies
    $user_id = wp_validate_auth_cookie('', 'logged_in');
    if ($user_id && $user_id > 0) {
        // Only set if user is not already set - DO NOT set auth cookie here to prevent loops
        if (get_current_user_id() === 0) {
            wp_set_current_user($user_id);
        }
    }
}, 5);

// Add CORS headers early for all REST API requests (including redirects)
// Use 'init' hook with high priority to run before redirects
add_action('init', function() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    if (strpos($request_uri, '/wp-json/play50/v1/') !== false) {
        $allowed_origin = defined('PLAY50_CORS_ORIGIN') ? PLAY50_CORS_ORIGIN : '*';
        $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        
        $final_origin = '*';
        if (!empty($request_origin)) {
            // Always allow localhost
            if (strpos($request_origin, 'http://localhost') === 0 || 
                strpos($request_origin, 'http://127.0.0.1') === 0) {
                $final_origin = $request_origin;
            } elseif (strpos($allowed_origin, ',') !== false) {
                $origins = array_map('trim', explode(',', $allowed_origin));
                if (in_array($request_origin, $origins)) {
                    $final_origin = $request_origin;
                } elseif (strpos($request_origin, 'http://localhost') === 0) {
                    // Check if any origin contains localhost
                    foreach ($origins as $origin) {
                        if (strpos($origin, 'http://localhost') === 0) {
                            $final_origin = $request_origin;
                            break;
                        }
                    }
                }
            } elseif ($allowed_origin === '*') {
                $final_origin = '*';
            } elseif ($request_origin === $allowed_origin) {
                $final_origin = $request_origin;
            }
        }
        
        header('Access-Control-Allow-Origin: ' . $final_origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Requested-With, X-API-Key, X-Play50-API-Key');
        header('Access-Control-Allow-Credentials: true');
    }
}, 1);

// Enable CORS for REST API
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        // Get allowed origin from wp-config.php or use default
        $allowed_origin = defined('PLAY50_CORS_ORIGIN') ? PLAY50_CORS_ORIGIN : '*';
        $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        
        // Determine the correct origin to return
        $final_origin = '*';
        
        if (!empty($request_origin)) {
            // Always allow localhost origins for development (even in production WordPress)
            if (
                strpos($request_origin, 'http://localhost') === 0 || 
                strpos($request_origin, 'http://127.0.0.1') === 0 ||
                strpos($request_origin, 'http://192.168.') === 0
            ) {
                $final_origin = $request_origin;
            }
            // If multiple origins defined (comma-separated), check request origin
            elseif (strpos($allowed_origin, ',') !== false) {
                $origins = array_map('trim', explode(',', $allowed_origin));
                // Check exact match first
                if (in_array($request_origin, $origins)) {
                    $final_origin = $request_origin;
                } 
                // Also check if request is localhost and any origin contains localhost
                elseif (strpos($request_origin, 'http://localhost') === 0) {
                    foreach ($origins as $origin) {
                        if (strpos($origin, 'http://localhost') === 0) {
                            $final_origin = $request_origin;
                            break;
                        }
                    }
                }
                elseif ($allowed_origin === '*') {
                    $final_origin = '*';
                } else {
                    // If not in list, use first allowed origin (or wildcard if first is not set)
                    $final_origin = !empty($origins[0]) ? $origins[0] : '*';
                }
            } 
            // If wildcard is allowed
            elseif ($allowed_origin === '*') {
                $final_origin = '*';
            }
            // Single origin specified - check if request matches
            elseif ($request_origin === $allowed_origin) {
                $final_origin = $request_origin;
            }
        } elseif ($allowed_origin !== '*') {
            // No origin in request, but we have a specific origin configured
            // Use the configured origin (or first if multiple)
            if (strpos($allowed_origin, ',') !== false) {
                $origins = array_map('trim', explode(',', $allowed_origin));
                $final_origin = !empty($origins[0]) ? $origins[0] : '*';
            } else {
                $final_origin = $allowed_origin;
            }
        }
        
        header('Access-Control-Allow-Origin: ' . $final_origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Requested-With, X-API-Key, X-Play50-API-Key');
        header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
        // Only set credentials if not using wildcard
        if ($final_origin !== '*') {
            header('Access-Control-Allow-Credentials: true');
        }
        return $value;
    });
}, 15);

// Handle OPTIONS preflight requests - use init hook for better compatibility
add_action('init', function() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS' && strpos($_SERVER['REQUEST_URI'], '/wp-json/') !== false) {
        // Get allowed origin from wp-config.php or use default
        $allowed_origin = defined('PLAY50_CORS_ORIGIN') ? PLAY50_CORS_ORIGIN : '*';
        $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
        
        // Determine the correct origin to return
        $final_origin = '*';
        
        if (!empty($request_origin)) {
            // Always allow localhost origins for development (even in production WordPress)
            if (
                strpos($request_origin, 'http://localhost') === 0 || 
                strpos($request_origin, 'http://127.0.0.1') === 0 ||
                strpos($request_origin, 'http://192.168.') === 0
            ) {
                $final_origin = $request_origin;
            }
            // If multiple origins defined (comma-separated), check request origin
            elseif (strpos($allowed_origin, ',') !== false) {
                $origins = array_map('trim', explode(',', $allowed_origin));
                // Check exact match first
                if (in_array($request_origin, $origins)) {
                    $final_origin = $request_origin;
                } 
                // Also check if request is localhost and any origin contains localhost
                elseif (strpos($request_origin, 'http://localhost') === 0) {
                    foreach ($origins as $origin) {
                        if (strpos($origin, 'http://localhost') === 0) {
                            $final_origin = $request_origin;
                            break;
                        }
                    }
                }
                elseif ($allowed_origin === '*') {
                    $final_origin = '*';
                } else {
                    // If not in list, use first allowed origin (or wildcard if first is not set)
                    $final_origin = !empty($origins[0]) ? $origins[0] : '*';
                }
            } 
            // If wildcard is allowed
            elseif ($allowed_origin === '*') {
                $final_origin = '*';
            }
            // Single origin specified - check if request matches
            elseif ($request_origin === $allowed_origin) {
                $final_origin = $request_origin;
            }
        } elseif ($allowed_origin !== '*') {
            // No origin in request, but we have a specific origin configured
            // Use the configured origin (or first if multiple)
            if (strpos($allowed_origin, ',') !== false) {
                $origins = array_map('trim', explode(',', $allowed_origin));
                $final_origin = !empty($origins[0]) ? $origins[0] : '*';
            } else {
                $final_origin = $allowed_origin;
            }
        }
        
        header('Access-Control-Allow-Origin: ' . $final_origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Requested-With, X-API-Key, X-Play50-API-Key');
        header('Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages');
        // Only set credentials if not using wildcard
        if ($final_origin !== '*') {
            header('Access-Control-Allow-Credentials: true');
        }
        header('Access-Control-Max-Age: 86400');
        status_header(200);
        exit(0);
    }
}, 1);

/**
 * Check API Key permission for REST API endpoints
 * Requires X-API-Key or X-Play50-API-Key header with value from wp-config.php PLAY50_API_KEY
 */
function play50_check_api_key_permission() {
    // Get API key from wp-config.php
    $required_api_key = defined('PLAY50_API_KEY') ? PLAY50_API_KEY : '';
    
    // If no API key is configured, allow access (backward compatibility)
    if (empty($required_api_key)) {
        return true;
    }
    
    // Get API key from headers
    $api_key = '';
    if (isset($_SERVER['HTTP_X_API_KEY'])) {
        $api_key = $_SERVER['HTTP_X_API_KEY'];
    } elseif (isset($_SERVER['HTTP_X_PLAY50_API_KEY'])) {
        $api_key = $_SERVER['HTTP_X_PLAY50_API_KEY'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['X-API-Key'])) {
            $api_key = $headers['X-API-Key'];
        } elseif (isset($headers['X-Play50-API-Key'])) {
            $api_key = $headers['X-Play50-API-Key'];
        }
    }
    
    // Compare API keys (use hash_equals for timing attack protection)
    if (empty($api_key)) {
        return new WP_Error(
            'missing_api_key',
            'API Key is required. Please provide X-API-Key or X-Play50-API-Key header.',
            array('status' => 401)
        );
    }
    
    if (!hash_equals($required_api_key, $api_key)) {
        return new WP_Error(
            'invalid_api_key',
            'Invalid API Key provided.',
            array('status' => 403)
        );
    }
    
    return true;
}

// Register REST API routes - use early priority to ensure registration
add_action('rest_api_init', function() {
    
    // Test endpoint to verify REST API is working
    register_rest_route('play50/v1', '/test', array(
        'methods' => 'GET',
        'callback' => function() {
            // Check if custom post type is registered
            $cpt_registered = post_type_exists('play50_game_progress');
            $cpt_posts_count = $cpt_registered ? wp_count_posts('play50_game_progress') : null;
            
            return new WP_REST_Response(array(
                'success' => true,
                'message' => 'Play50Games REST API is working!',
                'timestamp' => current_time('mysql'),
                'wordpress_version' => get_bloginfo('version'),
                'rest_api_url' => rest_url('play50/v1/'),
                'cpt_registered' => $cpt_registered,
                'cpt_posts_count' => $cpt_posts_count ? $cpt_posts_count->publish : 0,
            ), 200);
        },
        'permission_callback' => '__return_true',
    ));
    
    // Diagnostic endpoint to check REST API status
    register_rest_route('play50/v1', '/diagnostics', array(
        'methods' => 'GET',
        'callback' => function() {
            return new WP_REST_Response(array(
                'rest_api_enabled' => true,
                'theme_active' => get_stylesheet() === 'play50games',
                'rest_url' => rest_url(),
                'site_url' => site_url(),
                'home_url' => home_url(),
                'permalinks_structure' => get_option('permalink_structure'),
            ), 200);
        },
        'permission_callback' => '__return_true',
    ));
    
    // Get all games with unlock status
    register_rest_route('play50/v1', '/games', array(
        'methods' => 'GET',
        'callback' => 'play50_get_games',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Get single game by ID
    register_rest_route('play50/v1', '/games/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'play50_get_game',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Save/Get user progress
    register_rest_route('play50/v1', '/progress', array(
        'methods' => 'POST',
        'callback' => 'play50_save_progress',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    register_rest_route('play50/v1', '/progress', array(
        'methods' => 'GET',
        'callback' => 'play50_get_progress',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Get unlock status for all games
    register_rest_route('play50/v1', '/unlock-status', array(
        'methods' => 'GET',
        'callback' => 'play50_get_unlock_status',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Generate certificate
    register_rest_route('play50/v1', '/certificate/generate', array(
        'methods' => 'POST',
        'callback' => 'play50_generate_certificate',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Get certificate by ID
    register_rest_route('play50/v1', '/certificate/(?P<id>[a-f0-9\-]+)', array(
        'methods' => 'GET',
        'callback' => 'play50_get_certificate',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Share tracking endpoints
    register_rest_route('play50/v1', '/share/register', array(
        'methods' => 'POST',
        'callback' => 'play50_register_share',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    register_rest_route('play50/v1', '/share/click', array(
        'methods' => 'POST',
        'callback' => 'play50_track_share_click',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    register_rest_route('play50/v1', '/share/status/(?P<share_id>[a-zA-Z0-9]+)', array(
        'methods' => 'GET',
        'callback' => 'play50_get_share_status',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // User registration endpoint
    register_rest_route('play50/v1', '/auth/register', array(
        'methods' => 'POST',
        'callback' => 'play50_register_user',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // User login endpoint
    register_rest_route('play50/v1', '/auth/login', array(
        'methods' => 'POST',
        'callback' => 'play50_login_user',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Check authentication status
    register_rest_route('play50/v1', '/auth/status', array(
        'methods' => 'GET',
        'callback' => 'play50_auth_status',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Get current user info (for debugging)
    register_rest_route('play50/v1', '/auth/user', array(
        'methods' => 'GET',
        'callback' => 'play50_get_current_user',
        'permission_callback' => 'play50_check_api_key_permission',
    ));
    
    // Get all users with progress (admin only)
    register_rest_route('play50/v1', '/users', array(
        'methods' => 'GET',
        'callback' => 'play50_get_all_users',
        'permission_callback' => function() {
            // Only allow if user is admin or has manage_options capability
            return current_user_can('manage_options');
        },
    ));
    
    // Logout endpoint - allow without API key check for better UX
    register_rest_route('play50/v1', '/auth/logout', array(
        'methods' => 'POST',
        'callback' => 'play50_logout_user',
        'permission_callback' => function() {
            // Allow logout even without API key (for better UX)
            // But still check if API key is provided and valid
            $api_check = play50_check_api_key_permission();
            if (is_wp_error($api_check)) {
                // If API key check fails, still allow logout (user might be logged in)
                // This is safe because logout only clears session, doesn't expose data
                return true;
            }
            return $api_check;
        },
    ));
});

/**
 * Create share tracking table on theme activation
 */
function play50_create_share_table() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        share_id varchar(50) NOT NULL,
        game_type varchar(50) NOT NULL,
        created_at datetime DEFAULT CURRENT_TIMESTAMP,
        clicks int(11) DEFAULT 0,
        last_click_at datetime NULL,
        PRIMARY KEY (id),
        UNIQUE KEY share_id (share_id),
        KEY game_type (game_type)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}
// Create table on theme activation
add_action('after_switch_theme', 'play50_create_share_table');
// Also create on admin init (in case table doesn't exist)
add_action('admin_init', function() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
        play50_create_share_table();
    }
}, 1);

/**
 * Register a share link
 */
function play50_register_share($request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    $params = $request->get_json_params();
    $share_id = isset($params['share_id']) ? sanitize_text_field($params['share_id']) : '';
    $game_type = isset($params['game_type']) ? sanitize_text_field($params['game_type']) : '';
    
    if (empty($share_id) || empty($game_type)) {
        return new WP_Error('missing_params', 'share_id and game_type are required', array('status' => 400));
    }
    
    // Check if share_id already exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table_name WHERE share_id = %s",
        $share_id
    ));
    
    if ($existing) {
        // Already exists, return success
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Share link already registered',
            'share_id' => $share_id,
            'clicks' => intval($wpdb->get_var($wpdb->prepare(
                "SELECT clicks FROM $table_name WHERE share_id = %s",
                $share_id
            )))
        ), 200);
    }
    
    // Insert new share link
    $result = $wpdb->insert(
        $table_name,
        array(
            'share_id' => $share_id,
            'game_type' => $game_type,
            'clicks' => 0,
            'created_at' => current_time('mysql')
        ),
        array('%s', '%s', '%d', '%s')
    );
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to register share link', array('status' => 500));
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'Share link registered',
        'share_id' => $share_id,
        'clicks' => 0
    ), 201);
}

/**
 * Track a share click (when someone opens the shared link)
 */
function play50_track_share_click($request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    $params = $request->get_json_params();
    $share_id = isset($params['share_id']) ? sanitize_text_field($params['share_id']) : '';
    
    if (empty($share_id)) {
        return new WP_Error('missing_params', 'share_id is required', array('status' => 400));
    }
    
    // Check if share_id exists
    $existing = $wpdb->get_var($wpdb->prepare(
        "SELECT id FROM $table_name WHERE share_id = %s",
        $share_id
    ));
    
    // If share doesn't exist, try to determine game_type from share_id or create with unknown type
    // This can happen if someone opens a link before it's registered
    if (!$existing) {
        // Try to extract game type from URL or use 'unknown'
        $game_type = 'unknown';
        
        // Try to create the share entry
        $insert_result = $wpdb->insert(
            $table_name,
            array(
                'share_id' => $share_id,
                'game_type' => $game_type,
                'clicks' => 1, // First click
                'created_at' => current_time('mysql'),
                'last_click_at' => current_time('mysql')
            ),
            array('%s', '%s', '%d', '%s', '%s')
        );
        
        if ($insert_result === false) {
            return new WP_Error('db_error', 'Failed to create and track click', array('status' => 500));
        }
        
        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Click tracked (share created)',
            'share_id' => $share_id,
            'clicks' => 1
        ), 200);
    }
    
    // Update clicks for existing share
    $result = $wpdb->query($wpdb->prepare(
        "UPDATE $table_name SET clicks = clicks + 1, last_click_at = %s WHERE share_id = %s",
        current_time('mysql'),
        $share_id
    ));
    
    if ($result === false) {
        return new WP_Error('db_error', 'Failed to track click', array('status' => 500));
    }
    
    // Get updated clicks count
    $clicks = intval($wpdb->get_var($wpdb->prepare(
        "SELECT clicks FROM $table_name WHERE share_id = %s",
        $share_id
    )));
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'Click tracked',
        'share_id' => $share_id,
        'clicks' => $clicks
    ), 200);
}

/**
 * Get share status (check if share has clicks)
 */
function play50_get_share_status($request) {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    $share_id = $request->get_param('share_id');
    
    if (empty($share_id)) {
        return new WP_Error('missing_params', 'share_id is required', array('status' => 400));
    }
    
    $result = $wpdb->get_row($wpdb->prepare(
        "SELECT share_id, game_type, clicks, created_at, last_click_at FROM $table_name WHERE share_id = %s",
        $share_id
    ), ARRAY_A);
    
    if (!$result) {
        return new WP_Error('not_found', 'Share link not found', array('status' => 404));
    }
    
    // Check if share has expired (15 minutes = 900 seconds)
    $created_timestamp = strtotime($result['created_at']);
    $current_timestamp = current_time('timestamp');
    $expiry_seconds = 15 * 60; // 15 minutes
    
    if (($current_timestamp - $created_timestamp) > $expiry_seconds) {
        // Share has expired - delete it and return 404
        $wpdb->delete(
            $table_name,
            array('share_id' => $share_id),
            array('%s')
        );
        return new WP_Error('not_found', 'Share link expired', array('status' => 404));
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'share_id' => $result['share_id'],
        'game_type' => $result['game_type'],
        'clicks' => intval($result['clicks']),
        'has_clicks' => intval($result['clicks']) > 0,
        'created_at' => $result['created_at'],
        'last_click_at' => $result['last_click_at']
    ), 200);
}

/**
 * Get all games with unlock status
 */
function play50_get_games($request) {
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id'); // For guest users
    
    // Get all games - we'll sort manually since game_order is inside the game_fields array
    $args = array(
        'post_type' => 'play50_game',
        'posts_per_page' => -1,
        'post_status' => 'publish', // Only get published games
        'orderby' => 'date',
        'order' => 'ASC',
    );
    
    $games_query = new WP_Query($args);
    $games = array();
    
    if ($games_query->have_posts()) {
        foreach ($games_query->posts as $game) {
            $meta = get_post_meta($game->ID, 'game_fields', true);
            
            // Skip if game_fields meta doesn't exist or is empty
            if (empty($meta) || !is_array($meta)) {
                continue;
            }
            
            $game_order = isset($meta['game_order']) ? intval($meta['game_order']) : 999; // Default to high number if not set
            
            // Check if game is unlocked
            $is_unlocked = play50_is_game_unlocked($game->ID, $user_id, $guest_id);
            
            $games[] = array(
                'id' => $game->ID,
                'title' => $game->post_title,
                'description' => isset($meta['description']) ? $meta['description'] : '',
                'game_type' => isset($meta['game_type']) ? $meta['game_type'] : 'logic',
                'game_order' => $game_order,
                'difficulty' => isset($meta['difficulty']) ? intval($meta['difficulty']) : 1,
                'time_limit' => isset($meta['time_limit']) ? intval($meta['time_limit']) : 60,
                'passing_score' => isset($meta['passing_score']) ? intval($meta['passing_score']) : 70,
                'game_config' => isset($meta['game_config']) ? json_decode($meta['game_config'], true) : array(),
                'unlock_requirement' => isset($meta['unlock_requirement']) ? intval($meta['unlock_requirement']) : 0,
                'is_unlocked' => $is_unlocked,
            );
        }
        
        // Sort games by game_order
        usort($games, function($a, $b) {
            return $a['game_order'] - $b['game_order'];
        });
    }
    
    return new WP_REST_Response($games, 200);
}

/**
 * Get single game by ID
 */
function play50_get_game($request) {
    $game_id = intval($request['id']);
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id');
    
    $game = get_post($game_id);
    
    if (!$game || $game->post_type !== 'play50_game') {
        return new WP_Error('not_found', 'Game not found', array('status' => 404));
    }
    
    $meta = get_post_meta($game_id, 'game_fields', true);
    $is_unlocked = play50_is_game_unlocked($game_id, $user_id, $guest_id);
    
    $game_data = array(
        'id' => $game->ID,
        'title' => $game->post_title,
        'description' => isset($meta['description']) ? $meta['description'] : '',
        'game_type' => isset($meta['game_type']) ? $meta['game_type'] : 'logic',
        'game_order' => isset($meta['game_order']) ? intval($meta['game_order']) : 0,
        'difficulty' => isset($meta['difficulty']) ? intval($meta['difficulty']) : 1,
        'time_limit' => isset($meta['time_limit']) ? intval($meta['time_limit']) : 60,
        'passing_score' => isset($meta['passing_score']) ? intval($meta['passing_score']) : 70,
        'game_config' => isset($meta['game_config']) ? json_decode($meta['game_config'], true) : array(),
        'unlock_requirement' => isset($meta['unlock_requirement']) ? intval($meta['unlock_requirement']) : 0,
        'is_unlocked' => $is_unlocked,
    );
    
    return new WP_REST_Response($game_data, 200);
}

/**
 * Save user progress
 */
function play50_save_progress($request) {
    // Get user ID from JWT token or cookies
    $user_id = get_current_user_id();
    
    // If user_id is 0, try JWT token
    if ($user_id === 0) {
        $jwt_token = play50_get_jwt_from_header();
        if ($jwt_token) {
            $user_id = play50_get_user_id_from_jwt($jwt_token);
            if ($user_id > 0) {
                // Only set current user, don't set auth cookie to prevent loops
                wp_set_current_user($user_id);
            }
        }
    }
    
    $guest_id = $request->get_param('guest_id');
    $game_id = intval($request->get_param('game_id'));
    $score = intval($request->get_param('score'));
    $completed = $request->get_param('completed') === 'true' || $request->get_param('completed') === true;
    
    if (!$game_id || $score < 0) {
        return new WP_Error('invalid_data', 'Invalid game_id or score', array('status' => 400));
    }
    
    // For logged-in users, save to user meta AND custom post type
    if ($user_id > 0) {
        // Verify user exists
        $user = get_userdata($user_id);
        if (!$user) {
            return new WP_Error('invalid_user', 'User does not exist', array('status' => 400));
        }
        $progress_key = 'play50_game_progress_' . $game_id;
        $existing = get_user_meta($user_id, $progress_key, true);
        
        // Preserve completed_at if game was already completed
        $was_completed = isset($existing['completed']) && $existing['completed'];
        $completed_at = null;
        if ($completed) {
            if ($was_completed && isset($existing['completed_at']) && $existing['completed_at']) {
                // Keep original completion date
                $completed_at = $existing['completed_at'];
            } else {
                // Set new completion date
                $completed_at = current_time('mysql');
            }
        }
        
        // Calculate attempts - if syncing from localStorage, don't increment
        // Only increment if this is a new game session
        $increment_attempts = true;
        if (isset($existing['last_played']) && $existing['last_played']) {
            // If last_played is very recent (within last minute), might be a sync, don't increment
            $last_played_time = strtotime($existing['last_played']);
            $current_time = current_time('timestamp');
            if (($current_time - $last_played_time) < 60) {
                // Very recent, might be a sync - check if score/best_score changed
                if (isset($existing['best_score']) && $existing['best_score'] == $score && 
                    isset($existing['completed']) && $existing['completed'] == $completed) {
                    $increment_attempts = false; // Likely a sync, don't increment
                }
            }
        }
        
        $progress_data = array(
            'user_id' => $user_id,
            'game_id' => $game_id,
            'score' => $score,
            'completed' => $completed || $was_completed, // Keep completed if was already completed
            'completed_at' => $completed_at,
            'attempts' => $increment_attempts 
                ? (isset($existing['attempts']) ? intval($existing['attempts']) + 1 : 1)
                : (isset($existing['attempts']) ? intval($existing['attempts']) : 1),
            'best_score' => isset($existing['best_score']) ? max($existing['best_score'], $score) : $score,
            'last_played' => current_time('mysql'),
        );
        
        // Save to user meta
        update_user_meta($user_id, $progress_key, $progress_data);
        
        // Also store in a list for easy retrieval
        $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
        if (!is_array($all_progress)) {
            $all_progress = array();
        }
        $all_progress[$game_id] = $progress_data;
        update_user_meta($user_id, 'play50_all_progress', $all_progress);
        
        // Save to custom post type for admin viewing
        $cpt_result = play50_save_progress_to_cpt($user_id, $game_id, $progress_data);
        
        return new WP_REST_Response(array('success' => true, 'data' => $progress_data, 'cpt_post_id' => $cpt_result), 200);
    }
    
    // For guest users, return success (they'll use localStorage)
    return new WP_REST_Response(array('success' => true, 'message' => 'Progress saved locally'), 200);
}

/**
 * Get user progress
 */
function play50_get_progress($request) {
    // Get user ID from JWT token or cookies
    $user_id = get_current_user_id();
    
    // If user_id is 0, try JWT token
    if ($user_id === 0) {
        $jwt_token = play50_get_jwt_from_header();
        if ($jwt_token) {
            $user_id = play50_get_user_id_from_jwt($jwt_token);
            if ($user_id > 0) {
                wp_set_current_user($user_id);
            }
        }
    }
    
    $guest_id = $request->get_param('guest_id');
    $game_id = $request->get_param('game_id');
    
    if ($user_id > 0) {
        if ($game_id) {
            // Get specific game progress
            $progress_key = 'play50_game_progress_' . intval($game_id);
            $progress = get_user_meta($user_id, $progress_key, true);
            if (!$progress || !is_array($progress)) {
                $progress = array();
            }
            return new WP_REST_Response($progress, 200);
        } else {
            // Get all progress
            $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
            if (!$all_progress || !is_array($all_progress)) {
                // If no progress in all_progress, try to get from individual keys
                $all_progress = array();
                // Get all user meta keys that start with play50_game_progress_
                $meta_keys = get_user_meta($user_id);
                foreach ($meta_keys as $key => $value) {
                    if (strpos($key, 'play50_game_progress_') === 0) {
                        $game_id_from_key = intval(str_replace('play50_game_progress_', '', $key));
                        if ($game_id_from_key > 0 && is_array($value) && !empty($value)) {
                            $all_progress[$game_id_from_key] = $value[0];
                        }
                    }
                }
            }
            return new WP_REST_Response($all_progress ? $all_progress : array(), 200);
        }
    }
    
    // Guest users - return empty (they use localStorage)
    return new WP_REST_Response(array(), 200);
}

/**
 * Get unlock status for all games
 */
function play50_get_unlock_status($request) {
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id');
    
    $args = array(
        'post_type' => 'play50_game',
        'posts_per_page' => -1,
        'post_status' => 'publish',
        'orderby' => 'date',
        'order' => 'ASC',
    );
    
    $games_query = new WP_Query($args);
    $unlock_status = array();
    $games_with_order = array();
    
    if ($games_query->have_posts()) {
        foreach ($games_query->posts as $game) {
            $meta = get_post_meta($game->ID, 'game_fields', true);
            $game_order = isset($meta['game_order']) ? intval($meta['game_order']) : 999;
            $is_unlocked = play50_is_game_unlocked($game->ID, $user_id, $guest_id);
            
            $games_with_order[] = array(
                'id' => $game->ID,
                'order' => $game_order,
                'unlocked' => $is_unlocked
            );
        }
        
        // Sort by game_order
        usort($games_with_order, function($a, $b) {
            return $a['order'] - $b['order'];
        });
        
        // Build final array
        foreach ($games_with_order as $game) {
            $unlock_status[$game['id']] = $game['unlocked'];
        }
    }
    
    return new WP_REST_Response($unlock_status, 200);
}

/**
 * Generate certificate
 */
function play50_generate_certificate($request) {
    $user_id = get_current_user_id();
    $player_name = sanitize_text_field($request->get_param('player_name'));
    $guest_id = $request->get_param('guest_id');
    
    // Check if user is logged in
    if ($user_id === 0) {
        return new WP_Error('unauthorized', 'You must be logged in to generate a certificate', array('status' => 401));
    }
    
    if (empty($player_name)) {
        return new WP_Error('invalid_data', 'Player name is required', array('status' => 400));
    }
    
    // Check if all games are completed
    $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
    
    if (!is_array($all_progress) || count($all_progress) < 5) {
        return new WP_Error('incomplete', 'All 5 games must be completed', array('status' => 400));
    }
    
    // Calculate total score and rank
    $total_score = 0;
    foreach ($all_progress as $progress) {
        if (isset($progress['best_score'])) {
            $total_score += $progress['best_score'];
        }
    }
    
    $rank = play50_calculate_rank($total_score);
    
    // Create certificate post
    $certificate_id = wp_generate_uuid4();
    $certificate_post = array(
        'post_title' => 'Certificate: ' . $player_name,
        'post_type' => 'play50_certificate',
        'post_status' => 'publish',
    );
    
    $post_id = wp_insert_post($certificate_post);
    
    if (is_wp_error($post_id)) {
        return $post_id;
    }
    
    // Generate unique certificate display ID in format P50-YEAR-XXXXX (5 digits)
    $completion_date = current_time('Y-m-d');
    $year = date('Y', strtotime($completion_date));
    $hash = md5($certificate_id . $completion_date . $player_name);
    $unique_number = abs(crc32($hash)) % 100000;
    $unique_number = str_pad($unique_number, 5, '0', STR_PAD_LEFT);
    $cert_id_display = 'P50-' . $year . '-' . $unique_number;
    
    $certificate_data = array(
        'certificate_id' => $certificate_id,
        'cert_id_display' => $cert_id_display,
        'user_id' => $user_id,
        'player_name' => $player_name,
        'completion_date' => $completion_date,
        'total_score' => $total_score,
        'rank' => $rank,
    );
    
    update_post_meta($post_id, 'certificate_fields', $certificate_data);
    
    // Generate PDF (will be implemented in certificate-generator.php)
    $pdf_path = play50_generate_certificate_pdf($post_id, $certificate_data);
    if ($pdf_path) {
        $certificate_data['pdf_path'] = $pdf_path;
        update_post_meta($post_id, 'certificate_fields', $certificate_data);
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'certificate_id' => $certificate_id,
        'data' => $certificate_data,
    ), 200);
}

/**
 * Get certificate by ID
 */
function play50_get_certificate($request) {
    $certificate_id = sanitize_text_field($request['id']);
    
    $args = array(
        'post_type' => 'play50_certificate',
        'posts_per_page' => 1,
        'meta_query' => array(
            array(
                'key' => 'certificate_fields',
                'value' => $certificate_id,
                'compare' => 'LIKE',
            ),
        ),
    );
    
    $query = new WP_Query($args);
    
    if (!$query->have_posts()) {
        return new WP_Error('not_found', 'Certificate not found', array('status' => 404));
    }
    
    $post = $query->posts[0];
    $meta = get_post_meta($post->ID, 'certificate_fields', true);
    
    // If cert_id_display doesn't exist, generate it for backward compatibility
    if (empty($meta['cert_id_display']) && !empty($meta['certificate_id'])) {
        $completion_date = !empty($meta['completion_date']) ? $meta['completion_date'] : current_time('Y-m-d');
        $player_name = !empty($meta['player_name']) ? $meta['player_name'] : '';
        $year = date('Y', strtotime($completion_date));
        $hash = md5($meta['certificate_id'] . $completion_date . $player_name);
        $unique_number = abs(crc32($hash)) % 100000;
        $unique_number = str_pad($unique_number, 5, '0', STR_PAD_LEFT);
        $meta['cert_id_display'] = 'P50-' . $year . '-' . $unique_number;
        
        // Save it for future use
        update_post_meta($post->ID, 'certificate_fields', $meta);
    }
    
    return new WP_REST_Response($meta, 200);
}

/**
 * Helper: Check if game is unlocked
 */
function play50_is_game_unlocked($game_id, $user_id = 0, $guest_id = '') {
    $meta = get_post_meta($game_id, 'game_fields', true);
    $unlock_requirement = isset($meta['unlock_requirement']) ? intval($meta['unlock_requirement']) : 0;
    
    // First game is always unlocked
    if ($unlock_requirement === 0) {
        return true;
    }
    
    // Check if required game is completed
    if ($user_id > 0) {
        $required_progress = get_user_meta($user_id, 'play50_game_progress_' . $unlock_requirement, true);
        if ($required_progress && isset($required_progress['completed']) && $required_progress['completed']) {
            $passing_score = isset($meta['passing_score']) ? intval($meta['passing_score']) : 70;
            if (isset($required_progress['best_score']) && $required_progress['best_score'] >= $passing_score) {
                return true;
            }
        }
    }
    
    // For guest users, we can't check server-side - frontend will handle via localStorage
    // Return true here and let frontend validate
    return true;
}

/**
 * Helper: Calculate rank based on total score
 */
function play50_calculate_rank($total_score) {
    if ($total_score >= 450) {
        return 'Master';
    } elseif ($total_score >= 400) {
        return 'Expert';
    } elseif ($total_score >= 350) {
        return 'Advanced';
    } elseif ($total_score >= 300) {
        return 'Intermediate';
    } else {
        return 'Beginner';
    }
}

/**
 * Register a new user
 */
function play50_register_user($request) {
    $params = $request->get_json_params();
    
    $first_name = isset($params['first_name']) ? sanitize_text_field($params['first_name']) : '';
    $last_name = isset($params['last_name']) ? sanitize_text_field($params['last_name']) : '';
    // Get username from params - don't sanitize yet, we'll do it after validation
    $username = isset($params['username']) ? trim($params['username']) : '';
    $email = isset($params['email']) ? sanitize_email($params['email']) : '';
    $password = isset($params['password']) ? $params['password'] : '';
    
    // Validation - all fields are required
    if (empty($first_name) || empty($last_name) || empty($username) || empty($email) || empty($password)) {
        return new WP_Error('missing_fields', 'All fields are required (first name, last name, username, email, password)', array('status' => 400));
    }
    
    if (strlen($username) < 3) {
        return new WP_Error('invalid_username', 'Username must be at least 3 characters long', array('status' => 400));
    }
    
    if (!is_email($email)) {
        return new WP_Error('invalid_email', 'Invalid email address', array('status' => 400));
    }
    
    if (strlen($password) < 6) {
        return new WP_Error('weak_password', 'Password must be at least 6 characters long', array('status' => 400));
    }
    
    // Sanitize username for WordPress (converts to lowercase, removes invalid chars)
    // This is necessary because WordPress requires sanitized usernames
    $sanitized_username = sanitize_user($username, true);
    
    // Validate that sanitized username is still valid
    if (strlen($sanitized_username) < 3) {
        return new WP_Error('invalid_username', 'Username contains invalid characters or is too short after sanitization', array('status' => 400));
    }
    
    // Check if sanitized username already exists (must check the sanitized version)
    if (username_exists($sanitized_username)) {
        return new WP_Error('username_exists', 'This username is already taken. Please choose another one.', array('status' => 409));
    }
    
    // Check if email already exists
    if (email_exists($email)) {
        return new WP_Error('email_exists', 'An account with this email already exists', array('status' => 409));
    }
    
    // Create user with the sanitized username (WordPress requires sanitized usernames)
    // The username provided by the user will be sanitized and used (NOT from email)
    $user_id = wp_create_user($sanitized_username, $password, $email);
    
    if (is_wp_error($user_id)) {
        return new WP_Error('registration_failed', $user_id->get_error_message(), array('status' => 500));
    }
    
    // Set user meta
    update_user_meta($user_id, 'first_name', $first_name);
    update_user_meta($user_id, 'last_name', $last_name);
    
    // Set user role to 'customer' (WooCommerce role)
    $user = new WP_User($user_id);
    $user->set_role('customer');
    
    // Set current user for this request only (DO NOT set auth cookie to prevent loops)
    // Use a static flag to prevent multiple calls
    static $register_user_set = false;
    if (!$register_user_set) {
        wp_set_current_user($user_id);
        $register_user_set = true;
    }
    
    // Get user data
    $user = get_userdata($user_id);
    
    // Generate JWT token - use our custom function only (most reliable)
    // Note: We don't use JWT plugin functions because they require WP_REST_Request, not user_id
    $jwt_token = null;
    if (defined('JWT_AUTH_SECRET_KEY') && function_exists('play50_generate_jwt_token')) {
        $jwt_token = play50_generate_jwt_token($user_id);
    }
    
    $response_data = array(
        'success' => true,
        'message' => 'Registration successful',
        'user' => array(
            'id' => $user_id,
            'email' => $email,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'display_name' => $first_name . ' ' . $last_name,
        ),
        'nonce' => wp_create_nonce('wp_rest'),
    );
    
    // Add JWT token if available
    if ($jwt_token) {
        $response_data['token'] = $jwt_token;
    }
    
    return new WP_REST_Response($response_data, 201);
}

/**
 * Login user
 */
function play50_login_user($request) {
    try {
        $params = $request->get_json_params();
        
        // Accept both 'email' (for backward compatibility) and 'email_or_username'
        $email_or_username = isset($params['email_or_username']) ? sanitize_text_field($params['email_or_username']) : (isset($params['email']) ? sanitize_text_field($params['email']) : '');
        $password = isset($params['password']) ? $params['password'] : '';
        
        if (empty($email_or_username) || empty($password)) {
            return new WP_Error('missing_fields', 'Email/Username and password are required', array('status' => 400));
        }
        
        // Try to find user by email first
        $user = null;
        if (is_email($email_or_username)) {
            $user = get_user_by('email', $email_or_username);
        }
        
        // If not found by email, try by username
        if (!$user) {
            $user = get_user_by('login', $email_or_username);
        }
        
        if (!$user) {
            return new WP_Error('invalid_credentials', 'Invalid email/username or password', array('status' => 401));
        }
        
        // Verify password
        if (!wp_check_password($password, $user->user_pass, $user->ID)) {
            return new WP_Error('invalid_credentials', 'Invalid email or password', array('status' => 401));
        }
        
        // Set current user for this request only (DO NOT set auth cookie to prevent loops)
        // Use a static flag to prevent multiple calls
        static $login_user_set = false;
        if (!$login_user_set && get_current_user_id() !== $user->ID) {
            wp_set_current_user($user->ID);
            $login_user_set = true;
        }
        
        // Get user meta
        $first_name = get_user_meta($user->ID, 'first_name', true);
        $last_name = get_user_meta($user->ID, 'last_name', true);
        
        // Generate JWT token (with error handling)
        $jwt_token = null;
        if (defined('JWT_AUTH_SECRET_KEY') && function_exists('play50_generate_jwt_token')) {
            try {
                $jwt_token = play50_generate_jwt_token($user->ID);
            } catch (Exception $e) {
                // JWT generation failed, but continue without token
                $jwt_token = null;
            }
        }
        
        $response_data = array(
            'success' => true,
            'message' => 'Login successful',
            'user' => array(
                'id' => $user->ID,
                'email' => $user->user_email,
                'first_name' => $first_name ? $first_name : '',
                'last_name' => $last_name ? $last_name : '',
                'display_name' => ($first_name && $last_name) ? $first_name . ' ' . $last_name : $user->display_name,
            ),
            'nonce' => wp_create_nonce('wp_rest'),
        );
        
        // Add JWT token if available
        if ($jwt_token) {
            $response_data['token'] = $jwt_token;
        }
        
        return new WP_REST_Response($response_data, 200);
    } catch (Exception $e) {
        return new WP_Error('login_error', 'An error occurred during login: ' . $e->getMessage(), array('status' => 500));
    } catch (Error $e) {
        return new WP_Error('login_error', 'A fatal error occurred during login: ' . $e->getMessage(), array('status' => 500));
    }
}

/**
 * Check authentication status
 */
function play50_auth_status($request) {
    $user_id = get_current_user_id();
    
    if ($user_id === 0) {
        return new WP_REST_Response(array(
            'authenticated' => false,
            'user' => null,
        ), 200);
    }
    
    $user = get_userdata($user_id);
    $first_name = get_user_meta($user_id, 'first_name', true);
    $last_name = get_user_meta($user_id, 'last_name', true);
    
    return new WP_REST_Response(array(
        'authenticated' => true,
        'user' => array(
            'id' => $user_id,
            'email' => $user->user_email,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'display_name' => $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name,
        ),
        'nonce' => wp_create_nonce('wp_rest'),
    ), 200);
}

/**
 * Get current user info (for debugging)
 */
function play50_get_current_user($request) {
    // Try to get user ID from JWT token first, then cookies
    $user_id = get_current_user_id();
    $auth_method = 'none';
    $jwt_token_present = false;
    $cookie_present = false;
    
    // Check JWT token
    $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    if (empty($auth_header) && function_exists('getallheaders')) {
        $headers = getallheaders();
        $auth_header = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    }
    
    if (!empty($auth_header) && preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
        $jwt_token = $matches[1];
        $jwt_token_present = true;
        
        // Try to validate token
        if (function_exists('play50_validate_jwt_token')) {
            $jwt_user_id = play50_validate_jwt_token($jwt_token);
            if ($jwt_user_id > 0) {
                $user_id = $jwt_user_id;
                $auth_method = 'jwt_token';
                wp_set_current_user($user_id);
            }
        }
    }
    
    // Check cookies
    $logged_in_cookie = defined('LOGGED_IN_COOKIE') ? LOGGED_IN_COOKIE : 'wordpress_logged_in_' . COOKIEHASH;
    if (isset($_COOKIE[$logged_in_cookie])) {
        $cookie_present = true;
        if ($user_id === 0) {
            $cookie = $_COOKIE[$logged_in_cookie];
            $cookie_elements = explode('|', $cookie);
            if (count($cookie_elements) >= 2) {
                $user_id_from_cookie = intval($cookie_elements[0]);
                if ($user_id_from_cookie > 0) {
                    $user = get_userdata($user_id_from_cookie);
                    if ($user) {
                        $user_id = $user_id_from_cookie;
                        $auth_method = 'cookie';
                        wp_set_current_user($user_id);
                    }
                }
            }
        }
    }
    
    // Build response
    $response_data = array(
        'user_id' => $user_id,
        'authenticated' => $user_id > 0,
        'auth_method' => $auth_method,
        'jwt_token_present' => $jwt_token_present,
        'cookie_present' => $cookie_present,
        'get_current_user_id' => get_current_user_id(),
    );
    
    if ($user_id > 0) {
        $user = get_userdata($user_id);
        if ($user) {
            $first_name = get_user_meta($user_id, 'first_name', true);
            $last_name = get_user_meta($user_id, 'last_name', true);
            $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
            
            $response_data['user'] = array(
                'id' => $user_id,
                'email' => $user->user_email,
                'username' => $user->user_login,
                'first_name' => $first_name,
                'last_name' => $last_name,
                'display_name' => $display_name,
                'role' => $user->roles ? $user->roles[0] : 'none',
            );
            
            // Get progress count
            $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
            $progress_count = is_array($all_progress) ? count($all_progress) : 0;
            $response_data['progress_count'] = $progress_count;
            
            // Get CPT posts count
            $cpt_count = get_posts(array(
                'post_type' => 'play50_game_progress',
                'author' => $user_id,
                'posts_per_page' => -1,
                'post_status' => 'any',
                'fields' => 'ids',
            ));
            $response_data['cpt_progress_count'] = count($cpt_count);
        } else {
            $response_data['error'] = 'User data not found for ID: ' . $user_id;
        }
    } else {
        $response_data['message'] = 'No user authenticated';
    }
    
    return new WP_REST_Response($response_data, 200);
}

/**
 * Logout user
 */
function play50_logout_user($request) {
    // Clear all WordPress cookies
    wp_logout();
    
    // Also clear any custom cookies
    if (isset($_COOKIE)) {
        foreach ($_COOKIE as $name => $value) {
            if (strpos($name, 'wordpress_') === 0 || strpos($name, 'wp_') === 0) {
                setcookie($name, '', time() - 3600, '/');
            }
        }
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'Logged out successfully',
    ), 200);
}

/**
 * Get all users with progress (admin only)
 */
function play50_get_all_users($request) {
    // Check if user is admin
    if (!current_user_can('manage_options')) {
        return new WP_Error('forbidden', 'Only administrators can access this endpoint', array('status' => 403));
    }
    
    $users = get_users(array(
        'orderby' => 'registered',
        'order' => 'DESC',
    ));
    
    $users_data = array();
    
    foreach ($users as $user) {
        $first_name = get_user_meta($user->ID, 'first_name', true);
        $last_name = get_user_meta($user->ID, 'last_name', true);
        $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
        
        // Get progress count
        $all_progress = get_user_meta($user->ID, 'play50_all_progress', true);
        $progress_count = is_array($all_progress) ? count($all_progress) : 0;
        
        // Get completed games count
        $completed_count = 0;
        if (is_array($all_progress)) {
            foreach ($all_progress as $progress) {
                if (isset($progress['completed']) && $progress['completed']) {
                    $completed_count++;
                }
            }
        }
        
        // Get total score
        $total_score = 0;
        if (is_array($all_progress)) {
            foreach ($all_progress as $progress) {
                if (isset($progress['best_score'])) {
                    $total_score += intval($progress['best_score']);
                }
            }
        }
        
        // Get CPT posts count
        $cpt_count = get_posts(array(
            'post_type' => 'play50_game_progress',
            'author' => $user->ID,
            'posts_per_page' => -1,
            'post_status' => 'any',
            'fields' => 'ids',
        ));
        
        $users_data[] = array(
            'id' => $user->ID,
            'email' => $user->user_email,
            'username' => $user->user_login,
            'first_name' => $first_name,
            'last_name' => $last_name,
            'display_name' => $display_name,
            'role' => $user->roles ? $user->roles[0] : 'none',
            'registered' => $user->user_registered,
            'progress' => array(
                'games_played' => $progress_count,
                'games_completed' => $completed_count,
                'total_score' => $total_score,
                'cpt_entries' => count($cpt_count),
            ),
        );
    }
    
    return new WP_REST_Response(array(
        'success' => true,
        'total_users' => count($users_data),
        'users' => $users_data,
    ), 200);
}

/**
 * Save progress to custom post type
 */
function play50_save_progress_to_cpt($user_id, $game_id, $progress_data) {
    // Check if custom post type is registered
    if (!post_type_exists('play50_game_progress')) {
        error_log('Play50Games: Custom post type play50_game_progress is not registered!');
        return new WP_Error('cpt_not_registered', 'Custom post type not registered');
    }
    
    // Find existing post for this user (one post per user, not per game)
    $existing_posts = get_posts(array(
        'post_type' => 'play50_game_progress',
        'posts_per_page' => 1,
        'post_status' => 'any',
        'author' => $user_id, // Filter by author
        'meta_query' => array(
            array(
                'key' => 'user_progress_all',
                'value' => $user_id,
                'compare' => '='
            )
        )
    ));
    
    // Get all progress for this user from user meta
    $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
    if (!is_array($all_progress)) {
        $all_progress = array();
    }
    
    // Get user info for title
    $user = get_userdata($user_id);
    $first_name = get_user_meta($user_id, 'first_name', true);
    $last_name = get_user_meta($user_id, 'last_name', true);
    $user_name = ($first_name && $last_name) ? $first_name . ' ' . $last_name : ($user ? $user->display_name : ($user ? $user->user_email : ''));
    if (!$user_name) {
        $user_name = 'User #' . $user_id;
    }
    
    // Calculate total games completed
    $completed_count = 0;
    foreach ($all_progress as $progress) {
        if (isset($progress['completed']) && $progress['completed']) {
            $completed_count++;
        }
    }
    
    $post_data = array(
        'post_type' => 'play50_game_progress',
        'post_status' => 'publish',
        'post_title' => $user_name . ' - ' . count($all_progress) . ' Games (' . $completed_count . ' Completed)',
        'post_author' => $user_id,
    );
    
    if (!empty($existing_posts)) {
        // Update existing post
        $post_data['ID'] = $existing_posts[0]->ID;
        $post_id = wp_update_post($post_data, true);
        error_log('Play50Games: Updating existing CPT post ID: ' . $existing_posts[0]->ID . ' for user ' . $user_id);
    } else {
        // Create new post
        error_log('Play50Games: Creating new CPT post for user ' . $user_id);
        $post_id = wp_insert_post($post_data, true);
    }
    
    if (is_wp_error($post_id)) {
        error_log('Play50Games: Failed to save progress to CPT - ' . $post_id->get_error_message());
        return $post_id;
    }
    
    if ($post_id > 0) {
        // Save all progress data as meta (all games in one post)
        $user_progress_data = array(
            'user_id' => $user_id,
            'user_name' => $user_name,
            'user_email' => $user ? $user->user_email : '',
            'all_progress' => $all_progress, // All games progress
            'total_games' => count($all_progress),
            'completed_games' => $completed_count,
            'last_updated' => current_time('mysql'),
        );
        
        $result = update_post_meta($post_id, 'user_progress_all', $user_id);
        $result2 = update_post_meta($post_id, 'progress_fields', $user_progress_data);
        
        error_log('Play50Games: Saved all progress to CPT - Post ID: ' . $post_id . ', User: ' . $user_id . ' (' . $user_name . '), Total Games: ' . count($all_progress) . ', Completed: ' . $completed_count);
    } else {
        error_log('Play50Games: Failed to save progress to CPT - Invalid post ID: ' . $post_id);
    }
    
    return $post_id;
}

