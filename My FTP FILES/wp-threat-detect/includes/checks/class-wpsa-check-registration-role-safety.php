<?php
/**
 * Registration role safety check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Registration_Role_Safety extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-003';
	}

	public function run() {
		$can_register = (bool) get_option( 'users_can_register', false );
		$default_role = (string) get_option( 'default_role', 'subscriber' );
		$unsafe       = in_array( $default_role, array( 'administrator', 'editor' ), true );

		if ( ! $can_register ) {
			$status = 'pass';
		} elseif ( $unsafe ) {
			$status = 'fail';
		} else {
			$status = 'pass';
		}

		return $this->build_result(
			$this->get_control_id(),
			'Registration default role safety',
			'Authentication and Access',
			'critical',
			$status,
			array(
				'users_can_register' => $can_register,
				'default_role'       => $default_role,
			),
			'If registration is enabled, default role should be low privilege (usually subscriber).'
		);
	}
}
