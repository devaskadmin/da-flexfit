<?php
/**
 * HSTS header check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Header_HSTS_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-HEADERS-001';
	}

	public function run() {
		$response = wp_remote_head( home_url( '/' ), array( 'timeout' => 8 ) );
		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'HSTS header presence', 'Transport / Headers / Basic Web Security', 'medium', 'unknown', array( 'error' => $response->get_error_message() ), 'Validate Strict-Transport-Security header at web server/reverse proxy.' );
		}

		$header = wp_remote_retrieve_header( $response, 'strict-transport-security' );
		$status = ! empty( $header ) ? 'pass' : 'warning';
		return $this->build_result( $this->get_control_id(), 'HSTS header presence', 'Transport / Headers / Basic Web Security', 'medium', $status, array( 'strict_transport_security' => $header ), 'Enable Strict-Transport-Security with an appropriate max-age after HTTPS validation.' );
	}
}
