// native dom ready function
var domRdy = function(fn) {

    //sanity check
    if(typeof fn !== "function") {
        return;
    }

    //if document is already loaded, run method
    if(document.readyState === "complete") {
        return fn();
    }

    //otherwise, wait until document is loaded
    document.addEventListener("DOMContentLoaded",fn,false);
};

domRdy(function() {

    /* Functions for CPT Slider */
    // click for slider accordions
    jQuery(document).on("click","div.postbox .cpt-element .click-area", function (e) {

        // vars
        let sBox = jQuery(e.currentTarget.parentElement);

        // check if element has active class
        let check = sBox.hasClass("active");

        // toggle active class
        if(!check)
        {
            sBox.addClass("active");
        }
        else
        {
            sBox.removeClass("active");
        }
    })
    ;

    // event handler for select change "option" (link / box-text)
    jQuery(document).on("change","#slider_fields_meta_box select.slider-option",function (e) {

        // get/set vars
        let option        = jQuery( this ).val();
        let parent        = jQuery( e.currentTarget ).closest(".content-area");

        // toggle active class
        if(option === "link")
        {
            parent.removeClass("boxtext");
            parent.addClass("link");
        }
        else if(option === "boxtext")
        {
            parent.removeClass("link");
            parent.addClass("boxtext");
        }
    });


    jQuery(document).on("change","input.boxtextstyle2",function (e) {

        // get/set vars
        let option        = jQuery( this ).prop('checked');
        let parent        = jQuery( e.currentTarget ).closest(".slider-option-boxtext");

        // toggle active class
        if(option)
        {
            parent.addClass("boxtextstyle2");
        }
        else
        {
            parent.removeClass("boxtextstyle2");
        }
    });

// image selection popup - image button is clicked
    jQuery(document).on("click",
        '#squares_fields_meta_box .image-upload, ' +
        '#squares_fields_meta_box .image-upload-2, ' +
        '#teasers_fields_meta_box .image-upload, ' +
        '#icons_fields_meta_box .image-upload, ' +
        '#testimonials_fields_meta_box .image-upload, ' +
        '#testimonials_fields_meta_box .image-upload-2, ' +
        '#flags_fields_meta_box .image-upload '
        , function(e) {
            // prevents default action
            e.preventDefault();

            // get/set data
            let meta_image_frame, meta_image_preview, meta_image_id, meta_image;
            let target = jQuery(e.currentTarget);

            // get data attributes
            let id          = target.data("id");
            let imgsource   = target.hasClass('image-upload-3') ? 'meta-image-3' : (target.hasClass('image-upload-2') ? 'meta-image-2' : target.data("imgsource"));

            if (imgsource === 'meta-image-3') {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview-3 img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id-3");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image-3");
            } else if (imgsource === 'meta-image-2') {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview-2 img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id-2");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image-2");
            } else {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image");
            }

            // sets up the media library frame
            meta_image_frame = wp.media({
                title: 'Select Media',
                multiple : false,
                library : {
                    type : 'image',
                }
            });

            // image is selected
            meta_image_frame.on('select', function() {

                // Grabs the attachment selection and creates a JSON representation of the model
                let media_attachment = meta_image_frame
                    .state()
                    .get('selection')
                    .first()
                    .toJSON();

                // Sends the attachment URL to custom image input field
                meta_image_id.val(media_attachment.id);
                meta_image.val(media_attachment.url);
                meta_image_preview.attr('src', media_attachment.url);
            });

            // open the media library frame
            meta_image_frame.open();
        });
// END - image selection popup

// image selection remove - image-remove button is clicked
    jQuery(document).on("click",
        '#squares_fields_meta_box .image-upload-remove, ' +
        '#squares_fields_meta_box .image-upload-remove-2, ' +
        '#teasers_fields_meta_box .image-upload-remove, ' +
        '#icons_fields_meta_box .image-upload-remove, ' +
        '#testimonials_fields_meta_box .image-upload-remove, ' +
        '#testimonials_fields_meta_box .image-upload-remove-2, ' +
        '#flags_fields_meta_box .image-upload-remove '
        , function(e) {
            console.log('button removed clicked');
            // prevents default action
            e.preventDefault();

            // get/set data
            let meta_image_preview, meta_image_id, meta_image;
            let target = jQuery(e.currentTarget);

            // get data attributes
            let id          = target.data("id");
            let imgsource   = target.hasClass('image-upload-remove-3') ? 'meta-image-3' : (target.hasClass('image-upload-remove-2') ? 'meta-image-2' : target.data("imgsource"));

            if (imgsource === 'meta-image-3') {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview-3 img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id-3");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image-3");
            } else if (imgsource === 'meta-image-2') {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview-2 img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id-2");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image-2");
            } else {
                meta_image_preview  = jQuery("#box-wrapper-"+id+" .image-preview img");
                meta_image_id       = jQuery("#box-wrapper-"+id+" .meta-image-id");
                meta_image          = jQuery("#box-wrapper-"+id+" .meta-image");
            }

            meta_image_preview.attr("src", "");
            meta_image_id.val("");
            meta_image.val("");
        });
// END - image selection remove





    // sort Functions
    // after click on down
    jQuery(document).on('click',
        '#wt-wrapper-squares .sort-down, ' +
        '#wt-wrapper-flags .sort-down, ' +
        '#wt-wrapper-icons .sort-down, ' +
        '#wt-wrapper-testimonials .sort-down',
        function(e) {
            console.log("down");
            let c_card = jQuery(this).closest('.cpt-element');
            let t_card= c_card.next('.cpt-element');

            c_card.insertAfter(t_card);

            setButtons();
            resetSort();
        });

    // after click on up
    jQuery(document).on('click',
        '#wt-wrapper-squares .sort-up, ' +
        '#wt-wrapper-flags .sort-up, ' +
        '#wt-wrapper-icons .sort-up, ' +
        '#wt-wrapper-testimonials .sort-up', function(e) {
            console.log("up");
            let c_card = jQuery(this).closest('.cpt-element');
            let t_card= c_card.prev('.cpt-element');

            c_card.insertBefore(t_card);

            setButtons();
            resetSort();
        });


    /* Functions for CPT */
    // remove element
    jQuery(document).on('click', '.remove', function() {

        var type = jQuery(this).data("type");

        if(type === "cpt-element")
        {
            jQuery(this).closest('.cpt-element').remove();
        }
        else
        {
            jQuery(this).closest('.slider').remove();
            jQuery(this).closest('.squares').remove();
        }
    });
    /* END - Functions for CPT */

    /* END - DOM-Ready */
});

/* Functions for CPT */
function getExistingElements(nameOfElement){

    let count = jQuery(nameOfElement).length;

    return count+1;
}