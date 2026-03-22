<?php
/**
 * DB table prefix check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_DB_Prefix_Default extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'C-DB-001';
	}

	public function run() {
		global $wpdb;
		$prefix = isset( $wpdb->prefix ) ? (string) $wpdb->prefix : 'wp_';
		$status = 'wp_' === strtolower( $prefix ) ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Database table prefix is non-default',
			'Database and Config Hardening',
			'medium',
			$status,
			array(
				'table_prefix' => $prefix,
			),
			'Use a non-default table prefix when feasible during controlled migrations.'
		);
	}
}
