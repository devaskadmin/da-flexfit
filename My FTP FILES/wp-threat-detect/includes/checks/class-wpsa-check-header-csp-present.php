<?php
/**
 * CSP header presence check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Header_CSP_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-HEADERS-005';
	}

	public function run() {
		$response = wp_remote_head( home_url( '/' ), array( 'timeout' => 8 ) );
		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'Content-Security-Policy header presence', 'Transport / Headers / Basic Web Security', 'medium', 'unknown', array( 'error' => $response->get_error_message() ), 'Add a Content-Security-Policy header in report-only then enforce mode.' );
		}

		$header = wp_remote_retrieve_header( $response, 'content-security-policy' );
		$status = ! empty( $header ) ? 'pass' : 'warning';
		return $this->build_result( $this->get_control_id(), 'Content-Security-Policy header presence', 'Transport / Headers / Basic Web Security', 'medium', $status, array( 'content_security_policy' => $header ), 'Define and deploy a Content-Security-Policy appropriate for this site.' );
	}
}
