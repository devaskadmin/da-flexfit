<?php
/**
 * Plugin Name: WP Security SaaS Alpha
 * Plugin URI: https://example.com/wp-security-saas-alpha
 * Description: WordPress security posture assessment plugin (alpha). Runs security checks, scoring, and remediation guidance.
 * Version: 0.1.0-alpha
 * Author: Dev Asterisks
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: wp-security-saas-alpha
 * Domain Path: /languages
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'WPSA_VERSION', '0.1.0-alpha' );
define( 'WPSA_PLUGIN_FILE', __FILE__ );
define( 'WPSA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'WPSA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'WPSA_OPTION_SETTINGS', 'wpsa_settings' );
define( 'WPSA_OPTION_WIZARD_DONE', 'wpsa_wizard_completed' );
define( 'WPSA_OPTION_LAST_SCAN_ID', 'wpsa_last_scan_id' );
define( 'WPSA_CRON_HOOK', 'wpsa_run_scheduled_scan' );

require_once WPSA_PLUGIN_DIR . 'includes/core/class-wpsa-loader.php';
require_once WPSA_PLUGIN_DIR . 'includes/core/class-wpsa-plugin.php';

register_activation_hook( __FILE__, array( 'WPSA_Plugin', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'WPSA_Plugin', 'deactivate' ) );

function wpsa_bootstrap() {
	$plugin = new WPSA_Plugin();
	$plugin->run();
}

wpsa_bootstrap();
