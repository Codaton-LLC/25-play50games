domRdy(function() {
// console.log('loaded');
    // event click for accordions
    jQuery(".acc-box .click-area").on("click", function (e) {

        console.log('clicker');
        // get/set vars
        let allBoxes    = jQuery(".acc-block .accWrapper .acc-box");
        let isBox       = jQuery(e.target).hasClass("acc-box");
        let jbox = "";

        // check if target is the the accordion tab
        if(isBox)
        {
            jbox = jQuery(e.target);
        }
        else
        {
            jbox = jQuery(e.target).closest(".acc-box");
        }

        // check if element has active class
        let check = jbox.hasClass("active");

        // toggle active class
        if(!check)
        {
            allBoxes.removeClass("active");
            jbox.addClass("active");
        }
        else
        {
            jbox.removeClass("active");
        }
    });
});