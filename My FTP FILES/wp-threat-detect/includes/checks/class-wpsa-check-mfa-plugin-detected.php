<?php
/**
 * MFA plugin detection check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_MFA_Plugin_Detected extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'B-AUTH-005';
	}

	public function run() {
		$known = array(
			'wordfence/wordfence.php',
			'wp-2fa/wp-2fa.php',
			'miniOrange-2-factor-authentication/2factor_miniorange.php',
			'two-factor/two-factor.php',
		);

		$active = (array) get_option( 'active_plugins', array() );
		$found  = false;

		foreach ( $known as $plugin_file ) {
			if ( in_array( $plugin_file, $active, true ) ) {
				$found = true;
				break;
			}
		}

		$status = $found ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'MFA plugin appears active',
			'Authentication and Access',
			'high',
			$status,
			array(
				'mfa_plugin_detected' => $found,
			),
			'Use an MFA solution for admin and privileged roles.'
		);
	}
}
