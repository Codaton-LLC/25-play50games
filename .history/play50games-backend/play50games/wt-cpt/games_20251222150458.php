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
        
        <!-- Quick Fill Templates -->
        <div style="background: #f0f0f1; padding: 15px; margin-bottom: 20px; border-left: 4px solid #2271b1;">
            <h3 style="margin-top: 0;">⚡ Quick Fill Templates</h3>
            <p style="margin-bottom: 10px;">Select a game template to auto-fill all fields:</p>
            <select id="game_template" style="width: 100%; max-width: 400px; padding: 8px;">
                <option value="">-- Select Game Template --</option>
                <optgroup label="Logic Games (1-15)">
                    <option value="match-shapes">1. Match the Shapes</option>
                    <option value="color-sequence">2. Color Sequence</option>
                    <option value="number-order">3. Number Order</option>
                    <option value="find-odd-one">4. Find the Odd One</option>
                    <option value="tile-slider">5. Tile Slider</option>
                    <option value="balance-scale">6. Balance the Scale</option>
                    <option value="light-switch">7. Light Switch Puzzle</option>
                    <option value="maze-escape">8. Maze Escape</option>
                    <option value="pattern-completion">9. Pattern Completion</option>
                    <option value="sudoku-4x4">10. Sudoku 4x4</option>
                    <option value="rotate-to-fit">11. Rotate to Fit</option>
                    <option value="mirror-match">12. Mirror Match</option>
                    <option value="logic-gates">13. Logic Gates</option>
                    <option value="sequence-arrows">14. Sequence Arrows</option>
                    <option value="block-fill">15. Block Fill</option>
                </optgroup>
                <optgroup label="Memory Games (16-25)">
                    <option value="card-flip">16. Card Flip Memory</option>
                    <option value="sound-memory">17. Sound Memory</option>
                    <option value="emoji-memory">18. Emoji Memory</option>
                    <option value="number-recall">19. Number Recall</option>
                    <option value="image-recall">20. Image Recall</option>
                    <option value="path-memory">21. Path Memory</option>
                    <option value="word-memory">22. Word Memory</option>
                    <option value="face-memory">23. Face Memory</option>
                    <option value="color-grid-memory">24. Color Grid Memory</option>
                    <option value="symbol-stack">25. Symbol Stack</option>
                </optgroup>
                <optgroup label="Speed Games (26-35)">
                    <option value="click-green">26. Click the Green</option>
                    <option value="avoid-red">27. Avoid the Red</option>
                    <option value="reaction-test">28. Reaction Test</option>
                    <option value="fast-math">29. Fast Math</option>
                    <option value="whack-shape">30. Whack-a-Shape</option>
                    <option value="typing-sprint">31. Typing Sprint</option>
                    <option value="quick-compare">32. Quick Compare</option>
                    <option value="falling-objects">33. Falling Objects</option>
                    <option value="tap-counter">34. Tap Counter</option>
                    <option value="reflex-arrows">35. Reflex Arrows</option>
                </optgroup>
                <optgroup label="Skill Games (36-45)">
                    <option value="ball-balance">36. Ball Balance</option>
                    <option value="target-aim">37. Target Aim</option>
                    <option value="line-tracer">38. Line Tracer</option>
                    <option value="timing-bar">39. Timing Bar</option>
                    <option value="stack-blocks">40. Stack Blocks</option>
                    <option value="precision-drop">41. Precision Drop</option>
                    <option value="drag-sort">42. Drag & Drop Sort</option>
                    <option value="speed-drawing">43. Speed Drawing</option>
                    <option value="one-hand">44. One-Hand Mode</option>
                    <option value="cursor-maze">45. Cursor Maze</option>
                </optgroup>
                <optgroup label="Final Games (46-50)">
                    <option value="mixed-quiz">46. Mixed Quiz</option>
                    <option value="survival-mode">47. Survival Mode</option>
                    <option value="boss-puzzle">48. Boss Puzzle</option>
                    <option value="time-challenge">49. Time Challenge</option>
                    <option value="final-test">50. Final Certification Test</option>
                </optgroup>
            </select>
            <button type="button" id="fill_template" class="button button-secondary" style="margin-top: 10px;">Fill Template</button>
            <button type="button" id="clear_fields" class="button button-secondary" style="margin-top: 10px; margin-left: 10px;">Clear All</button>
        </div>
        
        <table class="form-table">
            <tr>
                <th><label for="game_type"><?php _e('Game Type', 'play50games'); ?></label></th>
                <td>
                    <select name="game_fields[game_type]" id="game_type" class="regular-text">
                        <option value="logic" <?php selected($game_type, 'logic'); ?>><?php _e('Logic', 'play50games'); ?></option>
                        <option value="memory" <?php selected($game_type, 'memory'); ?>><?php _e('Memory', 'play50games'); ?></option>
                        <option value="speed" <?php selected($game_type, 'speed'); ?>><?php _e('Speed', 'play50games'); ?></option>
                        <option value="skill" <?php selected($game_type, 'skill'); ?>><?php _e('Skill', 'play50games'); ?></option>
                        <option value="final" <?php selected($game_type, 'final'); ?>><?php _e('Final', 'play50games'); ?></option>
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

