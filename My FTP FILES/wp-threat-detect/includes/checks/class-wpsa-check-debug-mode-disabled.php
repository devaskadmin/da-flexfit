<?php
/**
 * Debug mode check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Debug_Mode_Disabled extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-006';
	}

	public function run() {
		$debug  = defined( 'WP_DEBUG' ) && WP_DEBUG;
		$status = $debug ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Debug mode disabled in production',
			'Core WordPress Hygiene',
			'medium',
			$status,
			array(
				'wp_debug' => $debug,
			),
			'Disable WP_DEBUG on production sites to avoid exposing internal details.'
		);
	}
}
