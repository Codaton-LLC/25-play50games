<?php
/* Custom Post Type - Certificates */

function show_certificates_custom_fields() {
    global $post;
    $meta = get_post_meta($post->ID, 'certificate_fields', true);
    
    $certificate_id = isset($meta['certificate_id']) ? $meta['certificate_id'] : '';
    $user_id = isset($meta['user_id']) ? $meta['user_id'] : '';
    $player_name = isset($meta['player_name']) ? $meta['player_name'] : '';
    $completion_date = isset($meta['completion_date']) ? $meta['completion_date'] : '';
    $total_score = isset($meta['total_score']) ? $meta['total_score'] : '';
    $rank = isset($meta['rank']) ? $meta['rank'] : '';
    $pdf_path = isset($meta['pdf_path']) ? $meta['pdf_path'] : '';
    
    ?>
    <div class="wt-wrapper-cpt">
        <input type="hidden" name="certificateMetaNonce" value="<?php echo wp_create_nonce('saveCertificateFields'); ?>">
        
        <table class="form-table">
            <tr>
                <th><label for="certificate_id"><?php _e('Certificate ID (UUID)', 'play50games'); ?></label></th>
                <td>
                    <input type="text" name="certificate_fields[certificate_id]" id="certificate_id" value="<?php echo esc_attr($certificate_id); ?>" class="regular-text" readonly>
                    <p class="description"><?php _e('Auto-generated unique identifier', 'play50games'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="user_id"><?php _e('User ID', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="certificate_fields[user_id]" id="user_id" value="<?php echo esc_attr($user_id); ?>" class="regular-text">
                    <p class="description"><?php _e('WordPress User ID (0 for guest)', 'play50games'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="player_name"><?php _e('Player Name', 'play50games'); ?></label></th>
                <td>
                    <input type="text" name="certificate_fields[player_name]" id="player_name" value="<?php echo esc_attr($player_name); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th><label for="completion_date"><?php _e('Completion Date', 'play50games'); ?></label></th>
                <td>
                    <input type="date" name="certificate_fields[completion_date]" id="completion_date" value="<?php echo esc_attr($completion_date); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th><label for="total_score"><?php _e('Total Score', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="certificate_fields[total_score]" id="total_score" value="<?php echo esc_attr($total_score); ?>" class="regular-text">
                </td>
            </tr>
            <tr>
                <th><label for="rank"><?php _e('Rank', 'play50games'); ?></label></th>
                <td>
                    <input type="text" name="certificate_fields[rank]" id="rank" value="<?php echo esc_attr($rank); ?>" class="regular-text" placeholder="<?php _e('e.g., Master, Expert', 'play50games'); ?>">
                </td>
            </tr>
            <tr>
                <th><label for="pdf_path"><?php _e('PDF Path', 'play50games'); ?></label></th>
                <td>
                    <input type="text" name="certificate_fields[pdf_path]" id="pdf_path" value="<?php echo esc_attr($pdf_path); ?>" class="large-text">
                    <p class="description"><?php _e('Path to generated PDF file', 'play50games'); ?></p>
                </td>
            </tr>
        </table>
    </div>
    <?php
}
/* END - Custom Post Type - Certificates */

