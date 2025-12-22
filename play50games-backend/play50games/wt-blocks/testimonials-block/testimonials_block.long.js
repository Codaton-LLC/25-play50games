document.addEventListener('DOMContentLoaded', function () {
	const sliders = document.querySelectorAll('.testimonials-swiper');
	
	sliders.forEach(function (slider) {
		new Swiper(slider, {
			slidesPerView: 1.2,
			spaceBetween: 10,
			centeredSlides: true,
			initialSlide: 1, // force visible peek on load
			loop: true,
			updateOnWindowResize: true,
			autoplay: {
				delay: 4000,
				disableOnInteraction: false
			},
			breakpoints: {
				768: {
					slidesPerView: 1.2,
					centeredSlides: true
				},
				992: {
					slidesPerView: 2.5,
					centeredSlides: true
				},
				1200: {
					slidesPerView: 3.5,
					centeredSlides: true
				}
			},
			navigation: false,
			pagination: false,
			speed: 600
		});
	});
});
