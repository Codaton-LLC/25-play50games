<?php
/**
 * Play50Games contact form API: POST play50/v1/contact.
 *
 * Loaded from functions.php after includes/rest-api.php (guarded by file_exists, like arcade-api.php).
 * CORS comes from the shared rest_pre_serve_request filter in rest-api.php (PLAY50_CORS_ORIGIN);
 * the API key check is the shared play50_check_api_key_permission().
 *
 * Every accepted message is stored first as a private post of the play50_contact type (admin menu
 * "Contact messages"), then mailed with wp_mail(), so a mail failure loses nothing.
 *
 * Optional wp-config.php constant: PLAY50_CONTACT_TO (recipient; default get_option('admin_email')).
 * Raw IPs are never stored: rate limits key on a salted hash, in transients (p50c_*).
 *
 * Request (JSON): name, email, subject (optional), message, website (honeypot, must be empty),
 * elapsed_ms (ms between the form being shown and the submit, from the client's own clock).
 * Responses: 200 {ok:true}; 400 invalid_data {data:{status, fields:{field: message}}} or too_fast;
 * 429 rate_limited {data:{status, retry_after}}; 500 mail_failed {data:{status, saved:true}}.
 *
 * Compatible with PHP 7.4+ and WordPress 6.x. Run `php -l` before every upload.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('PLAY50_CONTACT_MIN_MS')) {
    define('PLAY50_CONTACT_MIN_MS', 3000); // a person needs longer than this to fill the form
}

// ---------------------------------------------------------------------------
// Storage: a private, non-public post type with its own admin menu
// ---------------------------------------------------------------------------

if (!function_exists('play50_contact_register_cpt')) {
    function play50_contact_register_cpt() {
        register_post_type('play50_contact', array(
            'labels' => array(
                'name'          => 'Contact messages',
                'singular_name' => 'Contact message',
                'menu_name'     => 'Contact messages',
                'all_items'     => 'Contact messages',
                'edit_item'     => 'Contact message',
                'view_item'     => 'Contact message',
                'search_items'  => 'Search messages',
                'not_found'     => 'No messages yet.',
            ),
            'public'              => false,
            'publicly_queryable'  => false,
            'exclude_from_search' => true,
            'show_ui'             => true,
            'show_in_menu'        => true,
            'show_in_nav_menus'   => false,
            'show_in_admin_bar'   => false,
            'show_in_rest'        => false,
            'has_archive'         => false,
            'rewrite'             => false,
            'query_var'           => false,
            'menu_icon'           => 'dashicons-email',
            'menu_position'       => 26,
            'supports'            => array('title', 'editor'),
            'capability_type'     => 'post',
            'capabilities'        => array('create_posts' => 'do_not_allow'), // only the form creates them
            'map_meta_cap'        => true,
        ));
    }
    add_action('init', 'play50_contact_register_cpt');
}

if (!function_exists('play50_contact_admin_columns')) {
    function play50_contact_admin_columns($columns) {
        $out = array();
        foreach ($columns as $key => $label) {
            $out[$key] = $label;
            if ($key === 'title') {
                $out['p50c_from'] = 'From';
                $out['p50c_mail'] = 'Mail';
            }
        }
        return $out;
    }
    add_filter('manage_play50_contact_posts_columns', 'play50_contact_admin_columns');
}

if (!function_exists('play50_contact_admin_column')) {
    function play50_contact_admin_column($column, $post_id) {
        if ($column === 'p50c_from') {
            $name  = (string) get_post_meta($post_id, '_p50c_name', true);
            $email = (string) get_post_meta($post_id, '_p50c_email', true);
            echo esc_html($name) . '<br><a href="mailto:' . esc_attr($email) . '">' . esc_html($email) . '</a>';
        } elseif ($column === 'p50c_mail') {
            echo get_post_meta($post_id, '_p50c_mailed', true) === '1' ? 'Sent' : '<strong>Not sent</strong>';
        }
    }
    add_action('manage_play50_contact_posts_custom_column', 'play50_contact_admin_column', 10, 2);
}

if (!function_exists('play50_contact_meta_box')) {
    /** Read-only sender details on the edit screen. */
    function play50_contact_meta_box() {
        add_meta_box('p50c_sender', 'Sender', function ($post) {
            $name  = (string) get_post_meta($post->ID, '_p50c_name', true);
            $email = (string) get_post_meta($post->ID, '_p50c_email', true);
            $subj  = (string) get_post_meta($post->ID, '_p50c_subject', true);
            echo '<p><strong>Name:</strong> ' . esc_html($name) . '</p>';
            echo '<p><strong>Email:</strong> <a href="mailto:' . esc_attr($email) . '">' . esc_html($email) . '</a></p>';
            echo '<p><strong>Subject:</strong> ' . esc_html($subj !== '' ? $subj : '(none)') . '</p>';
            echo '<p><strong>Mail:</strong> ' . (get_post_meta($post->ID, '_p50c_mailed', true) === '1' ? 'Sent' : 'Not sent') . '</p>';
        }, 'play50_contact', 'side', 'high');
    }
    add_action('add_meta_boxes_play50_contact', 'play50_contact_meta_box');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

if (!function_exists('play50_contact_ip_hash')) {
    function play50_contact_ip_hash() {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
        $ip = (string) apply_filters('play50_contact_client_ip', $ip); // only for a trusted proxy; never read X-Forwarded-For directly
        return md5($ip . wp_salt());
    }
}

if (!function_exists('play50_contact_window')) {
    /** Fixed window on a transient. $commit false only peeks. @return int 0 = allowed, else seconds until reset. */
    function play50_contact_window($key, $limit, $window, $commit) {
        $now = time();
        $t = get_transient($key);
        if (!is_array($t) || !isset($t['count'], $t['reset']) || (int) $t['reset'] <= $now) {
            $t = array('count' => 0, 'reset' => $now + (int) $window);
        }
        if ((int) $t['count'] >= $limit) {
            return max(1, (int) $t['reset'] - $now);
        }
        if ($commit) {
            $t['count'] = (int) $t['count'] + 1;
            set_transient($key, $t, max(1, (int) $t['reset'] - $now));
        }
        return 0;
    }
}

if (!function_exists('play50_contact_rate')) {
    /** 3 per 10 minutes and 20 per day per hashed IP. @return int 0 = allowed, else seconds to wait. */
    function play50_contact_rate($commit) {
        $h = play50_contact_ip_hash();
        $short = play50_contact_window('p50c_rl_10m_' . $h, 3, 10 * MINUTE_IN_SECONDS, false);
        $day   = play50_contact_window('p50c_rl_day_' . $h, 20, DAY_IN_SECONDS, false);
        $wait  = max($short, $day);
        if ($wait || !$commit) {
            return $wait;
        }
        play50_contact_window('p50c_rl_10m_' . $h, 3, 10 * MINUTE_IN_SECONDS, true);
        play50_contact_window('p50c_rl_day_' . $h, 20, DAY_IN_SECONDS, true);
        return 0;
    }
}

if (!function_exists('play50_contact_len')) {
    function play50_contact_len($s) {
        return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
    }
}

if (!function_exists('play50_contact_one_line')) {
    /** Text for a header or a title: no line breaks, no angle brackets or quotes. */
    function play50_contact_one_line($s) {
        return trim(preg_replace('/[\r\n\t<>"]+/', ' ', (string) $s));
    }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

add_action('rest_api_init', function () {
    register_rest_route('play50/v1', '/contact', array(
        'methods'             => 'POST',
        'callback'            => 'play50_contact_submit',
        'permission_callback' => function () {
            return function_exists('play50_check_api_key_permission') ? play50_check_api_key_permission() : true;
        },
    ));
});

if (!function_exists('play50_contact_submit')) {
    function play50_contact_submit($request) {
        $body = $request->get_json_params();
        if (!is_array($body)) {
            $body = $request->get_body_params();
        }
        if (!is_array($body)) {
            $body = array();
        }
        $str = function ($key) use ($body) {
            return isset($body[$key]) && is_scalar($body[$key]) ? (string) $body[$key] : '';
        };

        // Rate limit first (peek only), so a blocked sender gets the same answer for every try.
        $wait = play50_contact_rate(false);
        if ($wait) {
            return new WP_Error('rate_limited', 'Too many messages. Please try again later.', array('status' => 429, 'retry_after' => (int) $wait));
        }

        // Honeypot: a person never sees the field. Answer as if it worked and do nothing.
        if (trim($str('website')) !== '') {
            return new WP_REST_Response(array('ok' => true), 200);
        }

        $elapsed = $str('elapsed_ms');
        if (!preg_match('/^[0-9]{1,12}$/D', $elapsed) || (int) $elapsed < PLAY50_CONTACT_MIN_MS) {
            return new WP_Error('too_fast', 'That was quick. Please check your message and send it again.', array('status' => 400));
        }

        $name    = play50_contact_one_line(sanitize_text_field($str('name')));
        $email   = sanitize_email($str('email'));
        $subject = play50_contact_one_line(sanitize_text_field($str('subject')));
        $message = trim(sanitize_textarea_field($str('message')));

        $fields = array();
        if ($name === '') {
            $fields['name'] = 'Enter your name.';
        } elseif (play50_contact_len($name) > 80) {
            $fields['name'] = 'Use 80 characters or fewer.';
        }
        if (trim($str('email')) === '') {
            $fields['email'] = 'Enter your email address.';
        } elseif ($email === '' || !is_email($email)) {
            $fields['email'] = 'Enter a valid email address.';
        }
        if (play50_contact_len($subject) > 120) {
            $fields['subject'] = 'Use 120 characters or fewer.';
        }
        $mlen = play50_contact_len($message);
        if ($mlen === 0) {
            $fields['message'] = 'Write a message.';
        } elseif ($mlen < 10) {
            $fields['message'] = 'Write at least 10 characters.';
        } elseif ($mlen > 4000) {
            $fields['message'] = 'Use 4000 characters or fewer.';
        }
        if ($fields) {
            return new WP_Error('invalid_data', 'Please check the highlighted fields.', array('status' => 400, 'fields' => $fields));
        }

        // Count only valid submits, so a typo does not use up the allowance.
        $wait = play50_contact_rate(true);
        if ($wait) {
            return new WP_Error('rate_limited', 'Too many messages. Please try again later.', array('status' => 429, 'retry_after' => (int) $wait));
        }

        // Save first: nothing is lost if mail fails.
        $title = $subject !== '' ? $subject : 'Message from ' . $name;
        $post_id = wp_insert_post(array(
            'post_type'    => 'play50_contact',
            'post_status'  => 'private',
            'post_title'   => wp_strip_all_tags($title),
            'post_content' => $message,
            'post_author'  => 0,
        ), true);
        if (is_wp_error($post_id) || !$post_id) {
            error_log('play50 contact: could not save a message: ' . (is_wp_error($post_id) ? $post_id->get_error_message() : 'unknown'));
            $post_id = 0;
        } else {
            update_post_meta($post_id, '_p50c_name', $name);
            update_post_meta($post_id, '_p50c_email', $email);
            update_post_meta($post_id, '_p50c_subject', $subject);
            update_post_meta($post_id, '_p50c_mailed', '0');
        }

        $to = defined('PLAY50_CONTACT_TO') && is_email(PLAY50_CONTACT_TO) ? PLAY50_CONTACT_TO : get_option('admin_email');
        $mail_subject = '[Play50 contact] ' . ($subject !== '' ? $subject : 'Message from ' . $name);
        $text = "Name: {$name}\nEmail: {$email}\nSubject: " . ($subject !== '' ? $subject : '(none)') . "\n\n{$message}\n";
        if ($post_id) {
            $text .= "\n--\nSaved in WordPress: Contact messages, #{$post_id}\n";
        }
        $headers = array(
            'Content-Type: text/plain; charset=UTF-8',
            'Reply-To: ' . $name . ' <' . $email . '>',
        );
        $sent = wp_mail($to, $mail_subject, $text, $headers);

        if ($sent && $post_id) {
            update_post_meta($post_id, '_p50c_mailed', '1');
        }
        if ($sent) {
            return new WP_REST_Response(array('ok' => true), 200);
        }
        if ($post_id) {
            error_log('play50 contact: wp_mail failed; message saved as #' . $post_id);
            return new WP_Error('mail_failed', 'Your message was saved, but the email could not be sent right now.', array('status' => 500, 'saved' => true));
        }
        error_log('play50 contact: wp_mail failed and the message could not be saved');
        return new WP_Error('server_error', 'Something went wrong. Please try again.', array('status' => 500, 'saved' => false));
    }
}
