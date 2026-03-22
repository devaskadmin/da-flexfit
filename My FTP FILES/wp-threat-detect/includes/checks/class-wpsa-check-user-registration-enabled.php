<?php
/**
 * User registration enabled check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_User_Registration_Enabled extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-006';
	}

	public function run() {
		$enabled = (bool) get_option( 'users_can_register', false );
		$status  = $enabled ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Public user registration exposure',
			'Authentication and Access',
			'medium',
			$status,
			array(
				'users_can_register' => $enabled,
			),
			'Disable open registration when not needed and enforce strong onboarding controls.'
		);
	}
}
