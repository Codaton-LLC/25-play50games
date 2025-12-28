<?php
/**
 * Custom Post Type - Game Progress
 * Ruajtje e rezultateve të lojës për secilin përdorues
 */

// Register Custom Post Type
function play50_register_game_progress_cpt() {
    $labels = array(
        'name'                  => 'Game Progress',
        'singular_name'         => 'Game Progress',
        'menu_name'             => 'Game Progress',
        'name_admin_bar'        => 'Game Progress',
        'archives'              => 'Progress Archives',
        'attributes'            => 'Progress Attributes',
        'parent_item_colon'     => 'Parent Progress:',
        'all_items'             => 'All Progress',
        'add_new_item'          => 'Add New Progress',
        'add_new'               => 'Add New',
        'new_item'              => 'New Progress',
        'edit_item'             => 'Edit Progress',
        'update_item'           => 'Update Progress',
        'view_item'             => 'View Progress',
        'view_items'            => 'View Progress',
        'search_items'          => 'Search Progress',
        'not_found'             => 'Not found',
        'not_found_in_trash'    => 'Not found in Trash',
    );
    
    $args = array(
        'label'                 => 'Game Progress',
        'description'           => 'Game progress and results for each user',
        'labels'                => $labels,
        'supports'              => array('title', 'custom-fields'),
        'hierarchical'          => false,
        'public'                => false,
        'show_ui'               => true,
        'show_in_menu'          => true,
        'menu_position'         => 25,
        'menu_icon'             => 'dashicons-chart-line',
        'show_in_admin_bar'     => true,
        'show_in_nav_menus'     => false,
        'can_export'            => true,
        'has_archive'           => false,
        'exclude_from_search'   => true,
        'publicly_queryable'    => false,
        'capability_type'       => 'post',
        'show_in_rest'          => false,
    );
    
    register_post_type('play50_game_progress', $args);
}
add_action('init', 'play50_register_game_progress_cpt', 0);

// Add custom columns to admin list
function play50_game_progress_columns($columns) {
    $new_columns = array();
    $new_columns['cb'] = $columns['cb'];
    $new_columns['title'] = 'Progress ID';
    $new_columns['user'] = 'User';
    $new_columns['game'] = 'Game';
    $new_columns['score'] = 'Score';
    $new_columns['best_score'] = 'Best Score';
    $new_columns['completed'] = 'Completed';
    $new_columns['attempts'] = 'Attempts';
    $new_columns['last_played'] = 'Last Played';
    $new_columns['date'] = 'Created';
    return $new_columns;
}
add_filter('manage_play50_game_progress_posts_columns', 'play50_game_progress_columns');

// Populate custom columns
function play50_game_progress_column_content($column, $post_id) {
    $meta = get_post_meta($post_id, 'progress_fields', true);
    
    switch ($column) {
        case 'user':
            $user_id = isset($meta['user_id']) ? intval($meta['user_id']) : 0;
            if ($user_id > 0) {
                $user = get_userdata($user_id);
                if ($user) {
                    $first_name = get_user_meta($user_id, 'first_name', true);
                    $last_name = get_user_meta($user_id, 'last_name', true);
                    $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
                    echo '<a href="' . admin_url('user-edit.php?user_id=' . $user_id) . '">' . esc_html($display_name) . '</a><br>';
                    echo '<small>' . esc_html($user->user_email) . '</small>';
                } else {
                    echo 'User #' . $user_id . ' (deleted)';
                }
            } else {
                echo 'Guest';
            }
            break;
            
        case 'game':
            $game_id = isset($meta['game_id']) ? intval($meta['game_id']) : 0;
            if ($game_id > 0) {
                $game = get_post($game_id);
                if ($game) {
                    echo '<a href="' . admin_url('post.php?post=' . $game_id . '&action=edit') . '">' . esc_html($game->post_title) . '</a>';
                    echo '<br><small>ID: ' . $game_id . '</small>';
                } else {
                    echo 'Game #' . $game_id . ' (deleted)';
                }
            } else {
                echo 'N/A';
            }
            break;
            
        case 'score':
            $score = isset($meta['score']) ? intval($meta['score']) : 0;
            echo '<strong>' . $score . '%</strong>';
            break;
            
        case 'best_score':
            $best_score = isset($meta['best_score']) ? intval($meta['best_score']) : 0;
            echo '<strong style="color: #2271b1;">' . $best_score . '%</strong>';
            break;
            
        case 'completed':
            $completed = isset($meta['completed']) ? $meta['completed'] : false;
            if ($completed) {
                echo '<span style="color: #00a32a; font-weight: bold;">✓ Yes</span>';
                if (isset($meta['completed_at']) && $meta['completed_at']) {
                    echo '<br><small>' . date_i18n('Y-m-d H:i', strtotime($meta['completed_at'])) . '</small>';
                }
            } else {
                echo '<span style="color: #d63638;">✗ No</span>';
            }
            break;
            
        case 'attempts':
            $attempts = isset($meta['attempts']) ? intval($meta['attempts']) : 0;
            echo $attempts;
            break;
            
        case 'last_played':
            $last_played = isset($meta['last_played']) ? $meta['last_played'] : '';
            if ($last_played) {
                echo date_i18n('Y-m-d H:i', strtotime($last_played));
            } else {
                echo 'N/A';
            }
            break;
    }
}
add_action('manage_play50_game_progress_posts_custom_column', 'play50_game_progress_column_content', 10, 2);

// Make columns sortable
function play50_game_progress_sortable_columns($columns) {
    $columns['user'] = 'user_id';
    $columns['game'] = 'game_id';
    $columns['score'] = 'score';
    $columns['best_score'] = 'best_score';
    $columns['completed'] = 'completed';
    $columns['attempts'] = 'attempts';
    $columns['last_played'] = 'last_played';
    return $columns;
}
add_filter('manage_edit-play50_game_progress_sortable_columns', 'play50_game_progress_sortable_columns');

// Handle sorting
function play50_game_progress_orderby($query) {
    if (!is_admin() || !$query->is_main_query()) {
        return;
    }
    
    $orderby = $query->get('orderby');
    if (!$orderby) {
        return;
    }
    
    switch ($orderby) {
        case 'user_id':
        case 'game_id':
        case 'score':
        case 'best_score':
        case 'attempts':
            $query->set('meta_key', 'progress_fields');
            $query->set('orderby', 'meta_value_num');
            break;
        case 'completed':
            $query->set('meta_key', 'progress_fields');
            $query->set('orderby', 'meta_value');
            break;
        case 'last_played':
            $query->set('meta_key', 'progress_fields');
            $query->set('orderby', 'meta_value');
            break;
    }
}
add_action('pre_get_posts', 'play50_game_progress_orderby');

// Add filters for user and game
function play50_game_progress_filters() {
    global $typenow;
    
    if ($typenow == 'play50_game_progress') {
        // User filter
        $users = get_users(array('orderby' => 'display_name'));
        echo '<select name="filter_user" id="filter_user">';
        echo '<option value="">All Users</option>';
        foreach ($users as $user) {
            $first_name = get_user_meta($user->ID, 'first_name', true);
            $last_name = get_user_meta($user->ID, 'last_name', true);
            $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
            $selected = isset($_GET['filter_user']) && $_GET['filter_user'] == $user->ID ? 'selected' : '';
            echo '<option value="' . $user->ID . '" ' . $selected . '>' . esc_html($display_name) . ' (' . esc_html($user->user_email) . ')</option>';
        }
        echo '</select>';
        
        // Game filter
        $games = get_posts(array(
            'post_type' => 'play50_game',
            'posts_per_page' => -1,
            'orderby' => 'title',
            'order' => 'ASC'
        ));
        echo '<select name="filter_game" id="filter_game">';
        echo '<option value="">All Games</option>';
        foreach ($games as $game) {
            $selected = isset($_GET['filter_game']) && $_GET['filter_game'] == $game->ID ? 'selected' : '';
            echo '<option value="' . $game->ID . '" ' . $selected . '>' . esc_html($game->post_title) . '</option>';
        }
        echo '</select>';
        
        // Completed filter
        echo '<select name="filter_completed" id="filter_completed">';
        echo '<option value="">All Status</option>';
        $selected_completed = isset($_GET['filter_completed']) && $_GET['filter_completed'] == '1' ? 'selected' : '';
        $selected_not_completed = isset($_GET['filter_completed']) && $_GET['filter_completed'] == '0' ? 'selected' : '';
        echo '<option value="1" ' . $selected_completed . '>Completed</option>';
        echo '<option value="0" ' . $selected_not_completed . '>Not Completed</option>';
        echo '</select>';
    }
}
add_action('restrict_manage_posts', 'play50_game_progress_filters');

// Apply filters
function play50_game_progress_filter_query($query) {
    global $pagenow, $typenow;
    
    if ($pagenow == 'edit.php' && $typenow == 'play50_game_progress') {
        $meta_query = array();
        
        if (isset($_GET['filter_user']) && $_GET['filter_user'] != '') {
            $meta_query[] = array(
                'key' => 'progress_fields',
                'value' => '"user_id";i:' . intval($_GET['filter_user']),
                'compare' => 'LIKE'
            );
        }
        
        if (isset($_GET['filter_game']) && $_GET['filter_game'] != '') {
            $meta_query[] = array(
                'key' => 'progress_fields',
                'value' => '"game_id";i:' . intval($_GET['filter_game']),
                'compare' => 'LIKE'
            );
        }
        
        if (isset($_GET['filter_completed']) && $_GET['filter_completed'] != '') {
            $completed_value = $_GET['filter_completed'] == '1' ? 'b:1' : 'b:0';
            $meta_query[] = array(
                'key' => 'progress_fields',
                'value' => '"completed";' . $completed_value,
                'compare' => 'LIKE'
            );
        }
        
        if (!empty($meta_query)) {
            $query->set('meta_query', $meta_query);
        }
    }
}
add_action('parse_query', 'play50_game_progress_filter_query');

// Hide title field and show custom fields
function play50_game_progress_meta_box() {
    global $post;
    
    $meta = get_post_meta($post->ID, 'progress_fields', true);
    
    $user_id = isset($meta['user_id']) ? intval($meta['user_id']) : 0;
    $game_id = isset($meta['game_id']) ? intval($meta['game_id']) : 0;
    $score = isset($meta['score']) ? intval($meta['score']) : 0;
    $best_score = isset($meta['best_score']) ? intval($meta['best_score']) : 0;
    $completed = isset($meta['completed']) ? $meta['completed'] : false;
    $attempts = isset($meta['attempts']) ? intval($meta['attempts']) : 0;
    $last_played = isset($meta['last_played']) ? $meta['last_played'] : '';
    $completed_at = isset($meta['completed_at']) ? $meta['completed_at'] : '';
    
    ?>
    <div style="padding: 20px;">
        <table class="form-table">
            <tr>
                <th><label>User</label></th>
                <td>
                    <?php
                    if ($user_id > 0) {
                        $user = get_userdata($user_id);
                        if ($user) {
                            $first_name = get_user_meta($user_id, 'first_name', true);
                            $last_name = get_user_meta($user_id, 'last_name', true);
                            $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
                            echo '<strong>' . esc_html($display_name) . '</strong><br>';
                            echo '<small>' . esc_html($user->user_email) . '</small>';
                        } else {
                            echo 'User #' . $user_id . ' (deleted)';
                        }
                    } else {
                        echo 'Guest User';
                    }
                    ?>
                </td>
            </tr>
            <tr>
                <th><label>Game</label></th>
                <td>
                    <?php
                    if ($game_id > 0) {
                        $game = get_post($game_id);
                        if ($game) {
                            echo '<strong>' . esc_html($game->post_title) . '</strong><br>';
                            echo '<small>Game ID: ' . $game_id . '</small>';
                        } else {
                            echo 'Game #' . $game_id . ' (deleted)';
                        }
                    } else {
                        echo 'N/A';
                    }
                    ?>
                </td>
            </tr>
            <tr>
                <th><label>Current Score</label></th>
                <td><strong style="font-size: 18px;"><?php echo $score; ?>%</strong></td>
            </tr>
            <tr>
                <th><label>Best Score</label></th>
                <td><strong style="font-size: 18px; color: #2271b1;"><?php echo $best_score; ?>%</strong></td>
            </tr>
            <tr>
                <th><label>Completed</label></th>
                <td>
                    <?php if ($completed): ?>
                        <span style="color: #00a32a; font-weight: bold; font-size: 16px;">✓ Yes</span>
                        <?php if ($completed_at): ?>
                            <br><small>Completed at: <?php echo date_i18n('Y-m-d H:i:s', strtotime($completed_at)); ?></small>
                        <?php endif; ?>
                    <?php else: ?>
                        <span style="color: #d63638;">✗ No</span>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <th><label>Attempts</label></th>
                <td><strong><?php echo $attempts; ?></strong></td>
            </tr>
            <tr>
                <th><label>Last Played</label></th>
                <td>
                    <?php if ($last_played): ?>
                        <?php echo date_i18n('Y-m-d H:i:s', strtotime($last_played)); ?>
                    <?php else: ?>
                        N/A
                    <?php endif; ?>
                </td>
            </tr>
        </table>
    </div>
    <?php
}

function play50_add_game_progress_meta_box() {
    add_meta_box(
        'play50_game_progress_details',
        'Progress Details',
        'play50_game_progress_meta_box',
        'play50_game_progress',
        'normal',
        'high'
    );
}
add_action('add_meta_boxes', 'play50_add_game_progress_meta_box');

