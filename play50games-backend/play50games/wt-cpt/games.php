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
                    <option value="reflex-arrow" data-category="speed">35. Reflex Arrow</option>
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
                    <option value="one-hand-mode" data-category="skill">44. One-Hand Mode</option>
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
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Test your typing speed and accuracy across 15 unique levels. Progressive difficulty from simple words to complex sentences, numbers, special characters, and master challenges.',
                gameConfig: '{"gameType": "typing-sprint", "levels": 15, "levelRequirements": [{"minCorrectWords": 3, "duration": 30, "words": ["cat", "dog", "sun", "moon", "star", "tree", "bird", "fish", "book", "pen", "cup", "hat", "car", "bus", "key", "door"]}, {"minCorrectWords": 4, "duration": 30, "words": ["apple", "banana", "orange", "purple", "yellow", "green", "computer", "keyboard", "window", "garden", "forest", "ocean", "planet", "camera", "guitar", "pencil"]}, {"minCorrectWords": 5, "duration": 30, "words": ["beautiful", "wonderful", "adventure", "mountain", "elephant", "butterfly", "chocolate", "dinosaur", "hospital", "university", "keyboard", "computer", "internet", "software", "hardware"]}, {"minCorrectWords": 6, "duration": 30, "words": ["don\'t", "can\'t", "won\'t", "it\'s", "we\'re", "they\'re", "you\'re", "I\'m", "he\'s", "she\'s", "let\'s", "that\'s"]}, {"minCorrectWords": 7, "duration": 30, "words": ["The quick brown fox jumps over the lazy dog", "Practice makes perfect in everything you do", "Learning new skills takes time and dedication", "Success comes to those who never give up"]}, {"minCorrectWords": 8, "duration": 30, "words": ["12345", "67890", "246813579", "9876543210", "314159265", "271828182", "1000000", "9999999"]}, {"minCorrectWords": 9, "duration": 30, "words": ["JavaScript", "TypeScript", "React", "NodeJS", "Python", "Java", "CSharp", "GoLang", "Swift", "Kotlin"]}, {"minCorrectWords": 10, "duration": 30, "words": ["helloworld", "goodmorning", "thankyou", "welcomeback", "seeyoulater", "haveaniceday", "goodluck", "congratulations"]}, {"minCorrectWords": 11, "duration": 30, "words": ["racecar", "level", "radar", "civic", "rotor", "deified", "repaper", "redder"]}, {"minCorrectWords": 12, "duration": 30, "words": ["go", "hi", "ok", "no", "yes", "run", "fly", "jump", "fast", "quick", "rapid", "swift", "speed", "haste"]}, {"minCorrectWords": 13, "duration": 30, "words": ["The early bird catches the worm in the morning", "A picture is worth a thousand words they say", "Actions speak louder than words in real life", "Better late than never is a common saying"]}, {"minCorrectWords": 14, "duration": 30, "words": ["hello@world.com", "user_name", "price$99", "score#1", "item&item", "test+test", "value=100", "key:value"]}, {"minCorrectWords": 15, "duration": 30, "words": ["abc123", "test456", "user789", "code2024", "game50", "level15", "score100", "time60"]}, {"minCorrectWords": 16, "duration": 30, "words": ["The quick brown fox jumps over the lazy dog in the park", "She sells seashells by the seashore every single day", "How much wood would a woodchuck chuck if he could", "Peter Piper picked a peck of pickled peppers today"]}, {"minCorrectWords": 17, "duration": 30, "words": ["Supercalifragilisticexpialidocious", "Pneumonoultramicroscopicsilicovolcanoconiosis", "The quick brown fox jumps over the lazy dog quickly", "JavaScript TypeScript React NodeJS Python Java CSharp"]}]}'
            },
            'quick-compare': {
                title: 'Quick Compare',
                gameType: 'speed',
                gameOrder: 32,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Test your number comparison skills across 15 unique levels. Progressive difficulty from simple integers to decimals, negative numbers, and complex comparisons.',
                gameConfig: '{"gameType": "quick-compare", "levels": 15, "levelRequirements": [{"minCorrectAnswers": 5, "duration": 30}, {"minCorrectAnswers": 6, "duration": 30}, {"minCorrectAnswers": 7, "duration": 30}, {"minCorrectAnswers": 8, "duration": 30}, {"minCorrectAnswers": 9, "duration": 30}, {"minCorrectAnswers": 10, "duration": 30}, {"minCorrectAnswers": 11, "duration": 30}, {"minCorrectAnswers": 12, "duration": 30}, {"minCorrectAnswers": 13, "duration": 30}, {"minCorrectAnswers": 14, "duration": 30}, {"minCorrectAnswers": 15, "duration": 30}, {"minCorrectAnswers": 16, "duration": 30}, {"minCorrectAnswers": 17, "duration": 30}, {"minCorrectAnswers": 18, "duration": 30}, {"minCorrectAnswers": 20, "duration": 30}]}'
            },
            'falling-objects': {
                title: 'Falling Objects',
                gameType: 'speed',
                gameOrder: 33,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Catch good falling objects and avoid bad ones across 15 unique levels. Progressive difficulty with increasing speed, smaller objects, and more challenges.',
                gameConfig: '{"gameType": "falling-objects", "levels": 15, "levelRequirements": [{"minCaughtGood": 8, "duration": 30}, {"minCaughtGood": 10, "duration": 30}, {"minCaughtGood": 12, "duration": 30}, {"minCaughtGood": 14, "duration": 30}, {"minCaughtGood": 16, "duration": 30}, {"minCaughtGood": 18, "duration": 30}, {"minCaughtGood": 20, "duration": 30}, {"minCaughtGood": 22, "duration": 30}, {"minCaughtGood": 24, "duration": 30}, {"minCaughtGood": 26, "duration": 30}, {"minCaughtGood": 28, "duration": 30}, {"minCaughtGood": 30, "duration": 30}, {"minCaughtGood": 32, "duration": 30}, {"minCaughtGood": 35, "duration": 30}, {"minCaughtGood": 40, "duration": 30}]}'
            },
            'tap-counter': {
                title: 'Tap Counter',
                gameType: 'speed',
                gameOrder: 34,
                difficulty: 1,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Tap as fast as you can across 15 unique levels. Progressive difficulty with increasing tap requirements and speed challenges.',
                gameConfig: '{"gameType": "tap-counter", "levels": 15, "levelRequirements": [{"minTaps": 20, "duration": 10}, {"minTaps": 25, "duration": 10}, {"minTaps": 30, "duration": 10}, {"minTaps": 35, "duration": 10}, {"minTaps": 40, "duration": 10}, {"minTaps": 45, "duration": 10}, {"minTaps": 50, "duration": 10}, {"minTaps": 55, "duration": 10}, {"minTaps": 60, "duration": 10}, {"minTaps": 65, "duration": 10}, {"minTaps": 70, "duration": 10}, {"minTaps": 75, "duration": 10}, {"minTaps": 80, "duration": 10}, {"minTaps": 85, "duration": 10}, {"minTaps": 90, "duration": 10}]}'
            },
            'reflex-arrow': {
                title: 'Reflex Arrow',
                gameType: 'speed',
                gameOrder: 35,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Match arrow directions as fast as you can across 15 unique levels. Progressive difficulty with faster arrow changes and more correct answers required.',
                gameConfig: '{"gameType": "reflex-arrow", "levels": 15, "levelRequirements": [{"minCorrect": 8, "duration": 30, "arrowInterval": 2500}, {"minCorrect": 9, "duration": 30, "arrowInterval": 2300}, {"minCorrect": 10, "duration": 30, "arrowInterval": 2100}, {"minCorrect": 11, "duration": 30, "arrowInterval": 1900}, {"minCorrect": 12, "duration": 30, "arrowInterval": 1700}, {"minCorrect": 13, "duration": 30, "arrowInterval": 1500}, {"minCorrect": 14, "duration": 30, "arrowInterval": 1300}, {"minCorrect": 15, "duration": 30, "arrowInterval": 1200}, {"minCorrect": 16, "duration": 30, "arrowInterval": 1100}, {"minCorrect": 17, "duration": 30, "arrowInterval": 1000}, {"minCorrect": 18, "duration": 30, "arrowInterval": 900}, {"minCorrect": 19, "duration": 30, "arrowInterval": 800}, {"minCorrect": 20, "duration": 30, "arrowInterval": 700}, {"minCorrect": 21, "duration": 30, "arrowInterval": 600}, {"minCorrect": 22, "duration": 30, "arrowInterval": 500}]}'
            },
            'ball-balance': {
                title: 'Ball Balance',
                gameType: 'skill',
                gameOrder: 36,
                difficulty: 3,
                timeLimit: 0,
                passingScore: 70,
                unlockRequirement: '',
                description: 'Balance a ball on a platform using mouse/touch tilt. Keep the ball in the center zone across 15 progressively challenging levels. Features include shrinking platforms, danger zones, platform shake, and wind forces that test your precision and reaction skills.',
                gameConfig: '{"gameType":"ball-balance","levels":15,"levelRequirements":[{"minTimeInCenter":3,"duration":10},{"minTimeInCenter":4,"duration":10},{"minTimeInCenter":5,"duration":12},{"minTimeInCenter":6,"duration":15},{"minTimeInCenter":7,"duration":18},{"minTimeInCenter":8,"duration":18,"shrinkingPlatform":true,"shrinkMinScale":0.1,"shrinkDelay":0},{"minTimeInCenter":9,"duration":10,"shrinkingPlatform":true,"shrinkMinScale":0.3,"shrinkDelay":0},{"minTimeInCenter":10,"duration":18,"redZones":[{"start":-100,"end":-60},{"start":60,"end":100}]},{"minTimeInCenter":11,"duration":18,"redZones":[{"start":-90,"end":-50},{"start":50,"end":90}]},{"minTimeInCenter":12,"duration":30,"shrinkingPlatform":true,"shrinkMinScale":0.4,"redZones":[{"start":-85,"end":-45},{"start":45,"end":85}]},{"minTimeInCenter":13,"duration":30,"platformShake":true,"shakeInterval":6,"shakeIntensity":12,"shakeDuration":1.1,"shakeFrequency":13,"shakeAngle":10},{"minTimeInCenter":14,"duration":25,"platformShake":true,"shakeInterval":5,"shakeIntensity":13,"shakeDuration":1,"shakeFrequency":14,"shakeAngle":15},{"minTimeInCenter":15,"duration":50,"windZones":[{"start":-80,"end":-40,"force":-80},{"start":40,"end":80,"force":80}]},{"minTimeInCenter":16,"duration":50,"platformShake":true,"shakeInterval":4,"shakeIntensity":14,"shakeDuration":1,"shakeFrequency":15,"shakeAngle":16,"windZones":[{"start":-75,"end":-35,"force":-90},{"start":35,"end":75,"force":90}]},{"minTimeInCenter":20,"duration":50,"shrinkingPlatform":true,"shrinkMinScale":0.35,"redZones":[{"start":-70,"end":-30},{"start":30,"end":70}],"platformShake":true,"shakeInterval":3,"shakeIntensity":16,"shakeDuration":1.1,"shakeFrequency":16,"shakeAngle":18,"windZones":[{"start":-65,"end":-25,"force":-110},{"start":25,"end":65,"force":110}]}]}'
            },
            'target-aim': {
                title: 'Target Aim',
                gameType: 'skill',
                gameOrder: 37,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Aim and click targets with precision across 15 progressively challenging levels. Features include moving targets, multiple simultaneous targets, and shrinking targets that test your accuracy and reaction speed.',
                gameConfig: '{"gameType":"target-aim","levels":15,"levelRequirements":[{"minTargetsHit":5,"duration":20},{"minTargetsHit":7,"duration":20},{"minTargetsHit":9,"duration":20},{"minTargetsHit":11,"duration":20},{"minTargetsHit":13,"duration":20},{"minTargetsHit":15,"duration":20,"movingTargets":true},{"minTargetsHit":17,"duration":20,"movingTargets":true},{"minTargetsHit":19,"duration":20,"multipleTargets":true},{"minTargetsHit":21,"duration":20,"movingTargets":true,"multipleTargets":true},{"minTargetsHit":23,"duration":20,"shrinkingTargets":true},{"minTargetsHit":25,"duration":20,"movingTargets":true,"shrinkingTargets":true},{"minTargetsHit":27,"duration":20,"multipleTargets":true,"shrinkingTargets":true},{"minTargetsHit":29,"duration":20,"movingTargets":true,"multipleTargets":true,"shrinkingTargets":true},{"minTargetsHit":31,"duration":20,"movingTargets":true,"multipleTargets":true,"shrinkingTargets":true},{"minTargetsHit":35,"duration":20,"movingTargets":true,"multipleTargets":true,"shrinkingTargets":true}]}'
            },
            'line-tracer': {
                title: 'Line Tracer',
                gameType: 'skill',
                gameOrder: 38,
                difficulty: 3,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Trace paths with precision across 15 progressively challenging levels. Use your mouse or touch to follow the blue line as accurately as possible. Features include different path types (smooth, zigzag, spiral, circle) and increasing accuracy requirements.',
                gameConfig: '{"gameType":"line-tracer","levels":15,"levelRequirements":[{"minAccuracy":40,"minProgress":80,"duration":60,"pathType":"smooth","complexity":3,"pathLength":12},{"minAccuracy":45,"minProgress":82,"duration":60,"pathType":"smooth","complexity":3,"pathLength":12},{"minAccuracy":50,"minProgress":84,"duration":60,"pathType":"smooth","complexity":4,"pathLength":11},{"minAccuracy":52,"minProgress":85,"duration":62,"pathType":"smooth","complexity":4,"pathLength":11},{"minAccuracy":55,"minProgress":86,"duration":80,"pathType":"zigzag","complexity":5,"pathLength":10},{"minAccuracy":60,"minProgress":87,"duration":100,"pathType":"zigzag","complexity":5,"pathLength":10},{"minAccuracy":62,"minProgress":88,"duration":110,"pathType":"zigzag","complexity":6,"pathLength":9},{"minAccuracy":65,"minProgress":89,"duration":130,"pathType":"spiral","complexity":6,"pathLength":9},{"minAccuracy":65,"minProgress":90,"duration":140,"pathType":"spiral","complexity":7,"pathLength":8},{"minAccuracy":70,"minProgress":91,"duration":130,"pathType":"circle","complexity":7,"pathLength":8},{"minAccuracy":75,"minProgress":92,"duration":140,"pathType":"smooth","complexity":8,"pathLength":8},{"minAccuracy":75,"minProgress":93,"duration":160,"pathType":"zigzag","complexity":8,"pathLength":8},{"minAccuracy":80,"minProgress":94,"duration":180,"pathType":"spiral","complexity":9,"pathLength":7},{"minAccuracy":82,"minProgress":95,"duration":200,"pathType":"circle","complexity":9,"pathLength":7},{"minAccuracy":85,"minProgress":95,"duration":220,"pathType":"smooth","complexity":10,"pathLength":7}]}'
            },
            'timing-bar': {
                title: 'Timing Bar',
                gameType: 'skill',
                gameOrder: 39,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Stop the moving bar at the highlighted green zone. Test your timing and precision across 15 progressively challenging levels with increasing speed and smaller target zones.',
                gameConfig: '{"gameType":"timing-bar","levels":15,"levelRequirements":[{"minStops":3,"duration":30,"targetZoneWidth":20,"barSpeed":1.2},{"minStops":3,"duration":30,"targetZoneWidth":19,"barSpeed":1.3},{"minStops":4,"duration":30,"targetZoneWidth":18,"barSpeed":1.4},{"minStops":4,"duration":30,"targetZoneWidth":17,"barSpeed":1.5},{"minStops":4,"duration":30,"targetZoneWidth":16,"barSpeed":1.6},{"minStops":5,"duration":30,"targetZoneWidth":15,"barSpeed":1.7},{"minStops":5,"duration":30,"targetZoneWidth":14,"barSpeed":1.8},{"minStops":5,"duration":30,"targetZoneWidth":13,"barSpeed":1.9},{"minStops":6,"duration":30,"targetZoneWidth":12,"barSpeed":2.0},{"minStops":6,"duration":30,"targetZoneWidth":11,"barSpeed":2.1},{"minStops":6,"duration":30,"targetZoneWidth":10,"barSpeed":2.2},{"minStops":7,"duration":30,"targetZoneWidth":9,"barSpeed":2.3},{"minStops":7,"duration":30,"targetZoneWidth":9,"barSpeed":2.4},{"minStops":8,"duration":30,"targetZoneWidth":8,"barSpeed":2.4},{"minStops":8,"duration":30,"targetZoneWidth":8,"barSpeed":2.5}]}'
            },
            'stack-blocks': {
                title: 'Stack Blocks',
                gameType: 'skill',
                gameOrder: 40,
                difficulty: 3,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Stack blocks as evenly as possible. Click on the moving green block to place it on the stack. Align blocks as close to center as possible to pass each level.',
                gameConfig: '{"gameType":"stack-blocks","levels":15,"levelRequirements":[{"minBlocks":5,"duration":30,"blockSpeed":0.5,"initialBlockWidth":50,"widthReduction":2},{"minBlocks":5,"duration":30,"blockSpeed":0.6,"initialBlockWidth":48,"widthReduction":2},{"minBlocks":6,"duration":30,"blockSpeed":0.7,"initialBlockWidth":46,"widthReduction":1.9},{"minBlocks":6,"duration":30,"blockSpeed":0.8,"initialBlockWidth":44,"widthReduction":1.9},{"minBlocks":7,"duration":30,"blockSpeed":0.9,"initialBlockWidth":42,"widthReduction":1.8},{"minBlocks":7,"duration":30,"blockSpeed":1.0,"initialBlockWidth":40,"widthReduction":1.8},{"minBlocks":8,"duration":30,"blockSpeed":1.1,"initialBlockWidth":38,"widthReduction":1.7},{"minBlocks":8,"duration":30,"blockSpeed":1.2,"initialBlockWidth":36,"widthReduction":1.7},{"minBlocks":9,"duration":30,"blockSpeed":1.3,"initialBlockWidth":34,"widthReduction":1.6},{"minBlocks":9,"duration":30,"blockSpeed":1.4,"initialBlockWidth":32,"widthReduction":1.6},{"minBlocks":10,"duration":30,"blockSpeed":1.4,"initialBlockWidth":32,"widthReduction":1.5},{"minBlocks":10,"duration":30,"blockSpeed":1.5,"initialBlockWidth":30,"widthReduction":1.5},{"minBlocks":11,"duration":30,"blockSpeed":1.5,"initialBlockWidth":30,"widthReduction":1.5},{"minBlocks":11,"duration":30,"blockSpeed":1.5,"initialBlockWidth":30,"widthReduction":1.5},{"minBlocks":12,"duration":30,"blockSpeed":1.5,"initialBlockWidth":30,"widthReduction":1.5}]}'
            },
            'precision-drop': {
                title: 'Precision Drop',
                gameType: 'skill',
                gameOrder: 41,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Drop object into small target area. Move the object left/right, then click to drop it. Land fully inside the target to score. Each level has multiple drops (mini levels) that must be completed.',
                gameConfig: '{"gameType":"precision-drop","levels":15,"levelRequirements":[{"drops":1,"duration":30,"targetWidth":160,"targetSpeed":0,"shakeEnabled":false,"minHits":1},{"drops":1,"duration":30,"targetWidth":148,"targetSpeed":0,"shakeEnabled":false,"minHits":1},{"drops":1,"duration":30,"targetWidth":136,"targetSpeed":0,"shakeEnabled":false,"minHits":1},{"drops":1,"duration":30,"targetWidth":124,"targetSpeed":0,"shakeEnabled":false,"minHits":1},{"drops":3,"duration":30,"targetWidth":112,"targetSpeed":210,"shakeEnabled":false,"minHits":2},{"drops":3,"duration":30,"targetWidth":100,"targetSpeed":228,"shakeEnabled":false,"minHits":2},{"drops":3,"duration":30,"targetWidth":88,"targetSpeed":246,"shakeEnabled":false,"minHits":2},{"drops":3,"duration":30,"targetWidth":76,"targetSpeed":264,"shakeEnabled":false,"minHits":2},{"drops":3,"duration":30,"targetWidth":64,"targetSpeed":282,"shakeEnabled":false,"minHits":2},{"drops":5,"duration":30,"targetWidth":52,"targetSpeed":300,"shakeEnabled":true,"minHits":3},{"drops":5,"duration":30,"targetWidth":40,"targetSpeed":318,"shakeEnabled":true,"minHits":3},{"drops":5,"duration":30,"targetWidth":32,"targetSpeed":336,"shakeEnabled":true,"minHits":3},{"drops":5,"duration":30,"targetWidth":28,"targetSpeed":354,"shakeEnabled":true,"minHits":3},{"drops":5,"duration":30,"targetWidth":26,"targetSpeed":372,"shakeEnabled":true,"minHits":3},{"drops":5,"duration":30,"targetWidth":24,"targetSpeed":390,"shakeEnabled":true,"minHits":3}]}'
            },
            'drag-sort': {
                title: 'Drag & Drop Sort',
                gameType: 'skill',
                gameOrder: 42,
                difficulty: 2,
                timeLimit: 0,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Sort emoji items into the matching categories. Levels progress from simple visuals to real-world groups and logic, with faster timers later.',
                gameConfig: '{"gameType":"drag-sort","levels":15,"levelDefinitions":[{"duration":45,"penaltySec":0,"minCorrect":6,"categories":[{"id":"red","label":"Red","color":"rgba(239, 68, 68, 0.25)","items":["🔴","🟥","❤️","🍎"]},{"id":"blue","label":"Blue","color":"rgba(59, 130, 246, 0.25)","items":["🔵","🟦","💙","🧊"]}]},{"duration":45,"penaltySec":0,"minCorrect":6,"categories":[{"id":"circle","label":"Circle","color":"rgba(148, 163, 184, 0.25)","items":["⚪","⚫","🔘","⭕"]},{"id":"square","label":"Square","color":"rgba(203, 213, 225, 0.25)","items":["⬜","⬛","◻️","◼️"]}]},{"duration":40,"penaltySec":0,"minCorrect":6,"categories":[{"id":"big","label":"Big","color":"rgba(34, 197, 94, 0.22)","items":["🐘","🚌","🏠","🐋"]},{"id":"small","label":"Small","color":"rgba(168, 85, 247, 0.22)","items":["🐭","🐜","🍬","🧸"]}]},{"duration":40,"penaltySec":0,"minCorrect":6,"categories":[{"id":"fruits","label":"Fruits","color":"rgba(234, 88, 12, 0.25)","items":["🍎","🍌","🍇","🍉"]},{"id":"animals","label":"Animals","color":"rgba(59, 130, 246, 0.25)","items":["🐶","🐱","🐵","🐯"]}]},{"duration":35,"penaltySec":0,"minCorrect":6,"categories":[{"id":"tools","label":"Tools","color":"rgba(148, 163, 184, 0.25)","items":["🔧","🔨","🧰","🪛"]},{"id":"vehicles","label":"Vehicles","color":"rgba(59, 130, 246, 0.25)","items":["🚗","🚕","🚲","🚁"]}]},{"duration":35,"penaltySec":0,"minCorrect":6,"categories":[{"id":"food","label":"Food","color":"rgba(245, 158, 11, 0.25)","items":["🍔","🍕","🍟","🌮"]},{"id":"drinks","label":"Drinks","color":"rgba(14, 165, 233, 0.25)","items":["🥤","🧃","☕","🥛"]}]},{"duration":35,"penaltySec":0,"minCorrect":6,"categories":[{"id":"living","label":"Living","color":"rgba(34, 197, 94, 0.2)","items":["🐶","🐦","🌳","🐟"]},{"id":"nonliving","label":"Non-living","color":"rgba(100, 116, 139, 0.25)","items":["🪑","📱","🚗","🧱"]}]},{"duration":30,"penaltySec":0,"minCorrect":6,"categories":[{"id":"indoor","label":"Indoor","color":"rgba(59, 130, 246, 0.2)","items":["🛋️","🛏️","🚿","🧴"]},{"id":"outdoor","label":"Outdoor","color":"rgba(234, 179, 8, 0.2)","items":["🌳","🏕️","🏔️","🏖️"]}]},{"duration":30,"penaltySec":0,"minCorrect":6,"categories":[{"id":"natural","label":"Natural","color":"rgba(34, 197, 94, 0.2)","items":["🌋","🌊","🌲","🪨"]},{"id":"manmade","label":"Man-made","color":"rgba(94, 234, 212, 0.2)","items":["🏭","🏢","🛣️","🧱"]}]},{"duration":28,"penaltySec":2,"minCorrect":6,"categories":[{"id":"safe","label":"Safe","color":"rgba(34, 197, 94, 0.2)","items":["🪖","🧯","🦺","🛟"]},{"id":"danger","label":"Dangerous","color":"rgba(239, 68, 68, 0.2)","items":["🔥","⚡","🗡️","☣️"]}]},{"duration":26,"penaltySec":2,"minCorrect":6,"categories":[{"id":"before","label":"Before","color":"rgba(59, 130, 246, 0.2)","items":["🥚","🌱","🧊","🌙"]},{"id":"after","label":"After","color":"rgba(234, 179, 8, 0.2)","items":["🐣","🌳","💧","🌞"]}]},{"duration":24,"penaltySec":3,"minCorrect":6,"categories":[{"id":"cause","label":"Cause","color":"rgba(248, 113, 113, 0.2)","items":["⚡","🌧️","🔥","🥶"]},{"id":"effect","label":"Effect","color":"rgba(59, 130, 246, 0.2)","items":["💡","🌈","💧","🧊"]}]},{"duration":24,"penaltySec":3,"minCorrect":12,"switchAt":0.5,"phases":[{"categories":[{"id":"true","label":"True","color":"rgba(34, 197, 94, 0.2)","items":["🐟💧","🕊️🌤️","🌞☀️","🌳🌿"]},{"id":"false","label":"False","color":"rgba(239, 68, 68, 0.2)","items":["🐟🔥","☂️🔥","🌙☀️","🌵❄️"]}]},{"categories":[{"id":"problem","label":"Problem","color":"rgba(251, 191, 36, 0.2)","items":["🔌❌","💡❌","🚪🔒","🌧️"]},{"id":"solution","label":"Solution","color":"rgba(59, 130, 246, 0.2)","items":["🔌✅","💡","🔑","☂️"]}]}]},{"duration":22,"penaltySec":3,"minCorrect":12,"switchAt":0.5,"phases":[{"categories":[{"id":"cause","label":"Cause","color":"rgba(248, 113, 113, 0.2)","items":["🌧️","🏃","😴","🔥"]},{"id":"effect","label":"Effect","color":"rgba(59, 130, 246, 0.2)","items":["💧","💦","😪","💨"]}]},{"categories":[{"id":"before","label":"Before","color":"rgba(59, 130, 246, 0.2)","items":["🥚","🧊","🌑","🌱"]},{"id":"after","label":"After","color":"rgba(234, 179, 8, 0.2)","items":["🐣","💧","🌕","🌳"]}]}]},{"duration":20,"penaltySec":4,"minCorrect":19,"switchAt":0.5,"phases":[{"categories":[{"id":"fruits","label":"Fruits","color":"rgba(234, 88, 12, 0.25)","items":["🍎","🍌","🍇"]},{"id":"animals","label":"Animals","color":"rgba(59, 130, 246, 0.25)","items":["🐶","🐱","🐵"]},{"id":"vehicles","label":"Vehicles","color":"rgba(14, 165, 233, 0.25)","items":["🚗","🚌","🚲"]},{"id":"tools","label":"Tools","color":"rgba(100, 116, 139, 0.25)","items":["🔧","🔨","🪛"]}]},{"categories":[{"id":"red","label":"Red","color":"rgba(239, 68, 68, 0.25)","items":["🔴","🟥","❤️"]},{"id":"blue","label":"Blue","color":"rgba(59, 130, 246, 0.25)","items":["🔵","🟦","💙"]},{"id":"circle","label":"Circle","color":"rgba(148, 163, 184, 0.25)","items":["⚪","⚫","⭕"]},{"id":"square","label":"Square","color":"rgba(203, 213, 225, 0.25)","items":["⬜","⬛","◻️"]}]}]}]}'
            },
            'speed-drawing': {
                title: 'Speed Drawing',
                gameType: 'skill',
                gameOrder: 43,
                difficulty: 3,
                timeLimit: 90,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Draw shapes quickly and accurately within the time limit. Test your drawing skills across 15 progressively challenging levels.',
                gameConfig: '{"gameType": "speed-drawing", "levels": 15, "levelDefinitions": [{"duration": 20, "targetShape": "circle", "minAccuracy": 60}, {"duration": 20, "targetShape": "square", "minAccuracy": 62}, {"duration": 18, "targetShape": "triangle", "minAccuracy": 65}, {"duration": 18, "targetShape": "star", "minAccuracy": 67}, {"duration": 16, "targetShape": "heart", "minAccuracy": 70}, {"duration": 16, "targetShape": "wave", "minAccuracy": 72}, {"duration": 15, "targetShape": "curve", "minAccuracy": 75}, {"duration": 15, "targetShape": "zigzag", "minAccuracy": 77}, {"duration": 14, "targetShape": "circle", "minAccuracy": 78}, {"duration": 14, "targetShape": "square", "minAccuracy": 80}, {"duration": 13, "targetShape": "triangle", "minAccuracy": 82}, {"duration": 13, "targetShape": "star", "minAccuracy": 83}, {"duration": 12, "targetShape": "heart", "minAccuracy": 84}, {"duration": 12, "targetShape": "wave", "minAccuracy": 85}, {"duration": 10, "targetShape": "spiral", "minAccuracy": 85}]}'
            },
            'one-hand-mode': {
                title: 'One-Hand Mode',
                gameType: 'skill',
                gameOrder: 44,
                difficulty: 2,
                timeLimit: 90,
                passingScore: 75,
                unlockRequirement: '',
                description: 'Jump over obstacles using only one control. A runner-style game that tests your timing and reflexes across 15 challenging levels.',
                gameConfig: '{"gameType": "one-hand-mode", "levels": 15, "levelRequirements": [{"duration": 6, "speed": 260, "spawnInterval": 1.1}, {"duration": 5.85, "speed": 290, "spawnInterval": 1.067}, {"duration": 5.7, "speed": 320, "spawnInterval": 1.034}, {"duration": 5.55, "speed": 350, "spawnInterval": 1.001}, {"duration": 5.4, "speed": 380, "spawnInterval": 0.968}, {"duration": 5.1, "speed": 410, "spawnInterval": 0.902}, {"duration": 4.95, "speed": 440, "spawnInterval": 0.869}, {"duration": 4.8, "speed": 470, "spawnInterval": 0.836}, {"duration": 4.65, "speed": 500, "spawnInterval": 0.803}, {"duration": 4.5, "speed": 530, "spawnInterval": 0.77}, {"duration": 4.4, "speed": 560, "spawnInterval": 0.737}, {"duration": 4.25, "speed": 590, "spawnInterval": 0.704}, {"duration": 4.1, "speed": 620, "spawnInterval": 0.671}, {"duration": 3.95, "speed": 650, "spawnInterval": 0.638}, {"duration": 3.8, "speed": 680, "spawnInterval": 0.6}]}'
            },
            'cursor-maze': {
                title: 'Cursor Maze',
                gameType: 'skill',
                gameOrder: 45,
                difficulty: 3,
                timeLimit: 120,
                passingScore: 80,
                unlockRequirement: '',
                description: 'Navigate maze with cursor without touching walls. Reach the green exit without touching walls!',
                gameConfig: '{"gameType": "cursor-maze", "levels": 15, "levelRequirements": [{"duration": 60}, {"duration": 58}, {"duration": 56}, {"duration": 54}, {"duration": 52}, {"duration": 48}, {"duration": 46}, {"duration": 44}, {"duration": 42}, {"duration": 40}, {"duration": 38}, {"duration": 36}, {"duration": 34}, {"duration": 32}, {"duration": 30}]}'
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

