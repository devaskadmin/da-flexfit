<?php
/**
 * PHP version support check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Supported_PHP_Version extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'A-CORE-004';
	}

	public function run() {
		$current = PHP_VERSION;
		$min     = '8.1.0';
		$status  = version_compare( $current, $min, '>=' ) ? 'pass' : 'fail';

		return $this->build_result(
			$this->get_control_id(),
			'Supported PHP version',
			'Core WordPress Hygiene',
			'critical',
			$status,
			array(
				'php_version'        => $current,
				'recommended_minimum' => $min,
			),
			'Upgrade PHP runtime to a currently supported version after compatibility testing.'
		);
	}
}
