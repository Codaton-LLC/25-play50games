<?php
// Test stub for WordPress' wp-admin/includes/upgrade.php: records dbDelta() calls.
if (!function_exists('dbDelta')) {
    function dbDelta($sql) {
        global $wpdb;
        $wpdb->created[] = $sql;
        if (preg_match('/CREATE TABLE (\S+)/', $sql, $m) === 1 && empty($wpdb->fail_create[$m[1]])) {
            $wpdb->tables[$m[1]] = true;
        }
        return array();
    }
}
