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
function wt_text_block_rc($attributes, $content) {

    // get globals and scripts
    global  $theme_path;
    wp_register_style("wt_text_block",$theme_path."/wt-blocks/text-block/text_block.css",array("css-main"),"1");

    // vars
    $uniq_id                    = uniqid();
    $con                        = "";
    $conHTML                    = "";


    $headline                   = $attributes["headline"] ?? "";
	$headline_font_weight       = $attributes["headline_font_weight"] ?? "normal";
    $sub_headline               = $attributes["sub_headline"] ?? "";

    $headline       = str_replace("[*", "<br/><span class='text-bold'>", $headline);
    $headline        = str_replace("*]", "</span>", $headline);

    $sub_headline       = str_replace("[*", "<br/><span class='text-bold'>", $sub_headline);
    $sub_headline        = str_replace("*]", "</span>", $sub_headline);

    $headline_html              = "";
    $sub_headline_html          = "";

    $content_image_html         = "";
    $bg_headline_html           = "";

    $class_name                 = $attributes["class_name"] ?? "";
    $content_two_columns        = $attributes["two_columns"] ?? "0";
    $headline_align             = $attributes["select_field"] ?? 'left';
    $text_align                 = $attributes["text_select_field"] ?? 'left';
    $background_color           = $attributes["background_color"] ?? 'white';
    $text_color                 = $attributes["text_color"] ?? 'black';
    $text_style                 = $attributes["text_style"] ?? 'sRichText';
    $image                      = $attributes["image_text_block"]["url"] ?? '';
    $space_bottom               = $attributes["space_bottom"] ?? 'yes';
    $space_top                  = $attributes["space_top"] ?? 'yes';
    $bg_headline                = $attributes["bg_headline"] ?? '';
    $margin_top                 = $attributes["margin_top"] ?? '20';
    $headline_style             = $attributes["select_headline_style"] ?? 'style-1';
    $select_sub_headline_type   = $attributes["select_sub_headline_type"] ?? '';
    $select_headline_type       = $attributes["select_headline_type"] ?? '';

//            echo '<pre>';
//        echo print_r($attributes);
//        echo '</pre>';

    if($headline_style == "style_2")
    {
        $headline_style_class = "style-2";
    }
    else
    {
        $headline_style_class = "style-1";
    }

    if ($select_headline_type  !== "" )
    {
        $headline_type = $select_headline_type ;
    }
    else
    {
        $headline_type = "h1";
    }

    if ( $select_sub_headline_type!== "" )
    {
        $headline_sub_type = $select_sub_headline_type;
    }
    else
    {
        $headline_sub_type = "h1";
    }

    if($bg_headline !== ""){
        $bg_headline_html ="<p class='background-text'> $bg_headline </p>";
    }


    if($image !== '')
    {
        $content_image_html = "<img class='img-fluid' src='$image' />";
    }


    if ($text_style === "sRichText")
    {
        $con = wpautop($content);
    }
    elseif ($text_style=== "sHtml")
    {
        $con = $attributes["text_html"];
    }

    if (!empty($con))
    {
        $conHTML = '<div class="row text">
                    <div class="col">
                        <div class="text-'.$text_align.' text-block-text  text-block-html ' . ($content_two_columns == "1" ? "content-two-columns" : "") . '" style="margin-top: '.$margin_top.'px; ">
                            ' . $con . '
                        </div>
                    </div>                                        
                </div>';
    }

    if ($headline !== "")
    {
        $headline_html = '<div class="row">                                        
                        <div class="col">
                            <'.$headline_type.' class="text-block-headline font-'.$headline_font_weight.' '.$headline_style_class.' text-'.$headline_align.' '.$class_name.'">'.$headline.'</'.$headline_type.'>
                        </div>       
                                                          
                    </div>';
    }

    if ($sub_headline !== "" )
    {
        $sub_headline_html = '<div class="row">                                        
                        <div class="col">
                            <'.$headline_sub_type.' class="text-block-sub-headline text-'.$headline_align.' '.$class_name.'">'.$sub_headline.'</'.$headline_sub_type.'>
                        </div>       
                                                          
                    </div>';
    }

    return '<section id="'.$class_name.'" class="text-block '.$class_name.' space-bottom-'.$space_bottom.' space-top-'.$space_top.' text-block-id-'.$uniq_id.' bg-color-'.$background_color.' text-color-'.$text_color.'">                
                
                    <div class="container">     
                        '.$bg_headline_html.'         
                        '.$headline_html.'
                        '.$sub_headline_html.'       
                        '.$content_image_html.'                       
                        '.$conHTML.'                                              
                    </div>                                
            </section>';
}