<?php
/* Custom Post Type - Games */

function show_games_custom_fields() {
    global $post;
    $meta = get_post_meta($post->ID, 'game_fields', true);
    
    $game_type = isset($meta['game_type']) ? $meta['game_type'] : 'logic';
    $game_order = isset($meta['game_order']) ? $meta['game_order'] : '';
    $difficulty = isset($meta['difficulty']) ? $meta['difficulty'] : '1';
    $time_limit = isset($meta['time_limit']) ? $meta['time_limit'] : '60';
    $passing_score = isset($meta['passing_score']) ? $meta['passing_score'] : '70';
    $game_config = isset($meta['game_config']) ? $meta['game_config'] : '';
    $unlock_requirement = isset($meta['unlock_requirement']) ? $meta['unlock_requirement'] : '';
    $description = isset($meta['description']) ? $meta['description'] : '';
    
    ?>
    <div class="wt-wrapper-cpt">
        <input type="hidden" name="gameMetaNonce" value="<?php echo wp_create_nonce('saveGameFields'); ?>">
        
        <table class="form-table">
            <tr>
                <th><label for="game_type"><?php _e('Game Type', 'play50games'); ?></label></th>
                <td>
                    <select name="game_fields[game_type]" id="game_type" class="regular-text">
                        <option value="logic" <?php selected($game_type, 'logic'); ?>><?php _e('Logic', 'play50games'); ?></option>
                        <option value="memory" <?php selected($game_type, 'memory'); ?>><?php _e('Memory', 'play50games'); ?></option>
                        <option value="speed" <?php selected($game_type, 'speed'); ?>><?php _e('Speed', 'play50games'); ?></option>
                        <option value="skill" <?php selected($game_type, 'skill'); ?>><?php _e('Skill', 'play50games'); ?></option>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="game_order"><?php _e('Game Order (1-50)', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="game_fields[game_order]" id="game_order" value="<?php echo esc_attr($game_order); ?>" min="1" max="50" class="regular-text" required>
                </td>
            </tr>
            <tr>
                <th><label for="difficulty"><?php _e('Difficulty (1-5)', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="game_fields[difficulty]" id="difficulty" value="<?php echo esc_attr($difficulty); ?>" min="1" max="5" class="regular-text" required>
                </td>
            </tr>
            <tr>
                <th><label for="time_limit"><?php _e('Time Limit (seconds)', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="game_fields[time_limit]" id="time_limit" value="<?php echo esc_attr($time_limit); ?>" min="10" class="regular-text" required>
                </td>
            </tr>
            <tr>
                <th><label for="passing_score"><?php _e('Passing Score (0-100)', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="game_fields[passing_score]" id="passing_score" value="<?php echo esc_attr($passing_score); ?>" min="0" max="100" class="regular-text" required>
                </td>
            </tr>
            <tr>
                <th><label for="unlock_requirement"><?php _e('Unlock Requirement (Game ID)', 'play50games'); ?></label></th>
                <td>
                    <input type="number" name="game_fields[unlock_requirement]" id="unlock_requirement" value="<?php echo esc_attr($unlock_requirement); ?>" class="regular-text" placeholder="<?php _e('Leave empty for Game 1', 'play50games'); ?>">
                    <p class="description"><?php _e('Game ID that must be completed first. Leave empty for the first game.', 'play50games'); ?></p>
                </td>
            </tr>
            <tr>
                <th><label for="description"><?php _e('Description', 'play50games'); ?></label></th>
                <td>
                    <textarea name="game_fields[description]" id="description" rows="3" class="large-text"><?php echo esc_textarea($description); ?></textarea>
                </td>
            </tr>
            <tr>
                <th><label for="game_config"><?php _e('Game Config (JSON)', 'play50games'); ?></label></th>
                <td>
                    <textarea name="game_fields[game_config]" id="game_config" rows="10" class="large-text code"><?php echo esc_textarea($game_config); ?></textarea>
                    <p class="description"><?php _e('JSON configuration for game-specific settings. Example: {"shapes": ["circle", "square"], "rounds": 5}', 'play50games'); ?></p>
                </td>
            </tr>
        </table>
    </div>
    <?php
}
/* END - Custom Post Type - Games */

