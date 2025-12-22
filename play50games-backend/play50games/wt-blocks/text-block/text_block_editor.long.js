(function(blocks, element, data, editor, components, blockEditor) {

    var el = element.createElement,
        Fragment = element.Fragment,
        RichText = blockEditor.RichText,
        InspectorControls = blockEditor.InspectorControls,
        useBlockProps = blockEditor.useBlockProps,
        SelectControl = components.SelectControl,
        InnerBlocks = blockEditor.InnerBlocks;

    blocks.registerBlockType('wt/text-block', {
        title: 'Text Block',
        icon: 'format-quote',
        category: 'tripsim-blocks',
        description: '',
        example: {},

        attributes: {
            // Simple RichText content (used when text_style === 'sRichText')
            content: {
                type: 'string',
                source: 'html',
                selector: 'p.wp-block-wt-text-block',
            },
            // Raw HTML content (used when text_style === 'sHtml')
            text_html: {
                type: 'string'
            },

            // Mode switcher to hide/show the content UI
            text_style: {
                type: 'string'
            }, // 'sInnerBlock' | 'sHtml' | 'sRichText'

            headline: {
                type: 'string'
            },
            sub_headline: {
                type: 'string'
            },
            headline_color: {
                type: 'string'
            },
            headline_font_weight: {
                type: 'string'
            },
            class_name: {
                type: 'string'
            },
            select_field: {
                type: 'string'
            },
            select_headline_type: {
                type: 'string'
            },
            select_headline_style: {
                type: 'string'
            },
            select_sub_headline_type: {
                type: 'string'
            },
            text_select_field: {
                type: 'string'
            },
            two_columns: {
                type: 'string'
            },
            background_color: {
                type: 'string'
            },
            text_color: {
                type: 'string'
            },
            space_bottom: {
                type: 'string'
            },
            space_top: {
                type: 'string'
            },
            margin_top: {
                type: 'string'
            },
            show_button: {
                type: 'string'
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
            link_open_tab: {
                type: 'string'
            },
        },

        edit: function(props) {
            // defaults
            if (!props.attributes.text_style) props.setAttributes({ text_style: 'sRichText' }); // default to InnerBlocks
            if (!props.attributes.space_top) props.setAttributes({ space_top: 'yes' });
            if (!props.attributes.space_bottom) props.setAttributes({ space_bottom: 'yes' });
            if (!props.attributes.show_button) props.setAttributes({ show_button: 'no' });
            if (!props.attributes.two_columns) props.setAttributes({ two_columns: '0' });
            if (!props.attributes.select_headline_color) props.setAttributes({ select_headline_color: 'wt-font-color-black' });
            if (!props.attributes.background_color) props.setAttributes({ background_color: 'gray' });
            if (!props.attributes.text_color) props.setAttributes({ text_color: 'black' });

            var mode                = props.attributes.text_style;
            var content             = props.attributes.content,
                select_field        = props.attributes.select_field,
                text_select_field   = props.attributes.text_select_field;

            const space_bottom = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' }
            ];
            const space_top = [
                { value: 'yes', label: 'Ja' },
                { value: 'no', label: 'Nein' }
            ];
            const show_button = [
                { value: 'no', label: 'Nein' },
                { value: 'yes', label: 'Ja' }
            ];

            // updaters
            function update_content(newContent) {
                props.setAttributes({ content: newContent });
            }
            function update_select_field(newValue) {
                props.setAttributes({ select_field: newValue });
            }
            function update_content(newValue) {
                props.setAttributes({ content: newValue });
            }

            function update_select_field(newValue) {
                props.setAttributes({ select_field: newValue });
            }

            function update_select_headline_type(newValue) {
                props.setAttributes({ select_headline_type: newValue });
            }

            function update_select_headline_style(newValue) {
                props.setAttributes({ select_headline_style: newValue });
            }

            function update_select_sub_headline_type(newValue) {
                props.setAttributes({ select_sub_headline_type: newValue });
            }

            function update_headline_font_weight(newValue) {
                props.setAttributes({ headline_font_weight: newValue });
            }

            function update_text_select_field(newValue) {
                props.setAttributes({ text_select_field: newValue, class_name: newValue });
            }

            function update_content_headline(newValue) {
                props.setAttributes({ headline: newValue });
            }

            function update_margin_top(newValue) {
                props.setAttributes({ margin_top: newValue });
            }

            function update_content_sub_headline(newValue) {
                props.setAttributes({ sub_headline: newValue });
            }

            function update_text_style(newValue) {
                props.setAttributes({ text_style: newValue });
            }

            function update_text_html(newValue) {
                props.setAttributes({ text_html: newValue });
            }

            function update_content_two_columns(newValue) {
                props.setAttributes({ two_columns: newValue });
            }

            function update_background_color(newValue) {
                props.setAttributes({ background_color: newValue });
            }

            function update_text_color(newValue) {
                props.setAttributes({ text_color: newValue });
            }

            function update_show_button(newValue) {
                props.setAttributes({ show_button: newValue });
            }

            function update_space_bottom(newValue) {
                props.setAttributes({ space_bottom: newValue });
            }

            function update_space_top(newValue) {
                props.setAttributes({ space_top: newValue });
            }

            function update_content_button_text(newValue) {
                props.setAttributes({ button_text: newValue });
            }

            function update_content_button_Link(newValue) {
                props.setAttributes({ button_Link: newValue });
            }

            function update_button_style(newValue) {
                props.setAttributes({ button_style: newValue });
            }

            function update_link_open_tab(newValue) {
                props.setAttributes({ link_open_tab: newValue });
            }

            // Render the body editor area based on mode
            function renderBodyEditor() {
                if (mode === 'sInnerBlock') {
                    return el(Fragment, null,
                        el('dt', { class: 'TextRichText' }, 'Formatierter Inhalt (Absätze & Listen)'),
                        el('dd', { class: 'TextRichText' },
                            el(InnerBlocks, {
                                allowedBlocks: ['core/paragraph', 'core/list'],
                                templateLock: false
                            })
                        )
                    );
                }
                if (mode === 'sHtml') {
                    return el(Fragment, null,
                        el('dt', { class: 'text_html' }, 'HTML'),
                        el('dd', { class: 'text_html' },
                            el('textarea', {
                                placeholder: 'Write HTML here...',
                                value: props.attributes.text_html || '',
                                onChange: update_text_html
                            })
                        )
                    );
                }
                // sRichText
                return el(Fragment, null,
                    el('dt', { class: 'simple_richtext' }, 'Einfacher RichText'),
                    el('dd', { class: 'simple_richtext' },
                        el(RichText, {
                            tagName: 'div',
                            className: 'simple-richtext',
                            value: content,
                            onChange: update_content,
                            placeholder: 'Hier schreiben …'
                        })
                    )
                );
            }

            return (
                el(Fragment, null,
                    // Sidebar
                    el(InspectorControls, { class: 'webthinker-SelectControl' },
                        el('div', { class: 'webthinker-block-sidebar-element' },

                            el('strong', null, 'Überschriftentyp'),
                            el(SelectControl, {
                                value: props.attributes.select_headline_type,
                                options: [
                                    { value: 'h1', label: 'H1' },
                                    { value: 'h2', label: 'H2' },
                                    { value: 'h3', label: 'H3' },
                                    { value: 'h4', label: 'H4' },
                                    { value: 'h5', label: 'H5' },
                                    { value: 'h6', label: 'H6' },
                                    { value: 'p', label: 'P' }
                                ],
                                onChange: update_select_headline_type
                            }),

                            el('strong', null, 'Überschrift Style'),
                            el(SelectControl, {
                                value: props.attributes.select_headline_style,
                                options: [{ value: 'style_1', label: 'Style 1' }, { value: 'style_2', label: 'Style 2' }],
                                onChange: update_select_headline_style
                            }),

                            el('strong', null, 'Schriftstärke der Überschrift'),
                            el(SelectControl, {
                                value: props.attributes.headline_font_weight,
                                options: [
                                    { value: 'normal', label: 'Normal' },
                                    { value: 'medium', label: 'Medium' },
                                    { value: 'bold', label: 'Bold' }
                                ],
                                onChange: update_headline_font_weight
                            }),

                            el('strong', null, 'Unterüberschriftentyp'),
                            el(SelectControl, {
                                value: props.attributes.select_sub_headline_type,
                                options: [
                                    { value: 'h1', label: 'H1' },
                                    { value: 'h2', label: 'H2' },
                                    { value: 'h3', label: 'H3' },
                                    { value: 'h4', label: 'H4' },
                                    { value: 'h5', label: 'H5' },
                                    { value: 'h6', label: 'H6' },
                                    { value: 'p', label: 'P' }
                                ],
                                onChange: update_select_sub_headline_type
                            }),

                            el('strong', null, 'Ausrichtung der Überschrift'),
                            el(SelectControl, {
                                value: select_field,
                                options: [
                                    { value: 'left', label: 'Links' },
                                    { value: 'right', label: 'Rechts' },
                                    { value: 'center', label: 'Zentriert' },
                                    { value: 'justify', label: 'Blocksatz' }
                                ],
                                onChange: update_select_field
                            }),

                            el('strong', null, 'Textausrichtung'),
                            el(SelectControl, {
                                value: text_select_field,
                                options: [
                                    { value: 'left', label: 'Links' },
                                    { value: 'right', label: 'Rechts' },
                                    { value: 'center', label: 'Zentriert' },
                                    { value: 'justify', label: 'Blocksatz' }
                                ],
                                onChange: update_text_select_field
                            }),

                            el('strong', null, 'Hintergrundfarbe'),
                            el(SelectControl, {
                                value: props.attributes.background_color,
                                options: [
                                    { value: 'white', label: 'Weiß' },
                                    { value: 'black', label: 'Schwarz' },
                                    { value: 'primary', label: 'Primär' },
                                    { value: 'secondary', label: 'Sekundär' },
                                    { value: 'tertiary', label: 'Tertiär' },
                                    { value: 'light-green', label: 'Hellgrün' },
                                    { value: 'light-orange', label: 'Hellorange' },
                                ],
                                onChange: update_background_color
                            }),

                            el('strong', null, 'Textfarbe'),
                            el(SelectControl, {
                                value: props.attributes.text_color,
                                options: [
                                    { value: 'white', label: 'Weiß' },
                                    { value: 'black', label: 'Schwarz' },
                                    { value: 'primary', label: 'Primär' },
                                    { value: 'secondary', label: 'Sekundär' },
                                    { value: 'tertiary', label: 'Tertiär' }
                                ],
                                onChange: update_text_color
                            }),

                            el('strong', null, 'Inhalt in zwei Spalten'),
                            el(SelectControl, {
                                value: props.attributes.two_columns,
                                options: [{ value: '0', label: 'Nein' }, { value: '1', label: 'Ja' }],
                                onChange: update_content_two_columns
                            }),

                            // ===== Editor-Typ toggle that hides/shows the body editor =====
                            el('strong', null, 'Editor-Typ'),
                            el(SelectControl, {
                                value: props.attributes.text_style,
                                options: [
                                    { value: 'sRichText', label: 'Einfacher RichText' },
                                    { value: 'sInnerBlock', label: 'InnerBlocks (Absätze & Listen)' },
                                    { value: 'sHtml', label: 'HTML' },
                                ],
                                onChange: update_text_style
                            }),

                            el('dt', null, 'Abstand unten'),
                            el(SelectControl, {
                                value: props.attributes.space_top,
                                options: space_top,
                                onChange: update_space_top
                            }),

                            el('dt', null, 'Abstand unten'),
                            el(SelectControl, {
                                value: props.attributes.space_bottom,
                                options: space_bottom,
                                onChange: update_space_bottom
                            }),

                            el('dt', null, 'Button aktivieren'),
                            el(SelectControl, {
                                value: props.attributes.show_button,
                                options: show_button,
                                onChange: update_show_button
                            })
                        )
                    ),

                    // Main content
                    el('div', {
                            id: 'text-block',
                            class: 'webthinker-block ' + mode + ' text-color-' + props.attributes.text_color + ' bg-color-' + props.attributes.background_color
                        },
                        el('h3', null, 'Text-block'),

                        el('dl', null,
                            // headline
                            el('dt', null,
                                el('span', null, 'Überschrift'),
                                el('small', null, '(optional)')
                            ),
                            el('dd', null,
                                el('input', {
                                    type: 'text',
                                    value: props.attributes.headline,
                                    placeholder: 'Hier schreiben …',
                                    onChange: update_content_headline
                                })
                            ),

                            // sub headline
                            el('dt', null,
                                el('span', null, 'Sub Überschrift'),
                                el('small', null, '(optional)')
                            ),
                            el('dd', null,
                                el('input', {
                                    type: 'text',
                                    value: props.attributes.sub_headline,
                                    placeholder: 'Hier schreiben …',
                                    onChange: update_content_sub_headline }
                                )
                            ),

                            // margin top
                            el('dt', null,
                                el('span', null, 'Inhaltsabstand oben'),
                                el('small', null, '(optional)')
                            ),
                            el('dd', null,
                                el('input', {
                                    type: 'text',
                                    value: props.attributes.margin_top,
                                    placeholder: '20',
                                    onChange: update_margin_top }
                                )
                            ),

                            // ========== BODY EDITOR (hidden/shown by text_style) ==========
                            renderBodyEditor(),

                            // buttons section
                            props.attributes.show_button === 'yes' && el(
                                element.Fragment,
                                null,
                                el('dt', null,
                                    el('span', null, 'Button Text'),
                                    el('small', null, '(optional)')
                                ),
                                el('dd', null,
                                    el('input', {
                                        type: 'text',
                                        value: props.attributes.button_text,
                                        placeholder: 'Hier schreiben …',
                                        onChange: update_content_button_text }
                                    )
                                ),

                                el('dt', null,
                                    el('span', null, 'Button Link')
                                ),
                                el('dd', null,
                                    el('input', {
                                        type: 'text',
                                        value: props.attributes.button_Link,
                                        placeholder: 'Hier schreiben …',
                                        onChange: update_content_button_Link }
                                    )
                                ),

                                el('dt', null,
                                    el('span', null, 'Link öffnen')
                                ),
                                el(SelectControl, {
                                    value: props.attributes.link_open_tab,
                                    options: [
                                        { value: '_self', label: 'Im selben Tab öffnen' },
                                        { value: '_blank', label: 'In neuem Tab öffnen' }],
                                    onChange: update_link_open_tab
                                }),

                                el('strong', null, 'Button-Stil'),
                                el(SelectControl, {
                                    value: props.attributes.button_style,
                                    options: [
                                        { value: 'full-primary', label: 'Voll Primary' },
                                        { value: 'outline-primary', label: 'Umriss' },
                                        { value: 'full-outline-white', label: 'Umriss White' },
                                        { value: 'full-white', label: 'Weiß' },
                                    ],
                                    onChange: update_button_style
                                })
                            )
                        )
                    )
                )
            );
        },

        save: function (props) {
            const mode = props.attributes.text_style || 'sRichText';

            if (mode === 'sHtml') {
                return el('div', { className: 'wp-block-wt-text-block' },
                    props.attributes.text_html
                        ? el('div', { className: 'custom-html-content', dangerouslySetInnerHTML: { __html: props.attributes.text_html } })
                        : null
                );
            }

            if (mode === 'sInnerBlock') {
                return el('div', { className: 'wp-block-wt-text-block' },
                    el(blockEditor.InnerBlocks.Content)
                );

            }

            // IMPORTANT: match the legacy markup that’s already in the post
            return props.attributes.content
                ? el(RichText.Content, {
                    tagName: 'p',
                    className: 'wp-block-wt-text-block',
                    value: props.attributes.content
                })
                : el('p', { className: 'wp-block-wt-text-block' });
        }

    });

}(
    window.wp.blocks,
    window.wp.element,
    window.wp.data,
    window.wp.editor,
    window.wp.components,
    window.wp.blockEditor
));
