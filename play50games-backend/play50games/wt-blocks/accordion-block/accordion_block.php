<?php
/**
 * Copyright (c) 2025 by Granit Nebiu
 *
 * All rights are reserved. Reproduction or transmission in whole or in part, in
 * any form or by any means, electronic, mechanical or otherwise, is prohibited
 * without the prior written consent of the copyright owner.
 *
 * Functions and definitions
 *
 * @package WordPress
 * @subpackage webthinker-templa360
 * @author Granit Nebiu
 * @since 1.0
 */


// rc for Accordion Block
function wt_accordion_block_rc($attributes, $content)
{
    // get globals and scripts
    global $theme_path;
    wp_register_style("wt_accordion_block", $theme_path . "/wt-blocks/accordion-block/accordion_block.css", array("css-main"), "1");
    wp_enqueue_script("wt_accordion_block_js", $theme_path . "/wt-blocks/accordion-block/accordion_block.min.js", array("js-main"), "1");

    // vars
    $class_name         = $attributes["className"] ?? "";
		/*		echo '<pre>';
				echo print_r($attributes);
				echo '</pre>';*/

    $post_id_accordion  = $attributes["post_id"] ?? "";
    $uniqid             = uniqid();
    $accs_meta          = get_post_meta($post_id_accordion, 'accordion_fields', true);
    $accs               = $accs_meta['accordions'];
	
	$accordion_style            = $attributes['accordion_style'] ?? "";
	$headline_type              = $attributes["select_headline_type"] ?? 'h1';
	$headline                   = $attributes["headline"] ?? "";
	$text_style                 = $attributes["text_style"] ?? 'sRichText';
	$button_text                = $attributes['button_text'] ?? "";
	$button_link                = $attributes['button_link'] ?? "";
	$button_style               = $attributes['button_style'] ?? "full";
	$link_open_tab              = $attributes['link_open_tab'] ?? "_self";
    $space_bottom               = $attributes["space_bottom"] ?? 'yes';
    $space_top                  = $attributes["space_top"] ?? 'yes';
	
	$headline_style_2_html = "";
	if ($headline !== "")
	{
		$headline_style_2_html = '
			<'.$headline_type.' class="headline-accordion-style-2 font-bold pb-3">'.$headline.'</'.$headline_type.'>
        ';
	}
	
	if ($text_style === "sRichText")
	{
		$con = wpautop($content);
	}
	elseif ($text_style=== "sHtml")
	{
		$con = $attributes["text_html"];
	}

	$conHTML = "";
	if (!empty($con)) {
		$conHTML = '
                  <div class="text-block-text  text-block-html pb-4">
                            ' . $con . '
			 	  </div>';
	}

	$html_acc               = "";
    $html_accordion_wrapper = "";
    $button_html            = "";
    $full_content           = "";

    foreach ($accs as $acc) {
        $acc_headline       = $acc["headline"];
        $acc_headline_type  = $acc["headline_type"] ?? "p";

        $card_headline_type       = $item['card_headline_type'] ?? "p";
        $headline_html            = "";

        if($card_headline_type){
            $headline_html = '<' . $acc_headline_type . ' class="title">' . $acc_headline . '</' . $acc_headline_type . '>';
        }

        $accContent             = wpautop($acc["content"]);

        $html_acc .= '
            <div class="row">
                <div class="col-12 pb-3">
                    <div class="acc-box">
                        
                        <div class="click-area">                            
                                '.$headline_html. ' <i class="bi bi-chevron-down icon-open-close"></i>
                        </div>
                        
                        <div class="content-area">
                            
                            <div class="content">
                                <div class="text-wrapper">' . $accContent . '</div>
                            </div>
                            
                        </div>
                        
                    </div> 
                </div>
            </div>';
    }

    $html_accordion_wrapper .= '
        <div class="accWrapper">                                                
            ' . $html_acc . '                                                
        </div>';


    if($button_text !== "" && $button_link !== "")
    {
        $button_html = '<a class="btn-'.$button_style.' btn-'.$button_style.'-primary " href="'.$button_link.'" target="'.$link_open_tab.'">
                    	        '.$button_text.'
                    	    </a>';
    }

	if($accordion_style === "style_2")
	{
		$full_content = '<section id="' . $class_name . '" class="acc-block acc-block-style-2 bg-color-white acc-block-id-' . $uniqid . '  ' . $class_name . ' space-bottom-'.$space_bottom.' space-top-'.$space_top.'">
                
                <div class="container d-flex flex-column flex-lg-row gap-4">
	                <div class="left col-12 col-lg-6">
			                '.$headline_style_2_html.'
			                '.$conHTML.'
				            '.$button_html.'
					</div>
					
	                       ' . $html_accordion_wrapper . '
	                </div>
                 
            </section>';
	}
	else
	{
		$full_content = '<section id="' . $class_name . '" class="acc-block acc-block-id-' . $uniqid . '  ' . $class_name . ' space-bottom-'.$space_bottom.' space-top-'.$space_top.'">
                
                <div class="container">
                    ' . $html_accordion_wrapper . '
                </div>
                
            </section>';
	}
	
	return $full_content;
}