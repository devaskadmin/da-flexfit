<?php
/**
 * wp-config protection check.
 *
 * @package WPSA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class WPSA_Check_WP_Config_Protection extends WPSA_Abstract_Check {

	public function get_control_id() {
		return 'F-FILE-004';
	}

	public function run() {
		$config_path = ABSPATH . 'wp-config.php';
		if ( ! file_exists( $config_path ) && file_exists( dirname( ABSPATH ) . '/wp-config.php' ) ) {
			$config_path = dirname( ABSPATH ) . '/wp-config.php';
		}

		$exists    = file_exists( $config_path );
		$readable  = $exists ? is_readable( $config_path ) : false;
		$writable  = $exists ? is_writable( $config_path ) : false;
		$perms     = $exists ? substr( sprintf( '%o', fileperms( $config_path ) ), -4 ) : null;
		$status    = ( $exists && ! $writable ) ? 'pass' : 'warning';

		return $this->build_result(
			$this->get_control_id(),
			'wp-config protection conditions',
			'File / Environment Hardening',
			'high',
			$status,
			array(
				'path'      => $config_path,
				'exists'    => $exists,
				'readable'  => $readable,
				'writable'  => $writable,
				'perms'     => $perms,
			),
			'Ensure wp-config.php is not writable by web process and has least-privilege file permissions.'
		);
	}
}
