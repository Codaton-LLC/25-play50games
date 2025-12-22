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
	
	// Render callback for multiple buttons block
	function wt_multiple_buttons_block_rc($attributes, $content) {
		global $theme_path;
		wp_register_style("wt_multiple_buttons_block", $theme_path."/wt-blocks/multiple-buttons-block/multiple_buttons_block.css", array("css-main"), "1");
		
		$uniq_id          = uniqid();
	
		$align_button     = $attributes['align_button'] ?? "start";
		$background_color = $attributes["background_color"] ?? 'white';
		$text_color       = $attributes["text_color"] ?? 'black';
		$space_bottom     = $attributes["space_bottom"] ?? 'yes';
		$space_top        = $attributes["space_top"] ?? 'yes';
		$class_name       = $attributes["class_name"] ?? "";
		$buttons          = $attributes['buttons'] ?? [];
		
		$buttons_html = '';
		if (!empty($buttons)) {
			foreach ($buttons as $btn) {
				$text   = esc_html($btn['text'] ?? '');
				$link   = esc_url($btn['link'] ?? '#');
				$target = esc_attr($btn['target'] ?? '_self');
				$button_style     =  esc_attr($btn['button_style'] ?? 'full');
				// Icon logic
				$icon_html = '';
				if (!empty($btn['icon_type']) && $btn['icon_type'] === 'text' && !empty($btn['icon_text'])) {
					$icon_html = '<i class="'.esc_attr($btn['icon_text']).'"></i> ';
				}
				if (!empty($btn['icon_type']) && $btn['icon_type'] === 'image' && !empty($btn['icon_image']['url'])) {
					$icon_html = '<img class="btn-icon" src="'.esc_url($btn['icon_image']['url']).'" alt="" /> ';
				}
				
				if ($text) {
					$buttons_html .= '<a class="btn-' . esc_attr($button_style) . ' btn-' . esc_attr($button_style) . '-primary" href="' . $link . '" target="' . $target . '">' . $icon_html . $text . '</a> ';
				}
			}
		}
		
		return '<section id="' . esc_attr($class_name) . '" class="multiple-buttons-block ' . esc_attr($class_name) . ' space-bottom-' . esc_attr($space_bottom) . ' space-top-' . esc_attr($space_top) . ' text-block-id-' . esc_attr($uniq_id) . ' bg-color-' . esc_attr($background_color) . ' text-color-' . esc_attr($text_color) . '">
                <div class="container d-flex gap-3 justify-content-' . esc_attr($align_button) . '">
                    ' . $buttons_html . '
                </div>
            </section>';
	}
