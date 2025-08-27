<?php
/*
Plugin Name: Simple Admin Page
Description: Registers a custom admin page in the WordPress backend.
Version: 1.0
Author: Your Name
*/

// Register the admin menu
add_action('admin_menu', 'simple_admin_page_menu');
function simple_admin_page_menu() {
    add_menu_page(
        'Simple Admin Page', // Page title
        'Simple Admin',      // Menu title
        'manage_options',    // Capability
        'simple-admin-page', // Menu slug
        'simple_admin_page_content', // Callback function
        'dashicons-admin-generic',   // Icon
        80                          // Position
    );
}

// Content for the admin page
function simple_admin_page_content() {
    echo '<div class="wrap">';
    echo '<h1>Simple Admin Page</h1>';
    echo '<p>Welcome to your custom admin page!</p>';
    echo '</div>';
}
