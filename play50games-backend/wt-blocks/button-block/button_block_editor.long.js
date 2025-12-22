(function(blocks, element, data, editor, components, blockEditor) {

    //set vars
    var el                  = element.createElement,
        Fragment            = element.Fragment,
        InspectorControls   = blockEditor.InspectorControls,
        SelectControl       = components.SelectControl;

    //register block
    blocks.registerBlockType('wt/button-block', {

        //set basic info
        title: 'Button Block',
        icon: 'button',
        category: 'play50games-blocks',
        example: {},

        //define required attributes
        attributes: {
            content: {
                type: 'string',
                source: 'html',
                selector: 'p',
            },
            button_text: {
                type: 'string'
            },
            
            button_style: {
                type: 'string'
            },
            button_Link: {
                type: 'string'
            },
            
            align_button: {
                type: 'string'
            },
            
            link_open_tab: {
                type: 'string'
            },

            text_color: {
                type: 'string'
            },
            
            background_color: {
                type: 'string'
            },

            space_bottom: {
                type: 'string',
            },

            space_top: {
                type: 'string',
            },
            class_name: {
                type: 'string'
            },
            
        },

        //set edit function
        edit: function(props) {
     

            if(!props.attributes.space_top)
            {
                props.setAttributes({space_top: "yes"})
            }

            if(!props.attributes.space_bottom)
            {
                props.setAttributes({space_bottom: "yes"})
            }


            if(!props.attributes.background_color)
            {
                props.setAttributes({background_color: "white"})
            }

            if(!props.attributes.text_color)
            {
                props.setAttributes({text_color: "black"})
            }
            
            const space_bottom = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];

            const space_top = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];
            
            
            function update_button_style (newValue) {
                props.setAttributes( { button_style: newValue } );
            }
            
            function update_align_button (newValue) {
                props.setAttributes( { align_button: newValue } );
            }

            function update_content_button_text (event) {
                props.setAttributes( {button_text: event.target.value} )
            }
            function update_content_button_Link (event) {
                props.setAttributes( {button_Link: event.target.value} )
            }
            
            function update_link_open_tab (newValue) {
                props.setAttributes( { link_open_tab: newValue } );
            }

            function update_space_bottom (newValue) {
                props.setAttributes( { space_bottom: newValue } )
            }

            function update_space_top (newValue) {
                props.setAttributes( { space_top: newValue } )
            }
            function update_background_color (newValue) {
                props.setAttributes( {background_color: newValue } )
            }
            
            function update_text_color (newValue) {
                props.setAttributes( { text_color: newValue } )
            }


            return (
                el(Fragment, null,
                    el(InspectorControls, {class: "play50games-SelectControl"},

                        el("div", { class: "webthiker-block-sidebar-element" },
                            
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
                            
                            
                            el("strong", null, "Button-Ausrichtung"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.align_button,
                                    options: [
                                        {
                                            value: 'start',
                                            label: 'Links'
                                        },
                                        {
                                            value: 'end',
                                            label: 'Rechts'
                                        },
                                        {
                                            value: 'center',
                                            label: 'Zentriert'
                                        },
                                    ],
                                    onChange: update_align_button
                                }
                            ),
                            

                            
                            el("strong", null, "Hintergrundfarbe"),
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.background_color,
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
                            id: "button-block",
                            class: "webthiker-block text-color-" + props.attributes.text_color  + " bg-color-" + props.attributes.background_color
                            
                        },
                        el("h3", null, "Button Block"),

                        el("dl", null,

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
                                        }
                                    )
                                ),
                            
                            el("dt", null,
                                el("span", null, "Button Link"),
                            ),

                            el("dd", null,
                                el("input", {
                                        type: "text",
                                        value: props.attributes.button_Link,
                                        placeholder: "Hier schreiben …",
                                        onChange: update_content_button_Link
                                    }
                                )
                            ),
                            
                            el("dt", null,
                                el("span", null, "Link öffnen"),
                            ),
              
                            el(SelectControl,
                                {
                                    label: '',
                                    value: props.attributes.link_open_tab,
                                    options: [
                                        {
                                            value: '_self',
                                            label: 'Im selben Tab öffnen',
                                        },
                                        {
                                            value: '_blank',
                                            label: 'In neuem Tab öffnen',
                                        },
                                    
                                    ],
                                    onChange: update_link_open_tab
                                }
                            ),
                        
                        
                        
                        )
                    )
                )
            );
        },
        
        //set save function
        save: function( props ) {
            
            return null;
        }
        
    });
}(
    window.wp.blocks,
    window.wp.element,
    window.wp.data,
    window.wp.editor || window.wp.blockEditor,
    window.wp.components,
    window.wp.blockEditor
));