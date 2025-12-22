<?php
$currentLangCode = "";
if (defined('ICL_LANGUAGE_CODE'))
{
    $currentLangCode = ICL_LANGUAGE_CODE;
}
	
	$theme_options            = get_option('play50_games_theme_options_' . $currentLangCode);
$theme_options_all        = get_option('play50_games_theme_options_all');

$mega_menu_headline = $theme_options['mega_menu_title'] ?? "";

$mega_menu_headline        = str_replace("[*", "<br/><span class='text-bold'>", $mega_menu_headline);
$mega_menu_headline        = str_replace("*]", "</span>", $mega_menu_headline);

$footer_address         = $theme_options['footer_address'] ?? "";
$footer_address_2       = $theme_options['footer_address_2'] ?? "";
$footer_address_2_link  = $theme_options['footer_address_2_link'] ?? "";

$footer_phone_number_title      = $theme_options['footer_phone_number_title'] ?? "";
$footer_phone_number            = $theme_options['footer_phone_number'] ?? "";
$footer_phone_number_link       = $theme_options['footer_phone_number_link'] ?? "";

$social_title                   = $theme_options['social_title'] ?? "";

$social_title        = str_replace("[*", "<br/><span>", $social_title);
$social_title        = str_replace("*]", "</span>", $social_title);

$linked_in_link                 = $theme_options_all['linkedin_link'] ?? "";
$instagram_link                 = $theme_options_all['instagram_link'] ?? "";
$facebook_link                  = $theme_options_all['facebook_link'] ?? "";
	
	$button_login_in          = $theme_options['button_login_in'] ?? "";
	$button_registration      = $theme_options['button_registration'] ?? "";
	
	$languages    = function_exists('icl_get_languages') ? icl_get_languages('skip_missing=0') : [];
	$current_lang = $languages ? (array_values(array_filter($languages, fn($l)=>!empty($l['active'])))[0] ?? reset($languages)) : null;
	
 
	$lang_label     = strtoupper($current_lang['code'] ?? '');
	
	/** ===== WCML currencies (robust) ===== */
	$store_currency  = get_option('woocommerce_currency');
	$client_currency = $store_currency;
	
	// 1) WCML filter
	$client_currency = apply_filters('wcml_client_currency', $client_currency);
	$currency_symbol = function_exists('get_woocommerce_currency_symbol')
		? html_entity_decode(get_woocommerce_currency_symbol($client_currency))
		: strtoupper($client_currency);
?>

<div class="d-flex d-xxl-none open-mega-menu" id="openMegaMenu">
    <!-- Open Hamburger SVG -->
    <div class="svg-icon open-icon">
        <img src="/wp-content/themes/play50games/assets/img/vectors/openMenu.svg" width="30" height="27.23" alt="Close">
    </div>

    <!-- Close (X) SVG -->
    <div class="svg-icon close-icon">
        <img src="/wp-content/themes/play50games/assets/img/vectors/closeMenu.svg" width="30" height="27.23" alt="Close">
    </div>
</div>
<div class="overflow-hidden">
    <div class="split-panel panel-left d-none" id="panelLeft">
        <div class="panel-content container">

        </div>
    </div>
    <div class="split-panel panel-right d-block d-xxl-none " id="panelRight">


        <div class="mega-socials">
            <div>
                <a href="<?php echo $facebook_link ?>">
                    <img src="/wp-content/themes/play50games/assets/img/vectors/fb.svg" alt="social facebook">
                </a>
            </div>
            <div>
                <a href="<?php echo $linked_in_link ?>">
                    <img src="/wp-content/themes/play50games/assets/img/vectors/linkedin.svg" alt="social facebook">
                </a>
            </div>
            <div>
                <a href="<?php echo $instagram_link ?>">
                    <img src="/wp-content/themes/play50games/assets/img/vectors/ig.svg" alt="social facebook">
                </a>
            </div>
            <div class="mega-social-description">
                <p><?php echo $social_title ?></p>
            </div>
        </div>
        <div class="panel-content container">
            <div class="mega-menu-main d-flex flex-column justify-content-between">
                <div class="mega-menu-right-top">
<!--                    <p class="wt-h1">--><?php //echo $mega_menu_headline ?><!--</p>-->
                    <nav class="mega-menu-content ">
                                        <?php
                                        wp_nav_menu(array(
                                            'theme_location' => 'mobile-menu',
                                            'container' => 'nav',
                                            'container_class' => 'mega-menu',
                                            'menu_class' => 'nav-menu-mobile',
                                            'walker' => new Mobile_Walker_Nav_Menu(),
                                            'fallback_cb' => false
                                        ));
                                        ?>
                    </nav>
      
	                

                </div>

                <div class="mega-menu-right-bottom">
                    <div class="mobile-menu-buttons d-flex flex-column mt-5">
		                <?php if (is_user_logged_in()) : ?>
                            <div class="button-my-account-mobile">
                                <a class="btn-full btn-full-white mt-4"
                                   href="<?php echo get_permalink(get_option('woocommerce_myaccount_page_id')); ?>">
					                <?php echo __('My Account', 'play50games'); ?>
                                </a>
                            </div>
		                <?php else : ?>
                            <div class="mt-2 button-login-mobile">
                                <a class="btn-full btn-full-white" data-bs-toggle="modal" data-bs-target="#play50games-login">
					                <?php echo $button_login_in; ?>
                                </a>
                            </div>
                            <div class="mt-4 button-register-mobile">
                                <a class="btn-full btn-full-outline-white" data-bs-toggle="modal" data-bs-target="#play50games-register">
					                <?php echo $button_registration; ?>
                                </a>
                            </div>
		                <?php endif; ?>

                    </div>
	                <?php if ($current_lang): ?>
                        <div class="mt-4">
                            <a class="lang-mobile btn-full btn-full-outline-white d-flex align-items-center gap-2 text-center"
                               data-bs-toggle="modal"
                               data-bs-target="#langCurrencyModal"
                               data-start-tab="#tab-lang">
				                <?php if (!empty($current_lang['country_flag_url'])): ?>
                                    <img src="<?php echo esc_url($current_lang['country_flag_url']); ?>" alt="" width="20" height="20">
				                <?php endif; ?>
                                <span><?php echo esc_html($lang_label); ?> ❘ <?php echo esc_html($currency_symbol); ?></span>
                            </a>
                        </div>
	                <?php endif; ?>
                    <div class="d-flex flex-column flex-sm-row flex-lg-column flex-xxl-row justify-content-between align-content-center">
                        <div class="d-flex gap-4 align-items-center order-0 mb-4 mb-xk-0">
<!--                            <img width="70" height="70" src="/wp-content/themes/play50games/assets/img/vectors/megamenu-address.svg"  alt="address"/>-->
                            <div class="mega-address">
                                <p><?php echo $footer_address ?></p>
                                <a href="<?php echo $footer_address_2_link ?>"> <?php echo $footer_address_2 ?></a>
                            </div>
                        </div>
                        <div class="d-flex gap-4 align-items-center order-1 order-lg-2 mb-4 mb-xl-0">
<!--                            <img width="70" height="70" src="/wp-content/themes/play50games/assets/img/vectors/megamenu-phone.svg" alt="phone"/>-->
                            <div class="mega-phone text-left text-lg-right">
                                <p><?php echo $footer_phone_number_title ?></p>
                                <a href="<?php echo $footer_phone_number_link ?>"> <?php echo $footer_phone_number ?></a>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    </div>
</div>