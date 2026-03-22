<?php
/**
 * X-Frame-Options header check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Header_XFO_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-HEADERS-002';
	}

	public function run() {
		$response = wp_remote_head( home_url( '/' ), array( 'timeout' => 8 ) );
		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'X-Frame-Options header presence', 'Transport / Headers / Basic Web Security', 'medium', 'unknown', array( 'error' => $response->get_error_message() ), 'Set X-Frame-Options (or equivalent CSP frame-ancestors policy).' );
		}

		$header = wp_remote_retrieve_header( $response, 'x-frame-options' );
		$status = ! empty( $header ) ? 'pass' : 'warning';
		return $this->build_result( $this->get_control_id(), 'X-Frame-Options header presence', 'Transport / Headers / Basic Web Security', 'medium', $status, array( 'x_frame_options' => $header ), 'Set X-Frame-Options to DENY or SAMEORIGIN (or CSP frame-ancestors equivalent).' );
	}
}
