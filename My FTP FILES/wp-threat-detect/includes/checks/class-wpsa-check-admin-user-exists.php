<?php
/**
 * Admin username check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Admin_User_Exists extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-001';
	}

	public function run() {
		$user   = get_user_by( 'login', 'admin' );
		$exists = $user instanceof WP_User;
		$status = $exists ? 'fail' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Default admin username not used',
			'Authentication and Access',
			'high',
			$status,
			array(
				'admin_user_exists' => $exists,
			),
			'Avoid predictable administrator usernames. Rename or remove any account named admin.'
		);
	}
}
