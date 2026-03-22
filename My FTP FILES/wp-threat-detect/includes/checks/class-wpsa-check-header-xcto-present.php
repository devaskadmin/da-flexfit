<?php
/**
 * X-Content-Type-Options header check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Header_XCTO_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-HEADERS-003';
	}

	public function run() {
		$response = wp_remote_head( home_url( '/' ), array( 'timeout' => 8 ) );
		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'X-Content-Type-Options header presence', 'Transport / Headers / Basic Web Security', 'low', 'unknown', array( 'error' => $response->get_error_message() ), 'Set X-Content-Type-Options: nosniff.' );
		}

		$header = wp_remote_retrieve_header( $response, 'x-content-type-options' );
		$status = ! empty( $header ) ? 'pass' : 'warning';
		return $this->build_result( $this->get_control_id(), 'X-Content-Type-Options header presence', 'Transport / Headers / Basic Web Security', 'low', $status, array( 'x_content_type_options' => $header ), 'Set X-Content-Type-Options header to nosniff.' );
	}
}
