<?php
/**
 * Auto repair mode check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Auto_Repair_Enabled extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'C-DB-003';
	}

	public function run() {
		$enabled = defined( 'WP_ALLOW_REPAIR' ) && WP_ALLOW_REPAIR;
		$status  = $enabled ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Database auto-repair mode not exposed',
			'Database and Config Hardening',
			'medium',
			$status,
			array(
				'wp_allow_repair' => $enabled,
			),
			'Disable WP_ALLOW_REPAIR after maintenance to avoid exposing repair endpoint.'
		);
	}
}
