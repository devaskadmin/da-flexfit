<?php
/**
 * Uninstall cleanup.
 *
 * @package WPSA
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

if ( ! current_user_can( 'activate_plugins' ) ) {
	return;
}

if ( ! defined( 'WPSA_OPTION_SETTINGS' ) ) {
	define( 'WPSA_OPTION_SETTINGS', 'wpsa_settings' );
	define( 'WPSA_OPTION_WIZARD_DONE', 'wpsa_wizard_completed' );
	define( 'WPSA_OPTION_LAST_SCAN_ID', 'wpsa_last_scan_id' );
	define( 'WPSA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}

require_once WPSA_PLUGIN_DIR . 'includes/storage/class-wpsa-scan-repository.php';

delete_option( WPSA_OPTION_SETTINGS );
delete_option( WPSA_OPTION_WIZARD_DONE );
delete_option( WPSA_OPTION_LAST_SCAN_ID );

if ( class_exists( 'WPSA_Scan_Repository' ) ) {
	$repo = new WPSA_Scan_Repository();
	$repo->drop_table();
}
