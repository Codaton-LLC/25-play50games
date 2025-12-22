<?php
/* Custom Post Type - Testimonials */

function show_testimonials_custom_fields() {

    $js_src = includes_url('js/tinymce/') . 'tinymce.min.js';
    $css_src = includes_url('css/') . 'editor.css';

    wp_register_style('tinymce_css', $css_src);
    wp_enqueue_style('tinymce_css');

    global $post;

    $meta = get_post_meta($post->ID,'testimonials_fields',true);
    $c = 0;

    ?>


    <script src="<?php echo $js_src; ?>" type="text/javascript"></script>
    <div>

        <input type="hidden" name="testimonialsMetaNonce" value="<?php echo wp_create_nonce( "testimonialsFields" ); ?>">

        <div class="testimonialsSettings">

            <h3>Testimonials</h3>

        </div>

        <div id="wt-wrapper-testimonials" class="wt-wrapper-cpt">

            <?php

            if ( is_array($meta) && count( $meta ) > 0 )
            {
                foreach( $meta["testimonials"] as $testimonials )
                {
                    $location           = $testimonials["location"] ?? '';
	                $message            = $testimonials["message"] ?? "";
                    $name_surname       = $testimonials["name_surname"] ?? '';
	                $tick_type          = $testimonials["tick_type"] ?? '';
                    $imgSrc             = $testimonials["image"] ?? "";
                    $imgId              = $testimonials["imageId"] ?? "";
	          
                    echo '<div class="testimonials cpt-element" data-count="'.$c.'">

            <div class="sortButtons">
                <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-down">
                    <span class="dashicons dashicons-arrow-down-alt2"></span>
                </button>
                <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-up">
                    <span class="dashicons dashicons-arrow-up-alt2"></span>
                </button>
            </div>
            
            <div id="box-wrapper-'.$c.'" class="testimonials-box cpt-box">
                
                <div class="click-area">
                    <h3>Testimonial #'.($c+1).'</h3>
                </div>
                
                <div class="content-area "> <!--Hier bei JS einfach link als Klasse-->
                    <dl>
                        <dt></dt>
                        <dd>
                            <hr>
                        </dd>
                        
                        <dt>'.__('Image profile','play50games').' </dt>
                        <dd>
                            <input type="hidden" name="testimonials_fields[testimonials]['.$c.'][image]" class="meta-image" value="'.$imgSrc.'">
                            <input type="hidden" name="testimonials_fields[testimonials]['.$c.'][imageId]" class="meta-image-id" value="'.$imgId.'">
                            <input type="button" data-id="'.$c.'" class="button image-upload" value="'.__('Browse','play50games').'">
                            <input type="button" class="button image-upload-remove" data-id="'.$c.'" value="'.__('Remove','play50games').'">
                        </dd>
                        
                        <dt>'.__('Icon Preview','play50games').'</dt>
                        <dd>
                            <div class="image-preview"><img src="'.$imgSrc.'" alt=""></div>
                        </dd>
                        
                        <dd>
                            <hr>
                        </dd>

                        <div class="elements-hexagon-style">
                            <dt>' . __('Message', "play50games") . '</dt>
                            ' . getWpEditor($message, "testimonials_fields_message_$c", "testimonials_fields[testimonials][" . $c . "][message]") . '
                        </div>
                        
                        <dt></dt>
                        
                        <dt>'.__('Name and Surname','play50games').'</dt>
                        <dd>
                            <input type="text" name="testimonials_fields[testimonials]['.$c.'][name_surname]" placeholder="'.__('Write here','play50games').'..." class="regular-text" value="'.$name_surname.'">
                        </dd>
                        
                        <dt>
                            '.__('Location','play50games').'
                        </dt>
                        
                        <dd>
                            <input type="text" name="testimonials_fields[testimonials]['.$c.'][location]" placeholder="'.__('Write here','play50games').'..." class="regular-text" value="'.$location.'">
                        </dd>
                        
                        <dt>'.__('Tick Type Type','play50games').'</dt>
                        <dd>
                            <select name="testimonials_fields[testimonials]['.$c.'][tick_type]" class="testimonials-option">
                                <option value="green" '. selected($tick_type, "green", false) .'>Tick Green</option>
                                <option value="orange" '. selected($tick_type, "orange", false) .'>Tick Orange</option>
                                <option value="blue" '. selected($tick_type, "blue", false) .'>Tick Blue</option>
                            </select>
                        </dd>
                        
                        <div class="cpt-remove">
                            <button type="button" class="remove">'.__('Remove Testimonial', 'play50games').'</button>
                        </div>
                    </dl>
                </div>
            </div>
        </div>';
                    $c = $c+1;
                }
            }

            ?>
        </div>
        <button type="button" class="add"><?php _e('Add Testimonial','play50games'); ?></button>
    </div>

    <script>

        jQuery(document).ready(function() {

            jQuery(".add").click(function() {

                jQuery(".add").hide();

                let count = getExistingElements(".testimonials");

                var testimonialsHTML = `<div class="testimonials cpt-element" data-count="${count}">

                        <div class="sortButtons">
                        <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-down">
                            <span class="dashicons dashicons-arrow-down-alt2"></span>
                        </button>
                        <button type="button" class="btn btn-sm btn-primary float-right mr-1 sort-up">
                            <span class="dashicons dashicons-arrow-up-alt2"></span>
                        </button>
                    </div>

                    <div id="box-wrapper-${count}" class="testimonials-box cpt-box">

                        <div class="click-area">
                            <h3>Testimonial #${count}</h3>
                        </div>

                        <div class="content-area link">
                            <dl>
                                <dt></dt>
                                <dd>
                                    <hr>
                                </dd>

                                <dt><?php _e('Image Profile','play50games'); ?></dt>
                                <dd>
                                    <input type="hidden" name="testimonials_fields[testimonials][${count}][image]" class="meta-image" value="">
                                    <input type="hidden" name="testimonials_fields[testimonials][${count}][imageId]" class="meta-image-id" value="">
                                    <input type="button" data-id="${count}" class="button image-upload" value="<?php _e('Browse','play50games'); ?>">
                                    <input type="button" data-id="${count}" class="button image-upload-remove" value="<?php _e('Remove','play50games'); ?>">
                                </dd>

                                <dt><?php _e('Icon Preview','play50games'); ?></dt>
                                <dd>
                                    <div class="image-preview"><img src="" alt=""></div>
                                </dd>
                                
                                <dd>
                                    <hr>
                                </dd>

                               <div class="elements-hexagon-style">
                                      <dt><?php _e('Message', "play50games"); ?></dt>
                                      <span id="box-row2-${count}-testimonials_fields_${count}_message"></span>
                               </div>
                                
                                
                                <dt><?php _e('Location','play50games'); ?></dt>
                                <dd>
                                    <input type="text" name="testimonials_fields[testimonials][${count}][location]" placeholder="<?php _e('Write here','play50games'); ?>..." class="regular-text" value="">
                                </dd>

                                <dt><?php _e('Name and Surname','play50games'); ?></dt>
                                <dd>
                                    <input type="text" name="testimonials_fields[testimonials][${count}][name_surname]" placeholder="<?php _e('Write here','play50games'); ?>..." class="regular-text" value="">
                                </dd>

                                <dt><?php _e("Tick Type","play50games"); ?></dt>
                                <dd>
                                    <select name="testimonials_fields[testimonials][${count}][tick_type]">
                                        <option value="green">Tick Green</option>
                                        <option value="orange">Tick Orange</option>
                                        <option value="Blue">Tick Blue</option>
                                    </select>
                                </dd>

                                <div class="cpt-remove">
                                    <button type="button" class="remove"><?php _e('Remove Testimonial', 'play50games'); ?></button>
                                </div>

                            </dl>
                        </div>
                    </div>

                </div>`;
	            
	            jQuery('#wt-wrapper-testimonials').append(testimonialsHTML);
	            
	            let target = "<?php echo admin_url('admin-ajax.php'); ?>";
	            
	            let createWpEditor = function(editor_id, editor_name) {
		            console.log(editor_id);
		            let data_text = {
			            'action': 'wt_get_text_editor',
			            'text_editor_id': editor_id,
			            'textarea_name': editor_name
		            }
		            
		            jQuery.post(target, data_text, function (response) {
			            
			            let cont = "#box-row2-" + count + "-" + editor_id;
			            jQuery(cont).append(response);
			            tinymce.execCommand('mceAddEditor', false, editor_id);
			            quicktags({id: editor_id});
			            
			            jQuery(".add").show();
		            });
	            }
	            
	            // message Editor
	            let message_id = "testimonials_fields_" + count + "_message";
	            let message_name = "testimonials_fields[testimonials][" + count + "][message]";

	            
	            createWpEditor(message_id, message_name);
				
                setButtons();
                resetSort();
            });

            setButtons();
        });

        // Init sort buttons
        function setButtons(){
            jQuery('button').show();
            jQuery('.testimonials button.sort-up').first().hide();
            jQuery('.testimonials button.sort-down').last().hide();
        }

        // sort Buttons order
        function resetSort(){
            var i=0;
            jQuery('.testimonials').each(function(){
                jQuery(this).attr("data-sort", i);
                i++;
            });
        }

    </script>
<?php }
/* END - Custom Post Type - testimonials */
