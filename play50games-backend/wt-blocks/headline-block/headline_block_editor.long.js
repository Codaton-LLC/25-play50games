(function(blocks, element, data, editor, components, blockEditor) {

    //set vars
    var el                  = element.createElement,
        Fragment            = element.Fragment,
        RichText            = blockEditor.RichText,
        InspectorControls   = blockEditor.InspectorControls,
        MediaUpload         = blockEditor.MediaUpload,
        SelectControl       = components.SelectControl;

    //register block
    blocks.registerBlockType('wt/headline-block', {

        //set basic info
        title: 'Überschrift Block',
        icon: 'heading',
        category: 'play50games-blocks',
        description: '',
        example: {},

        //define required attributes
        attributes: {
            content: {
                type: 'string',
                source: 'html',
                selector: 'p',
            },
            headline: {
                type: 'string'
            },
            description: {
                type: 'string'
            },
            content_alignment: {
                type: 'string'
            },

            headline_color: {
                type: 'string'
            },
            class_name: {
                type: 'string'
            },

            select_headline_type: {
                type: 'string',
            },

            background_color: {
                type: 'string'
            },

            space_bottom: {
                type: 'string',
            },

            space_top: {
                type: 'string',
            }
        },

        //set edit function
        edit: function(props) {
            var image_not_present_1 = "";

            if(!props.attributes.space_top)
            {
                props.setAttributes({space_top: "yes"})
            }

            if(!props.attributes.space_bottom)
            {
                props.setAttributes({space_bottom: "yes"})
            }

            if(!props.attributes.text_style)
            {
                props.setAttributes({text_style: "sRichText"})
            }

            if (!props.attributes.two_columns)
            {
                props.setAttributes({two_columns: "0"})
            }

            if(!props.attributes.image)
            {
                props.setAttributes({image: "0"})
            }


            if (!props.attributes.select_headline_color)
            {
                props.setAttributes({select_headline_color: "wt-font-color-black"})
            }

            if(!props.attributes.background_color)
            {
                props.setAttributes({background_color: "gray"})
            }

            if(!props.attributes.text_color)
            {
                props.setAttributes({text_color: "black"})
            }




            if (!props.attributes.image_text_block) {
                image_not_present_1 = "wt-image-not-present";
            }

            var content_alignment = props.attributes.content_alignment;

            const space_bottom = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            const space_top = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            function on_change_content (newContent) {
                props.setAttributes( { content: newContent } );
            }

            function update_content_alignment (newValue) {
                props.setAttributes( { content_alignment: newValue } );
            }
            function on_change_select_headline_type (newValue) {
                props.setAttributes( { select_headline_type: newValue } );
            }
            
            function update_content_headline (event) {
                props.setAttributes( {headline: event.target.value} )
            }
            function update_content_description (event) {
                props.setAttributes( {description: event.target.value} )
            }
            
            function update_background_color (newValue) {
                props.setAttributes( { background_color: newValue } );
            }

            function update_text_color (newValue) {
                props.setAttributes( { text_color: newValue } );
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

                        el("div", { class: "webthiker-block-sidebar-element" },



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
                                    onChange: on_change_select_headline_type
                                }
                            ),
                            

                            el("strong", null, "Inhaltsausrichtung"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: content_alignment,
                                    options: [
                                        {
                                            value: 'left',
                                            label: 'Links'
                                        },
                                        {
                                            value: 'right',
                                            label: 'Rechts'
                                        },
                                        {
                                            value: 'center',
                                            label: 'Zentriert'
                                        },
                                        {
                                            value: 'justify',
                                            label: 'Blocksatz'
                                        }
                                    ],
                                    onChange: update_content_alignment
                                }
                            ),


                            el("strong", null, "Hintergrundfarbe"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.background_color,
                                    options: [
                                        {
                                            value: 'white',
                                            label: 'Weiß'
                                        },
                                        {
                                            value: 'black',
                                            label: 'Schwarz'
                                        },
                                        {
                                            value: 'gray',
                                            label: 'Grau'
                                        },
                                        {
                                            value: 'light-gray',
                                            label: 'Hellgrau'
                                        },
                                        {
                                            value: 'primary',
                                            label: 'Primär'
                                        },

                                        {
                                            value: 'secondary',
                                            label: 'Sekundär'
                                        },
                                        {
                                            value: 'tertiary',
                                            label: 'Tertiär'
                                        },
                                    ],
                                    onChange: update_background_color
                                }
                            ),

                            el("strong", null, "Textfarbe"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.text_color,
                                    options: [
                                        {
                                            value: 'black',
                                            label: 'Schwarz'
                                        },
                                        {
                                            value: 'white',
                                            label: 'Weiß'
                                        },
                                        {
                                            value: 'gray',
                                            label: 'Grau'
                                        },
                                        {
                                            value: 'light-gray',
                                            label: 'Hellgrau'
                                        },
                                        {
                                            value: 'primary',
                                            label: 'Primär'
                                        },

                                        {
                                            value: 'secondary',
                                            label: 'Sekundär'
                                        },
                                        {
                                            value: 'tertiary',
                                            label: 'Tertiär'
                                        },
                                    ],
                                    onChange: update_text_color
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

                        ),
                    ),

                    el("div", {
                            id: "headline-block",
                            class: "webthiker-block " + props.attributes.text_style + " text-color-" +props.attributes.text_color  + " bg-color-" + props.attributes.background_color
                        },
                        el("h3", null, "Überschrift-Block"),

                        el("dl", null,




                            el("dt", null,
                                el("span", null, "Überschrift"),
                                el("small", null, "(optional)")
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
                            el("dt", null,
                                el("span", null, "Beschreibung"),
                                el("small", null, "(optional)")
                            ),

                            el("dd", null,
                                el("input", {
                                        type: "text",
                                        value: props.attributes.description,
                                        placeholder: "Hier schreiben …",
                                        onChange: update_content_description
                                    }
                                )
                            ),
                        )
                    )
                )
            );
        },

        //set save function
        save: function(props) {

            return el( RichText.Content, {
                tagName: 'p', value: props.attributes.content
            } );
        }
    })
}(
    window.wp.blocks,
    window.wp.element,
    window.wp.data,
    window.wp.editor,
    window.wp.components,
    window.wp.blockEditor
));