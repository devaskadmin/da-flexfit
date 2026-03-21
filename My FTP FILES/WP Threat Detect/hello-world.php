<?php
/**
 * Plugin Name: Hello World
 * Plugin URI: https://example.com/hello-world
 * Description: A simple Hello World WordPress plugin
 * Version: 1.0.0
 * Author: Stephen K
 * Author URI: https://example.com
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain: hello-world
 * Domain Path: /languages
 */

// If this file is called directly, abort.
if ( ! defined( 'WPINC' ) ) {
	die;
}

// Define plugin constants
define( 'HELLO_WORLD_VERSION', '1.0.0' );
define( 'HELLO_WORLD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'HELLO_WORLD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Activation hook
 */
function hello_world_activate() {
	// Activation code here
	error_log( 'Hello World plugin activated!' );
}
register_activation_hook( __FILE__, 'hello_world_activate' );

/**
 * Deactivation hook
 */
function hello_world_deactivate() {
	// Deactivation code here
	error_log( 'Hello World plugin deactivated!' );
}
register_deactivation_hook( __FILE__, 'hello_world_deactivate' );

/**
 * Add a simple shortcode
 */
function hello_world_shortcode() {
	return '<p style="color: #0073aa; font-weight: bold;">Hello World! This is my first WordPress plugin.</p>';
}
add_shortcode( 'hello_world', 'hello_world_shortcode' );

/**
 * Add admin notice
 */
function hello_world_admin_notice() {
	echo '<div class="notice notice-info"><p>Hello World plugin is active!</p></div>';
}
add_action( 'admin_notices', 'hello_world_admin_notice' );

/**
 * Load plugin text domain for translations
 */
function hello_world_load_textdomain() {
	load_plugin_textdomain(
		'hello-world',
		false,
		basename( dirname( __FILE__ ) ) . '/languages/'
	);
}
add_action( 'plugins_loaded', 'hello_world_load_textdomain' );
