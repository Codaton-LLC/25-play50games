<?php

	/* Add Custom Post Type - Accordion */
	function add_custom_post_type_accordion() {
		
		$labels = array(
			'name' => _x( 'Accordion', 'Post Type General Name', 'play50games' ),
			'singular_name' => _x( 'Accordion', 'Post Type Singular Name', 'play50games' ),
			'menu_name' => __( 'Accordion', 'play50games' ),
			'name_admin_bar' => __( 'Accordion', 'play50games' ),
			'archives' => __( 'Accordion Archives', 'play50games' ),
			'attributes' => __( 'Accordion Attributes', 'play50games' ),
			'parent_item_colon' => __( 'Parent Accordion:', 'play50games' ),
			'all_items' => __( 'All Accordions ', 'play50games' ),
			'add_new_item' => __( 'Add New Accordion', 'play50games' ),
			'add_new' => __( 'Add New', 'play50games' ),
			'new_item' => __( 'New Accordion', 'play50games' ),
			'edit_item' => __( 'Edit Accordion', 'play50games' ),
			'update_item' => __( 'Update Accordion', 'play50games' ),
			'view_item' => __( 'View Accordion', 'play50games' ),
			'view_items' => __( 'View Accordions', 'play50games' ),
			'search_items' => __( 'Search Accordion', 'play50games' ),
			'not_found' => __( 'Not found', 'play50games' ),
			'not_found_in_trash' => __( 'Not found in Trash', 'play50games' ),
			'featured_image' => __( 'Accordion Image', 'play50games' ),
			'set_featured_image' => __( 'Set Accordion image', 'play50games' ),
			'remove_featured_image' => __( 'Remove Accordion image', 'play50games' ),
			'use_featured_image' => __( 'Use as Accordion image', 'play50games' ),
			'insert_into_item' => __( 'Insert into Accordion', 'play50games' ),
			'uploaded_to_this_item' => __( 'Uploaded to this Accordion', 'play50games' ),
			'items_list' => __( 'Accordions list', 'play50games' ),
			'items_list_navigation' => __( 'Accordions list navigation', 'play50games' ),
			'filter_items_list' => __( 'Filter Accordion list', 'play50games' ),
		);
		
		$args = array(
			'label' => __( 'Accordion', 'play50games' ),
			'description' => __( 'Accordion', 'play50games' ),
			'labels' => $labels,
			'supports' => array( 'title' ),
			'public' => true,
			'show_in_rest' => true,
			'show_ui' => true,
			'menu_position' => 21,
			'menu_icon' => 'dashicons-menu',
			'has_archive' => true,
			'exclude_from_search' => true,
			'publicly_queryable' => false,
			'show_in_nav_menus' => false,
		);
		
		register_post_type( 'Accordion', $args );
	}
	add_action("init", "add_custom_post_type_accordion");
	
	// add HTML for Accordion CPT
	function add_accordion_meta_box() {
		
		$text = __( 'Accordion information', 'play50games' );
		
		add_meta_box(
			'accordion_fields_meta_box',
			$text,
			'show_accordion_custom_fields',
			'Accordion'
		);
	}
	add_action( 'add_meta_boxes', 'add_accordion_meta_box' );
	
	function save_custom_post_accordion_metas( $post_id ) {
		
		$metaNonce    = "accordionMetaNonce";
		$saveFields   = "saveAccordionFields";
		$fields       = "accordion_fields";
		
		return save_custom_post_metas($post_id, $metaNonce, $saveFields, $fields);
	}
	add_action( 'save_post', 'save_custom_post_accordion_metas' );
	/* END - Add Custom Post Type - Accordion */
	
	function add_custom_post_type_testimonials() {
		$labels = array(
			'name' => _x( 'Testimonials', 'Post Type General Name', "play50games" ),
			'singular_name' => _x( 'Testimonials', 'Post Type Singular Name', "play50games" ),
			'menu_name' => __( 'Testimonials', "play50games" ),
			'name_admin_bar' => __( 'Testimonials', "play50games" ),
			'archives' => __( 'Testimonials Archives', "play50games" ),
			'attributes' => __( 'Testimonials Attributes', "play50games" ),
			'parent_item_colon' => __( 'Parent Testimonials:', "play50games" ),
			'all_items' => __( 'All Testimonials', "play50games" ),
			'add_new_item' => __( 'Add New Testimonials', "play50games" ),
			'add_new' => __( 'Add New', "play50games" ),
			'new_item' => __( 'New Testimonials', "play50games" ),
			'edit_item' => __( 'Edit Testimonials', "play50games" ),
			'update_item' => __( 'Update Testimonials', "play50games" ),
			'view_item' => __( 'View Testimonials', "play50games" ),
			'view_items' => __( 'View Testimonials', "play50games" ),
			'search_items' => __( 'Search Testimonials', "play50games" ),
			'not_found' => __( 'Not found', "play50games" ),
			'not_found_in_trash' => __( 'Not found in Trash', "play50games" ),
			'insert_into_item' => __( 'Insert into Testimonials', "play50games" ),
			'uploaded_to_this_item' => __( 'Uploaded to this Testimonials', "play50games" ),
			'items_list' => __( 'Testimonials list', "play50games" ),
			'items_list_navigation' => __( 'Testimonials list navigation', "play50games" ),
			'filter_items_list' => __( 'Filter Testimonials list', "play50games" ),
		);
		
		$args = array(
			'label' => __( 'Testimonials', "play50games" ),
			'description' => __( 'Testimonials', "play50games" ),
			'labels' => $labels,
			'supports' => array( 'title' ),
			'public' => true,
			'show_in_rest' => true,
			'show_ui' => true,
			'menu_position' => 39,
			'menu_icon' => 'dashicons-images-alt2',
			'has_archive' => true,
			'exclude_from_search' => true,
			'publicly_queryable' => false,
			'show_in_nav_menus' => false,
		);
		
		register_post_type( 'Testimonials', $args );
	}
	add_action("init", "add_custom_post_type_testimonials");
	
	// add HTML for Testimonials CPT
	function add_testimonials_meta_box() {
		
		$text = __( 'Testimonials information', "play50games" );
		
		add_meta_box(
			'testimonials_fields_meta_box',
			$text,
			'show_testimonials_custom_fields',
			'Testimonials'
		);
	}
	add_action( 'add_meta_boxes', 'add_testimonials_meta_box' );
	
	// saves metas for CPT Testimonials
	function save_custom_post_testimonials_metas( $post_id ) {
		
		$metaNonce    = "testimonialsMetaNonce";
		$saveFields   = "testimonialsFields";
		$fields       = "testimonials_fields";
		
		return save_custom_post_metas($post_id, $metaNonce, $saveFields, $fields);
	}
	add_action( 'save_post', 'save_custom_post_testimonials_metas' );
	/* END - Add Custom Post Type - Testimonials */
	
	/* Add Custom Post Type - Games */
	function add_custom_post_type_games() {
		$labels = array(
			'name' => _x( 'Games', 'Post Type General Name', 'play50games' ),
			'singular_name' => _x( 'Game', 'Post Type Singular Name', 'play50games' ),
			'menu_name' => __( 'Games', 'play50games' ),
			'name_admin_bar' => __( 'Game', 'play50games' ),
			'archives' => __( 'Game Archives', 'play50games' ),
			'attributes' => __( 'Game Attributes', 'play50games' ),
			'parent_item_colon' => __( 'Parent Game:', 'play50games' ),
			'all_items' => __( 'All Games', 'play50games' ),
			'add_new_item' => __( 'Add New Game', 'play50games' ),
			'add_new' => __( 'Add New', 'play50games' ),
			'new_item' => __( 'New Game', 'play50games' ),
			'edit_item' => __( 'Edit Game', 'play50games' ),
			'update_item' => __( 'Update Game', 'play50games' ),
			'view_item' => __( 'View Game', 'play50games' ),
			'view_items' => __( 'View Games', 'play50games' ),
			'search_items' => __( 'Search Game', 'play50games' ),
			'not_found' => __( 'Not found', 'play50games' ),
			'not_found_in_trash' => __( 'Not found in Trash', 'play50games' ),
			'featured_image' => __( 'Game Image', 'play50games' ),
			'set_featured_image' => __( 'Set Game image', 'play50games' ),
			'remove_featured_image' => __( 'Remove Game image', 'play50games' ),
			'use_featured_image' => __( 'Use as Game image', 'play50games' ),
			'insert_into_item' => __( 'Insert into Game', 'play50games' ),
			'uploaded_to_this_item' => __( 'Uploaded to this Game', 'play50games' ),
			'items_list' => __( 'Games list', 'play50games' ),
			'items_list_navigation' => __( 'Games list navigation', 'play50games' ),
			'filter_items_list' => __( 'Filter Games list', 'play50games' ),
		);
		
		$args = array(
			'label' => __( 'Game', 'play50games' ),
			'description' => __( 'Play50Games - Game Configuration', 'play50games' ),
			'labels' => $labels,
			'supports' => array( 'title', 'editor' ),
			'public' => true,
			'show_in_rest' => true,
			'show_ui' => true,
			'menu_position' => 5,
			'menu_icon' => 'dashicons-games',
			'has_archive' => false,
			'exclude_from_search' => true,
			'publicly_queryable' => false,
			'show_in_nav_menus' => false,
		);
		
		register_post_type( 'play50_game', $args );
	}
	add_action("init", "add_custom_post_type_games");
	
	// add HTML for Games CPT
	function add_games_meta_box() {
		$text = __( 'Game Information', 'play50games' );
		
		add_meta_box(
			'games_fields_meta_box',
			$text,
			'show_games_custom_fields',
			'play50_game'
		);
	}
	add_action( 'add_meta_boxes', 'add_games_meta_box' );
	
	function save_custom_post_games_metas( $post_id ) {
		$metaNonce    = "gameMetaNonce";
		$saveFields   = "saveGameFields";
		$fields       = "game_fields";
		
		return save_custom_post_metas($post_id, $metaNonce, $saveFields, $fields);
	}
	add_action( 'save_post', 'save_custom_post_games_metas' );
	/* END - Add Custom Post Type - Games */
	
	/* Add Custom Post Type - Certificates */
	function add_custom_post_type_certificates() {
		$labels = array(
			'name' => _x( 'Certificates', 'Post Type General Name', 'play50games' ),
			'singular_name' => _x( 'Certificate', 'Post Type Singular Name', 'play50games' ),
			'menu_name' => __( 'Certificates', 'play50games' ),
			'name_admin_bar' => __( 'Certificate', 'play50games' ),
			'archives' => __( 'Certificate Archives', 'play50games' ),
			'attributes' => __( 'Certificate Attributes', 'play50games' ),
			'parent_item_colon' => __( 'Parent Certificate:', 'play50games' ),
			'all_items' => __( 'All Certificates', 'play50games' ),
			'add_new_item' => __( 'Add New Certificate', 'play50games' ),
			'add_new' => __( 'Add New', 'play50games' ),
			'new_item' => __( 'New Certificate', 'play50games' ),
			'edit_item' => __( 'Edit Certificate', 'play50games' ),
			'update_item' => __( 'Update Certificate', 'play50games' ),
			'view_item' => __( 'View Certificate', 'play50games' ),
			'view_items' => __( 'View Certificates', 'play50games' ),
			'search_items' => __( 'Search Certificate', 'play50games' ),
			'not_found' => __( 'Not found', 'play50games' ),
			'not_found_in_trash' => __( 'Not found in Trash', 'play50games' ),
			'featured_image' => __( 'Certificate Image', 'play50games' ),
			'set_featured_image' => __( 'Set Certificate image', 'play50games' ),
			'remove_featured_image' => __( 'Remove Certificate image', 'play50games' ),
			'use_featured_image' => __( 'Use as Certificate image', 'play50games' ),
			'insert_into_item' => __( 'Insert into Certificate', 'play50games' ),
			'uploaded_to_this_item' => __( 'Uploaded to this Certificate', 'play50games' ),
			'items_list' => __( 'Certificates list', 'play50games' ),
			'items_list_navigation' => __( 'Certificates list navigation', 'play50games' ),
			'filter_items_list' => __( 'Filter Certificates list', 'play50games' ),
		);
		
		$args = array(
			'label' => __( 'Certificate', 'play50games' ),
			'description' => __( 'Play50Games - Completion Certificates', 'play50games' ),
			'labels' => $labels,
			'supports' => array( 'title' ),
			'public' => false,
			'show_in_rest' => true,
			'show_ui' => true,
			'menu_position' => 6,
			'menu_icon' => 'dashicons-awards',
			'has_archive' => false,
			'exclude_from_search' => true,
			'publicly_queryable' => false,
			'show_in_nav_menus' => false,
		);
		
		register_post_type( 'play50_certificate', $args );
	}
	add_action("init", "add_custom_post_type_certificates");
	
	// add HTML for Certificates CPT
	function add_certificates_meta_box() {
		$text = __( 'Certificate Information', 'play50games' );
		
		add_meta_box(
			'certificates_fields_meta_box',
			$text,
			'show_certificates_custom_fields',
			'play50_certificate'
		);
	}
	add_action( 'add_meta_boxes', 'add_certificates_meta_box' );
	
	function save_custom_post_certificates_metas( $post_id ) {
		$metaNonce    = "certificateMetaNonce";
		$saveFields   = "saveCertificateFields";
		$fields       = "certificate_fields";
		
		// Auto-generate certificate ID if not set
		$meta = get_post_meta($post_id, $fields, true);
		if (is_array($meta) && empty($meta['certificate_id'])) {
			$meta['certificate_id'] = wp_generate_uuid4();
			update_post_meta($post_id, $fields, $meta);
		}
		
		return save_custom_post_metas($post_id, $metaNonce, $saveFields, $fields);
	}
	add_action( 'save_post', 'save_custom_post_certificates_metas' );
	/* END - Add Custom Post Type - Certificates */
	
