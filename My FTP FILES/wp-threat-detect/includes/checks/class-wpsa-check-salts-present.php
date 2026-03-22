<?php
/**
 * Salt keys presence check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Salts_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'C-DB-002';
	}

	public function run() {
		$constants = array(
			'AUTH_KEY',
			'SECURE_AUTH_KEY',
			'LOGGED_IN_KEY',
			'NONCE_KEY',
			'AUTH_SALT',
			'SECURE_AUTH_SALT',
			'LOGGED_IN_SALT',
			'NONCE_SALT',
		);

		$missing = array();
		foreach ( $constants as $constant ) {
			if ( ! defined( $constant ) || '' === constant( $constant ) ) {
				$missing[] = $constant;
			}
		}

		$status = empty( $missing ) ? 'pass' : 'fail';

		return $this->build_result(
			$this->get_control_id(),
			'WordPress salts are present',
			'Database and Config Hardening',
			'critical',
			$status,
			array(
				'missing_constants' => $missing,
			),
			'Ensure all WordPress auth keys and salts are defined with strong random values.'
		);
	}
}
