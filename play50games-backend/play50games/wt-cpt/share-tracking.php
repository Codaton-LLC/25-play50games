<?php
/* Share Tracking Admin Page */

// Add admin menu
function add_share_tracking_admin_menu() {
    add_menu_page(
        'Share Tracking',
        'Share Tracking',
        'manage_options',
        'share-tracking',
        'show_share_tracking_page',
        'dashicons-share',
        7
    );
}
add_action('admin_menu', 'add_share_tracking_admin_menu');

// Handle delete actions
function handle_share_tracking_actions() {
    if (!current_user_can('manage_options')) {
        wp_die('Unauthorized access');
    }
    
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    // Delete single share
    if (isset($_GET['action']) && $_GET['action'] === 'delete' && isset($_GET['share_id'])) {
        check_admin_referer('delete_share_' . $_GET['share_id']);
        $share_id = sanitize_text_field($_GET['share_id']);
        $wpdb->delete($table_name, array('share_id' => $share_id), array('%s'));
        wp_redirect(admin_url('admin.php?page=share-tracking&deleted=1'));
        exit;
    }
    
    // Delete all shares
    if (isset($_POST['delete_all_shares']) && check_admin_referer('delete_all_shares_action')) {
        $wpdb->query("TRUNCATE TABLE $table_name");
        wp_redirect(admin_url('admin.php?page=share-tracking&deleted_all=1'));
        exit;
    }
    
    // Delete selected shares
    if (isset($_POST['delete_selected']) && isset($_POST['selected_shares']) && check_admin_referer('delete_selected_shares_action')) {
        $selected = array_map('sanitize_text_field', $_POST['selected_shares']);
        $placeholders = implode(',', array_fill(0, count($selected), '%s'));
        $wpdb->query($wpdb->prepare(
            "DELETE FROM $table_name WHERE share_id IN ($placeholders)",
            ...$selected
        ));
        wp_redirect(admin_url('admin.php?page=share-tracking&deleted_selected=1'));
        exit;
    }
}
add_action('admin_init', 'handle_share_tracking_actions');

// Show admin page
function show_share_tracking_page() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'play50_share_tracking';
    
    // Check if table exists, if not create it
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
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
        dbDelta($sql);
    }
    
    // Filter by game type
    $filter_game = isset($_GET['filter_game']) ? sanitize_text_field($_GET['filter_game']) : '';
    $where_clause = '';
    if (!empty($filter_game)) {
        $where_clause = $wpdb->prepare(" WHERE game_type = %s", $filter_game);
    }
    
    // Get all shares
    $shares = $wpdb->get_results(
        "SELECT * FROM $table_name $where_clause ORDER BY created_at DESC",
        ARRAY_A
    );
    
    // Get unique game types for filter
    $game_types = $wpdb->get_col("SELECT DISTINCT game_type FROM $table_name ORDER BY game_type");
    
    // Show success messages
    if (isset($_GET['deleted']) && $_GET['deleted'] == '1') {
        echo '<div class="notice notice-success is-dismissible"><p>Share deleted successfully!</p></div>';
    }
    if (isset($_GET['deleted_all']) && $_GET['deleted_all'] == '1') {
        echo '<div class="notice notice-success is-dismissible"><p>All shares deleted successfully!</p></div>';
    }
    if (isset($_GET['deleted_selected']) && $_GET['deleted_selected'] == '1') {
        echo '<div class="notice notice-success is-dismissible"><p>Selected shares deleted successfully!</p></div>';
    }
    
    ?>
    <div class="wrap">
        <h1>Share Tracking</h1>
        <p>View and manage all game share links and their click statistics.</p>
        
        <?php if (!empty($game_types)): ?>
            <div style="margin: 20px 0; padding: 10px; background: #f0f0f1; border-radius: 4px;">
                <label for="filter_game" style="font-weight: bold; margin-right: 10px;">Filter by Game:</label>
                <select id="filter_game" name="filter_game" onchange="window.location.href='<?php echo admin_url('admin.php?page=share-tracking'); ?>&filter_game=' + this.value">
                    <option value="">All Games</option>
                    <?php foreach ($game_types as $type): ?>
                        <option value="<?php echo esc_attr($type); ?>" <?php selected($filter_game, $type); ?>>
                            <?php echo esc_html(ucfirst(str_replace('-', ' ', $type))); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <?php if (!empty($filter_game)): ?>
                    <a href="<?php echo admin_url('admin.php?page=share-tracking'); ?>" class="button" style="margin-left: 10px;">Clear Filter</a>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        
        <?php if (empty($shares)): ?>
            <div class="notice notice-info">
                <p>No shares found. Shares will appear here when users share game links.</p>
            </div>
        <?php else: ?>
            <div style="margin: 20px 0;">
                <form method="post" action="" style="display: inline-block; margin-right: 10px;">
                    <?php wp_nonce_field('delete_all_shares_action'); ?>
                    <button type="submit" name="delete_all_shares" class="button button-secondary" 
                            onclick="return confirm('Are you sure you want to delete ALL shares? This action cannot be undone.');">
                        Delete All Shares
                    </button>
                </form>
                <span style="color: #666; font-size: 13px;">
                    Total Shares: <strong><?php echo count($shares); ?></strong> | 
                    Total Clicks: <strong><?php echo array_sum(array_column($shares, 'clicks')); ?></strong>
                </span>
            </div>
            
            <form method="post" action="" id="share-tracking-form">
                <?php wp_nonce_field('delete_selected_shares_action'); ?>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th style="width: 30px;">
                                <input type="checkbox" id="select-all-shares">
                            </th>
                            <th>Share ID</th>
                            <th>Game Type</th>
                            <th>Clicks</th>
                            <th>Created At</th>
                            <th>Last Click At</th>
                            <th style="width: 100px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($shares as $share): ?>
                            <tr>
                                <td>
                                    <input type="checkbox" name="selected_shares[]" value="<?php echo esc_attr($share['share_id']); ?>">
                                </td>
                                <td>
                                    <code style="background: #f0f0f1; padding: 2px 6px; border-radius: 3px;">
                                        <?php echo esc_html($share['share_id']); ?>
                                    </code>
                                </td>
                                <td>
                                    <strong><?php echo esc_html(ucfirst(str_replace('-', ' ', $share['game_type']))); ?></strong>
                                </td>
                                <td>
                                    <span style="font-size: 18px; font-weight: bold; color: <?php echo $share['clicks'] > 0 ? '#2271b1' : '#666'; ?>;">
                                        <?php echo intval($share['clicks']); ?>
                                    </span>
                                    <?php if ($share['clicks'] > 0): ?>
                                        <span style="color: #46b450; margin-left: 5px;" title="Share was clicked">✓</span>
                                    <?php else: ?>
                                        <span style="color: #999; margin-left: 5px;" title="No clicks yet">○</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php 
                                    $created = strtotime($share['created_at']);
                                    echo date('Y-m-d H:i:s', $created);
                                    ?>
                                    <br>
                                    <small style="color: #666;">
                                        <?php echo human_time_diff($created, current_time('timestamp')); ?> ago
                                    </small>
                                </td>
                                <td>
                                    <?php if ($share['last_click_at']): ?>
                                        <?php 
                                        $last_click = strtotime($share['last_click_at']);
                                        echo date('Y-m-d H:i:s', $last_click);
                                        ?>
                                        <br>
                                        <small style="color: #666;">
                                            <?php echo human_time_diff($last_click, current_time('timestamp')); ?> ago
                                        </small>
                                    <?php else: ?>
                                        <span style="color: #999;">Never</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <a href="<?php echo wp_nonce_url(
                                        admin_url('admin.php?page=share-tracking&action=delete&share_id=' . $share['share_id']),
                                        'delete_share_' . $share['share_id']
                                    ); ?>" 
                                       class="button button-small" 
                                       onclick="return confirm('Are you sure you want to delete this share?');">
                                        Delete
                                    </a>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                
                <div style="margin-top: 20px;">
                    <button type="submit" name="delete_selected" class="button button-secondary"
                            onclick="return confirm('Are you sure you want to delete the selected shares?');">
                        Delete Selected
                    </button>
                </div>
            </form>
            
            <script>
                // Select all checkbox
                document.getElementById('select-all-shares').addEventListener('change', function() {
                    const checkboxes = document.querySelectorAll('input[name="selected_shares[]"]');
                    checkboxes.forEach(cb => cb.checked = this.checked);
                });
            </script>
        <?php endif; ?>
    </div>
    <?php
}

