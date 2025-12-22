// native dom ready function
var domRdy = function (fn) {

    //sanity check
    if (typeof fn !== "function") {
        return;
    }

    //if document is already loaded, run method
    if (document.readyState === "complete") {
        return fn();
    }

    //otherwise, wait until document is loaded
    document.addEventListener("DOMContentLoaded", fn, false);
};

//native on dom ready
domRdy(function () {

});

document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('header.header-play50games');
    const logoDefault = document.querySelector('.logo-desktop');
    const logoActive = document.querySelector('.logo-desktop-active');

    window.addEventListener('scroll', function () {
        if (window.scrollY > 0) {
            header.classList.add('active');
            logoDefault.classList.add('d-none');
            logoActive.classList.remove('d-none');
        } else {
            header.classList.remove('active');
            logoDefault.classList.remove('d-none');
            logoActive.classList.add('d-none');
        }
    });
});


//change border of required fields
jQuery(document).ready(function ($) {
    $('form').find('input[required]').on('invalid', function (e) {
        e.preventDefault();
        $(this).css('border', '1px solid #0BD876');
    })
});

// language switcher
// document.addEventListener('DOMContentLoaded', function () {
//     const activeLang = document.querySelector('.lang-active');
//     const dropdown = document.querySelector('.lang-dropdown');
//
//     if (activeLang) {
//         activeLang.addEventListener('click', function (e) {
//             e.preventDefault();
//             dropdown.classList.toggle('show-lang-dropdown');
//         });
//     }
//
//     document.addEventListener('click', function (e) {
//         if (!e.target.closest('.lang-switcher')) {
//             dropdown.classList.remove('show-lang-dropdown');
//         }
//     });
// });


//contact form 7
document.addEventListener("DOMContentLoaded", function () {
    const cf7Btn = document.querySelector('.wpcf7 .wpcf7-submit');
    if (cf7Btn) {
        const btnText = cf7Btn.value;
        const customButton = document.createElement('button');
        customButton.type = 'submit';
        customButton.className = 'wpcf7-submit btn-full btn-full-primary';
        customButton.innerHTML = `${btnText}`;

        cf7Btn.parentNode.replaceChild(customButton, cf7Btn);
    }
});

/*Contact form Opening and closing Tab*/
document.addEventListener('DOMContentLoaded', function() {
    const openMegaMenu = document.getElementById('openMegaMenu');
    const panelLeft = document.getElementById('panelLeft');
    const panelRight = document.getElementById('panelRight');

    openMegaMenu.addEventListener('click', function() {
        console.log('click mega menu');
        this.classList.toggle('active');
        panelLeft.classList.toggle('open-left');
        panelRight.classList.toggle('open-right');
    });
});

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    // Select all arrow wrappers
    const arrow_wrappers = document.querySelectorAll('.mega-menu-mobile-arrow');

    arrow_wrappers.forEach(arrow_wrapper => {
        // Grab the two arrow images
        const arrow_menu_open = arrow_wrapper.querySelector('.arrow-menu-open');
        const arrow_menu_close = arrow_wrapper.querySelector('.arrow-menu-close');

        // Find the corresponding submenu in the same <li>
        const parent_li = arrow_wrapper.closest('li');
        const sub_menu = parent_li.querySelector('.dropdown-menu.sub-menu.depth_0');

        // Ensure submenu is hidden by default
        sub_menu.classList.add('d-none');

        // Bind click
        arrow_wrapper.addEventListener('click', () => {
            // Toggle open/close icons
            arrow_menu_open.classList.toggle('d-none');
            arrow_menu_close.classList.toggle('d-none');

            // Toggle submenu visibility
            sub_menu.classList.toggle('d-none');
        });
    });
});


/* custom header search product */
jQuery(document).ready(function($) {
    var delay_timer; // Set a timer
    var delay_time = 500; // Set delay time in milliseconds
    
    // Function to perform the AJAX request
    function performSearch() {
        var search_term = $('#search_term').val().trim();
        
        // If search_term is empty, clear the results and exit from this function
        if (!search_term) {
            $('#search_term').removeClass('active-border');
            $('.submit-button').removeClass('active-border');
            $('#search-results').html("");
            return;
        }
        
        $.ajax({
            url: wtAjax.ajaxurl,
            type: 'GET',
            data: {
                action: 'custom_woocommerce_product_search',
                search_term: search_term,
            },
            success: function(response) {
                if(response.trim() === '') {
                    $('#search-results').html("No results found");
                } else {
                    $('#search_term').addClass('active-border');
                    $('.submit-button').addClass('active-border');
                    $('#search-results').html(response + '<span class="close-icon-search"></span>');
                }
            }
        });
    }
    
    // Trigger search on input
    $('#search_term').on('input', function() {
        // Clear existing timer on each input event
        clearTimeout(delay_timer);
        
        // Set the new timer
        delay_timer = setTimeout(performSearch, delay_time);
    });
    
    // Trigger search on form submit
    $('#play50games-custom-search-form').on('submit', function(e) {
        e.preventDefault();
        performSearch();
    });
    
    // Clear search results when clicked on close icon
    $('#search-results').on('click', '.close-icon-search', function(e) {
        $('#search-results').html("");
    });
});

/* custom header search mobil product */

jQuery(document).ready(function($) {
    var delay_timer_mobile; // Set a timer for mobile
    var delay_time = 500; // Set delay time in milliseconds
    
    // Function to perform the AJAX request
    function perform_search_mobile() {
        var search_term_mobile = $('#search_term-mobile').val().trim();
        
        // Check if search_term is empty
        if (!search_term_mobile) {
            $('#search-results-mobile').html("");
            return;
        }
        
        // Perform AJAX request
        $.ajax({
            url: wtAjax.ajaxurl,
            type: 'GET',
            data: {
                action: 'custom_woocommerce_product_search_mobile',
                search_term_mobile: search_term_mobile,
                
            },
            success: function(response) {
                $('#search-results-mobile').html(response + '<span class="close-icon-search"></span>');
            }
        });
    }
    
    // Trigger search on input
    $('#search_term-mobile').on('input', function() {
        clearTimeout(delay_timer_mobile); // Clear existing timer on each input event
        delay_timer_mobile = setTimeout(perform_search_mobile, delay_time);  // Set the new timer
    });
    
    // Trigger search on form submit
    $('#play50games-custom-search-form-mobile').on('submit', function(e) {
        e.preventDefault();
        perform_search_mobile();
    });
    
    // Clear search results when clicked on close icon
    $('#search-results-mobile').on('click', '.close-icon-search', function(e) {
        $('#search-results-mobile').html("");
    });
});



//autoupdate cart number
jQuery(document).ready(function($) {
    // Function to update the cart count
    function update_cart_count() {
        $.ajax({
            url: wc_add_to_cart_params.ajax_url, // WooCommerce's AJAX URL
            type: 'POST',
            data: {
                action: 'woocommerce_get_refreshed_fragments'
            },
            success: function(response) {
                if (response && response.fragments) {
                    // Extract the updated cart count and replace only the number
                    var newCartCount = $(response.fragments['span.menu-basket-items-total']).text();
                    $('.menu-basket-items-total').text(newCartCount); // Update the cart count
                }
            },
            error: function(xhr, status, error) {
                console.log('AJAX error:', status, error); // Log the error for debugging
            }
        });
    }
    
    // Listen for WooCommerce events when an item is added to the cart
    $(document.body).on('added_to_cart', function() {
        update_cart_count();
    });
    
    // Listen for WooCommerce events when an item is removed from the cart
    $(document.body).on('removed_from_cart', function() {
        update_cart_count();
    });
    
    // Listen for WooCommerce events when the cart is updated
    $(document.body).on('updated_cart_totals', function() {
        update_cart_count();
    });
    
    // Listen for the click event on the "Remove" button (× link) in the cart
    $(document).on('click', '.product-remove .remove', function(e) {
        e.preventDefault(); // Prevent default link behavior (full page reload)
        
        var $this = $(this);
        var product_id = $this.data('product_id');
        var cart_item_key = $this.attr('href').split('remove_item=')[1].split('&')[0]; // Extract the cart item key from the href
        
        // Use WooCommerce's default removal link handling
        $.ajax({
            url: wc_add_to_cart_params.wc_ajax_url.toString().replace("%%endpoint%%", "remove_item"),
            type: 'POST',
            data: {
                cart_item_key: cart_item_key
            },
            success: function(response) {
                // Remove the item row from the cart
                $this.closest('tr.cart_item').remove();
                
                // Refresh the cart fragments and totals
                update_cart_count();
                $(document.body).trigger('wc_fragment_refresh'); // Update other cart details
            },
            error: function(xhr, status, error) {
                console.log('AJAX error:', status, error); // Log any errors for debugging
            }
        });
    });
});



