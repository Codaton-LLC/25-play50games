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
 * @subpackage play50games
 * @author Granit Nebiu
 * @since 1.0
 */

// rc for text block
function wt_button_block_rc($attributes, $content) {

    // get globals and scripts
    global  $theme_path;
    wp_register_style("wt_button_block",$theme_path."/wt-blocks/button-block/button_block.css",array("css-main"),"1");

    // vars
    $uniq_id                    = uniqid();
	
//			echo '<pre>';
//			echo print_r($attributes);
//			echo '</pre>';
			
	$button_text                = $attributes['button_text'] ?? "";
	$button_link                = $attributes['button_Link'] ?? "";
    $button_style               = $attributes['button_style'] ?? "full";
	$link_open_tab              = $attributes['link_open_tab'] ?? "_self";
	$align_button               = $attributes['align_button'] ?? "start";
    $background_color           = $attributes["background_color"] ?? 'white';
    $text_color                 = $attributes["text_color"] ?? 'black';
    $space_bottom               = $attributes["space_bottom"] ?? 'yes';
    $space_top                  = $attributes["space_top"] ?? 'yes';
	$class_name                 = $attributes["class_name"] ?? "";
	

    return '<section id="'.$class_name.'" class="button-block '.$class_name.' space-bottom-'.$space_bottom.' space-top-'.$space_top.' text-block-id-'.$uniq_id.' bg-color-'.$background_color.' text-color-'.$text_color.'">
                    <div class="container d-flex justify-content-'.$align_button.'">
                    	<a class="btn-'.$button_style.' btn-'.$button_style.'-primary" href="'.$button_link.'" target="'.$link_open_tab.'">
                    	    '.$button_text.'
                    	    
                    	    </a>
                    </div>
            </section>';
}