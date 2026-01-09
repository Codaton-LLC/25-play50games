<?php
/* Custom Post Type - Accordion */

function show_accordion_custom_fields() {

    $js_src = includes_url('js/tinymce/') . 'tinymce.min.js';
    $css_src = includes_url('css/') . 'editor.css';

    wp_register_style('tinymce_css', $css_src);
    wp_enqueue_style('tinymce_css');

    global $post;
    $meta = get_post_meta($post->ID,'accordion_fields',true);
    $c = 0;

    ?>

    <script src="<?php echo $js_src; ?>"></script>
    <style>
        /* Color palette for different FAQ groups */
        .accordion[data-group-title]:not([data-group-title=""]) {
            border-left: 4px solid transparent;
            transition: all 0.3s ease;
        }
        
        /* Color scheme for groups - using a palette of distinct colors */
        .accordion[data-group-title="registration-questions"],
        .accordion[data-group-title="pyetje-per-regjistrimin"] {
            border-left-color: #3b82f6 !important;
            background-color: rgba(59, 130, 246, 0.05);
        }
        
        .accordion[data-group-title="game-questions"],
        .accordion[data-group-title="pyetje-per-lojrat"] {
            border-left-color: #10b981 !important;
            background-color: rgba(16, 185, 129, 0.05);
        }
        
        .accordion[data-group-title="account-questions"],
        .accordion[data-group-title="pyetje-per-llogarine"] {
            border-left-color: #f59e0b !important;
            background-color: rgba(245, 158, 11, 0.05);
        }
        
        .accordion[data-group-title="certificate-questions"],
        .accordion[data-group-title="pyetje-per-certifikaten"] {
            border-left-color: #8b5cf6 !important;
            background-color: rgba(139, 92, 246, 0.05);
        }
        
        .accordion[data-group-title="payment-questions"],
        .accordion[data-group-title="pyetje-per-pagesen"] {
            border-left-color: #ef4444 !important;
            background-color: rgba(239, 68, 68, 0.05);
        }
        
        .accordion[data-group-title="technical-questions"],
        .accordion[data-group-title="pyetje-teknike"] {
            border-left-color: #06b6d4 !important;
            background-color: rgba(6, 182, 212, 0.05);
        }
        
        .accordion[data-group-title="general-questions"],
        .accordion[data-group-title="pyetje-te-pergjithshme"] {
            border-left-color: #ec4899 !important;
            background-color: rgba(236, 72, 153, 0.05);
        }
        
        /* Dynamic color assignment for other groups */
        .accordion-box {
            position: relative;
        }
        
        .accordion[data-group-title]:not([data-group-title=""]) .click-area::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background-color: inherit;
        }
    </style>
    <div>

        <input type="hidden" name="accordionMetaNonce" value="<?php echo wp_create_nonce( "saveAccordionFields" ); ?>">

        <div id="wt-wrapper-accordion" class="wt-wrapper-cpt">

            <?php

            if ( is_array($meta) && count( $meta ) > 0 )
            {
                foreach( $meta["accordions"]  as $track )
                {
                    $headline               = $track["headline"] ?? "";
                    $headline_type          = $track["headline_type"] ?? "p";
                    $content                = $track["content"] ?? "";
                    $add_content_position   = $track["add_content_position"] ?? "";
                    $add_content            = $track["add_content"] ?? "";
                    $group_title            = $track["group_title"] ?? "";

                    if ($headline == "o")
                    {
                        continue;
                    }

                    $group_title_clean = !empty($group_title) ? sanitize_title($group_title) : '';
                    echo '<div class="accordion cpt-element" data-count="'.$c.'" data-group-title="'.esc_attr($group_title_clean).'">

                            <div class="sortButtons">
                                <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-down">
                                    <span class="dashicons dashicons-arrow-down-alt2"></span>
                                </button>
                                <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-up">
                                    <span class="dashicons dashicons-arrow-up-alt2"></span>
                                </button>
                            </div>
            
                            <div id="box-wrapper-'.$c.'" class="accordion-box cpt-box">
                                
                                <div class="click-area">
                                    <h3>Accordion #'.($c+1).'</h3>
                                </div>
                                
                                <div class="content-area">
                                    <dl>
                                    
                                        <dt></dt>
                                        <dd>
                                            <hr>
                                        </dd>
                                        
                                        <dt>'.__("Group Title",'play50games').' <small>'.__('(Optional - for grouping FAQs)','play50games').'</small></dt>
                                        <dd>
                                            <input type="text" name="accordion_fields[accordions]['.$c.'][group_title]" placeholder="'.__('e.g., Registration Questions','play50games').'..." class="regular-text" value="'.$group_title.'">
                                        </dd>
                                        
                                        <dt>'.__("Accordion Title",'play50games').'</dt>
                                        <dd>
                                            <input type="text" name="accordion_fields[accordions]['.$c.'][headline]" placeholder="'.__('Write here','play50games').'..." class="regular-text" value="'.$headline.'">
                                        </dd>
                                        
                                        <dt>'.__('Überschriftentyp','play50games').'</dt>
                                        <dd>
                                            <select name="accordion_fields[accordions]['.$c.'][headline_type]" class="slider-option">   
                                               <option value="p" '. selected($headline_type, "p", false) .'>p</option>
                                               <option value="h1" '. selected($headline_type, "h1", false) .'>h1</option>                                             
                                               <option value="h2" '. selected($headline_type, "h2", false) .'>h2</option>
                                               <option value="h3" '. selected($headline_type, "h3", false) .'>h3</option>
                                             </select>
                                        </dd>
                    
                                        <dt>'.__('Content','play50games').'</dt>
                                        <dd>
                                            '.getWpEditor($content, "accordion_fields_" . $c . "_content", "accordion_fields[accordions][" . $c . "][content]").'
                                        </dd>
                                        
                                        <div class="cpt-remove">
                                            <button type="button" class="remove" data-type="cpt-element">'.__('Remove Accordion', 'play50games').'</button>
                                        </div>
                                    </dl>
                                </div>
                                
                            </div>
                            
                        </div>';
                    $c = $c+1;
                }
            }?>

        </div>
        <button type="button" class="add" id="add_shortcode"><?php _e('Add Accordion','play50games'); ?></button>
    </div>

    <script>
        
        // Function to update group colors based on group titles (global)
        function updateGroupColors() {
                // Color palette
                const colors = [
                    { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.05)' }, // Blue
                    { border: '#10b981', bg: 'rgba(16, 185, 129, 0.05)' }, // Green
                    { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)' }, // Amber
                    { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.05)' }, // Purple
                    { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)' }, // Red
                    { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.05)' }, // Cyan
                    { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.05)' }, // Pink
                    { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.05)' }, // Teal
                    { border: '#f97316', bg: 'rgba(249, 115, 22, 0.05)' }, // Orange
                    { border: '#6366f1', bg: 'rgba(99, 102, 241, 0.05)' }, // Indigo
                ];
                
                // Get all unique group titles
                const groupMap = {};
                let colorIndex = 0;
                
                jQuery('.accordion').each(function() {
                    const $accordion = jQuery(this);
                    const groupTitleInput = $accordion.find('input[name*="[group_title]"]');
                    const groupTitle = groupTitleInput.val() ? groupTitleInput.val().trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
                    
                    if (groupTitle) {
                        if (!groupMap[groupTitle]) {
                            groupMap[groupTitle] = colors[colorIndex % colors.length];
                            colorIndex++;
                        }
                        
                        // Update data attribute
                        $accordion.attr('data-group-title', groupTitle);
                        
                        // Apply color
                        const color = groupMap[groupTitle];
                        $accordion.css({
                            'border-left-color': color.border,
                            'background-color': color.bg
                        });
                    } else {
                        // Remove color if no group title
                        $accordion.attr('data-group-title', '');
                        $accordion.css({
                            'border-left-color': 'transparent',
                            'background-color': 'transparent'
                        });
                    }
                });
        }
        
        jQuery(document).ready(function() {
            
            // Update colors on input change
            jQuery(document).on('input', 'input[name*="[group_title]"]', function() {
                updateGroupColors();
            });
            
            // Initial color update
            updateGroupColors();

            jQuery(".add").click(function() {

                let count = getExistingElements(".accordion");

                var accordionHTML = `<div class="accordion cpt-element" data-count="${count}" data-group-title="">

                <div class="sortButtons">
                    <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-down">
                        <span class="dashicons dashicons-arrow-down-alt2"></span>
                    </button>
                    <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-up">
                        <span class="dashicons dashicons-arrow-up-alt2"></span>
                    </button>
                </div>

                <div id="box-wrapper-${count}" class="accordion-box cpt-box">

                    <div class="click-area">
                        <h3>Accordion #${count}</h3>
                    </div>

                    <div class="content-area">
                        <dl>

                            <dt></dt>
                            <dd>
                                <hr>
                            </dd>

                            <dt><?php _e('Group Title','play50games'); ?> <small><?php _e('(Optional - for grouping FAQs)','play50games'); ?></small></dt>
                            <dd>
                                <input type="text" name="accordion_fields[accordions][${count}][group_title]" placeholder="<?php _e('e.g., Registration Questions','play50games'); ?>..." class="regular-text" value="">
                            </dd>

                            <dt><?php _e('Accordion Title','play50games'); ?></dt>
                            <dd>
                                <input type="text" name="accordion_fields[accordions][${count}][headline]" placeholder="<?php _e('Write here','play50games'); ?>..." class="regular-text" value="">
                            </dd>

                             <dt><?php _e("Überschriftentyp","play50games"); ?></dt>
                             <dd>
                                <select name="accordion_fields[accordions][${count}][headline_type]">
                                                <option value="p">p</option>
                                                <option value="h1">h1</option>
                                                <option value="h2">h2</option>
                                                <option value="h3">h3</option>
                                </select>
                             </dd>
                            <dt><?php _e('Content','play50games'); ?></dt>
                                <dd>
                                 <span id="box-${count}-accordion_fields_${count}_content">    </span>
                                </dd>
                            <dd>
                            </dd>

                            <div class="cpt-remove">
                                <button type="button" class="remove" data-type="cpt-element"><?php _e('Remove Accordion', 'play50games'); ?></button>
                            </div>

                        </dl>

                    </div>
                </div>
            </div>`;


                jQuery('#wt-wrapper-accordion').append(accordionHTML);

                let target = "<?php echo admin_url('admin-ajax.php'); ?>";

                let createWpEditor = function(editor_id, editor_name) {
                    let data_text = {
                        'action': 'wt_get_text_editor',
                        'text_editor_id': editor_id,
                        'textarea_name': editor_name
                    }

                    jQuery.post(target, data_text, function (response) {
                        let cont = "span#box-" + count + "-" + editor_id;
                        jQuery(cont).append(response);
                        tinymce.execCommand('mceAddEditor', false, editor_id);
                        quicktags({id: editor_id});

                        jQuery(".add").show();
                    });
                }

                // Content Editor
                let content_id = "accordion_fields_" + count + "_content";
                let content_name = "accordion_fields[accordions][" + count + "][content]";
                createWpEditor(content_id, content_name);

                setButtons();
                resetSort();
                
                // Update group colors after adding new accordion
                setTimeout(updateGroupColors, 100);

            });

            setButtons();
        });

        // Init sort buttons
        function setButtons(){
            jQuery('button').show();
            jQuery('.accordion button.sort-up').first().hide();
            jQuery('.accordion button.sort-down').last().hide();
        }

        // sort Buttons order
        function resetSort(){
            var i=0;
            jQuery('.accordion').each(function(){
                jQuery(this).attr("data-sort", i);
                i++;
            });
            // Update colors after sorting
            updateGroupColors();
        }

    </script>
<?php }
/* END - Custom Post Type - Accordion */