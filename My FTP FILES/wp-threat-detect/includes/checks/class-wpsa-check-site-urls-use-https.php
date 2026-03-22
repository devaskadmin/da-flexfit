<?php
/**
 * Site URLs HTTPS check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_Site_URLs_Use_HTTPS extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'E-TRANSPORT-001';
	}

	public function run() {
		$home      = (string) get_option( 'home', '' );
		$siteurl   = (string) get_option( 'siteurl', '' );
		$home_ssl  = 0 === stripos( $home, 'https://' );
		$site_ssl  = 0 === stripos( $siteurl, 'https://' );
		$status    = ( $home_ssl && $site_ssl ) ? 'pass' : 'fail';

		return $this->build_result(
			$this->get_control_id(),
			'Site URLs use HTTPS',
			'Transport / Headers / Basic Web Security',
			'critical',
			$status,
			array(
				'home'         => $home,
				'siteurl'      => $siteurl,
				'home_is_https' => $home_ssl,
				'site_is_https' => $site_ssl,
			),
			'Set WordPress Address and Site Address to HTTPS and ensure valid TLS certificates.'
		);
	}
}
