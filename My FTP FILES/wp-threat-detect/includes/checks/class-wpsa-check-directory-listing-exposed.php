<?php
/**
 * Directory listing exposure check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Directory_Listing_Exposed extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'F-FILE-003';
	}

	public function run() {
		$url      = content_url( '/uploads/' );
		$response = wp_remote_get( $url, array( 'timeout' => 8 ) );

		if ( is_wp_error( $response ) ) {
			return $this->build_result( $this->get_control_id(), 'Directory listing exposure', 'File / Environment Hardening', 'medium', 'unknown', array( 'error' => $response->get_error_message() ), 'Verify web server directory indexing is disabled.' );
		}

		$body     = (string) wp_remote_retrieve_body( $response );
		$code     = (int) wp_remote_retrieve_response_code( $response );
		$exposed  = 200 === $code && false !== stripos( $body, 'Index of' );
		$status   = $exposed ? 'warning' : 'pass';

		return $this->build_result(
			$this->get_control_id(),
			'Directory listing exposure',
			'File / Environment Hardening',
			'medium',
			$status,
			array(
				'url'                      => $url,
				'http_code'                => $code,
				'index_of_signature_found' => $exposed,
			),
			'Disable directory indexing in web server configuration.'
		);
	}
}
