<div class="search-header-product-destinations container d-block mx-auto">
    <form method="get" class="d-flex play50games-custom-search-form-destinations" id="play50games-custom-search-form-destinations">
        <div class="input-select-wrapper-destinations">
            <input type="text" name="search_term_destinations" class="" id="search_term_destinations"
                   placeholder="<?php echo __('Where are you travelling?', 'play50games'); ?>"/>
        </div>
        <button type="submit" class="ux-search-submit-destinations submit-button-destinations" aria-label="Submit">
            <img class="search-icon" alt="search-icon"
                 src="<?php echo get_template_directory_uri(); ?>/assets/img/icon-search-green.svg"/>
        </button>
    </form>
    <div id="search-results-destinations">
        <div class="results-grid grid-3 skeleton">
			<?php for ($i=0; $i<9; $i++): ?>
                <div class="country-card skel">
                    <div class="flag-wrap"><span class="skel-box sk-flag"></span></div>
                    <div class="info">
                        <div class="skel-box sk-title"></div>
                        <div class="skel-box sk-price"></div>
                    </div>
                    <span class="skel-box sk-arrow"></span>
                </div>
			<?php endfor; ?>
        </div>
    </div>

</div>
