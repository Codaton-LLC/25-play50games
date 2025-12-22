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
	
