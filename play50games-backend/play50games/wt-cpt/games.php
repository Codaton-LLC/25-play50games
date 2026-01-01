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
            <div style="margin-bottom: 10px;">
                <label for="filter_category" style="font-weight: bold; margin-right: 10px;">Filter by Category:</label>
                <select id="filter_category" style="padding: 5px;">
                    <option value="all">All Games</option>
                    <option value="logic">Logic Games (1-15)</option>
                    <option value="memory">Memory Games (16-25)</option>
                    <option value="speed">Speed Games (26-35)</option>
                    <option value="skill">Skill Games (36-45)</option>
                    <option value="final">Final Games (46-50)</option>
                </select>
            </div>
            <select id="game_template" style="width: 100%; max-width: 400px; padding: 8px;">
                <option value="">-- Select Game Template --</option>
                <optgroup label="Logic Games (1-15)" data-category="logic">
                    <option value="match-shapes" data-category="logic">1. Match the Shapes</option>
                    <option value="color-sequence" data-category="logic">2. Color Sequence</option>
                    <option value="number-order" data-category="logic">3. Number Order</option>
                    <option value="find-odd-one" data-category="logic">4. Find the Odd One</option>
                    <option value="tile-slider" data-category="logic">5. Tile Slider</option>
                    <option value="balance-scale" data-category="logic">6. Balance the Scale</option>
                    <option value="circuit-path" data-category="logic">7. Circuit Path</option>
                    <option value="maze-escape" data-category="logic">8. Maze Escape</option>
                    <option value="pattern-completion" data-category="logic">9. Pattern Completion</option>
                    <option value="sudoku-4x4" data-category="logic">10. Sudoku 4x4</option>
                    <option value="rotate-to-fit" data-category="logic">11. Rotate to Fit</option>
                    <option value="mirror-match" data-category="logic">12. Mirror Match</option>
                    <option value="logic-gates" data-category="logic">13. Logic Gates</option>
                    <option value="sequence-arrows" data-category="logic">14. Sequence Arrows</option>
                    <option value="block-fill" data-category="logic">15. Block Fill</option>
                </optgroup>
                <optgroup label="Memory Games (16-25)" data-category="memory">
                    <option value="card-flip" data-category="memory">16. Card Flip Memory</option>
                    <option value="sound-memory" data-category="memory">17. Sound Memory</option>
                    <option value="emoji-memory" data-category="memory">18. Emoji Memory</option>
                    <option value="number-recall" data-category="memory">19. Number Recall</option>
                    <option value="image-recall" data-category="memory">20. Image Recall</option>
                    <option value="path-memory" data-category="memory">21. Path Memory</option>
                    <option value="word-memory" data-category="memory">22. Word Memory</option>
                    <option value="face-memory" data-category="memory">23. Face Memory</option>
                    <option value="color-grid-memory" data-category="memory">24. Color Grid Memory</option>
                    <option value="symbol-stack" data-category="memory">25. Symbol Stack</option>
                </optgroup>
                <optgroup label="Speed Games (26-35)" data-category="speed">
                    <option value="click-green" data-category="speed">26. Click the Green</option>
                    <option value="avoid-red" data-category="speed">27. Avoid the Red</option>
                    <option value="reaction-test" data-category="speed">28. Reaction Test</option>
                    <option value="fast-math" data-category="speed">29. Fast Math</option>
                    <option value="whack-shape" data-category="speed">30. Whack-a-Shape</option>
                    <option value="typing-sprint" data-category="speed">31. Typing Sprint</option>
                    <option value="quick-compare" data-category="speed">32. Quick Compare</option>
                    <option value="falling-objects" data-category="speed">33. Falling Objects</option>
                    <option value="tap-counter" data-category="speed">34. Tap Counter</option>
                    <option value="reflex-arrows" data-category="speed">35. Reflex Arrows</option>
                </optgroup>
                <optgroup label="Skill Games (36-45)" data-category="skill">
                    <option value="ball-balance" data-category="skill">36. Ball Balance</option>
                    <option value="target-aim" data-category="skill">37. Target Aim</option>
                    <option value="line-tracer" data-category="skill">38. Line Tracer</option>
                    <option value="timing-bar" data-category="skill">39. Timing Bar</option>
                    <option value="stack-blocks" data-category="skill">40. Stack Blocks</option>
                    <option value="precision-drop" data-category="skill">41. Precision Drop</option>
                    <option value="drag-sort" data-category="skill">42. Drag & Drop Sort</option>
                    <option value="speed-drawing" data-category="skill">43. Speed Drawing</option>
                    <option value="one-hand" data-category="skill">44. One-Hand Mode</option>
                    <option value="cursor-maze" data-category="skill">45. Cursor Maze</option>
                </optgroup>
                <optgroup label="Final Games (46-50)" data-category="final">
                    <option value="mixed-quiz" data-category="final">46. Mixed Quiz</option>
                    <option value="survival-mode" data-category="final">47. Survival Mode</option>
                    <option value="boss-puzzle" data-category="final">48. Boss Puzzle</option>
                    <option value="time-challenge" data-category="final">49. Time Challenge</option>
                    <option value="final-test" data-category="final">50. Final Certification Test</option>
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
                    <button type="button" id="suggest_unlock" class="button button-small" style="margin-left: 10px;">Suggest Previous Game</button>
                    <p class="description"><?php _e('Game ID that must be completed first. Leave empty for the first game.', 'play50games'); ?></p>
                    <div id="unlock_suggestions" style="margin-top: 10px; padding: 10px; background: #f9f9f9; border: 1px solid #ddd; display: none;">
                        <strong>Available Games:</strong>
                        <ul id="unlock_list" style="margin: 5px 0; padding-left: 20px;">
                            <?php
                            // Get all published games
                            $existing_games = get_posts(array(
                                'post_type' => 'play50_game',
                                'post_status' => 'publish',
                                'posts_per_page' => -1,
                                'meta_key' => 'game_fields',
                                'orderby' => 'meta_value_num',
                                'meta_query' => array(
                                    array(
                                        'key' => 'game_fields',
                                        'compare' => 'EXISTS',
                                    ),
                                ),
                            ));
                            
                            foreach ($existing_games as $game) {
                                $game_meta = get_post_meta($game->ID, 'game_fields', true);
                                $game_order = isset($game_meta['game_order']) ? $game_meta['game_order'] : 'N/A';
                                $game_type = isset($game_meta['game_type']) ? $game_meta['game_type'] : 'unknown';
                                if ($game->ID != $post->ID) {
                                    echo '<li><a href="#" class="select-unlock" data-id="' . esc_attr($game->ID) . '">ID: ' . esc_html($game->ID) . ' - ' . esc_html($game->post_title) . ' (Order: ' . esc_html($game_order) . ', Type: ' . esc_html($game_type) . ')</a></li>';
                                }
                            }
                            if (empty($existing_games) || (count($existing_games) == 1 && $existing_games[0]->ID == $post->ID)) {
                                echo '<li style="color: #999;">No other games found. This will be the first game.</li>';
                            }
                            ?>
                        </ul>
                    </div>
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
                    <p class="description" style="margin-top: 5px; color: #2271b1;">
                        <strong>For Reaction Test:</strong> You must specify <code>maxTime</code> in each level requirement. Formats supported: <code>"700ms"</code>, <code>"1.2s"</code>, <code>"1.5sec"</code>, or <code>2000</code> (milliseconds). Example: <code>{"maxTime": "700ms"}</code>
                    </p>
                    <button type="button" id="validate_json" class="button button-secondary" style="margin-top: 5px;">Validate JSON</button>
                    <span id="json_status" style="margin-left: 10px;"></span>
                </td>
            </tr>
        </table>
    </div>
    
    <script type="text/javascript">
    jQuery(document).ready(function($) {
        // Filter templates by category
        function filterTemplatesByCategory(category) {
            const $template = $('#game_template');
            
            if (category === 'all') {
                // Show all optgroups and options
                $template.find('optgroup').show();
                $template.find('option').show();
            } else {
                // Hide all optgroups first
                $template.find('optgroup').each(function() {
                    const $optgroup = $(this);
                    const optgroupCategory = $optgroup.attr('data-category');
                    
                    if (optgroupCategory === category) {
                        // Show matching optgroup and all its options
                        $optgroup.show();
                        $optgroup.find('option').show();
                    } else {
                        // Hide non-matching optgroup and all its options
                        $optgroup.hide();
                        $optgroup.find('option').hide();
                    }
                });
                
                // Always show the default option
                $template.find('option[value=""]').show();
            }
            
            // Reset selection when filtering
            $template.val('');
        }
        
        // Filter when category changes
        $('#filter_category').on('change', function() {
            const category = $(this).val();
            filterTemplatesByCategory(category);
        });
        
        // Auto-filter when game type changes
        $('#game_type').on('change', function() {
            const gameType = $(this).val();
            if (gameType) {
                $('#filter_category').val(gameType);
                filterTemplatesByCategory(gameType);
            }
        });
        
        // Initial filter based on current game type
        const currentGameType = $('#game_type').val();
        if (currentGameType) {
            $('#filter_category').val(currentGameType);
            filterTemplatesByCategory(currentGameType);
        }
        
        // Game templates with all field values
        const gameTemplates = {
            'match-shapes': {
                title: 'Match the Shapes',
                gameType: 'logic',
                gameOrder: 1,
                difficulty: 1,
                timeLimit: 60,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Match the target shape with the correct option',
                gameConfig: '{"gameType": "match-shapes", "shapes": ["Home", "Fingerprint", "Key", "Star", "Eye", "Heart", "Camera", "Cube", "Bell", "Plus", "Gift", "Moon"], "rounds": 20}'
            },
            'color-sequence': {
                title: 'Color Sequence',
                gameType: 'logic',
                gameOrder: 2,
                difficulty: 1,
                timeLimit: 90,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Repeat an increasing color pattern',
                gameConfig: '{"gameType": "color-sequence", "rounds": 5}'
            },
            'number-order': {
                title: 'Number Order',
                gameType: 'logic',
                gameOrder: 3,
                difficulty: 1,
                timeLimit: 60,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Sort numbers from smallest to largest',
                gameConfig: '{"gameType": "number-order", "numbers": 5, "rounds": 3}'
            },
            'find-odd-one': {
                title: 'Find the Odd One',
                gameType: 'logic',
                gameOrder: 4,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Identify the icon that\'s different',
                gameConfig: '{"gameType": "find-odd-one", "rounds": 20, "icons": ["Home", "Fingerprint", "Key", "Star", "Eye", "Heart", "Camera", "Cube", "Bell", "Plus", "Gift", "Moon"]}'
            },
            'tile-slider': {
                title: 'Tile Slider Puzzle',
                gameType: 'logic',
                gameOrder: 5,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Rearrange tiles into correct order',
                gameConfig: '{"gameType": "tile-slider", "gridSize": 3}'
            },
            'balance-scale': {
                title: 'Balance the Scale',
                gameType: 'logic',
                gameOrder: 6,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Determine which side is heavier',
                gameConfig: '{"gameType": "balance-scale", "rounds": 20}'
            },
            'circuit-path': {
                title: 'Circuit Path',
                gameType: 'logic',
                gameOrder: 7,
                difficulty: 3,
                timeLimit: 90,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Connect nodes to complete the circuit path',
                gameConfig: '{"gameType": "circuit-path", "gridSize": 3, "rounds": 20}'
            },
            'maze-escape': {
                title: 'Maze Escape',
                gameType: 'logic',
                gameOrder: 8,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Navigate from start to exit',
                gameConfig: '{"gameType": "maze-escape", "size": 5}'
            },
            'pattern-completion': {
                title: 'Pattern Completion',
                gameType: 'logic',
                gameOrder: 9,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Complete the missing pattern element',
                gameConfig: '{"gameType": "pattern-completion", "totalRounds": 20, "shapes": ["Home", "Star", "Heart", "Circle"], "patternRules": [{"rounds": 5, "patternLength": 6, "repeatSize": 3}, {"rounds": 7, "patternLength": 9, "repeatSize": 3}, {"rounds": 8, "patternLength": 13, "repeatSize": 4}]}'
            },
            'sudoku-4x4': {
                title: 'Sudoku 4x4',
                gameType: 'logic',
                gameOrder: 10,
                difficulty: 3,
                timeLimit: 180,
                passingScore: 85,
                unlockRequirement: '',
                description: 'Complete the 4x4 sudoku grid',
                gameConfig: '{"gameType": "sudoku-4x4"}'
            },
            'rotate-to-fit': {
                title: 'Rotate to Fit',
                gameType: 'logic',
                gameOrder: 11,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Rotate multiple objects to match their target orientations',
                gameConfig: '{"gameType": "rotate-to-fit", "rounds": 20, "shapes": ["HandThumbUp", "PuzzlePiece", "GlobeAmericas", "LightBulb", "Funnel", "Cake", "LockClosed", "ChevronDoubleRight", "ArrowUturnLeft", "BuildingOffice2"], "objectCountRules": [{"rounds": 5, "count": 3}, {"rounds": 10, "count": 4}, {"rounds": 15, "count": 5}, {"rounds": 20, "count": 5}]}'
            },
            'mirror-match': {
                title: 'Mirror Match',
                gameType: 'logic',
                gameOrder: 12,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Identify the correct mirror image among several options',
                gameConfig: '{"gameType": "mirror-match", "rounds": 20, "mirrorTypes": ["horizontal", "vertical", "diagonal"], "shapes": ["WrenchWithJaw", "LightningBolt", "CameraOffCenter", "FlagOnPole", "SpiralCurl", "GearAsymmetric", "CircuitBranch", "KeyAsymmetric", "ShieldOffCenter", "BirdAsymmetric", "AnchorOffset", "PaperclipUneven", "RocketOneFin", "PuzzleMissingTab"], "optionsCount": 3}'
            },
            'logic-gates': {
                title: 'Logic Gates',
                gameType: 'logic',
                gameOrder: 13,
                difficulty: 3,
                timeLimit: 90,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Determine output of AND/OR gates',
                gameConfig: '{"gameType": "logic-gates", "rounds": 20, "gates": ["AND", "OR", "NOT"], "inputs": [0, 1], "difficulty": "medium"}'
            },
            'sequence-arrows': {
                title: 'Sequence Arrows',
                gameType: 'logic',
                gameOrder: 14,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Predict the next arrow in sequence',
                gameConfig: '{"gameType": "sequence-arrows", "rounds": 20, "sequenceLength": null}'
            },
            'block-fill': {
                title: 'Block Fill',
                gameType: 'logic',
                gameOrder: 15,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Fill the grid with all blocks using polyomino pieces',
                gameConfig: '{"gameType": "block-fill", "levels": [3, 4, 5, 6, 7], "levelLayouts": [{"size": 3, "rows": ["AAB", "ACB", "CCB"]}, {"size": 4, "rows": ["AAAB", "CABB", "CCDB", "CDDD"]}, {"size": 5, "rows": ["AABBC", "ADBEC", "ADEEC", "FDDEC", "FFFEC"]}, {"size": 6, "rows": ["AAABBC", "DEABFC", "DEEBFC", "DGEHFC", "DGGHHC", "DGGHHC"]}, {"size": 7, "rows": ["AAABBCC", "ADDBBCC", "ADDEEFF", "GGDEHFF", "GGGHHII", "JJKHHII", "JJKKKII"]}]}'
            },
            'card-flip': {
                title: 'Card Flip Memory',
                gameType: 'memory',
                gameOrder: 16,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Match pairs of cards by remembering their positions',
                gameConfig: '{"gameType": "card-flip", "rounds": 5, "gridSizes": [[2, 2], [4, 4], [6, 6], [7, 6], [8, 8]]}'
            },
            'sound-memory': {
                title: 'Sound Memory',
                gameType: 'memory',
                gameOrder: 17,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Repeat a sequence of sounds',
                gameConfig: '{"gameType": "sound-memory", "rounds": 10, "roundSequences": [[2], [2, 3], [2, 3, 1], [2, 3, 1, 1], [2, 3, 1, 1, 4], [3, 1, 4, 2, 2], [3, 1, 4, 2, 2, 1], [4, 2, 1, 3, 1, 2, 4], [1, 2, 4, 1, 3, 2, 3, 4], [2, 4, 1, 3, 2, 1, 4, 3, 1]]}'
            },
            'emoji-memory': {
                title: 'Emoji Memory',
                gameType: 'memory',
                gameOrder: 18,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Remember emoji positions on a grid and click them in order',
                gameConfig: '{"gameType": "emoji-memory", "rounds": 20, "gridSizes": [[4, 4], [4, 4], [4, 4], [4, 4], [4, 4], [5, 5], [5, 5], [5, 5], [5, 5], [5, 5], [6, 7], [6, 7], [6, 7], [6, 7], [6, 7], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8]]}'
            },
            'number-recall': {
                title: 'Number Recall',
                gameType: 'memory',
                gameOrder: 19,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Remember and type a number sequence',
                gameConfig: '{"gameType": "number-recall", "rounds": 15}'
            },
            'image-recall': {
                title: 'Image Recall',
                gameType: 'memory',
                gameOrder: 20,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Watch the sequence of images flash on the grid. After they disappear, click on the images in the same order you saw them.',
                gameConfig: '{"gameType": "image-recall", "rounds": 15, "gridSizes": [3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]}'
            },
            'path-memory': {
                title: 'Path Memory',
                gameType: 'memory',
                gameOrder: 21,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Watch the path that lights up on the grid. After it disappears, click on the cells to recreate the same path in the same order.',
                gameConfig: '{"gameType": "path-memory", "rounds": 15, "gridSize": 5}'
            },
            'word-memory': {
                title: 'Word Memory',
                gameType: 'memory',
                gameOrder: 22,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Watch the words flash on the grid one by one. After they disappear, click on the words in the same order they appeared.',
                gameConfig: '{"gameType": "word-memory", "rounds": 15, "gridSizes": [3, 3, 3, 3, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6]}'
            },
            'face-memory': {
                title: 'Face Memory',
                gameType: 'memory',
                gameOrder: 23,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Study the faces and their names. After they disappear, match each face with its correct name.',
                gameConfig: '{"gameType": "face-memory", "rounds": 15}'
            },
            'color-grid-memory': {
                title: 'Color Grid Memory',
                gameType: 'memory',
                gameOrder: 24,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Memorize and reproduce color sequences on a grid',
                gameConfig: '{"gameType":"color-grid-memory","rounds":20}'
            },
            'symbol-stack': {
                title: 'Symbol Stack',
                gameType: 'memory',
                gameOrder: 25,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Watch symbols stack up and rebuild the stack from bottom to top',
                gameConfig: '{"gameType":"symbol-stack","rounds":15}'
            },
            'click-green': {
                title: 'Click the Green',
                gameType: 'speed',
                gameOrder: 26,
                difficulty: 1,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Click only green items quickly. Avoid red items!',
                gameConfig: '{"gameType":"click-green","levels":10,"levelDuration":20,"levelRequirements":[{"minCorrectClicks":3},{"minCorrectClicks":4},{"minCorrectClicks":5},{"minCorrectClicks":6},{"minCorrectClicks":7},{"minCorrectClicks":8},{"minCorrectClicks":9},{"minCorrectClicks":10},{"minCorrectClicks":11},{"minCorrectClicks":12}]}'
            },
            'avoid-red': {
                title: 'Avoid the Red',
                gameType: 'speed',
                gameOrder: 27,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Avoid red obstacles for set duration',
                gameConfig: '{"gameType": "avoid-red", "levels": 10, "levelRequirements": [{"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}, {"minSurvivalTime": 20, "maxHits": 0}]}'
            },
            'reaction-test': {
                title: 'Reaction Test',
                gameType: 'speed',
                gameOrder: 28,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Test your reaction time with 10 unique mini-games: Color Flash, Moving Target, Countdown, Shape Match, Speed Reaction, Pattern Reaction, Multi-Target, Timing Reaction, Memory Reaction, and Master Reaction',
                gameConfig: '{"gameType": "reaction-test", "levels": 10, "levelRequirements": [{"maxTime": "700ms"}, {"maxTime": "900ms"}, {"maxTime": "1.2s"}, {"maxTime": "1.5sec"}, {"maxTime": 2000}, {"maxTime": "1.8s"}, {"maxTime": "1.0s"}, {"maxTime": "2.0s"}, {"maxTime": "1.2s"}, {"maxTime": "2.5s"}]}'
            },
            'fast-math': {
                title: 'Fast Math',
                gameType: 'speed',
                gameOrder: 29,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Solve math problems quickly across 20 levels. Progressive difficulty with addition, subtraction, multiplication, and division.',
                gameConfig: '{"gameType": "fast-math", "levels": 20, "levelDuration": 30, "levelRequirements": [{"minCorrectAnswers": 5}, {"minCorrectAnswers": 6}, {"minCorrectAnswers": 7}, {"minCorrectAnswers": 8}, {"minCorrectAnswers": 9}, {"minCorrectAnswers": 10}, {"minCorrectAnswers": 11}, {"minCorrectAnswers": 12}, {"minCorrectAnswers": 13}, {"minCorrectAnswers": 14}, {"minCorrectAnswers": 15}, {"minCorrectAnswers": 16}, {"minCorrectAnswers": 17}, {"minCorrectAnswers": 18}, {"minCorrectAnswers": 19}, {"minCorrectAnswers": 20}, {"minCorrectAnswers": 21}, {"minCorrectAnswers": 22}, {"minCorrectAnswers": 23}, {"minCorrectAnswers": 24}]}'
            },
            'whack-shape': {
                title: 'Whack-a-Shape',
                gameType: 'speed',
                gameOrder: 30,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Click the correct shape type quickly across 10 levels. Progressive difficulty with faster spawning and shorter display times.',
                gameConfig: '{"gameType": "whack-shape", "levels": 10, "levelDuration": 20, "levelRequirements": [{"minCorrectClicks": 3, "duration": 20}, {"minCorrectClicks": 4, "duration": 20}, {"minCorrectClicks": 5, "duration": 20}, {"minCorrectClicks": 6, "duration": 20}, {"minCorrectClicks": 7, "duration": 20}, {"minCorrectClicks": 8, "duration": 20}, {"minCorrectClicks": 9, "duration": 20}, {"minCorrectClicks": 10, "duration": 20}, {"minCorrectClicks": 11, "duration": 20}, {"minCorrectClicks": 12, "duration": 20}]}'
            },
            'typing-sprint': {
                title: 'Typing Sprint',
                gameType: 'speed',
                gameOrder: 31,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Type words accurately and fast',
                gameConfig: '{"gameType": "typing-sprint", "words": 10}'
            },
            'quick-compare': {
                title: 'Quick Compare',
                gameType: 'speed',
                gameOrder: 32,
                difficulty: 1,
                timeLimit: 60,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Compare two numbers quickly',
                gameConfig: '{"gameType": "quick-compare", "rounds": 15}'
            },
            'falling-objects': {
                title: 'Falling Objects',
                gameType: 'speed',
                gameOrder: 33,
                difficulty: 2,
                timeLimit: 30,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Catch good items, avoid bad ones',
                gameConfig: '{"gameType": "falling-objects", "duration": 30}'
            },
            'tap-counter': {
                title: 'Tap Counter',
                gameType: 'speed',
                gameOrder: 34,
                difficulty: 1,
                timeLimit: 10,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Tap as many times as possible',
                gameConfig: '{"gameType": "tap-counter", "duration": 10}'
            },
            'reflex-arrows': {
                title: 'Reflex Arrows',
                gameType: 'speed',
                gameOrder: 35,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Press arrow keys quickly',
                gameConfig: '{"gameType": "reflex-arrows", "rounds": 15}'
            },
            'ball-balance': {
                title: 'Ball Balance',
                gameType: 'skill',
                gameOrder: 36,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Balance a ball on a platform',
                gameConfig: '{"gameType": "ball-balance"}'
            },
            'target-aim': {
                title: 'Target Aim',
                gameType: 'skill',
                gameOrder: 37,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Click moving targets with increasing speed',
                gameConfig: '{"gameType": "target-aim", "targets": 10}'
            },
            'line-tracer': {
                title: 'Line Tracer',
                gameType: 'skill',
                gameOrder: 38,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Trace a path with cursor',
                gameConfig: '{"gameType": "line-tracer"}'
            },
            'timing-bar': {
                title: 'Timing Bar',
                gameType: 'skill',
                gameOrder: 39,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Stop moving bar at highlighted zone',
                gameConfig: '{"gameType": "timing-bar", "rounds": 5}'
            },
            'stack-blocks': {
                title: 'Stack Blocks',
                gameType: 'skill',
                gameOrder: 40,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Stack blocks as evenly as possible',
                gameConfig: '{"gameType": "stack-blocks", "blocks": 10}'
            },
            'precision-drop': {
                title: 'Precision Drop',
                gameType: 'skill',
                gameOrder: 41,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Drop object into small target area',
                gameConfig: '{"gameType": "precision-drop", "rounds": 5}'
            },
            'drag-sort': {
                title: 'Drag & Drop Sort',
                gameType: 'skill',
                gameOrder: 42,
                difficulty: 2,
                timeLimit: 120,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Sort items into correct categories',
                gameConfig: '{"gameType": "drag-sort", "items": 8}'
            },
            'speed-drawing': {
                title: 'Speed Drawing',
                gameType: 'skill',
                gameOrder: 43,
                difficulty: 3,
                timeLimit: 90,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Draw displayed shape within time limit',
                gameConfig: '{"gameType": "speed-drawing", "rounds": 3}'
            },
            'one-hand': {
                title: 'One-Hand Mode',
                gameType: 'skill',
                gameOrder: 44,
                difficulty: 2,
                timeLimit: 60,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Complete task using only one control',
                gameConfig: '{"gameType": "one-hand", "rounds": 5}'
            },
            'cursor-maze': {
                title: 'Cursor Maze',
                gameType: 'skill',
                gameOrder: 45,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Navigate maze with cursor without touching walls',
                gameConfig: '{"gameType": "cursor-maze"}'
            },
            'mixed-quiz': {
                title: 'Mixed Quiz',
                gameType: 'final',
                gameOrder: 46,
                difficulty: 4,
                timeLimit: 180,
                passingScore: 85,
                unlockRequirement: '',
                description: 'Randomly mix logic, memory, and reaction challenges',
                gameConfig: '{"gameType": "mixed-quiz", "rounds": 5}'
            },
            'survival-mode': {
                title: 'Survival Mode',
                gameType: 'final',
                gameOrder: 47,
                difficulty: 4,
                timeLimit: 300,
                passingScore: 85,
                unlockRequirement: '',
                description: 'Complete several mini-games in sequence without failing',
                gameConfig: '{"gameType": "survival-mode", "games": 5}'
            },
            'boss-puzzle': {
                title: 'Boss Puzzle',
                gameType: 'final',
                gameOrder: 48,
                difficulty: 5,
                timeLimit: 600,
                passingScore: 90,
                unlockRequirement: '',
                description: 'Combine multiple mechanics into one difficult puzzle',
                gameConfig: '{"gameType": "boss-puzzle"}'
            },
            'time-challenge': {
                title: 'Time Challenge',
                gameType: 'final',
                gameOrder: 49,
                difficulty: 4,
                timeLimit: 60,
                passingScore: 85,
                unlockRequirement: '',
                description: 'Complete as many challenges as possible within time limit',
                gameConfig: '{"gameType": "time-challenge", "duration": 60}'
            },
            'final-test': {
                title: 'Final Certification Test',
                gameType: 'final',
                gameOrder: 50,
                difficulty: 5,
                timeLimit: 600,
                passingScore: 90,
                unlockRequirement: '',
                description: 'Randomized final exam using previous game mechanics',
                gameConfig: '{"gameType": "final-test", "rounds": 10}'
            }
        };
        
        // Fill template function
        $('#fill_template').on('click', function() {
            const templateKey = $('#game_template').val();
            if (!templateKey || !gameTemplates[templateKey]) {
                alert('Please select a game template first!');
                return;
            }
            
            const template = gameTemplates[templateKey];
            
            // Fill title
            $('#title').val(template.title);
            
            // Fill game fields
            $('#game_type').val(template.gameType);
            $('#game_order').val(template.gameOrder);
            $('#difficulty').val(template.difficulty);
            $('#time_limit').val(template.timeLimit);
            $('#passing_score').val(template.passingScore);
            $('#unlock_requirement').val(template.unlockRequirement);
            $('#description').val(template.description);
            $('#game_config').val(template.gameConfig);
            
            // Trigger change events
            $('#game_type').trigger('change');
            
            alert('Template filled! Remember to:\n1. Set the correct Game Order\n2. Set Unlock Requirement (previous game ID)\n3. Review and adjust values as needed');
        });
        
        // Clear all fields
        $('#clear_fields').on('click', function() {
            if (confirm('Clear all game fields?')) {
                $('#title').val('');
                $('#game_type').val('logic');
                $('#game_order').val('');
                $('#difficulty').val('1');
                $('#time_limit').val('60');
                $('#passing_score').val('70');
                $('#unlock_requirement').val('');
                $('#description').val('');
                $('#game_config').val('');
            }
        });
        
        // Auto-fill game config based on game type
        $('#game_type').on('change', function() {
            const gameType = $(this).val();
            const gameConfig = $('#game_config').val();
            
            // Only auto-fill if config is empty
            if (!gameConfig || gameConfig.trim() === '') {
                const defaultConfigs = {
                    'logic': '{"gameType": "match-shapes", "rounds": 5}',
                    'memory': '{"gameType": "card-flip", "gridSize": 4, "pairs": 8}',
                    'speed': '{"gameType": "click-green"}',
                    'skill': '{"gameType": "ball-balance"}',
                    'final': '{"gameType": "mixed-quiz", "rounds": 5}'
                };
                
                if (defaultConfigs[gameType]) {
                    $('#game_config').val(defaultConfigs[gameType]);
                }
            }
        });
        
        // Validate JSON
        $('#validate_json').on('click', function() {
            const jsonText = $('#game_config').val();
            const statusEl = $('#json_status');
            
            if (!jsonText || jsonText.trim() === '') {
                statusEl.html('<span style="color: orange;">⚠ Empty JSON</span>');
                return;
            }
            
            try {
                JSON.parse(jsonText);
                statusEl.html('<span style="color: green;">✓ Valid JSON</span>');
            } catch (e) {
                statusEl.html('<span style="color: red;">✗ Invalid JSON: ' + e.message + '</span>');
            }
        });
        
        // Auto-format JSON on blur
        $('#game_config').on('blur', function() {
            const jsonText = $(this).val();
            if (!jsonText || jsonText.trim() === '') return;
            
            try {
                const parsed = JSON.parse(jsonText);
                $(this).val(JSON.stringify(parsed, null, 2));
                $('#json_status').html('<span style="color: green;">✓ Formatted</span>');
            } catch (e) {
                // Invalid JSON, don't format
            }
        });
        
        // Show/hide unlock suggestions
        $('#suggest_unlock').on('click', function() {
            $('#unlock_suggestions').toggle();
        });
        
        // Select unlock requirement from list
        $(document).on('click', '.select-unlock', function(e) {
            e.preventDefault();
            const gameId = $(this).data('id');
            $('#unlock_requirement').val(gameId);
            $('#unlock_suggestions').hide();
            alert('Unlock requirement set to Game ID: ' + gameId);
        });
        
        // Auto-suggest unlock based on game order
        $('#game_order').on('blur', function() {
            const currentOrder = parseInt($(this).val());
            if (currentOrder > 1) {
                // Try to find game with order = currentOrder - 1
                $('.select-unlock').each(function() {
                    const text = $(this).text();
                    const match = text.match(/Order: (\d+)/);
                    if (match && parseInt(match[1]) === currentOrder - 1) {
                        const gameId = $(this).data('id');
                        if (confirm('Auto-set unlock requirement to previous game (Order ' + (currentOrder - 1) + ', ID: ' + gameId + ')?')) {
                            $('#unlock_requirement').val(gameId);
                        }
                        return false;
                    }
                });
            }
        });
    });
    </script>
    <?php
}
/* END - Custom Post Type - Games */

