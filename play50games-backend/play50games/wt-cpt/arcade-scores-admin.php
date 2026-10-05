<?php
/**
 * Arcade Scores administration. Contract: docs/arcade-api.md, sections 11–12.
 * No installation, REST routes, or global admin request handlers belong here.
 */
if (!defined("ABSPATH")) {
   exit;
}

if (!function_exists("play50_arcade_admin_menu")) {
   function play50_arcade_admin_menu() {
      add_menu_page("Arcade Scores", "Arcade Scores", "manage_options", "play50-arcade-scores", "play50_arcade_admin_render", "dashicons-awards", 8);
   }
}
add_action("admin_menu", "play50_arcade_admin_menu");

if (!function_exists("play50_arcade_admin_api_available")) {
   function play50_arcade_admin_api_available() {
      return function_exists("play50_arcade_table")
         && function_exists("play50_arcade_games")
         && function_exists("play50_arcade_clear_cache")
         && function_exists("play50_arcade_public_name");
   }
}

if (!function_exists("play50_arcade_admin_input")) {
   function play50_arcade_admin_input($source, $key) {
      return isset($source[$key]) && is_scalar($source[$key]) ? (string) wp_unslash($source[$key]) : "";
   }
}

if (!function_exists("play50_arcade_admin_slug")) {
   function play50_arcade_admin_slug($value) {
      $slug = sanitize_key($value);
      return preg_match("/^[a-z0-9-]{1,40}$/D", $slug) ? $slug : "";
   }
}

if (!function_exists("play50_arcade_admin_table_exists")) {
   function play50_arcade_admin_table_exists($table) {
      global $wpdb;
      $previous = $wpdb->suppress_errors(true);
      $found = $wpdb->get_var($wpdb->prepare("SHOW TABLES LIKE %s", $wpdb->esc_like($table)));
      $wpdb->suppress_errors($previous);
      return $found === $table;
   }
}

if (!function_exists("play50_arcade_admin_redirect")) {
   function play50_arcade_admin_redirect($notice, $game = "", $count = null) {
      $notices = array("deleted", "reset", "banned", "unbanned", "cleared", "error");
      $args = array(
         "page" => "play50-arcade-scores",
         "p50a_notice" => in_array($notice, $notices, true) ? $notice : "error"
      );
      $game = play50_arcade_admin_slug($game);
      if ($game !== "" && $game !== "all") {
         $args["game"] = $game;
      }
      if ($count !== null && $notice === "reset") {
         $args["p50a_count"] = absint($count);
      }
      wp_safe_redirect(add_query_arg($args, admin_url("admin.php")));
      exit;
   }
}

if (!function_exists("play50_arcade_admin_action_table")) {
   function play50_arcade_admin_action_table($game, $allow_all = false) {
      global $wpdb;
      if (!isset($_SERVER["REQUEST_METHOD"]) || $_SERVER["REQUEST_METHOD"] !== "POST"
         || !play50_arcade_admin_api_available() || $game === "") {
         play50_arcade_admin_redirect("error", $game);
      }
      // All four API helpers are checked by api_available before any call.
      $table = play50_arcade_table();
      if (!play50_arcade_admin_table_exists($table)) {
         play50_arcade_admin_redirect("error", $game);
      }
      if ($allow_all && $game === "all") {
         return $table;
      }
      $games = play50_arcade_games();
      if (!isset($games[$game])) {
         // Retired games may still have rows that administrators must remove.
         $count = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE game_slug = %s", $game));
         if ($wpdb->last_error !== "" || (int) $count < 1) {
            play50_arcade_admin_redirect("error", $game);
         }
      }
      return $table;
   }
}

if (!function_exists("play50_arcade_admin_duration")) {
   function play50_arcade_admin_duration($milliseconds) {
      if ($milliseconds === null) {
         return "—";
      }
      $centiseconds = intdiv(absint($milliseconds), 10);
      return sprintf("%d:%02d.%02d", intdiv($centiseconds, 6000), intdiv($centiseconds % 6000, 100), $centiseconds % 100);
   }
}

if (!function_exists("play50_arcade_admin_notice")) {
   function play50_arcade_admin_notice() {
      $notice = sanitize_key(play50_arcade_admin_input($_GET, "p50a_notice"));
      $messages = array(
         "deleted" => "Score row deleted.",
         "reset" => "Game scores reset.",
         "banned" => "User banned from the arcade. All of their scores are hidden.",
         "unbanned" => "User unbanned. All of their scores are visible.",
         "cleared" => "Leaderboard cache cleared.",
         "error" => "The action could not be completed. Check the input and whether the Arcade API and table are available."
      );
      if (!isset($messages[$notice])) {
         return;
      }
      $message = $messages[$notice];
      if ($notice === "reset") {
         $message .= " Rows deleted: " . absint(play50_arcade_admin_input($_GET, "p50a_count")) . ".";
      }
      echo '<div class="notice ' . esc_attr($notice === "error" ? "notice-error" : "notice-success") . '"><p>' . esc_html($message) . '</p></div>';
   }
}

if (!function_exists("play50_arcade_admin_form_start")) {
   function play50_arcade_admin_form_start($action, $nonce, $game) {
      echo '<form method="post" action="' . esc_url(admin_url("admin-post.php")) . '">';
      echo '<input type="hidden" name="action" value="' . esc_attr($action) . '">';
      echo '<input type="hidden" name="game" value="' . esc_attr($game) . '">';
      wp_nonce_field($nonce);
   }
}

if (!function_exists("play50_arcade_admin_render")) {
   function play50_arcade_admin_render() {
      global $wpdb;
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      if (!play50_arcade_admin_api_available()) {
         echo '<div class="notice notice-error"><p>' . esc_html("Arcade API not loaded") . '</p></div>';
         return;
      }
      $table = play50_arcade_table();
      $exists = play50_arcade_admin_table_exists($table);
      echo '<div class="wrap"><h1>' . esc_html("Arcade Scores") . '</h1>';
      play50_arcade_admin_notice();
      echo '<p>' . esc_html("DB version: " . (string) get_option("play50_arcade_db_version", "not installed") . " · Table: " . ($exists ? "exists" : "not installed")) . '</p>';
      if (!$exists) {
         echo '<div class="notice notice-warning"><p>' . esc_html("The Arcade Scores table does not exist yet. The Arcade API must install it before scores can be managed.") . '</p></div></div>';
         return;
      }
      // Bound a constant so every SQL query uses prepare, including this all-game aggregate.
      $counts = $wpdb->get_results($wpdb->prepare("SELECT game_slug, COUNT(*) AS n, SUM(hidden) AS h FROM {$table} WHERE %d = 1 GROUP BY game_slug", 1));
      if ($wpdb->last_error !== "" || !is_array($counts)) {
         echo '<div class="notice notice-error"><p>' . esc_html("Could not read arcade scores.") . '</p></div></div>';
         return;
      }
      $games = play50_arcade_games();
      $totals = array();
      foreach ($counts as $count) {
         $slug = play50_arcade_admin_slug($count->game_slug);
         if ($slug === "" || $slug !== $count->game_slug) {
            continue;
         }
         $totals[$slug] = array("rows" => absint($count->n), "hidden" => absint($count->h));
         if (!isset($games[$slug])) {
            $games[$slug] = array("title" => $slug, "enabled" => false, "admin_orphan" => true);
         }
      }
      if (empty($games)) {
         echo '<div class="notice notice-info"><p>' . esc_html("No arcade games are configured and there are no score rows.") . '</p></div></div>';
         return;
      }
      $slugs = array_keys($games);
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_GET, "game"));
      if (!isset($games[$game])) {
         $game = (string) $slugs[0];
      }
      $total = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM {$table} WHERE game_slug = %s", $game));
      if ($wpdb->last_error !== "" || $total === null) {
         echo '<div class="notice notice-error"><p>' . esc_html("Could not read arcade scores.") . '</p></div></div>';
         return;
      }
      $total = absint($total);
      $pages = max(1, (int) ceil($total / 50));
      $paged = min($pages, max(1, absint(play50_arcade_admin_input($_GET, "paged"))));
      $rows = $wpdb->get_results($wpdb->prepare(
         "SELECT id, user_id, best_score, best_duration_ms, last_score, plays, hidden, best_at, last_played
         FROM {$table} WHERE game_slug = %s
         ORDER BY best_score DESC, best_at ASC, id ASC LIMIT %d OFFSET %d",
         $game, 50, ($paged - 1) * 50
      ));
      if ($wpdb->last_error !== "" || !is_array($rows)) {
         echo '<div class="notice notice-error"><p>' . esc_html("Could not read arcade scores.") . '</p></div></div>';
         return;
      }
      $user_ids = array();
      foreach ($rows as $row) {
         $user_ids[] = absint($row->user_id);
      }
      cache_users(array_values(array_unique($user_ids)));

      echo '<form method="get" action="' . esc_url(admin_url("admin.php")) . '">';
      echo '<input type="hidden" name="page" value="' . esc_attr("play50-arcade-scores") . '">';
      echo '<p><label for="p50a-game">' . esc_html("Game ") . '</label><select name="game" id="p50a-game">';
      foreach ($games as $slug => $config) {
         $row_count = isset($totals[$slug]) ? $totals[$slug]["rows"] : 0;
         $hidden_count = isset($totals[$slug]) ? $totals[$slug]["hidden"] : 0;
         $badge = !empty($config["admin_orphan"]) ? "orphan / not configured" : (!empty($config["enabled"]) ? "enabled" : "disabled");
         $label = $config["title"] . " (" . $slug . ") — " . $badge . " — " . $row_count . " rows, " . $hidden_count . " hidden";
         echo '<option value="' . esc_attr($slug) . '"' . selected($game, $slug, false) . '>' . esc_html($label) . '</option>';
      }
      echo '</select> <button class="button" type="submit">' . esc_html("Filter") . '</button></p></form>';
      echo '<p>' . esc_html("Rank follows the public leaderboard: higher best score, then earlier best_at. Hidden rows have no rank. Dates are UTC.") . '</p>';
      echo '<table class="widefat striped"><thead><tr>';
      foreach (array("Rank", "User", "Public name", "Best score", "Best duration (m:ss.cc)", "Last score", "Plays", "Hidden", "Banned", "Best at (UTC)", "Last played (UTC)", "Actions") as $heading) {
         echo '<th scope="col">' . esc_html($heading) . '</th>';
      }
      echo '</tr></thead><tbody>';
      $ranks = array();
      foreach ($rows as $row) {
         $uid = absint($row->user_id);
         $row_id = absint($row->id);
         $user = get_userdata($uid);
         $banned = (bool) get_user_meta($uid, "play50_arcade_banned", true);
         $hidden = (bool) $row->hidden;
         $rank = "—";
         if (!$hidden) {
            $rank_key = (string) $row->best_score . "|" . $row->best_at;
            if (!isset($ranks[$rank_key])) {
               $value = $wpdb->get_var($wpdb->prepare(
                  "SELECT COUNT(*) + 1 FROM {$table} WHERE game_slug = %s AND hidden = 0
                  AND (best_score > %d OR (best_score = %d AND best_at < %s))",
                  $game, absint($row->best_score), absint($row->best_score), $row->best_at
               ));
               $ranks[$rank_key] = $wpdb->last_error === "" && $value !== null ? (string) absint($value) : "—";
            }
            $rank = $ranks[$rank_key];
         }
         echo '<tr><td>' . esc_html($rank) . '</td><td>';
         $edit_link = $user ? get_edit_user_link($uid) : "";
         if ($user && $edit_link) {
            echo '<a href="' . esc_url($edit_link) . '">' . esc_html($user->display_name . " (" . $user->user_login . ", #" . $uid . ")") . '</a>';
         } else {
            echo esc_html($user ? $user->display_name . " (#" . $uid . ")" : "Deleted user #" . $uid);
         }
         echo '</td><td>' . esc_html(play50_arcade_public_name($uid)) . '</td>';
         foreach (array(
            absint($row->best_score), play50_arcade_admin_duration($row->best_duration_ms), absint($row->last_score),
            absint($row->plays), $hidden ? "Yes" : "No", $banned ? "Yes" : "No", $row->best_at, $row->last_played
         ) as $cell) {
            echo '<td>' . esc_html($cell) . '</td>';
         }
         echo '<td>';
         play50_arcade_admin_form_start("play50_arcade_delete_row", "play50_arcade_delete_row_" . $row_id, $game);
         echo '<input type="hidden" name="row_id" value="' . esc_attr($row_id) . '">';
         echo '<button class="button button-small" type="submit" onclick="' . esc_attr("return confirm('Delete this score row?');") . '">' . esc_html("Delete row") . '</button></form>';
         if ($user) {
            $action = $banned ? "play50_arcade_unban_user" : "play50_arcade_ban_user";
            play50_arcade_admin_form_start($action, $action . "_" . $uid, $game);
            echo '<input type="hidden" name="user_id" value="' . esc_attr($uid) . '">';
            $confirmation = $banned ? "return confirm('Unban this user and show all their arcade scores?');" : "return confirm('Ban this user and hide all their arcade scores?');";
            echo '<button class="button button-small" type="submit" onclick="' . esc_attr($confirmation) . '">' . esc_html($banned ? "Unban user" : "Ban user") . '</button></form>';
         }
         echo '</td></tr>';
      }
      if (empty($rows)) {
         echo '<tr><td colspan="12">' . esc_html("No scores for this game.") . '</td></tr>';
      }
      echo '</tbody></table>';
      echo '<p>' . esc_html("Rows: " . $total . " · Page " . $paged . " of " . $pages . " · 50 rows per page") . '</p>';
      if ($pages > 1) {
         $base = add_query_arg(array("page" => "play50-arcade-scores", "game" => $game), admin_url("admin.php"));
         $links = paginate_links(array(
            "base" => $base . "&paged=%#%", "format" => "", "current" => $paged,
            "total" => $pages, "type" => "list", "prev_text" => "Previous", "next_text" => "Next"
         ));
         echo wp_kses_post($links);
      }
      echo '<h2>' . esc_html("Reset selected game") . '</h2>';
      play50_arcade_admin_form_start("play50_arcade_reset_game", "play50_arcade_reset_game_" . $game, $game);
      echo '<p><label for="p50a-confirm-slug">' . esc_html("Type " . $game . " to delete all its score rows: ") . '</label>';
      echo '<input id="p50a-confirm-slug" name="confirm_slug" type="text" autocomplete="off" required> ';
      echo '<button class="button" type="submit" onclick="' . esc_attr("return confirm('Delete every score row for the selected game? This cannot be undone.');") . '">' . esc_html("Reset game") . '</button></p></form>';
      echo '<h2>' . esc_html("Leaderboard cache") . '</h2>';
      foreach (array($game => "Clear selected game cache", "all" => "Clear all leaderboard caches") as $cache_game => $label) {
         play50_arcade_admin_form_start("play50_arcade_clear_cache", "play50_arcade_clear_cache", $cache_game);
         echo '<p><button class="button" type="submit">' . esc_html($label) . '</button></p></form>';
      }
      echo '</div>';
   }
}

if (!function_exists("play50_arcade_admin_delete_row")) {
   function play50_arcade_admin_delete_row() {
      global $wpdb;
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      $row_id = absint(play50_arcade_admin_input($_POST, "row_id"));
      check_admin_referer("play50_arcade_delete_row_" . $row_id);
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_POST, "game"));
      $table = play50_arcade_admin_action_table($game);
      if ($row_id < 1) {
         play50_arcade_admin_redirect("error", $game);
      }
      $deleted = $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE id = %d AND game_slug = %s", $row_id, $game));
      if ($deleted === false || $deleted < 1) {
         play50_arcade_admin_redirect("error", $game);
      }
      play50_arcade_clear_cache($game);
      play50_arcade_admin_redirect("deleted", $game);
   }
}
add_action("admin_post_play50_arcade_delete_row", "play50_arcade_admin_delete_row");

if (!function_exists("play50_arcade_admin_reset_game")) {
   function play50_arcade_admin_reset_game() {
      global $wpdb;
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_POST, "game"));
      check_admin_referer("play50_arcade_reset_game_" . $game);
      $table = play50_arcade_admin_action_table($game);
      // Compare the unslashed text exactly; sanitizing it could accept a mistyped slug.
      if (play50_arcade_admin_input($_POST, "confirm_slug") !== $game) {
         play50_arcade_admin_redirect("error", $game);
      }
      $deleted = $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE game_slug = %s", $game));
      if ($deleted === false) {
         play50_arcade_admin_redirect("error", $game);
      }
      play50_arcade_clear_cache($game);
      play50_arcade_admin_redirect("reset", $game, $deleted);
   }
}
add_action("admin_post_play50_arcade_reset_game", "play50_arcade_admin_reset_game");

if (!function_exists("play50_arcade_admin_ban_user")) {
   function play50_arcade_admin_ban_user() {
      global $wpdb;
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      $uid = absint(play50_arcade_admin_input($_POST, "user_id"));
      check_admin_referer("play50_arcade_ban_user_" . $uid);
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_POST, "game"));
      $table = play50_arcade_admin_action_table($game);
      if ($uid < 1 || !get_userdata($uid)) {
         play50_arcade_admin_redirect("error", $game);
      }
      $previous_ban = get_user_meta($uid, "play50_arcade_banned", true);
      update_user_meta($uid, "play50_arcade_banned", 1);
      if (!get_user_meta($uid, "play50_arcade_banned", true)) {
         play50_arcade_admin_redirect("error", $game);
      }
      $updated = $wpdb->query($wpdb->prepare("UPDATE {$table} SET hidden = %d WHERE user_id = %d", 1, $uid));
      if ($updated === false) {
         // Avoid claiming a ban when the score rows could not be hidden.
         if ($previous_ban) {
            update_user_meta($uid, "play50_arcade_banned", $previous_ban);
         } else {
            delete_user_meta($uid, "play50_arcade_banned");
         }
         play50_arcade_clear_cache();
         play50_arcade_admin_redirect("error", $game);
      }
      play50_arcade_clear_cache();
      play50_arcade_admin_redirect("banned", $game);
   }
}
add_action("admin_post_play50_arcade_ban_user", "play50_arcade_admin_ban_user");

if (!function_exists("play50_arcade_admin_unban_user")) {
   function play50_arcade_admin_unban_user() {
      global $wpdb;
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      $uid = absint(play50_arcade_admin_input($_POST, "user_id"));
      check_admin_referer("play50_arcade_unban_user_" . $uid);
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_POST, "game"));
      $table = play50_arcade_admin_action_table($game);
      if ($uid < 1 || !get_userdata($uid)) {
         play50_arcade_admin_redirect("error", $game);
      }
      $previous_ban = get_user_meta($uid, "play50_arcade_banned", true);
      delete_user_meta($uid, "play50_arcade_banned");
      if (get_user_meta($uid, "play50_arcade_banned", true)) {
         play50_arcade_admin_redirect("error", $game);
      }
      $updated = $wpdb->query($wpdb->prepare("UPDATE {$table} SET hidden = %d WHERE user_id = %d", 0, $uid));
      if ($updated === false) {
         if ($previous_ban) {
            update_user_meta($uid, "play50_arcade_banned", $previous_ban);
         }
         play50_arcade_clear_cache();
         play50_arcade_admin_redirect("error", $game);
      }
      play50_arcade_clear_cache();
      play50_arcade_admin_redirect("unbanned", $game);
   }
}
add_action("admin_post_play50_arcade_unban_user", "play50_arcade_admin_unban_user");

if (!function_exists("play50_arcade_admin_clear_cache")) {
   function play50_arcade_admin_clear_cache() {
      if (!current_user_can("manage_options")) {
         wp_die(esc_html__("Sorry, you are not allowed to do that."), "", array("response" => 403));
      }
      check_admin_referer("play50_arcade_clear_cache");
      $game = play50_arcade_admin_slug(play50_arcade_admin_input($_POST, "game"));
      play50_arcade_admin_action_table($game, true);
      play50_arcade_clear_cache($game === "all" ? null : $game);
      play50_arcade_admin_redirect("cleared", $game);
   }
}
add_action("admin_post_play50_arcade_clear_cache", "play50_arcade_admin_clear_cache");
