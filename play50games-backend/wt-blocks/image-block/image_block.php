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

// rc for image block
function wt_image_block_rc( $attributes, $content ) {


    global  $theme_path;
    wp_register_style("wt_image_block",$theme_path."/wt-blocks/image-block/image_block.css",array("css-main"),"1");
	
//	            echo '<pre>';
//	        echo print_r($attributes);
//	        echo '</pre>';
    // vars
    $img_url            = $attributes["img_1"]["url"] ?? "";
    $link               = $attributes["link_1"] ?? '';
    $layout             = $attributes["layout"] ?? '';
    $background_color   = $attributes["background_color"] ?? "";
    $image_link         = $attributes["image_link"] ?? "";

    $paddings = array(
        'desktop' => array(
            'padding-top' => $attributes['desktop_padding_top'] ?? '0',
            'padding-right' => $attributes['desktop_padding_right'] ?? '0',
            'padding-bottom' => $attributes['desktop_padding_bottom'] ?? '0',
            'padding-left' => $attributes['desktop_padding_left'] ?? '0'
        ),
        'tablet' => array(
            'padding-top' => $attributes['tablet_padding_top'] ?? '0',
            'padding-right' => $attributes['tablet_padding_right'] ?? '0',
            'padding-bottom' => $attributes['tablet_padding_bottom'] ?? '0',
            'padding-left' => $attributes['tablet_padding_left'] ?? '0'
        ),
        'mobile' => array(
            'padding-top' => $attributes['mobile_padding_top'] ?? '0',
            'padding-right' => $attributes['mobile_padding_right'] ?? '0',
            'padding-bottom' => $attributes['mobile_padding_bottom'] ?? '0',
            'padding-left' => $attributes['mobile_padding_left'] ?? '0'
        ),
    );

    $img_block_id = 'img-block-' . uniqid();

    $padding_classes = "";
    $styles = "<style>";

    // Define the devices and their media query breakpoints
    $devices = array(
        'desktop' => '',
        'tablet' => '991px',
        'mobile' => '575px',
    );

    foreach($devices as $device => $breakpoint) {
        foreach($paddings[$device] as $padding_type => $value) {
            $padding_class = "$device-$padding_type";
            $padding_classes .= "$padding_class ";

            if(!empty($breakpoint)) {
                $styles .= "@media only screen and (max-width: $breakpoint) { ";
            }

            $styles .= " #$img_block_id.$padding_class { $padding_type: {$value}px; }";

            if(!empty($breakpoint)) {
                $styles .= "} ";
            }
        }
    }

    $styles .= "</style>";

    $image_link_html = "";
    if($image_link !== "")
    {
        $image_link_html = '<a  '.($image_link == "" ? "" : "href='$image_link'").'>
                                <img id="'.$img_block_id.'" class="img-block '.$padding_classes.'" src="'.$img_url.'" />
                            </a>';
    }
    else
    {
        $image_link_html = '  <img id="'.$img_block_id.'" class="img-block '.$padding_classes.'" src="'.$img_url.'" />';
    }

    return '<section class="image-gallery-block">  
  <div class="' . ( $layout == "full-width" ? "container-fluid" : "container" ) . '  bg-color-'.$background_color.'">              
        <div class="">
                <div class="img-block col-12">         
                       	 '.$image_link_html.' 
                </div>
        </div>                                                            
    </section>' .$styles;
}