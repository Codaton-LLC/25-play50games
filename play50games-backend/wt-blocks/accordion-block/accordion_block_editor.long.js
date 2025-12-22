( function ( wp, blocks, element, data ) {

    var el                  = element.createElement,
        Fragment            = wp.element.Fragment,
        registerBlockType   = blocks.registerBlockType,
        RichText            = wp.blockEditor.RichText,
        withSelect          = data.withSelect,
        SelectControl       = wp.components.SelectControl,
        InspectorControls   = wp.blockEditor.InspectorControls;

    registerBlockType( 'wt/accordion-block', {
        title: 'Akkordeon',
        icon: 'editor-kitchensink',
        category: 'play50games-blocks',
        description: "Akkordeon",
        example: {},

        attributes: {
            post_id: {
                type: 'string'
            },
            
            headline: {
                type: 'string'
            },
            content: {
                type: 'string',
                source: 'html',
                selector: 'p',
            },
   
            select_headline_type: {
                type: 'string',
            },
            
            button_style: {
                type: 'string'
            },
            button_text: {
                type: 'string'
            },
            
            button_link: {
                type: 'string'
            },
            link_open_tab: {
                type: 'string'
            },
            accordion_style: {
                type: 'string'
            },
            text_style: {
                type: 'string'
            },
            text_html: {
                type: 'string'
            },
            space_top: {
                type: 'string',
            },
            space_bottom: {
                type: 'string',
            },
            margin_top: {
                type: 'string',
            }
        },

        edit: withSelect( function ( select ) {

            var query = {
                orderby : 'title',
                order : 'asc',
                per_page: -1,
            }

            return {
                posts: select( 'core' ).getEntityRecords( 'postType', 'accordion', query ),
            };
        } )( function ( props ) {
            var content = props.attributes.content;

            const space_bottom = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            const space_top = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];
            
            var options = [];

            if(!props.attributes.space_top)
            {
                props.setAttributes({space_top: "yes"})
            }

            if(!props.attributes.space_bottom)
            {
                props.setAttributes({space_bottom: "yes"})
            }

            
            if(!props.attributes.number)
            {
                props.setAttributes({number: "3"})
            }
            
            if( props.posts )
            {
                options.push( { value: 0, label: 'Auswählen…' } );
                
                props.posts.forEach((post) => {
                    
                    options.push({value:post.id, label:post.title.raw });
                });
            }
            else
            {
                options.push( { value: 0, label: 'Lade...' } )
            }
            
            if(!props.attributes.text_style)
            {
                props.setAttributes({text_style: "sRichText"})
            }
            
            function on_change_post( newContent ) {
                props.setAttributes( { post_id: newContent } );
            }
            
            function update_content_headline (event) {
                props.setAttributes( {headline: event.target.value} )
            }
            
            function update_select_headline_type (newValue) {
                props.setAttributes( { select_headline_type: newValue } );
            }
            
            /* button */
            function update_button_style (newValue) {
                props.setAttributes( { button_style: newValue } );
            }
            
            function update_content_button_text (event) {
                props.setAttributes( {button_text: event.target.value} )
            }
            function update_content_button_link (event) {
                props.setAttributes( {button_link: event.target.value} )
            }
            
            function update_link_open_tab (newValue) {
                props.setAttributes( { link_open_tab: newValue } );
            }
            
            function update_accordion_style( newContent ) {
                props.setAttributes( { accordion_style: newContent } )
            }
            
            function update_text_style (newValue) {
                props.setAttributes( {text_style: newValue} )
            }
            function update_text_html (event) {
                props.setAttributes( {text_html: event.target.value} )
            }
            function update_content (newContent) {
                props.setAttributes( { content: newContent } );
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
                            
                            el("strong", null, "Akkordeon Stil"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.accordion_style,
                                    options: [
                                        {
                                            value: 'style_1',
                                            label: 'Nur Akkordeon'
                                        },
                                        {
                                            value: 'style_2',
                                            label: 'Text und Akkordeon'
                                        },
                                    ],
                                    onChange: update_accordion_style
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
                            
                            props.attributes.accordion_style === 'style_2' &&
                            el("div", { className: "accordion-style-2" },
                                /* headline */
                                
                                el("strong", null, "Überschriftentyp"),
                                el(SelectControl,
                                    {
                                        label: '',
                                        value: props.attributes.select_headline_type,
                                        options: [
                                            {
                                                value: 'h1',
                                                label: 'H1'
                                            },
                                            {
                                                value: 'h2',
                                                label: 'H2'
                                            },
                                            {
                                                value: 'h3',
                                                label: 'H3'
                                            },
                                            {
                                                value: 'h4',
                                                label: 'H4'
                                            },
                                            {
                                                value: 'h5',
                                                label: 'H5'
                                            },
                                            {
                                                value: 'h6',
                                                label: 'H6'
                                            },
                                            {
                                                value: 'p',
                                                label: 'P'
                                            }
                                        
                                        ],
                                        onChange: update_select_headline_type
                                    }
                                ),
                                
                                
                                el("strong", null, "Button-Stil"),
                                el(SelectControl,
                                    {
                                        label: '',
                                        value: props.attributes.button_style,
                                        options: [
                                            {
                                                value: 'full',
                                                label: 'Voll',
                                            },
                                            {
                                                value: 'outline',
                                                label: 'Umriss',
                                            },
                                        
                                        ],
                                        onChange: update_button_style
                                    }
                                ),
                                el("strong", null, "Editor-Typ"),
                                el(SelectControl,
                                    {
                                        label: '',
                                        value: props.attributes.text_style,
                                        options: [
                                            {
                                                value: 'sRichText',
                                                label: 'RichText'
                                            },
                                            {
                                                value: 'sHtml',
                                                label: 'HTML'
                                            }
                                        ],
                                        onChange: update_text_style
                                    }
                                ),

                            
                            )
                        ),
                    ),

                    el("div", {
                            class: "webthiker-block accordion-block count-"+  props.attributes.text_style
                        },
                        el("h3", null, "Akkordeon-Block"),

                        el("dl", null,

                            el("div", null,

                                el("dt", null, "Akkordeon auswählen"),
                                el("dd", null,
                                    el(SelectControl, {
                                        value: props.attributes.post_id,
                                        options: options,
                                        onChange: on_change_post,
                                    })
                                ),

                            ),
                            
                            props.attributes.accordion_style === 'style_2' &&
                            el("div", { className: "accordion-style-3" },
                                el("dl", null,  // wrap your dt/dd in a <dl> for semantics
                                    
                                    el("dt", null,
                                        el("span", null, "Überschrift"),
                                    ),
                                    el("dd", null,
                                        el("input", {
                                                type: "text",
                                                value: props.attributes.headline,
                                                placeholder: "Hier schreiben …",
                                                onChange: update_content_headline
                                            }
                                        )
                                    ),
                                    
                                    props.attributes.text_style == 'sRichText' ?
                                        el("div", {},
                                            
                                            el("dt", { class: "TextRichText" }, "Text"),
                                            el("dd", { class: "TextRichText" },
                                                el(RichText,
                                                    {
                                                        tagName: 'p',
                                                        class_name: props.class_name,
                                                        value: content,
                                                        onChange: update_content,
                                                        placeholder: "Hier schreiben …",
                                                    })
                                            )
                                        ): null,
                                    
                                    props.attributes.text_style == 'sHtml' ?
                                        el("div", {},
                                            el("dt", {class: "text_html"}, "HTML"),
                                            el("dd", {class: "text_html"},
                                                el("textarea", {
                                                    placeholder: "Hier schreiben …",
                                                    onChange: update_text_html
                                                }, props.attributes.text_html)
                                            )
                                        ) : null,
                                    
                                    
                                    el("dt", null,
                                        el("span", null, "Button Text"),
                                        el("small", null, "(optional)")
                                    ),
                                    el("dd", null,
                                        el("input", {
                                            type: "text",
                                            value: props.attributes.button_text,
                                            placeholder: "Hier schreiben …",
                                            onChange: update_content_button_text
                                        })
                                    ),
                                    
                                    el("dt", null, el("span", null, "Button Link")),
                                    el("dd", null,
                                        el("input", {
                                            type: "text",
                                            value: props.attributes.button_link,
                                            placeholder: "Hier schreiben …",
                                            onChange: update_content_button_link
                                        })
                                    ),
                                    
                                    el("dt", null, el("span", null, "Link öffnen")),
                                    el("dd", null,
                                        el(SelectControl, {
                                            label: '',
                                            value: props.attributes.link_open_tab,
                                            options: [
                                                { value: '_self',  label: 'Im selben Tab öffnen' },
                                                { value: '_blank', label: 'In neuem Tab öffnen' }
                                            ],
                                            onChange: update_link_open_tab
                                        })
                                    )
                                )
                            )
                        ),
                    )
                )
            );
            
        }),

        //set save function
        save: function( props ) {
            return el( RichText.Content, {
                tagName: 'p', value: props.attributes.content
            } );
        }

    });
} )(
    window.wp,
    window.wp.blocks,
    window.wp.element,
    window.wp.data,
    window.wp.blockEditor
);