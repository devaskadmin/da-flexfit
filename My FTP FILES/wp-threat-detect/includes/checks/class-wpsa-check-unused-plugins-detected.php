<?php
/**
 * Unused plugins check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Unused_Plugins_Detected extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-007';
	}

	public function run() {
		if ( ! function_exists( 'get_plugins' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		$all_plugins   = get_plugins();
		$active        = (array) get_option( 'active_plugins', array() );
		$inactive      = array_diff( array_keys( $all_plugins ), $active );
		$inactive_count = count( $inactive );
		$status        = $inactive_count > 0 ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Unused plugins detected',
			'Core WordPress Hygiene',
			'medium',
			$status,
			array(
				'inactive_plugins'      => array_values( $inactive ),
				'inactive_plugin_count' => $inactive_count,
			),
			'Remove inactive plugins not required for operations to reduce attack surface.'
		);
	}
}
