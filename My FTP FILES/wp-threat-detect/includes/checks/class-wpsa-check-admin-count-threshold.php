<?php
/**
 * Admin count threshold check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Admin_Count_Threshold extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-004';
	}

	public function run() {
		$admins = get_users(
			array(
				'role'   => 'administrator',
				'fields' => 'ID',
			)
		);

		$settings  = get_option( WPSA_OPTION_SETTINGS, array() );
		$threshold = max( 1, absint( $settings['high_admin_threshold'] ?? 5 ) );
		$count     = is_array( $admins ) ? count( $admins ) : 0;
		$status    = $count > $threshold ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Admin user count threshold',
			'Authentication and Access',
			'medium',
			$status,
			array(
				'admin_user_count' => $count,
				'threshold'        => $threshold,
			),
			'Keep administrator account count minimal and review privileged access regularly.'
		);
	}
}
