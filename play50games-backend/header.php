<?php
	/**
	 * Copyright (c) 2025 by Granit Nebiu
	 * @package WordPress
	 * @subpackage play50games
	 * @since 1.0
	 */
	
	$currentLangCode = defined('ICL_LANGUAGE_CODE') ? ICL_LANGUAGE_CODE : '';
	
	$theme_options     = get_option('play50_games_theme_options_' . $currentLangCode);
	$theme_options_all = get_option('play50_games_theme_options_all');
	
	$play50_games_logo        = $theme_options_all['play50_games_logo'] ?? "";
	$play50_games_logo_active = $theme_options_all['play50_games_logo_active'] ?? "";
	$play50_games_logo_mobile = $theme_options_all['play50_games_logo_mobile'] ?? "";
	
	$top_header_text          = $theme_options['top_header_text'] ?? "";
	$button_login_in          = $theme_options['button_login_in'] ?? "";
	$button_registration      = $theme_options['button_registration'] ?? "";
	$button_login_in_link     = $theme_options['button_login_in_link'] ?? "";
	$button_registration_link = $theme_options['button_registration_link'] ?? "";
    $search_link              = $theme_options['search_icon'] ?? "";
	
	/** ===== WPML languages ===== */
	$languages    = function_exists('icl_get_languages') ? icl_get_languages('skip_missing=0') : [];
	$current_lang = $languages ? (array_values(array_filter($languages, fn($l)=>!empty($l['active'])))[0] ?? reset($languages)) : null;

?>

<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
    <link rel="apple-touch-icon" sizes="57x57" href="/wp-content/themes/play50games/assets/img/favicon/apple-icon-57x57.png">
    <link rel="apple-touch-icon" sizes="60x60" href="/wp-content/themes/play50games/assets/img/favicon/apple-icon-60x60.png">
    <link rel="apple-touch-icon" sizes="72x72" href="/wp-content/themes/play50games/assets/img/favicon/apple-icon-72x72.png">
    <link rel="apple-touch-icon" sizes="76x76" href="/wp-content/themes/play50games/assets/img/favicon/apple-icon-76x76.png">
    <link rel="apple-touch-icon" sizes="114x114" href="/wp-content/themes/play50games/assets/img/favicon//apple-icon-114x114.png">
    <link rel="apple-touch-icon" sizes="120x120" href="/wp-content/themes/play50games/assets/img/favicon//apple-icon-120x120.png">
    <link rel="apple-touch-icon" sizes="144x144" href="/wp-content/themes/play50games/assets/img/favicon//apple-icon-144x144.png">
    <link rel="apple-touch-icon" sizes="152x152" href="/wp-content/themes/play50games/assets/img/favicon//apple-icon-152x152.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/wp-content/themes/play50games/assets/img/favicon//apple-icon-180x180.png">
    <link rel="icon" type="image/png" sizes="192x192"  href="/wp-content/themes/play50games/assets/img/favicon//android-icon-192x192.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/wp-content/themes/play50games/assets/img/favicon//favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/wp-content/themes/play50games/assets/img/favicon//favicon-96x96.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/wp-content/themes/play50games/assets/img/favicon//favicon-16x16.png">
    <link rel="manifest" href="/wp-content/themes/play50games/assets/img/favicon/manifest.json">
    <meta name="msapplication-TileColor" content="#ffffff">
    <meta name="msapplication-TileImage" content="/wp-content/themes/play50games/assets/img/favicon/ms-icon-144x144.png">
    <meta name="theme-color" content="#ffffff">
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="header-play50games">
    <div class="top-header">
        <p><?php echo $top_header_text ?></p>
    </div>
    <nav class="desktop-nav">
        <div class="container">
            <div class="header-wrapper">
                <div class="logo-wrapper">
                    <a class="logo-desktop" href="<?php echo esc_url(home_url('/')); ?>">
                        <img width="120" height="auto" alt="logo play50games" src="<?php echo $play50_games_logo ?>"/>
                    </a>
                    <a class="logo-desktop-active d-none" href="<?php echo esc_url(home_url('/')); ?>">
                        <img width="120" height="auto" alt="logo play50games" src="<?php echo $play50_games_logo_active ?>"/>
                    </a>
                </div>

                <div class="d-flex align-items-center">
					<?php
						wp_nav_menu([
							'theme_location'  => 'primary-menu',
							'container'       => 'nav',
							'container_class' => 'main-menu',
							'menu_class'      => 'nav-menu',
							'walker'          => new Desktop_Walker_Nav_Menu(),
							'fallback_cb'     => false
						]);
					?>
	                
	                <?php if ($current_lang): ?>
                        <a class="language-switch d-none d-lg-flex align-items-center gap-2"
                                data-bs-toggle="modal"
                                data-bs-target="#langCurrencyModal"
                                data-start-tab="#tab-lang">
                                <img src="<?php echo esc_url($current_lang['country_flag_url']); ?>" alt="" width="20" height="20">
                        </a>
	                <?php endif; ?>

					<?php get_template_part('template-parts/mega-menu'); ?>

                </div>

            </div>
        </div>
    </nav>
</header>

<!-- Modal Login -->
<div class="modal fade" id="play50games-login" data-bs-backdrop="static" data-bs-keyboard="true" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content d-flex flex-lg-row flex-wrap">
            <div class="col-12 col-lg-6 modal-left d-flex justify-content-center align-items-start">
                <img src="<?php echo $play50_games_logo ?>" alt="">
            </div>
            <div class="col-12 col-lg-6 modal-right">
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                <p class="modal-play50games-title"><?php echo __('Don’t have an account yet?', 'play50games'); ?></p>
                <div class="modal-body">
					<?php echo do_shortcode('[wc_login_form_webthinker-templa]'); ?>
                </div>
                <div class="text-lined d-flex align-items-center">
                    <div class="line-middle"></div>
                    <div class="line-text"><?php echo esc_html__('or', 'play50games'); ?></div>
                    <div class="line-middle"></div>
                </div>
                <p class="text-center modal-text-style"><?php echo __('Don’t have an account yet?', 'play50games'); ?></p>
                <div class="modal-button-footer">
                    <a class="btn-outline btn-outline-primary text-uppercase" data-bs-toggle="modal" data-bs-target="#play50games-register">
						<?php echo __('Create your account', 'play50games'); ?>
                    </a>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Modal Register -->
<div class="modal fade" id="play50games-register" data-bs-backdrop="static" data-bs-keyboard="true" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content d-flex flex-lg-row flex-wrap">
            <div class="col-12 col-lg-6 modal-left d-flex justify-content-center align-items-start">
                <img src="<?php echo $play50_games_logo ?>" alt="">
            </div>
            <div class="col-12 col-lg-6 modal-right">
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                <p class="modal-play50games-title"><?php echo __('Create account', 'play50games'); ?></p>
                <div class="modal-body">
					<?php echo do_shortcode('[play50_games_wc_registration]'); ?>
                </div>
                <div class="text-lined d-flex align-items-center">
                    <div class="line-middle"></div>
                    <div class="line-text"><?php echo esc_html__('or', 'play50games'); ?></div>
                    <div class="line-middle"></div>
                </div>
                <p class="text-center modal-text-style">
					<?php echo __('Already have an account?', 'play50games'); ?>
                    <a data-bs-toggle="modal" data-bs-target="#play50games-login"><?php echo __('Login', 'play50games'); ?></a>
                </p>
            </div>
        </div>
    </div>
</div>

<!-- Modal Lang/Currency -->
<div class="modal fade" id="langCurrencyModal" data-bs-backdrop="static" data-bs-keyboard="true" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content border-0 shadow">
            <div class="modal-header border-0 position-relative">
                <ul class="nav nav-pills pills-play50games d-flex justify-content-center w-100">
                    <li class="nav-item">
                        <button class="nav-link btn-full active" data-bs-toggle="pill" data-bs-target="#tab-lang" type="button">
                            <i class="bi bi-globe-americas"></i> <?php esc_html_e('Language', 'play50games'); ?>
                        </button>
                    </li>
                </ul>


                <button type="button"
                        class="btn-close position-absolute end-0 top-0 mt-2 me-2"
                        data-bs-dismiss="modal"
                        aria-label="<?php esc_attr_e('Close', 'play50games'); ?>">
                </button>
            </div>


            <div class="modal-body pt-0">
                <div class="tab-content">
                    <!-- Language -->
                    <div class="tab-pane fade show active" id="tab-lang">
						<?php if (!empty($languages)): ?>
                            <div class="row g-3">
								<?php foreach ($languages as $lang):
									$is_active = !empty($lang['active']);
									$href = $is_active ? '#' : ($lang['url'] ?? '#'); ?>
                                    <div class="col-12 col-sm-6 col-lg-4">
                                        <a href="<?php echo esc_url($href); ?>"
                                           class="tile d-flex align-items-center justify-content-between w-100 p-3 rounded-3 text-decoration-none <?php echo $is_active ? 'active' : ''; ?>"
											<?php echo $is_active ? 'aria-current="true" aria-disabled="true"' : ''; ?>>
                                            <span class="d-flex align-items-center gap-3">
                                                <?php if (!empty($lang['country_flag_url'])): ?>
                                                    <img src="<?php echo esc_url($lang['country_flag_url']); ?>" width="28" height="20" class="rounded" alt="">
                                                <?php endif; ?>
                                                <span class="d-flex flex-column">
                                                    <strong class="text-body"><?php
		                                                    $custom_lang_names = [
			                                                    'sq' => __('Albanian', 'play50games'),
			                                                    'de' => __('German', 'play50games'),
			                                                    'fr' => __('French', 'play50games'),
			                                                    'en' => __('English', 'play50games'),
		                                                    ];
		                                                    echo esc_html($custom_lang_names[$lang['code']] ?? $lang['native_name']); ?></strong>
                                                    <small class="text-muted"><?php echo esc_html($lang['translated_name'] ?? $lang['english_name'] ?? strtoupper($lang['code'] ?? '')); ?></small>
                                                </span>
                                            </span>
                                            <span class="select-dot"></span>
                                        </a>
                                    </div>
								<?php endforeach; ?>
                            </div>
						<?php endif; ?>
                    </div>

                </div>
            </div>
        </div>
    </div>
</div>



