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
                    $add_content            = $track["add_content"];

                    if ($headline == "o")
                    {
                        continue;
                    }

                    echo '<div class="accordion cpt-element" data-count="'.$c.'">

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

        jQuery(document).ready(function() {

            jQuery(".add").click(function() {

                let count = getExistingElements(".accordion");

                var accordionHTML = `<div class="accordion cpt-element" data-count="${count}">

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
        }

    </script>
<?php }
/* END - Custom Post Type - Accordion */