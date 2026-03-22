<?php
/**
 * Referrer-Policy header check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Header_Referrer_Policy_Present extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-HEADERS-004';
	}

	public function run() {
		$response = wp_remote_head( home_url( '/' ), array( 'timeout' => 8 ) );
		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'Referrer-Policy header presence', 'Transport / Headers / Basic Web Security', 'low', 'unknown', array( 'error' => $response->get_error_message() ), 'Set an explicit Referrer-Policy to control referrer leakage.' );
		}

		$header = wp_remote_retrieve_header( $response, 'referrer-policy' );
		$status = ! empty( $header ) ? 'pass' : 'warning';
		return $this->build_result( $this->get_control_id(), 'Referrer-Policy header presence', 'Transport / Headers / Basic Web Security', 'low', $status, array( 'referrer_policy' => $header ), 'Set Referrer-Policy (for example strict-origin-when-cross-origin).' );
	}
}
