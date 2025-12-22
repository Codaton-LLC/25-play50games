<?php

// manage columns for cpt accordion
function manage_columns_for_accordion($columns)
{
    //remove columns
    unset($columns['title']);
    unset($columns['categories']);
    unset($columns['tags']);
    unset($columns['date']);
    unset($columns['comments']);
    unset($columns['author']);

    //add new columns
    $columns['title'] = 'Title';
    $columns['tab_shortcode'] = 'Shortcode';
    $columns['date'] = 'Date';

    return $columns;
}

add_action('manage_accordion_posts_columns', 'manage_columns_for_accordion');

function cpt_accordion_column_content_tab_shortcode($column, $post_id)
{

    //post content column
    if ($column == 'tab_shortcode') {
        $post = get_post($post_id);

        if ($post) {
            $value = "<div>" . "accordion-code-" . $post->ID . "</div>";

            echo $value;
        }
    }
}
add_action('manage_accordion_posts_custom_column', 'cpt_accordion_column_content_tab_shortcode', 10, 2);

/* end of columns for cpt accordion */


/* Initialize default colors if they don't exist */
function initialize_default_colors() {
    // Set default colors if they don't exist
    if (!get_option('primary_color')) {
        update_option('primary_color', '#091057');
    }
    if (!get_option('secondary_color')) {
        update_option('secondary_color', '#FF6900');
    }
    if (!get_option('accent_color')) {
        update_option('accent_color', '#0077FF');
    }
    if (!get_option('background_color')) {
        update_option('background_color', '#ffffff');
    }
    if (!get_option('play50_games_primary_dark')) {
        update_option('play50_games_primary_dark', '#05063F');
    }
    if (!get_option('play50_games_primary_hover')) {
        update_option('play50_games_primary_hover', '#1326A1');
    }
    if (!get_option('play50_games_secondary_darker')) {
        update_option('play50_games_secondary_darker', '#CC4B02');
    }
    if (!get_option('play50_games_black')) {
        update_option('play50_games_black', '#111111');
    }
    if (!get_option('play50_games_white')) {
        update_option('play50_games_white', '#ffffff');
    }
    if (!get_option('play50_games_gray')) {
        update_option('play50_games_gray', '#737373');
    }
    if (!get_option('play50_games_light_gray')) {
        update_option('play50_games_light_gray', '#F7F7F8');
    }
    if (!get_option('play50_games_tertiary')) {
        update_option('play50_games_tertiary', '#0077FF');
    }
}
add_action('init', 'initialize_default_colors');

/* Design settings in theme options - custom save & download handlers */
function theme_generate_dynamic_files() {
    $theme_dir = get_stylesheet_directory() . '/assets/custom-js-css/';
    wp_mkdir_p($theme_dir); // siguron që folderi ekziston

    $color_path = $theme_dir . 'dynamic-colors.css';
    $css_path   = $theme_dir . 'custom-styles.css';
    $js_path    = $theme_dir . 'custom-scripts.js';

    // Get theme color options from DB with defaults
    $primary    = get_option('primary_color', '#091057');
    $secondary  = get_option('secondary_color', '#FF6900');
    $accent     = get_option('accent_color', '#0077FF');
    $background = get_option('background_color', '#ffffff');
    
    // Get play50games specific colors
    $primary_dark = get_option('play50_games_primary_dark', '#05063F');
    $primary_hover = get_option('play50_games_primary_hover', '#1326A1');
    $secondary_darker = get_option('play50_games_secondary_darker', '#CC4B02');
    $black = get_option('play50_games_black', '#111111');
    $white = get_option('play50_games_white', '#ffffff');
    $gray = get_option('play50_games_gray', '#737373');
    $light_gray = get_option('play50_games_light_gray', '#F7F7F8');
    $tertiary = get_option('play50_games_tertiary', '#0077FF');
    
    $custom_css = get_option('custom_css', '');
    $custom_js  = get_option('custom_js', '');

    // Generate CSS for all colors
    $colors_css = ":root {
        /* === Primary (Blue Shades) === */
        --play50games-primary: {$primary};
        --play50games-primary-dark: {$primary_dark};
        --play50games-primary-hover: {$primary_hover};

        /* === Secondary (Orange Shades) === */
        --play50games-secondary: {$secondary};
        --play50games-secondary-darker: {$secondary_darker};

        /* === Neutral Colors === */
        --play50games-black: {$black};
        --play50games-white: {$white};
        --play50games-gray: {$gray};
        --play50games-light-gray: {$light_gray};

        --play50games-tertiary: {$tertiary};
        
        /* === Legacy Color Support === */
        --primary-color: {$primary};
        --secondary-color: {$secondary};
        --accent-color: {$accent};
        --background-color: {$background};
        
        /* === Gradient === */
        --play50games-gradient-90: linear-gradient(0deg, {$primary_hover} 0%, {$primary_dark} 50%, {$primary} 100%);
    }";

    // Save files physically
    file_put_contents($color_path, $colors_css);
    file_put_contents($css_path, $custom_css);
    file_put_contents($js_path, $custom_js);
}

// Save colors
add_action('wp_ajax_save_design_colors', function() {
    // Verify nonce
    if (!wp_verify_nonce($_POST['_wpnonce'], 'save_design_colors')) {
        wp_die('Security check failed');
    }
    
    // Check user capabilities
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }
    
    // Save basic colors
    update_option('primary_color', sanitize_hex_color($_POST['primary_color']));
    update_option('secondary_color', sanitize_hex_color($_POST['secondary_color']));
    update_option('accent_color', sanitize_hex_color($_POST['accent_color']));
    update_option('background_color', sanitize_hex_color($_POST['background_color']));
    
    // Save play50games specific colors
    update_option('play50_games_primary_dark', sanitize_hex_color($_POST['primary_dark']));
    update_option('play50_games_primary_hover', sanitize_hex_color($_POST['primary_hover']));
    update_option('play50_games_secondary_darker', sanitize_hex_color($_POST['secondary_darker']));
    update_option('play50_games_black', sanitize_hex_color($_POST['black']));
    update_option('play50_games_white', sanitize_hex_color($_POST['white']));
    update_option('play50_games_gray', sanitize_hex_color($_POST['gray']));
    update_option('play50_games_light_gray', sanitize_hex_color($_POST['light_gray']));
    update_option('play50_games_tertiary', sanitize_hex_color($_POST['tertiary']));
    
    theme_generate_dynamic_files();
    wp_die();
});

// Save CSS
add_action('wp_ajax_save_custom_css', function() {
    // Verify nonce
    if (!wp_verify_nonce($_POST['_wpnonce'], 'save_custom_css')) {
        wp_die('Security check failed');
    }
    
    // Check user capabilities
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }
    
    update_option('custom_css', wp_unslash($_POST['css']));
    theme_generate_dynamic_files();
    wp_die();
});

// Save JS
add_action('wp_ajax_save_custom_js', function() {
    // Verify nonce
    if (!wp_verify_nonce($_POST['_wpnonce'], 'save_custom_js')) {
        wp_die('Security check failed');
    }
    
    // Check user capabilities
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }
    
    update_option('custom_js', wp_unslash($_POST['js']));
    theme_generate_dynamic_files();
    wp_die();
});

// Reset all
add_action('wp_ajax_reset_design_defaults', function() {
    // Verify nonce
    if (!wp_verify_nonce($_POST['_wpnonce'], 'reset_design_defaults')) {
        wp_die('Security check failed');
    }
    
    // Check user capabilities
    if (!current_user_can('manage_options')) {
        wp_die('Insufficient permissions');
    }
    
    // Reset basic colors
    update_option('primary_color', '#091057');
    update_option('secondary_color', '#FF6900');
    update_option('accent_color', '#0077FF');
    update_option('background_color', '#ffffff');
    
    // Reset play50games specific colors
    update_option('play50_games_primary_dark', '#05063F');
    update_option('play50_games_primary_hover', '#1326A1');
    update_option('play50_games_secondary_darker', '#CC4B02');
    update_option('play50_games_black', '#111111');
    update_option('play50_games_white', '#ffffff');
    update_option('play50_games_gray', '#737373');
    update_option('play50_games_light_gray', '#F7F7F8');
    update_option('play50_games_tertiary', '#0077FF');
    
    update_option('custom_css', '');
    update_option('custom_js', '');
    theme_generate_dynamic_files();
    wp_die();
});

// Download CSS
add_action('wp_ajax_download_custom_css', function() {
    $theme_dir = get_stylesheet_directory() . '/assets/custom-js-css/';
    $file = $theme_dir . 'custom-styles.css';

    if (file_exists($file)) {
        header('Content-Type: text/css');
        header('Content-Disposition: attachment; filename="custom-styles.css"');
        readfile($file);
        exit;
    }
    wp_die('No CSS file found.');
});

// Download JS
add_action('wp_ajax_download_custom_js', function() {
    $theme_dir = get_stylesheet_directory() . '/assets/custom-js-css/';
    $file = $theme_dir . 'custom-scripts.js';

    if (file_exists($file)) {
        header('Content-Type: application/javascript');
        header('Content-Disposition: attachment; filename="custom-scripts.js"');
        readfile($file);
        exit;
    }
    wp_die('No JS file found.');
});
/* End Design settings in theme options - custom save & download handlers */