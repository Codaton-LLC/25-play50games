<?php
	/**
	 * The template for displaying search forms in flatsome
	 *
	 * @package          Flatsome\Templates
	 * @flatsome-version 3.16.0
	 */
	
	$placeholder = __( 'Search', 'woocommerce' ).'&hellip;';

?>
<form method="get" class="searchform" action="<?php echo esc_url(home_url('/')); ?>" role="search">
	<div class="d-flex align-items-center">
		<div class="w-100">
			<input type="search" class="search-field" name="s" value="<?php echo esc_attr(get_search_query()); ?>"
			       id="s" placeholder="<?php echo $placeholder; ?>"/>
		</div>
		<div class="">
			<button type="submit" class="ux-search-submit submit-button"
			        aria-label="<?php esc_attr_e('Submit', 'play50games'); ?>">
				<img alt="icon search" class="search-icon" src="/wp-content/themes/play50games/assets/icons/icon-search.svg" />
			</button>
		</div>
	</div>
	<div class="live-search-results text-left z-top"></div>
</form>
