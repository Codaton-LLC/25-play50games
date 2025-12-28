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
    $new_columns['title'] = 'User';
    $new_columns['total_games'] = 'Total Games';
    $new_columns['completed_games'] = 'Completed';
    $new_columns['last_updated'] = 'Last Updated';
    $new_columns['date'] = 'Created';
    return $new_columns;
}
add_filter('manage_play50_game_progress_posts_columns', 'play50_game_progress_columns');

// Populate custom columns
function play50_game_progress_column_content($column, $post_id) {
    $meta = get_post_meta($post_id, 'progress_fields', true);
    
    switch ($column) {
        case 'title':
            // User card display
            $user_id = isset($meta['user_id']) ? intval($meta['user_id']) : get_post_field('post_author', $post_id);
            if ($user_id > 0) {
                $user = get_userdata($user_id);
                if ($user) {
                    $first_name = get_user_meta($user_id, 'first_name', true);
                    $last_name = get_user_meta($user_id, 'last_name', true);
                    $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
                    echo '<div style="padding: 10px; background: #f0f0f1; border-radius: 4px; margin: 5px 0;">';
                    echo '<strong style="font-size: 16px; color: #2271b1;">' . esc_html($display_name) . '</strong><br>';
                    echo '<small><strong>User ID:</strong> ' . esc_html($user_id) . '</small><br>';
                    echo '<small>' . esc_html($user->user_email) . '</small><br>';
                    echo '<small><a href="' . admin_url('user-edit.php?user_id=' . $user_id) . '">Edit User</a></small>';
                    echo '</div>';
                } else {
                    echo 'User #' . $user_id . ' (deleted)';
                }
            } else {
                echo 'Guest';
            }
            break;
            
        case 'total_games':
            $total = isset($meta['total_games']) ? intval($meta['total_games']) : 0;
            echo '<strong style="font-size: 16px;">' . $total . '</strong>';
            break;
            
        case 'completed_games':
            $completed = isset($meta['completed_games']) ? intval($meta['completed_games']) : 0;
            $total = isset($meta['total_games']) ? intval($meta['total_games']) : 0;
            echo '<strong style="color: #00a32a; font-size: 16px;">' . $completed . ' / ' . $total . '</strong>';
            break;
            
        case 'last_updated':
            $last_updated = isset($meta['last_updated']) ? $meta['last_updated'] : '';
            if ($last_updated) {
                echo date_i18n('Y-m-d H:i', strtotime($last_updated));
            } else {
                echo 'N/A';
            }
            break;
    }
}
add_action('manage_play50_game_progress_posts_custom_column', 'play50_game_progress_column_content', 10, 2);

// Make columns sortable
function play50_game_progress_sortable_columns($columns) {
    $columns['total_games'] = 'total_games';
    $columns['completed_games'] = 'completed_games';
    $columns['last_updated'] = 'last_updated';
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
        case 'total_games':
        case 'completed_games':
            $query->set('meta_key', 'progress_fields');
            $query->set('orderby', 'meta_value_num');
            break;
        case 'last_updated':
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
        
    }
}
add_action('restrict_manage_posts', 'play50_game_progress_filters');

// Apply filters
function play50_game_progress_filter_query($query) {
    global $pagenow, $typenow;
    
    if ($pagenow == 'edit.php' && $typenow == 'play50_game_progress') {
        $meta_query = array();
        
        if (isset($_GET['filter_user']) && $_GET['filter_user'] != '') {
            $user_id = intval($_GET['filter_user']);
            // Filter by user_progress_all meta key or by author
            $query->set('author', $user_id);
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
    
    $user_id = isset($meta['user_id']) ? intval($meta['user_id']) : get_post_field('post_author', $post->ID);
    $all_progress = isset($meta['all_progress']) && is_array($meta['all_progress']) ? $meta['all_progress'] : array();
    
    ?>
    <div style="padding: 20px;">
        <!-- User Card -->
        <div style="background: #f0f0f1; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin-top: 0;">User Information</h2>
            <?php
            if ($user_id > 0) {
                $user = get_userdata($user_id);
                if ($user) {
                    $first_name = get_user_meta($user_id, 'first_name', true);
                    $last_name = get_user_meta($user_id, 'last_name', true);
                    $display_name = $first_name && $last_name ? $first_name . ' ' . $last_name : $user->display_name;
                    echo '<p><strong style="font-size: 18px;">' . esc_html($display_name) . '</strong></p>';
                    echo '<p><strong>User ID:</strong> ' . esc_html($user_id) . '</p>';
                    echo '<p><strong>Email:</strong> ' . esc_html($user->user_email) . '</p>';
                    echo '<p><a href="' . admin_url('user-edit.php?user_id=' . $user_id) . '" class="button">Edit User</a></p>';
                } else {
                    echo '<p>User #' . $user_id . ' (deleted)</p>';
                }
            } else {
                echo '<p>Guest User</p>';
            }
            ?>
        </div>
        
        <!-- Progress Table -->
        <h2>Game Progress Table</h2>
        <?php if (empty($all_progress)): ?>
            <p>No progress recorded yet.</p>
        <?php else: ?>
            <table class="wp-list-table widefat fixed striped" style="margin-top: 10px;">
                <thead>
                    <tr>
                        <th>Game ID</th>
                        <th>Game Name</th>
                        <th>Score</th>
                        <th>Best Score</th>
                        <th>Completed</th>
                        <th>Attempts</th>
                        <th>Last Played</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    foreach ($all_progress as $game_id => $progress):
                        $game = get_post($game_id);
                        $game_name = $game ? $game->post_title : 'Game #' . $game_id;
                        $score = isset($progress['score']) ? intval($progress['score']) : 0;
                        $best_score = isset($progress['best_score']) ? intval($progress['best_score']) : 0;
                        $completed = isset($progress['completed']) ? $progress['completed'] : false;
                        $attempts = isset($progress['attempts']) ? intval($progress['attempts']) : 0;
                        $last_played = isset($progress['last_played']) ? $progress['last_played'] : '';
                        $completed_at = isset($progress['completed_at']) ? $progress['completed_at'] : '';
                    ?>
                    <tr>
                        <td><?php echo $game_id; ?></td>
                        <td>
                            <?php if ($game): ?>
                                <a href="<?php echo admin_url('post.php?post=' . $game_id . '&action=edit'); ?>"><?php echo esc_html($game_name); ?></a>
                            <?php else: ?>
                                <?php echo esc_html($game_name); ?>
                            <?php endif; ?>
                        </td>
                        <td><strong><?php echo $score; ?>%</strong></td>
                        <td><strong style="color: #2271b1;"><?php echo $best_score; ?>%</strong></td>
                        <td>
                            <?php if ($completed): ?>
                                <span style="color: #00a32a; font-weight: bold;">✓ Yes</span>
                                <?php if ($completed_at): ?>
                                    <br><small><?php echo date_i18n('Y-m-d H:i', strtotime($completed_at)); ?></small>
                                <?php endif; ?>
                            <?php else: ?>
                                <span style="color: #d63638;">✗ No</span>
                            <?php endif; ?>
                        </td>
                        <td><?php echo $attempts; ?></td>
                        <td>
                            <?php if ($last_played): ?>
                                <?php echo date_i18n('Y-m-d H:i', strtotime($last_played)); ?>
                            <?php else: ?>
                                N/A
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
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

