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
function wt_headline_block_rc($attributes, $content) {

    // get globals and scripts
    global  $theme_path;
    wp_register_style("wt_headline_block",$theme_path."/wt-blocks/headline-block/headline_block.css",array("css-main"),"1");

    // vars
    $uniq_id                    = uniqid();
    $headline                   = $attributes["headline"] ?? "";
//		            echo '<pre>';
//		        echo print_r($attributes);
//		        echo '</pre>';
	
    $headline_hml               = "";
	$description_html           = "";
    $class_name                 = $attributes["class_name"] ?? "";
    $background_color           = $attributes["background_color"] ?? 'white';
    $text_color                 = $attributes["text_color"] ?? 'black';
	$description                = $attributes["description"] ?? "";
    $space_bottom               = $attributes["space_bottom"] ?? 'yes';
    $space_top                  = $attributes["space_top"] ?? 'yes';
	$content_alignment          = $attributes["content_alignment"] ?? "left";

    $headline       = str_replace("[*", "<br/><span class='text-bold'>", $headline);
    $headline        = str_replace("*]", "</span>", $headline);
   
    if ( isset($attributes["select_headline_type"]) && $attributes["select_headline_type"] !== "" )
    {
        $headline_type = $attributes["select_headline_type"];
    }
    else
    {
        $headline_type = "h1";
    }


    if ($headline !== "")
    {
        $headline_hml = '<div class="row">                                        
                        <div class="col">
                            <'.$headline_type.' class="text-block-headline  '.$class_name.'">'.$headline.'</'.$headline_type.'>
                        </div>       
                                                          
                    </div>';
    }
	
	if ($description !== "")
	{
		$description_html = '<p>'.$description.'</p>
                        
                    </div>';
	}
	
	
	
	return '<section id="'.$class_name.'" class="headline-block '.$class_name.' space-bottom-'.$space_bottom.' space-top-'.$space_top.' text-block-id-'.$uniq_id.' bg-color-'.$background_color.' text-color-'.$text_color.' text-'.$content_alignment.'">
                    <div class="container">
                           <div class="row">
                        		'.$headline_hml.'
                                '.$description_html.'
                            </div>
                    </div>                                
            </section>';
}