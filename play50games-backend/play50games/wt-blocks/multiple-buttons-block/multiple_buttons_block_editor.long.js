(function(blocks, element, data, editor, components, blockEditor) {
    var el = element.createElement,
        Fragment = element.Fragment,
        InspectorControls = blockEditor.InspectorControls,
        SelectControl = components.SelectControl,
        Button = components.Button,
        MediaUpload = blockEditor.MediaUpload;
    
    blocks.registerBlockType('wt/multiple-buttons-block', {
        title: 'Multiple Buttons Block',
        icon: 'button',
        category: 'play50games-blocks',
        example: {},
        
        attributes: {
            buttons: {
                type: 'array',
                default: []
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
                type: 'string'
            },
            space_top: {
                type: 'string'
            },
            class_name: {
                type: 'string'
            },
        },

        edit: function(props) {
            const { attributes, setAttributes } = props;
            
            // Defaults
            if (!attributes.space_top) setAttributes({ space_top: "yes" });
            if (!attributes.space_bottom) setAttributes({ space_bottom: "yes" });
            if (!attributes.background_color) setAttributes({ background_color: "white" });
            if (!attributes.text_color) setAttributes({ text_color: "black" });
            
            // Button handlers
            function addButton() {
                const newButtons = [...attributes.buttons, {
                    text: '',
                    link: '',
                    target: '_self',
                    icon_type: 'none',
                    icon_text: '',
                    icon_image: null,
                    button_style: 'full'
                }];
                setAttributes({ buttons: newButtons });
            }
            function updateButton(index, field, value) {
                const newButtons = [...attributes.buttons];
                newButtons[index][field] = value;
                setAttributes({ buttons: newButtons });
            }
            function removeButton(index) {
                const newButtons = [...attributes.buttons];
                newButtons.splice(index, 1);
                setAttributes({ buttons: newButtons });
            }
            function moveButtonUp(index) {
                if (index === 0) return;
                const newButtons = [...attributes.buttons];
                [newButtons[index - 1], newButtons[index]] = [newButtons[index], newButtons[index - 1]];
                setAttributes({ buttons: newButtons });
            }
            function moveButtonDown(index) {
                if (index === attributes.buttons.length - 1) return;
                const newButtons = [...attributes.buttons];
                [newButtons[index + 1], newButtons[index]] = [newButtons[index], newButtons[index + 1]];
                setAttributes({ buttons: newButtons });
            }
            
            const spaceOptions = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' },
            ];
            
            return (
                el(Fragment, null,
                    el(InspectorControls, { class: "play50games-SelectControl" },
                        el("div", { class: "webthiker-block-sidebar-element" },
                            
                            el("strong", null, "Button-Ausrichtung"),
                            el(SelectControl, {
                                value: attributes.align_button,
                                options: [
                                    { value: 'start', label: 'Links' },
                                    { value: 'end', label: 'Rechts' },
                                    { value: 'center', label: 'Zentriert' },
                                ],
                                onChange: (val) => setAttributes({ align_button: val })
                            }),
                            
                            el("strong", null, "Hintergrundfarbe"),
                            el(SelectControl, {
                                value: attributes.background_color,
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
                                onChange: (val) => setAttributes({ background_color: val })
                            }),
                            
                            el("strong", null, "Textfarbe"),
                            el(SelectControl, {
                                value: attributes.text_color,
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
                                onChange: (val) => setAttributes({ text_color: val })
                            }),
                            
                            el("dt", null, "Abstand unten"),
                            el(SelectControl, {
                                value: attributes.space_top,
                                options: spaceOptions,
                                onChange: (val) => setAttributes({ space_top: val })
                            }),
                            
                            el("dt", null, "Abstand unten"),
                            el(SelectControl, {
                                value: attributes.space_bottom,
                                options: spaceOptions,
                                onChange: (val) => setAttributes({ space_bottom: val })
                            }),
                        )
                    ),
                    
                    el("div", {
                            class: "webthiker-block text-color-" + attributes.text_color + " bg-color-" + attributes.background_color
                        },
                        el("h3", null, "Multiple Buttons"),
                        
                        attributes.buttons.map((btn, index) =>
                            el("div", { key: index, class: "button-item" },
                                
                                // Choose icon type
                                el("label", null, "Icon Typ"),
                                el(SelectControl, {
                                    value: btn.icon_type || 'none',
                                    options: [
                                        { value: 'none', label: 'Keine'  },
                                        { value: 'text', label: 'Textklasse' },
                                        { value: 'image', label: 'Bild-Upload' },
                                    ],
                                    onChange: (val) => updateButton(index, 'icon_type', val)
                                }),
                                
                                // Text Icon
                                btn.icon_type === 'text' && el("input", {
                                    type: "text",
                                    value: btn.icon_text,
                                    placeholder: "Icon class (e.g. fa fa-user)",
                                    onChange: (e) => updateButton(index, 'icon_text', e.target.value)
                                }),
                                
                                // Image Icon
                                btn.icon_type === 'image' && el("div", { class: "icon-upload" },
                                    btn.icon_image && el("img", { src: btn.icon_image.url, style: { maxWidth: "40px", marginRight: "5px" } }),
                                    el(MediaUpload, {
                                        onSelect: (media) => updateButton(index, 'icon_image', { id: media.id, url: media.url }),
                                        allowedTypes: ['image'],
                                        render: ({ open }) => el(Button, { onClick: open, isSecondary: true }, btn.icon_image ? "Bild ersetzen" : "Bild hochladen")
                                    }),
                                    btn.icon_image && el(Button, { isDestructive: true, onClick: () => updateButton(index, 'icon_image', null) }, "Entfernen")
                                ),
                                
                                // Button text/link/target
                                el("input", {
                                    type: "text",
                                    value: btn.text,
                                    placeholder: "Button Text",
                                    onChange: (e) => updateButton(index, 'text', e.target.value)
                                }),
                                el("input", {
                                    type: "text",
                                    value: btn.link,
                                    placeholder: "Button Link",
                                    onChange: (e) => updateButton(index, 'link', e.target.value)
                                }),
                                el(SelectControl, {
                                    value: btn.target,
                                    options: [
                                        { value: '_self', label: 'Im selben Tab öffnen' },
                                        { value: '_blank', label: 'In neuem Tab öffnen' },
                                    ],
                                    onChange: (val) => updateButton(index, 'target', val)
                                }),
                                
                                el("label", null, "Button-Stil"),
                                el(SelectControl, {
                                    value: btn.button_style || 'full',
                                    options: [
                                        { value: 'full', label: 'Voll' },
                                        { value: 'outline', label: 'Umriss' },
                                    ],
                                    onChange: (val) => updateButton(index, 'button_style', val)
                                }),
                                
                                
                                // Move/Remove
                                el("div", { class: "button-controls" },
                                    el(Button, { isSecondary: true, onClick: () => moveButtonUp(index) }, "↑"),
                                    el(Button, { isSecondary: true, onClick: () => moveButtonDown(index) }, "↓"),
                                    el(Button, { isDestructive: true, onClick: () => removeButton(index) }, "Entfernen")
                                )
                            )
                        ),
                        
                        el(Button, { isPrimary: true, onClick: addButton }, "Neuen Button hinzufügen")
                    )
                )
            );
        },
        
        save: function() {
            return null; // rendered in PHP
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
