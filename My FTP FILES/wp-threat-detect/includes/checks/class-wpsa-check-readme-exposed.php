<?php
/**
 * readme.html exposure check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Readme_Exposed extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'F-FILE-001';
	}

	public function run() {
		$url      = home_url( '/readme.html' );
		$response = wp_remote_get( $url, array( 'timeout' => 8 ) );

		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'readme.html exposure', 'File / Environment Hardening', 'low', 'unknown', array( 'error' => $response->get_error_message() ), 'Restrict or remove publicly accessible readme.html where possible.' );
		}

		$code   = (int) wp_remote_retrieve_response_code( $response );
		$status = 200 === $code ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'readme.html exposure',
			'File / Environment Hardening',
			'low',
			$status,
			array(
				'url'  => $url,
				'code' => $code,
			),
			'Disable public access to readme.html to reduce version leakage signals.'
		);
	}
}
