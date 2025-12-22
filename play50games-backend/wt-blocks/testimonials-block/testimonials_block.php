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

	// rc for testimonials block
	function wt_testimonials_block_rc($attributes, $content) {
		global $theme_path;
		
		// Register & enqueue styles and scripts
		wp_register_style("wt_testimonials_block", $theme_path . "/wt-blocks/testimonials-block/testimonials_block.css", array("css-main"), "1");
		wp_enqueue_script("wt_testimonials_block_js", $theme_path . "/wt-blocks/testimonials-block/testimonials_block.min.js", array("js-main"), "1");
		wp_enqueue_style("wt_swiper_css", $theme_path . "/assets/css/swiper/swiper-bundle.min.css", array("css-main"), "1");
		wp_enqueue_script("wt_swiper_js", $theme_path . "/assets/js/swiper/swiper-bundle.min.js", array("js-main"), "1", true);
		
		
		$post_ID            = $attributes["post_id"] ?? "";
		$class_name         = $attributes["className"] ?? "default-play50games";
		$section_layout     = $attributes["layout"] ?? "container";
		$uid                = uniqid('testimonials_');
        $space_bottom       = $attributes["space_bottom"] ?? 'yes';
        $space_top          = $attributes["space_top"] ?? 'yes';
		
		$testimonials_data  = get_post_meta($post_ID, 'testimonials_fields', true);
		$testimonials       = $testimonials_data["testimonials"] ?? [];
		$testimonials_count = count($testimonials);
		
		// Icons (adjust path if necessary)
		$tick_green  = '/wp-content/themes/play50games/assets/icons/tick-green.svg';
		$tick_orange = '/wp-content/themes/play50games/assets/icons/tick-orange.svg';
		$tick_blue   = '/wp-content/themes/play50games/assets/icons/tick-blue.svg';
		
		$cards_html = '';
		
		foreach ($testimonials as $testimonial) {
			$image              = $testimonial["image"] ?? "";
			$message            = $testimonial["message"] ?? "";
			$location           = $testimonial["location"] ?? "";
			$full_name          = $testimonial["name_surname"] ?? "";
			$tick_color         = $testimonial["tick_type"] ?? "green"; // assume default color key if used

			$tick_link = $tick_green;
			if ($tick_color === "orange")
			{
				$tick_link = $tick_orange;
			}
			elseif ($tick_color === "blue")
			{
				$tick_link = $tick_blue;
			}
			
			$profile_image_html = '';
			if (!empty($image))
			{
				$profile_image_html = "<div class='testimonial-image'><img width='80' height='80' src='$image' alt='testimonial image' /></div>";
			}
			
			$cards_html .= "
							<div class='swiper-slide testimonial-card'>
							  <div class='testimonial-content d-flex flex-column justify-content-between'>
							    <div>$profile_image_html</div>
							    <div><p class='testimonial-message'>$message</p></div>
							    <div class='d-flex justify-content-between align-items-end'>
							      <div>
							        <p class='testimonial-location'>$location</p>
							        <p class='testimonial-full-name'>$full_name</p>
							      </div>
							      <img src='$tick_link' class='icon-tick' alt='icon' width='32' height='32' />
							    </div>
							  </div>
							</div>
							";

		}
		
		$html = "<section id='$uid' class='testimonials-section testimonials-section-count-$testimonials_count $class_name  space-bottom-$space_bottom space-top-$space_top'>
					  <div class='$section_layout'>
					    <div class='swiper testimonials-swiper'>
					      <div class='swiper-wrapper'>
					        $cards_html
					      </div>

					    </div>
					  </div>
					</section>
					";
		
		return $html;
	}
