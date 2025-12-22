<?php
/**
 * Play50Games REST API Endpoints
 */

// Enable CORS for REST API
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        // Get allowed origin from wp-config.php or use default
        $allowed_origin = defined('PLAY50_CORS_ORIGIN') ? PLAY50_CORS_ORIGIN : '*';
        
        // If multiple origins defined, check request origin
        if (strpos($allowed_origin, ',') !== false) {
            $origins = array_map('trim', explode(',', $allowed_origin));
            $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
            if (in_array($request_origin, $origins)) {
                $allowed_origin = $request_origin;
            } else {
                $allowed_origin = $origins[0]; // Default to first
            }
        }
        
        header('Access-Control-Allow-Origin: ' . $allowed_origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        return $value;
    });
}, 15);

// Handle OPTIONS preflight requests
add_action('rest_api_init', function() {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        // Get allowed origin from wp-config.php or use default
        $allowed_origin = defined('PLAY50_CORS_ORIGIN') ? PLAY50_CORS_ORIGIN : '*';
        
        // If multiple origins defined, check request origin
        if (strpos($allowed_origin, ',') !== false) {
            $origins = array_map('trim', explode(',', $allowed_origin));
            $request_origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
            if (in_array($request_origin, $origins)) {
                $allowed_origin = $request_origin;
            } else {
                $allowed_origin = $origins[0]; // Default to first
            }
        }
        
        header('Access-Control-Allow-Origin: ' . $allowed_origin);
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Access-Control-Max-Age: 86400');
        exit(0);
    }
}, 10);

// Register REST API routes
add_action('rest_api_init', function() {
    
    // Get all games with unlock status
    register_rest_route('play50/v1', '/games', array(
        'methods' => 'GET',
        'callback' => 'play50_get_games',
        'permission_callback' => '__return_true',
    ));
    
    // Get single game by ID
    register_rest_route('play50/v1', '/games/(?P<id>\d+)', array(
        'methods' => 'GET',
        'callback' => 'play50_get_game',
        'permission_callback' => '__return_true',
    ));
    
    // Save/Get user progress
    register_rest_route('play50/v1', '/progress', array(
        'methods' => 'POST',
        'callback' => 'play50_save_progress',
        'permission_callback' => '__return_true',
    ));
    
    register_rest_route('play50/v1', '/progress', array(
        'methods' => 'GET',
        'callback' => 'play50_get_progress',
        'permission_callback' => '__return_true',
    ));
    
    // Get unlock status for all games
    register_rest_route('play50/v1', '/unlock-status', array(
        'methods' => 'GET',
        'callback' => 'play50_get_unlock_status',
        'permission_callback' => '__return_true',
    ));
    
    // Generate certificate
    register_rest_route('play50/v1', '/certificate/generate', array(
        'methods' => 'POST',
        'callback' => 'play50_generate_certificate',
        'permission_callback' => '__return_true',
    ));
    
    // Get certificate by ID
    register_rest_route('play50/v1', '/certificate/(?P<id>[a-f0-9\-]+)', array(
        'methods' => 'GET',
        'callback' => 'play50_get_certificate',
        'permission_callback' => '__return_true',
    ));
});

/**
 * Get all games with unlock status
 */
function play50_get_games($request) {
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id'); // For guest users
    
    $args = array(
        'post_type' => 'play50_game',
        'posts_per_page' => -1,
        'orderby' => 'meta_value_num',
        'meta_key' => 'game_fields_game_order',
        'order' => 'ASC',
    );
    
    $games_query = new WP_Query($args);
    $games = array();
    
    if ($games_query->have_posts()) {
        foreach ($games_query->posts as $game) {
            $meta = get_post_meta($game->ID, 'game_fields', true);
            $game_order = isset($meta['game_order']) ? intval($meta['game_order']) : 0;
            
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
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id');
    $game_id = intval($request->get_param('game_id'));
    $score = intval($request->get_param('score'));
    $completed = $request->get_param('completed') === 'true' || $request->get_param('completed') === true;
    
    if (!$game_id || $score < 0) {
        return new WP_Error('invalid_data', 'Invalid game_id or score', array('status' => 400));
    }
    
    // For logged-in users, save to user meta
    if ($user_id > 0) {
        $progress_key = 'play50_game_progress_' . $game_id;
        $existing = get_user_meta($user_id, $progress_key, true);
        
        $progress_data = array(
            'game_id' => $game_id,
            'score' => $score,
            'completed' => $completed,
            'completed_at' => $completed ? current_time('mysql') : null,
            'attempts' => isset($existing['attempts']) ? intval($existing['attempts']) + 1 : 1,
            'best_score' => isset($existing['best_score']) ? max($existing['best_score'], $score) : $score,
            'last_played' => current_time('mysql'),
        );
        
        update_user_meta($user_id, $progress_key, $progress_data);
        
        // Also store in a list for easy retrieval
        $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
        if (!is_array($all_progress)) {
            $all_progress = array();
        }
        $all_progress[$game_id] = $progress_data;
        update_user_meta($user_id, 'play50_all_progress', $all_progress);
        
        return new WP_REST_Response(array('success' => true, 'data' => $progress_data), 200);
    }
    
    // For guest users, return success (they'll use localStorage)
    return new WP_REST_Response(array('success' => true, 'message' => 'Progress saved locally'), 200);
}

/**
 * Get user progress
 */
function play50_get_progress($request) {
    $user_id = get_current_user_id();
    $guest_id = $request->get_param('guest_id');
    $game_id = $request->get_param('game_id');
    
    if ($user_id > 0) {
        if ($game_id) {
            // Get specific game progress
            $progress_key = 'play50_game_progress_' . intval($game_id);
            $progress = get_user_meta($user_id, $progress_key, true);
            return new WP_REST_Response($progress ? $progress : array(), 200);
        } else {
            // Get all progress
            $all_progress = get_user_meta($user_id, 'play50_all_progress', true);
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
        'orderby' => 'meta_value_num',
        'meta_key' => 'game_fields_game_order',
        'order' => 'ASC',
    );
    
    $games_query = new WP_Query($args);
    $unlock_status = array();
    
    if ($games_query->have_posts()) {
        foreach ($games_query->posts as $game) {
            $is_unlocked = play50_is_game_unlocked($game->ID, $user_id, $guest_id);
            $unlock_status[$game->ID] = $is_unlocked;
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
    
    if (empty($player_name)) {
        return new WP_Error('invalid_data', 'Player name is required', array('status' => 400));
    }
    
    // Check if all games are completed
    $all_progress = $user_id > 0 ? get_user_meta($user_id, 'play50_all_progress', true) : array();
    
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
    
    $certificate_data = array(
        'certificate_id' => $certificate_id,
        'user_id' => $user_id,
        'player_name' => $player_name,
        'completion_date' => current_time('Y-m-d'),
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

