<?php
/**
 * SSL runtime detection check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_SSL_Detected extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-TRANSPORT-002';
	}

	public function run() {
		$ssl    = is_ssl();
		$status = $ssl ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'SSL/TLS detected at runtime',
			'Transport / Headers / Basic Web Security',
			'high',
			$status,
			array(
				'is_ssl' => $ssl,
			),
			'Ensure reverse proxy and WordPress are correctly configured for HTTPS detection.'
		);
	}
}
