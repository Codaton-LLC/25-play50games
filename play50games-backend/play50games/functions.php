<?php

    if ( ! defined( '_S_VERSION' ) ) {
        // Replace the version number of the theme on each release.
        define( '_S_VERSION', '1.0.0' );
    }

    // Load Composer autoloader for DomPDF
    $composer_autoload = get_stylesheet_directory() . '/vendor/autoload.php';
    if (file_exists($composer_autoload)) {
        require_once $composer_autoload;
    }

    // Define global variable correctly
    global $theme_path;
    $theme_path = get_template_directory_uri();

    function add_frontend_resources() {
        global $theme_path; // Correct global variable usage

        // CSS
        wp_enqueue_style("boo-icons", $theme_path . "/assets/bootstrap-icons/font/bootstrap-icons.min.css", array("bootstrap-css"), _S_VERSION);
        wp_enqueue_style("bootstrap-css", $theme_path . "/assets/css/bootstrap/bootstrap.min.css", array(), "5.2.2");

        wp_enqueue_style("css-main", $theme_path . "/assets/css/main.css", array("bootstrap-css"), _S_VERSION);

        // Dynamic CSS files - loaded after main.css to override fallback colors
        $dynamic_colors_file = get_stylesheet_directory() . '/assets/custom-js-css/dynamic-colors.css';
        $custom_css_file = get_stylesheet_directory() . '/assets/custom-js-css/custom-styles.css';
        
        if (file_exists($dynamic_colors_file)) {
            wp_enqueue_style("dynamic-colors", $theme_path . "/assets/custom-js-css/dynamic-colors.css", array("css-main"), filemtime($dynamic_colors_file));
        }
        
        if (file_exists($custom_css_file)) {
            wp_enqueue_style("custom-styles", $theme_path . "/assets/custom-js-css/custom-styles.css", array("css-main"), filemtime($custom_css_file));
        }

        // JS
        wp_deregister_script("wp-embed");
        wp_enqueue_script("bootstrap-js", $theme_path . "/assets/js/bootstrap.min.js", array("jquery"), "5.2.2", true);

        wp_enqueue_script("js-main", $theme_path . "/assets/js/functions.min.js", array("jquery"), "1.0", true);

        // Dynamic JS file
        $custom_js_file = get_stylesheet_directory() . '/assets/custom-js-css/custom-scripts.js';
        if (file_exists($custom_js_file)) {
            wp_enqueue_script("custom-scripts", $theme_path . "/assets/custom-js-css/custom-scripts.js", array("jquery"), filemtime($custom_js_file), true);
        }

        wp_localize_script("js-main", "wtAjax", array(
            "ajaxurl" => admin_url("admin-ajax.php"),
        ));

    }

    add_action("wp_enqueue_scripts", "add_frontend_resources");

    // load backend CSS and JS
    function add_backend_resources() {

        global $theme_path;
        // CSS
        wp_enqueue_style("admin-styles", $theme_path . "/assets/css/backend.css");
        
        // Dynamic colors for backend - loaded after backend.css to override fallback colors
        $dynamic_colors_file = get_stylesheet_directory() . '/assets/custom-js-css/dynamic-colors.css';
        if (file_exists($dynamic_colors_file)) {
            wp_enqueue_style("dynamic-colors-backend", $theme_path . "/assets/custom-js-css/dynamic-colors.css", array("admin-styles"), filemtime($dynamic_colors_file));
        }

        // JS - Make sure jQuery is loaded first
        wp_enqueue_script("jquery");
        wp_enqueue_script("admin-js", $theme_path . "/assets/js/backend.min.js", array('jquery'));

        wp_localize_script('admin-js', 'wtAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
        ));

        // Enqueue WordPress color picker styles and scripts
        wp_enqueue_style('wp-color-picker');
        wp_enqueue_script('wp-color-picker', array('jquery'));

    }
    add_action('admin_enqueue_scripts', 'add_backend_resources');

    function register_my_menus()
    {
        register_nav_menus(
            array(
                'primary-menu' => __('Primary Menu'),
                'mobile-menu' => __('Mobile Menu'),
                'footer-menu-1' => __('Footer Menu 1'),
                'footer-menu-2' => __('Footer Menu 2'),
                'footer-menu-3' => __('Footer Menu 3'),
                'footer-menu-4' => __('Footer Menu 4'),
            )
        );
    }

    add_action('init', 'register_my_menus');

    // theme support options
    add_theme_support('menus');
    add_theme_support('post-thumbnails');
    add_image_size( 'product_nocrop', 800, 800, false ); // false = no crop
    add_theme_support('widgets');
    add_theme_support('custom-header', array('flex-height' => true, 'flex-width' => true));
    add_theme_support( 'title-tag' );


    // add backend script media
    function load_media_files() {
        wp_enqueue_media();
    }
    add_action('admin_enqueue_scripts', 'load_media_files');


    // allow svg upload
    function allow_svg_types($mimes) {
        $mimes['svg'] = 'image/svg+xml';
        return $mimes;
    }
    add_filter('upload_mimes', 'allow_svg_types');


    // Editor-Typ WYSIWYG
    function getWpEditor($content, $editor_id, string $name, bool $withoutOB = false, $wpautop = true ) {
        $settings = array(
            'media_buttons' => false,
            'teeny' => false,
            'textarea_rows' => 4,
            'textarea_name' => $name,
            'tinymce' => array(
                'toolbar1' => 'formatselect,bold,italic,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_more,spellchecker,fullscreen,wp_adv',
                'toolbar2' => 'strikethrough,hr,forecolor,pastetext,removeformat,charmap,outdent,indent,undo,redo,wp_help'
            ),
            'wpautop' => $wpautop,
        );

        if($withoutOB)
        {
            wp_editor( $content, $editor_id, $settings );
        }
        else
        {
            ob_start();

            wp_editor( $content, $editor_id, $settings );

            return ob_get_clean();
        }
    }
        // AJAX call wp_editor
        add_action('wp_ajax_wt_get_text_editor', 'wt_get_text_editor');

        function wt_get_text_editor() {
            // Check if the required parameters are set
            if(isset($_POST['text_editor_id']) && isset($_POST['textarea_name'])) {
                // Sanitize the received parameters
                $editor_id = sanitize_text_field($_POST['text_editor_id']);
                $textarea_name = sanitize_text_field($_POST['textarea_name']);


                // Set settings for the editor
                $settings = array(
                    'media_buttons' => false,  // Show the media buttons
                    'textarea_name' => $textarea_name,  // Set the name
                    'textarea_rows' => 8, // Set text area rows
                    'teeny' => false,
                    'tinymce' => array(
                        'toolbar1' => 'formatselect,bold,italic,bullist,numlist,blockquote,alignleft,aligncenter,alignright,link,unlink,wp_more,spellchecker,fullscreen,wp_adv',
                        'toolbar2' => 'strikethrough,hr,forecolor,pastetext,removeformat,charmap,outdent,indent,undo,redo,wp_help'
                    ),
                );

                // Generate the editor
                wp_editor('', $editor_id, $settings);
            }
            wp_die(); // this is required to terminate immediately and return a proper response
        }

    // END of ajax call for wp_editor


    // Desktop Walker
    class Desktop_Walker_Nav_Menu extends Walker_Nav_Menu
    {
        function start_lvl(&$output, $depth = 0, $args = array()) {
            $indent = str_repeat("\t", $depth);
            if ($depth === 0) {
                $submenu_class = 'sub-menu';
            } elseif ($depth === 1) {
                $submenu_class = 'sub-sub-menu';
            } else {
                $submenu_class = 'sub-sub-sub-menu';
            }
            $output .= "\n$indent<ul class=\"dropdown-menu $submenu_class depth_$depth\">\n";
        }

        function start_el(&$output, $item, $depth = 0, $args = array(), $id = 0) {
            $indent = ($depth) ? str_repeat("\t", $depth) : '';
            $li_attributes = '';
            $class_names = $value = '';

            $classes = empty($item->classes) ? array() : (array) $item->classes;
            $classes[] = ($args->walker->has_children) ? 'dropdown' : '';

            if ($item->current) {
                $classes[] = 'active';
            }

            $classes[] = 'menu-item-' . $item->ID;
            if ($depth && $args->walker->has_children) {
                $classes[] = 'dropdown-submenu';
            }

            $class_names = join(' ', apply_filters('nav_menu_css_class', array_filter($classes), $item, $args));
            $class_names = ' class="' . esc_attr($class_names) . '"';

            $id = apply_filters('nav_menu_item_id', 'menu-item-' . $item->ID, $item, $args);
            $id = strlen($id) ? ' id="' . esc_attr($id) . '"' : '';

            $output .= $indent . '<li' . $id . $value . $class_names . $li_attributes . '>';

            $atts = array();
            $atts['title'] = !empty($item->attr_title) ? $item->attr_title : '';
            $atts['target'] = !empty($item->target) ? $item->target : '';
            $atts['rel'] = !empty($item->xfn) ? $item->xfn : '';
            $atts['href'] = !empty($item->url) ? $item->url : '';

            $atts = apply_filters('nav_menu_link_attributes', $atts, $item, $args);

            $attributes = '';
            foreach ($atts as $attr => $value) {
                if (!empty($value)) {
                    $value = ('href' === $attr) ? esc_url($value) : esc_attr($value);
                    $attributes .= ' ' . $attr . '="' . $value . '"';
                }
            }

            $item_output = $args->before;
            $item_output .= '<a' . $attributes . '>';
            $item_output .= '<span class="link-drop-down">';  // Add a span tag to wrap the link text
            $item_output .= $args->link_before . apply_filters('the_title', $item->title, $item->ID) . $args->link_after;
            $item_output .= '</span>';  // Close the span tag
            $item_output .= ($args->walker->has_children) ? ' <span class="arrow-play50games-desktop"></span></a>' : '</a>';
            $item_output .= $args->after;

            $output .= apply_filters('walker_nav_menu_start_el', $item_output, $item, $depth, $args);
        }
    }


    class Mobile_Walker_Nav_Menu extends Walker_Nav_Menu
    {
        function start_lvl(&$output, $depth = 0, $args = array()) {
            $indent = str_repeat("\t", $depth);
            if ($depth === 0) {
                $submenu_class = 'sub-menu';
            } elseif ($depth === 1) {
                $submenu_class = 'sub-sub-menu';
            } else {
                $submenu_class = 'sub-sub-sub-menu';
            }
            $output .= "\n$indent<ul class=\"dropdown-menu $submenu_class depth_$depth\">\n";
        }

        function start_el(&$output, $item, $depth = 0, $args = array(), $id = 0)
        {
            $indent = ($depth) ? str_repeat("\t", $depth) : '';
            $li_attributes = '';
            $class_names = $value = '';

            $classes = empty($item->classes) ? array() : (array)$item->classes;
            $classes[] = ($args->walker->has_children) ? 'dropdown' : '';

            if ($item->current) {
                $classes[] = 'active';
            }

            $classes[] = 'menu-item-' . $item->ID;
            if ($depth && $args->walker->has_children) {
                $classes[] = 'dropdown-submenu';
            }

            $class_names = join(' ', apply_filters('nav_menu_css_class', array_filter($classes), $item, $args));
            $class_names = ' class="' . esc_attr($class_names) . '"';

            $id = apply_filters('nav_menu_item_id', 'menu-item-' . $item->ID, $item, $args);
            $id = strlen($id) ? ' id="' . esc_attr($id) . '"' : '';

            $output .= $indent . '<li' . $id . $value . $class_names . $li_attributes . '>';

            $atts = array();
            $atts['title'] = !empty($item->attr_title) ? $item->attr_title : '';
            $atts['target'] = !empty($item->target) ? $item->target : '';
            $atts['rel'] = !empty($item->xfn) ? $item->xfn : '';

            $atts['href'] = !empty($item->url) ? $item->url : '';

            $atts = apply_filters('nav_menu_link_attributes', $atts, $item, $args);

            $attributes = '';
            foreach ($atts as $attr => $value) {
                if (!empty($value)) {
                    $value = ('href' === $attr) ? esc_url($value) : esc_attr($value);
                    $attributes .= ' ' . $attr . '="' . $value . '"';
                }
            }

            // Define different arrow classes based on depth
            $arrow_class = '';
            if ($args->walker->has_children) {
                if ($depth == 0) {
                    $arrow_class = 'mega-menu-mobile-arrow';
                } elseif ($depth == 1) {
                    $arrow_class = 'sub-mega-menu-mobile-arrowe';
                } else {
                    $arrow_class = 'sub-sub-mega-menu-mobile-arrow';
                }
            }

            $item_output = $args->before;

            if ($args->walker->has_children) {
                $item_output .= '<span class="menu-item-wrap">';
            }

            $item_output .= '<a class="nav-link-mob"' . $attributes . '>';
            $item_output .= $args->link_before . apply_filters('the_title', $item->title, $item->ID) . $args->link_after;
            $item_output .= '</a>';

            if ($args->walker->has_children) {
                $item_output .= '<div class="' . $arrow_class . '">
                        <img alt="menu-open" src="/wp-content/themes/play50games/assets/img/vectors/dropDownMenuClose.svg" class="arrow-menu-open" /> 
                        <img alt="menu-close" src="/wp-content/themes/play50games/assets/img/vectors/dropDownMenu.svg" class="d-none arrow-menu-close" /> 
                </div>';
                $item_output .= '</span>';
            }

            $item_output .= $args->after;

            $output .= apply_filters('walker_nav_menu_start_el', $item_output, $item, $depth, $args);
        }
    }

    // register custom-block category
    function add_block_category( $categories, $post ) {

        return array_merge(
            array(
                array(
                    'slug' => 'play50games-blocks',
                    'title' => __( 'play50games', 'play50games' ),
                ),
            ),
            $categories
        );
    }
    add_filter( 'block_categories_all', 'add_block_category', 10, 2);


    // register play50games custom-blocks
    function register_play50_games_blocks() {

        // abort if gutenberg is not active
        if(!function_exists( 'register_block_type'))
        {
            return;
        }

        // init vars
        global $theme_path;
        $blocks = array(
            array("name" => "image_block", "block-name" => "image-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "button_block", "block-name" => "button-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "multiple_buttons_block", "block-name" => "multiple-buttons-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "text_block", "block-name" => "text-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "accordion_block", "block-name" => "accordion-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "testimonials_block", "block-name" => "testimonials-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
            array("name" => "headline_block", "block-name" => "headline-block", "deps" => array("wp-block-editor","wp-blocks","wp-element","wp-data")),
      );

        // iterate blocks
        foreach($blocks as $block) {

            // register script
            wp_register_script(
                "wt_".$block["name"],
                $theme_path."/wt-blocks/".$block["block-name"]."/".$block["name"]."_editor.min.js",
                $block["deps"]
            );

            // register editor style
            wp_register_style(
                "wt_".$block["name"]."_editor",
                $theme_path."/wt-blocks/".$block["block-name"]."/".$block["name"]."_editor.css",
                array("wp-edit-blocks")
            );

            // register block
            $check = register_block_type(
                "wt/".$block["block-name"], array(
                "style" => "wt_".$block["name"],
                "editor_style" => "wt_".$block["name"]."_editor",
                "editor_script" => "wt_".$block["name"],
                "render_callback" => "wt_".$block["name"]."_rc"
            ));

            // include php return call function
            include_once(dirname(__FILE__) . "/wt-blocks/" .$block["block-name"]."/".$block["name"].".php");
        }
    }
    add_action('init', 'register_play50_games_blocks');



    /* use archive.php for posts */
    function use_archive_for_posts_page( $template ) {
        if ( is_home() ) {
            // Redirect to archive.php when viewing the posts page
            $template = locate_template( 'archive.php' );
        }
        return $template;
    }
    add_filter( 'home_template', 'use_archive_for_posts_page' );
    /* end of archive.php for posts */


    // saves metas for all CPT
    function save_custom_post_metas( $post_id, $metaNonce, $saveFields, $fields ) {

        // check if POST exist
        if( !$_POST )
        {
            return $post_id;
        }

        if( !isset( $_POST[$metaNonce] ) )
        {
            return $post_id;
        }

        // verify nonce
        if ( !wp_verify_nonce( $_POST[$metaNonce], $saveFields ) )
        {
            return $post_id;
        }

        // check autosave
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE )
        {
            return $post_id;
        }

        // check permissions
        $post_type = isset($_POST['post_type']) ? $_POST['post_type'] : '';
        if ( 'page' === $post_type )
        {
            if ( !current_user_can( 'edit_page', $post_id ) )
            {
                return $post_id;
            }
        }
        elseif ( !current_user_can( 'edit_post', $post_id ) )
        {
            return $post_id;
        }

        $old = get_post_meta( $post_id, $fields, true );
        $new = $_POST[$fields];

        //  Update or delete
        if ( $new && $new !== $old ) {
            update_post_meta( $post_id, $fields, $new );
        } elseif ( empty($new) && !empty($old) ) {
            delete_post_meta( $post_id, $fields );
        }

        return $post_id;
    }


    // include play50games utilities
    include_once("wt-utilities.php");

    // cpt
    include_once("wt-cpt.php");
    require_once(get_stylesheet_directory() . '/wt-cpt/accordion.php');
	require_once(get_stylesheet_directory() . '/wt-cpt/testimonials.php');
	require_once(get_stylesheet_directory() . '/wt-cpt/games.php');
	require_once(get_stylesheet_directory() . '/wt-cpt/certificates.php');
	require_once(get_stylesheet_directory() . '/wt-cpt/share-tracking.php');
	require_once(get_stylesheet_directory() . '/wt-cpt/game-progress.php');

    // load theme options
    require_once(get_stylesheet_directory() . '/theme-options.php');
    
    // ============================================
    // Play50Games JWT Configuration (Fallback)
    // ============================================
    // Nëse JWT_AUTH_SECRET_KEY nuk është i definuar në wp-config.php, defino këtu
    if (!defined('JWT_AUTH_SECRET_KEY')) {
        define('JWT_AUTH_SECRET_KEY', 'play50games251228granit78954561fewtr435gad');
    }
    if (!defined('JWT_AUTH_CORS_ENABLE')) {
        define('JWT_AUTH_CORS_ENABLE', true);
    }
    // ============================================
    
    // load REST API
    require_once(get_stylesheet_directory() . '/includes/rest-api.php');

    // load 3D Arcade API + admin page (separate from classic progress; loaded only when deployed)
    if (file_exists(get_stylesheet_directory() . '/includes/arcade-api.php')) {
        require_once(get_stylesheet_directory() . '/includes/arcade-api.php');
    }
    if (file_exists(get_stylesheet_directory() . '/wt-cpt/arcade-scores-admin.php')) {
        require_once(get_stylesheet_directory() . '/wt-cpt/arcade-scores-admin.php');
    }
    
    // load certificate generator
    require_once(get_stylesheet_directory() . '/includes/certificate-generator.php');

    // Initialize dynamic files on theme activation
    function initialize_dynamic_files() {
        if (function_exists('theme_generate_dynamic_files')) {
            theme_generate_dynamic_files();
        }
    }
    add_action('after_switch_theme', 'initialize_dynamic_files');
    
    // Generate files immediately when theme loads (not just on activation)
    function ensure_dynamic_files_exist() {
        if (function_exists('theme_generate_dynamic_files')) {
            $theme_dir = get_stylesheet_directory() . '/assets/custom-js-css/';
            $color_file = $theme_dir . 'dynamic-colors.css';
            
            // Generate files if they don't exist
            if (!file_exists($color_file)) {
                theme_generate_dynamic_files();
            }
        }
    }
    add_action('init', 'ensure_dynamic_files_exist');

    // Generate files when theme options are saved
    function generate_files_on_save() {
        if (function_exists('theme_generate_dynamic_files')) {
            theme_generate_dynamic_files();
        }
    }
    add_action('update_option_play50_games_theme_options_all', 'generate_files_on_save');
    add_action('update_option_play50_games_theme_options_en', 'generate_files_on_save');
    add_action('update_option_play50_games_theme_options_de', 'generate_files_on_save');

    // ============================================
    // Add User ID column to Users list in WordPress Admin
    // ============================================
    
    // Add User ID column to users list
    function play50_add_user_id_column($columns) {
        // Insert User ID column after checkbox
        $new_columns = array();
        $new_columns['cb'] = $columns['cb'];
        $new_columns['user_id'] = 'User ID';
        unset($columns['cb']);
        return array_merge($new_columns, $columns);
    }
    add_filter('manage_users_columns', 'play50_add_user_id_column');
    
    // Populate User ID column
    function play50_show_user_id_column_content($value, $column_name, $user_id) {
        if ($column_name === 'user_id') {
            return '<strong style="color: #2271b1; font-size: 14px;">' . esc_html($user_id) . '</strong>';
        }
        return $value;
    }
    add_filter('manage_users_custom_column', 'play50_show_user_id_column_content', 10, 3);
    
    // Make User ID column sortable
    function play50_make_user_id_column_sortable($columns) {
        $columns['user_id'] = 'ID';
        return $columns;
    }
    add_filter('manage_users_sortable_columns', 'play50_make_user_id_column_sortable');
    
    // Handle sorting by User ID
    function play50_sort_users_by_id($query) {
        if (!is_admin() || !isset($_GET['orderby']) || $_GET['orderby'] !== 'ID') {
            return;
        }
        
        $query->set('orderby', 'ID');
        $order = isset($_GET['order']) ? strtoupper($_GET['order']) : 'ASC';
        $query->set('order', $order);
    }
    add_action('pre_get_users', 'play50_sort_users_by_id');

 