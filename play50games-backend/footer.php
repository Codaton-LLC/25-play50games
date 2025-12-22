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
$currentLangCode = "";
if (defined('ICL_LANGUAGE_CODE'))
{
    $currentLangCode = ICL_LANGUAGE_CODE;
}

$theme_options            = get_option('play50_games_theme_options_' . $currentLangCode);
$theme_options_all        = get_option('play50_games_theme_options_all');

$footer_title_1 = $theme_options['footer_title_1'] ?? "";
$footer_title_2 = $theme_options['footer_title_2'] ?? "";
$footer_title_3 = $theme_options['footer_title_3'] ?? "";
$footer_title_4 = $theme_options['footer_title_4'] ?? "";

//			echo '<pre>';
//			echo print_r($attributes);
//			echo '</pre>';

$footer_address         = $theme_options['footer_address'] ?? "";
$footer_address_2       = $theme_options['footer_address_2'] ?? "";
$footer_address_2_link  = $theme_options['footer_address_2_link'] ?? "";

$footer_copyright_text          = $theme_options['footer_copyright_text'] ?? "";
$footer_copyright_text_2        = $theme_options['footer_copyright_text_2'] ?? "";

$footer_phone_number_title      = $theme_options['footer_phone_number_title'] ?? "";
$footer_phone_number            = $theme_options['footer_phone_number'] ?? "";
$footer_phone_number_link       = $theme_options['footer_phone_number_link'] ?? "";

$footer_logo                  = $theme_options_all['play50_games_footer_logo'] ?? "";
$footer_logo_2                = $theme_options_all['play50_games_footer_logo_2'] ?? "";
$footer_logo_3                = $theme_options_all['play50_games_footer_logo_3'] ?? "";

$footer_apple_link         = $theme_options_all['footer_apple_link'] ?? "";
$footer_android_link       = $theme_options_all['footer_android_link'] ?? "";

$nav_footer_1 = array(
    'theme_location' => 'footer-menu-1',
    'menu_class' => 'footer-menu',
    'items_wrap' => '%3$s',
);

$nav_footer_2 = array(
    'theme_location' => 'footer-menu-2',
    'menu_class' => 'footer-menu',
    'items_wrap' => '%3$s',
);

$nav_footer_3 = array(
    'theme_location' => 'footer-menu-3',
    'menu_class' => 'footer-menu',
    'items_wrap' => '%3$s',
);

$nav_footer_4 = array(
    'theme_location' => 'footer-menu-4',
    'menu_class' => 'footer-menu',
    'items_wrap' => '%3$s',
);


?>

<footer class="footer-container">
    <div class="container ">
        <div class="footer-header d-flex pb-4 flex-column flex-lg-row justify-content-between align-items-center">
            <div class="footer-logo">
                <img src="<?php echo $footer_logo ?>" alt="play50games logo footer" />
            </div>

            <div class="app-download d-flex gap-3">
                    <div class="app-1">
                        <a href="<?php echo $footer_apple_link ?>"> <img src="<?php echo $footer_logo_3 ?>" alt="download app from apple store"></a>
                    </div>
                    <div class="app-2">
                        <a href="<?php echo $footer_android_link ?>"> <img src="<?php echo $footer_logo_2 ?>" alt="download app from playStore"></a>
                    </div>
             
            </div>
        </div>
        <div class="footer-body d-flex flex-column flex-xl-row justify-content-between">
            <div class="col-12 col-lg-3">
                    <p class="font-bold pb-2 pb-lg-5 pt-5 pt-lg-0 wt-h4"><?php echo $footer_title_1 ?></p>
                    <?php wp_nav_menu($nav_footer_1); ?>
            </div>
            <div class="col-12 col-lg-3">
                <p class="font-bold pb-2 pb-lg-5 pt-5 pt-lg-0 wt-h4"><?php echo $footer_title_2 ?></p>
		        <?php wp_nav_menu($nav_footer_2); ?>
            </div>
            <div class="col-12 col-lg-3">
                <p class="font-bold pb-2 pb-lg-5 pt-5 pt-lg-0 wt-h4"><?php echo $footer_title_3 ?></p>
	            <?php wp_nav_menu($nav_footer_3); ?>
            </div>
            <div class="col-12 col-lg-3">
                <p class="font-bold pb-2 pb-lg-5 pt-5 pt-lg-0 wt-h4"><?php echo $footer_title_4 ?></p>
	            <?php wp_nav_menu($nav_footer_4); ?>
            </div>
        </div>
    </div>

    <div class="footer-bottom py-4">
        <div class="container d-flex flex-column flex-lg-row justify-content-between align-content-center px-3">
            <div class="">
                <p class="first-copyright"><?php echo $footer_copyright_text ?></p>
            </div>
            <div class="">
                <p class="first-copyright"><?php echo $footer_copyright_text_2 ?></p>
            </div>
        </div>

    </div>

</footer>
<?php
//	add_action('wp_footer', function() {
//		if (is_user_logged_in()) {
//			$user_id = get_current_user_id();
//			echo "<div style='background:#ff0; padding:8px; position:fixed; bottom:0; right:0; z-index:9999;'>User ID: $user_id</div>";
//		}
//	});
//
//?>
<?php wp_footer(); ?>

</body>
</html>