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

/* Theme options page */
add_action( "admin_init", "theme_options_init" );
add_action( "admin_menu", "add_theme_menu_item" );

function add_theme_menu_item() {
    add_menu_page( "Theme-Optionen", "Theme-Optionen", "manage_options", "theme-panel", "add_theme_options", null, 99 );
}

// register settings
function theme_options_init() {

    $currentLangCode = "";
    if ( defined( 'ICL_LANGUAGE_CODE' ) ) {
        $currentLangCode = ICL_LANGUAGE_CODE;
    }

    register_setting( 'theme_options', 'play50_games_theme_options_' . $currentLangCode, 'itg_validate_options' );
    register_setting( 'theme_options', 'play50_games_theme_options_all', 'itg_validate_options' );

    $js_src = includes_url('js/tinymce/') . 'tinymce.min.js';
    $css_src = includes_url('css/') . 'editor.css';

    wp_register_style('tinymce_css', $css_src);
    wp_enqueue_style('tinymce_css');
	

    
}



// create option site
function add_theme_options() {



    if ( ! isset( $_REQUEST['settings-updated'] ) ) {
        $_REQUEST['settings-updated'] = false;
    } ?>

    <div class="wrap wt-theme-options-wrapper">
        <header class="wt-options-header">
            <div class="wt-header-content">
                <div class="wt-header-icon">
                    <i class="ph ph-gear-six"></i>
            </div>
                <div class="wt-header-text">
                    <h1 class="wt-header-title"><?php _e( 'Theme Options', "play50games" ); ?></h1>
                    <p class="wt-header-subtitle"><?php _e( 'Customize your website appearance and functionality', "play50games" ); ?></p>
                </div>
            </div>
        </header>

        <!-- Modern Notification Container -->
        <div class="wt-notification-container" id="wt-notification-container" role="region" aria-live="polite" aria-label="Notifications">
            <?php 
            // Handle different notification types based on URL parameters
            $notification_type = $_GET['notification'] ?? '';
            $notification_message = $_GET['message'] ?? '';
            
            if ( false !== $_REQUEST['settings-updated'] ) : ?>
                <div class="wt-notification success show" role="alert">
                    <div class="wt-notification-icon" aria-hidden="true">✓</div>
                    <div class="wt-notification-content">
                        <div class="wt-notification-title">Settings Saved</div>
                        <div class="wt-notification-message">All theme options have been saved successfully!</div>
                    </div>
                    <button class="wt-notification-close" onclick="this.parentElement.remove()" aria-label="Close notification">×</button>
                    <div class="wt-notification-progress"></div>
                </div>
            <?php elseif ( $notification_type && $notification_message ) : 
                $icons = [
                    'success' => '✓',
                    'error' => '✕',
                    'warning' => '⚠',
                    'info' => 'ℹ'
                ];
                $icon = $icons[$notification_type] ?? $icons['info'];
                $title = ucfirst($notification_type);
            ?>
                <div class="wt-notification <?php echo esc_attr($notification_type); ?> show" role="alert">
                    <div class="wt-notification-icon" aria-hidden="true"><?php echo $icon; ?></div>
                    <div class="wt-notification-content">
                        <div class="wt-notification-title"><?php echo esc_html($title); ?></div>
                        <div class="wt-notification-message"><?php echo esc_html(urldecode($notification_message)); ?></div>
                    </div>
                    <button class="wt-notification-close" onclick="this.parentElement.remove()" aria-label="Close notification">×</button>
                    <div class="wt-notification-progress"></div>
                </div>
            <?php endif; ?>
        </div>

        <form method="post" action="options.php">

            <?php

            $currentLangCode = "";
            if ( defined( 'ICL_LANGUAGE_CODE' ) ) {
                $currentLangCode = ICL_LANGUAGE_CODE;
            }


            settings_fields( 'theme_options' );
            $options     = get_option( 'play50_games_theme_options_' . $currentLangCode );
            $options_all = get_option( 'play50_games_theme_options_all' );

            $play50_games_logo           = $options_all['play50_games_logo'] ?? "";
            $play50_games_logo_active    = $options_all['play50_games_logo_active'] ?? "";

            $play50_games_logo_mobile    = $options_all['play50_games_logo_mobile'] ?? "";

            // header slider
            $play50_games_slider_background   = $options_all['play50_games_slider_background'] ?? "";

            // Top Head
            $mega_menu_title            = $options['mega_menu_title'] ?? "";
            $top_header_text            = $options['top_header_text'] ?? "";
            
            // footer

            $footer_title_1 = $options['footer_title_1'] ?? "";
            $footer_title_2 = $options['footer_title_2'] ?? "";
            $footer_title_3 = $options['footer_title_3'] ?? "";
            $footer_title_4 = $options['footer_title_4'] ?? "";

            $footer_address         = $options['footer_address'] ?? "";
            $footer_address_2       = $options['footer_address_2'] ?? "";
            $footer_address_2_link  = $options['footer_address_2_link'] ?? "";

            $footer_copyright_text          = $options['footer_copyright_text'] ?? "";
            $footer_copyright_text_2        = $options['footer_copyright_text_2'] ?? "";

            $footer_phone_number_title      = $options['footer_phone_number_title'] ?? "";
            $footer_phone_number            = $options['footer_phone_number'] ?? "";
            $footer_phone_number_link       = $options['footer_phone_number_link'] ?? "";


            $play50_games_footer_logo      =  $options_all['play50_games_footer_logo'] ?? "";
            $play50_games_footer_logo_2    =  $options_all['play50_games_footer_logo_2'] ?? "";
            $play50_games_footer_logo_3    =  $options_all['play50_games_footer_logo_3'] ?? "";
            
            $footer_apple_link         = $options_all['footer_apple_link'] ?? "";
            $footer_android_link       = $options_all['footer_android_link'] ?? "";
   

            // social link
            $social_title       = $options['social_title'] ?? "";
            $vimeo_link         = $options_all['vimeo_link'] ?? "";
            $linked_in_link     = $options_all['linkedin_link'] ?? "";
            $instagram_link     = $options_all['instagram_link'] ?? "";
            $youtube_link       = $options_all['youtube_link'] ?? "";
            $facebook_link      = $options_all['facebook_link'] ?? "";
	           
            //Other Settungs
            $other_title               = $options['other_title'] ?? "";

	        $button_login_in            = $options['button_login_in'] ?? "";
	        $button_registration        = $options['button_registration'] ?? "";
	        $button_login_in_link       = $options['button_login_in_link'] ?? "";
            $button_registration_link   = $options['button_registration_link'] ?? "";
            $search_link                = $options['search_link'] ?? "";
            
            ?>
            <br>
            <script src="https://unpkg.com/phosphor-icons"></script>

        <div class="wt-options-body">
            <div class="wt-options-container">
                <div class="wt-options-layout">
                    <aside class="wt-options-sidebar" role="complementary" aria-label="Theme Options Navigation">
                        <div class="wt-sidebar-header">
                            <div class="wt-sidebar-logo">
                                <i class="ph ph-gear-six"></i>
                        </div>
                            <h2 class="wt-sidebar-title">Theme Options</h2>
                        </div>
                        <nav class="wt-sidebar-nav" role="navigation" aria-label="Options Navigation">
                            <ul class="wt-nav-list" role="tablist">
                                <li class="wt-nav-item active" data-target="#general" role="tab" aria-selected="true" tabindex="0" aria-controls="general-panel">
                                    <i class="ph ph-house" aria-hidden="true"></i>
                                <span>General</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                                <li class="wt-nav-item" data-target="#design-settings" role="tab" aria-selected="false" tabindex="0" aria-controls="design-settings-panel">
                                    <i class="ph ph-palette" aria-hidden="true"></i>
                                <span>Design Settings</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                                <li class="wt-nav-item" data-target="#social-media" role="tab" aria-selected="false" tabindex="0" aria-controls="social-media-panel">
                                    <i class="ph ph-share-network" aria-hidden="true"></i>
                                <span>Social Media</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                                <li class="wt-nav-item" data-target="#other-setting" role="tab" aria-selected="false" tabindex="0" aria-controls="other-setting-panel">
                                <i class="ph ph-star" aria-hidden="true"></i>
                                <span>Other Settungs</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                                <li class="wt-nav-item" data-target="#footer" role="tab" aria-selected="false" tabindex="0" aria-controls="footer-panel">
                                    <i class="ph ph-layout" aria-hidden="true"></i>
                                <span>Footer</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                                <li class="wt-nav-item" data-target="#settings" role="tab" aria-selected="false" tabindex="0" aria-controls="settings-panel">
                                    <i class="ph ph-gear" aria-hidden="true"></i>
                                <span>Settings</span>
                                    <div class="wt-nav-indicator"></div>
                            </li>
                        </ul>
                    </nav>
                    </aside>
                    <main class="wt-options-main" role="main">
                        <div class="wt-tab-panels">
                            <section class="wt-tab-panel active" id="general" role="tabpanel" aria-labelledby="general-tab" aria-hidden="false">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-house"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title"><?php _e( 'General Settings', "play50games" ); ?></h1>
                                            <p class="wt-panel-description"><?php _e( 'Configure basic theme settings and branding', "play50games" ); ?></p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">

                                    <!-- Logo Upload Section -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="image_url_play50_games_logo">
                                            <i class="ph ph-image" aria-hidden="true"></i>
                                            <?php _e( 'Main Logo', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Upload your main website logo (recommended: 200x60px)', "play50games" ); ?></div>
                                        <div class="wt-upload-container">
                                            <input id="image_url_play50_games_logo" type="text" name="play50_games_theme_options_all[play50_games_logo]" value="<?php esc_attr_e( $play50_games_logo ); ?>" class="wt-hidden-input" />
                                            <div class="wt-upload-actions">
                                                <button id="upload_button_play50_games_logo" type="button" class="wt-btn wt-btn-primary">
                                                    <i class="ph ph-upload" aria-hidden="true"></i>
                                                    <?php _e( 'Upload Logo', "play50games" ); ?>
                                                </button>
                                                <button id="remove_button_play50_games_logo" type="button" class="wt-btn wt-btn-secondary">
                                                    <i class="ph ph-trash" aria-hidden="true"></i>
                                                    <?php _e( 'Remove', "play50games" ); ?>
                                                </button>
                                            </div>
                                            <div class="wt-image-preview">
                                                <img id="preview_image_play50_games_logo" src="<?php echo esc_url($play50_games_logo); ?>" alt="Logo Preview" class="wt-preview-image" <?php echo ($play50_games_logo === null || $play50_games_logo == '') ? 'style="display: none;"' : ''; ?>>
                                                <div class="wt-preview-placeholder" <?php echo ($play50_games_logo !== null && $play50_games_logo != '') ? 'style="display: none;"' : ''; ?>>
                                                    <i class="ph ph-image" aria-hidden="true"></i>
                                                    <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Active Logo Upload Section -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="image_url_play50_games_logo_active">
                                            <i class="ph ph-cursor-click" aria-hidden="true"></i>
                                            <?php _e( 'Active Logo', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Logo shown when menu is active or hovered (optional)', "play50games" ); ?></div>
                                        <div class="wt-upload-container">
                                            <input id="image_url_play50_games_logo_active" type="text" name="play50_games_theme_options_all[play50_games_logo_active]" value="<?php esc_attr_e( $play50_games_logo_active ); ?>" class="wt-hidden-input" />
                                            <div class="wt-upload-actions">
                                                <button id="upload_button_play50_games_logo_active" type="button" class="wt-btn wt-btn-primary">
                                                    <i class="ph ph-upload" aria-hidden="true"></i>
                                                    <?php _e( 'Upload Active Logo', "play50games" ); ?>
                                                </button>
                                                <button id="remove_button_play50_games_logo_active" type="button" class="wt-btn wt-btn-secondary">
                                                    <i class="ph ph-trash" aria-hidden="true"></i>
                                                    <?php _e( 'Remove', "play50games" ); ?>
                                                </button>
                                            </div>
                                            <div class="wt-image-preview">
                                                <img id="preview_image_play50_games_logo_active" src="<?php echo esc_url($play50_games_logo_active); ?>" alt="Active Logo Preview" class="wt-preview-image" <?php echo ($play50_games_logo_active === null || $play50_games_logo_active == '') ? 'style="display: none;"' : ''; ?>>
                                                <div class="wt-preview-placeholder" <?php echo ($play50_games_logo_active !== null && $play50_games_logo_active != '') ? 'style="display: none;"' : ''; ?>>
                                                    <i class="ph ph-image" aria-hidden="true"></i>
                                                    <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Mobile Logo Upload Section -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="image_url_play50_games_logo_mobile">
                                            <i class="ph ph-device-mobile" aria-hidden="true"></i>
                                            <?php _e( 'Mobile Logo', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Logo optimized for mobile devices (recommended: 150x45px)', "play50games" ); ?></div>
                                        <div class="wt-upload-container">
                                            <input id="image_url_play50_games_logo_mobile" type="text" name="play50_games_theme_options_all[play50_games_logo_mobile]" value="<?php esc_attr_e( $play50_games_logo_mobile ); ?>" class="wt-hidden-input" />
                                            <div class="wt-upload-actions">
                                                <button id="upload_button_play50_games_logo_mobile" type="button" class="wt-btn wt-btn-primary">
                                                    <i class="ph ph-upload" aria-hidden="true"></i>
                                                    <?php _e( 'Upload Mobile Logo', "play50games" ); ?>
                                                </button>
                                                <button id="remove_button_play50_games_logo_mobile" type="button" class="wt-btn wt-btn-secondary">
                                                    <i class="ph ph-trash" aria-hidden="true"></i>
                                                    <?php _e( 'Remove', "play50games" ); ?>
                                                </button>
                                            </div>
                                            <div class="wt-image-preview">
                                                <img id="preview_image_play50_games_logo_mobile" src="<?php echo esc_url($play50_games_logo_mobile); ?>" alt="Mobile Logo Preview" class="wt-preview-image" <?php echo ($play50_games_logo_mobile === null || $play50_games_logo_mobile == '') ? 'style="display: none;"' : ''; ?>>
                                                <div class="wt-preview-placeholder" <?php echo ($play50_games_logo_mobile !== null && $play50_games_logo_mobile != '') ? 'style="display: none;"' : ''; ?>>
                                                    <i class="ph ph-image" aria-hidden="true"></i>
                                                    <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>


                                    <!-- Slider Background Upload Section -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="image_url_play50_games_slider_background">
                                            <i class="ph ph-image-square" aria-hidden="true"></i>
                                            <?php _e( 'Header Slider Background', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Background image for the header slider (recommended: 1920x600px)', "play50games" ); ?></div>
                                        <div class="wt-upload-container">
                                            <input id="image_url_play50_games_slider_background" type="text" name="play50_games_theme_options_all[play50_games_slider_background]" value="<?php esc_attr_e( $play50_games_slider_background ); ?>" class="wt-hidden-input" />
                                            <div class="wt-upload-actions">
                                                <button id="upload_button_play50_games_slider_background" type="button" class="wt-btn wt-btn-primary">
                                                    <i class="ph ph-upload" aria-hidden="true"></i>
                                                    <?php _e( 'Upload Background', "play50games" ); ?>
                                                </button>
                                                <button id="remove_button_play50_games_slider_background" type="button" class="wt-btn wt-btn-secondary">
                                                    <i class="ph ph-trash" aria-hidden="true"></i>
                                                    <?php _e( 'Remove', "play50games" ); ?>
                                                </button>
                                            </div>
                                            <div class="wt-image-preview">
                                                <img id="preview_image_play50_games_slider_background" src="<?php echo esc_url($play50_games_slider_background); ?>" alt="Slider Background Preview" class="wt-preview-image" <?php echo ($play50_games_slider_background === null || $play50_games_slider_background == '') ? 'style="display: none;"' : ''; ?>>
                                                <div class="wt-preview-placeholder" <?php echo ($play50_games_slider_background !== null && $play50_games_slider_background != '') ? 'style="display: none;"' : ''; ?>>
                                                    <i class="ph ph-image" aria-hidden="true"></i>
                                                    <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Text Input Fields -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="top_header_text">
                                            <i class="ph ph-text-aa" aria-hidden="true"></i>
                                            <?php _e( 'Top Header Text', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Text displayed in the top header area', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="text"
                                               id="top_header_text"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[top_header_text]"
                                               value="<?php esc_attr_e( $top_header_text ); ?>"
                                               placeholder="<?php _e( 'Enter top header text...', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="mega_menu_title">
                                            <i class="ph ph-list" aria-hidden="true"></i>
                                            <?php _e( 'Mega Menu Title', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Title for the mega menu navigation', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="text"
                                               id="mega_menu_title"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[mega_menu_title]"
                                               value="<?php esc_attr_e( $mega_menu_title ); ?>"
                                               placeholder="<?php _e( 'Enter mega menu title...', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="button_login_in">
                                            <i class="ph ph-sign-in" aria-hidden="true"></i>
                                            <?php _e( 'Login Button Text', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Text displayed on the login button', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="text"
                                               id="button_login_in"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[button_login_in]"
                                               value="<?php esc_attr_e( $button_login_in ); ?>"
                                               placeholder="<?php _e( 'Enter login button text...', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="button_login_in_link">
                                            <i class="ph ph-link" aria-hidden="true"></i>
                                            <?php _e( 'Login Button Link', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'URL for the login button', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="url"
                                               id="button_login_in_link"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[button_login_in_link]"
                                               value="<?php esc_attr_e( $button_login_in_link ); ?>"
                                               placeholder="<?php _e( 'https://example.com/login', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="button_registration">
                                            <i class="ph ph-user-plus" aria-hidden="true"></i>
                                            <?php _e( 'Registration Button Text', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'Text displayed on the registration button', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="text"
                                               id="button_registration"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[button_registration]"
                                               value="<?php esc_attr_e( $button_registration ); ?>"
                                               placeholder="<?php _e( 'Enter registration button text...', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="button_registration_link">
                                            <i class="ph ph-link" aria-hidden="true"></i>
                                            <?php _e( 'Registration Button Link', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'URL for the registration button', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="url"
                                               id="button_registration_link"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[button_registration_link]"
                                               value="<?php esc_attr_e( $button_registration_link ); ?>"
                                               placeholder="<?php _e( 'https://example.com/register', 'play50games' ); ?>"
                                        />
                                    </div>

                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="search_link">
                                            <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
                                            <?php _e( 'Search Link', "play50games" ); ?>
                                        </label>
                                        <div class="wt-field-description"><?php _e( 'URL for the search functionality', "play50games" ); ?></div>
                                        <input class="wt-input-field"
                                               type="url"
                                               id="search_link"
                                               name="play50_games_theme_options_<?php echo $currentLangCode; ?>[search_link]"
                                               value="<?php esc_attr_e( $search_link ); ?>"
                                               placeholder="<?php _e( 'https://example.com/search', 'play50games' ); ?>"
                                        />
                                    </div>

                                </div>
                            </section>

                            <section class="wt-tab-panel" id="design-settings" role="tabpanel" aria-labelledby="design-settings-tab" aria-hidden="true">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-palette"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title">Design Settings</h1>
                                            <p class="wt-panel-description">Customize colors, typography, and visual appearance</p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">
                                    <!-- Colors Section -->
                                    <div class="wt-design-colors-section">
                                    <h2 class="wt-section-title">
                                        <i class="ph ph-palette" aria-hidden="true"></i>
                                        Theme Colors (Live Preview)
                                    </h2>
                                    <p class="wt-section-description">Customize your theme's color palette. Changes are applied instantly for preview.</p>
                                    
                                    <div class="wt-color-grid">
                                        <!-- Primary Colors -->
                                        <div class="wt-color-category">
                                            <div class="wt-category-header">
                                                <h3 class="wt-category-title">
                                                    <i class="ph ph-circle" aria-hidden="true"></i>
                                                    Primary Colors
                                                </h3>
                                                <p class="wt-category-description">Main brand colors used throughout the theme</p>
                                            </div>
                                            <div class="wt-color-items">
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="primary_color">
                                                        <span class="wt-color-name">Primary</span>
                                                        <span class="wt-color-value" id="primary_color_value"><?php echo get_option('primary_color', '#091057'); ?></span>
                                                    </label>
                                                    <input type="color" id="primary_color" value="<?php echo get_option('primary_color', '#091057'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="primary_dark">
                                                        <span class="wt-color-name">Primary Dark</span>
                                                        <span class="wt-color-value" id="primary_dark_value"><?php echo get_option('play50_games_primary_dark', '#05063F'); ?></span>
                                                    </label>
                                                    <input type="color" id="primary_dark" value="<?php echo get_option('play50_games_primary_dark', '#05063F'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="primary_hover">
                                                        <span class="wt-color-name">Primary Hover</span>
                                                        <span class="wt-color-value" id="primary_hover_value"><?php echo get_option('play50_games_primary_hover', '#1326A1'); ?></span>
                                                    </label>
                                                    <input type="color" id="primary_hover" value="<?php echo get_option('play50_games_primary_hover', '#1326A1'); ?>" class="wt-color-picker">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Secondary Colors -->
                                        <div class="wt-color-category">
                                            <div class="wt-category-header">
                                                <h3 class="wt-category-title">
                                                    <i class="ph ph-circle" aria-hidden="true"></i>
                                                    Secondary Colors
                                                </h3>
                                                <p class="wt-category-description">Accent colors for highlights and call-to-actions</p>
                                            </div>
                                            <div class="wt-color-items">
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="secondary_color">
                                                        <span class="wt-color-name">Secondary</span>
                                                        <span class="wt-color-value" id="secondary_color_value"><?php echo get_option('secondary_color', '#FF6900'); ?></span>
                                                    </label>
                                                    <input type="color" id="secondary_color" value="<?php echo get_option('secondary_color', '#FF6900'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="secondary_darker">
                                                        <span class="wt-color-name">Secondary Darker</span>
                                                        <span class="wt-color-value" id="secondary_darker_value"><?php echo get_option('play50_games_secondary_darker', '#CC4B02'); ?></span>
                                                    </label>
                                                    <input type="color" id="secondary_darker" value="<?php echo get_option('play50_games_secondary_darker', '#CC4B02'); ?>" class="wt-color-picker">
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Neutral Colors -->
                                        <div class="wt-color-category">
                                            <div class="wt-category-header">
                                                <h3 class="wt-category-title">
                                                    <i class="ph ph-circle" aria-hidden="true"></i>
                                                    Neutral Colors
                                                </h3>
                                                <p class="wt-category-description">Text and background colors for content</p>
                                            </div>
                                            <div class="wt-color-items">
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="black">
                                                        <span class="wt-color-name">Black</span>
                                                        <span class="wt-color-value" id="black_value"><?php echo get_option('play50_games_black', '#111111'); ?></span>
                                                    </label>
                                                    <input type="color" id="black" value="<?php echo get_option('play50_games_black', '#111111'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="white">
                                                        <span class="wt-color-name">White</span>
                                                        <span class="wt-color-value" id="white_value"><?php echo get_option('play50_games_white', '#ffffff'); ?></span>
                                                    </label>
                                                    <input type="color" id="white" value="<?php echo get_option('play50_games_white', '#ffffff'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="gray">
                                                        <span class="wt-color-name">Gray</span>
                                                        <span class="wt-color-value" id="gray_value"><?php echo get_option('play50_games_gray', '#737373'); ?></span>
                                                    </label>
                                                    <input type="color" id="gray" value="<?php echo get_option('play50_games_gray', '#737373'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="light_gray">
                                                        <span class="wt-color-name">Light Gray</span>
                                                        <span class="wt-color-value" id="light_gray_value"><?php echo get_option('play50_games_light_gray', '#F7F7F8'); ?></span>
                                                    </label>
                                                    <input type="color" id="light_gray" value="<?php echo get_option('play50_games_light_gray', '#F7F7F8'); ?>" class="wt-color-picker">
                                                </div>
                                            </div>
                                </div>

                                        <!-- Additional Colors -->
                                        <div class="wt-color-category">
                                            <div class="wt-category-header">
                                                <h3 class="wt-category-title">
                                                    <i class="ph ph-circle" aria-hidden="true"></i>
                                                    Additional Colors
                                                </h3>
                                                <p class="wt-category-description">Special colors for specific elements</p>
                                            </div>
                                            <div class="wt-color-items">
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="tertiary">
                                                        <span class="wt-color-name">Tertiary</span>
                                                        <span class="wt-color-value" id="tertiary_value"><?php echo get_option('play50_games_tertiary', '#0077FF'); ?></span>
                                                    </label>
                                                    <input type="color" id="tertiary" value="<?php echo get_option('play50_games_tertiary', '#0077FF'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="accent_color">
                                                        <span class="wt-color-name">Accent</span>
                                                        <span class="wt-color-value" id="accent_color_value"><?php echo get_option('accent_color', '#0077FF'); ?></span>
                                                    </label>
                                                    <input type="color" id="accent_color" value="<?php echo get_option('accent_color', '#0077FF'); ?>" class="wt-color-picker">
                                                </div>
                                                <div class="wt-color-item">
                                                    <label class="wt-color-label" for="background_color">
                                                        <span class="wt-color-name">Background</span>
                                                        <span class="wt-color-value" id="background_color_value"><?php echo get_option('background_color', '#ffffff'); ?></span>
                                                    </label>
                                                    <input type="color" id="background_color" value="<?php echo get_option('background_color', '#ffffff'); ?>" class="wt-color-picker">
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="wt-color-actions">
                                        <button class="wt-btn wt-btn-primary" id="save_colors_btn">
                                            <i class="ph ph-floppy-disk" aria-hidden="true"></i>
                                            Save Colors
                                        </button>
                                        <button type="button" class="wt-btn wt-btn-secondary" id="reset_colors_btn">
                                            <i class="ph ph-arrow-clockwise" aria-hidden="true"></i>
                                            Reset to Defaults
                                        </button>
                                    </div>
                                </div>

                                    <!-- Custom CSS Section -->
                                    <div class="wt-code-section">
                                        <div class="wt-section-header">
                                            <h2 class="wt-section-title">
                                                <i class="ph ph-code" aria-hidden="true"></i>
                                                Custom CSS
                                            </h2>
                                            <p class="wt-section-description">Add your custom CSS code to override theme styles</p>
                                        </div>
                                        
                                        <div class="wt-code-editor">
                                            <div class="wt-code-header">
                                                <span class="wt-code-label">styles.css</span>
                                                <div class="wt-code-actions">
                                                    <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" id="format_css_btn">
                                                        <i class="ph ph-brackets-curly" aria-hidden="true"></i>
                                                        Format
                                                    </button>
                                                    <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" id="clear_css_btn">
                                                        <i class="ph ph-trash" aria-hidden="true"></i>
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea id="custom_css" class="wt-code-textarea" placeholder="/* Add your custom CSS here */"><?php echo esc_textarea(get_option('custom_css', '')); ?></textarea>
                                        </div>
                                        
                                        <div class="wt-code-actions">
                                            <button type="button" class="wt-btn wt-btn-primary" id="save_css_btn">
                                                <i class="ph ph-floppy-disk" aria-hidden="true"></i>
                                                Save CSS
                                            </button>
                                            <button type="button" class="wt-btn wt-btn-secondary" id="download_css_btn">
                                                <i class="ph ph-download" aria-hidden="true"></i>
                                                Download CSS
                                            </button>
                                            <button type="button" class="wt-btn wt-btn-secondary" id="reset_css_btn">
                                                <i class="ph ph-arrow-clockwise" aria-hidden="true"></i>
                                                Reset CSS
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Custom JavaScript Section -->
                                    <div class="wt-code-section">
                                        <div class="wt-section-header">
                                            <h2 class="wt-section-title">
                                                <i class="ph ph-code" aria-hidden="true"></i>
                                                Custom JavaScript
                                            </h2>
                                            <p class="wt-section-description">Add your custom JavaScript code for enhanced functionality</p>
                                        </div>
                                        
                                        <div class="wt-code-editor">
                                            <div class="wt-code-header">
                                                <span class="wt-code-label">scripts.js</span>
                                                <div class="wt-code-actions">
                                                    <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" id="format_js_btn">
                                                        <i class="ph ph-brackets-curly" aria-hidden="true"></i>
                                                        Format
                                                    </button>
                                                    <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" id="clear_js_btn">
                                                        <i class="ph ph-trash" aria-hidden="true"></i>
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea id="custom_js" class="wt-code-textarea" placeholder="// Add your custom JavaScript here"><?php echo esc_textarea(get_option('custom_js', '')); ?></textarea>
                                        </div>
                                        
                                        <div class="wt-code-actions">
                                            <button type="button" class="wt-btn wt-btn-primary" id="save_js_btn">
                                                <i class="ph ph-floppy-disk" aria-hidden="true"></i>
                                                Save JS
                                            </button>
                                            <button type="button" class="wt-btn wt-btn-secondary" id="download_js_btn">
                                                <i class="ph ph-download" aria-hidden="true"></i>
                                                Download JS
                                            </button>
                                            <button type="button" class="wt-btn wt-btn-secondary" id="reset_js_btn">
                                                <i class="ph ph-arrow-clockwise" aria-hidden="true"></i>
                                                Reset JS
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section class="wt-tab-panel" id="social-media" role="tabpanel" aria-labelledby="social-media-tab" aria-hidden="true">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-share-network"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title">Social Media Settings</h1>
                                            <p class="wt-panel-description">Configure your social media links and profiles</p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">
                                    <!-- Social Media Title Section -->
                                    <div class="wt-field-group">
                                        <label class="wt-field-label" for="social_title">
                                            <i class="ph ph-text-aa" aria-hidden="true"></i>
                                            Social Media Section Title
                                        </label>
                                        <p class="wt-field-description">Enter the title for your social media section</p>
                                        <input id="social_title" class="wt-input-field" type="text" name="play50_games_theme_options_<?php echo $currentLangCode; ?>[social_title]" value="<?php esc_attr_e( $social_title ); ?>" placeholder="Follow Us">
                                    </div>

                                    <!-- Social Media Links Grid -->
                                    <div class="wt-social-grid">
                                        <!-- Facebook -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon facebook">
                                                    <i class="ph ph-facebook-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">Facebook</h3>
                                                    <p class="wt-social-description">Connect with us on Facebook</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[facebook_link]" value="<?php esc_attr_e( $facebook_link ); ?>" placeholder="https://facebook.com/yourpage">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('facebook')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Instagram -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon instagram">
                                                    <i class="ph ph-instagram-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">Instagram</h3>
                                                    <p class="wt-social-description">Follow us on Instagram</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[instagram_link]" value="<?php esc_attr_e( $instagram_link ); ?>" placeholder="https://instagram.com/yourpage">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('instagram')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- YouTube -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon youtube">
                                                    <i class="ph ph-youtube-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">YouTube</h3>
                                                    <p class="wt-social-description">Subscribe to our channel</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[youtube_link]" value="<?php esc_attr_e( $youtube_link ); ?>" placeholder="https://youtube.com/@yourchannel">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('youtube')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- LinkedIn -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon linkedin">
                                                    <i class="ph ph-linkedin-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">LinkedIn</h3>
                                                    <p class="wt-social-description">Connect professionally</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[linkedin_link]" value="<?php esc_attr_e( $linked_in_link ); ?>" placeholder="https://linkedin.com/company/yourcompany">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('linkedin')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Twitter/X -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon twitter">
                                                    <i class="ph ph-twitter-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">Twitter/X</h3>
                                                    <p class="wt-social-description">Follow us on Twitter</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[twitter_link]" value="<?php esc_attr_e( get_option('twitter_link', '') ); ?>" placeholder="https://twitter.com/yourhandle">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('twitter')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- TikTok -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon tiktok">
                                                    <i class="ph ph-tiktok-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">TikTok</h3>
                                                    <p class="wt-social-description">Follow us on TikTok</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[tiktok_link]" value="<?php esc_attr_e( get_option('tiktok_link', '') ); ?>" placeholder="https://tiktok.com/@yourhandle">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('tiktok')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Vimeo -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon vimeo">
                                                    <i class="ph ph-vimeo-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">Vimeo</h3>
                                                    <p class="wt-social-description">Watch our videos</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[vimeo_link]" value="<?php esc_attr_e( $vimeo_link ); ?>" placeholder="https://vimeo.com/yourchannel">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('vimeo')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>

                                        <!-- Pinterest -->
                                        <div class="wt-social-item">
                                            <div class="wt-social-header">
                                                <div class="wt-social-icon pinterest">
                                                    <i class="ph ph-pinterest-logo" aria-hidden="true"></i>
                                                </div>
                                                <div class="wt-social-info">
                                                    <h3 class="wt-social-name">Pinterest</h3>
                                                    <p class="wt-social-description">Pin with us</p>
                                                </div>
                                            </div>
                                            <div class="wt-social-input">
                                                <input class="wt-input-field" type="url" name="play50_games_theme_options_all[pinterest_link]" value="<?php esc_attr_e( get_option('pinterest_link', '') ); ?>" placeholder="https://pinterest.com/yourprofile">
                                                <button type="button" class="wt-btn wt-btn-secondary wt-btn-sm" onclick="testSocialLink('pinterest')">
                                                    <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                                                    Test
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Social Media Actions -->
                                    <div class="wt-social-actions">
                                        <button type="button" class="wt-btn wt-btn-primary" id="test_all_social_btn">
                                            <i class="ph ph-check-circle" aria-hidden="true"></i>
                                            Test All Links
                                        </button>
                                        <button type="button" class="wt-btn wt-btn-secondary" id="clear_all_social_btn">
                                            <i class="ph ph-trash" aria-hidden="true"></i>
                                            Clear All Links
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section class="wt-tab-panel" id="other-setting" role="tabpanel" aria-labelledby="other-setting-tab" aria-hidden="true">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-star"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title">Other Settings</h1>
                                            <p class="wt-panel-description">Configure Other Settings</p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">
                                    <p>Titel</p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[other_title]"
                                           value="<?php esc_attr_e( $other_title ); ?>"/>
                                </div>





                                
                            </section>

                            <section class="wt-tab-panel" id="footer" role="tabpanel" aria-labelledby="footer-tab" aria-hidden="true">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-layout"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title">Footer Settings</h1>
                                            <p class="wt-panel-description">Configure footer content, links, and branding</p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">
                                <hr>
                                <!--Footer Logo -->
                                <div class="wt-field-group">
                                    <label class="wt-field-label" for="image_url_play50_games_footer_logo">
                                        <i class="ph ph-image" aria-hidden="true"></i>
                                        <?php _e( 'Footer Logo', "play50games" ); ?>
                                    </label>
                                    <p class="wt-field-description">Upload your footer logo image</p>
                                    
                                    <input id="image_url_play50_games_footer_logo" type="text" name="play50_games_theme_options_all[play50_games_footer_logo]" value="<?php esc_attr_e( $play50_games_footer_logo ); ?>" class="wt-hidden-input" />
                                    <div class="wt-upload-actions">
                                        <button id="upload_button_play50_games_footer_logo" type="button" class="wt-btn wt-btn-primary">
                                            <i class="ph ph-upload" aria-hidden="true"></i>
                                            <?php _e( 'Upload Logo', "play50games" ); ?>
                                        </button>
                                        <button id="remove_button_play50_games_footer_logo" type="button" class="wt-btn wt-btn-secondary">
                                            <i class="ph ph-trash" aria-hidden="true"></i>
                                            <?php _e( 'Remove', "play50games" ); ?>
                                        </button>
                                    </div>
                                    <div class="wt-image-preview">
                                        <img id="preview_image_play50_games_footer_logo" src="<?php echo esc_url($play50_games_footer_logo); ?>" alt="Footer Logo Preview" class="wt-preview-image" <?php echo ($play50_games_footer_logo === null || $play50_games_footer_logo == '') ? 'style="display: none;"' : ''; ?>>
                                        <div class="wt-preview-placeholder" <?php echo ($play50_games_footer_logo !== null && $play50_games_footer_logo != '') ? 'style="display: none;"' : ''; ?>>
                                            <i class="ph ph-image" aria-hidden="true"></i>
                                            <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                        </div>
                                    </div>
                                </div>

                                <hr/>
                                

                                <p><?php _e( 'Footer Android Link', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_all[footer_android_link]"
                                           value="<?php esc_attr_e( $footer_android_link ); ?>"
                                    />
                                </div>


                                <!--Footer Android Logo -->
                                <div class="wt-field-group">
                                    <label class="wt-field-label" for="image_url_play50_games_footer_logo_2">
                                        <i class="ph ph-android-logo" aria-hidden="true"></i>
                                        <?php _e( 'Footer Android Logo', "play50games" ); ?>
                                    </label>
                                    <p class="wt-field-description">Upload your Android app logo for the footer</p>
                                    
                                    <input id="image_url_play50_games_footer_logo_2" type="text" name="play50_games_theme_options_all[play50_games_footer_logo_2]" value="<?php esc_attr_e( $play50_games_footer_logo_2 ); ?>" class="wt-hidden-input" />
                                    <div class="wt-upload-actions">
                                        <button id="upload_button_play50_games_footer_logo_2" type="button" class="wt-btn wt-btn-primary">
                                            <i class="ph ph-upload" aria-hidden="true"></i>
                                            <?php _e( 'Upload Logo', "play50games" ); ?>
                                        </button>
                                        <button id="remove_button_play50_games_footer_logo_2" type="button" class="wt-btn wt-btn-secondary">
                                            <i class="ph ph-trash" aria-hidden="true"></i>
                                            <?php _e( 'Remove', "play50games" ); ?>
                                        </button>
                                    </div>
                                    <div class="wt-image-preview">
                                        <img id="preview_image_play50_games_footer_logo_2" src="<?php echo esc_url($play50_games_footer_logo_2); ?>" alt="Footer Android Logo Preview" class="wt-preview-image" <?php echo ($play50_games_footer_logo_2 === null || $play50_games_footer_logo_2 == '') ? 'style="display: none;"' : ''; ?>>
                                        <div class="wt-preview-placeholder" <?php echo ($play50_games_footer_logo_2 !== null && $play50_games_footer_logo_2 != '') ? 'style="display: none;"' : ''; ?>>
                                            <i class="ph ph-android-logo" aria-hidden="true"></i>
                                            <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                        </div>
                                    </div>
                                </div>

                                <hr/>
                                <p><?php _e( 'Footer Apple Link', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_all[footer_apple_link]"
                                           value="<?php esc_attr_e( $footer_apple_link ); ?>"
                                    />
                                </div>

                                <!--Footer Apple Logo -->
                                <div class="wt-field-group">
                                    <label class="wt-field-label" for="image_url_play50_games_footer_logo_3">
                                        <i class="ph ph-apple-logo" aria-hidden="true"></i>
                                        <?php _e( 'Footer Apple Logo', "play50games" ); ?>
                                    </label>
                                    <p class="wt-field-description">Upload your Apple app logo for the footer</p>
                                    
                                    <input id="image_url_play50_games_footer_logo_3" type="text" name="play50_games_theme_options_all[play50_games_footer_logo_3]" value="<?php esc_attr_e( $play50_games_footer_logo_3 ); ?>" class="wt-hidden-input" />
                                    <div class="wt-upload-actions">
                                        <button id="upload_button_play50_games_footer_logo_3" type="button" class="wt-btn wt-btn-primary">
                                            <i class="ph ph-upload" aria-hidden="true"></i>
                                            <?php _e( 'Upload Logo', "play50games" ); ?>
                                        </button>
                                        <button id="remove_button_play50_games_footer_logo_3" type="button" class="wt-btn wt-btn-secondary">
                                            <i class="ph ph-trash" aria-hidden="true"></i>
                                            <?php _e( 'Remove', "play50games" ); ?>
                                        </button>
                                    </div>
                                    <div class="wt-image-preview">
                                        <img id="preview_image_play50_games_footer_logo_3" src="<?php echo esc_url($play50_games_footer_logo_3); ?>" alt="Footer Apple Logo Preview" class="wt-preview-image" <?php echo ($play50_games_footer_logo_3 === null || $play50_games_footer_logo_3 == '') ? 'style="display: none;"' : ''; ?>>
                                        <div class="wt-preview-placeholder" <?php echo ($play50_games_footer_logo_3 !== null && $play50_games_footer_logo_3 != '') ? 'style="display: none;"' : ''; ?>>
                                            <i class="ph ph-apple-logo" aria-hidden="true"></i>
                                            <span><?php _e( 'No image selected', "play50games" ); ?></span>
                                        </div>
                                    </div>
                                </div>

                            <hr/>
                                <p><?php _e( 'Footer Titel 1', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_title_1]"
                                           value="<?php esc_attr_e( $footer_title_1 ); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Footer Titel 2', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_title_2]"
                                           value="<?php esc_attr_e( $footer_title_2 ); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Footer Titel 3', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_title_3]"
                                           value="<?php esc_attr_e( $footer_title_3 ); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Footer Titel 4', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_title_4]"
                                           value="<?php esc_attr_e( $footer_title_4 ); ?>"
                                    />
                                </div>

                                <hr/>
                                <p><?php _e( 'Address', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_address]"
                                           value="<?php esc_attr_e( $footer_address); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Address 2', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_address_2]"
                                           value="<?php esc_attr_e( $footer_address_2); ?>"
                                    />
                                </div>
                                
                                
                                
                                <p><?php _e( 'Footer Address Link', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_address_2_link]"
                                           value="<?php esc_attr_e( $footer_address_2_link ); ?>"
                                    />


                                </div>

                                <hr/>
                                <p><?php _e( 'Copyright Text', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_copyright_text]"
                                           value="<?php esc_attr_e( $footer_copyright_text); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Copyright Text 2', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_copyright_text_2]"
                                           value="<?php esc_attr_e( $footer_copyright_text_2); ?>"
                                    />
                                </div>
                                <hr/>

                                <p><?php _e( 'Phone number title', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_phone_number_title]"
                                           value="<?php esc_attr_e( $footer_phone_number_title ); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Telefonnummer', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_phone_number]"
                                           value="<?php esc_attr_e( $footer_phone_number ); ?>"
                                    />
                                </div>

                                <p><?php _e( 'Telefonnummer Link', "play50games" ); ?></p>
                                <div>
                                    <input class="wt-option-fields"
                                           type="text"
                                           name="play50_games_theme_options_<?php echo $currentLangCode; ?>[footer_phone_number_link]"
                                           value="<?php esc_attr_e( $footer_phone_number_link ); ?>"
                                    />
                                </div>

<!--                                <p>--><?php //_e( 'Copyright', "play50games" ); ?><!--</p>-->
<!--                                <div>-->
<!--                                    --><?php //echo getWpEditor($copyright, "play50_games_theme_options_lang_copyright", "play50_games_theme_options_" . $currentLangCode . "[copyright]") ?>
<!--                                </div>-->

                                <hr>
                            </section>

                            <section class="wt-tab-panel" id="settings" role="tabpanel" aria-labelledby="settings-tab" aria-hidden="true">
                                <header class="wt-panel-header">
                                    <div class="wt-panel-header-content">
                                        <div class="wt-panel-icon">
                                            <i class="ph ph-gear"></i>
                                        </div>
                                        <div class="wt-panel-title-group">
                                            <h1 class="wt-panel-title">Additional Settings</h1>
                                            <p class="wt-panel-description">Advanced configuration and additional options</p>
                                        </div>
                                    </div>
                                </header>
                                <div class="wt-panel-content">
                                    <div class="wt-field-group">
                                        <div class="wt-info-card">
                                            <i class="ph ph-info" aria-hidden="true"></i>
                                            <div class="wt-info-content">
                                                <h3>Coming Soon</h3>
                                                <p>Additional settings and advanced configuration options will be available in future updates.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </main>
                </div>
            </div>

            <!-- Modern Submit Section -->
            <footer class="wt-options-footer">
                <div class="wt-footer-content">
                    <div class="wt-footer-info">
                        <i class="ph ph-info" aria-hidden="true"></i>
                        <span>Don't forget to save your changes</span>
                    </div>
                    
                    <div class="wt-footer-actions">
                        <button
                                type="button"
                                class="wt-btn wt-btn-secondary"
                                id="preview-changes"
                                onclick="window.open('<?php echo esc_url( home_url() ); ?>', '_blank');"
                        >
                            <i class="ph ph-eye" aria-hidden="true"></i>
                            Preview Changes
                        </button>

                        <button type="submit" class="wt-btn wt-btn-primary wt-btn-save">
                            <i class="ph ph-floppy-disk" aria-hidden="true"></i>
                            <?php _e( 'Save Settings', "play50games" ); ?>
                        </button>
                </div>
                </div>
            </footer>
            </div>
        </form>
    </div>
    <script>
        jQuery(document).ready(function($) {

            // Modern Notification System
            function show_notification(type, title, message, duration = 5000) {
                const container = document.getElementById('wt-notification-container');
                const notification = document.createElement('div');
                notification.className = `wt-notification ${type}`;
                
                const icons = {
                    success: '✓',
                    error: '✕',
                    warning: '⚠',
                    info: 'ℹ'
                };
                
                notification.innerHTML = `
                    <div class="wt-notification-icon">${icons[type] || icons.info}</div>
                    <div class="wt-notification-content">
                        <div class="wt-notification-title">${title}</div>
                        <div class="wt-notification-message">${message}</div>
                    </div>
                    <button class="wt-notification-close" onclick="this.parentElement.remove()">×</button>
                `;
                
                container.appendChild(notification);
                
                // Trigger animation
                setTimeout(() => notification.classList.add('show'), 100);
                
                // Auto remove after duration
                if (duration > 0) {
                    setTimeout(() => {
                        notification.classList.remove('show');
                        setTimeout(() => notification.remove(), 300);
                    }, duration);
                }
            }

            // Handle existing notifications on page load
            function init_existing_notifications() {
                const existing_notifications = document.querySelectorAll('.wt-notification.show');
                existing_notifications.forEach(notification => {
                    const duration = 5000; // 5 seconds for PHP-generated notifications
                    const progress_bar = notification.querySelector('.wt-notification-progress');
                    
                    if (progress_bar) {
                        progress_bar.style.width = '100%';
                        progress_bar.style.transition = `width ${duration}ms linear`;
                        
                        setTimeout(() => {
                            notification.classList.remove('show');
                            setTimeout(() => notification.remove(), 300);
                        }, duration);
                    }
                });
            }

            // Initialize existing notifications
            init_existing_notifications();

            // Modern tab navigation
            function init_tab_navigation() {
                const all_indicator = document.querySelectorAll('.wt-nav-item');
                const all_content = document.querySelectorAll('.wt-tab-panel');

                all_indicator.forEach(item => {
                    item.addEventListener('click', function () {
                        const target_id = this.dataset.target;
                        const content = document.querySelector(target_id);

                        // Update ARIA attributes
                        all_indicator.forEach(i => {
                            i.classList.remove('active');
                            i.setAttribute('aria-selected', 'false');
                        });

                        all_content.forEach(i => {
                            i.classList.remove('active');
                            i.setAttribute('aria-hidden', 'true');
                        });

                        // Activate current tab
                        this.classList.add('active');
                        this.setAttribute('aria-selected', 'true');
                        content.classList.add('active');
                        content.setAttribute('aria-hidden', 'false');
                    });

                    // Keyboard navigation
                    item.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.click();
                        }
                    });
                });
            }

            // Initialize tab navigation
            init_tab_navigation();


            // Hochladen
            $('#upload_button_play50_games_logo, #upload_button_play50_games_logo_active, #upload_button_play50_games_logo_mobile, #upload_button_play50_games_footer_logo, #upload_button_play50_games_footer_logo_2,  #upload_button_play50_games_footer_logo_3, #upload_button_play50_games_slider_background').on('click', function(e) {
                e.preventDefault();

                // get the name of the current clicked button id (without 'upload_button_' prefix)
                var option_name = this.id.replace('upload_button_', '');

                var image = wp.media({
                    title: 'Hochladen Image',
                    multiple: false
                }).open().on('select', function(e) {
                    var uploaded_image = image.state().get('selection').first();
                    var full_image_url = uploaded_image.toJSON().url;

                    // Create a URL object
                    var url_path = new URL(full_image_url);

                    // Get the pathname (the part of the URL after the domain)
                    var image_url = url_path.pathname;

                    $('#image_url_' + option_name).val(image_url);
                    
                    // Handle modern image previews (with placeholders)
                    var $previewImage = $('#preview_image_' + option_name);
                    var $placeholder = $previewImage.siblings('.wt-preview-placeholder');
                    
                    console.log('Uploading image for:', option_name);
                    console.log('Preview image found:', $previewImage.length);
                    console.log('Placeholder found:', $placeholder.length);
                    
                    if ($placeholder.length > 0) {
                        // Modern preview with placeholder
                        $previewImage.attr('src', full_image_url).show();
                        $placeholder.hide();
                        console.log('Modern preview updated');
                    } else {
                        // Old style preview (footer logos)
                        $previewImage.attr('src', full_image_url);
                        console.log('Legacy preview updated');
                    }
                    
                    show_notification('success', 'Image Uploaded', 'Image has been successfully uploaded and preview updated.');
                });
            });

            // Entfernen
            $('#remove_button_play50_games_logo, #remove_button_play50_games_logo_active, #remove_button_play50_games_logo_mobile, #remove_button_play50_games_footer_logo, #remove_button_play50_games_footer_logo_2,  #remove_button_play50_games_footer_logo_3,  #remove_button_play50_games_slider_background').on('click', function(e) {
                e.preventDefault();

                // get the name of the current clicked button id (without 'remove_button_' prefix)
                var option_name = this.id.replace('remove_button_', '');

                // Clear the input field
                $('#image_url_' + option_name).val('');
                
                // Handle modern image previews (with placeholders)
                var $previewImage = $('#preview_image_' + option_name);
                var $placeholder = $previewImage.siblings('.wt-preview-placeholder');
                
                if ($placeholder.length > 0) {
                    // Modern preview with placeholder
                    $previewImage.attr('src', '').hide();
                    $placeholder.show();
                } else {
                    // Old style preview (footer logos)
                    $previewImage.attr('src', '');
                }
                
                // Show success notification
                show_notification('success', 'Image Removed', 'Image has been removed from the preview. Save the settings to permanently remove it.');
            });

            // DESIGN SETTINGS LOGIC
            $('#save_colors_btn').on('click', function() {
                const colors = {
                    action: 'save_design_colors',
                    _wpnonce: '<?php echo wp_create_nonce('save_design_colors'); ?>',
                    primary_color: $('#primary_color').val(),
                    primary_dark: $('#primary_dark').val(),
                    primary_hover: $('#primary_hover').val(),
                    secondary_color: $('#secondary_color').val(),
                    secondary_darker: $('#secondary_darker').val(),
                    black: $('#black').val(),
                    white: $('#white').val(),
                    gray: $('#gray').val(),
                    light_gray: $('#light_gray').val(),
                    tertiary: $('#tertiary').val(),
                    accent_color: $('#accent_color').val(),
                    background_color: $('#background_color').val(),
                };
                $.post(wtAjax.ajaxurl, colors, function() {
                    show_notification('success', 'Colors Saved', 'Theme colors have been saved and applied successfully!', 3000);
                    setTimeout(() => location.reload(), 2000);
                }).fail(function() {
                    show_notification('error', 'Save Failed', 'There was an error saving the colors. Please try again.');
                });
            });

            $('#save_css_btn').on('click', function() {
                const css = { 
                    action: 'save_custom_css', 
                    _wpnonce: '<?php echo wp_create_nonce('save_custom_css'); ?>',
                    css: $('#custom_css').val() 
                };
                $.post(wtAjax.ajaxurl, css, function() {
                    show_notification('success', 'CSS Saved', 'Custom CSS has been saved successfully!');
                }).fail(function() {
                    show_notification('error', 'Save Failed', 'There was an error saving the CSS. Please try again.');
                });
            });

            $('#save_js_btn').on('click', function() {
                const js = { 
                    action: 'save_custom_js', 
                    _wpnonce: '<?php echo wp_create_nonce('save_custom_js'); ?>',
                    js: $('#custom_js').val() 
                };
                $.post(wtAjax.ajaxurl, js, function() {
                    show_notification('success', 'JavaScript Saved', 'Custom JavaScript has been saved successfully!');
                }).fail(function() {
                    show_notification('error', 'Save Failed', 'There was an error saving the JavaScript. Please try again.');
                });
            });

            // CSS and JS functionality
            $('#format_css_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const css = $('#custom_css').val();
                if (css.trim()) {
                    // Simple CSS formatting (basic indentation)
                    const formatted = css
                        .replace(/\{/g, ' {\n    ')
                        .replace(/\}/g, '\n}\n')
                        .replace(/;/g, ';\n    ')
                        .replace(/,\s*/g, ',\n    ');
                    $('#custom_css').val(formatted);
                    show_notification('success', 'CSS Formatted', 'CSS code has been formatted!');
                }
            });

            $('#format_js_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const js = $('#custom_js').val();
                if (js.trim()) {
                    // Simple JS formatting (basic indentation)
                    const formatted = js
                        .replace(/\{/g, ' {\n    ')
                        .replace(/\}/g, '\n}\n')
                        .replace(/;/g, ';\n    ')
                        .replace(/,\s*/g, ',\n    ');
                    $('#custom_js').val(formatted);
                    show_notification('success', 'JS Formatted', 'JavaScript code has been formatted!');
                }
            });

            $('#clear_css_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to clear all CSS code?')) {
                    $('#custom_css').val('');
                    show_notification('info', 'CSS Cleared', 'CSS code has been cleared!');
                }
            });

            $('#clear_js_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to clear all JavaScript code?')) {
                    $('#custom_js').val('');
                    show_notification('info', 'JS Cleared', 'JavaScript code has been cleared!');
                }
            });

            // Reset CSS
            $('#reset_css_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to reset CSS to default?')) {
                    $('#custom_css').val('');
                    show_notification('success', 'CSS Reset', 'CSS has been reset to default!');
                }
            });

            // Reset JS
            $('#reset_js_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('Are you sure you want to reset JavaScript to default?')) {
                    $('#custom_js').val('');
                    show_notification('success', 'JS Reset', 'JavaScript has been reset to default!');
                }
            });

            // Legacy reset button (for backward compatibility)
            $('#reset_design_btn').on('click', function() {
                if (confirm('Are you sure you want to reset all design settings?')) {
                    $.post(wtAjax.ajaxurl, { 
                        action: 'reset_design_defaults',
                        _wpnonce: '<?php echo wp_create_nonce('reset_design_defaults'); ?>'
                    }, function() {
                        show_notification('success', 'Reset Complete', 'All design settings have been reset to defaults!', 3000);
                        setTimeout(() => location.reload(), 2000);
                    }).fail(function() {
                        show_notification('error', 'Reset Failed', 'There was an error resetting the settings. Please try again.');
                    });
                }
            });

            // Social Media Functions
            window.testSocialLink = function(platform) {
                const input = document.querySelector(`input[name*="${platform}_link"]`);
                const url = input.value.trim();
                
                if (!url) {
                    show_notification('warning', 'No URL', `Please enter a ${platform} URL first.`);
                    return;
                }
                
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    show_notification('warning', 'Invalid URL', 'Please enter a complete URL starting with http:// or https://');
                    return;
                }
                
                // Open in new tab
                window.open(url, '_blank');
                show_notification('success', 'Link Opened', `${platform} link opened in new tab.`);
            };

            // Test All Social Links
            $('#test_all_social_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const social_inputs = document.querySelectorAll('input[name*="_link"]');
                let valid_links = 0;
                let total_links = 0;
                
                social_inputs.forEach(input => {
                    const url = input.value.trim();
                    if (url) {
                        total_links++;
                        if (url.startsWith('http://') || url.startsWith('https://')) {
                            valid_links++;
                        }
                    }
                });
                
                if (total_links === 0) {
                    show_notification('info', 'No Links', 'No social media links have been entered yet.');
                    return;
                }
                
                if (valid_links === total_links) {
                    show_notification('success', 'All Links Valid', `All ${valid_links} social media links are valid and ready to test!`);
                } else {
                    show_notification('warning', 'Some Links Invalid', `${valid_links} of ${total_links} links are valid. Please check the invalid ones.`);
                }
            });

            // Clear All Social Links
            $('#clear_all_social_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (confirm('Are you sure you want to clear all social media links?')) {
                    const social_inputs = document.querySelectorAll('input[name*="_link"]');
                    social_inputs.forEach(input => {
                        input.value = '';
                    });
                    show_notification('success', 'Links Cleared', 'All social media links have been cleared.');
                }
            });

            $('#download_css_btn').on('click', function() {
                show_notification('info', 'Download Started', 'Your custom CSS file download has started.');
                window.location.href = wtAjax.ajaxurl + '?action=download_custom_css';
            });

            $('#download_js_btn').on('click', function() {
                show_notification('info', 'Download Started', 'Your custom JavaScript file download has started.');
                window.location.href = wtAjax.ajaxurl + '?action=download_custom_js';
            });

            // Live preview for color change with value updates
            $('.wt-color-picker').on('input', function() {
                const color_value = $(this).val();
                const color_id = $(this).attr('id');
                const value_element = $('#' + color_id + '_value');
                
                // Update the displayed color value
                if (value_element.length) {
                    value_element.text(color_value);
                }
                
                // Update play50games colors
                document.documentElement.style.setProperty('--play50games-primary', $('#primary_color').val());
                document.documentElement.style.setProperty('--play50games-primary-dark', $('#primary_dark').val());
                document.documentElement.style.setProperty('--play50games-primary-hover', $('#primary_hover').val());
                document.documentElement.style.setProperty('--play50games-secondary', $('#secondary_color').val());
                document.documentElement.style.setProperty('--play50games-secondary-darker', $('#secondary_darker').val());
                document.documentElement.style.setProperty('--play50games-black', $('#black').val());
                document.documentElement.style.setProperty('--play50games-white', $('#white').val());
                document.documentElement.style.setProperty('--play50games-gray', $('#gray').val());
                document.documentElement.style.setProperty('--play50games-light-gray', $('#light_gray').val());
                document.documentElement.style.setProperty('--play50games-tertiary', $('#tertiary').val());
                
                // Update legacy colors
                document.documentElement.style.setProperty('--primary-color', $('#primary_color').val());
                document.documentElement.style.setProperty('--secondary-color', $('#secondary_color').val());
                document.documentElement.style.setProperty('--accent-color', $('#accent_color').val());
                document.documentElement.style.setProperty('--background-color', $('#background_color').val());
                
                // Update gradient
                document.documentElement.style.setProperty('--play50games-gradient-90', 
                    `linear-gradient(0deg, ${$('#primary_hover').val()} 0%, ${$('#primary_dark').val()} 50%, ${$('#primary_color').val()} 100%)`);
            });

            // Reset colors button
            $('#reset_colors_btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (confirm('Are you sure you want to reset all colors to their default values?')) {
                    // Reset to default values
                    $('#primary_color').val('#091057');
                    $('#primary_dark').val('#05063F');
                    $('#primary_hover').val('#1326A1');
                    $('#secondary_color').val('#FF6900');
                    $('#secondary_darker').val('#CC4B02');
                    $('#black').val('#111111');
                    $('#white').val('#ffffff');
                    $('#gray').val('#737373');
                    $('#light_gray').val('#F7F7F8');
                    $('#tertiary').val('#0077FF');
                    $('#accent_color').val('#0077FF');
                    $('#background_color').val('#ffffff');
                    
                    // Update displayed values
                    $('.wt-color-picker').each(function() {
                        const color_id = $(this).attr('id');
                        const value_element = $('#' + color_id + '_value');
                        if (value_element.length) {
                            value_element.text($(this).val());
                        }
                    });
                    
                    // Trigger live preview update
                    $('.wt-color-picker').trigger('input');
                    
                    show_notification('success', 'Colors Reset', 'All colors have been reset to their default values!');
                }
            });

        });
    </script>

    <?php
}