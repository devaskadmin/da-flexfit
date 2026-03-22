<?php
/**
 * Plugin settings manager.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Settings_Manager {

	/**
	 * Default settings.
	 *
	 * @return array<string,mixed>
	 */
	public function get_defaults() {
		return array(
			'site_type'             => 'other',
			'business_criticality'  => 'medium',
			'admin_count_estimate'  => 1,
			'processes_payments'    => 0,
			'stores_customer_data'  => 0,
			'uses_backups'          => 0,
			'uses_mfa'              => 0,
			'scan_mode'             => 'manual',
			'high_admin_threshold'  => 5,
		);
	}

	/**
	 * Returns merged settings.
	 *
	 * @return array<string,mixed>
	 */
	public function get_settings() {
		$stored = get_option( WPSA_OPTION_SETTINGS, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return wp_parse_args( $stored, $this->get_defaults() );
	}

	/**
	 * Save sanitized settings.
	 *
	 * @param array<string,mixed> $input Input values.
	 * @return array<string,mixed>
	 */
	public function save_settings( $input ) {
		$defaults = $this->get_defaults();
		$clean    = array();

		$clean['site_type']            = sanitize_key( $input['site_type'] ?? $defaults['site_type'] );
		$clean['business_criticality'] = sanitize_key( $input['business_criticality'] ?? $defaults['business_criticality'] );
		$clean['admin_count_estimate'] = max( 0, absint( $input['admin_count_estimate'] ?? $defaults['admin_count_estimate'] ) );
		$clean['processes_payments']   = empty( $input['processes_payments'] ) ? 0 : 1;
		$clean['stores_customer_data'] = empty( $input['stores_customer_data'] ) ? 0 : 1;
		$clean['uses_backups']         = empty( $input['uses_backups'] ) ? 0 : 1;
		$clean['uses_mfa']             = empty( $input['uses_mfa'] ) ? 0 : 1;
		$clean['scan_mode']            = sanitize_key( $input['scan_mode'] ?? $defaults['scan_mode'] );
		$clean['high_admin_threshold'] = max( 1, absint( $input['high_admin_threshold'] ?? $defaults['high_admin_threshold'] ) );

		if ( ! in_array( $clean['scan_mode'], array( 'manual', 'daily', 'weekly' ), true ) ) {
			$clean['scan_mode'] = 'manual';
		}

		update_option( WPSA_OPTION_SETTINGS, $clean, false );

		return $clean;
	}

	/**
	 * Wizard completion state.
	 *
	 * @return bool
	 */
	public function is_wizard_complete() {
		return (bool) get_option( WPSA_OPTION_WIZARD_DONE, false );
	}

	/**
	 * Marks wizard complete.
	 *
	 * @return void
	 */
	public function set_wizard_complete() {
		update_option( WPSA_OPTION_WIZARD_DONE, 1, false );
	}
}
