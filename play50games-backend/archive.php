<?php
global $wp_query;
get_header();
?>

<?php
// Arkivat: titulli i seksionit
if ( is_category() ) {
    echo '<header class="container newsroom-container-header pt-3">';
    echo '<p class="newsroom-container-title pb-3">'
        . __( "Category Archives", "play50games" )
        . ' "' . single_cat_title( '', false ) . '"'
        . '</p><hr class="horizontal-line"/>';
    echo '</header>';
} elseif ( is_author() ) {
    echo '<header class="container newsroom-container-header pt-3">';
    echo '<p class="newsroom-container-title">'
        . __( "Author Archives", "play50games" )
        . ' "' . get_the_author() . '"'
        . '</p><hr class="horizontal-line"/>';
    echo '</header>';
} elseif ( is_tag() ) {
    echo '<header class="container newsroom-container-header pt-3">';
    echo '<p class="newsroom-container-title">'
        . single_tag_title( '', false )
        . '</p><hr class="horizontal-line"/>';
    echo '</header>';
} elseif ( is_day() ) {
    echo '<header class="container newsroom-container-header pt-3">';
    echo '<p class="newsroom-container-title date">'
        . __( "Monthly Archives", "play50games" )
        . ' "' . get_the_date( 'F Y' ) . '"'
        . '</p><hr class="horizontal-line"/>';
    echo '</header>';
} elseif ( is_year() ) {
    echo '<header class="container newsroom-container-header pt-3">';
    echo '<p class="newsroom-container-title date">'
        . __( "Yearly Archives", "play50games" )
        . ' "' . get_the_date( 'Y' ) . '"'
        . '</p><hr class="horizontal-line"/>';
    echo '</header>';
}
?>

<?php
// Nëse kjo është faqja statike e postimeve, shfaq edhe përmbajtjen e saj
if ( is_home() && ! is_front_page() ) {
    $posts_page_id = get_option( 'page_for_posts' );
    if ( $posts_page_id ) {
        $posts_page = get_post( $posts_page_id );
        echo '<div class="container newsroom-container-header pt-3 pb-4">';
        echo apply_filters( 'the_content', $posts_page->post_content );
        echo '</div>';
    }
}
?>

<div class="newsroom-container">
    <div class="content-area">
        <div id="main" class="site-main">

            <?php if ( have_posts() ) : ?>

                <ul id="hexGrid" class="pb-5">
                    <?php while ( have_posts() ) : the_post();
                        $url   = get_permalink();
                        $thumb = get_the_post_thumbnail_url( get_the_ID(), 'medium' );
                        $author_name = get_the_author_meta( 'display_name' );
                        $cats = get_the_category();
                        $cats_output = [];
                        if ( $cats ) {
                            foreach ( $cats as $cat ) {
                                $cats_output[] = '<span class="category-item">'
                                    . esc_html( $cat->name )
                                    . '</span>';
                            }
                        }
                        $cats_list = implode( ', ', $cats_output );
                        ?>
                        <li class="hex">

                                <div class="hexIn">
                                    <a href="<?php echo esc_url( $url ); ?>" class="hex-link">
                                    <?php if ( $thumb ) : ?>
                                        <img src="<?php echo esc_url( $thumb ); ?>"
                                             alt="<?php the_title_attribute(); ?>" />
                                    <?php endif; ?>

                                    <h2 class="wt-h3"><?php the_title(); ?></h2>

                                        <p class="hex-in-description">
                                            <?php echo wp_trim_words( get_the_excerpt(), 18, '...' ); ?>
                                        </p>

                                        <span class="hex-btn"><?php echo __( 'Lire la suite', 'play50games' ); ?></span>
                                    </a>
                                </div>

                        </li>
                    <?php endwhile; ?>
                </ul>

                <?php
                // Pagination
                $total_pages  = $wp_query->max_num_pages;
                if ( $total_pages > 1 ) {
                    $current_page = max( 1, get_query_var( 'paged' ) );
                    echo '<div class="pagination pb-5">';
                    echo paginate_links( [
                        'base'      => get_pagenum_link( 1 ) . '%_%',
                        'format'    => '/page/%#%',
                        'current'   => $current_page,
                        'total'     => $total_pages,
                        'prev_text' => '<i class="bi bi-chevron-left"></i>',
                        'next_text' => '<i class="bi bi-chevron-right"></i>',
                    ] );
                    echo '</div>';
                }
                ?>

            <?php else : ?>
                <?php get_template_part( 'template-parts/content', 'none' ); ?>
            <?php endif; ?>

        </div><!-- #main -->
    </div><!-- .content-area -->
</div><!-- .newsroom-container -->

<?php get_footer(); ?>
