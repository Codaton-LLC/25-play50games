( function ( wp, blocks, element, data ) {

    var el                  = element.createElement,
        registerBlockType   = blocks.registerBlockType,
        withSelect          = data.withSelect,
        SelectControl       = wp.components.SelectControl,
        Fragment            = wp.element.Fragment,
        InspectorControls   = wp.blockEditor.InspectorControls;

    registerBlockType( 'wt/testimonials-block', {
        title: 'Testimonials Block',
        icon: 'editor-kitchensink',
        category: 'play50games-blocks',
        description: "Testimonial Block",
        example: {},

        attributes: {
            post_id: {
                type: 'string'
            },
            layout: {
                type: 'string'
            },
            space_top: {
                type: 'string',
            },
            space_bottom: {
                type: 'string',
            },
        },

        edit: withSelect( function ( select ) {

            var query = {
                orderby : 'title',
                order : 'asc',
                per_page: -1,
            }

            return {
                posts: select( 'core' ).getEntityRecords( 'postType', 'testimonials', query ),
            };
        } )( function ( props ) {

            const space_bottom = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            const space_top = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            if(!props.attributes.space_top)
            {
                props.setAttributes({space_top: "yes"})
            }

            if(!props.attributes.space_bottom)
            {
                props.setAttributes({space_bottom: "yes"})
            }


            var options = [];

            if( props.posts )
            {
                options.push( { value: 0, label: 'Auswählen…' } );

                props.posts.forEach((post) => {

                    options.push({value:post.id, label:post.title.raw });
                });
            }
            else
            {
                options.push( { value: 0, label: 'Wird geladen…' } )
            }

            function on_change_post( newContent ) {
                props.setAttributes( { post_id: newContent } );
            }

            function update_layout (newValue) {
                props.setAttributes( { layout: newValue } )
            }

            function update_space_bottom (newValue) {
                props.setAttributes( { space_bottom: newValue } )
            }

            function update_space_top (newValue) {
                props.setAttributes( { space_top: newValue } )
            }

            return (
                el(Fragment, null,
                    el(InspectorControls, {class: "play50games-SelectControl"},

                        el("div",
                            {
                                class: "webthiker-block-sidebar-element"
                            },
                            el("strong", null, "Layout"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.layout,
                                    options: [
                                        {
                                            value: 'container',
                                            label: 'Container'
                                        },
                                        {
                                            value: 'container-full',
                                            label: 'Volle Breite'
                                        }
                                    ],
                                    onChange: update_layout
                                }
                            ),
                            el("dt", null, "Abstand unten"),
                            el(SelectControl, {
                                value: props.attributes.space_top,
                                options: space_top,
                                onChange: update_space_top
                            }),

                            el("dt", null, "Abstand unten"),
                            el(SelectControl, {
                                value: props.attributes.space_bottom,
                                options: space_bottom,
                                onChange: update_space_bottom
                            }),

                        )
                    ),

                    el("div", {
                            class: "webthiker-block worker-block count-"+ props.attributes.number
                        },
                        el("h3", null, "Testimonial-Block"),

                        el("dl", null,

                            el("div", null,

                                el("dt", null, "Testimonial choose"),
                                el("dd", null,
                                    el(SelectControl, {
                                        value: props.attributes.post_id,
                                        options: options,
                                        onChange: on_change_post,
                                    })
                                ),
         
                            ),
                        ),
                    )
                )
            );
        }),

        //set save function
        save: function( props ) {

            return null;
        }

    });
} )(
    window.wp,
    window.wp.blocks,
    window.wp.element,
    window.wp.data,
    window.wp.blockEditor
);